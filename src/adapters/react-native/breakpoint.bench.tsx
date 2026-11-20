/**
 * Breakpoint benchmark (React Native adapter).
 *
 * Counts how many components re-render when the window width changes, which is what rotation,
 * split-screen and foldables do. Components with `when('breakpoints:…')` only need to re-render
 * when the *active breakpoint* changes, not on every width change.
 *
 * Deterministic part (the CI gate): re-renders per width change.
 * Timing part (informative): time per width change on the test renderer.
 *
 * The real thing (a physical device, with the React Profiler) is `examples/showcase`'s
 * "Breakpoint perf" page.
 *
 * Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockWindow = { width: 400, height: 800 };
/** Listeners of the pre-store implementation (`useWindowDimensions`). */
const mockHookListeners = new Set<() => void>();
/** Listeners of `Dimensions.addEventListener('change', …)`. */
const mockChangeListeners = new Set<(e: { window: { width: number; height: number } }) => void>();
/** How many times the host component was rendered (the primitive `View` is the leaf). */
const mockCounters = { viewRenders: 0 };

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten: (style: any) => style },
  Dimensions: {
    get: () => ({ ...mockWindow }),
    addEventListener: (_: 'change', handler: (e: any) => void) => {
      mockChangeListeners.add(handler);
      return { remove: () => mockChangeListeners.delete(handler) };
    },
  },
  useWindowDimensions: () => {
    const R = require('react');
    const [, force] = R.useReducer((n: number) => n + 1, 0);
    R.useEffect(() => {
      mockHookListeners.add(force);
      return () => mockHookListeners.delete(force);
    }, []);
    return { ...mockWindow };
  },
  Easing: { bezier: (...args: number[]) => Object.assign((t: number) => t, { args }) },
  Animated: { Value: class {}, timing: () => ({ start: () => {}, stop: () => {} }), createAnimatedComponent: (C: any) => C },
  View: () => {
    mockCounters.viewRenders++;
    return null;
  },
  Text: () => null,
  TextInput: () => null,
  Pressable: () => null,
  ScrollView: () => null,
}));

import { registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { compare, flushResults, report } from '../../core/testing/benchHarness';
import { reactNativeAdapter } from './adapter';

const COMPONENTS = 200;

/** Moves the window and notifies every subscriber, the way the OS does on rotation/resize. */
const setWidth = (width: number) => {
  mockWindow.width = width;
  act(() => {
    mockHookListeners.forEach((l) => l());
    mockChangeListeners.forEach((l) => l({ window: { ...mockWindow } }));
  });
};

describe('breakpoint benchmark', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterAll(() => flushResults('breakpoint'));

  it('re-renders per window width change', () => {
    // two ranges (`md` ≥ 768, `lg` ≥ 1024): same-range changes must not re-render anything
    const Panel = engine('Box', { padding: 8 })
      .when('breakpoints:md', { style: { padding: 16 } })
      .when('breakpoints:lg', { style: { padding: 24 } });

    mockWindow.width = 400;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <>
          {Array.from({ length: COMPONENTS }, (_, i) => (
            <Panel key={i} />
          ))}
        </>,
      );
    });

    const measureChange = (widths: number[]) => {
      let i = 0;
      return () => setWidth(widths[i++ % widths.length]);
    };

    const counted = (label: string, widths: number[]) => {
      const step = measureChange(widths);
      step(); // settle on the first width: from here every step is a real change
      mockCounters.viewRenders = 0;
      const calls = 40;
      for (let k = 0; k < calls; k++) step();
      return { label, rendersPerChange: mockCounters.viewRenders / calls };
    };

    // 400 → 410 → 420 … all `< md`: the active breakpoint never changes
    const sameBucket = counted('width changes inside one breakpoint', [400, 410, 420, 430]);
    // 700 ↔ 800 crosses `md`: every component legitimately re-renders
    const crossing = counted('width crosses a breakpoint', [700, 800]);

    const stats = compare(
      {
        [sameBucket.label]: measureChange([400, 410, 420, 430]),
        [crossing.label]: measureChange([700, 800]),
      },
      { iterations: 10, samples: 15, warmup: 10 },
    );

    report(`${COMPONENTS} components with breakpoints, window width changes`, [
      {
        label: sameBucket.label,
        stats: stats[sameBucket.label],
        counters: { 'renders/change': sameBucket.rendersPerChange },
      },
      {
        label: crossing.label,
        stats: stats[crossing.label],
        counters: { 'renders/change': crossing.rendersPerChange },
      },
    ]);

    act(() => renderer.unmount());

    // a width change inside one breakpoint must not re-render anything...
    expect(sameBucket.rendersPerChange).toBe(0);
    // ...and a real breakpoint change must still update everything
    expect(crossing.rendersPerChange).toBe(COMPONENTS);
  });
});
