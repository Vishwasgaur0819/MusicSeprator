export type SeparationMode = 'on-device' | 'hybrid' | 'cloud';

export interface RuntimeConfig {
  separationMode: SeparationMode;
  preferOnDevice: boolean;
  minFreeDiskBytes: number;
  maxInputFileBytes: number;
  enableTelemetry: boolean;
  cloudApiBaseUrl: string | null;
  cloudApiToken: string | null;
  cloudPollIntervalMs: number;
  cloudTimeoutMs: number;
}

export const runtimeConfig: RuntimeConfig = {
  separationMode: 'on-device',
  preferOnDevice: true,
  minFreeDiskBytes: 1024 * 1024 * 1024,
  maxInputFileBytes: 20 * 1024 * 1024,
  enableTelemetry: true,
  cloudApiBaseUrl: null,
  cloudApiToken: null,
  cloudPollIntervalMs: 2500,
  cloudTimeoutMs: 6 * 60 * 1000,
};

export function isCloudEnabled(): boolean {
  return runtimeConfig.separationMode === 'cloud' || runtimeConfig.separationMode === 'hybrid';
}

