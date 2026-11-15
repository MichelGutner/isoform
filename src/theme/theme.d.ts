declare global {
  /**
   * The shape of your app's theme (colors, spacing, typography…), as received
   * by style functions (`({ theme }) => …`), `useTheme()` and `getTheme()`.
   *
   * It is `unknown` until your app declares it once, globally:
   * ```ts
   * // theme.d.ts in your app
   * import type { tokens } from './tokens';
   * declare global {
   *   type EngineTheme = typeof tokens;
   * }
   * ```
   */
  export type EngineTheme = unknown;
}

export {};
