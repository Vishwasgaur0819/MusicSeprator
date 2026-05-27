import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors} from '../theme/colors';
import {radii, shadows, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

export interface MixPreset {
  id: string;
  label: string;
  vocalGain: number;
  musicGain: number;
  icon: string;
  description: string;
}

/**
 * The three primary mix modes. Sliders below act as fine-tune controls.
 * - Music Only:  vocalGain=0, musicGain=1  → live `mix - vocals`
 * - Low Vocal:   vocalGain=0.4, musicGain=1 → live `mix - 0.6 * vocals`
 * - Vocals Only: vocalGain=1, musicGain=0  → live `vocals`
 */
export const MIX_PRESETS: MixPreset[] = [
  {
    id: 'music-only',
    label: 'Music Only',
    vocalGain: 0,
    musicGain: 1,
    icon: 'music-circle-outline',
    description: 'Karaoke',
  },
  {
    id: 'low-vocal',
    label: 'Low Vocal',
    vocalGain: 0.4,
    musicGain: 1,
    icon: 'microphone-minus',
    description: '40% vocals',
  },
  {
    id: 'vocals-only',
    label: 'Vocals Only',
    vocalGain: 1,
    musicGain: 0,
    icon: 'microphone-variant',
    description: 'A cappella',
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
    Math.abs(preset.vocalGain - vocalGain) < 0.005 &&
    Math.abs(preset.musicGain - musicGain) < 0.005
  );
}

export function MixPresets({
  vocalGain,
  musicGain,
  onSelect,
}: MixPresetsProps) {
  return (
    <View style={styles.row}>
      {MIX_PRESETS.map(preset => {
        const active = isPresetActive(preset, vocalGain, musicGain);
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.vocalGain, preset.musicGain)}
            style={({pressed}) => [
              styles.tile,
              active && styles.tileActive,
              active && shadows.glow(colors.primary),
              pressed && styles.tilePressed,
            ]}>
            <View
              style={[
                styles.iconWrap,
                active && styles.iconWrapActive,
              ]}>
              <MaterialCommunityIcons
                name={preset.icon}
                size={24}
                color={active ? colors.white : colors.primary}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {preset.label}
            </Text>
            <Text
              style={[
                styles.description,
                active && styles.descriptionActive,
              ]}>
              {preset.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  tileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  label: {
    ...typography.headline,
    fontSize: 14,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.white,
  },
  description: {
    ...typography.caption,
    textAlign: 'center',
  },
  descriptionActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
