import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {appLabels} from '../copy/appLabels';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SPLASH_DURATION_MS = 3200;
const FLASH_DURATION_MS = 600;

const FALLING_EMOJIS = [
  {emoji: '😍', leftRatio: 0.06, delay: 0, size: 34, spin: 18},
  {emoji: '🎤', leftRatio: 0.18, delay: 120, size: 30, spin: -22},
  {emoji: '🎵', leftRatio: 0.32, delay: 240, size: 32, spin: 16},
  {emoji: '✨', leftRatio: 0.46, delay: 80, size: 28, spin: -14},
  {emoji: '💜', leftRatio: 0.58, delay: 200, size: 30, spin: 20},
  {emoji: '🎶', leftRatio: 0.7, delay: 320, size: 32, spin: -18},
  {emoji: '🔥', leftRatio: 0.82, delay: 160, size: 28, spin: 15},
  {emoji: '⭐', leftRatio: 0.12, delay: 400, size: 26, spin: -12},
  {emoji: '💫', leftRatio: 0.38, delay: 480, size: 28, spin: 24},
  {emoji: '🎧', leftRatio: 0.54, delay: 360, size: 30, spin: -16},
  {emoji: '🎸', leftRatio: 0.66, delay: 520, size: 28, spin: 14},
  {emoji: '🎹', leftRatio: 0.9, delay: 280, size: 30, spin: -20},
] as const;

interface FallingEmojiProps {
  emoji: string;
  left: number;
  delay: number;
  size: number;
  spin: number;
  landingY: number;
}

function FallingEmoji({
  emoji,
  left,
  delay,
  size,
  spin,
  landingY,
}: FallingEmojiProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: landingY,
        duration: 1300,
        delay,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1300,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, landingY, rotate, translateY]);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${spin * 18}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.fallingEmoji,
        {
          left,
          transform: [{translateY}, {rotate: rotation}],
        },
      ]}>
      <Text style={[styles.emojiGlyph, {fontSize: size}]} allowFontScaling={false}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

export function SplashScreen({navigation}: Props) {
  const {width, height} = useWindowDimensions();
  const flashOpacity = useRef(new Animated.Value(1)).current;

  const emojiLandings = useMemo(
    () =>
      FALLING_EMOJIS.map((item, index) => ({
        ...item,
        left: Math.max(8, width * item.leftRatio - item.size / 2),
        landingY: height * (0.18 + (index % 5) * 0.12),
      })),
    [height, width],
  );

  useEffect(() => {
    const flashLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 0.15,
          duration: FLASH_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: FLASH_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );

    flashLoop.start();

    const timer = setTimeout(() => {
      flashLoop.stop();
      navigation.replace('Home');
    }, SPLASH_DURATION_MS);

    return () => {
      flashLoop.stop();
      clearTimeout(timer);
    };
  }, [flashOpacity, navigation]);

  return (
    <View style={styles.root}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.emojiLayer} pointerEvents="none">
        {emojiLandings.map(item => (
          <FallingEmoji
            key={`${item.emoji}-${item.leftRatio}`}
            emoji={item.emoji}
            left={item.left}
            delay={item.delay}
            size={item.size}
            spin={item.spin}
            landingY={item.landingY}
          />
        ))}
      </View>

      <Animated.Text
        style={[styles.flashText, styles.textOverlay, {opacity: flashOpacity}]}>
        {appLabels.splash.tagline}
      </Animated.Text>
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
    zIndex: 0,
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
    zIndex: 0,
  },
  emojiLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    elevation: 1,
  },
  fallingEmoji: {
    position: 'absolute',
    top: 0,
  },
  emojiGlyph: {
    textAlign: 'center',
    ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
  },
  flashText: {
    ...typography.display,
    fontSize: 28,
    textAlign: 'center',
    color: colors.text,
  },
  textOverlay: {
    position: 'absolute',
    top: '42%',
    left: 32,
    right: 32,
    zIndex: 2,
    elevation: 2,
  },
});
