import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

/** Width range of one `when('breakpoints:…')` rule: from `min` (inclusive) up to `max` (exclusive, when present). */
export interface WidthRange {
  min: number;
  max?: number;
}

const listeners = new Set<() => void>();
let subscription: { remove(): void } | null = null;

const currentWidth = (): number => Dimensions.get('window').width;

/**
 * One `Dimensions` listener shared by every component that has breakpoints (added with the first
 * subscriber, removed with the last), instead of one `useWindowDimensions` subscription per component.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscription ??= Dimensions.addEventListener('change', () => listeners.forEach((notify) => notify()));
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

/**
 * Which of `ranges` contain `width`, as one comparable value: a bitmask for up to 30 ranges (the
 * realistic case: a handful of named breakpoints), a string beyond that.
 */
function activeRanges(ranges: readonly WidthRange[], width: number): number | string {
  if (ranges.length > 30) {
    return ranges.map((r) => (width >= r.min && (r.max === undefined || width < r.max) ? 1 : 0)).join('');
  }
  let mask = 0;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (width >= r.min && (r.max === undefined || width < r.max)) mask |= 1 << i;
  }
  return mask;
}

/**
 * Current window width, re-rendering the component **only when the set of active ranges changes**.
 *
 * `useWindowDimensions` re-renders on every width change, even when no breakpoint was crossed
 * (rotation animations, split-screen resizing, foldables), which re-composed every responsive
 * component for nothing. Here the snapshot is the active-range mask, so a change inside one range
 * is a no-op for React, and the width returned is still the real one.
 */
export function useBreakpointWidth(ranges: readonly WidthRange[]): number {
  useSyncExternalStore(
    subscribe,
    () => activeRanges(ranges, currentWidth()),
    () => activeRanges(ranges, currentWidth()),
  );
  return currentWidth();
}
