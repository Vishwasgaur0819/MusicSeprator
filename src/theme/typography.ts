import {TextStyle} from 'react-native';
import {colors} from './colors';

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 38,
  } satisfies TextStyle,
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 28,
  } satisfies TextStyle,
  headline: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 22,
  } satisfies TextStyle,
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 18,
  } satisfies TextStyle,
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 14,
  } satisfies TextStyle,
  mono: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: 'monospace',
  } satisfies TextStyle,
};
