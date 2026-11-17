import React, { type CSSProperties, type InputHTMLAttributes } from 'react';
import { isModuleEnabled } from '../../../config';
import {
  clampDate,
  fromInputValue,
  sameMoment,
  toInputValue,
  type DatePickerMode,
  type DatePickerOwnProps,
} from '../../../core/datePicker';
import { warnModuleDisabled } from '../../../core/modules';

/** Props of the web picker: its own, plus what the adapter adds (`className`, `data-*`…). */
export type DatePickerElementProps = DatePickerOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof DatePickerOwnProps | 'type' | 'value' | 'min' | 'max' | 'children'> & {
    'data-testid'?: string;
  };

/** The browser's input for each mode. */
const INPUT_TYPE: Record<DatePickerMode, string> = { date: 'date', time: 'time', datetime: 'datetime-local' };

/**
 * Web `DatePicker`: the browser's own date/time input (calendar popup, keyboard entry,
 * screen-reader support and the user's locale come with it). A half-typed entry reports
 * nothing until it is a complete date. With the module off it renders nothing but warns
 * once, like the native pickers.
 */
export const DatePicker = ({
  value,
  onValueChange,
  mode = 'date',
  display: _display,
  minimumDate,
  maximumDate,
  locale,
  is24Hour: _is24Hour,
  tintColor,
  disabled = false,
  label,
  style,
  // the engine's own props never belong on an <input>
  testID: _testID,
  ...rest
}: DatePickerElementProps & { testID?: string }) => {
  if (!isModuleEnabled('datePicker')) {
    warnModuleDisabled('datePicker');
    return null;
  }

  const css: CSSProperties = { ...(style as CSSProperties), accentColor: tintColor, colorScheme: 'light dark' };

  return (
    <input
      {...rest}
      type={INPUT_TYPE[mode]}
      lang={locale}
      style={css}
      disabled={disabled}
      aria-label={label}
      value={toInputValue(value, mode)}
      min={minimumDate ? toInputValue(minimumDate, mode) : undefined}
      max={maximumDate ? toInputValue(maximumDate, mode) : undefined}
      onChange={(event) => {
        const picked = fromInputValue(event.target.value, mode, value ?? new Date());
        if (!picked) return;
        const next = clampDate(picked, minimumDate, maximumDate);
        if (!sameMoment(next, value)) onValueChange?.(next);
      }}
    />
  );
};
DatePicker.displayName = 'DatePicker';
