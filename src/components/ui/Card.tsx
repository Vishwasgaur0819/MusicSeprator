import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {radii, shadows, spacing} from '../../theme/layout';
import {typography} from '../../theme/typography';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
  elevated?: boolean;
}

export function Card({children, style, accent, elevated = false}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && shadows.sm,
        accent ? {borderColor: accent} : null,
        style,
      ]}>
      {children}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({title, subtitle, action}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: 'primary' | 'success' | 'danger' | 'neutral';
}

export function Badge({label, tone = 'primary'}: BadgeProps) {
  const toneStyles = {
    primary: {bg: colors.primarySoft, text: colors.primary},
    success: {bg: colors.successSoft, text: colors.success},
    danger: {bg: colors.dangerSoft, text: colors.danger},
    neutral: {bg: colors.surfaceHighlight, text: colors.textSecondary},
  }[tone];

  return (
    <View style={[styles.badge, {backgroundColor: toneStyles.bg}]}>
      <Text style={[styles.badgeText, {color: toneStyles.text}]}>{label}</Text>
    </View>
  );
}

interface IconCircleProps {
  icon: React.ReactNode;
  color?: string;
  size?: number;
}

export function IconCircle({icon, color = colors.primary, size = 48}: IconCircleProps) {
  return (
    <View
      style={[
        styles.iconCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
          borderColor: `${color}44`,
        },
      ]}>
      {icon}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.headline,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
