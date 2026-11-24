import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../store/themeStore';
import { CheckIcon } from './Icons';
import { Radius, Spacing, Typography, Shadows, Palette } from './tokens';

interface ToastNotificationProps {
  message: string | null;
  type?: 'success' | 'info' | 'error';
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type = 'success',
}) => {
  const { theme } = useTheme();

  if (!message) return null;

  const isError = type === 'error';

  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: isError ? theme.danger : theme.primary,
          borderColor: Palette.lightBeige,
        },
        Shadows.elevated,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: Palette.lightBeige }]}>
        <CheckIcon size={12} color={Palette.primaryBurgundy} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 8,
    maxWidth: '90%',
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFF8F2',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.fontFamilyBody,
  },
});
