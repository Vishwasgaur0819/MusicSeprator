import RNFS from 'react-native-fs';
import {runtimeConfig} from '../config/runtime';

const TELEMETRY_DIR = `${RNFS.CachesDirectoryPath}/telemetry`;
const TELEMETRY_FILE = `${TELEMETRY_DIR}/separation-events.jsonl`;

export interface SeparationTelemetryEvent {
  type:
    | 'preflight_passed'
    | 'preflight_failed'
    | 'ondevice_started'
    | 'ondevice_failed'
    | 'ondevice_succeeded'
    | 'cloud_started'
    | 'cloud_failed'
    | 'cloud_succeeded';
  sessionId: string;
  fileName: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

async function ensureTelemetryDir(): Promise<void> {
  const exists = await RNFS.exists(TELEMETRY_DIR);
  if (!exists) {
    await RNFS.mkdir(TELEMETRY_DIR);
  }
}

export async function writeTelemetryEvent(
  event: SeparationTelemetryEvent,
): Promise<void> {
  if (!runtimeConfig.enableTelemetry) {
    return;
  }
  await ensureTelemetryDir();
  await RNFS.appendFile(
    TELEMETRY_FILE,
    `${JSON.stringify(event)}\n`,
    'utf8',
  );
}

