import { StyleSheet } from 'react-native';

export const COLORS = {
  // Updated palette matching reference design system
  bg: '#0A0A0B',
  bgCard: '#18181B',
  bgCardHover: '#1C1C1F',
  surface: '#18181B',
  surfaceAlt: '#1C1C1F',
  border: '#27272A',
  borderAccent: '#3F3F46',

  // Brand — orange accent (was cyan)
  accent: '#F97316',
  accentDim: '#EA6C0A',
  cyan: '#F97316',        // Alias for backward compat
  cyanDim: '#EA6C0A',     // Alias for backward compat
  lime: '#4ADE80',        // Updated green
  limeDim: '#22C55E',
  purple: '#A78BFA',
  purpleLight: '#C4B5FD',

  // Status
  success: '#4ADE80',
  warning: '#FCD34D',
  danger: '#F87171',
  info: '#3B82F6',

  // Text
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',
  textInverse: '#0A0A0B',
};

export const FONTS = {
  // Typography system
  mono: 'IBMPlexMono',
  display: 'BebasNeue',
  body: 'Outfit',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textDisplay: {
    fontFamily: FONTS.display,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  textMono: {
    fontFamily: FONTS.mono,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  textBody: {
    fontFamily: FONTS.body,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  labelAccent: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  labelCyan: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  labelLime: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.lime,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});
