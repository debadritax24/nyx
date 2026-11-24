import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { KeyIcon, CheckIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { theme, isDark } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.signUp(email.trim(), password, displayName.trim());
      Alert.alert(
        'Account Initialized',
        'Your NYX cryptographic identity has been established. Please sign in.',
        [{ text: 'Sign In Now', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.pageWrapper, isDesktop && styles.pageWrapperDesktop]}>
        {/* DESKTOP LEFT SIDE: Editorial & Brand Philosophy */}
        {isDesktop && (
          <View
            style={[
              styles.showcaseColumn,
              {
                backgroundColor: isDark ? '#260B0E' : Palette.secondaryBeige,
                borderRightColor: theme.border,
              },
            ]}
          >
            {/* Top Logo */}
            <View style={styles.brandRow}>
              <View style={[styles.brandLogoBox, { backgroundColor: Palette.primaryBurgundy }]}>
                <Text style={styles.brandLogoText}>N</Text>
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: isDark ? theme.heading : Palette.primaryBurgundy }]}>
                  NYX
                </Text>
                <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
                  SECURITY PRODUCT
                </Text>
              </View>
            </View>

            {/* Editorial Showcase Center */}
            <View style={styles.showcaseCenter}>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: isDark ? theme.surfaceElevated : Palette.lightBeige },
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    { color: isDark ? theme.heading : Palette.darkBurgundy },
                  ]}
                >
                  NEW IDENTITY SETUP
                </Text>
              </View>

              <Text style={[styles.showcaseHeading, { color: isDark ? theme.heading : Palette.primaryBurgundy }]}>
                Create your account.
              </Text>

              <Text style={[styles.showcaseSubtitle, { color: theme.textMuted }]}>
                Experience offline-first authentication with zero plaintext cloud exposure. Your secrets are always sealed before they leave your device.
              </Text>

              {/* Guarantees Box */}
              <View
                style={[
                  styles.graphicCard,
                  {
                    backgroundColor: isDark ? theme.surfaceElevated : '#FFFFFF',
                    borderColor: theme.border,
                  },
                  Shadows.card,
                ]}
              >
                <View style={styles.graphicHeader}>
                  <KeyIcon size={20} color={Palette.primaryBurgundy} />
                  <Text style={[styles.graphicTitle, { color: theme.heading }]}>
                    Zero-Knowledge Invariants
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    Unique 256-bit symmetric Vault Key per user
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    24-word high-entropy offline recovery code
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    Multi-device encrypted synchronization
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer Tagline */}
            <View style={styles.showcaseFooter}>
              <Text style={[styles.showcaseQuote, { color: theme.textMuted }]}>
                "Your digital security, beautifully simplified."
              </Text>
            </View>
          </View>
        )}

        {/* RIGHT SIDE: Minimal Registration Form */}
        <View style={styles.formColumn}>
          <ScrollView
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Navigation Bar */}
            <View style={styles.formTopBar}>
              {!isDesktop ? (
                <View style={styles.mobileBrand}>
                  <View
                    style={[styles.mobileLogoBox, { backgroundColor: Palette.primaryBurgundy }]}
                  >
                    <Text style={styles.mobileLogoText}>N</Text>
                  </View>
                  <Text style={[styles.mobileBrandText, { color: theme.heading }]}>NYX</Text>
                </View>
              ) : (
                <View />
              )}
              <ThemeToggle size={38} />
            </View>

            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: theme.heading }]}>
                Create your account.
              </Text>
              <Text style={[styles.formSubtitle, { color: theme.textMuted }]}>
                Initialize your client-side encrypted authenticator.
              </Text>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.dangerMuted,
                    borderColor: theme.danger,
                  },
                ]}
              >
                <Text style={[styles.errorBannerText, { color: theme.danger }]}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              <Input
                label="Full Name (Optional)"
                placeholder="Alex Morgan"
                value={displayName}
                onChangeText={setDisplayName}
              />

              <Input
                label="Email Address"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Input
                label="Password"
                placeholder="At least 8 characters"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Input
                label="Confirm Password"
                placeholder="Re-enter password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              {/* Submit CTA */}
              <Button
                title="Create Account"
                size="lg"
                onPress={handleRegister}
                loading={loading}
                style={styles.submitBtn}
              />
            </View>

            {/* Footer Navigation */}
            <View style={styles.authFooter}>
              <Text style={[styles.authFooterText, { color: theme.textMuted }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={[styles.authFooterLink, { color: theme.primary }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
  pageWrapperDesktop: {
    flexDirection: 'row',
  },
  showcaseColumn: {
    flex: 1.1,
    padding: Spacing.xxl,
    justifyContent: 'space-between',
    borderRightWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandLogoBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
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
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  showcaseCenter: {
    maxWidth: 460,
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  showcaseHeading: {
    fontSize: 42,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    lineHeight: 48,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  showcaseSubtitle: {
    fontSize: 16,
    lineHeight: 25,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    marginBottom: Spacing.xl,
  },
  graphicCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  graphicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 6,
  },
  graphicTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  graphicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  graphicItemText: {
    fontSize: 13,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  showcaseFooter: {
    paddingTop: Spacing.md,
  },
  showcaseQuote: {
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  formColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  formScroll: {
    padding: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  formTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  mobileLogoBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoText: {
    color: '#FFF8F2',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  mobileBrandText: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: 1.5,
  },
  formHeader: {
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 15,
    marginTop: 6,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    lineHeight: 22,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  fieldsContainer: {
    marginBottom: Spacing.lg,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authFooterText: {
    fontSize: 14,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  authFooterLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
});
