import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Typography } from './tokens';

interface CountdownCircleProps {
  remaining: number;
  total?: number;
  size?: number;
}

export const CountdownCircle: React.FC<CountdownCircleProps> = ({
  remaining,
  size = 38,
}) => {
  const { theme, isDark } = useTheme();
  const isUrgent = remaining <= 5;

  const strokeColor = isUrgent ? theme.danger : isDark ? theme.heading : theme.primary;
  const bgColor = isUrgent
    ? theme.dangerMuted
    : isDark
    ? 'rgba(254, 215, 184, 0.08)'
    : 'rgba(89, 23, 27, 0.06)';

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: strokeColor,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: strokeColor,
            fontFamily: Typography.fontFamilyMono,
            fontSize: size * 0.36,
          },
        ]}
      >
        {remaining}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
