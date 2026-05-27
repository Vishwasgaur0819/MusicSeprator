import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {Menu} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {ExportFormat} from '../audio/exportMix';
import {AppButton} from './ui/AppButton';
import {Card} from './ui/Card';
import {colors} from '../theme/colors';
import {spacing} from '../theme/layout';
import {typography} from '../theme/typography';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
}

export function ExportButton({onExport, disabled}: ExportButtonProps) {
  const [visible, setVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setVisible(false);
    setExporting(true);
    try {
      await onExport(format);
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card style={styles.card} accent={colors.accent}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="export-variant"
          size={22}
          color={colors.accent}
        />
        <View style={styles.headerText}>
          <Text style={styles.title}>Export your mix</Text>
          <Text style={styles.subtitle}>
            Slider levels are baked into the exported file
          </Text>
        </View>
      </View>

      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        contentStyle={styles.menu}
        anchor={
          <AppButton
            label={exporting ? 'Exporting…' : 'Export Mix'}
            onPress={() => setVisible(true)}
            variant="primary"
            loading={exporting}
            disabled={disabled || exporting}
            icon={
              !exporting ? (
                <MaterialCommunityIcons
                  name="download"
                  size={20}
                  color={colors.white}
                />
              ) : undefined
            }
            style={styles.button}
          />
        }>
        <Menu.Item
          onPress={() => handleExport('wav')}
          title="Export as WAV"
          leadingIcon="waveform"
        />
        <Menu.Item
          onPress={() => handleExport('m4a')}
          title="Export as M4A (WAV fallback)"
          leadingIcon="music-box-outline"
        />
      </Menu>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
  },
  button: {
    backgroundColor: colors.accent,
    marginTop: spacing.md,
  },
  menu: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
  },
});
