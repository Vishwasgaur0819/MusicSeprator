import RNFS from 'react-native-fs';
import {
  MODEL_DOWNLOAD_URL,
  MODEL_FILENAME,
  MODEL_FP16_FILENAME,
  MODEL_FP16_DOWNLOAD_URL,
} from '../constants/audio';

const MODELS_DIR = `${RNFS.CachesDirectoryPath}/models`;
const FP16_TMP_PATH = `${MODELS_DIR}/${MODEL_FP16_FILENAME}.tmp`;
const MIN_MODEL_SIZE_BYTES = 120 * 1024 * 1024;
const DOWNLOAD_RETRIES = 2;
let ongoingModelDownload: Promise<string> | null = null;

export function getModelPath(): string {
  return `${MODELS_DIR}/${MODEL_FILENAME}`;
}

export function getModelFp16Path(): string {
  return `${MODELS_DIR}/${MODEL_FP16_FILENAME}`;
}

export async function getActiveModelPath(): Promise<string> {
  const fp16 = getModelFp16Path();
  if (await RNFS.exists(fp16)) {
    return fp16;
  }
  return getModelPath();
}

async function isUsableModel(path: string): Promise<boolean> {
  if (!(await RNFS.exists(path))) {
    return false;
  }
  const stat = await RNFS.stat(path);
  return stat.size >= MIN_MODEL_SIZE_BYTES;
}

export async function isModelAvailable(): Promise<boolean> {
  return (
    (await isUsableModel(getModelPath())) ||
    (await isUsableModel(getModelFp16Path()))
  );
}

export async function ensureModelsDir(): Promise<void> {
  const exists = await RNFS.exists(MODELS_DIR);
  if (!exists) {
    await RNFS.mkdir(MODELS_DIR);
  }
}

export function getModelSetupInstructions(): string {
  return (
    `Model setup failed. You can retry from app home, or manually download ${MODEL_FP16_FILENAME} ` +
    `from ${MODEL_DOWNLOAD_URL} and place it at:\n${getModelFp16Path()}`
  );
}

export type ModelReadinessState =
  | 'ready'
  | 'missing'
  | 'downloading'
  | 'failed';

export interface ModelReadiness {
  state: ModelReadinessState;
  message: string;
  progress?: {receivedBytes: number; totalBytes: number};
}

export async function getModelReadiness(): Promise<ModelReadiness> {
  const fp16Ready = await isUsableModel(getModelFp16Path());
  if (fp16Ready) {
    return {state: 'ready', message: 'AI engine ready'};
  }
  if (ongoingModelDownload) {
    return {state: 'downloading', message: 'Preparing AI engine…'};
  }
  return {state: 'missing', message: 'AI engine not downloaded yet'};
}

async function cleanupPartialModel(): Promise<void> {
  if (await RNFS.exists(FP16_TMP_PATH)) {
    await RNFS.unlink(FP16_TMP_PATH);
  }
}

async function downloadFp16Model(
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  await ensureModelsDir();
  await cleanupPartialModel();

  const result = RNFS.downloadFile({
    fromUrl: MODEL_FP16_DOWNLOAD_URL,
    toFile: FP16_TMP_PATH,
    progressInterval: 500,
    begin: res => {
      onProgress?.(0, res.contentLength > 0 ? res.contentLength : 0);
    },
    progress: res => {
      onProgress?.(res.bytesWritten, res.contentLength);
    },
  });

  const response = await result.promise;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Model download failed with HTTP ${response.statusCode}`);
  }

  const stat = await RNFS.stat(FP16_TMP_PATH);
  if (stat.size < MIN_MODEL_SIZE_BYTES) {
    throw new Error(
      `Downloaded model is incomplete (${Math.round(stat.size / 1024 / 1024)} MB).`,
    );
  }

  if (await RNFS.exists(getModelFp16Path())) {
    await RNFS.unlink(getModelFp16Path());
  }
  await RNFS.moveFile(FP16_TMP_PATH, getModelFp16Path());
  return getModelFp16Path();
}

export async function ensureProductionModelReady(
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  if (await isUsableModel(getModelFp16Path())) {
    return getModelFp16Path();
  }

  if (ongoingModelDownload) {
    return ongoingModelDownload;
  }

  ongoingModelDownload = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt++) {
      try {
        return await downloadFp16Model(onProgress);
      } catch (error) {
        lastError = error;
        await cleanupPartialModel();
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Model download failed');
  })();

  try {
    return await ongoingModelDownload;
  } finally {
    ongoingModelDownload = null;
  }
}

export interface InstalledModelInfo {
  fileName: string;
  label: string;
  sizeBytes: number;
  isActive: boolean;
}

export interface ModelStatus {
  activeFileName: string;
  activeLabel: string;
  installed: InstalledModelInfo[];
}

function formatModelSize(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** Which models are on disk and which one separation will use. */
export async function getModelStatus(): Promise<ModelStatus | null> {
  const fp16Path = getModelFp16Path();
  const fullPath = getModelPath();
  const activePath = await getActiveModelPath();
  const installed: InstalledModelInfo[] = [];

  if (await RNFS.exists(fp16Path)) {
    const stat = await RNFS.stat(fp16Path);
    installed.push({
      fileName: MODEL_FP16_FILENAME,
      label: 'FP16 — faster, lower memory',
      sizeBytes: stat.size,
      isActive: activePath === fp16Path,
    });
  }

  if (await RNFS.exists(fullPath)) {
    const stat = await RNFS.stat(fullPath);
    installed.push({
      fileName: MODEL_FILENAME,
      label: 'Full precision',
      sizeBytes: stat.size,
      isActive: activePath === fullPath,
    });
  }

  if (installed.length === 0) {
    return null;
  }

  const active = installed.find(m => m.isActive) ?? installed[0];
  return {
    activeFileName: active.fileName,
    activeLabel: active.label,
    installed,
  };
}

export {formatModelSize};

/**
 * Copy a user-selected ONNX model file into the app cache.
 */
export async function installModelFromFile(sourceUri: string): Promise<string> {
  await ensureModelsDir();
  const normalized = sourceUri.replace('file://', '');
  const lower = normalized.toLowerCase();
  const dest =
    lower.includes('fp16') || lower.includes('fp16weights')
      ? getModelFp16Path()
      : getModelPath();
  await RNFS.copyFile(normalized, dest);
  return dest;
}
