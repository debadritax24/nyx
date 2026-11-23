import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, Spacing } from './tokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return Colors.cardBorder;
    switch (variant) {
      case 'secondary':
        return Colors.cardBackground;
      case 'danger':
        return Colors.danger;
      case 'outline':
        return 'transparent';
      case 'primary':
      default:
        return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textDim;
    switch (variant) {
      case 'outline':
        return Colors.primary;
      case 'secondary':
        return Colors.text;
      case 'primary':
        return '#000000';
      default:
        return Colors.text;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.outlineBorder,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  outlineBorder: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
