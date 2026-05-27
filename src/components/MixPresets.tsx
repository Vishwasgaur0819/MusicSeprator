import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors} from '../theme/colors';
import {radii, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

export interface MixPreset {
  id: string;
  label: string;
  vocalGain: number;
  musicGain: number;
  icon: string;
}

export const MIX_PRESETS: MixPreset[] = [
  {
    id: 'music-only',
    label: 'Music only',
    vocalGain: 0,
    musicGain: 1,
    icon: 'music-circle-outline',
  },
  {
    id: 'vocals-only',
    label: 'Vocals only',
    vocalGain: 1,
    musicGain: 0,
    icon: 'microphone-variant',
  },
  {
    id: 'karaoke',
    label: 'Low vocals',
    vocalGain: 0.1,
    musicGain: 1,
    icon: 'microphone-minus',
  },
  {
    id: 'balanced',
    label: 'Both full',
    vocalGain: 1,
    musicGain: 1,
    icon: 'equalizer',
  },
];

interface MixPresetsProps {
  vocalGain: number;
  musicGain: number;
  onSelect: (vocalGain: number, musicGain: number) => void;
}

function isPresetActive(
  preset: MixPreset,
  vocalGain: number,
  musicGain: number,
): boolean {
  return (
    Math.abs(preset.vocalGain - vocalGain) < 0.001 &&
    Math.abs(preset.musicGain - musicGain) < 0.001
  );
}

export function MixPresets({
  vocalGain,
  musicGain,
  onSelect,
}: MixPresetsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {MIX_PRESETS.map(preset => {
        const active = isPresetActive(preset, vocalGain, musicGain);
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.vocalGain, preset.musicGain)}
            style={({pressed}) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}>
            <MaterialCommunityIcons
              name={preset.icon}
              size={18}
              color={active ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
  },
});
