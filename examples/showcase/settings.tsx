import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { updateTheme } from 'react-isoform';
import { useThemeBubble } from './ThemeBubble';
import { buildTokens, type AccentName, type Density, type Mode } from './tokens';

/** The live theme choices, shared by the header and the Theme page. */
interface Settings {
  /** Light or dark. */
  mode: Mode;
  /** Accent color (`color.primary`). */
  accent: AccentName;
  /** Spacing scale. */
  density: Density;
  /** Switches light/dark with the bubble animation starting at the event's point. */
  toggleMode: (event?: unknown) => void;
  /** Picks the accent color. */
  setAccent: (accent: AccentName) => void;
  /** Picks the spacing scale. */
  setDensity: (density: Density) => void;
}

const SettingsContext = createContext<Settings | null>(null);

/** Holds the theme choices and the animated background layer (it must render behind the content). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');
  const [accent, setAccentState] = useState<AccentName>('indigo');
  const [density, setDensityState] = useState<Density>('comfortable');
  const { switchTheme, backdrop } = useThemeBubble();

  const value = useMemo<Settings>(
    () => ({
      mode,
      accent,
      density,
      toggleMode: (event) => {
        const next: Mode = mode === 'dark' ? 'light' : 'dark';
        const tokens = buildTokens(next, accent, density);
        switchTheme(event, tokens, tokens.color.background);
        setMode(next);
      },
      setAccent: (next) => {
        setAccentState(next);
        updateTheme(buildTokens(mode, next, density));
      },
      setDensity: (next) => {
        setDensityState(next);
        updateTheme(buildTokens(mode, accent, next));
      },
    }),
    [mode, accent, density, switchTheme],
  );

  return (
    <SettingsContext.Provider value={value}>
      {backdrop}
      {children}
    </SettingsContext.Provider>
  );
}

/** The theme choices; only valid under `SettingsProvider`. */
export function useSettings(): Settings {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}

/** Lets a page draw above the scrolling content, at the root of the screen (non-modal sheets need it). */
const OverlayContext = createContext<(node: ReactNode) => void>(() => undefined);

/** Provides the overlay setter to the pages. */
export const OverlayProvider = OverlayContext.Provider;

/**
 * Draws `node` at the root of the screen while the page is mounted.
 * @param node What to draw; pass a stable element (rebuilt only when `deps` change).
 * @param deps Values `node` depends on.
 */
export function useOverlay(node: ReactNode, deps: unknown[]): void {
  const set = useContext(OverlayContext);
  useEffect(() => {
    set(node);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
