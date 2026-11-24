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
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography, Shadows } from '../../src/components/tokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your account email.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Unable to dispatch recovery instructions.');
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
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={[styles.backLink, { color: theme.primary }]}>← Back</Text>
            </TouchableOpacity>
            <ThemeToggle size={38} />
          </View>

          {/* Hero Branding */}
          <View style={styles.brandHero}>
            <NYXLogo size="md" centered />
            <Text style={[styles.title, { color: theme.heading }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Enter your email to receive cryptographic password reset instructions.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Shadows.card,
            ]}
          >
            {sent ? (
              <View style={[styles.sentBox, { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={[styles.sentTitle, { color: theme.heading }]}>
                  Recovery Dispatched
                </Text>
                <Text style={[styles.sentDesc, { color: theme.text }]}>
                  If an account exists for {email}, recovery instructions have been sent.
                </Text>
                <Button
                  title="Return to Sign In"
                  onPress={() => router.replace('/(auth)/login')}
                  style={styles.returnBtn}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Input
                  label="Account Email"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Button
                  title="Send Recovery Link"
                  size="lg"
                  onPress={handleReset}
                  loading={loading}
                  style={styles.submitBtn}
                />
              </View>
            )}
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
  backLink: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography.fontFamilyHeading,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Typography.fontFamilyBody,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  form: {
    gap: Spacing.sm,
  },
  submitBtn: {
    marginTop: Spacing.xs,
    width: '100%',
  },
  sentBox: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyHeading,
  },
  sentDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Typography.fontFamilyBody,
  },
  returnBtn: {
    marginTop: Spacing.sm,
  },
});
