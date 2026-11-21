/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * `.gesture()` without the gestures module: `react-isoform/metro` uses this file
 * instead of `GestureView.tsx` when the module is off in `isoform.config.json`, so
 * neither the gesture code nor its native spec enter the bundle. It renders a
 * plain `View` (and warns in development).
 */
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import { GESTURE_PROPS } from '../../../core/gesture';
import { warnModuleDisabled } from '../../../core/modules';

export const GestureView = forwardRef<any, any>(({ __isoGestures: _spec, ...props }, ref) => {
  warnModuleDisabled('gestures');
  for (const name of GESTURE_PROPS) delete props[name];
  return <View ref={ref} {...props} />;
});
GestureView.displayName = 'GestureView';
