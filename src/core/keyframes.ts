/* eslint-disable @typescript-eslint/no-explicit-any */
import { stringHash } from '../hash/stringHash';
import type { IsoStyle } from './style/types';

/**
 * The frames of an animation, written with the same style vocabulary as the
 * rest of the lib. Works on both platforms (`@keyframes` on the web, `Animated` on native).
 */
export type Keyframes = {
  /** The starting frame (same as `'0%'`). */
  from?: IsoStyle;
  /** The final frame (same as `'100%'`). */
  to?: IsoStyle;
  /** A frame at a point of the animation, e.g. `'50%'`. */
  [percent: `${number}%`]: IsoStyle;
  /** The same frame at several points, e.g. `'0%, 100%'`. */
  [list: `${number}%, ${string}`]: IsoStyle;
};

/** Prefix of the generated names (`o-kf-<hash>`). */
export const KEYFRAMES_PREFIX = 'o-kf-';

const registry = new Map<string, Keyframes>();

/**
 * Declares an animation and returns its name, to use in `animation` / `animationName`.
 * Works on both platforms: `@keyframes` on the web, `Animated` on native.
 *
 * It does not depend on the active provider: it only stores the definition, and
 * each adapter materializes it when a style using the name is compiled. So it can
 * be called at the top of a module, before `configure()`.
 *
 * The name is derived from the content (deterministic, safe for SSR).
 *
 * @param frames The animation frames (see {@link Keyframes}).
 * @returns The generated animation name (`o-kf-<hash>`).
 *
 * @example
 * const pulse = keyframes({ '0%': { opacity: 1 }, '50%': { opacity: 0.3 }, '100%': { opacity: 1 } });
 * const Dot = engine('Box', { animation: `${pulse} 1s ease-in-out infinite alternate` });
 */
export function keyframes(frames: Keyframes): string {
  const name = `${KEYFRAMES_PREFIX}${stringHash(JSON.stringify(frames)).toString(36)}`;
  registry.set(name, frames);
  return name;
}

/** The definition registered by `keyframes()` under `name` (used by the adapters). */
export function getKeyframes(name: string): Record<string, Record<string, any>> | undefined {
  return registry.get(name) as Record<string, Record<string, any>> | undefined;
}

/** Keyframe names referenced in a CSS value (`'o-kf-abc 1s ease'` → `['o-kf-abc']`). */
export function keyframeNamesIn(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.match(/o-kf-[a-z0-9]+/g) ?? [];
}
