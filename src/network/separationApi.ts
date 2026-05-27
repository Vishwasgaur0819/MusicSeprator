import RNFS from 'react-native-fs';
import {runtimeConfig} from '../config/runtime';

export interface StartCloudSeparationResult {
  jobId: string;
}

export interface CloudSeparationStatus {
  state: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  stems?: {
    vocalsUrl: string;
    instrumentalUrl: string;
  };
}

function requireCloudConfig(): string {
  if (!runtimeConfig.cloudApiBaseUrl) {
    throw new Error(
      'Cloud fallback is not configured. Set cloudApiBaseUrl in src/config/runtime.ts',
    );
  }
  return runtimeConfig.cloudApiBaseUrl.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  if (!runtimeConfig.cloudApiToken) {
    return {};
  }
  return {Authorization: `Bearer ${runtimeConfig.cloudApiToken}`};
}

export async function startCloudSeparation(
  sourcePath: string,
): Promise<StartCloudSeparationResult> {
  const baseUrl = requireCloudConfig();
  const upload = RNFS.uploadFiles({
    toUrl: `${baseUrl}/v1/separation/jobs`,
    files: [
      {
        name: 'file',
        filename: sourcePath.split('/').pop() ?? 'input.mp3',
        filepath: sourcePath,
        filetype: 'audio/mpeg',
      },
    ],
    method: 'POST',
    headers: authHeaders(),
  });
  const response = await upload.promise;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Cloud upload failed with HTTP ${response.statusCode}`);
  }

  const body = JSON.parse(response.body) as {jobId?: string};
  if (!body.jobId) {
    throw new Error('Cloud response missing jobId');
  }
  return {jobId: body.jobId};
}

export async function getCloudSeparationStatus(
  jobId: string,
): Promise<CloudSeparationStatus> {
  const baseUrl = requireCloudConfig();
  const response = await fetch(`${baseUrl}/v1/separation/jobs/${jobId}`, {
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`Cloud status failed with HTTP ${response.status}`);
  }
  return (await response.json()) as CloudSeparationStatus;
}

export async function downloadCloudStems(
  stems: {vocalsUrl: string; instrumentalUrl: string},
  paths: {vocals: string; instrumental: string},
): Promise<void> {
  const vocals = RNFS.downloadFile({
    fromUrl: stems.vocalsUrl,
    toFile: paths.vocals,
    headers: authHeaders(),
  });
  const instrumental = RNFS.downloadFile({
    fromUrl: stems.instrumentalUrl,
    toFile: paths.instrumental,
    headers: authHeaders(),
  });
  const [vRes, iRes] = await Promise.all([vocals.promise, instrumental.promise]);
  if (vRes.statusCode < 200 || vRes.statusCode >= 300) {
    throw new Error(`Cloud vocals download failed with HTTP ${vRes.statusCode}`);
  }
  if (iRes.statusCode < 200 || iRes.statusCode >= 300) {
    throw new Error(
      `Cloud instrumental download failed with HTTP ${iRes.statusCode}`,
    );
  }
}

export function isCloudConfigured(): boolean {
  return Boolean(runtimeConfig.cloudApiBaseUrl);
}

