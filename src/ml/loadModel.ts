import {InferenceSession, Tensor} from 'onnxruntime-react-native';
import {Platform} from 'react-native';
import {getActiveModelPath, isModelAvailable} from './modelManager';

let cachedSession: InferenceSession | null = null;

const CPU_THREADS = Platform.OS === 'android' ? 4 : 2;

export async function loadModel(): Promise<InferenceSession> {
  if (cachedSession) {
    return cachedSession;
  }

  const available = await isModelAvailable();
  if (!available) {
    throw new Error('MODEL_MISSING');
  }

  const modelPath = await getActiveModelPath();
  // NNAPI can hang on large models; prefer CPU on Android for reliability.
  const executionProviders = Platform.OS === 'ios' ? ['cpu'] : ['cpu'];

  cachedSession = await InferenceSession.create(modelPath, {
    executionProviders,
    enableCpuMemArena: false,
    enableMemPattern: false,
    graphOptimizationLevel: 'basic',
    intraOpNumThreads: CPU_THREADS,
    interOpNumThreads: 1,
    executionMode: 'sequential',
  });

  return cachedSession;
}

export async function unloadModel(): Promise<void> {
  if (cachedSession) {
    await cachedSession.release();
    cachedSession = null;
  }
}

export {Tensor};
