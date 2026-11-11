/** Tokens de design — iguais para web e mobile. */
export const lightTokens = {
  color: {
    background: '#f4f5f9',
    surface: '#ffffff',
    border: '#e4e7ee',
    muted: '#6b7280',
    text: '#12141c',
    primary: '#6366f1',
    secondary: '#7c3aed',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 14, lg: 20, full: 999 },
  typography: {
    fontSize: { xs: 11, sm: 13, md: 15, lg: 18, xl: 26 },
    fontWeight: { light: '300', normal: '500', medium: '600', bold: '800' },
  },
};

export const darkTokens = {
  ...lightTokens,
  color: {
    background: '#0b0d14',
    surface: '#161a26',
    border: '#252b3b',
    muted: '#98a2b8',
    text: '#eef0f6',
    primary: '#818cf8',
    secondary: '#a78bfa',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
  },
};
