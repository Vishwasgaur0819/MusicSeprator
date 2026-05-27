import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {StemSlider} from '../components/StemSlider';
import {MixPresets} from '../components/MixPresets';
import {ExportButton} from '../components/ExportButton';
import {AppButton} from '../components/ui/AppButton';
import {Card, SectionHeader} from '../components/ui/Card';
import {Screen} from '../components/ui/Screen';
import {stemPlayer} from '../audio/StemPlayer';
import {
  exportMixedAudio,
  shareExportedFile,
  type ExportFormat,
} from '../audio/exportMix';
import {
  destroySession,
  getSessionPaths,
} from '../storage/sessionManager';
import {KEEP_SESSION_FILES_FOR_TESTING} from '../config/dev';
import {colors} from '../theme/colors';
import {radii, shadows, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Mixer'>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function describeMix(vocalGain: number, musicGain: number): string {
  if (vocalGain === 0 && musicGain > 0) {
    return 'Music & tuning only — extra vocal suppression is active for a cleaner instrumental.';
  }
  if (musicGain === 0 && vocalGain > 0) {
    return 'Singer voice only — no music in export.';
  }
  if (vocalGain > 0 && vocalGain <= 0.15 && musicGain > 0) {
    return 'Mostly music with very low vocals — karaoke style.';
  }
  return 'Custom blend — export matches what you hear while playing.';
}

export function MixerScreen({navigation, route}: Props) {
  const {sessionId, fileName} = route.params;
  const paths = getSessionPaths(sessionId, fileName);
  const [vocalGain, setVocalGain] = useState(1);
  const [musicGain, setMusicGain] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vocalGainRef = useRef(vocalGain);
  const musicGainRef = useRef(musicGain);

  vocalGainRef.current = vocalGain;
  musicGainRef.current = musicGain;

  useEffect(() => {
    let mounted = true;

    stemPlayer
      .load(paths.vocals, paths.instrumental)
      .then(() => {
        if (mounted) {
          setReady(true);
          setDuration(stemPlayer.getDuration());
          // Apply latest slider values — avoids stale closure if preset was
          // selected while stems were still loading.
          stemPlayer.setVocalGain(vocalGainRef.current);
          stemPlayer.setMusicGain(musicGainRef.current);
        }
      })
      .catch(error => {
        Alert.alert(
          'Playback error',
          error instanceof Error ? error.message : 'Could not load stems',
        );
      });

    return () => {
      mounted = false;
      stemPlayer.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [paths.vocals, paths.instrumental]);

  useEffect(() => {
    stemPlayer.setVocalGain(vocalGain);
  }, [vocalGain]);

  useEffect(() => {
    stemPlayer.setMusicGain(musicGain);
  }, [musicGain]);

  const applyPreset = useCallback((vocal: number, music: number) => {
    setVocalGain(vocal);
    setMusicGain(music);
    if (ready) {
      stemPlayer.setVocalGain(vocal);
      stemPlayer.setMusicGain(music);
    }
  }, [ready]);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setCurrentTime(stemPlayer.getCurrentTime());
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePlay = () => {
    if (!ready) {
      return;
    }
    if (playing) {
      stemPlayer.pause();
      setPlaying(false);
      stopTimer();
    } else {
      stemPlayer.play();
      setPlaying(true);
      startTimer();
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (vocalGain === 0 && musicGain === 0) {
      Alert.alert(
        'Nothing to export',
        'Move at least one slider above 0% — vocals, music, or both.',
      );
      return;
    }

    const filePath = await exportMixedAudio({
      vocalsPath: paths.vocals,
      instrumentalPath: paths.instrumental,
      vocalGain,
      musicGain,
      fileName,
      format,
    });
    await shareExportedFile(filePath);
    Alert.alert('Export ready', 'Your mixed file is ready to save or share.');
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start over?',
      KEEP_SESSION_FILES_FOR_TESTING
        ? 'Return home. Session files are kept while testing mode is on.'
        : 'This will delete the current session files from the app cache.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Start over',
          style: 'destructive',
          onPress: async () => {
            await stemPlayer.stop();
            await destroySession(sessionId);
            navigation.popToTop();
          },
        },
      ],
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (e.data.action.type === 'GO_BACK') {
        if (KEEP_SESSION_FILES_FOR_TESTING) {
          return;
        }
        e.preventDefault();
        Alert.alert(
          'Leave mixer?',
          'Session files will be deleted from app cache.',
          [
            {text: 'Stay', style: 'cancel'},
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                await stemPlayer.stop();
                await destroySession(sessionId);
                navigation.dispatch(e.data.action);
              },
            },
          ],
        );
      }
    });
    return unsubscribe;
  }, [navigation, sessionId]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <Screen>
      <Card style={styles.playerCard} elevated accent={colors.primary}>
        <View style={styles.artwork}>
          <View style={styles.artworkInner}>
            <MaterialCommunityIcons
              name="album"
              size={40}
              color={colors.primary}
            />
          </View>
          {playing ? (
            <View style={styles.playingBadge}>
              <MaterialCommunityIcons
                name="equalizer"
                size={14}
                color={colors.accent}
              />
              <Text style={styles.playingText}>Playing</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.fileName} numberOfLines={2}>
          {fileName}
        </Text>
        <Text style={styles.fileMeta}>Separated stems ready to mix</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>

        <Pressable
          onPress={togglePlay}
          disabled={!ready}
          style={({pressed}) => [
            styles.playButton,
            shadows.glow(colors.primary),
            !ready && styles.playButtonDisabled,
            pressed && ready && styles.playButtonPressed,
          ]}>
          <MaterialCommunityIcons
            name={playing ? 'pause' : 'play'}
            size={36}
            color={colors.white}
            style={playing ? undefined : styles.playIconOffset}
          />
        </Pressable>
      </Card>

      <SectionHeader title="Presets" subtitle="Quick mix starting points" />
      <MixPresets
        vocalGain={vocalGain}
        musicGain={musicGain}
        onSelect={applyPreset}
      />

      <Card style={styles.slidersCard}>
        <SectionHeader title="Mix controls" subtitle="Fine-tune each stem" />
        <StemSlider
          label="Singer's voice"
          description="Artist vocals (e.g. Arijit Singh)"
          value={vocalGain}
          onValueChange={setVocalGain}
          color={colors.vocal}
          icon="microphone-variant"
        />
        <StemSlider
          label="Music & tuning"
          description="Instruments, beats, backing track"
          value={musicGain}
          onValueChange={setMusicGain}
          color={colors.music}
          icon="music-circle-outline"
        />
      </Card>

      <View style={styles.mixHintBox}>
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={colors.accent}
        />
        <Text style={styles.mixHint}>{describeMix(vocalGain, musicGain)}</Text>
      </View>

      <ExportButton onExport={handleExport} disabled={!ready} />

      <AppButton
        label="Start Over"
        onPress={handleStartOver}
        variant="ghost"
        fullWidth={false}
        style={styles.startOver}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    marginBottom: spacing.xxl,
  },
  artwork: {
    marginBottom: spacing.lg,
    position: 'relative',
  },
  artworkInner: {
    width: 96,
    height: 96,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playingText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  fileName: {
    ...typography.headline,
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  fileMeta: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHighlight,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  timeRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  time: {
    ...typography.caption,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  playButtonPressed: {
    transform: [{scale: 0.96}],
  },
  playIconOffset: {
    marginLeft: 4,
  },
  slidersCard: {
    marginTop: spacing.lg,
  },
  mixHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.25)',
  },
  mixHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  startOver: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
