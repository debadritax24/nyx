import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
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
import { KeyIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar: Security Pill + Theme Toggle */}
          <View style={styles.topBar}>
            <View style={styles.securityPill}>
              <KeyIcon size={12} color={theme.primary} />
              <Text style={[styles.securityPillText, { color: theme.primary }]}>
                NEW IDENTITY SETUP
              </Text>
            </View>
            <ThemeToggle size={38} />
          </View>

          {/* Brand Hero */}
          <View style={styles.brandHero}>
            <NYXLogo size="lg" centered />
            <Text style={[styles.title, { color: theme.heading }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
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

          {/* Registration Form Card */}
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

            <Button
              title="Create Account"
              size="lg"
              onPress={handleRegister}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.footerLink, { color: theme.primary }]}>Sign In</Text>
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
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.lg,
  },
  submitBtn: {
    marginTop: Spacing.sm,
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
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyBody,
  },
});
