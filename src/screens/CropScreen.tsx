import React, {useCallback} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../types/navigation';
import {formatTime, MIN_CROP_SEC} from '../audio/cropAudio';
import {TrimTimeline} from '../components/TrimTimeline';
import {AppButton} from '../components/ui/AppButton';
import {Screen} from '../components/ui/Screen';
import {destroySession} from '../storage/sessionManager';
import {useTrimSession} from '../trim/useTrimSession';
import {colors} from '../theme/colors';
import {radii, shadows, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Crop'>;

function displayFileName(name: string): string {
  return name.split(/[/\\]/).pop() ?? name;
}

export function CropScreen({navigation, route}: Props) {
  const {sessionId, fileName} = route.params;
  const insets = useSafeAreaInsets();
  const {state, derived, actions} = useTrimSession(sessionId, fileName);
  const shortName = displayFileName(fileName);
  const ready = state.status === 'ready' || state.status === 'previewing';
  const applying = state.status === 'applying';

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', e => {
        if (applying) {
          return;
        }

        e.preventDefault();
        Alert.alert('Discard upload?', 'Your uploaded file will be deleted.', [
          {text: 'Keep editing', style: 'cancel'},
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              actions.stopPreview();
              await destroySession(sessionId);
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      });

      return unsubscribe;
    }, [actions, applying, navigation, sessionId]),
  );

  const goToProcessing = () => {
    navigation.replace('Processing', {sessionId, fileName});
  };

  const handleContinue = async () => {
    try {
      await actions.applyTrim();
      goToProcessing();
    } catch (error) {
      Alert.alert(
        'Could not continue',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  };

  const handleUseFullSong = () => {
    actions.stopPreview();
    goToProcessing();
  };

  const continueLabel = derived.isFullSong
    ? `Continue · full song (${formatTime(state.durationSec)})`
    : `Continue · ${formatTime(derived.selectedSec)} clip`;

  if (state.status === 'loading') {
    return (
      <Screen scroll={false} contentStyle={styles.centerContent}>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonWave} />
          <View style={styles.skeletonControls} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Opening trim studio</Text>
        <Text style={styles.loadingText}>
          Decoding audio and building timeline…
        </Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen scroll={false} centered contentStyle={styles.centerContent}>
        <View style={styles.errorOrb}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={36}
            color={colors.danger}
          />
        </View>
        <Text style={styles.errorTitle}>Could not open track</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <AppButton label="Retry" onPress={() => void actions.reload()} />
        <AppButton
          label="Go back"
          variant="secondary"
          onPress={async () => {
            await destroySession(sessionId);
            navigation.popToTop();
          }}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen
        contentStyle={{
          ...styles.content,
          paddingBottom: 160 + insets.bottom,
        }}
        scroll>
        <View style={styles.stepPill}>
          <Text style={styles.stepText}>Step 2 of 4</Text>
          <Text style={styles.stepDivider}>·</Text>
          <Text style={styles.stepName}>Trim</Text>
        </View>

        <View style={styles.fileCard}>
          <View style={styles.fileIconWrap}>
            <MaterialCommunityIcons
              name="music-circle-outline"
              size={28}
              color={colors.primary}
            />
          </View>
          <View style={styles.fileMeta}>
            <Text style={styles.fileName} numberOfLines={1}>
              {shortName}
            </Text>
            <Text style={styles.fileSub}>
              {formatTime(state.durationSec)} total · min clip {MIN_CROP_SEC}s
            </Text>
          </View>
          {!derived.requiresFullSongOnly ? (
            <Pressable
              style={({pressed}) => [
                styles.quickAction,
                pressed && styles.quickActionPressed,
              ]}
              onPress={actions.selectFullSong}>
              <MaterialCommunityIcons
                name="select-all"
                size={16}
                color={colors.accent}
              />
              <Text style={styles.quickActionText}>Full</Text>
            </Pressable>
          ) : null}
        </View>

        <TrimTimeline
          durationSec={state.durationSec}
          startSec={state.startSec}
          endSec={state.endSec}
          playheadSec={state.playheadSec}
          peaks={state.peaks}
          isPlaying={state.isPlaying}
          ready={ready}
          onInChange={actions.setInPoint}
          onOutChange={actions.setOutPoint}
          onPlayheadChange={actions.setPlayhead}
          onTogglePlay={() => void actions.togglePreview()}
          onRestart={() => void actions.restartPreview()}
        />

        <View
          style={[
            styles.statusBanner,
            derived.selectionValid ? styles.statusOk : styles.statusWarn,
          ]}>
          <MaterialCommunityIcons
            name={derived.selectionValid ? 'check-circle-outline' : 'alert-outline'}
            size={18}
            color={derived.selectionValid ? colors.success : colors.warning}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: derived.selectionValid
                  ? colors.success
                  : colors.warning,
              },
            ]}>
            {derived.requiresFullSongOnly
              ? 'Short track — continue with the full song.'
              : derived.selectionValid
                ? derived.isFullSong
                  ? 'Full song selected. Ready to separate.'
                  : `${formatTime(derived.selectedSec)} clip selected. Ready to separate.`
                : `Choose at least ${MIN_CROP_SEC} seconds or use the full song.`}
          </Text>
        </View>
      </Screen>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}>
        <AppButton
          label={continueLabel}
          onPress={handleContinue}
          loading={applying}
          disabled={!derived.selectionValid || applying}
          icon={
            <MaterialCommunityIcons
              name="scissors-cutting"
              size={20}
              color={colors.white}
            />
          }
        />
        {!derived.isFullSong ? (
          <AppButton
            label={`Use full song (${formatTime(state.durationSec)})`}
            variant="ghost"
            onPress={handleUseFullSong}
            disabled={applying}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.sm,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  skeletonCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  skeletonWave: {
    height: 132,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceHighlight,
  },
  skeletonControls: {
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  loadingTitle: {
    ...typography.title,
  },
  loadingText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  errorOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    ...typography.title,
    color: colors.danger,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  stepText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stepDivider: {
    color: colors.textMuted,
  },
  stepName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  fileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...typography.headline,
    fontSize: 16,
  },
  fileSub: {
    ...typography.bodySmall,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.35)',
  },
  quickActionPressed: {
    opacity: 0.85,
  },
  quickActionText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
  },
  statusOk: {
    backgroundColor: colors.successSoft,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  statusWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  statusText: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
});
