import type { TextStyle } from 'react-native';

/**
 * Design tokens. The visual language is a "modern ledger": warm paper and
 * forest-green ink by day, layered green-black surfaces by night. Screens
 * should read colours from `useTheme()` rather than importing palettes.
 */

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  card: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  primaryText: string;
  secondary: string;
  hero: string;
  onHero: string;
  onHeroMuted: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  divider: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  skeleton: string;
};

const light: Palette = {
  background: '#F4F1EA',
  surface: '#FFFDF9',
  surfaceSecondary: '#ECE7DC',
  surfaceElevated: '#FFFFFF',
  card: '#FFFDF9',
  primary: '#1F4D3A',
  primaryPressed: '#163A2B',
  onPrimary: '#F7F3EA',
  primarySoft: '#E0EBE3',
  primaryText: '#1F553F',
  secondary: '#A94E19',
  hero: '#1F4D3A',
  onHero: '#F7F3EA',
  onHeroMuted: 'rgba(247, 243, 234, 0.72)',
  textPrimary: '#1B1915',
  textSecondary: '#625B51',
  textTertiary: '#756D61',
  border: '#E2DACB',
  borderStrong: '#B3A996',
  divider: '#EAE4D8',
  success: '#2B7049',
  successSoft: '#E0EEE5',
  warning: '#95560C',
  warningSoft: '#F6EAD5',
  error: '#B3261E',
  errorSoft: '#F8E4E1',
  info: '#2A5A87',
  infoSoft: '#E1EAF3',
  overlay: 'rgba(24, 21, 16, 0.45)',
  skeleton: '#E6E0D4',
};

const dark: Palette = {
  background: '#0F1311',
  surface: '#161B18',
  surfaceSecondary: '#1E2521',
  surfaceElevated: '#1D2320',
  card: '#161B18',
  primary: '#8ACBA6',
  primaryPressed: '#73B892',
  onPrimary: '#0A1F14',
  primarySoft: '#1B3127',
  primaryText: '#8ACBA6',
  secondary: '#E3905D',
  hero: '#18291F',
  onHero: '#ECEFEA',
  onHeroMuted: 'rgba(236, 239, 234, 0.66)',
  textPrimary: '#ECEFEA',
  textSecondary: '#A2ABA4',
  textTertiary: '#858E87',
  border: '#27302B',
  borderStrong: '#46524B',
  divider: '#212924',
  success: '#7CC79A',
  successSoft: '#19301F',
  warning: '#E2AA5B',
  warningSoft: '#33281A',
  error: '#F08B81',
  errorSoft: '#3A1F1C',
  info: '#8AB6E0',
  infoSoft: '#1A2733',
  overlay: 'rgba(0, 0, 0, 0.62)',
  skeleton: '#202824',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/** 4pt spacing scale. Keys are multiples of 4: space[4] === 16. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 24,
  pill: 999,
} as const;

export const layout = {
  gutter: space[5],
  maxContentWidth: 680,
  minTouchTarget: 44,
  controlHeight: 50,
} as const;

type TypeStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'>;

export const typography = {
  display: { fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1 },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodyMedium: { fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: 0 },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.1 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.1 },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
} as const satisfies Record<string, TypeStyle>;

export type TypographyVariant = keyof typeof typography;

export type ElevationLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Surface contrast does most of the work; shadows are reserved for things that
 * genuinely float (sheets, toasts, selected segments).
 */
const elevations: Record<ColorScheme, Record<ElevationLevel, string>> = {
  light: {
    none: 'none',
    low: '0px 1px 2px rgba(40, 32, 20, 0.06)',
    medium: '0px 6px 20px rgba(40, 32, 20, 0.10)',
    high: '0px 16px 40px rgba(40, 32, 20, 0.18)',
  },
  dark: {
    none: 'none',
    low: '0px 1px 2px rgba(0, 0, 0, 0.30)',
    medium: '0px 8px 24px rgba(0, 0, 0, 0.45)',
    high: '0px 18px 44px rgba(0, 0, 0, 0.60)',
  },
};

export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
} as const;

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  elevation: Record<ElevationLevel, string>;
};

export const themes: Record<ColorScheme, Theme> = {
  light: { scheme: 'light', colors: light, elevation: elevations.light },
  dark: { scheme: 'dark', colors: dark, elevation: elevations.dark },
};
