/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, forwardRef, lazy } from 'react';
import { isModuleEnabled } from '../../../../config';
import type { AudioHandle } from '../../../../core/media';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * Entry point of the web `Audio`. The player (controls, icons, CSS) lives in a
 * separate chunk, downloaded only when the module is on and an `Audio` shows up:
 * with `modules.audio` off, none of it is loaded.
 */
const Player = lazy(() => import('./AudioElement').then((m) => ({ default: m.Audio })));

/** Same-style box while the player loads or when the module is off. */
const Placeholder = ({ className, style, 'data-testid': testId }: any) => (
  <div className={className} style={style} data-testid={testId} />
);

export const Audio = forwardRef<AudioHandle, any>((props, ref) => {
  if (!isModuleEnabled('audio')) {
    warnModuleDisabled('audio');
    return <Placeholder {...props} />;
  }
  return (
    <Suspense fallback={<Placeholder {...props} />}>
      <Player ref={ref} {...props} />
    </Suspense>
  );
});
Audio.displayName = 'Audio';
