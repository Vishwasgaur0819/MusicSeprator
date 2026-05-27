import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../theme/colors';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  centered?: boolean;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
}

export function Screen({
  children,
  scroll = true,
  centered = false,
  contentStyle,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const content = (
    <View
      style={[
        styles.content,
        centered && styles.centered,
        {
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 24),
        },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, style]}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollGrow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primarySoft,
    opacity: 0.9,
  },
  glowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accentSoft,
    opacity: 0.7,
  },
  scrollGrow: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centered: {
    justifyContent: 'center',
  },
});
