import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, Spacing, Radius } from '../../src/components/tokens';
import { isValidBase32, sanitizeBase32, HashAlgorithm } from '../../src/core/totp';
import { useVaultStore } from '../../src/store/vaultStore';

export default function AddManualScreen() {
  const router = useRouter();
  const addAccount = useVaultStore((state) => state.addAccount);

  const [issuer, setIssuer] = useState('');
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA1');
  const [digits, setDigits] = useState<number>(6);
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!issuer.trim() || !accountName.trim() || !secret.trim()) {
      Alert.alert('Validation Error', 'Issuer, account name, and secret key are required.');
      return;
    }

    const sanitizedSecret = sanitizeBase32(secret);
    if (!isValidBase32(sanitizedSecret)) {
      Alert.alert(
        'Invalid Secret Key',
        'The secret must be a valid Base32 string (letters A-Z and digits 2-7).'
      );
      return;
    }

    try {
      setLoading(true);
      await addAccount({
        issuer: issuer.trim(),
        account_name: accountName.trim(),
        secret: sanitizedSecret,
        algorithm,
        digits,
        period,
      });

      Alert.alert('Success', 'Authenticator account created and encrypted.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: any) {
      Alert.alert('Failed to Add Account', err.message || 'Could not save account.');
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

        <Text style={styles.selectorLabel}>Algorithm</Text>
        <View style={styles.algoRow}>
          {(['SHA1', 'SHA256', 'SHA512'] as HashAlgorithm[]).map((algo) => (
            <TouchableOpacity
              key={algo}
              onPress={() => setAlgorithm(algo)}
              style={[styles.algoBtn, algorithm === algo && styles.algoBtnSelected]}
            >
              <Text style={[styles.algoText, algorithm === algo && styles.algoTextSelected]}>
                {algo}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.selectorLabel}>Code Digits</Text>
        <View style={styles.algoRow}>
          {[6, 8].map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => setDigits(num)}
              style={[styles.algoBtn, digits === num && styles.algoBtnSelected]}
            >
              <Text style={[styles.algoText, digits === num && styles.algoTextSelected]}>
                {num} Digits
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.selectorLabel}>Interval / Period</Text>
        <View style={styles.algoRow}>
          {[30, 60].map((sec) => (
            <TouchableOpacity
              key={sec}
              onPress={() => setPeriod(sec)}
              style={[styles.algoBtn, period === sec && styles.algoBtnSelected]}
            >
              <Text style={[styles.algoText, period === sec && styles.algoTextSelected]}>
                {sec} Seconds
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Encrypt & Save Account"
          onPress={handleSave}
          loading={loading}
          style={styles.saveBtn}
        />
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
  selectorLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  algoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  algoBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  algoBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  algoText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  algoTextSelected: {
    color: Colors.primary,
  },
  saveBtn: {
    marginTop: Spacing.lg,
  },
});
