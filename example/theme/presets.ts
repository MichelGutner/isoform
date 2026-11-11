import { updateTheme } from 'omnistyle';

export type Mode = 'light' | 'dark';
export type Density = 'compact' | 'comfortable';

/** Chaves extras além das declaradas em `EngineTheme` (global.d.ts). */
export type Palette = EngineTheme['color'] & {
  surface: string;
  border: string;
  muted: string;
};

/** Acesso tipado às cores extras do tema. */
export const palette = (theme: EngineTheme) => theme.color as Palette;

export const ACCENTS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  sky: '#0ea5e9',
} as const;
export type AccentName = keyof typeof ACCENTS;

const colors: Record<Mode, Omit<Palette, 'primary'>> = {
  light: {
    background: '#f4f5f9',
    surface: '#ffffff',
    border: '#e4e7ee',
    text: '#12141c',
    muted: '#6b7280',
    secondary: '#7c3aed',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  },
  dark: {
    background: '#0b0d14',
    surface: '#161a26',
    border: '#252b3b',
    text: '#eef0f6',
    muted: '#98a2b8',
    secondary: '#a78bfa',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
  },
};

const spacing: Record<Density, EngineTheme['spacing']> = {
  compact: { xs: 2, sm: 6, md: 10, lg: 16, xl: 22 },
  comfortable: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
};

export function applyTheme(mode: Mode, accent: AccentName, density: Density) {
  return updateTheme({
    color: { ...colors[mode], primary: ACCENTS[accent] },
    spacing: spacing[density],
    borderRadius: { sm: 8, md: 14, lg: 20, full: 999 },
    typography: {
      fontSize: { xs: 11, sm: 13, md: 15, lg: 18, xl: 26 },
      fontWeight: { light: '300', normal: '500', medium: '600', bold: '800' },
    },
    shadows: {
      sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: mode === 'light' ? 0.06 : 0.3,
        shadowRadius: 3,
        elevation: 1,
      },
      md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: mode === 'light' ? 0.1 : 0.4,
        shadowRadius: 10,
        elevation: 4,
      },
    },
  });
}
