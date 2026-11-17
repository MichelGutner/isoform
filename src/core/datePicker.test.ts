import {
  NO_LIMIT,
  clampDate,
  defaultHeight,
  fromInputValue,
  hourCycle,
  isNoLimit,
  maximumMillis,
  minimumMillis,
  sameMoment,
  toInputValue,
} from './datePicker';

const at = (year: number, month: number, day: number, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute);

describe('datePicker helpers', () => {
  it('formats the value of an input in local time', () => {
    const date = at(2026, 11, 16, 14, 5);
    expect(toInputValue(date, 'date')).toBe('2026-11-16');
    expect(toInputValue(date, 'time')).toBe('14:05');
    expect(toInputValue(date, 'datetime')).toBe('2026-11-16T14:05');
    expect(toInputValue(null, 'date')).toBe('');
    expect(toInputValue(new Date(Number.NaN), 'date')).toBe('');
  });

  it('reads an input back, keeping what the mode does not edit', () => {
    const base = at(2026, 1, 2, 9, 30);
    expect(fromInputValue('2026-11-16', 'date', base)).toEqual(at(2026, 11, 16, 9, 30));
    expect(fromInputValue('14:05', 'time', base)).toEqual(at(2026, 1, 2, 14, 5));
    expect(fromInputValue('2026-11-16T14:05', 'datetime', base)).toEqual(at(2026, 11, 16, 14, 5));
  });

  it('returns null for empty or malformed text', () => {
    expect(fromInputValue('', 'date')).toBeNull();
    expect(fromInputValue('16/11/2026', 'date')).toBeNull();
    expect(fromInputValue('25', 'time')).toBeNull();
    expect(fromInputValue('2026-11-16', 'datetime')).toBeNull();
  });

  it('clamps to the limits', () => {
    const low = at(2026, 1, 1);
    const high = at(2026, 12, 31);
    expect(clampDate(at(2025, 6, 1), low, high)).toEqual(low);
    expect(clampDate(at(2027, 6, 1), low, high)).toEqual(high);
    const inside = at(2026, 6, 1);
    expect(clampDate(inside, low, high)).toBe(inside);
    expect(clampDate(inside)).toBe(inside);
  });

  it('sends "no limit" to the native views', () => {
    expect(minimumMillis(undefined)).toBe(-NO_LIMIT);
    expect(maximumMillis(undefined)).toBe(NO_LIMIT);
    expect(maximumMillis(new Date(1000))).toBe(1000);
    expect(isNoLimit(NO_LIMIT)).toBe(true);
    expect(isNoLimit(-NO_LIMIT)).toBe(true);
    expect(isNoLimit(1000)).toBe(false);
  });

  it('maps is24Hour to a hour cycle', () => {
    expect(hourCycle(undefined)).toBe('auto');
    expect(hourCycle(true)).toBe('h24');
    expect(hourCycle(false)).toBe('h12');
  });

  it('compares moments and picks a first height', () => {
    expect(sameMoment(new Date(5), new Date(5))).toBe(true);
    expect(sameMoment(new Date(5), new Date(6))).toBe(false);
    expect(sameMoment(null, undefined)).toBe(false);
    expect(defaultHeight()).toBe(360);
    expect(defaultHeight('time', 'compact')).toBe(36);
  });
});
