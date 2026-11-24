import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette, Radius, Typography } from './tokens';

interface BrandIconProps {
  issuer?: string;
  size?: number;
}

export const BrandIcon: React.FC<BrandIconProps> = ({ issuer = '', size = 44 }) => {
  const norm = (issuer || '').trim().toLowerCase();

  const getBrandDetails = () => {
    if (norm.includes('google')) {
      return {
        symbol: 'G',
        bg: '#FED7B8',
        color: '#59171B',
        isSerif: true,
      };
    }
    if (norm.includes('github')) {
      return {
        symbol: '⌥',
        bg: '#59171B',
        color: '#FFF8F2',
        isSerif: false,
      };
    }
    if (norm.includes('microsoft') || norm.includes('azure') || norm.includes('outlook')) {
      return {
        symbol: '⊞',
        bg: '#F5E8DE',
        color: '#3D1015',
        isSerif: false,
      };
    }
    if (norm.includes('amazon') || norm.includes('aws')) {
      return {
        symbol: 'a',
        bg: '#FED7B8',
        color: '#3D1015',
        isSerif: true,
      };
    }
    if (norm.includes('apple')) {
      return {
        symbol: '',
        bg: '#3D1015',
        color: '#FFF8F2',
        isSerif: false,
      };
    }
    if (norm.includes('discord')) {
      return {
        symbol: '⌘',
        bg: '#F5E8DE',
        color: '#59171B',
        isSerif: false,
      };
    }
    if (norm.includes('slack')) {
      return {
        symbol: '#',
        bg: '#FED7B8',
        color: '#59171B',
        isSerif: true,
      };
    }
    if (norm.includes('dropbox')) {
      return {
        symbol: '◇',
        bg: '#F5E8DE',
        color: '#382528',
        isSerif: false,
      };
    }
    if (norm.includes('twitter') || norm.includes(' x')) {
      return {
        symbol: '𝕏',
        bg: '#382528',
        color: '#FFF8F2',
        isSerif: false,
      };
    }

    // Default monogram initial
    const initial = norm ? norm.charAt(0).toUpperCase() : '✦';
    return {
      symbol: initial,
      bg: '#F5E8DE',
      color: '#59171B',
      isSerif: true,
    };
  };

  const brand = getBrandDetails();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          backgroundColor: brand.bg,
          borderColor: Palette.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: brand.color,
            fontSize: size * 0.48,
            fontFamily: brand.isSerif ? Typography.fontFamilyHeading : Typography.fontFamilyBody,
          },
        ]}
      >
        {brand.symbol}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
