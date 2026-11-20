/* eslint-disable @typescript-eslint/no-explicit-any */
import { warnModuleDisabled } from '../../../core/modules';

/**
 * `DatePicker` without the native picker: `react-isoform/metro` uses this file instead of
 * `DatePicker.tsx` when the date picker is off in `isoform.config.json`, so neither the
 * picker nor its native spec enter the JS bundle.
 */
export const DatePicker = (_props: any) => {
  warnModuleDisabled('datePicker');
  return null;
};
DatePicker.displayName = 'DatePicker';
