import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {colors} from '../../theme/colors';
import {radii, shadows, spacing} from '../../theme/layout';
import {typography} from '../../theme/typography';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: {
      container: styles.primary,
      text: styles.primaryText,
      glow: shadows.glow(colors.primary),
    },
    secondary: {
      container: styles.secondary,
      text: styles.secondaryText,
      glow: undefined,
    },
    ghost: {
      container: styles.ghost,
      text: styles.ghostText,
      glow: undefined,
    },
    danger: {
      container: styles.danger,
      text: styles.dangerText,
      glow: undefined,
    },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variantStyles.container,
        variantStyles.glow,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[styles.label, variantStyles.text]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.headline,
    fontSize: 16,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.white,
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryText: {
    color: colors.text,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  ghostText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
  },
  dangerText: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.88,
    transform: [{scale: 0.985}],
  },
  disabled: {
    opacity: 0.45,
  },
});
