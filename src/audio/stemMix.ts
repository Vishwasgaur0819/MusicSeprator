/**
 * Live-reconstruction mix helpers.
 *
 * Target playback formula (run live, not pre-rendered):
 *
 *   output = musicGain * mix + (vocalGain - musicGain) * vocals
 *
 * This avoids the phase-inverted vocal residue that a pre-rendered
 * `instrumental = mix - k * vocals` file would carry into the player
 * when the vocal slider sits at 0.
 *
 * Special cases:
 *   - Music Only (vocalGain=0, musicGain=1)  → mix - vocals
 *   - Vocals Only (vocalGain=1, musicGain=0) → vocals
 *   - Both Full  (vocalGain=1, musicGain=1)  → mix
 *   - Low Vocal  (vocalGain=0.4, musicGain=1) → mix - 0.6 * vocals
 */

/**
 * Gain to apply to the `mix.wav` buffer. Equals the music slider value.
 */
export function getMusicGain(_vocalGain: number, musicGain: number): number {
  return musicGain;
}

/**
 * Net gain to apply to the `vocals.wav` buffer. May be negative — the GainNode
 * in `react-native-audio-api` allows arbitrary real values and phase-inverts the
 * signal for negative gain, which is exactly what Music Only needs.
 */
export function getVocalNetGain(vocalGain: number, musicGain: number): number {
  return vocalGain - musicGain;
}

/**
 * Offline mix used by the export path. Same formula as live playback so the
 * exported WAV matches what the user just heard. Samples are clamped to
 * `[-1, 1]` to avoid integer overflow on 16-bit encode.
 */
export function mixFromSource(
  mix: Float32Array,
  vocals: Float32Array,
  vocalGain: number,
  musicGain: number,
): Float32Array {
  const length = Math.min(mix.length, vocals.length);
  const out = new Float32Array(length);
  const vocalNet = vocalGain - musicGain;
  for (let i = 0; i < length; i++) {
    const sample = mix[i] * musicGain + vocals[i] * vocalNet;
    if (sample > 1) {
      out[i] = 1;
    } else if (sample < -1) {
      out[i] = -1;
    } else {
      out[i] = sample;
    }
  }
  return out;
}
