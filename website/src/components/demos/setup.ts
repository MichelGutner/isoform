/**
 * Shared by every live example on the site: the same `configure()` call an app
 * makes once at startup. Each island imports this file first; the module is
 * evaluated once per page, so `configure()` runs once.
 */
import { configure, updateTheme } from 'react-isoform';

/** Theme tokens of the examples (light). */
export const lightTokens = {
  color: {
    background: '#f4f5f9',
    surface: '#ffffff',
    border: '#e4e7ee',
    muted: '#6b7280',
    text: '#12141c',
    primary: '#6366f1',
    success: '#16a34a',
    error: '#dc2626',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 14, lg: 20 },
};

/** Theme tokens of the examples (dark). */
export const darkTokens = {
  ...lightTokens,
  color: {
    background: '#0b0d14',
    surface: '#161a26',
    border: '#252b3b',
    muted: '#98a2b8',
    text: '#eef0f6',
    primary: '#818cf8',
    success: '#4ade80',
    error: '#f87171',
  },
};

/** Whether this runs in the browser (the page is also rendered at build time). */
const inBrowser = typeof document !== 'undefined';

/** The docs site's own light/dark switch (Starlight sets `data-theme` on `<html>`). */
const siteTheme = (): 'light' | 'dark' =>
  inBrowser && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

const TOKENS = { light: lightTokens, dark: darkTokens } as const;

configure({
  provider: 'auto',
  theme: TOKENS[siteTheme()],
  // Every module the examples use. On the web each one is a separate chunk,
  // downloaded only when one of its components renders.
  modules: {
    video: true,
    audio: true,
    pdf: true,
    sheet: true,
    svg: true,
    camera: { enabled: true, codeScanner: true },
    datePicker: true,
    image: true,
    modal: true,
  },
});

/** Follows the site's theme switch: `updateTheme` re-renders every example, no provider needed. */
const followSiteTheme = () =>
  new MutationObserver(() => updateTheme(TOKENS[siteTheme()])).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

if (inBrowser) followSiteTheme();
