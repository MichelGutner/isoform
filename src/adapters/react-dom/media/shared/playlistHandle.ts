/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';

/**
 * The small pieces of `withPlaylist` that every player needs, kept apart from the playlist UI
 * (`Playlist.tsx`, ~12 KB) so a player without `items` does not download it.
 */

const LIST_PROPS = ['items', 'initialIndex', 'carousel', 'autoAdvance', 'onItemChange'] as const;

/** Props without the list ones (what the plain player receives). */
export const withoutList = (props: Record<string, any>) => {
  const rest = { ...props };
  LIST_PROPS.forEach((key) => delete rest[key]);
  return rest;
};

export const NO_LIST = { next: () => undefined, previous: () => undefined, goTo: () => undefined };

/** A `ref` that has the list methods and forwards everything else to the player. */
export const handleOf = (inner: React.RefObject<any>, list: Record<string, (...args: any[]) => void>) =>
  new Proxy(list, {
    get: (target, key: string) => target[key] ?? ((...args: any[]) => inner.current?.[key]?.(...args)),
  });
