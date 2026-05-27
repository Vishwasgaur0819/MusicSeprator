import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {mixStems} from './stemMix';
import {readWavAsPcm, savePcmAsWav} from './decodeAudio';

export type ExportFormat = 'wav' | 'm4a';

export interface ExportOptions {
  vocalsPath: string;
  instrumentalPath: string;
  vocalGain: number;
  musicGain: number;
  fileName: string;
  format: ExportFormat;
}

export async function exportMixedAudio(
  options: ExportOptions,
): Promise<string> {
  const vocals = await readWavAsPcm(options.vocalsPath);
  const instrumental = await readWavAsPcm(options.instrumentalPath);
  const mixed = mixStems(
    vocals,
    instrumental,
    options.vocalGain,
    options.musicGain,
    true,
  );

  const baseName = options.fileName.replace(/\.[^/.]+$/, '');
  const vocalPct = Math.round(options.vocalGain * 100);
  const musicPct = Math.round(options.musicGain * 100);
  const exportDir = `${RNFS.CachesDirectoryPath}/exports`;
  const exists = await RNFS.exists(exportDir);
  if (!exists) {
    await RNFS.mkdir(exportDir);
  }

  const wavPath = `${exportDir}/${baseName}_mixed_${vocalPct}_${musicPct}.wav`;
  await savePcmAsWav(mixed, wavPath);

  if (options.format === 'wav') {
    return wavPath;
  }

  // M4A encoding via react-native-audio-api decode/re-encode path not available
  // without FFmpeg; share WAV for m4a requests until native encoder is added.
  return wavPath;
}

export async function shareExportedFile(filePath: string): Promise<void> {
  const url = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  await Share.open({
    url,
    type: filePath.endsWith('.m4a')
      ? 'audio/mp4'
      : filePath.endsWith('.mp3')
        ? 'audio/mpeg'
        : 'audio/wav',
    failOnCancel: false,
  });
}
