export const SAMPLE_RATE = 44100;
export const CHANNELS = 2;

/** HT-Demucs ONNX segment length in samples per channel (approx 7.8s at 44.1kHz). */
export const SEGMENT_SAMPLES = 343980;

/** Overlap between chunks for smooth stitching. */
export const OVERLAP_SAMPLES = Math.floor(SEGMENT_SAMPLES / 4);

export const MODEL_FILENAME = 'htdemucs_ft_vocals.onnx';

/** Smaller fp16 weights (~166 MB) — used automatically when present. */
export const MODEL_FP16_FILENAME = 'htdemucs_ft_vocals_fp16weights.onnx';

/** Hugging Face model page — user downloads manually for MVP. */
export const MODEL_DOWNLOAD_URL =
  'https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx';

/** Direct fp16 model artifact used for automatic in-app download. */
export const MODEL_FP16_DOWNLOAD_URL =
  'https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/main/htdemucs_ft_vocals_fp16weights.onnx';
