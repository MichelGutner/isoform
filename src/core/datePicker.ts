/**
 * `DatePicker`: pick a date, a time or both.
 * iOS (SwiftUI) and Android (Jetpack Compose): the lib's own picker, the same design on
 * both — a calendar with a month/year panel, spinning wheels and compact pills that open
 * a sheet. Web: the browser's own `<input type="date | time | datetime-local">`.
 */

/** What the picker edits. */
export type DatePickerMode = 'date' | 'time' | 'datetime';

/**
 * How the picker is drawn.
 * - `'inline'`: always visible: a calendar (with the time behind a pill in `datetime`),
 *   or the time wheels in `time`. The default.
 * - `'wheel'`: day, month and year wheels (in the locale's order) and the time wheels.
 * - `'compact'`: pills with the value that open the picker in a bottom sheet.
 * The web always shows the browser's input.
 */
export type DatePickerDisplay = 'inline' | 'wheel' | 'compact';

/** Props of `DatePicker` besides the common ones (`style`, `testID`…). */
export interface DatePickerOwnProps {
  /** The selected moment. Shows "now" until you pass one. Keep it in state (controlled). */
  value?: Date | null;
  /** Called with the new moment when the user changes it (already inside `minimumDate`/`maximumDate`). */
  onValueChange?: (value: Date) => void;
  /** `'date'`, `'time'` or `'datetime'`. Default `'date'`. */
  mode?: DatePickerMode;
  /** How it is drawn. Default `'inline'`. */
  display?: DatePickerDisplay;
  /** The earliest moment the user can pick. */
  minimumDate?: Date;
  /** The latest moment the user can pick. */
  maximumDate?: Date;
  /**
   * Language and region of the labels (BCP 47: `'pt-BR'`, `'en-US'`).
   * Default: the device's (the browser's on the web).
   */
  locale?: string;
  /** Forces the 24-hour (`true`) or 12-hour (`false`) clock. Default: follows the locale. */
  is24Hour?: boolean;
  /** Accent color (selected day, clock hand). Default: the platform's. */
  tintColor?: string;
  /** Blocks the picker. Default `false`. */
  disabled?: boolean;
  /** Accessible name (`aria-label` on the web). */
  label?: string;
}

/** Hour cycle as the native views read it. */
export type NativeHourCycle = 'auto' | 'h12' | 'h24';

/** Limits are always sent to the native views; this value means "no limit" (the range of a JS `Date`). */
export const NO_LIMIT = 8.64e15;

/**
 * Height (in dp/pt) the picker takes before the native view reports its own; the same
 * on iOS and Android (calendar: header 44 + weekdays 28 + six rows of 44 + padding 24;
 * wheels: five rows of 36 + padding 24; pills: 36).
 */
export const DEFAULT_HEIGHT: Record<DatePickerMode, Record<DatePickerDisplay, number>> = {
  date: { inline: 360, wheel: 204, compact: 36 },
  time: { inline: 204, wheel: 204, compact: 36 },
  datetime: { inline: 413, wheel: 396, compact: 36 },
};

/** The first height to use for `mode` and `display`, until the native view reports the real one. */
export const defaultHeight = (mode: DatePickerMode = 'date', display: DatePickerDisplay = 'inline'): number =>
  DEFAULT_HEIGHT[mode][display];

/** A valid `Date` as milliseconds, or `fallback` for `null`, `undefined` and "Invalid Date". */
export function toMillis(date: Date | null | undefined, fallback: number): number {
  const time = date?.getTime();
  return time === undefined || Number.isNaN(time) ? fallback : time;
}

/** `minimumDate` as the native views read it (`-NO_LIMIT` when there is none). */
export const minimumMillis = (date: Date | undefined): number => toMillis(date, -NO_LIMIT);

/** `maximumDate` as the native views read it (`NO_LIMIT` when there is none). */
export const maximumMillis = (date: Date | undefined): number => toMillis(date, NO_LIMIT);

/** Whether a limit sent to the native views means "no limit". */
export const isNoLimit = (millis: number): boolean => Math.abs(millis) >= NO_LIMIT;

/** `is24Hour` as the native views read it. */
export const hourCycle = (is24Hour: boolean | undefined): NativeHourCycle =>
  is24Hour === undefined ? 'auto' : is24Hour ? 'h24' : 'h12';

/**
 * Keeps `date` inside the limits.
 * @param date The moment to check.
 * @param minimum Earliest allowed moment, if any.
 * @param maximum Latest allowed moment, if any.
 */
export function clampDate(date: Date, minimum?: Date, maximum?: Date): Date {
  const time = date.getTime();
  const low = toMillis(minimum, -Infinity);
  const high = toMillis(maximum, Infinity);
  if (time < low) return new Date(low);
  if (time > high) return new Date(high);
  return date;
}

/** Whether two moments are the same millisecond (and both valid). */
export const sameMoment = (a: Date | null | undefined, b: Date | null | undefined): boolean =>
  toMillis(a, NaN) === toMillis(b, NaN);

const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

/** `2026-11-16`, in local time. */
export const toDateText = (date: Date): string => `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `14:05`, in local time. */
export const toTimeText = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * The value of an `<input>` for `mode`, in local time:
 * `2026-11-16`, `14:05` or `2026-11-16T14:05`.
 */
export function toInputValue(date: Date | null | undefined, mode: DatePickerMode): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  if (mode === 'date') return toDateText(date);
  if (mode === 'time') return toTimeText(date);
  return `${toDateText(date)}T${toTimeText(date)}`;
}

const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_TEXT = /^(\d{2}):(\d{2})$/;

/**
 * The moment an `<input>` text means, in local time.
 * `'time'` keeps the day of `base` (the previous value, or today); `'date'` keeps its time of day.
 * @returns `null` for empty or malformed text.
 */
export function fromInputValue(text: string, mode: DatePickerMode, base: Date = new Date()): Date | null {
  const [datePart, timePart] = mode === 'datetime' ? text.split('T') : mode === 'date' ? [text, ''] : ['', text];
  const day = mode === 'time' ? undefined : DATE_TEXT.exec(datePart ?? '');
  const clock = mode === 'date' ? undefined : TIME_TEXT.exec(timePart ?? '');
  if (mode !== 'time' && !day) return null;
  if (mode !== 'date' && !clock) return null;

  const next = new Date(base.getTime());
  if (day) next.setFullYear(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  if (clock) next.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
}
