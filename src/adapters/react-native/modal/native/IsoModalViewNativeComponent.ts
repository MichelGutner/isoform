/**
 * Spec of the native modal (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props and events) used by:
 *  · iOS:     ios/modal/IsoModalView.mm + ios/modal/IsoModal.swift (UIKit)
 *  · Android: android/src/modal/.../IsoModalViewManager.kt + IsoModalView.kt (Jetpack Compose)
 *
 * The React children are mounted by Fabric into this view and moved by the native
 * side into the modal's card, so they stay regular React Native views.
 */
import { codegenNativeComponent } from 'react-native';
import type { CodegenTypes, ColorValue, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type LayoutEvent = Readonly<{ width: CodegenTypes.Double; height: CodegenTypes.Double }>;

export interface NativeProps extends ViewProps {
  /** Shown or hidden (animated both ways). */
  open?: CodegenTypes.WithDefault<boolean, false>;
  /** Centered card or the whole screen. */
  presentation?: CodegenTypes.WithDefault<'dialog' | 'fullScreen', 'dialog'>;
  /** Enter and exit animation. */
  animation?: CodegenTypes.WithDefault<'scale' | 'slide' | 'fade' | 'none', 'scale'>;
  /** Whether the user can close it. */
  dismissible?: CodegenTypes.WithDefault<boolean, true>;
  /** Backdrop behind a dialog. */
  backdropColor?: ColorValue;
  /** Card color (unset = the system background: white, or dark gray in dark mode). */
  surfaceColor?: ColorValue;
  /** Card corner radius (negative = the default 20). */
  cornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Double, -1>;
  /** Widest dialog card, in points (the screen minus 24 on each side is the limit). */
  maxWidth?: CodegenTypes.WithDefault<CodegenTypes.Double, 420>;
  /** Measured height of a dialog's content (0 = not measured yet). */
  contentHeight?: CodegenTypes.WithDefault<CodegenTypes.Double, 0>;

  // `onModal*` prefix so they do not clash with events React Native already defines.
  /** The content area: the card's width and tallest height (dialog), or the safe area (full screen). */
  onModalLayout?: CodegenTypes.DirectEventHandler<LayoutEvent>;
  /** The user closed it (backdrop, back button, escape gesture). */
  onModalDismiss?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  /** The closing animation ended. */
  onModalClosed?: CodegenTypes.DirectEventHandler<EmptyEvent>;
}

export default codegenNativeComponent<NativeProps>('IsoModalView') as HostComponent<NativeProps>;
