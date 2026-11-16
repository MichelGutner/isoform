/* eslint-disable @typescript-eslint/no-explicit-any */
import { forwardRef } from 'react';
import type { CameraHandle } from '../../../core/camera';
import { warnModuleDisabled } from '../../../core/modules';

/**
 * `Camera` without the native camera: `omnistyle/metro` uses this file instead of
 * `Camera.tsx` when the camera is off in `omnistyle.config.json`, so neither the
 * camera nor its native spec enter the JS bundle.
 */
export const Camera = forwardRef<CameraHandle, any>((_props, _ref) => {
  warnModuleDisabled('camera');
  return null;
});
Camera.displayName = 'Camera';
