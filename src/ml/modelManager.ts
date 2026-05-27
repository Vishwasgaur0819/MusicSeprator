import RNFS from 'react-native-fs';
import {
  MODEL_DOWNLOAD_URL,
  MODEL_FILENAME,
  MODEL_FP16_FILENAME,
} from '../constants/audio';

const MODELS_DIR = `${RNFS.CachesDirectoryPath}/models`;

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

export async function isModelAvailable(): Promise<boolean> {
  return (
    (await RNFS.exists(getModelPath())) ||
    (await RNFS.exists(getModelFp16Path()))
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
    `Download ${MODEL_FILENAME} (or the smaller ${MODEL_FP16_FILENAME}) from ${MODEL_DOWNLOAD_URL} ` +
    `and place it at:\n${getModelPath()}`
  );
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
