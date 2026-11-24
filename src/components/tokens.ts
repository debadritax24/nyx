import { Platform } from 'react-native';

/**
 * NYX Exact Brand Colour Palette
 * Primary Burgundy: #59171B
 * Light Beige: #FED7B8
 * Cream Background: #FFF8F2
 * Secondary Beige: #F5E8DE
 * Dark Burgundy: #3D1015
 * Primary Text: #382528
 * Muted Text: #907B76
 * Border: #E8D5C8
 * White: #FFFFFF
 */
export const Palette = {
  primaryBurgundy: '#59171B',
  lightBeige: '#FED7B8',
  creamBackground: '#FFF8F2',
  secondaryBeige: '#F5E8DE',
  darkBurgundy: '#3D1015',
  primaryText: '#382528',
  mutedText: '#907B76',
  border: '#E8D5C8',
  white: '#FFFFFF',

  // Dark Mode Surfaces & Highlights
  darkBg: '#180709',
  darkSurface: '#290B0F',
  darkSurfaceElevated: '#3D1015',
  darkBorder: '#522026',
  darkText: '#FFF8F2',
  darkTextMuted: '#C2A59F',
  darkTextDim: '#8A706B',

  // Status Colors (tuned to harmonize with burgundy/beige)
  success: '#2E7D32',
  successMuted: 'rgba(46, 125, 50, 0.12)',
  warning: '#B45309',
  warningMuted: 'rgba(180, 83, 9, 0.12)',
  danger: '#991B1B',
  dangerMuted: 'rgba(153, 27, 27, 0.12)',
  dangerDark: '#EF5350',
};

export interface ThemeColors {
  isDark: boolean;
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  text: string;
  textMuted: string;
  textDim: string;
  heading: string;
  border: string;
  borderLight: string;
  cardBackground: string;
  cardBackgroundAlt: string;
  cardBorder: string;
  inputBackground: string;
  inputBorder: string;
  codeBoxBg: string;
  codeBoxBorder: string;
  badgeBg: string;
  badgeText: string;
  accent: string;
  danger: string;
  dangerMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
}

export const lightTheme: ThemeColors = {
  isDark: false,
  background: Palette.creamBackground, // #FFF8F2
  backgroundSecondary: Palette.secondaryBeige, // #F5E8DE
  surface: Palette.white,
  surfaceElevated: Palette.white,
  surfaceHighlight: Palette.lightBeige, // #FED7B8
  primary: Palette.primaryBurgundy, // #59171B
  primaryHover: Palette.darkBurgundy,
  primaryText: Palette.white,
  secondary: Palette.lightBeige, // #FED7B8
  secondaryText: Palette.darkBurgundy, // #3D1015
  text: Palette.primaryText, // #382528
  textMuted: Palette.mutedText, // #907B76
  textDim: '#B29F9A',
  heading: Palette.primaryBurgundy,
  border: Palette.border, // #E8D5C8
  borderLight: '#F3E5DC',
  cardBackground: Palette.white,
  cardBackgroundAlt: Palette.secondaryBeige,
  cardBorder: Palette.border,
  inputBackground: Palette.white,
  inputBorder: Palette.border,
  codeBoxBg: Palette.secondaryBeige,
  codeBoxBorder: Palette.border,
  badgeBg: Palette.lightBeige,
  badgeText: Palette.darkBurgundy,
  accent: Palette.lightBeige,
  danger: Palette.danger,
  dangerMuted: Palette.dangerMuted,
  success: Palette.success,
  successMuted: Palette.successMuted,
  warning: Palette.warning,
  warningMuted: Palette.warningMuted,
};

export const darkTheme: ThemeColors = {
  isDark: true,
  background: Palette.darkBg, // #180709
  backgroundSecondary: Palette.darkSurface, // #290B0F
  surface: Palette.darkSurface,
  surfaceElevated: Palette.darkSurfaceElevated, // #3D1015
  surfaceHighlight: '#4E161C',
  primary: Palette.primaryBurgundy, // Deep burgundy
  primaryHover: '#732228',
  primaryText: Palette.white,
  secondary: Palette.darkSurfaceElevated,
  secondaryText: Palette.lightBeige,
  text: Palette.darkText, // #FFF8F2
  textMuted: Palette.darkTextMuted, // #C2A59F
  textDim: Palette.darkTextDim,
  heading: Palette.lightBeige, // Light beige on dark surfaces
  border: Palette.darkBorder, // #522026
  borderLight: '#3D151A',
  cardBackground: Palette.darkSurface,
  cardBackgroundAlt: Palette.darkSurfaceElevated,
  cardBorder: Palette.darkBorder,
  inputBackground: '#1D080A',
  inputBorder: Palette.darkBorder,
  codeBoxBg: '#150507',
  codeBoxBorder: Palette.darkBorder,
  badgeBg: Palette.darkSurfaceElevated,
  badgeText: Palette.lightBeige,
  accent: Palette.lightBeige,
  danger: Palette.dangerDark,
  dangerMuted: 'rgba(239, 83, 80, 0.2)',
  success: '#66BB6A',
  successMuted: 'rgba(102, 187, 106, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
};

/**
 * Backward compatibility export for legacy references
 */
export const Colors = lightTheme;

export const Typography = {
  fontFamilyHeading: Platform.select({
    web: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
  fontFamilyBody: Platform.select({
    web: "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  fontFamilyMono: Platform.select({
    web: "'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace",
    ios: 'Courier New',
    android: 'monospace',
    default: 'monospace',
  }),
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  subtle: Platform.select({
    web: {
      boxShadow: '0 2px 8px rgba(56, 37, 40, 0.05)',
    },
    default: {
      elevation: 1,
      shadowColor: '#382528',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
  }),
  card: Platform.select({
    web: {
      boxShadow: '0 4px 16px rgba(56, 37, 40, 0.07)',
    },
    default: {
      elevation: 2,
      shadowColor: '#382528',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
  }),
  elevated: Platform.select({
    web: {
      boxShadow: '0 8px 30px rgba(56, 37, 40, 0.12)',
    },
    default: {
      elevation: 4,
      shadowColor: '#382528',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
  }),
};
