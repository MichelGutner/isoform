/**
 * Spec of the native image view (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props and events) used by:
 *  · iOS:     ios/image/IsoImageView.mm + ios/image/IsoImage.swift (UIKit + the lib's pipeline)
 *  · Android: android/src/image/.../IsoImageViewManager.kt + IsoImageView.kt
 */
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type * as React from 'react';
import type { CodegenTypes, ColorValue, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type ProgressEvent = Readonly<{ loaded: CodegenTypes.Double; total: CodegenTypes.Double }>;
type LoadEvent = Readonly<{ width: CodegenTypes.Double; height: CodegenTypes.Double; cacheType: string }>;
type ErrorEvent = Readonly<{ message: string }>;
type ZoomEvent = Readonly<{ scale: CodegenTypes.Double; x: CodegenTypes.Double; y: CodegenTypes.Double; rotation: CodegenTypes.Double }>;

export interface NativeProps extends ViewProps {
  /** The picture: `https://`, `file://`, `data:` (and `content://` or a resource name on Android). */
  uri?: string;
  /** Cache key instead of the URL (empty = the URL). */
  cacheKey?: string;
  /** HTTP headers as `[name, value, name, value…]`. */
  headers?: ReadonlyArray<string>;
  /** A picture shown until `uri` loads (empty = none). */
  placeholderUri?: string;
  /** A blurhash shown until `uri` loads (empty = none; wins over `placeholderUri`). */
  blurhash?: string;
  /** How the picture fills the view. */
  contentFit?: CodegenTypes.WithDefault<'cover' | 'contain' | 'fill' | 'none' | 'scaleDown', 'cover'>;
  /** Horizontal position of the picture in the free space: 0 left, 0.5 center, 1 right. */
  positionX?: CodegenTypes.WithDefault<CodegenTypes.Double, 0.5>;
  /** Vertical position of the picture in the free space: 0 top, 0.5 center, 1 bottom. */
  positionY?: CodegenTypes.WithDefault<CodegenTypes.Double, 0.5>;
  /** Crossfade from the placeholder, in ms. */
  transition?: CodegenTypes.WithDefault<CodegenTypes.Double, 250>;
  /** Paints the non-transparent pixels. */
  tintColor?: ColorValue;
  /** Gaussian blur radius, in points. */
  blurRadius?: CodegenTypes.WithDefault<CodegenTypes.Double, 0>;
  /** Which caches keep the picture. */
  cachePolicy?: CodegenTypes.WithDefault<'memoryDisk' | 'memory' | 'disk' | 'none', 'memoryDisk'>;
  /** Download order. */
  priority?: CodegenTypes.WithDefault<'low' | 'normal' | 'high', 'normal'>;
  /** Plays animated pictures. */
  autoplay?: CodegenTypes.WithDefault<boolean, true>;
  /** Pinch, drag and double-tap gestures. */
  zoomable?: CodegenTypes.WithDefault<boolean, false>;
  /** Largest zoom. */
  maxZoom?: CodegenTypes.WithDefault<CodegenTypes.Double, 4>;
  /** Zoom of a double tap. */
  doubleTapZoom?: CodegenTypes.WithDefault<CodegenTypes.Double, 2.5>;
  /** Two-finger rotation (with `zoomable`). */
  rotatable?: CodegenTypes.WithDefault<boolean, false>;
  /** Corner radius the picture is clipped to (the view's `borderRadius`). */
  cornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Double, 0>;

  // `onImage*` prefix so they do not clash with events React Native already defines.
  /** The download started. */
  onImageLoadStart?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  /** Bytes received. */
  onImageProgress?: CodegenTypes.DirectEventHandler<ProgressEvent>;
  /** The picture is on screen (`cacheType`: `memory`, `disk` or `none`). */
  onImageLoad?: CodegenTypes.DirectEventHandler<LoadEvent>;
  /** The picture could not be loaded or decoded. */
  onImageError?: CodegenTypes.DirectEventHandler<ErrorEvent>;
  /** Zoom, offset or rotation changed. */
  onImageZoom?: CodegenTypes.DirectEventHandler<ZoomEvent>;
}

type ComponentType = HostComponent<NativeProps>;

// Codegen requires `React.ElementRef<...>` written inline as the first argument (no alias).
/** Commands sent from the `ref` (`ImageHandle`). */
interface NativeCommands {
  /** Zooms to `scale`; `focusX`/`focusY` in points (negative = the center). */
  zoomTo: (view: React.ElementRef<ComponentType>, scale: CodegenTypes.Double, focusX: CodegenTypes.Double, focusY: CodegenTypes.Double, animated: boolean) => void;
  resetZoom: (view: React.ElementRef<ComponentType>, animated: boolean) => void;
  rotateTo: (view: React.ElementRef<ComponentType>, degrees: CodegenTypes.Double, animated: boolean) => void;
  play: (view: React.ElementRef<ComponentType>) => void;
  pause: (view: React.ElementRef<ComponentType>) => void;
  reload: (view: React.ElementRef<ComponentType>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['zoomTo', 'resetZoom', 'rotateTo', 'play', 'pause', 'reload'],
});

export default codegenNativeComponent<NativeProps>('IsoImageView') as HostComponent<NativeProps>;
