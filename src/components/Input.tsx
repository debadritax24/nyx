import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { EyeIcon, EyeOffIcon } from './Icons';
import { Radius, Spacing, Typography } from './tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  rightElement,
  secureTextEntry,
  style,
  ...rest
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const isPasswordInput = secureTextEntry !== undefined;
  const actualSecure = isPasswordInput ? !showPassword : secureTextEntry;

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.inputBackground,
            borderColor: error
              ? theme.danger
              : isFocused
              ? theme.primary
              : theme.inputBorder,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={theme.textDim}
          accessibilityLabel={label || rest.placeholder}
          secureTextEntry={actualSecure}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur && rest.onBlur(e);
          }}
          style={[
            styles.input,
            {
              color: theme.text,
              fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
            },
            style,
          ]}
          {...rest}
        />

        {isPasswordInput && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.eyeBtn}
          >
            {showPassword ? (
              <EyeOffIcon size={18} color={theme.textMuted} />
            ) : (
              <EyeIcon size={18} color={theme.textMuted} />
            )}
          </TouchableOpacity>
        )}

        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hintText, { color: theme.textDim }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
    letterSpacing: 0.2,
  },
  inputWrapper: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: Spacing.xs,
  },
  rightElement: {
    marginLeft: Spacing.xs,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
  hintText: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: Typography?.fontFamilyBody ?? 'sans-serif',
  },
});
