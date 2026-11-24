import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../store/themeStore';
import { NYXLogo } from './NYXLogo';
import { Typography, Palette } from './tokens';

export const SplashScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [fadeAnim, scaleAnim, pulseAnim]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#180709' : Palette.creamBackground }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <NYXLogo size="xl" centered />

        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          "Your digital security, beautifully simplified."
        </Text>

        {/* Minimal loading indicator dots */}
        <Animated.View style={[styles.pulseCircle, { opacity: pulseAnim }]}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <View style={[styles.dot, { backgroundColor: Palette.lightBeige }]} />
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
        </Animated.View>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textDim }]}>
          AES-256-GCM • Argon2id • Hardware Keystore
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: Typography.fontFamilyHeading,
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  pulseCircle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilyMono,
    letterSpacing: 0.5,
  },
});
