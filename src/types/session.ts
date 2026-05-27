export interface CropMeta {
  startSec: number;
  endSec: number;
  applied: boolean;
}

export interface SessionMeta {
  fileName: string;
  crop?: CropMeta;
}

export interface SessionPaths {
  sessionId: string;
  dir: string;
  original: string;
  originalPcm: string;
  vocalsAccum: string;
  vocalsWeight: string;
  vocals: string;
  /** Original mix decoded to 44.1 kHz stereo PCM WAV. Used for live playback math. */
  mix: string;
  /** Legacy path kept for cloud download compatibility (not written by local pipeline). */
  instrumental: string;
  /** Legacy path kept for older sessions; not used by current playback. */
  instrumentalClean: string;
  fileName: string;
}

export interface SeparationProgress {
  phase:
    | 'preflight'
    | 'downloading-model'
    | 'decoding'
    | 'separating'
    | 'saving'
    | 'uploading'
    | 'processing-cloud'
    | 'downloading-stems';
  current: number;
  total: number;
  message: string;
}
