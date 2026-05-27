import {CHANNELS, SAMPLE_RATE} from '../constants/audio';
import {base64ToBytes} from '../utils/base64';

/** Convert interleaved Int16 PCM to normalized Float32 [-1, 1]. */
export function int16ToFloat32(buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
  }
  return float32;
}

/** Convert normalized Float32 to interleaved Int16. */
export function float32ToInt16(samples: Float32Array): Int16Array {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return int16;
}

/** Read raw s16le interleaved PCM from base64 file content. */
export function readPcmS16leFromBase64(base64: string): Float32Array {
  const bytes = base64ToBytes(base64);
  const copy = bytes.slice().buffer;
  return int16ToFloat32(copy);
}

/** Build a WAV header for a known PCM data byte length. */
export function createWavHeader(dataSize: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * 2, true);
  view.setUint16(32, CHANNELS * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return buffer;
}

/** Build a minimal WAV file buffer from interleaved float32 samples. */
export function encodeWav(samples: Float32Array): ArrayBuffer {
  const int16 = float32ToInt16(samples);
  const dataSize = int16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const header = createWavHeader(dataSize);
  new Uint8Array(buffer).set(new Uint8Array(header));
  const view = new DataView(buffer);
  let offset = 44;
  for (let i = 0; i < int16.length; i++) {
    view.setInt16(offset, int16[i], true);
    offset += 2;
  }

  return buffer;
}

/** Mix two stems with independent gains; optional normalization to prevent clipping. */
export {mixStems} from './stemMix';
