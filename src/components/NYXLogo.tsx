import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Typography, Radius, Palette } from './tokens';

interface NYXLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  centered?: boolean;
}

export const NYXLogo: React.FC<NYXLogoProps> = ({
  size = 'md',
  showTagline = false,
  centered = false,
}) => {
  const { theme, isDark } = useTheme();

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { boxSize: 32, iconFont: 16, titleFont: 18, subFont: 8, spacing: 6 };
      case 'lg':
        return { boxSize: 48, iconFont: 26, titleFont: 26, subFont: 10, spacing: 10 };
      case 'xl':
        return { boxSize: 64, iconFont: 36, titleFont: 36, subFont: 12, spacing: 12 };
      case 'md':
      default:
        return { boxSize: 38, iconFont: 20, titleFont: 22, subFont: 9, spacing: 8 };
    }
  };

  const dim = getDimensions();

  return (
    <View style={[styles.container, centered && styles.centered]}>
      <View style={[styles.logoRow, centered && styles.centeredRow]}>
        <View
          style={[
            styles.monogramBox,
            {
              width: dim.boxSize,
              height: dim.boxSize,
              borderRadius: Radius.md,
              backgroundColor: isDark ? Palette.primaryBurgundy : Palette.primaryBurgundy,
              borderColor: Palette.lightBeige,
            },
          ]}
        >
          <Text
            style={[
              styles.monogramText,
              {
                fontSize: dim.iconFont,
                color: '#FFF8F2',
                fontFamily: Typography.fontFamilyHeading,
              },
            ]}
          >
            N
          </Text>
        </View>

        <View style={{ marginLeft: dim.spacing }}>
          <Text
            style={[
              styles.brandName,
              {
                fontSize: dim.titleFont,
                color: theme.heading,
                fontFamily: Typography.fontFamilyHeading,
              },
            ]}
          >
            NYX
          </Text>
          <Text
            style={[
              styles.subName,
              {
                fontSize: dim.subFont,
                color: theme.textMuted,
                fontFamily: Typography.fontFamilyBody,
              },
            ]}
          >
            AUTHENTICATOR
          </Text>
        </View>
      </View>

      {showTagline && (
        <Text
          style={[
            styles.tagline,
            {
              color: theme.textMuted,
              fontFamily: Typography.fontFamilyHeading,
              textAlign: centered ? 'center' : 'left',
            },
          ]}
        >
          "Your digital security, beautifully simplified."
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centeredRow: {
    justifyContent: 'center',
  },
  monogramBox: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontWeight: '800',
  },
  brandName: {
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: undefined,
  },
  subName: {
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
});
