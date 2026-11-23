import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Spacing } from '../../src/components/tokens';
import { isValidBase32, sanitizeBase32 } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';

export default function AddManualScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);

  const [issuer, setIssuer] = useState('');
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!issuer.trim() || !accountName.trim() || !secret.trim()) {
      Alert.alert('Validation Error', 'Issuer, account name, and secret key are required.');
      return;
    }

    const sanitizedSecret = sanitizeBase32(secret);
    if (!isValidBase32(sanitizedSecret)) {
      Alert.alert('Invalid Secret Key', 'The secret must be a valid Base32 string (letters A-Z and digits 2-7).');
      return;
    }

    try {
      setLoading(true);
      await addAccount({
        issuer: issuer.trim(),
        account_name: accountName.trim(),
        secret: sanitizedSecret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      Alert.alert('Success', 'Authenticator account created successfully.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not save account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manual Account Entry</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Input
          label="Issuer / Service"
          placeholder="e.g. GitHub, AWS, Google"
          value={issuer}
          onChangeText={setIssuer}
        />

        <Input
          label="Account Username or Email"
          placeholder="e.g. alex@example.com"
          value={accountName}
          onChangeText={setAccountName}
          autoCapitalize="none"
        />

        <Input
          label="Secret Key (Base32)"
          placeholder="e.g. JBSWY3DPEHPK3PXP"
          value={secret}
          onChangeText={setSecret}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Button title="Save Account" onPress={handleSave} loading={loading} style={styles.saveBtn} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeText: {
    color: Colors.primary,
    fontSize: 15,
  },
  form: {
    paddingBottom: Spacing.xl,
  },
  saveBtn: {
    marginTop: Spacing.md,
  },
});
