import React, {useCallback, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {pick, types} from '@react-native-documents/picker';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {createSession, findLatestReadySession} from '../storage/sessionManager';
import {SEPARATION_PIPELINE_VERSION} from '../ml/separateStems';
import {
  formatModelSize,
  getModelSetupInstructions,
  getModelStatus,
  installModelFromFile,
  type ModelStatus,
} from '../ml/modelManager';
import {KEEP_SESSION_FILES_FOR_TESTING} from '../config/dev';
import {AppButton} from '../components/ui/AppButton';
import {Badge, Card, IconCircle, SectionHeader} from '../components/ui/Card';
import {Screen} from '../components/ui/Screen';
import {colors} from '../theme/colors';
import {radii, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const USE_CASES = [
  {
    icon: 'music-note-off',
    title: 'Music only',
    detail: 'Mute vocals, export a clean instrumental',
    color: colors.music,
  },
  {
    icon: 'microphone-variant',
    title: 'Vocals only',
    detail: 'Isolate the singer, remove instruments',
    color: colors.vocal,
  },
  {
    icon: 'microphone-minus',
    title: 'Karaoke mode',
    detail: 'Full music with vocals dialed down to 5–15%',
    color: colors.accent,
  },
] as const;

const STEPS = [
  {num: '1', label: 'Upload', icon: 'upload'},
  {num: '2', label: 'Separate', icon: 'brain'},
  {num: '3', label: 'Mix & export', icon: 'tune-vertical'},
] as const;

export function HomeScreen({navigation}: Props) {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [lastSession, setLastSession] = useState<{
    sessionId: string;
    fileName: string;
    pipelineVersion?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshModelStatus = useCallback(async () => {
    setModelStatus(await getModelStatus());
    if (KEEP_SESSION_FILES_FOR_TESTING) {
      setLastSession(await findLatestReadySession());
    } else {
      setLastSession(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshModelStatus();
    }, [refreshModelStatus]),
  );

  const modelReady = modelStatus !== null;

  const handleUpload = async () => {
    try {
      setLoading(true);
      const [result] = await pick({
        type: [types.audio],
        mode: 'import',
      });

      if (!result.uri || !result.name) {
        return;
      }

      const paths = await createSession(result.uri, result.name);
      navigation.navigate('Processing', {
        sessionId: paths.sessionId,
        fileName: result.name,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('User canceled')
      ) {
        return;
      }
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not open file',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInstallModel = async () => {
    try {
      const [result] = await pick({
        type: [types.allFiles],
        mode: 'import',
      });
      if (!result.uri) {
        return;
      }
      const destPath = await installModelFromFile(result.uri);
      await refreshModelStatus();
      const fileName = destPath.split('/').pop() ?? destPath;
      Alert.alert('Model installed', `${fileName}\n\nSaved to app cache.`);
    } catch (error) {
      Alert.alert(
        'Install failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <IconCircle
          icon={
            <MaterialCommunityIcons
              name="waveform"
              size={28}
              color={colors.primary}
            />
          }
          size={64}
        />
        <Text style={styles.brand}>StemSplit</Text>
        <Text style={styles.title}>Vocal & Music Mixer</Text>
        <Text style={styles.subtitle}>
          Upload any song and split the singer's voice from the music. Mix
          independently, preview live, and export your blend.
        </Text>
      </View>

      <View style={styles.stepsRow}>
        {STEPS.map((step, index) => (
          <View key={step.num} style={styles.stepItem}>
            <View style={styles.stepIconWrap}>
              <MaterialCommunityIcons
                name={step.icon}
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.stepNum}>{step.num}</Text>
            <Text style={styles.stepLabel}>{step.label}</Text>
            {index < STEPS.length - 1 ? (
              <View style={styles.stepConnector} />
            ) : null}
          </View>
        ))}
      </View>

      <Card elevated accent={colors.primary}>
        <SectionHeader
          title="Upload"
          subtitle="Choose a song to separate"
        />
        <Text style={styles.cardText}>
          Supports MP3, M4A, WAV, FLAC and other common formats.
        </Text>
        <AppButton
          label="Choose Audio File"
          onPress={handleUpload}
          loading={loading}
          disabled={!modelReady || loading}
          icon={
            <MaterialCommunityIcons
              name="folder-music-outline"
              size={20}
              color={colors.white}
            />
          }
        />
        {KEEP_SESSION_FILES_FOR_TESTING && lastSession ? (
          <>
            <AppButton
              label={`Continue: ${lastSession.fileName}`}
              onPress={() =>
                navigation.navigate('Mixer', {
                  sessionId: lastSession.sessionId,
                  fileName: lastSession.fileName,
                })
              }
              variant="secondary"
              icon={
                <MaterialCommunityIcons
                  name="history"
                  size={20}
                  color={colors.accent}
                />
              }
            />
            {lastSession.pipelineVersion !== SEPARATION_PIPELINE_VERSION ? (
              <View style={styles.warningBox}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.warning}
                />
                <Text style={styles.staleHint}>
                  Stems may be outdated — re-upload for the latest separation
                  quality.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      <View style={styles.useCaseGrid}>
        {USE_CASES.map(item => (
          <View key={item.title} style={styles.useCaseCard}>
            <View
              style={[
                styles.useCaseIcon,
                {backgroundColor: `${item.color}18`},
              ]}>
              <MaterialCommunityIcons
                name={item.icon}
                size={20}
                color={item.color}
              />
            </View>
            <Text style={styles.useCaseTitle}>{item.title}</Text>
            <Text style={styles.useCaseDetail}>{item.detail}</Text>
          </View>
        ))}
      </View>

      <Card>
        <SectionHeader
          title="AI Model"
          subtitle={
            modelReady && modelStatus
              ? 'Ready for on-device separation'
              : 'Required to get started'
          }
          action={
            modelReady ? (
              <Badge label="Ready" tone="success" />
            ) : (
              <Badge label="Missing" tone="danger" />
            )
          }
        />

        {modelReady && modelStatus ? (
          <>
            <View style={styles.activeModelBox}>
              <View style={styles.activeModelHeader}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.activeModelLabel}>Active model</Text>
              </View>
              <Text style={styles.activeModelName}>
                {modelStatus.activeFileName}
              </Text>
              <Text style={styles.activeModelDetail}>
                {modelStatus.activeLabel}
              </Text>
            </View>

            {modelStatus.installed.length > 0 ? (
              <View style={styles.installedList}>
                <Text style={styles.installedTitle}>Installed on device</Text>
                {modelStatus.installed.map(model => (
                  <View key={model.fileName} style={styles.installedRow}>
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                    <View style={styles.installedInfo}>
                      <Text style={styles.installedName}>{model.fileName}</Text>
                      <Text style={styles.installedMeta}>
                        {formatModelSize(model.sizeBytes)} · {model.label}
                      </Text>
                    </View>
                    {model.isActive ? (
                      <Badge label="Active" tone="primary" />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <AppButton
              label="Install / Replace Model"
              onPress={handleInstallModel}
              variant="secondary"
              icon={
                <MaterialCommunityIcons
                  name="download-circle-outline"
                  size={20}
                  color={colors.text}
                />
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.cardText}>
              Install the ONNX vocal separation model to enable AI-powered stem
              splitting on your phone.
            </Text>
            <Text style={styles.modelHint}>{getModelSetupInstructions()}</Text>
            <AppButton
              label="Install Model File"
              onPress={handleInstallModel}
              variant="secondary"
              icon={
                <MaterialCommunityIcons
                  name="download-circle-outline"
                  size={20}
                  color={colors.text}
                />
              }
            />
          </>
        )}
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made by Vishwas</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  brand: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    textAlign: 'center',
    fontSize: 28,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepNum: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  stepConnector: {
    position: 'absolute',
    top: 20,
    right: -20,
    width: 40,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  cardText: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  staleHint: {
    ...typography.bodySmall,
    color: colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  useCaseGrid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  useCaseCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  useCaseIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  useCaseTitle: {
    ...typography.headline,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  useCaseDetail: {
    ...typography.bodySmall,
  },
  activeModelBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
  },
  activeModelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  activeModelLabel: {
    ...typography.label,
    color: colors.primary,
  },
  activeModelName: {
    ...typography.mono,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  activeModelDetail: {
    ...typography.bodySmall,
  },
  installedList: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  installedTitle: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  installedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  installedInfo: {
    flex: 1,
  },
  installedName: {
    ...typography.mono,
    color: colors.text,
  },
  installedMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  modelHint: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginTop: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
});
