jest.mock('react-native-audio-api', () => ({
  decodeAudioData: jest.fn(),
  AudioContext: jest.fn(),
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(),
}));

import {
  clampTrimRange,
  isFullSongSelection,
  MIN_CROP_SEC,
  validateCropRange,
} from '../../audio/cropAudio';

describe('cropAudio trim rules', () => {
  it('enforces a minimum 20 second selection gap', () => {
    const range = clampTrimRange(0, 10, 120, 'end');
    expect(range.endSec - range.startSec).toBeGreaterThanOrEqual(MIN_CROP_SEC);
  });

  it('keeps OUT at least 20 seconds after IN when moving start', () => {
    const range = clampTrimRange(40, 120, 120, 'start');
    expect(range.startSec).toBeLessThanOrEqual(100);
    expect(range.endSec - range.startSec).toBeGreaterThanOrEqual(MIN_CROP_SEC);
  });

  it('allows full song validation for short tracks', () => {
    expect(() => validateCropRange(0, 15, 15)).not.toThrow();
    expect(isFullSongSelection(0, 15, 15)).toBe(true);
  });

  it('rejects partial selections shorter than 20 seconds', () => {
    expect(() => validateCropRange(0, 15, 120)).toThrow(
      `Selection must be at least ${MIN_CROP_SEC} seconds.`,
    );
  });

  it('clamps IN and OUT to track bounds', () => {
    const range = clampTrimRange(-5, 500, 180, 'end');
    expect(range.startSec).toBeGreaterThanOrEqual(0);
    expect(range.endSec).toBeLessThanOrEqual(180);
  });
});
