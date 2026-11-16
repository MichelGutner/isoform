/**
 * Spec of the native date picker (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props and events) used by:
 *  · iOS:     ios/datePicker/OmniDatePickerView.mm + ios/datePicker/OmniDatePicker.swift (SwiftUI `DatePicker`)
 *  · Android: android/src/datePicker/.../OmniDatePickerViewManager.kt + OmniDatePickerView.kt (Jetpack Compose, Material 3)
 *
 * Moments travel as milliseconds since the epoch (UTC); each side shows them in the device's time zone.
 */
import { codegenNativeComponent } from 'react-native';
import type { CodegenTypes, ColorValue, HostComponent, ViewProps } from 'react-native';

type ValueEvent = Readonly<{ value: CodegenTypes.Double }>;
type SizeEvent = Readonly<{ width: CodegenTypes.Double; height: CodegenTypes.Double }>;

export interface NativeProps extends ViewProps {
  /** The selected moment (ms since the epoch). */
  value?: CodegenTypes.WithDefault<CodegenTypes.Double, 0>;
  /** What it edits. */
  mode?: CodegenTypes.WithDefault<'date' | 'time' | 'datetime', 'date'>;
  /** How it is drawn. */
  display?: CodegenTypes.WithDefault<'inline' | 'wheel' | 'compact', 'inline'>;
  /** Earliest moment (ms); `-8.64e15` means no limit. */
  minimumDate?: CodegenTypes.WithDefault<CodegenTypes.Double, -8640000000000000>;
  /** Latest moment (ms); `8.64e15` means no limit. */
  maximumDate?: CodegenTypes.WithDefault<CodegenTypes.Double, 8640000000000000>;
  /** BCP 47 language tag; empty = the device's. */
  locale?: string;
  /** `auto` follows the locale; `h12` / `h24` force the clock. */
  hourCycle?: CodegenTypes.WithDefault<'auto' | 'h12' | 'h24', 'auto'>;
  /** Accent color (unset = the platform's). */
  tintColor?: ColorValue;
  /** Blocks the picker. */
  disabled?: CodegenTypes.WithDefault<boolean, false>;

  // `onPicker*` prefix so they do not clash with events React Native already defines.
  /** The user picked a moment. */
  onPickerChange?: CodegenTypes.DirectEventHandler<ValueEvent>;
  /** Natural size of the picker (the view is sized to it). */
  onPickerSize?: CodegenTypes.DirectEventHandler<SizeEvent>;
}

export default codegenNativeComponent<NativeProps>('OmniDatePickerView') as HostComponent<NativeProps>;
