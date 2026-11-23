import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Radius, Spacing } from './tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...rest }) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={Colors.textDim}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
});
