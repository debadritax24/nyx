import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useTheme } from '../../src/store/themeStore';
import { AuthService } from '../../src/services/auth';
import { Radius, Spacing, Typography } from '../../src/components/tokens';

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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.backLink, { color: theme.primary }]}>← Back to Sign In</Text>
          </TouchableOpacity>
          <ThemeToggle size={38} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.heading }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Enter your account email to receive cryptographic password reset instructions.
          </Text>

          {sent ? (
            <View style={[styles.sentBox, { backgroundColor: theme.surfaceHighlight }]}>
              <Text style={[styles.sentTitle, { color: theme.heading }]}>Recovery Dispatched</Text>
              <Text style={[styles.sentDesc, { color: theme.text }]}>
                If an account exists for {email}, a recovery link has been sent to your inbox.
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
                label="Email Address"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backLink: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.sm,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  sentBox: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Typography?.fontFamilyHeading ?? 'serif',
  },
  sentDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  returnBtn: {
    marginTop: Spacing.sm,
  },
});
