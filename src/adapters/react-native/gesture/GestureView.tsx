/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useCallback, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { isModuleEnabled } from '../../../config';
import { warnModuleDisabled } from '../../../core/modules';
import { GESTURE_PROPS, type GestureProps, type ResolvedGestures } from '../../../core/gesture';
import { parseTransform } from '../animation';
import { accessibilityOf, bindGestures, createMotion, motionStyle, type GestureEnv, type HapticKind, type Motion } from './motion';

declare const require: (id: string) => any;

/** The native spec. Loaded on first use: importing the adapter (tests included) does not need Codegen. */
const nativeSpec = (): any => require('./native/IsoGestureViewNativeComponent');

/** The native view, made animatable. */
let AnimatedGestureView: any;
const animatedGestureView = (): any => (AnimatedGestureView ??= Animated.createAnimatedComponent(nativeSpec().default));

/** Splits the gesture callbacks (kept in `into`) from the props that go to the view. */
function takeCallbacks(props: Record<string, any>, into: GestureProps): Record<string, any> {
  const rest = { ...props };
  for (const name of GESTURE_PROPS) {
    (into as any)[name] = rest[name];
    delete rest[name];
  }
  return rest;
}

/** The style's own transform (array or CSS string) as the array form `Animated` composes with. */
const staticTransform = (transform: unknown): Array<Record<string, unknown>> =>
  parseTransform(transform).map(({ fn, value }) => ({ [fn]: value }));

/**
 * `Box` with `.gesture()` on mobile: the lib's native view (a regular view that
 * also recognizes gestures). The movement goes straight from the native
 * recognizer to the view's transform through the native driver; JS only hears
 * about it to run the callbacks and to release the element when the fingers lift.
 */
const NativeGestureView = forwardRef<any, any>(({ __isoGestures, style, ...props }, ref) => {
  const spec = __isoGestures as ResolvedGestures;
  const callbacks = useRef<GestureProps>({}).current;
  const rest = takeCallbacks(props, callbacks);

  const motionRef = useRef<Motion | null>(null);
  motionRef.current ??= createMotion();
  const motion = motionRef.current;

  // the native view, for the haptic command (the caller's ref still gets it)
  const view = useRef<any>(null);
  const setRef = useCallback(
    (node: any) => {
      view.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const hapticsOn = useRef(spec.haptics);
  hapticsOn.current = spec.haptics;
  const env = useRef<GestureEnv>({
    callbacks,
    haptic: (kind: HapticKind) => {
      if (hapticsOn.current && view.current) nativeSpec().Commands?.haptic(view.current, kind);
    },
  }).current;

  // rebuilt only when the gesture config changes (`spec.key`): the same `Animated.event` stays attached
  // between renders. `motion` and `env` are stable refs, and `spec` is identified by its key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlers = useMemo(() => bindGestures(spec, motion, env), [spec.key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const followed = useMemo(() => motionStyle(spec, motion), [spec.key]);
  const accessibility = accessibilityOf(spec, motion, env, rest);

  // the element's transform: the gesture's first (it moves the element as a whole), then the style's own;
  // the `interpolate` styles win over the element's own values of the same properties
  const flat = StyleSheet.flatten(style) ?? {};
  const driven = followed.transform.length ? { transform: [...followed.transform, ...staticTransform(flat.transform)] } : null;
  const finalStyle = driven || spec.interpolate.length ? [style, driven, followed.props] : style;

  const Native = animatedGestureView();
  return (
    <Native
      {...rest}
      {...accessibility}
      ref={setRef}
      style={finalStyle}
      panAxis={spec.trackAxis}
      pinchEnabled={!!spec.pinch}
      rotateEnabled={!!spec.rotate}
      doubleTapEnabled={spec.doubleTap}
      longPressEnabled={!!spec.longPress}
      longPressDuration={spec.longPress?.minDuration}
      simultaneous={spec.simultaneous}
      {...handlers}
    />
  );
});
NativeGestureView.displayName = 'GestureView';

/**
 * Entry point of `.gesture()` on mobile. With `modules.gestures` off it renders
 * a plain `View` (and warns in development) instead of "native component not found".
 */
export const GestureView = forwardRef<any, any>((props, ref) => {
  if (!isModuleEnabled('gestures')) {
    warnModuleDisabled('gestures');
    const { __isoGestures: _spec, ...rest } = props;
    return <View ref={ref} {...takeCallbacks(rest, {})} />;
  }
  return <NativeGestureView ref={ref} {...props} />;
});
GestureView.displayName = 'GestureView';
