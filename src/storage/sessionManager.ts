import RNFS from 'react-native-fs';
import type {SessionPaths} from '../types/session';
import {KEEP_SESSION_FILES_FOR_TESTING} from '../config/dev';

function generateSessionId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}`;
}

const SESSIONS_ROOT = `${RNFS.CachesDirectoryPath}/sessions`;

async function ensureDir(path: string): Promise<void> {
  const exists = await RNFS.exists(path);
  if (!exists) {
    await RNFS.mkdir(path);
  }
}

export function getSessionDir(sessionId: string): string {
  return `${SESSIONS_ROOT}/${sessionId}`;
}

export function getSessionPaths(
  sessionId: string,
  fileName: string,
): SessionPaths {
  const dir = getSessionDir(sessionId);
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'mp3';
  return {
    sessionId,
    dir,
    original: `${dir}/original.${ext}`,
    originalPcm: `${dir}/mix.pcm`,
    vocalsAccum: `${dir}/vocals.acc`,
    vocalsWeight: `${dir}/vocals.wgt`,
    vocals: `${dir}/vocals.wav`,
    instrumental: `${dir}/instrumental.wav`,
    fileName,
  };
}

export async function createSession(
  sourceUri: string,
  fileName: string,
): Promise<SessionPaths> {
  await ensureDir(SESSIONS_ROOT);
  const sessionId = generateSessionId();
  const paths = getSessionPaths(sessionId, fileName);
  await ensureDir(paths.dir);

  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'mp3';
  const destPath = `${paths.dir}/original.${ext}`;

  const normalizedUri = sourceUri.replace('file://', '');
  await RNFS.copyFile(normalizedUri, destPath);
  paths.original = destPath;

  await RNFS.writeFile(
    `${paths.dir}/meta.json`,
    JSON.stringify({fileName}),
    'utf8',
  );

  return paths;
}

export async function findLatestReadySession(): Promise<{
  sessionId: string;
  fileName: string;
  pipelineVersion?: number;
} | null> {
  const exists = await RNFS.exists(SESSIONS_ROOT);
  if (!exists) {
    return null;
  }

  const entries = await RNFS.readDir(SESSIONS_ROOT);
  let latest: {
    sessionId: string;
    fileName: string;
    pipelineVersion?: number;
    mtime: Date;
  } | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const vocalsPath = `${entry.path}/vocals.wav`;
    const instPath = `${entry.path}/instrumental.wav`;
    if (!(await RNFS.exists(vocalsPath)) || !(await RNFS.exists(instPath))) {
      continue;
    }

    let fileName = 'Song';
    let pipelineVersion: number | undefined;
    const metaPath = `${entry.path}/meta.json`;
    if (await RNFS.exists(metaPath)) {
      try {
        const meta = JSON.parse(await RNFS.readFile(metaPath, 'utf8')) as {
          fileName?: string;
        };
        if (meta.fileName) {
          fileName = meta.fileName;
        }
      } catch {
        // ignore bad meta
      }
    }

    const diagPath = `${entry.path}/separation-diagnostics.json`;
    if (await RNFS.exists(diagPath)) {
      try {
        const diag = JSON.parse(await RNFS.readFile(diagPath, 'utf8')) as {
          pipelineVersion?: number;
        };
        pipelineVersion = diag.pipelineVersion;
      } catch {
        // ignore
      }
    }

    const mtime = entry.mtime ?? new Date(0);
    if (!latest || mtime > latest.mtime) {
      latest = {sessionId: entry.name, fileName, pipelineVersion, mtime};
    }
  }

  return latest
    ? {
        sessionId: latest.sessionId,
        fileName: latest.fileName,
        pipelineVersion: latest.pipelineVersion,
      }
    : null;
}

export async function destroySession(sessionId: string): Promise<void> {
  if (KEEP_SESSION_FILES_FOR_TESTING) {
    return;
  }

  const dir = getSessionDir(sessionId);
  const exists = await RNFS.exists(dir);
  if (exists) {
    await RNFS.unlink(dir);
  }
}

export async function destroyAllSessions(): Promise<void> {
  if (KEEP_SESSION_FILES_FOR_TESTING) {
    return;
  }

  const exists = await RNFS.exists(SESSIONS_ROOT);
  if (exists) {
    await RNFS.unlink(SESSIONS_ROOT);
  }
}
