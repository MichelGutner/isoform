/**
 * `react-isoform/server`: per-request themes for server rendering, without a provider.
 *
 * Node only (it uses `AsyncLocalStorage`). Browser and React Native bundles never import this file, so
 * they carry none of it; there the theme stays the single global one (`configure({ theme })`, `updateTheme`).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { canonicalTheme, setThemeScopeSource } from './theme/store';

const requests = new AsyncLocalStorage<EngineTheme>();

/**
 * Runs `render` with `theme` as the theme of everything it renders, without touching the global store.
 *
 * The global theme is one per process: calling `updateTheme()` per request makes concurrent renders see
 * each other's theme. Start the render inside `runWithTheme` instead. Styled components, `useTheme()` and
 * `getTheme()` read this theme for the whole render, including content that resumes later after a
 * Suspense boundary resolves, because the theme follows the render's async work (`AsyncLocalStorage`).
 *
 * - The theme is used as given: it is not merged with the global theme.
 * - To hydrate, send the same theme to the client and call `updateTheme(theme)` before `hydrateRoot`. Class
 *   names are content-hashed, so the client produces the same ones.
 * - With web `themeVariables` on, a request compiles to the same `var(--iso-…)` classes as the client, and
 *   `getStyleText()` called inside the same `runWithTheme` returns a `:root` rule with that request's values.
 *
 * @param theme The complete theme of this request.
 * @param render Starts the render (`renderToString`, `renderToPipeableStream`…). Its result is returned.
 *
 * @example
 * import { runWithTheme } from 'react-isoform/server';
 *
 * const html = runWithTheme(themeOf(request), () => renderToString(<App />));
 *
 * @example Streaming
 * runWithTheme(themeOf(request), () =>
 *   renderToPipeableStream(<App />, { onShellReady() { pipe(res); } }),
 * );
 */
export function runWithTheme<R>(theme: EngineTheme, render: () => R): R {
  setThemeScopeSource(lookup);
  // an equal theme seen before keeps its identity, so the style caches (keyed by the theme object) hit
  return requests.run(canonicalTheme(theme), render);
}

const lookup = () => requests.getStore();
