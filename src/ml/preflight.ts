import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
import {runtimeConfig} from '../config/runtime';
import {ensureProductionModelReady, getModelStatus} from './modelManager';

export interface PreflightResult {
  ok: boolean;
  reason?: string;
  details: {
    freeDiskBytes: number;
    sourceFileBytes?: number;
    maxInputFileBytes?: number;
    modelFileName?: string;
    modelReady: boolean;
    platform: string;
  };
}

export async function runSeparationPreflight(
  sourcePath: string,
  onModelProgress?: (received: number, total: number) => void,
): Promise<PreflightResult> {
  const fsInfo = await RNFS.getFSInfo();
  const freeDiskBytes = fsInfo.freeSpace;
  const normalizedSourcePath = sourcePath.replace('file://', '');
  const sourceStat = await RNFS.stat(normalizedSourcePath);
  const sourceFileBytes = sourceStat.size;
  if (sourceFileBytes > runtimeConfig.maxInputFileBytes) {
    return {
      ok: false,
      reason:
        'Selected file is too large for stable offline processing on this device. Please use an audio file up to 20 MB.',
      details: {
        freeDiskBytes,
        sourceFileBytes,
        maxInputFileBytes: runtimeConfig.maxInputFileBytes,
        modelReady: false,
        platform: Platform.OS,
      },
    };
  }
  if (freeDiskBytes < runtimeConfig.minFreeDiskBytes) {
    return {
      ok: false,
      reason:
        'Not enough free storage for separation. Please free space and try again.',
      details: {
        freeDiskBytes,
        sourceFileBytes,
        maxInputFileBytes: runtimeConfig.maxInputFileBytes,
        modelReady: false,
        platform: Platform.OS,
      },
    };
  }

  await ensureProductionModelReady(onModelProgress);
  const status = await getModelStatus();
  if (!status) {
    return {
      ok: false,
      reason: 'Model is not ready. Please retry in a moment.',
      details: {
        freeDiskBytes,
        sourceFileBytes,
        maxInputFileBytes: runtimeConfig.maxInputFileBytes,
        modelReady: false,
        platform: Platform.OS,
      },
    };
  }

  return {
    ok: true,
    details: {
      freeDiskBytes,
      sourceFileBytes,
      maxInputFileBytes: runtimeConfig.maxInputFileBytes,
      modelFileName: status.activeFileName,
      modelReady: true,
      platform: Platform.OS,
    },
  };
}

