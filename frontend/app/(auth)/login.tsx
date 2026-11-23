import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Spacing } from '../../src/components/tokens';
import { AuthService } from '../../src/services/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.signIn(email.trim(), password);
      router.replace('/(app)');
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>NYX</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to sync your encrypted vault across devices</Text>
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

        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button title="Sign In" onPress={handleLogin} loading={loading} style={styles.submitBtn} />

        <TouchableOpacity onPress={() => router.push('/(auth)/reset-password')}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.footerLink}>Register</Text>
        </TouchableOpacity>
      </View>
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
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.xl,
  },
  submitBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
