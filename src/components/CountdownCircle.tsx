import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from './tokens';

interface CountdownCircleProps {
  remaining: number;
  total?: number;
  size?: number;
}

export const CountdownCircle: React.FC<CountdownCircleProps> = ({
  remaining,
  size = 36,
}) => {
  const isUrgent = remaining <= 5;
  const color = isUrgent ? Colors.danger : Colors.primary;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.text, { color }]}>{remaining}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});
