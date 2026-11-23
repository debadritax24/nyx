import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Spacing } from '../../src/components/tokens';
import { AuthService } from '../../src/services/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Validation Error', 'Please enter your account email.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.resetPassword(email.trim());
      Alert.alert(
        'Password Reset Sent',
        'If an account exists with this email, a reset link has been dispatched.',
        [{ text: 'Back to Login', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email to receive recovery instructions</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email Address"
          placeholder="user@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Button title="Send Reset Link" onPress={handleReset} loading={loading} style={styles.submitBtn} />
      </View>

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
        <Text style={styles.backLink}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  form: {
    marginBottom: Spacing.lg,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  backLink: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
  },
});
