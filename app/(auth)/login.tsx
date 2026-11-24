import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { ShieldIcon, CheckIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography, Shadows, Palette } from '../../src/components/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { theme, isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.signIn(email.trim(), password);
      router.replace('/(app)');
    } catch (err: any) {
      setErrorMessage(err.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.pageWrapper, isDesktop && styles.pageWrapperDesktop]}>
        {/* DESKTOP LEFT SIDE: Editorial & Security Showcase */}
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
                  CLIENT-SIDE ENCRYPTION
                </Text>
              </View>

              <Text style={[styles.showcaseHeading, { color: isDark ? theme.heading : Palette.primaryBurgundy }]}>
                Welcome back.
              </Text>

              <Text style={[styles.showcaseSubtitle, { color: theme.textMuted }]}>
                Your accounts, your security, all in one place. Every credential stays wrapped in hardware-backed local storage.
              </Text>

              {/* Security Invariants Graphic */}
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
                  <ShieldIcon size={20} color={Palette.primaryBurgundy} />
                  <Text style={[styles.graphicTitle, { color: theme.heading }]}>
                    Zero Plaintext Architecture
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    AES-256-GCM authenticated vault envelopes
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    Memory-hard Argon2id master key derivation
                  </Text>
                </View>

                <View style={styles.graphicItem}>
                  <CheckIcon size={16} color={theme.success} />
                  <Text style={[styles.graphicItemText, { color: theme.text }]}>
                    Hardware Android Keystore biometric protection
                  </Text>
                </View>
              </View>
            </View>

            {/* Quote / Footer */}
            <View style={styles.showcaseFooter}>
              <Text style={[styles.showcaseQuote, { color: theme.textMuted }]}>
                "Your digital security, beautifully simplified."
              </Text>
            </View>
          </View>
        )}

        {/* RIGHT SIDE: Minimal & Elegant Form */}
        <View style={styles.formColumn}>
          <ScrollView
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Actions: Mobile Logo + Theme Toggle */}
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
                Welcome back.
              </Text>
              <Text style={[styles.formSubtitle, { color: theme.textMuted }]}>
                Your accounts, your security, all in one place.
              </Text>
            </View>

            {/* Error Notification Banner */}
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
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              {/* Remember Me & Forgot Password Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.checkboxRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: rememberMe ? theme.primary : theme.border,
                        backgroundColor: rememberMe ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {rememberMe && <CheckIcon size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.textMuted }]}>
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/reset-password')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.forgotLink, { color: theme.primary }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <Button
                title="Sign In"
                size="lg"
                onPress={handleLogin}
                loading={loading}
                style={styles.submitBtn}
              />
            </View>

            {/* Footer Navigation */}
            <View style={styles.authFooter}>
              <Text style={[styles.authFooterText, { color: theme.textMuted }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={[styles.authFooterLink, { color: theme.primary }]}>
                  Create an account
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
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.xl,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: Spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 13,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  submitBtn: {
    marginTop: Spacing.xs,
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
