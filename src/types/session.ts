export interface SessionPaths {
  sessionId: string;
  dir: string;
  original: string;
  originalPcm: string;
  vocalsAccum: string;
  vocalsWeight: string;
  vocals: string;
  instrumental: string;
  fileName: string;
}

export interface SeparationProgress {
  phase: 'decoding' | 'separating' | 'saving';
  current: number;
  total: number;
  message: string;
}
