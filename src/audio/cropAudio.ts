import {CHANNELS, SAMPLE_RATE} from '../constants/audio';
import {decodeAudioFile, savePcmAsWav} from './decodeAudio';

type DecodedAudioBuffer = Awaited<
  ReturnType<typeof decodeAudioFile>
>['buffer'];

export const MIN_CROP_SEC = 20;
export const TRIM_STEP_SEC = 0.1;
export const WAVEFORM_BUCKET_COUNT = 80;

export interface TrimRange {
  startSec: number;
  endSec: number;
}

export interface DecodedAudioForCrop {
  pcm: Float32Array;
  durationSec: number;
  peaks: number[];
  buffer: DecodedAudioBuffer;
}

export function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec + 1e-6));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function snapTrimSec(value: number): number {
  return Math.round(value / TRIM_STEP_SEC) * TRIM_STEP_SEC;
}

export function clampTrimRange(
  startSec: number,
  endSec: number,
  durationSec: number,
  moving: 'start' | 'end',
): TrimRange {
  if (durationSec <= 0) {
    return {startSec: 0, endSec: 0};
  }

  let start = snapTrimSec(Math.max(0, Math.min(startSec, durationSec)));
  let end = snapTrimSec(Math.max(0, Math.min(endSec, durationSec)));

  if (moving === 'start') {
    start = Math.min(start, end - MIN_CROP_SEC);
    start = Math.max(0, start);
    if (end - start < MIN_CROP_SEC) {
      end = Math.min(durationSec, start + MIN_CROP_SEC);
    }
  } else {
    end = Math.max(end, start + MIN_CROP_SEC);
    end = Math.min(durationSec, end);
    if (end - start < MIN_CROP_SEC) {
      start = Math.max(0, end - MIN_CROP_SEC);
    }
  }

  end = Math.min(durationSec, Math.max(end, start + MIN_CROP_SEC));
  start = Math.max(0, Math.min(start, end - MIN_CROP_SEC));

  return {startSec: start, endSec: end};
}

export function buildWaveformPeaks(
  pcm: Float32Array,
  bucketCount: number,
): number[] {
  const frameCount = Math.floor(pcm.length / CHANNELS);
  if (frameCount === 0 || bucketCount <= 0) {
    return [];
  }

  const framesPerBucket = Math.max(1, Math.floor(frameCount / bucketCount));
  const peaks: number[] = [];

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const startFrame = bucket * framesPerBucket;
    const endFrame = Math.min(frameCount, startFrame + framesPerBucket);
    let peak = 0;

    for (let frame = startFrame; frame < endFrame; frame++) {
      for (let ch = 0; ch < CHANNELS; ch++) {
        peak = Math.max(peak, Math.abs(pcm[frame * CHANNELS + ch]));
      }
    }

    peaks.push(peak);
  }

  return peaks;
}

export function isFullSongSelection(
  startSec: number,
  endSec: number,
  durationSec: number,
): boolean {
  return (
    startSec <= 0.05 && Math.abs(endSec - durationSec) <= 0.05
  );
}

export function validateCropRange(
  startSec: number,
  endSec: number,
  durationSec: number,
): void {
  if (durationSec <= 0) {
    throw new Error('Audio duration is invalid.');
  }
  if (startSec < 0 || endSec > durationSec || startSec >= endSec) {
    throw new Error('Crop range is invalid.');
  }
  if (isFullSongSelection(startSec, endSec, durationSec)) {
    return;
  }
  if (endSec - startSec < MIN_CROP_SEC) {
    throw new Error(`Selection must be at least ${MIN_CROP_SEC} seconds.`);
  }
}

export function slicePcm(
  pcm: Float32Array,
  startSec: number,
  endSec: number,
): Float32Array {
  validateCropRange(startSec, endSec, pcm.length / CHANNELS / SAMPLE_RATE);

  const startFrame = Math.floor(startSec * SAMPLE_RATE);
  const endFrame = Math.floor(endSec * SAMPLE_RATE);
  const startIndex = startFrame * CHANNELS;
  const endIndex = endFrame * CHANNELS;

  return pcm.slice(startIndex, endIndex);
}

export async function decodeAudioForCrop(
  inputPath: string,
): Promise<DecodedAudioForCrop> {
  const {buffer, pcm, durationSec} = await decodeAudioFile(inputPath);

  return {
    buffer,
    pcm,
    durationSec,
    peaks: buildWaveformPeaks(pcm, WAVEFORM_BUCKET_COUNT),
  };
}

export async function saveCroppedPcm(
  pcm: Float32Array,
  startSec: number,
  endSec: number,
  outputPath: string,
): Promise<number> {
  const cropped = slicePcm(pcm, startSec, endSec);
  await savePcmAsWav(cropped, outputPath);
  return cropped.length / CHANNELS / SAMPLE_RATE;
}

export async function cropAudioFile(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
): Promise<number> {
  const {pcm} = await decodeAudioForCrop(inputPath);
  return saveCroppedPcm(pcm, startSec, endSec, outputPath);
}
