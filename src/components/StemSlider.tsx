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
}

export function StemSlider({
  label,
  description,
  value,
  onValueChange,
  color = colors.primary,
  icon = 'tune-vertical',
}: StemSliderProps) {
  const displayValue =
    value === 0 ? 'Muted' : `${Math.round(value * 100)}%`;
  const isMuted = value === 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, {backgroundColor: `${color}18`}]}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.labelBlock}>
          <Text style={styles.label}>{label}</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>
        <View style={[styles.valuePill, isMuted && styles.valuePillMuted]}>
          <Text style={[styles.value, isMuted && styles.mutedValue]}>
            {displayValue}
          </Text>
        </View>
      </View>

      <View style={styles.trackShell}>
        <View
          style={[
            styles.trackFill,
            {
              width: `${Math.max(value * 100, 0)}%`,
              backgroundColor: color,
            },
          ]}
        />
        <Slider
          value={value}
          onValueChange={onValueChange}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
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
  description: {
    ...typography.bodySmall,
    marginTop: 2,
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
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
    borderRadius: radii.pill,
  },
  slider: {
    width: '100%',
    height: 44,
  },
});
