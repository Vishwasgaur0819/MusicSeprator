import RNFS from 'react-native-fs';
import type {CropMeta, SessionMeta, SessionPaths} from '../types/session';
import {saveCroppedPcm} from '../audio/cropAudio';
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
    mix: `${dir}/mix.wav`,
    instrumental: `${dir}/instrumental.wav`,
    instrumentalClean: `${dir}/instrumental_clean.wav`,
    fileName,
  };
}

export async function resolveSessionPaths(
  sessionId: string,
  fileName: string,
): Promise<SessionPaths> {
  const paths = getSessionPaths(sessionId, fileName);
  const croppedPath = `${paths.dir}/original.cropped.wav`;
  if (await RNFS.exists(croppedPath)) {
    return {...paths, original: croppedPath};
  }
  return paths;
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

  const normalizedSource = sourceUri.startsWith('file://')
    ? decodeURI(sourceUri.replace('file://', ''))
    : sourceUri;

  try {
    await RNFS.copyFile(normalizedSource, destPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown file copy error';
    throw new Error(
      `Failed to import selected audio into app storage. ${message}`,
    );
  }
  paths.original = destPath;

  await RNFS.writeFile(
    `${paths.dir}/meta.json`,
    JSON.stringify({fileName}),
    'utf8',
  );

  return paths;
}

function getMetaPath(sessionId: string): string {
  return `${getSessionDir(sessionId)}/meta.json`;
}

export async function readSessionMeta(
  sessionId: string,
): Promise<SessionMeta | null> {
  const metaPath = getMetaPath(sessionId);
  if (!(await RNFS.exists(metaPath))) {
    return null;
  }

  try {
    return JSON.parse(await RNFS.readFile(metaPath, 'utf8')) as SessionMeta;
  } catch {
    return null;
  }
}

export async function updateSessionMeta(
  sessionId: string,
  patch: Partial<SessionMeta>,
): Promise<SessionMeta> {
  const current =
    (await readSessionMeta(sessionId)) ??
    ({fileName: 'Song'} satisfies SessionMeta);
  const next: SessionMeta = {...current, ...patch};
  await RNFS.writeFile(getMetaPath(sessionId), JSON.stringify(next), 'utf8');
  return next;
}

export async function applyCropToSession(
  sessionId: string,
  fileName: string,
  startSec: number,
  endSec: number,
  pcm: Float32Array,
): Promise<SessionPaths> {
  const paths = getSessionPaths(sessionId, fileName);
  const croppedPath = `${paths.dir}/original.cropped.wav`;
  const previousOriginal = paths.original;

  await saveCroppedPcm(pcm, startSec, endSec, croppedPath);

  if (
    previousOriginal !== croppedPath &&
    (await RNFS.exists(previousOriginal))
  ) {
    await RNFS.unlink(previousOriginal);
  }

  paths.original = croppedPath;

  const crop: CropMeta = {startSec, endSec, applied: true};
  await updateSessionMeta(sessionId, {fileName, crop});

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
    const mixPath = `${entry.path}/mix.wav`;
    if (!(await RNFS.exists(vocalsPath)) || !(await RNFS.exists(mixPath))) {
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
