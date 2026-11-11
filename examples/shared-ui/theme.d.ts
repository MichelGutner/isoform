/* eslint-disable @typescript-eslint/no-explicit-any */
// Forma do tema do app. Declarada uma única vez e compartilhada pelos dois
// apps (Expo e Vite): é o mesmo mecanismo de `EngineTheme` global da lib.
declare global {
  interface EngineTheme {
    color: {
      background: string;
      surface: string;
      border: string;
      muted: string;
      text: string;
      primary: string;
      secondary?: string;
      success?: string;
      warning?: string;
      error?: string;
    };
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    typography?: {
      fontSize?: {
        xs?: string | number;
        sm?: string | number;
        md?: string | number;
        lg?: string | number;
        xl?: string | number;
      };
      fontWeight?: {
        light?: string | number;
        normal?: string | number;
        medium?: string | number;
        bold?: string | number;
      };
    };
    borderRadius?: {
      sm?: string | number;
      md?: string | number;
      lg?: string | number;
      full?: string | number;
    };
    shadows?: {
      sm?: any;
      md?: any;
      lg?: any;
    };
  }
}

export {};
