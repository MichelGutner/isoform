/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { isModuleEnabled } from '../../../config';
import {
  clampDate,
  defaultHeight,
  hourCycle,
  maximumMillis,
  minimumMillis,
  sameMoment,
  toMillis,
  type DatePickerOwnProps,
} from '../../../core/datePicker';
import { warnModuleDisabled } from '../../../core/modules';

declare const require: (id: string) => any;

/** The spec is only loaded when a picker renders: importing the adapter (tests included) does not need Codegen. */
type Spec = typeof import('./native/IsoDatePickerViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoDatePickerViewNativeComponent'));

type Props = DatePickerOwnProps & { style?: any; testID?: string };

/**
 * Entry point of `DatePicker` on mobile. With `modules.datePicker` off nothing is
 * rendered (and a dev warning is shown), instead of "native component not found".
 */
export const DatePicker = (props: Props) => {
  if (!isModuleEnabled('datePicker')) {
    warnModuleDisabled('datePicker');
    return null;
  }
  return <NativeDatePicker {...props} />;
};
DatePicker.displayName = 'DatePicker';

/**
 * The picker: the native view is sized to what it reports (a calendar is taller than
 * a pill), unless the style gives a `height`. Changes are clamped to the limits here,
 * so every platform follows the same rule, and reported only when they are new.
 */
function NativeDatePicker({
  value,
  onValueChange,
  mode = 'date',
  display = 'inline',
  minimumDate,
  maximumDate,
  locale,
  is24Hour,
  tintColor,
  disabled = false,
  label,
  style,
  testID,
}: Props) {
  const { default: NativePicker } = nativeSpec();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // "now" until the app passes a value; frozen so a re-render does not move the picker
  const fallback = useMemo(() => Date.now(), []);
  const current = toMillis(value, fallback);

  return (
    <NativePicker
      style={[{ height: size?.height ?? defaultHeight(mode, display) }, styles.fill, style]}
      value={current}
      mode={mode}
      display={display}
      minimumDate={minimumMillis(minimumDate)}
      maximumDate={maximumMillis(maximumDate)}
      locale={locale ?? ''}
      hourCycle={hourCycle(is24Hour)}
      tintColor={tintColor}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      onPickerSize={({ nativeEvent }) => setSize({ width: nativeEvent.width, height: nativeEvent.height })}
      onPickerChange={({ nativeEvent }) => {
        const next = clampDate(new Date(nativeEvent.value), minimumDate, maximumDate);
        if (!sameMoment(next, new Date(current))) onValueChange?.(next);
      }}
    />
  );
}

const styles = StyleSheet.create({
  // wide by default, like the web input's block; a `width` in the style wins
  fill: { alignSelf: 'stretch' },
});
