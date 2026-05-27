import {
  BLEED_CANCEL_MAX,
  BLEED_CANCEL_VOCAL_THRESHOLD,
  CHANNELS,
  MUSIC_ONLY_CENTER_CANCEL,
} from '../constants/audio';

/** Extra vocal subtraction when the voice slider is low (0 = full cancel strength). */
export function computeBleedCancellation(vocalGain: number): number {
  if (vocalGain >= BLEED_CANCEL_VOCAL_THRESHOLD) {
    return 0;
  }
  const t = 1 - vocalGain / BLEED_CANCEL_VOCAL_THRESHOLD;
  return BLEED_CANCEL_MAX * t * t;
}

/** Vocal bus gain used for playback/export (never negative). */
export function getEffectiveVocalGain(vocalGain: number): number {
  return Math.max(0, vocalGain - computeBleedCancellation(vocalGain));
}

/**
 * Mix vocals + music with adaptive bleed cancellation.
 * When voice slider → 0, subtracts more of the vocal stem from the output.
 */
export function mixStems(
  vocals: Float32Array,
  instrumental: Float32Array,
  vocalGain: number,
  musicGain: number,
  normalize = true,
): Float32Array {
  const length = Math.min(vocals.length, instrumental.length);
  const mixed = new Float32Array(length);
  const bleedCancel = computeBleedCancellation(vocalGain);
  const effectiveVocalGain = getEffectiveVocalGain(vocalGain);
  const centerCancel = MUSIC_ONLY_CENTER_CANCEL * (bleedCancel / BLEED_CANCEL_MAX);

  let peak = 0;
  const frames = length / CHANNELS;

  for (let frame = 0; frame < frames; frame++) {
    const i = frame * CHANNELS;
    const centerV = (vocals[i] + vocals[i + 1]) * 0.5;

    for (let ch = 0; ch < CHANNELS; ch++) {
      const idx = i + ch;
      let sample =
        vocals[idx] * effectiveVocalGain + instrumental[idx] * musicGain;
      sample -= centerCancel * centerV;
      mixed[idx] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
  }

  if (normalize && peak > 1) {
    const scale = 1 / peak;
    for (let i = 0; i < length; i++) {
      mixed[i] *= scale;
    }
  }

  return mixed;
}
