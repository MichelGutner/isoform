/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactDomAdapter } from '../adapter';

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

const Picker = engine('DatePicker', { marginTop: 8 });

describe('DatePicker (web)', () => {
  it('renders the browser input for each mode, with the value and limits', () => {
    configure({ modules: { datePicker: true } });
    const value = new Date(2026, 10, 16, 14, 5);
    const { container, rerender } = render(
      <Picker value={value} minimumDate={new Date(2026, 0, 1)} maximumDate={new Date(2026, 11, 31)} label="Birthday" />,
    );
    const input = container.querySelector('input')!;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-11-16');
    expect(input.min).toBe('2026-01-01');
    expect(input.max).toBe('2026-12-31');
    expect(input.getAttribute('aria-label')).toBe('Birthday');

    rerender(<Picker value={value} mode="time" />);
    expect(container.querySelector('input')!.type).toBe('time');
    expect(container.querySelector('input')!.value).toBe('14:05');

    rerender(<Picker value={value} mode="datetime" />);
    expect(container.querySelector('input')!.type).toBe('datetime-local');
    expect(container.querySelector('input')!.value).toBe('2026-11-16T14:05');
  });

  it('reports the picked date, clamped, keeping the time of day', () => {
    configure({ modules: { datePicker: true } });
    const onValueChange = jest.fn();
    const value = new Date(2026, 5, 10, 9, 30);
    const { container } = render(
      <Picker value={value} onValueChange={onValueChange} maximumDate={new Date(2026, 5, 30, 23, 59)} />,
    );
    const input = container.querySelector('input')!;

    fireEvent.change(input, { target: { value: '2026-06-20' } });
    fireEvent.change(input, { target: { value: '2026-09-01' } });
    // a half-typed entry reports nothing
    fireEvent.change(input, { target: { value: '' } });

    expect(onValueChange.mock.calls.map(([date]) => date)).toEqual([new Date(2026, 5, 20, 9, 30), new Date(2026, 5, 30, 23, 59)]);
  });

  it('renders nothing (with a warning) while the module is off', () => {
    const { container } = render(<Picker value={new Date(0)} />);
    expect(container.querySelector('input')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"datePicker"'));
  });
});
