/**
 * Theme switch benchmark (web adapter): what a light↔dark toggle costs with 1,000 styled components
 * mounted, with and without `performance.themeVariables`.
 *
 * Deterministic part (the CI gate): component renders and style compilations per toggle.
 * Timing part (informative): wall-clock per toggle on the test renderer.
 *
 * Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { configure, registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { compare, flushResults, report, type Row } from '../../core/testing/benchHarness';
import { updateTheme } from '../../theme';
import { reactDomAdapter } from './adapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BUILDERS = 100;
const PER_BUILDER = 10; // 1,000 components
const LIGHT = { color: { bg: '#ffffff', text: '#111111', border: '#dddddd' }, spacing: { md: 8 } };
const DARK = { color: { bg: '#000000', text: '#eeeeee', border: '#333333' }, spacing: { md: 12 } };

/** Components whose style only reads color tokens (the common case), optionally with some reading a number. */
function makeBuilders(realReadEvery: number) {
  return Array.from({ length: BUILDERS }, (_, b) =>
    engine('Box', ({ theme }: any) => ({
      backgroundColor: theme.color.bg,
      color: theme.color.text,
      borderColor: theme.color.border,
      margin: b + 1,
      ...(realReadEvery && b % realReadEvery === 0 ? { padding: theme.spacing.md } : null),
    })),
  );
}

function mount(builders: ReturnType<typeof makeBuilders>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <>
        {builders.flatMap((Item, b) =>
          Array.from({ length: PER_BUILDER }, (_, i) => React.createElement(Item as any, { key: `${b}-${i}` })),
        )}
      </>,
    );
  });
  return renderer;
}

interface Measured {
  row: Row;
}

function measure(label: string, variableKeys: string[] | null, realReadEvery: number): Measured {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  act(() => {
    updateTheme(LIGHT as any);
  });
  configure({ performance: { themeVariables: variableKeys ?? [] } });

  const renders = jest.spyOn(reactDomAdapter, 'applyProps');
  const compiles = jest.spyOn(reactDomAdapter, 'compileStyle');
  const renderer = mount(makeBuilders(realReadEvery));

  let dark = false;
  const toggle = () => {
    dark = !dark;
    act(() => {
      updateTheme((dark ? DARK : LIGHT) as any);
    });
  };
  toggle(); // visit both themes once: the first visit to each is a legitimate compile
  toggle();

  renders.mockClear();
  compiles.mockClear();
  let toggles = 0;
  const stats = compare(
    {
      [label]: () => {
        toggles++;
        toggle();
      },
    },
    { iterations: 6, samples: 11, warmup: 6 },
  );
  const row: Row = {
    label,
    stats: stats[label],
    counters: {
      'renders/toggle': Math.round(renders.mock.calls.length / toggles),
      'compiles/toggle': Math.round(compiles.mock.calls.length / toggles),
    },
  };
  act(() => renderer.unmount());
  renders.mockRestore();
  compiles.mockRestore();
  return { row };
}

describe('theme switch benchmark (web)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    resetProvider();
    flushResults('themeToggle');
  });

  it('light↔dark with 1,000 components mounted', () => {
    // each mode twice, interleaved, so run order does not decide the result
    const off1 = measure('off (tokens are values)', null, 0);
    const on1 = measure('themeVariables: [color]', ['color'], 0);
    const off2 = measure('off (tokens are values)', null, 0);
    const on2 = measure('themeVariables: [color]', ['color'], 0);
    const mixedOff = measure('off, 10% also read a number', null, 10);
    const mixedOn = measure('themeVariables, 10% also read a number', ['color'], 10);

    report('theme toggle, 1,000 components (all styles read color tokens only)', [off1.row, on1.row, off2.row, on2.row]);
    report('theme toggle, 1,000 components (10% of the builders also read spacing)', [mixedOff.row, mixedOn.row]);

    // deterministic gates
    expect(on1.row.counters!['renders/toggle']).toBe(0);
    expect(on1.row.counters!['compiles/toggle']).toBe(0);
    expect(on2.row.counters!['renders/toggle']).toBe(0);
    // components that read a number keep following the theme (10 of 100 builders → 100 components), no more
    expect(mixedOn.row.counters!['renders/toggle']).toBe((BUILDERS / 10) * PER_BUILDER);
    expect(mixedOn.row.counters!['compiles/toggle']).toBe(0);
    // without the feature every component renders on every toggle
    expect(off1.row.counters!['renders/toggle']).toBe(BUILDERS * PER_BUILDER);
  });
});
