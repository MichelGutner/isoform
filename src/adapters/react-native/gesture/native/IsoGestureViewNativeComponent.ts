/**
 * Spec of the native gesture view (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props and events) used by:
 *  · iOS:     ios/gesture/IsoGestureView.mm + ios/gesture/IsoGesture.swift (UIKit recognizers)
 *  · Android: android/src/gesture/.../IsoGestureViewManager.kt + IsoGestureView.kt
 *
 * It is a regular view (background, borders, children) that also recognizes
 * gestures. Its continuous events are bound to `Animated.Value`s with the native
 * driver, so the view follows the fingers without going through JS.
 *
 * `state`: 0 start, 1 move, 2 end, 3 cancel. Distances in points/dp, speeds per second.
 */
import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type PanEvent = Readonly<{
  state: CodegenTypes.Int32;
  translationX: CodegenTypes.Double;
  translationY: CodegenTypes.Double;
  velocityX: CodegenTypes.Double;
  velocityY: CodegenTypes.Double;
  x: CodegenTypes.Double;
  y: CodegenTypes.Double;
}>;

type PinchEvent = Readonly<{
  state: CodegenTypes.Int32;
  scale: CodegenTypes.Double;
  velocity: CodegenTypes.Double;
  focalX: CodegenTypes.Double;
  focalY: CodegenTypes.Double;
}>;

type RotateEvent = Readonly<{
  state: CodegenTypes.Int32;
  rotation: CodegenTypes.Double;
  velocity: CodegenTypes.Double;
}>;

/** `kind`: 0 double tap, 1 long press. */
type TapEvent = Readonly<{
  kind: CodegenTypes.Int32;
  x: CodegenTypes.Double;
  y: CodegenTypes.Double;
}>;

export interface NativeProps extends ViewProps {
  /** Axis the one-finger recognizer tracks (`'none'` = off). */
  panAxis?: CodegenTypes.WithDefault<'none' | 'x' | 'y' | 'both', 'none'>;
  /** Two-finger scale on. */
  pinchEnabled?: CodegenTypes.WithDefault<boolean, false>;
  /** Two-finger rotation on. */
  rotateEnabled?: CodegenTypes.WithDefault<boolean, false>;
  /** Double tap on. */
  doubleTapEnabled?: CodegenTypes.WithDefault<boolean, false>;
  /** Long press on. */
  longPressEnabled?: CodegenTypes.WithDefault<boolean, false>;
  /** How long a long press must be held, in ms. */
  longPressDuration?: CodegenTypes.WithDefault<CodegenTypes.Double, 500>;
  /** The one-finger pan may run together with pinch/rotation (`false`: the first to start wins). */
  simultaneous?: CodegenTypes.WithDefault<boolean, true>;

  // `onIso*` prefix so they do not clash with events React Native already defines.
  /** One-finger drag updates. */
  onIsoPan?: CodegenTypes.DirectEventHandler<PanEvent>;
  /** Pinch updates. */
  onIsoPinch?: CodegenTypes.DirectEventHandler<PinchEvent>;
  /** Rotation updates. */
  onIsoRotate?: CodegenTypes.DirectEventHandler<RotateEvent>;
  /** A double tap or a long press. */
  onIsoTap?: CodegenTypes.DirectEventHandler<TapEvent>;
}

type ComponentType = HostComponent<NativeProps>;

// Codegen requires `React.ElementRef<...>` written inline as the first argument (no alias).
interface NativeCommands {
  /** Plays a device tap. `kind`: 0 light (snap, bounds), 1 medium (swipe, long press). */
  haptic: (viewRef: React.ElementRef<ComponentType>, kind: CodegenTypes.Int32) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({ supportedCommands: ['haptic'] });

export default codegenNativeComponent<NativeProps>('IsoGestureView') as ComponentType;
