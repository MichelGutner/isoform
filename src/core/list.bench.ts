/**
 * List benchmark: the case where per-component cost matters most.
 *
 * Each row is 4 styled components (a dynamic container, a dynamic title, a static caption and a
 * dynamic pressable), like a typical list item.
 *
 * - "scroll window": 30 rows mount and unmount per step, the way a virtualized list recycles them.
 * - "one row changes": a 500-row list whose parent re-renders because ONE row's `selected` flipped.
 *
 * `control` is the same tree with bare components (no library, no memo). Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { registerBundledProvider } from '../config';
import { StylizedBuilder } from './builder';
import { compare, flushResults, report } from './testing/benchHarness';
import { createFakeAdapter } from './testing/fakeAdapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const Base: React.FC<any> = () => null;
let compiles = 0;
const adapter = createFakeAdapter(Base);
const baseCompile = adapter.compileStyle;
adapter.compileStyle = (...args: Parameters<typeof baseCompile>) => {
  compiles++;
  return baseCompile(...args);
};
registerBundledProvider(adapter);

const Container = new StylizedBuilder(Base)
  .style((({ props }: any) => ({ padding: 12, backgroundColor: props.selected ? '#dbeafe' : '#fff' })) as any)
  .build();
const Title = new StylizedBuilder(Base)
  .style((({ props }: any) => ({ fontWeight: props.selected ? '700' : '500', fontSize: 16 })) as any)
  .build();
const Caption = new StylizedBuilder(Base).style({ fontSize: 12, color: '#6b7280' } as any).build();
const Action = new StylizedBuilder(Base)
  .style((({ props }: any) => ({ opacity: props.disabled ? 0.4 : 1, padding: 8 })) as any)
  .build();

type Parts = { Container: React.ComponentType<any>; Title: React.ComponentType<any>; Caption: React.ComponentType<any>; Action: React.ComponentType<any> };
const lib: Parts = { Container, Title, Caption, Action };
const bare: Parts = { Container: Base, Title: Base, Caption: Base, Action: Base };

/** One row. Props are primitives only, as in a real list item (the parent passes data and flags). */
const makeRow = (p: Parts) =>
  function Row({ id, selected }: { id: number; selected: boolean }) {
    return React.createElement(
      p.Container,
      { selected, testID: `row-${id}` },
      React.createElement(p.Title, { selected }),
      React.createElement(p.Caption, null),
      React.createElement(p.Action, { disabled: !selected }),
    );
  };

const ROWS_IN_WINDOW = 30;
const LIST_SIZE = 500;

describe('list benchmark', () => {
  afterAll(() => flushResults('list'));

  it('scroll window: rows mount and unmount', () => {
    const variants: Record<string, { step: () => void; cleanup: () => void }> = {};
    for (const [label, parts] of [['control (no library)', bare], ['library', lib]] as const) {
      const Row = makeRow(parts);
      let renderer!: TestRenderer.ReactTestRenderer;
      let start = 0;
      act(() => {
        renderer = TestRenderer.create(null);
      });
      variants[label] = {
        step: () => {
          start += ROWS_IN_WINDOW;
          act(() =>
            renderer.update(
              React.createElement(
                React.Fragment,
                null,
                Array.from({ length: ROWS_IN_WINDOW }, (_, i) =>
                  React.createElement(Row, { key: start + i, id: start + i, selected: (start + i) % 7 === 0 }),
                ),
              ),
            ),
          );
        },
        cleanup: () => act(() => renderer.unmount()),
      };
    }
    compiles = 0;
    const stats = compare(Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.step])), {
      iterations: 10,
      samples: 15,
      warmup: 20,
    });
    const libCompiles = compiles;
    Object.values(variants).forEach((v) => v.cleanup());

    report(
      `scroll window: ${ROWS_IN_WINDOW} rows (${ROWS_IN_WINDOW * 4} components) replaced per step`,
      Object.keys(stats).map((label) => ({
        label,
        stats: stats[label],
        counters: label === 'library' ? { compiles: libCompiles } : undefined,
      })),
      { control: 'control (no library)', per: ROWS_IN_WINDOW * 4, unit: 'µs' },
    );
    // rows differ only in primitives the styles read (2 values): everything past warm-up is a hit
    expect(libCompiles).toBeLessThanOrEqual(8);
  });

  it('one row changes in a 500-row list', () => {
    const variants: Record<string, { step: () => void; cleanup: () => void }> = {};
    for (const [label, parts] of [['control (no library, no memo)', bare], ['library', lib]] as const) {
      const Row = makeRow(parts);
      let renderer!: TestRenderer.ReactTestRenderer;
      let selected = 0;
      const tree = () =>
        React.createElement(
          React.Fragment,
          null,
          Array.from({ length: LIST_SIZE }, (_, i) => React.createElement(Row, { key: i, id: i, selected: i === selected })),
        );
      act(() => {
        renderer = TestRenderer.create(tree());
      });
      variants[label] = {
        step: () => {
          selected = (selected + 1) % LIST_SIZE;
          act(() => renderer.update(tree()));
        },
        cleanup: () => act(() => renderer.unmount()),
      };
    }
    const stats = compare(Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.step])), {
      iterations: 5,
      samples: 11,
      warmup: 10,
    });
    Object.values(variants).forEach((v) => v.cleanup());

    report(
      `one row changes in a ${LIST_SIZE}-row list (the parent re-renders all rows)`,
      Object.keys(stats).map((label) => ({ label, stats: stats[label] })),
    );
    expect(stats.library.median).toBeGreaterThan(0);
  });
});
