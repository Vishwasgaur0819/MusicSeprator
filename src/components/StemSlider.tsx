import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Slider from '@react-native-community/slider';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors} from '../theme/colors';
import {radii, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

interface StemSliderProps {
  label: string;
  description?: string;
  value: number;
  onValueChange: (value: number) => void;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

export function StemSlider({
  label,
  description,
  value,
  onValueChange,
  color = colors.primary,
  icon = 'tune-vertical',
  disabled = false,
}: StemSliderProps) {
  const displayValue =
    value === 0 ? 'Muted' : `${Math.round(value * 100)}%`;
  const isMuted = value === 0;

  const handleChange = (next: number) => {
    if (disabled) {
      return;
    }
    onValueChange(next);
  };

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, {backgroundColor: `${color}18`}]}>
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={disabled ? colors.textMuted : color}
          />
        </View>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
          {description ? (
            <Text
              style={[
                styles.description,
                disabled && styles.descriptionDisabled,
              ]}>
              {description}
            </Text>
          ) : null}
        </View>
        <View style={[styles.valuePill, isMuted && styles.valuePillMuted]}>
          <Text style={[styles.value, isMuted && styles.mutedValue]}>
            {displayValue}
          </Text>
        </View>
      </View>

      <View style={[styles.trackShell, disabled && styles.trackShellDisabled]}>
        <View
          style={[
            styles.trackFill,
            {
              width: `${Math.max(value * 100, 0)}%`,
              backgroundColor: color,
            },
            disabled && styles.trackFillDisabled,
          ]}
        />
        <Slider
          value={value}
          onValueChange={handleChange}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          disabled={disabled}
          thumbTintColor={colors.white}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          style={styles.slider}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  containerDisabled: {
    opacity: 0.55,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBlock: {
    flex: 1,
  },
  label: {
    ...typography.headline,
    fontSize: 16,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  description: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  descriptionDisabled: {
    color: colors.textMuted,
  },
  valuePill: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    minWidth: 56,
    alignItems: 'center',
  },
  valuePillMuted: {
    backgroundColor: colors.dangerSoft,
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  mutedValue: {
    color: colors.danger,
  },
  trackShell: {
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackShellDisabled: {
    backgroundColor: colors.surfaceRaised,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
    borderRadius: radii.pill,
  },
  trackFillDisabled: {
    opacity: 0.2,
  },
  slider: {
    width: '100%',
    height: 44,
  },
});
