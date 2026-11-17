/**
 * `BottomSheet`: a panel that slides up from the bottom edge.
 * Web: a native `<dialog>` (top layer, focus trap, Escape) with the lib's drag and snapping.
 * iOS: a SwiftUI sheet (`presentationDetents`, Liquid Glass on iOS 26).
 * Android: a Jetpack Compose sheet with Material-style drag, snapping and scrim.
 */

/**
 * A height the sheet can rest at.
 * - `'fit'`: the height of the content (up to the screen).
 * - `'full'`: as tall as the platform allows.
 * - a number: that height, in px (dp on Android, pt on iOS).
 * - `'40%'`: that share of the screen height.
 */
export type SheetDetent = 'fit' | 'full' | number | `${number}%`;

/** A user-visible change of the resting height. */
export interface SheetDetentChange {
  /** Index in `detents` of the height the sheet now rests at. */
  index: number;
}

/** Props of `BottomSheet` besides the common ones (`style`, `testID`…). */
export interface BottomSheetOwnProps {
  /** Shown (`true`) or hidden (`false`). The sheet animates in both directions. */
  open: boolean;
  /**
   * Called when the user closes the sheet (drag down, tap on the backdrop,
   * Escape on the web, back button on Android). Set your `open` state to the value.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Heights the sheet snaps to, from the smallest to the largest. Default `['fit']`.
   * Examples: `['fit']`, `['50%', 'full']`, `[240, '90%']`.
   */
  detents?: SheetDetent[];
  /** Index in `detents` to show when it opens (and to move to while open). Default `0`. */
  detent?: number;
  /** Called when the sheet moves to another detent: dragged by the user or moved with `snapTo`. */
  onDetentChange?: (change: SheetDetentChange) => void;
  /** Whether the user can close it (drag down, backdrop, Escape, back button). Default `true`. */
  dismissible?: boolean;
  /**
   * `true` (default): a dimmed backdrop blocks the screen behind.
   * `false`: no backdrop; the screen behind stays usable (like Maps).
   */
  modal?: boolean;
  /** Shows the small handle on top. Default `true`. */
  grabber?: boolean;
  /** Called after the closing animation ends (the content is then unmounted). */
  onClosed?: () => void;
  /** Accessible name of the sheet (`aria-label` on the web). */
  label?: string;
  /** The content. */
  children?: unknown;
}

/** `ref` of a `BottomSheet`. */
export interface BottomSheetHandle {
  /** Moves to the detent at `index` (while open). Triggers `onDetentChange`. */
  snapTo(index: number): void;
}

/** A detent turned into a concrete height. */
export interface ResolvedDetent {
  /** Height in px/dp/pt. */
  height: number;
  /** Whether it follows the content (`'fit'`). */
  fit: boolean;
}

/** Default rest heights. */
export const DEFAULT_DETENTS: SheetDetent[] = ['fit'];

/** How far below the top the tallest sheet stops, so the screen behind still shows (px). */
export const SHEET_TOP_GAP = 48;

const PERCENT = /^(\d+(?:\.\d+)?)%$/;

/**
 * Height of one detent.
 * @param detent The detent.
 * @param screen Height available to the sheet (screen minus the top gap).
 * @param content Natural height of the content (`0` while unknown).
 */
export function detentHeight(detent: SheetDetent, screen: number, content: number): number {
  if (typeof detent === 'number') return detent;
  if (detent === 'full') return screen;
  if (detent === 'fit') return content > 0 ? content : screen / 2;
  const match = PERCENT.exec(detent);
  return match ? (screen * Number(match[1])) / 100 : screen;
}

/**
 * The detents as heights, clamped to the screen, smallest first, without duplicates.
 * The order of `detents` is kept for the returned indexes (callers map back with `source`).
 */
export function resolveDetents(
  detents: SheetDetent[] | undefined,
  screen: number,
  content: number,
): Array<ResolvedDetent & { source: number }> {
  const list = detents?.length ? detents : DEFAULT_DETENTS;
  return list
    .map((detent, source) => ({
      height: Math.round(Math.min(Math.max(detentHeight(detent, screen, content), 0), screen)),
      fit: detent === 'fit',
      source,
    }))
    .sort((a, b) => a.height - b.height);
}

/**
 * Detent the sheet should rest at after a drag: the nearest one, or the next one
 * in the fling's direction when the release is fast.
 * @param heights Rest heights, ascending.
 * @param current Height when released.
 * @param velocity Upward speed in px/s (negative = moving down).
 * @returns The index into `heights`, or `-1` to close.
 */
export function settleDetent(heights: number[], current: number, velocity: number, dismissible: boolean): number {
  const FLING = 600;
  if (velocity <= -FLING) {
    let below = -1;
    heights.forEach((h, i) => {
      if (h < current - 1) below = i;
    });
    return below >= 0 ? below : dismissible ? -1 : 0;
  }
  if (velocity >= FLING) {
    const above = heights.findIndex((h) => h > current + 1);
    return above >= 0 ? above : heights.length - 1;
  }
  // slow release: the closest rest height (closing counts as height 0)
  const options = dismissible ? [0, ...heights] : heights;
  const nearest = options.reduce((best, h, i) => (Math.abs(h - current) < Math.abs(options[best] - current) ? i : best), 0);
  return dismissible ? nearest - 1 : nearest;
}

/** Encodes the detents for the native views: `fit`, `full`, `50%` or a number of points. */
export const encodeDetents = (detents: SheetDetent[] | undefined): string[] =>
  (detents?.length ? detents : DEFAULT_DETENTS).map(String);
