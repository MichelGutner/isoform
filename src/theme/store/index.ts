import { noteThemeRead } from '../variables';
import { deepEqual, deepMerge } from './helpers';

/**
 * Default theme object used as the base for all themes.
 * 
 * This empty object serves as a starting point that can be extended
 * with theme values via updateTheme(). The type system ensures that
 * any theme values conform to the EngineTheme interface.
 */
const defaultTheme = {} as EngineTheme;

/**
 * Internal reference to the current global theme state.
 * 
 * This variable holds the active theme that is accessible throughout
 * the application. It should only be modified through the updateTheme function
 * to ensure proper reactivity and subscriber notifications.
 */
let _currentTheme: EngineTheme = defaultTheme;

/**
 * Set of subscribers that are notified when the theme changes.
 * 
 * This Set contains all listener functions that have been subscribed
 * to theme updates. When the theme changes, all listeners are called
 * to trigger re-renders in components using useTheme().
 */
const listeners = new Set<() => void>();

/**
 * The last few distinct themes, so a theme the app returns to keeps its **identity**.
 *
 * Every style cache is keyed by the theme object. `updateTheme` always builds a new object when
 * something changed, so without this a light↔dark toggle would recompile every dynamic style on
 * every switch, even for themes already seen. Reusing the earlier (structurally equal) object makes
 * the way back a cache hit.
 */
const RECENT_THEMES = 8;
const recentThemes: EngineTheme[] = [];

const canonicalTheme = (theme: EngineTheme): EngineTheme => {
  const seen = recentThemes.find((candidate) => deepEqual(candidate, theme));
  if (seen) return seen;
  recentThemes.push(theme);
  if (recentThemes.length > RECENT_THEMES) recentThemes.shift();
  return theme;
};

/**
 * Theme store object that implements the external store interface.
 * 
 * This store is compatible with React's useSyncExternalStore hook,
 * providing a standardized interface for subscribing to theme changes.
 * 
 * @example
 * ```tsx
 * // Direct subscription (advanced usage)
 * const unsubscribe = themeStore.subscribe(() => {
 *   console.log('Theme changed:', themeStore.getSnapshot());
 * });
 * 
 * // Later unsubscribe
 * unsubscribe();
 * ```
 */
export const themeStore = {
  /**
   * Returns the current theme snapshot.
   * 
   * This method provides access to the current theme state
   * without triggering a subscription. It's used by useSyncExternalStore
   * to get the initial value and for server-side rendering.
   * 
   * @returns The current theme object
   */
  getSnapshot: () => _currentTheme,

  /**
   * Subscribes to theme changes.
   * 
   * Adds a listener function that will be called whenever the theme changes.
   * Returns an unsubscribe function that can be called to remove the listener.
   * 
   * @param listener - Function to call when theme changes
   * @returns Unsubscribe function to remove the listener
   * 
   * @example
   * ```tsx
   * const unsubscribe = themeStore.subscribe(() => {
   *   console.log('Theme updated');
   * });
   * 
   * // Clean up on unmount
   * useEffect(() => unsubscribe, []);
   * ```
   */
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Updates the global theme state with deep merging.
 *
 * This function is the primary way to modify the application theme.
 * It accepts either a partial theme object or an updater function,
 * and performs a deep merge to preserve existing theme values.
 *
 * The API mirrors React's setState semantics for familiarity:
 * - Object form: Directly merges the provided partial theme
 * - Function form: Receives the previous theme and returns updates
 *
 * Theme updates trigger re-renders in all components using useTheme().
 *
 * @template T - Type of the partial theme update
 * @param input - Partial theme object or updater function
 * @returns The fully resolved theme after the merge
 *
 * @example Basic Usage
 * ```tsx
 * import { updateTheme } from 'react-isoform';
 * 
 * // Update theme colors
 * updateTheme({
 *   colors: {
 *     primary: '#007AFF',
 *     secondary: '#5856D6',
 *     background: '#FFFFFF',
 *   }
 * });
 * 
 * // Update spacing
 * updateTheme({
 *   spacing: {
 *     sm: 8,
 *     md: 16,
 *     lg: 24,
 *   }
 * });
 * ```
 *
 * @example Functional Updates
 * ```tsx
 * // Toggle between light and dark themes
 * updateTheme((prevTheme) => ({
 *   colors: {
 *     primary: prevTheme.colors.primary === '#007AFF' ? '#FF3B30' : '#007AFF',
 *     background: prevTheme.colors.background === '#FFFFFF' ? '#000000' : '#FFFFFF',
 *   }
 * }));
 * 
 * // Increment spacing values
 * updateTheme((prevTheme) => ({
 *   spacing: {
 *     md: prevTheme.spacing.md + 2,
 *   }
 * }));
 * ```
 *
 * @example Deep Merging
 * ```tsx
 * // Initial theme
 * updateTheme({
 *   colors: { primary: 'blue', secondary: 'gray' },
 *   spacing: { sm: 4, md: 8 }
 * });
 * 
 * // Later update - preserves existing values
 * updateTheme({
 *   colors: { primary: 'red' }, // secondary: 'gray' is preserved
 *   spacing: { lg: 16 }       // sm: 4, md: 8 are preserved
 * });
 * 
 * // Final theme:
 * // {
 * //   colors: { primary: 'red', secondary: 'gray' },
 * //   spacing: { sm: 4, md: 8, lg: 16 }
 * // }
 * ```
 *
 * @performance
 * - Only creates new objects when changes are detected
 * - Preserves references to unchanged nested objects
 * - Notifies all subscribers efficiently
 * - Returns the final merged theme for convenience
 */
export const updateTheme = <T extends Partial<EngineTheme>>(
  input: T | ((prev: EngineTheme) => T),
) => {
  // Store previous theme for functional updates
  const prev = _currentTheme;
  
  // Resolve the partial update from input
  const nextPartial = typeof input === 'function' ? input(prev) : input;

  // Deep merge the partial update into the current theme, reusing the object of an equal theme seen before
  _currentTheme = canonicalTheme(deepMerge(prev, nextPartial));

  // Notify all subscribers of the change
  listeners.forEach(listener => listener());

  // Return the fully resolved theme
  return _currentTheme as EngineTheme;
};

/**
 * Retrieves the current global theme snapshot.
 *
 * This function provides direct access to the current theme state
 * without subscribing to updates. It's useful for scenarios where
 * you need the theme value reactively.
 *
 * Common use cases:
 * - Non-React utilities and services
 * - Server-side rendering where reactivity isn't needed
 * - One-off theme reads in event handlers
 * - Logging and debugging
 * - Configuration setup
 *
 * @returns The current theme object
 *
 * @example
 * ```tsx
 * import { getTheme } from 'react-isoform';
 * 
 * // Get current theme for logging
 * const currentTheme = getTheme();
 * console.log('Current primary color:', currentTheme.colors?.primary);
 * 
 * // Use in utility functions
 * const getPrimaryColor = () => getTheme().colors?.primary || '#007AFF';
 * 
 * // Use in event handlers (non-reactive)
 * const handlePress = () => {
 *   const theme = getTheme();
 *   Analytics.track('button_press', {
 *     color_scheme: theme.colors?.primary === '#007AFF' ? 'blue' : 'other'
 *   });
 * };
 * ```
 *
 * @example Server-Side Rendering
 * ```tsx
 * // In SSR context, you might want to set a theme and get it immediately
 * import { updateTheme, getTheme } from 'react-isoform';
 * 
 * // Set initial theme based on user preferences
 * updateTheme({ colors: { primary: userPrefersDark ? '#fff' : '#000' } });
 * 
 * // Get the theme for rendering
 * const theme = getTheme();
 * const initialHtml = renderToString(<App theme={theme} />);
 * ```
 *
 * @note
 * This function does NOT subscribe to theme changes. If you need
 * reactive updates in React components, use the useTheme hook instead.
 *
 * @performance
 * - Direct property access (no subscription overhead)
 * - No re-renders triggered
 * - Safe to call frequently
 * - Memory efficient (no listener management)
 */
export const getTheme = (): EngineTheme => {
  // inside a style rule, reading the theme this way makes the style depend on it, like `ctx.theme` does
  noteThemeRead();
  return _currentTheme;
};
