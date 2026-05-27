export const SAMPLE_RATE = 44100;
export const CHANNELS = 2;

/** HT-Demucs ONNX segment length in samples per channel (approx 7.8s at 44.1kHz). */
export const SEGMENT_SAMPLES = 343980;

/** Overlap between chunks for smooth stitching. */
export const OVERLAP_SAMPLES = Math.floor(SEGMENT_SAMPLES / 4);

export const MODEL_FILENAME = 'htdemucs_ft_vocals.onnx';

/** Smaller fp16 weights (~166 MB) — used automatically when present. */
export const MODEL_FP16_FILENAME = 'htdemucs_ft_vocals_fp16weights.onnx';

/** Over-subtract extracted vocals when building the music stem (reduces singer bleed). */
export const VOCAL_REMOVAL_STRENGTH = 1.35;

/** Max extra vocal stem subtracted at playback/export when voice slider is 0%. */
export const BLEED_CANCEL_MAX = 0.55;

/** Voice slider above this keeps bleed cancellation off. */
export const BLEED_CANCEL_VOCAL_THRESHOLD = 0.2;

/** Attenuate centered vocal energy (most singers are center-panned). */
export const MUSIC_ONLY_CENTER_CANCEL = 0.3;

/** Hugging Face model page — user downloads manually for MVP. */
export const MODEL_DOWNLOAD_URL =
  'https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx';
