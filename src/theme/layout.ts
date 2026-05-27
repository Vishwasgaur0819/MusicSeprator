import {ViewStyle} from 'react-native';
import {colors} from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  } satisfies ViewStyle,
  glow: (color: string) =>
    ({
      shadowColor: color,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    }) satisfies ViewStyle,
};

export const screenPadding = spacing.xxl;
