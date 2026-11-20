/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, forwardRef, lazy, useImperativeHandle, useRef } from 'react';
import type { Kind } from './Playlist';
import { NO_LIST, handleOf, withoutList } from './playlistHandle';

/**
 * Adds the `items` list to a player (`Video`, `Audio`, `Pdf`). The list UI (carousel, panel, its CSS)
 * is a separate chunk, downloaded the first time a player is given `items`: a player used on its own
 * costs nothing extra.
 */
const ListPlayer = lazy(() => import('./Playlist').then((m) => ({ default: m.ListPlayer })));

export function withPlaylist(kind: Kind, Player: React.ComponentType<any>) {
  const Listed = forwardRef<any, any>((props, ref) => {
    const inner = useRef<any>(null);
    const hasList = Array.isArray(props.items) && props.items.length > 0;
    useImperativeHandle(hasList ? null : ref, () => handleOf(inner, NO_LIST), []);
    if (hasList) {
      return (
        <Suspense fallback={null}>
          <ListPlayer kind={kind} Player={Player} props={props} handle={ref} />
        </Suspense>
      );
    }
    return <Player ref={inner} {...withoutList(props)} />;
  });
  Listed.displayName = kind;
  return Listed;
}
