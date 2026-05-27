import {
  getMusicGain,
  getVocalNetGain,
  mixFromSource,
} from '../src/audio/stemMix';

function makeArray(values: number[]): Float32Array {
  return Float32Array.from(values);
}

function approxEqual(
  actual: Float32Array,
  expected: number[],
  epsilon = 1e-6,
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(epsilon);
  }
}

describe('live reconstruction gain helpers', () => {
  test('music gain mirrors the music slider', () => {
    expect(getMusicGain(0, 1)).toBe(1);
    expect(getMusicGain(1, 0)).toBe(0);
    expect(getMusicGain(0.4, 0.75)).toBeCloseTo(0.75);
  });

  test('vocal net gain equals vocalGain - musicGain (can be negative)', () => {
    expect(getVocalNetGain(0, 1)).toBe(-1);
    expect(getVocalNetGain(1, 0)).toBe(1);
    expect(getVocalNetGain(1, 1)).toBe(0);
    expect(getVocalNetGain(0.4, 1)).toBeCloseTo(-0.6);
  });
});

describe('mixFromSource', () => {
  const mix = makeArray([0.5, -0.5, 0.25, 0.0, 0.8]);
  const vocals = makeArray([0.1, -0.1, 0.05, 0.3, 0.4]);

  test('Music Only (vocalGain=0, musicGain=1) outputs mix - vocals', () => {
    const out = mixFromSource(mix, vocals, 0, 1);
    approxEqual(out, [0.4, -0.4, 0.2, -0.3, 0.4]);
  });

  test('Vocals Only (vocalGain=1, musicGain=0) outputs vocals', () => {
    const out = mixFromSource(mix, vocals, 1, 0);
    approxEqual(out, [0.1, -0.1, 0.05, 0.3, 0.4]);
  });

  test('Both Full (vocalGain=1, musicGain=1) outputs the original mix', () => {
    const out = mixFromSource(mix, vocals, 1, 1);
    approxEqual(out, [0.5, -0.5, 0.25, 0.0, 0.8]);
  });

  test('Low Vocal (vocalGain=0.4, musicGain=1) outputs mix - 0.6 * vocals', () => {
    const out = mixFromSource(mix, vocals, 0.4, 1);
    approxEqual(
      out,
      [
        0.5 - 0.6 * 0.1,
        -0.5 - 0.6 * -0.1,
        0.25 - 0.6 * 0.05,
        0.0 - 0.6 * 0.3,
        0.8 - 0.6 * 0.4,
      ],
      1e-5,
    );
  });

  test('clamps samples to [-1, 1] to avoid 16-bit overflow on export', () => {
    const loudMix = makeArray([1.2, -1.5, 0.9, -0.95, 0.5]);
    const loudVocals = makeArray([0.5, -0.5, 0.3, -0.3, 0.0]);
    const out = mixFromSource(loudMix, loudVocals, 1, 1);
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(-1);
    expect(out[2]).toBeCloseTo(0.9);
    expect(out[3]).toBeCloseTo(-0.95);
    expect(out[4]).toBeCloseTo(0.5);
  });

  test('returns an empty Float32Array when one input is empty', () => {
    const empty = makeArray([]);
    const out = mixFromSource(empty, vocals, 0, 1);
    expect(out.length).toBe(0);
  });
});
