import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors} from '../theme/colors';
import {appLabels} from '../copy/appLabels';
import {radii, shadows, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

export type MixMode = 'music-only' | 'custom' | 'vocals-only';

export interface MixPreset {
  id: MixMode;
  label: string;
  icon: string;
  description: string;
}

/**
 * Quick mix modes. Fine-tune sliders are enabled only in Custom mode.
 * - Music Only:  vocalGain=0, musicGain=1  → live `mix - vocals`
 * - Custom:      user-adjustable blend (starts at 100% / 100%)
 * - Vocals Only: vocalGain=1, musicGain=0  → vocals
 */
export const MIX_PRESETS: MixPreset[] = [
  {
    id: 'music-only',
    label: 'Music Only',
    icon: 'music-circle-outline',
    description: appLabels.presets.musicOnlyDescription,
  },
  {
    id: 'vocals-only',
    label: 'Vocals Only',
    icon: 'microphone-variant',
    description: appLabels.presets.vocalsOnlyDescription,
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'tune-vertical',
    description: appLabels.presets.customDescription,
  },
];

interface MixPresetsProps {
  activePresetId: MixMode;
  onSelect: (presetId: MixMode) => void;
}

export function MixPresets({activePresetId, onSelect}: MixPresetsProps) {
  return (
    <View style={styles.row}>
      {MIX_PRESETS.map(preset => {
        const active = activePresetId === preset.id;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.id)}
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
