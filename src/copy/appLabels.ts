export const appLabels = {
  splash: {
    tagline: 'StemSplit — Separate vocals. Mix your way.',
  },
  home: {
    brand: 'StemSplit',
    title: 'Vocal & Music Mixer',
    subtitle:
      'Separate vocals from instrumentals, adjust levels, and export your mix.',
    uploadTitle: 'Upload',
    uploadSubtitle: 'Choose a song to separate',
    uploadFormats: 'Supports MP3, M4A, WAV, FLAC and other common formats.',
    chooseAudioFile: 'Choose Audio File',
    modelAutoSetup:
      'We automatically prepare the AI engine on first run. This keeps setup simple like other consumer audio apps.',
    footerCredit: 'Made by Vishwas',
    useCases: {
      instrumental: {
        title: 'Instrumental',
        detail: 'Remove vocals from the original track',
      },
      vocalsOnly: {
        title: 'Vocals only',
        detail: 'Export the isolated vocal stem',
      },
      customMix: {
        title: 'Custom mix',
        detail: 'Blend vocal and music levels manually',
      },
    },
  },
  trim: {
    loadingTitle: 'Loading audio',
    loadingText: 'Decoding audio and building timeline…',
    fullTrack: 'Full track',
    previewHintIdle: 'Preview plays from In to Out',
    previewHintPlaying: 'Previewing selection',
    discardTitle: 'Discard this session?',
    discardMessage: 'Your uploaded file will be deleted.',
    keepTrimming: 'Keep trimming',
    discard: 'Discard',
  },
  navigation: {
    mixer: 'Mixer',
    processing: 'Processing',
  },
  mixer: {
    stemsReady: 'Stems ready — adjust levels and preview',
    playing: 'Playing',
    presetsTitle: 'Mix presets',
    presetsSubtitle: 'Select a preset to update the mix',
    levelsTitle: 'Level controls',
    levelsSubtitle: 'Adjust vocal and music levels',
    levelsLockedSubtitle: 'Available in Custom mode',
    vocalLabel: 'Vocals',
    vocalDescription: 'Isolated vocal stem',
    musicLabel: 'Music',
    musicDescription: 'Backing track and instruments',
    startOver: 'Start Over',
    hints: {
      instrumental:
        'Instrumental mode — vocals are removed from the original mix.',
      vocalsOnly: 'Vocals only — backing track is muted in export.',
      fullMix: 'Full mix — same balance as the source track.',
      custom: 'Custom mix — export matches your current levels.',
    },
    exportNothingTitle: 'Nothing to export',
    exportNothingMessage:
      'Move at least one slider above 0% — vocals, music, or both.',
    exportReadyTitle: 'Export ready',
    exportReadyMessage: 'Your mixed file is ready to save or share.',
    leaveTitle: 'Leave mixer?',
    leaveMessage: 'Session files will be deleted from app cache.',
    stay: 'Stay',
    leave: 'Leave',
    playbackErrorTitle: 'Playback error',
  },
  presets: {
    musicOnlyDescription: 'Instrumental',
    vocalsOnlyDescription: 'Vocal stem',
    customDescription: 'Manual blend',
  },
  export: {
    title: 'Export mix',
    subtitle: 'Current levels are applied to the exported file',
    button: 'Export Mix',
    exporting: 'Exporting…',
    asWav: 'Export as WAV',
    asM4a: 'Export as M4A',
    asM4aHint: 'Uses WAV if unavailable',
    failedTitle: 'Export failed',
  },
  alerts: {
    cancel: 'Cancel',
  },
} as const;

export function describeMixHint(vocalGain: number, musicGain: number): string {
  if (vocalGain <= 0.005 && musicGain > 0) {
    return appLabels.mixer.hints.instrumental;
  }
  if (musicGain <= 0.005 && vocalGain > 0) {
    return appLabels.mixer.hints.vocalsOnly;
  }
  if (vocalGain >= 0.95 && musicGain >= 0.95) {
    return appLabels.mixer.hints.fullMix;
  }
  return appLabels.mixer.hints.custom;
}
