import RNFS from 'react-native-fs';
import {CHANNELS} from '../constants/audio';
import {createWavHeader, float32ToInt16} from './pcmUtils';
import {arrayBufferToBase64, base64ToBytes, bytesToBase64} from '../utils/base64';
import {hannWeight} from './chunkAudio';

const WRITE_BLOCK_SAMPLES = 44100 * CHANNELS;
const EXPORT_SLICE_FRAMES = 44100;

/** Write float32 PCM to disk in blocks (avoids a single huge base64 string). */
export async function savePcmRawStreaming(
  samples: Float32Array,
  outputPath: string,
): Promise<void> {
  await RNFS.writeFile(outputPath, '', 'utf8');

  for (let offset = 0; offset < samples.length; offset += WRITE_BLOCK_SAMPLES) {
    const end = Math.min(offset + WRITE_BLOCK_SAMPLES, samples.length);
    const slice = samples.subarray(offset, end);
    const bytes = new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength);
    await RNFS.appendFile(outputPath, bytesToBase64(bytes), 'base64');
  }
}

/** Read a slice of raw float32 PCM; missing regions are zero-filled. */
export async function readFloat32Region(
  path: string,
  startSample: number,
  frameCount: number,
): Promise<Float32Array> {
  const sampleCount = frameCount * CHANNELS;
  const result = new Float32Array(sampleCount);

  const exists = await RNFS.exists(path);
  if (!exists) {
    return result;
  }

  const startByte = startSample * CHANNELS * 4;
  const byteLength = sampleCount * 4;

  try {
    const stat = await RNFS.stat(path);
    if (startByte >= stat.size) {
      return result;
    }

    const toRead = Math.min(byteLength, stat.size - startByte);
    const base64 = await RNFS.read(path, toRead, startByte, 'base64');
    const bytes = base64ToBytes(base64);
    const copy = bytes.slice();
    const partial = new Float32Array(
      copy.buffer,
      copy.byteOffset,
      copy.byteLength / 4,
    );
    result.set(partial);
  } catch {
    // Uninitialized regions stay at zero.
  }

  return result;
}

/** Write a float32 PCM slice at a sample offset (creates/sparsely extends the file). */
export async function writeFloat32Region(
  path: string,
  startSample: number,
  data: Float32Array,
): Promise<void> {
  const startByte = startSample * CHANNELS * 4;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  await RNFS.write(path, bytesToBase64(bytes), startByte, 'base64');
}

/** Overlap-add ONNX vocal output into on-disk accumulation buffers. */
export async function accumulateVocalsFromStemsToDisk(
  output: Float32Array,
  dims: readonly number[],
  accumPath: string,
  weightPath: string,
  startSample: number,
  validSamples: number,
): Promise<void> {
  const vocalStemIndex = 3;
  const channels = dims[2];
  const time = dims[3];

  const accum = await readFloat32Region(accumPath, startSample, validSamples);
  const weight = await readFloat32Region(weightPath, startSample, validSamples);

  for (let t = 0; t < validSamples && t < time; t++) {
    const w = hannWeight(t, validSamples);
    for (let ch = 0; ch < channels && ch < CHANNELS; ch++) {
      const srcIdx = vocalStemIndex * channels * time + ch * time + t;
      const regionIdx = t * CHANNELS + ch;
      accum[regionIdx] += output[srcIdx] * w;
      weight[regionIdx] += w;
    }
  }

  await writeFloat32Region(accumPath, startSample, accum);
  await writeFloat32Region(weightPath, startSample, weight);
}

/**
 * Finalize overlap-add and write vocals.wav + mix.wav in small slices.
 * Peak RAM is one slice (~350 KB), not the full song.
 *
 * Live playback math (`output = musicGain * mix + (vocalGain - musicGain) * vocals`)
 * needs the untouched source mix on disk, so we mirror the decoded float32 mix
 * to a 16-bit WAV here instead of generating a derived instrumental file.
 */
export async function exportStemsFromDisk(
  mixPcmPath: string,
  vocalsAccumPath: string,
  vocalsWeightPath: string,
  vocalsWavPath: string,
  mixWavPath: string,
  totalFrames: number,
  onProgress?: (current: number, total: number) => void,
): Promise<{
  suppressionProfile: 'live_reconstruction';
  vocalsPeak: number;
  mixPeak: number;
}> {
  const totalSamples = totalFrames * CHANNELS;
  const dataSize = totalSamples * 2;
  const header = arrayBufferToBase64(createWavHeader(dataSize));

  await RNFS.writeFile(vocalsWavPath, header, 'base64');
  await RNFS.writeFile(mixWavPath, header, 'base64');

  const sliceCount = Math.ceil(totalFrames / EXPORT_SLICE_FRAMES);
  let vocalsPeak = 0;
  let mixPeak = 0;

  for (let slice = 0; slice < sliceCount; slice++) {
    const startFrame = slice * EXPORT_SLICE_FRAMES;
    const frameCount = Math.min(EXPORT_SLICE_FRAMES, totalFrames - startFrame);

    const mixSlice = await readFloat32Region(mixPcmPath, startFrame, frameCount);
    const accumSlice = await readFloat32Region(
      vocalsAccumPath,
      startFrame,
      frameCount,
    );
    const weightSlice = await readFloat32Region(
      vocalsWeightPath,
      startFrame,
      frameCount,
    );

    const sliceSamples = frameCount * CHANNELS;
    const vocalsSlice = new Float32Array(sliceSamples);

    for (let i = 0; i < sliceSamples; i++) {
      const vocal = weightSlice[i] > 0 ? accumSlice[i] / weightSlice[i] : 0;
      vocalsSlice[i] = vocal;
      vocalsPeak = Math.max(vocalsPeak, Math.abs(vocal));
      mixPeak = Math.max(mixPeak, Math.abs(mixSlice[i]));
    }

    const vocalInt16 = float32ToInt16(vocalsSlice);
    const mixInt16 = float32ToInt16(mixSlice);
    await RNFS.appendFile(
      vocalsWavPath,
      bytesToBase64(new Uint8Array(vocalInt16.buffer)),
      'base64',
    );
    await RNFS.appendFile(
      mixWavPath,
      bytesToBase64(new Uint8Array(mixInt16.buffer)),
      'base64',
    );

    onProgress?.(slice + 1, sliceCount);
  }

  return {
    suppressionProfile: 'live_reconstruction',
    vocalsPeak,
    mixPeak,
  };
}

export async function readPcmSliceFromRaw(
  rawPath: string,
  startSample: number,
  frameCount: number,
): Promise<Float32Array> {
  return readFloat32Region(rawPath, startSample, frameCount);
}
