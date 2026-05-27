import {CHANNELS, SEGMENT_SAMPLES} from '../constants/audio';
import type {SessionPaths, SeparationProgress} from '../types/session';
import {
  analyzeStemOutput,
  buildChunkTensorDataFromDisk,
  countAudioChunks,
  iterateChunkSpecs,
  toOnnxMixInput,
} from '../audio/chunkAudio';
import {
  accumulateVocalsFromStemsToDisk,
  exportStemsFromDisk,
  savePcmRawStreaming,
} from '../audio/diskPcm';
import {decodeAudioToPcm} from '../audio/decodeAudio';
import {loadModel, Tensor, unloadModel} from './loadModel';
import {getActiveModelPath, getModelSetupInstructions, isModelAvailable} from './modelManager';
import RNFS from 'react-native-fs';
import {KEEP_SESSION_FILES_FOR_TESTING} from '../config/dev';

type ProgressCallback = (progress: SeparationProgress) => void;

/** Bump when separation pipeline changes — old stems must be re-processed. */
export const SEPARATION_PIPELINE_VERSION = 5;

const UI_YIELD_EVERY = 3;

export async function separateStems(
  paths: SessionPaths,
  onProgress: ProgressCallback,
  signal?: {cancelled: boolean},
): Promise<void> {
  const modelReady = await isModelAvailable();
  if (!modelReady) {
    throw new Error(getModelSetupInstructions());
  }

  onProgress({
    phase: 'decoding',
    current: 0,
    total: 1,
    message: 'Decoding audio…',
  });

  if (signal?.cancelled) {
    return;
  }

  await cleanupStaleSeparationArtifacts(paths);

  let totalFrames: number;
  let mixPcm: Float32Array | null = null;
  mixPcm = await decodeAudioToPcm(paths.original);
  totalFrames = Math.floor(mixPcm.length / CHANNELS);
  await savePcmRawStreaming(mixPcm, paths.originalPcm);
  // Drop decode buffer before loading ONNX session to reduce peak memory.
  mixPcm = null;
  await yieldToUi();

  const chunkCount = countAudioChunks(totalFrames);
  const estMinutes = Math.max(1, Math.ceil(chunkCount * 0.2));

  onProgress({
    phase: 'separating',
    current: 0,
    total: chunkCount,
    message: `Loading AI model… (${chunkCount} chunks, ~${estMinutes} min)`,
  });

  const modelPath = await getActiveModelPath();
  const session = await loadModel();
  const inputName = session.inputNames[0] ?? 'mix';
  const outputName = session.outputNames[0] ?? 'stems';
  const frames = SEGMENT_SAMPLES;
  let chunkIndex = 0;
  let chunk0Diagnostics: ReturnType<typeof analyzeStemOutput> | null = null;

  for (const spec of iterateChunkSpecs(totalFrames)) {
    if (signal?.cancelled) {
      await unloadModel();
      return;
    }

    if (chunkIndex % UI_YIELD_EVERY === 0) {
      onProgress({
        phase: 'separating',
        current: chunkIndex,
        total: chunkCount,
        message: `Separating vocals… chunk ${chunkIndex + 1}/${chunkCount}`,
      });
      await yieldToUi();
    }

    const interleavedChunk = await buildChunkTensorDataFromDisk(
      paths.originalPcm,
      spec.startSample,
      spec.validSamples,
    );
    const tensorData = toOnnxMixInput(interleavedChunk);

    const inputTensor = new Tensor('float32', tensorData, [
      1,
      CHANNELS,
      frames,
    ]);

    const result = await session.run({[inputName]: inputTensor});
    const output = result[outputName];

    if (!output || !(output.data instanceof Float32Array)) {
      throw new Error('Unexpected ONNX output format');
    }

    if (!output.dims || output.dims.length !== 4) {
      throw new Error('Unexpected ONNX output shape');
    }

    if (chunkIndex === 0) {
      chunk0Diagnostics = analyzeStemOutput(
        output.data as Float32Array,
        output.dims,
        spec.validSamples,
      );
    }

    await accumulateVocalsFromStemsToDisk(
      output.data as Float32Array,
      output.dims,
      paths.vocalsAccum,
      paths.vocalsWeight,
      spec.startSample,
      spec.validSamples,
    );

    chunkIndex += 1;
  }

  await unloadModel();

  onProgress({
    phase: 'saving',
    current: 0,
    total: 1,
    message: 'Saving stems…',
  });

  const stemExportStats = await exportStemsFromDisk(
    paths.originalPcm,
    paths.vocalsAccum,
    paths.vocalsWeight,
    paths.vocals,
    paths.mix,
    totalFrames,
    (current, total) => {
      onProgress({
        phase: 'saving',
        current,
        total,
        message: `Writing stems… ${current}/${total}`,
      });
    },
  );

  await RNFS.writeFile(
    `${paths.dir}/separation-diagnostics.json`,
    JSON.stringify(
      {
        pipelineVersion: SEPARATION_PIPELINE_VERSION,
        inputLayout: 'planar',
        modelPath,
        chunk0: chunk0Diagnostics,
        modelWorking:
          chunk0Diagnostics !== null && chunk0Diagnostics.vocalPeak > 0.001,
        suppressionProfile: stemExportStats.suppressionProfile,
        stemPeaks: {
          vocals: stemExportStats.vocalsPeak,
          mix: stemExportStats.mixPeak,
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!KEEP_SESSION_FILES_FOR_TESTING) {
    await cleanupTempFiles(paths);
  }
}

async function cleanupStaleSeparationArtifacts(
  paths: SessionPaths,
): Promise<void> {
  for (const filePath of [
    paths.originalPcm,
    paths.vocalsAccum,
    paths.vocalsWeight,
  ]) {
    if (await RNFS.exists(filePath)) {
      await RNFS.unlink(filePath);
    }
  }
}

async function cleanupTempFiles(paths: SessionPaths): Promise<void> {
  if (KEEP_SESSION_FILES_FOR_TESTING) {
    return;
  }

  for (const filePath of [
    paths.originalPcm,
    paths.vocalsAccum,
    paths.vocalsWeight,
  ]) {
    if (await RNFS.exists(filePath)) {
      await RNFS.unlink(filePath);
    }
  }
}

function yieldToUi(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}
