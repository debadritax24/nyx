import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { NYXLogo } from '../../src/components/NYXLogo';
import { CheckIcon, ShieldIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Mobile Bar: Theme Toggle */}
          <View style={styles.topBar}>
            <View style={styles.securityPill}>
              <ShieldIcon size={12} color={theme.primary} />
              <Text style={[styles.securityPillText, { color: theme.primary }]}>
                CLIENT-SIDE ENCRYPTED
              </Text>
            </View>
            <ThemeToggle size={38} />
          </View>

          {/* Hero Branding Section */}
          <View style={styles.brandHero}>
            <NYXLogo size="lg" centered />
            <Text style={[styles.title, { color: theme.heading }]}>Welcome back.</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
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

          {/* Form Card */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              Shadows.card,
            ]}
          >
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

            {/* Remember Me & Forgot Password */}
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

            {/* Sign In Button */}
            <Button
              title="Sign In"
              size="lg"
              onPress={handleLogin}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.footerLink, { color: theme.primary }]}>
                Create an account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(89, 23, 27, 0.08)',
  },
  securityPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginTop: Spacing.md,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: Typography.fontFamilyBody,
    textAlign: 'center',
    lineHeight: 20,
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
    fontFamily: Typography.fontFamilyBody,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
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
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  submitBtn: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  footerText: {
    fontSize: 14,
    fontFamily: Typography.fontFamilyBody,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyBody,
  },
});
