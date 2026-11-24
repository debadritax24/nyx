import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../store/themeStore';
import { SunIcon, MoonIcon } from './Icons';
import { Radius } from './tokens';

interface ThemeToggleProps {
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 40 }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: Radius.full,
          backgroundColor: theme.surfaceHighlight,
          borderColor: theme.border,
        },
      ]}
    >
      {isDark ? (
        <SunIcon size={size * 0.52} color={theme.text} />
      ) : (
        <MoonIcon size={size * 0.52} color={theme.primary} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
