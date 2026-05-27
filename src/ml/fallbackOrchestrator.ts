import RNFS from 'react-native-fs';
import type {SessionPaths, SeparationProgress} from '../types/session';
import {isCloudEnabled, runtimeConfig} from '../config/runtime';
import {separateStems} from './separateStems';
import {runSeparationPreflight} from './preflight';
import {writeTelemetryEvent} from './telemetry';
import {
  downloadCloudStems,
  getCloudSeparationStatus,
  isCloudConfigured,
  startCloudSeparation,
} from '../network/separationApi';

type ProgressCallback = (progress: SeparationProgress) => void;

export interface SeparationExecutionResult {
  mode: 'on-device' | 'cloud';
}

interface DiagnosticPayload {
  pipelineVersion?: number;
  mode: 'on-device' | 'cloud' | 'failed';
  phaseFailed?: string;
  reason?: string;
  timingsMs: {
    total: number;
    onDeviceAttempt?: number;
    cloudAttempt?: number;
  };
  details?: Record<string, unknown>;
}

async function writeDiagnostics(
  paths: SessionPaths,
  payload: DiagnosticPayload,
): Promise<void> {
  await RNFS.writeFile(
    `${paths.dir}/separation-diagnostics.json`,
    JSON.stringify(payload, null, 2),
    'utf8',
  );
}

function isCloudFallbackAllowed(): boolean {
  return (
    (runtimeConfig.separationMode === 'hybrid' ||
      runtimeConfig.separationMode === 'cloud') &&
    isCloudEnabled() &&
    isCloudConfigured()
  );
}

async function runCloudFallback(
  paths: SessionPaths,
  onProgress: ProgressCallback,
): Promise<void> {
  onProgress({
    phase: 'uploading',
    current: 0,
    total: 1,
    message: 'Uploading audio for cloud processing…',
  });
  const {jobId} = await startCloudSeparation(paths.original);
  const startedAt = Date.now();
  while (true) {
    const status = await getCloudSeparationStatus(jobId);
    if (status.state === 'completed' && status.stems) {
      onProgress({
        phase: 'downloading-stems',
        current: 0,
        total: 1,
        message: 'Downloading separated stems…',
      });
      await downloadCloudStems(status.stems, {
        vocals: paths.vocals,
        instrumental: paths.instrumental,
      });
      return;
    }
    if (status.state === 'failed') {
      throw new Error(status.error ?? 'Cloud separation failed');
    }
    onProgress({
      phase: 'processing-cloud',
      current: Math.round((status.progress ?? 0) * 100),
      total: 100,
      message: 'Cloud processing in progress…',
    });
    if (Date.now() - startedAt > runtimeConfig.cloudTimeoutMs) {
      throw new Error('Cloud separation timed out');
    }
    await new Promise<void>(resolve =>
      setTimeout(() => resolve(), runtimeConfig.cloudPollIntervalMs),
    );
  }
}

export async function separateStemsWithFallback(
  paths: SessionPaths,
  onProgress: ProgressCallback,
  signal?: {cancelled: boolean},
): Promise<SeparationExecutionResult> {
  const startedAt = Date.now();
  onProgress({
    phase: 'preflight',
    current: 0,
    total: 1,
    message: 'Running device preflight checks…',
  });

  const preflight = await runSeparationPreflight(paths.original, (received, total) => {
    onProgress({
      phase: 'downloading-model',
      current: received,
      total: total > 0 ? total : 1,
      message: 'Preparing AI engine…',
    });
  });

  if (!preflight.ok) {
    await writeTelemetryEvent({
      type: 'preflight_failed',
      sessionId: paths.sessionId,
      fileName: paths.fileName,
      timestamp: new Date().toISOString(),
      details: preflight.details,
    });
    if (!isCloudFallbackAllowed()) {
      await writeDiagnostics(paths, {
        mode: 'failed',
        phaseFailed: 'preflight',
        reason: preflight.reason,
        timingsMs: {total: Date.now() - startedAt},
        details: preflight.details,
      });
      throw new Error(preflight.reason ?? 'Preflight failed');
    }
  } else {
    await writeTelemetryEvent({
      type: 'preflight_passed',
      sessionId: paths.sessionId,
      fileName: paths.fileName,
      timestamp: new Date().toISOString(),
      details: preflight.details,
    });
  }

  if (signal?.cancelled) {
    throw new Error('Cancelled');
  }

  const onDeviceStart = Date.now();
  if (preflight.ok && runtimeConfig.separationMode !== 'cloud') {
    try {
      await writeTelemetryEvent({
        type: 'ondevice_started',
        sessionId: paths.sessionId,
        fileName: paths.fileName,
        timestamp: new Date().toISOString(),
      });
      await separateStems(paths, onProgress, signal);
      await writeTelemetryEvent({
        type: 'ondevice_succeeded',
        sessionId: paths.sessionId,
        fileName: paths.fileName,
        timestamp: new Date().toISOString(),
      });
      return {mode: 'on-device'};
    } catch (error) {
      await writeTelemetryEvent({
        type: 'ondevice_failed',
        sessionId: paths.sessionId,
        fileName: paths.fileName,
        timestamp: new Date().toISOString(),
        details: {
          message: error instanceof Error ? error.message : 'unknown',
        },
      });
      if (!isCloudFallbackAllowed()) {
        await writeDiagnostics(paths, {
          mode: 'failed',
          phaseFailed: 'on-device',
          reason: error instanceof Error ? error.message : 'Unknown error',
          timingsMs: {
            total: Date.now() - startedAt,
            onDeviceAttempt: Date.now() - onDeviceStart,
          },
        });
        throw error;
      }
    }
  }

  const cloudStart = Date.now();
  await writeTelemetryEvent({
    type: 'cloud_started',
    sessionId: paths.sessionId,
    fileName: paths.fileName,
    timestamp: new Date().toISOString(),
  });
  try {
    await runCloudFallback(paths, onProgress);
    await writeDiagnostics(paths, {
      mode: 'cloud',
      timingsMs: {
        total: Date.now() - startedAt,
        onDeviceAttempt: preflight.ok ? Date.now() - onDeviceStart : undefined,
        cloudAttempt: Date.now() - cloudStart,
      },
      details: preflight.details,
    });
    await writeTelemetryEvent({
      type: 'cloud_succeeded',
      sessionId: paths.sessionId,
      fileName: paths.fileName,
      timestamp: new Date().toISOString(),
    });
    return {mode: 'cloud'};
  } catch (error) {
    await writeTelemetryEvent({
      type: 'cloud_failed',
      sessionId: paths.sessionId,
      fileName: paths.fileName,
      timestamp: new Date().toISOString(),
      details: {
        message: error instanceof Error ? error.message : 'unknown',
      },
    });
    await writeDiagnostics(paths, {
      mode: 'failed',
      phaseFailed: 'cloud',
      reason: error instanceof Error ? error.message : 'Unknown cloud error',
      timingsMs: {
        total: Date.now() - startedAt,
        onDeviceAttempt: preflight.ok ? Date.now() - onDeviceStart : undefined,
        cloudAttempt: Date.now() - cloudStart,
      },
      details: preflight.details,
    });
    throw error;
  }
}

