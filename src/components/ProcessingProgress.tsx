import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {SeparationProgress} from '../types/session';
import {AppButton} from './ui/AppButton';
import {Card} from './ui/Card';
import {colors} from '../theme/colors';
import {radii, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

interface ProcessingProgressProps {
  progress: SeparationProgress;
  onCancel?: () => void;
}

const PHASES = [
  {key: 'preflight', label: 'Prepare', icon: 'shield-check-outline'},
  {key: 'decoding', label: 'Decode', icon: 'file-music-outline'},
  {key: 'separating', label: 'Separate', icon: 'brain'},
  {key: 'uploading', label: 'Cloud', icon: 'cloud-upload-outline'},
  {key: 'saving', label: 'Export', icon: 'waveform'},
] as const;

function phaseIndex(phase: SeparationProgress['phase']): number {
  if (phase === 'preflight' || phase === 'downloading-model') {
    return 0;
  }
  if (phase === 'decoding') {
    return 1;
  }
  if (phase === 'separating') {
    return 2;
  }
  if (
    phase === 'uploading' ||
    phase === 'processing-cloud' ||
    phase === 'downloading-stems'
  ) {
    return 3;
  }
  return 4;
}

export function ProcessingProgress({
  progress,
  onCancel,
}: ProcessingProgressProps) {
  const ratio =
    progress.total > 0 ? progress.current / progress.total : 0;
  const activePhase = phaseIndex(progress.phase);
  const percent = Math.round(ratio * 100);

  return (
    <View style={styles.wrapper}>
      <View style={styles.heroIcon}>
        <View style={styles.heroRingOuter}>
          <View style={styles.heroRingInner}>
            <MaterialCommunityIcons
              name="headphones"
              size={36}
              color={colors.primary}
            />
          </View>
        </View>
      </View>

      <Text style={styles.title}>Separating your track</Text>
      <Text style={styles.message}>{progress.message}</Text>

      <Card style={styles.card} elevated>
        <View style={styles.phaseRow}>
          {PHASES.map((phase, index) => {
            const done = index < activePhase;
            const active = index === activePhase;
            return (
              <View key={phase.key} style={styles.phaseItem}>
                <View
                  style={[
                    styles.phaseDot,
                    done && styles.phaseDotDone,
                    active && styles.phaseDotActive,
                  ]}>
                  <MaterialCommunityIcons
                    name={done ? 'check' : phase.icon}
                    size={14}
                    color={
                      done || active ? colors.white : colors.textMuted
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.phaseLabel,
                    (done || active) && styles.phaseLabelActive,
                  ]}>
                  {phase.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${percent}%`}]} />
        </View>

        <View style={styles.progressMeta}>
          <Text style={styles.detail}>
            {progress.phase === 'separating'
              ? progress.total > 0
                ? `Chunk ${progress.current} of ${progress.total}`
                : 'Running AI separation…'
              : progress.phase === 'downloading-model'
                ? 'Downloading AI model…'
                : progress.phase === 'uploading'
                  ? 'Uploading audio to cloud…'
                  : progress.phase === 'processing-cloud'
                    ? 'Cloud separation running…'
                    : progress.phase === 'downloading-stems'
                      ? 'Downloading stems…'
              : progress.phase.charAt(0).toUpperCase() +
                progress.phase.slice(1)}
          </Text>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
      </Card>

      {progress.phase === 'separating' && progress.total > 1 ? (
        <Text style={styles.hint}>
          Processing runs entirely on your device. Keep the app open for large
          songs.
        </Text>
      ) : null}

      {onCancel ? (
        <AppButton
          label="Cancel processing"
          onPress={onCancel}
          variant="danger"
          fullWidth={false}
          style={styles.cancel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  heroIcon: {
    marginBottom: spacing.xxl,
  },
  heroRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  heroRingInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  card: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  phaseItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  phaseDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  phaseDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  phaseLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  phaseLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHighlight,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: {
    ...typography.bodySmall,
    flex: 1,
  },
  percent: {
    ...typography.headline,
    fontSize: 14,
    color: colors.primary,
  },
  hint: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  cancel: {
    marginTop: spacing.md,
    minWidth: 200,
  },
});
