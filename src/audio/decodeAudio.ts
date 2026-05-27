import {decodeAudioData} from 'react-native-audio-api';
import RNFS from 'react-native-fs';
import {CHANNELS, SAMPLE_RATE} from '../constants/audio';
import {encodeWav, int16ToFloat32} from './pcmUtils';
import {arrayBufferToBase64, base64ToBytes} from '../utils/base64';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Extract interleaved stereo Float32 PCM from an AudioBuffer. */
export function audioBufferToPcm(
  buffer: Awaited<ReturnType<typeof decodeAudioData>>,
): Float32Array {
  const channels = Math.min(buffer.numberOfChannels, CHANNELS);
  const frames = buffer.length;
  const pcm = new Float32Array(frames * CHANNELS);

  for (let ch = 0; ch < channels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < frames; i++) {
      pcm[i * CHANNELS + ch] = channelData[i];
    }
  }

  if (buffer.sampleRate !== SAMPLE_RATE) {
    return resamplePcm(pcm, buffer.sampleRate, SAMPLE_RATE, CHANNELS);
  }

  return pcm;
}

/** Simple linear resampling for stereo interleaved PCM. */
function resamplePcm(
  input: Float32Array,
  fromRate: number,
  toRate: number,
  channels: number,
): Float32Array {
  const inputFrames = input.length / channels;
  const outputFrames = Math.floor((inputFrames * toRate) / fromRate);
  const output = new Float32Array(outputFrames * channels);
  const ratio = fromRate / toRate;

  for (let outFrame = 0; outFrame < outputFrames; outFrame++) {
    const srcFrame = outFrame * ratio;
    const idx = Math.floor(srcFrame);
    const frac = srcFrame - idx;
    const nextIdx = Math.min(idx + 1, inputFrames - 1);

    for (let ch = 0; ch < channels; ch++) {
      const s0 = input[idx * channels + ch];
      const s1 = input[nextIdx * channels + ch];
      output[outFrame * channels + ch] = s0 + (s1 - s0) * frac;
    }
  }

  return output;
}

/**
 * Decode any supported audio file to interleaved Float32 PCM at 44.1kHz stereo.
 */
export async function decodeAudioToPcm(inputPath: string): Promise<Float32Array> {
  const {pcm} = await decodeAudioFile(inputPath);
  return pcm;
}

export async function decodeAudioFile(inputPath: string): Promise<{
  buffer: Awaited<ReturnType<typeof decodeAudioData>>;
  pcm: Float32Array;
  durationSec: number;
}> {
  const buffer = await decodeAudioData(toFileUri(inputPath));
  const pcm = audioBufferToPcm(buffer);
  return {
    buffer,
    pcm,
    durationSec: pcm.length / CHANNELS / SAMPLE_RATE,
  };
}

export async function savePcmAsWav(
  samples: Float32Array,
  outputPath: string,
): Promise<void> {
  const wavBuffer = encodeWav(samples);
  const base64 = arrayBufferToBase64(wavBuffer);
  await RNFS.writeFile(outputPath, base64, 'base64');
}

export async function readWavAsPcm(wavPath: string): Promise<Float32Array> {
  const base64 = await RNFS.readFile(wavPath, 'base64');
  const bytes = base64ToBytes(base64);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataOffset = findWavDataOffset(view);
  const dataSize = view.getUint32(dataOffset - 4, true);
  const pcmBytes = bytes.slice(dataOffset, dataOffset + dataSize);
  return int16ToFloat32(pcmBytes.slice().buffer);
}

function findWavDataOffset(view: DataView): number {
  let offset = 12;
  while (offset < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      return offset + 8;
    }
    offset += 8 + chunkSize;
  }
  throw new Error('WAV data chunk not found');
}
