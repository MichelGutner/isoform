/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, forwardRef, lazy } from 'react';
import { isModuleEnabled } from '../../../config';
import type { CameraHandle } from '../../../core/camera';
import { warnModuleDisabled } from '../../../core/modules';

/**
 * Entry point of the web `Camera`. The camera (stream, recorder, scanner) is a separate
 * chunk, downloaded only when the module is on and a camera renders.
 */
const CameraElement = lazy(() => import('./CameraElement').then((m) => ({ default: m.Camera })));

/** The camera's box (same style) while the chunk loads or with the module off. */
const Placeholder = ({ className, style, 'data-testid': testId }: any) => (
  <div className={className} style={style} data-testid={testId} />
);

export const Camera = forwardRef<CameraHandle, any>((props, ref) => {
  if (!isModuleEnabled('camera')) {
    warnModuleDisabled('camera');
    return <Placeholder {...props} />;
  }
  return (
    <Suspense fallback={<Placeholder {...props} />}>
      <CameraElement ref={ref} {...props} />
    </Suspense>
  );
});
Camera.displayName = 'Camera';
