import {CHANNELS, OVERLAP_SAMPLES, SEGMENT_SAMPLES} from '../constants/audio';
import {readPcmSliceFromRaw} from './diskPcm';

export interface AudioChunk {
  index: number;
  startSample: number;
  /** Interleaved stereo samples for this chunk, padded to SEGMENT_SAMPLES per channel. */
  data: Float32Array;
  validSamples: number;
}

/**
 * Count ONNX chunks without allocating chunk buffers.
 */
export function countAudioChunks(totalFrames: number): number {
  if (totalFrames <= SEGMENT_SAMPLES) {
    return 1;
  }
  const hop = SEGMENT_SAMPLES - OVERLAP_SAMPLES;
  let count = 0;
  let startFrame = 0;
  while (startFrame < totalFrames) {
    count += 1;
    const endFrame = Math.min(startFrame + SEGMENT_SAMPLES, totalFrames);
    if (endFrame >= totalFrames) {
      break;
    }
    startFrame += hop;
  }
  return count;
}

export interface ChunkSpec {
  index: number;
  startSample: number;
  validSamples: number;
}

/** Iterate chunk metadata without pre-allocating padded buffers. */
export function* iterateChunkSpecs(
  totalFrames: number,
): Generator<ChunkSpec> {
  if (totalFrames <= SEGMENT_SAMPLES) {
    yield {index: 0, startSample: 0, validSamples: totalFrames};
    return;
  }

  const hop = SEGMENT_SAMPLES - OVERLAP_SAMPLES;
  let startFrame = 0;
  let index = 0;
  while (startFrame < totalFrames) {
    const endFrame = Math.min(startFrame + SEGMENT_SAMPLES, totalFrames);
    yield {
      index,
      startSample: startFrame,
      validSamples: endFrame - startFrame,
    };
    if (endFrame >= totalFrames) {
      break;
    }
    startFrame += hop;
    index += 1;
  }
}

/** Build one padded ONNX input buffer from on-disk PCM. */
export async function buildChunkTensorDataFromDisk(
  pcmPath: string,
  startSample: number,
  validSamples: number,
): Promise<Float32Array> {
  const slice = await readPcmSliceFromRaw(pcmPath, startSample, validSamples);
  return padChunk(slice, validSamples);
}

/** Overlap-add vocals directly from ONNX stems output (1,4,2,T) without copying. */
export function accumulateVocalsFromStemsOutput(
  output: Float32Array,
  dims: readonly number[],
  vocalsAccum: Float32Array,
  vocalsWeight: Float32Array,
  startSample: number,
  validSamples: number,
): void {
  const vocalStemIndex = 3;
  const channels = dims[2];
  const time = dims[3];

  for (let t = 0; t < validSamples && t < time; t++) {
    const w = hannWeight(t, validSamples);
    for (let ch = 0; ch < channels && ch < CHANNELS; ch++) {
      const srcIdx = vocalStemIndex * channels * time + ch * time + t;
      const outIdx = (startSample + t) * CHANNELS + ch;
      if (outIdx >= vocalsAccum.length) {
        return;
      }
      vocalsAccum[outIdx] += output[srcIdx] * w;
      vocalsWeight[outIdx] += w;
    }
  }
}

/** Build one padded ONNX input buffer from PCM (caller can GC after inference). */
export function buildChunkTensorData(
  pcm: Float32Array,
  startSample: number,
  validSamples: number,
): Float32Array {
  const slice = pcm.slice(
    startSample * CHANNELS,
    (startSample + validSamples) * CHANNELS,
  );
  return padChunk(slice, validSamples);
}

/** Incrementally overlap-add one vocal chunk into running buffers. */
export function accumulateOverlapAdd(
  output: Float32Array,
  weight: Float32Array,
  startSample: number,
  chunkData: Float32Array,
  validSamples: number,
): void {
  const validLength = validSamples * CHANNELS;
  for (let i = 0; i < validLength; i++) {
    const outIdx = startSample * CHANNELS + i;
    if (outIdx >= output.length) {
      break;
    }
    const w = hannWeight(i / CHANNELS, validSamples);
    output[outIdx] += chunkData[i] * w;
    weight[outIdx] += w;
  }
}

export function finalizeOverlapAdd(
  output: Float32Array,
  weight: Float32Array,
): Float32Array {
  for (let i = 0; i < output.length; i++) {
    if (weight[i] > 0) {
      output[i] /= weight[i];
    }
  }
  return output;
}

/**
 * Split interleaved stereo PCM into overlapping chunks for ONNX inference.
 */
export function chunkAudio(pcm: Float32Array): AudioChunk[] {
  const totalFrames = Math.floor(pcm.length / CHANNELS);
  const hop = SEGMENT_SAMPLES - OVERLAP_SAMPLES;
  const chunks: AudioChunk[] = [];

  if (totalFrames <= SEGMENT_SAMPLES) {
    const padded = padChunk(pcm, totalFrames);
    chunks.push({
      index: 0,
      startSample: 0,
      data: padded,
      validSamples: totalFrames,
    });
    return chunks;
  }

  let startFrame = 0;
  let index = 0;
  while (startFrame < totalFrames) {
    const endFrame = Math.min(startFrame + SEGMENT_SAMPLES, totalFrames);
    const frameCount = endFrame - startFrame;
    const slice = pcm.slice(
      startFrame * CHANNELS,
      endFrame * CHANNELS,
    );
    chunks.push({
      index,
      startSample: startFrame,
      data: padChunk(slice, frameCount),
      validSamples: frameCount,
    });

    if (endFrame >= totalFrames) {
      break;
    }
    startFrame += hop;
    index += 1;
  }

  return chunks;
}

function padChunk(slice: Float32Array, frameCount: number): Float32Array {
  const targetLength = SEGMENT_SAMPLES * CHANNELS;
  if (slice.length >= targetLength) {
    return slice.slice(0, targetLength);
  }
  const padded = new Float32Array(targetLength);
  padded.set(slice);
  return padded;
}

/**
 * ONNX mix input shape [1, 2, T] uses planar layout (all L then all R).
 * Our PCM pipeline stores interleaved L/R — must convert before inference.
 */
export function interleavedToPlanar(
  interleaved: Float32Array,
  frames: number,
): Float32Array {
  const planar = new Float32Array(frames * CHANNELS);
  for (let t = 0; t < frames; t++) {
    planar[t] = interleaved[t * CHANNELS];
    planar[frames + t] = interleaved[t * CHANNELS + 1];
  }
  return planar;
}

/** Padded interleaved chunk → planar ONNX input buffer [1, 2, SEGMENT_SAMPLES]. */
export function toOnnxMixInput(interleavedChunk: Float32Array): Float32Array {
  return interleavedToPlanar(interleavedChunk, SEGMENT_SAMPLES);
}

/** Measure per-stem peak on chunk 0 for separation diagnostics. */
export function analyzeStemOutput(
  output: Float32Array,
  dims: readonly number[],
  validSamples: number,
): {vocalPeak: number; stemPeaks: number[]} {
  const channels = dims[2];
  const time = dims[3];
  const stemPeaks: number[] = [];

  for (let stem = 0; stem < 4; stem++) {
    let peak = 0;
    for (let t = 0; t < validSamples && t < time; t++) {
      for (let ch = 0; ch < channels; ch++) {
        const idx = stem * channels * time + ch * time + t;
        peak = Math.max(peak, Math.abs(output[idx]));
      }
    }
    stemPeaks.push(peak);
  }

  return {vocalPeak: stemPeaks[3] ?? 0, stemPeaks};
}

/**
 * Stitch vocal chunks back together using overlap-add with Hann window.
 */
export function stitchChunks(
  chunks: {startSample: number; data: Float32Array; validSamples: number}[],
  totalFrames: number,
): Float32Array {
  const output = new Float32Array(totalFrames * CHANNELS);
  const weight = new Float32Array(totalFrames * CHANNELS);

  for (const chunk of chunks) {
    const validLength = chunk.validSamples * CHANNELS;
    for (let i = 0; i < validLength; i++) {
      const outIdx = chunk.startSample * CHANNELS + i;
      if (outIdx >= output.length) {
        break;
      }
      const w = hannWeight(i / CHANNELS, chunk.validSamples);
      output[outIdx] += chunk.data[i] * w;
      weight[outIdx] += w;
    }
  }

  for (let i = 0; i < output.length; i++) {
    if (weight[i] > 0) {
      output[i] /= weight[i];
    }
  }

  return output;
}

export function hannWeight(frameIndex: number, totalFrames: number): number {
  if (totalFrames <= 1) {
    return 1;
  }
  return 0.5 * (1 - Math.cos((2 * Math.PI * frameIndex) / (totalFrames - 1)));
}
