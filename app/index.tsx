import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useVaultStore } from '../src/store/vaultStore';
import { useTheme } from '../src/store/themeStore';
import { Button } from '../src/components/Button';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { ShieldIcon, KeyIcon, DeviceIcon, CheckIcon } from '../src/components/Icons';
import { CountdownCircle } from '../src/components/CountdownCircle';
import { Radius, Spacing, Typography, Shadows, Palette } from '../src/components/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { theme, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isUnlocked, loadFromLocalKeystore } = useVaultStore();

  const [mockTimer, setMockTimer] = useState(24);

  // Auto-route authenticated users directly to vault
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      if (!isUnlocked) {
        loadFromLocalKeystore().then(() => {
          router.replace('/(app)');
        });
      } else {
        router.replace('/(app)');
      }
    }
  }, [isAuthenticated, isLoading, isUnlocked, router, loadFromLocalKeystore]);

  // Live countdown animation on the hero preview card
  useEffect(() => {
    const interval = setInterval(() => {
      setMockTimer((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingLogo, { color: theme.heading }]}>NYX</Text>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.brandGroup}>
            <View style={[styles.logoMark, { backgroundColor: theme.primary }]}>
              <Text style={styles.logoMarkText}>N</Text>
            </View>
            <View>
              <Text style={[styles.brandTitle, { color: theme.heading }]}>NYX</Text>
              <Text style={[styles.brandTagline, { color: theme.textMuted }]}>AUTHENTICATOR</Text>
            </View>
          </View>

          <View style={styles.navActions}>
            <ThemeToggle size={38} />
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login')}
              style={[styles.navSignInBtn, { borderColor: theme.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.navSignInText, { color: theme.primary }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <View style={[styles.heroContainer, isDesktop && styles.heroContainerDesktop]}>
          <View style={[styles.heroTextCol, isDesktop && styles.heroTextColDesktop]}>
            <View style={[styles.pillBadge, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
              <Text style={[styles.pillBadgeText, { color: theme.secondaryText }]}>
                ZERO-KNOWLEDGE AUTHENTICATION
              </Text>
            </View>

            <Text style={[styles.heroHeadline, { color: theme.heading }]}>
              Security that feels effortless.
            </Text>

            <Text style={[styles.heroSubheadline, { color: theme.textMuted }]}>
              Keep your digital accounts protected with a beautifully simple authentication experience.
            </Text>

            <View style={styles.heroCtaGroup}>
              <Button
                title="Get Started"
                size="lg"
                onPress={() => router.push('/(auth)/register')}
                style={styles.ctaPrimary}
              />
              <Button
                title="Sign In"
                size="lg"
                variant="secondary"
                onPress={() => router.push('/(auth)/login')}
                style={styles.ctaSecondary}
              />
            </View>

            <View style={styles.assuranceRow}>
              <View style={styles.assuranceItem}>
                <CheckIcon size={16} color={theme.success} />
                <Text style={[styles.assuranceText, { color: theme.textMuted }]}>
                  AES-256-GCM Vault
                </Text>
              </View>
              <View style={styles.assuranceItem}>
                <CheckIcon size={16} color={theme.success} />
                <Text style={[styles.assuranceText, { color: theme.textMuted }]}>
                  Argon2id Derived
                </Text>
              </View>
              <View style={styles.assuranceItem}>
                <CheckIcon size={16} color={theme.success} />
                <Text style={[styles.assuranceText, { color: theme.textMuted }]}>
                  Offline-First
                </Text>
              </View>
            </View>
          </View>

          {/* Hero Visual Mockup */}
          <View style={[styles.heroVisualCol, isDesktop && styles.heroVisualColDesktop]}>
            <View
              style={[
                styles.mockupContainer,
                {
                  backgroundColor: isDark ? theme.surfaceElevated : '#FFFFFF',
                  borderColor: theme.border,
                },
                Shadows.elevated,
              ]}
            >
              {/* Card Header */}
              <View style={styles.mockupHeader}>
                <View style={styles.mockupBrand}>
                  <View style={[styles.mockupAvatar, { backgroundColor: Palette.lightBeige }]}>
                    <Text style={[styles.mockupAvatarText, { color: Palette.primaryBurgundy }]}>
                      ⌥
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.mockupService, { color: theme.heading }]}>GitHub</Text>
                    <Text style={[styles.mockupAccount, { color: theme.textMuted }]}>
                      alex@nyx.security
                    </Text>
                  </View>
                </View>
                <CountdownCircle remaining={mockTimer} total={30} size={36} />
              </View>

              {/* Mockup OTP Code */}
              <View
                style={[
                  styles.mockupCodeBox,
                  {
                    backgroundColor: theme.codeBoxBg,
                    borderColor: theme.codeBoxBorder,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.mockupCodeLabel, { color: theme.textMuted }]}>
                    ONE-TIME PASSWORD
                  </Text>
                  <Text style={[styles.mockupCode, { color: theme.primary }]}>
                    582 914
                  </Text>
                </View>
                <View style={[styles.mockupCopyPill, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.mockupCopyText, { color: theme.secondaryText }]}>COPY</Text>
                </View>
              </View>

              {/* Security Invariant Micro-Badges */}
              <View style={styles.mockupGuarantees}>
                <View style={[styles.securityTag, { backgroundColor: theme.backgroundSecondary }]}>
                  <ShieldIcon size={13} color={theme.primary} />
                  <Text style={[styles.securityTagText, { color: theme.text }]}>Zero Plaintext Cloud</Text>
                </View>
                <View style={[styles.securityTag, { backgroundColor: theme.backgroundSecondary }]}>
                  <KeyIcon size={13} color={theme.primary} />
                  <Text style={[styles.securityTagText, { color: theme.text }]}>Keystore Gated</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Brand Pillars Section */}
        <View style={styles.featuresSection}>
          <Text style={[styles.featuresSectionTitle, { color: theme.textMuted }]}>
            THE NYX SECURITY PHILOSOPHY
          </Text>

          <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
            <View
              style={[
                styles.featureCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <ShieldIcon size={24} color={theme.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.heading }]}>
                Zero Plaintext Cloud
              </Text>
              <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                All account secrets and TOTP parameters are encrypted on your device using AES-256-GCM before synchronization. The cloud never sees unencrypted keys.
              </Text>
            </View>

            <View
              style={[
                styles.featureCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <KeyIcon size={24} color={theme.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.heading }]}>
                Tri-Factor Key Protection
              </Text>
              <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                Protected by hardware biometric Keystore, Argon2id memory-hard passphrase derivation, and 24-word emergency recovery codes.
              </Text>
            </View>

            <View
              style={[
                styles.featureCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Shadows.subtle,
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: theme.surfaceHighlight }]}>
                <DeviceIcon size={24} color={theme.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.heading }]}>
                Crash-Safe Sync
              </Text>
              <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                HMAC-authenticated mutation journal with automatic backup reconciliation and multi-device atomic synchronization.
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.borderLight }]}>
          <Text style={[styles.footerTagline, { color: theme.textMuted }]}>
            "Your digital security, beautifully simplified."
          </Text>
          <Text style={[styles.footerCopy, { color: theme.textDim }]}>
            NYX Authenticator • Client-Side Authenticated Cryptography
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 42,
    fontWeight: '900',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: 4,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: '#FFF8F2',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: 1.5,
  },
  brandTagline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navSignInBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  navSignInText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  heroContainer: {
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  heroContainerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTextColDesktop: {
    paddingRight: Spacing.xl,
  },
  pillBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    letterSpacing: 0.8,
  },
  heroHeadline: {
    fontSize: 38,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    lineHeight: 46,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  heroSubheadline: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    marginBottom: Spacing.xl,
  },
  heroCtaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  ctaPrimary: {
    minWidth: 160,
  },
  ctaSecondary: {
    minWidth: 130,
  },
  assuranceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  assuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assuranceText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  heroVisualCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualColDesktop: {
    paddingLeft: Spacing.lg,
  },
  mockupContainer: {
    width: '100%',
    maxWidth: 440,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  mockupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mockupBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mockupAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupAvatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  mockupService: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  mockupAccount: {
    fontSize: 13,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  mockupCodeBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mockupCodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mockupCode: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyMono ?? 'monospace',
    fontVariant: ['tabular-nums'],
    letterSpacing: 3,
  },
  mockupCopyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  mockupCopyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mockupGuarantees: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  securityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  securityTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  featuresSection: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  featuresSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  featuresGrid: {
    gap: Spacing.md,
  },
  featuresGridDesktop: {
    flexDirection: 'row',
  },
  featureCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    marginBottom: Spacing.xs,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  footerTagline: {
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  footerCopy: {
    fontSize: 12,
  },
});
