import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lists for `Video`, `Audio` and `Pdf`: instead of one `src`, an `items` list.
 * A "playlist" button inside the player opens a carousel panel over it. The list logic lives
 * here, once for every platform; each adapter only draws the strip. The component's
 * style keeps going to the player; the carousel is added below it.
 */

/** One entry of an `items` list. */
export interface PlaylistItem {
  /** Address of the entry (same formats as the primitive's `src`). */
  src: string;
  /** Name shown in the carousel card (and, for `Audio`, in the player). */
  title?: string;
}

/** An entry of a `Video` list. */
export interface VideoItem extends PlaylistItem {
  /** Image shown before playback and in the carousel card. */
  poster?: string;
}

/** An entry of an `Audio` list. */
export interface AudioItem extends PlaylistItem {
  /** Artist, show or author (player and card). */
  artist?: string;
  /** Cover image (player and card). */
  artwork?: string;
}

/** An entry of a `Pdf` list. */
export interface PdfItem extends PlaylistItem {
  /** Image shown in the carousel card (for example, the first page). Without it, a document icon. */
  thumbnail?: string;
}

/** What `onItemChange` receives. */
export interface PlaylistChange<Item extends PlaylistItem = PlaylistItem> {
  /** Position of the new entry in `items`, from `0`. */
  index: number;
  /** The new entry. */
  item: Item;
}

/** Props shared by every primitive that accepts a list. */
export interface PlaylistProps<Item extends PlaylistItem> {
  /**
   * A list to play or read one after the other. A button inside the player opens the carousel.
   * When given (non-empty), `src` and the per-entry props (`poster`, `title`…) come from the current entry.
   */
  items?: Item[];
  /** Entry shown first, from `0`. Default `0`. */
  initialIndex?: number;
  /** Shows the playlist button (which opens the carousel) inside the player when there is a list. Default `true`. */
  carousel?: boolean;
  /** Called when the current entry changes (carousel, `next()`/`previous()`/`goTo()` or the end of a video/audio). */
  onItemChange?: (change: PlaylistChange<Item>) => void;
}

/** Props of lists that play (`Video`, `Audio`). */
export interface MediaPlaylistProps<Item extends PlaylistItem> extends PlaylistProps<Item> {
  /** Goes to the next entry, and keeps playing, when one ends. Default `true`. */
  autoAdvance?: boolean;
}

/** List control added to the `ref` of `Video`, `Audio` and `Pdf`. No-op without `items`. */
export interface PlaylistHandle {
  /** Goes to the next entry (stops at the last one). */
  next(): void;
  /** Goes to the previous entry (stops at the first one). */
  previous(): void;
  /** Goes to the entry at `index` (from `0`; clamped to the list). */
  goTo(index: number): void;
}

/** A player's own `ref` methods (the list ones are added by the playlist wrapper). */
export type WithoutPlaylist<Handle> = Omit<Handle, keyof PlaylistHandle>;

/** The current state of a list, for the adapters. */
export interface PlaylistState<Item extends PlaylistItem> {
  /** Position of the current entry. */
  index: number;
  /** The current entry. */
  item: Item;
  /** Whether the entry was opened while playing (so the next one starts on its own). */
  autoPlay: boolean;
  goTo(index: number, autoPlay?: boolean): void;
  next(autoPlay?: boolean): void;
  previous(autoPlay?: boolean): void;
}

const clamp = (n: number, length: number) => Math.min(Math.max(0, Math.round(n)), Math.max(0, length - 1));

/**
 * Index and navigation of an `items` list. `autoPlay` turns on when the user moves
 * while something is playing (or a video/audio ends), so the next entry starts by itself.
 */
export function usePlaylist<Item extends PlaylistItem>(
  items: Item[],
  initialIndex: number | undefined,
  onItemChange: ((change: PlaylistChange<Item>) => void) | undefined,
): PlaylistState<Item> {
  const [index, setIndex] = useState(() => clamp(initialIndex ?? 0, items.length));
  const [autoPlay, setAutoPlay] = useState(false);
  const latest = useRef({ items, onItemChange, index });
  latest.current = { items, onItemChange, index };

  // a shorter list keeps the index inside it
  useEffect(() => setIndex((i) => clamp(i, items.length)), [items.length]);

  const goTo = useCallback((target: number, play = false) => {
    const { items: list, onItemChange: notify, index: current } = latest.current;
    const next = clamp(target, list.length);
    // choosing the entry that is already on (e.g. the carousel settling on it) changes nothing
    if (next === current) return;
    setAutoPlay(play);
    latest.current.index = next;
    setIndex(next);
    notify?.({ index: next, item: list[next] });
  }, []);

  return {
    index,
    item: items[clamp(index, items.length)],
    autoPlay,
    goTo,
    next: useCallback((play = false) => goTo(latest.current.index + 1, play), [goTo]),
    previous: useCallback((play = false) => goTo(latest.current.index - 1, play), [goTo]),
  };
}

/**
 * Restarts the player when the new entry has the same address as the previous one
 * (a list may repeat a file): the player would otherwise ignore the "change".
 */
export function useRestartOnSameSource(
  items: PlaylistItem[],
  index: number,
  autoPlay: boolean,
  player: { current: { seekTo?(seconds: number): void; play?(): void } | null },
): void {
  const previous = useRef({ index, src: items[index]?.src });
  useEffect(() => {
    const before = previous.current;
    const src = items[index]?.src;
    previous.current = { index, src };
    if (before.index === index || before.src !== src) return;
    player.current?.seekTo?.(0);
    if (autoPlay) player.current?.play?.();
  }, [items, index, autoPlay, player]);
}

/** Which item fields become props of each primitive. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ITEM_PROPS: Record<'Video' | 'Audio' | 'Pdf', (item: any) => Record<string, unknown>> = {
  Video: (item: VideoItem) => ({ src: item.src, poster: item.poster }),
  Audio: (item: AudioItem) => ({ src: item.src, title: item.title, artist: item.artist, artwork: item.artwork }),
  Pdf: (item: PdfItem) => ({ src: item.src }),
};
