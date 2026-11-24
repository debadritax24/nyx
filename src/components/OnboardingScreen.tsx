import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { NYXLogo } from './NYXLogo';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { ShieldIcon, KeyIcon, QrCodeIcon, CheckIcon } from './Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from './tokens';

interface OnboardingScreenProps {
  onComplete: () => void;
  onSignIn: () => void;
}

interface Step {
  title: string;
  subtitle: string;
  badge: string;
  icon: (color: string) => React.ReactNode;
  highlights: string[];
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
  onSignIn,
}) => {
  const { theme, isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    {
      badge: 'WELCOME TO NYX',
      title: 'Security that feels effortless.',
      subtitle:
        'A zero-knowledge two-factor authenticator engineered to safeguard your digital accounts with client-side authenticated cryptography.',
      icon: (color) => <ShieldIcon size={38} color={color} />,
      highlights: [
        'Zero plaintext secrets sent to cloud',
        'Hardware Keystore biometric unlock',
        'No tracking, ads, or third-party telemetry',
      ],
    },
    {
      badge: 'OFFLINE & ACCURATE',
      title: 'Real-time security codes.',
      subtitle:
        'Generates RFC 6238 TOTP codes locally on your device with high-precision time drift tolerance and instantaneous one-tap copy.',
      icon: (color) => <KeyIcon size={38} color={color} />,
      highlights: [
        'Supports Google, GitHub, AWS, Microsoft, and more',
        '6 and 8-digit codes with 30s / 60s intervals',
        'Auto-clipboard purging for safety',
      ],
    },
    {
      badge: 'INSTANT SETUP',
      title: 'Scan once, protected always.',
      subtitle:
        'Seamlessly scan 2FA QR codes or enter setup keys manually. All credentials are encrypted on device before multi-device synchronization.',
      icon: (color) => <QrCodeIcon size={38} color={color} />,
      highlights: [
        'Built-in QR camera scanner with flashlight support',
        '24-word emergency recovery code backup',
        'Crash-safe tamper-resistant mutation journal',
      ],
    },
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header: Logo + Theme Toggle + Skip */}
      <View style={styles.topBar}>
        <NYXLogo size="sm" />
        <View style={styles.topRight}>
          <ThemeToggle size={36} />
          {currentStep < steps.length - 1 && (
            <TouchableOpacity onPress={onComplete} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Slide Card */}
      <View style={styles.slideContainer}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            Shadows.card,
          ]}
        >
          {/* Top Badge & Icon */}
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
              ]}
            >
              {step.icon(theme.primary)}
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.secondaryText }]}>
                {step.badge}
              </Text>
            </View>
          </View>

          {/* Titles */}
          <Text style={[styles.headline, { color: theme.heading }]}>{step.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{step.subtitle}</Text>

          {/* Highlights List */}
          <View style={styles.highlightsBox}>
            {step.highlights.map((item, idx) => (
              <View key={idx} style={styles.highlightRow}>
                <View style={[styles.checkCircle, { backgroundColor: theme.surfaceHighlight }]}>
                  <CheckIcon size={12} color={theme.success} />
                </View>
                <Text style={[styles.highlightText, { color: theme.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Step Indicator Dots */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === currentStep ? 24 : 8,
                  backgroundColor:
                    i === currentStep
                      ? theme.primary
                      : isDark
                      ? Palette.darkBorder
                      : Palette.border,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          title={currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
          size="lg"
          onPress={handleNext}
          style={styles.primaryBtn}
        />

        <TouchableOpacity onPress={onSignIn} style={styles.signInBtn}>
          <Text style={[styles.signInPrompt, { color: theme.textMuted }]}>
            Already have an account?{' '}
            <Text style={[styles.signInHighlight, { color: theme.primary }]}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Typography.fontFamilyBody,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    lineHeight: 34,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Typography.fontFamilyBody,
    marginBottom: Spacing.lg,
  },
  highlightsBox: {
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Typography.fontFamilyBody,
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomActions: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  primaryBtn: {
    width: '100%',
  },
  signInBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  signInPrompt: {
    fontSize: 14,
    fontFamily: Typography.fontFamilyBody,
  },
  signInHighlight: {
    fontWeight: '700',
  },
});
