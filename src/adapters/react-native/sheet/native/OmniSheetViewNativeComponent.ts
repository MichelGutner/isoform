/**
 * Spec of the native bottom sheet (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props and events) used by:
 *  · iOS:     ios/sheet/OmniSheetView.mm + ios/sheet/OmniSheet.swift (SwiftUI `.sheet`)
 *  · Android: android/src/sheet/.../OmniSheetViewManager.kt + OmniSheetView.kt (Jetpack Compose)
 *
 * The React children are mounted by Fabric into this view and moved by the native
 * side into the sheet's content area, so they stay regular React Native views.
 */
import { codegenNativeComponent } from 'react-native';
import type { CodegenTypes, ColorValue, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type LayoutEvent = Readonly<{ width: CodegenTypes.Double; height: CodegenTypes.Double }>;
type DetentEvent = Readonly<{ index: CodegenTypes.Int32 }>;

export interface NativeProps extends ViewProps {
  /** Shown or hidden (animated both ways). */
  open?: CodegenTypes.WithDefault<boolean, false>;
  /** Rest heights: `fit`, `full`, `50%` or a number of points/dp. */
  detents?: ReadonlyArray<string>;
  /** Index in `detents` to rest at. */
  detent?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /** Measured height of the content, for the `fit` detent (0 = not measured yet). */
  contentHeight?: CodegenTypes.WithDefault<CodegenTypes.Double, 0>;
  /** Whether the user can close it. */
  dismissible?: CodegenTypes.WithDefault<boolean, true>;
  /** Backdrop that blocks the screen behind. */
  modal?: CodegenTypes.WithDefault<boolean, true>;
  /** The handle on top. */
  grabber?: CodegenTypes.WithDefault<boolean, true>;
  /** Surface color (unset = the platform's sheet background). */
  sheetColor?: ColorValue;
  /** Top corner radius (negative = the platform's). */
  cornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Double, -1>;

  // `onSheet*` prefix so they do not clash with events React Native already defines.
  /** Size of the content area (the children are laid out to it). */
  onSheetLayout?: CodegenTypes.DirectEventHandler<LayoutEvent>;
  /** The user closed it (drag down, backdrop, back button). */
  onSheetDismiss?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  /** The closing animation ended. */
  onSheetClosed?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  /** The user moved it to another detent (index in `detents`). */
  onSheetDetent?: CodegenTypes.DirectEventHandler<DetentEvent>;
}

export default codegenNativeComponent<NativeProps>('OmniSheetView') as HostComponent<NativeProps>;
