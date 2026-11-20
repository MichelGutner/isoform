/**
 * Render benchmark for StylizedBuilder.
 *
 * Not part of the regular `yarn test` run (see the `bench` script).
 *
 * How to read it
 * - Every scenario mounts a tree of SIBLINGS components and re-renders the whole tree, so the cost
 *   of the library is multiplied and rises above the cost of the test renderer.
 * - `control` is the same tree without the library (a bare component). The library's own cost is
 *   `variant − control`, printed as "over control".
 * - Variants are timed round-robin (see `compare`), so run order does not decide the result.
 * - Timings are for humans and trend charts. The CI gates are the deterministic counters
 *   (compiles per render, renders per breakpoint change), which do not flake.
 *
 * Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { registerBundledProvider } from '../config';
import { updateTheme } from '../theme';
import { StylizedBuilder } from './builder';
import { compare, flushResults, report, type Row } from './testing/benchHarness';
import { createFakeAdapter } from './testing/fakeAdapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const SIBLINGS = 300;
const BUILDERS = 100;
const ITERATIONS = 20;

const Base: React.FC<any> = () => null;

/** Fake adapter that counts how many styles were compiled (= builder cache misses). */
const adapter = createFakeAdapter(Base);
let compiles = 0;
const baseCompile = adapter.compileStyle;
adapter.compileStyle = (...args: Parameters<typeof baseCompile>) => {
  compiles++;
  return baseCompile(...args);
};
registerBundledProvider(adapter);

type PropsFor = (iteration: number, index: number) => Record<string, unknown>;

/** `count` siblings of `Item`, re-rendered with props from `propsFor(iteration, index)`. */
function mountTree(Items: React.ComponentType<any>[], propsFor: PropsFor) {
  let iteration = 0;
  let renderer!: TestRenderer.ReactTestRenderer;
  const element = () =>
    React.createElement(
      React.Fragment,
      null,
      Items.map((Item, j) => React.createElement(Item, { key: j, ...propsFor(iteration, j) })),
    );
  act(() => {
    renderer = TestRenderer.create(element());
  });
  return {
    /** Re-renders the tree with the next iteration's props. */
    step: () => {
      iteration++;
      act(() => renderer.update(element()));
    },
    unmount: () => act(() => renderer.unmount()),
  };
}

const same = (Item: React.ComponentType<any>) => Array.from({ length: SIBLINGS }, () => Item);

const dynamicFn = (({ props }: any) => ({ padding: 16, opacity: props.disabled ? 0.5 : 1 })) as any;
const sizeFn = (({ props }: any) => ({ width: props.size })) as any;

describe('render benchmark', () => {
  afterAll(() => flushResults('render'));

  it('cost per render, and how many styles each scenario recompiles', () => {
    const scenarios: Array<{ label: string; Item: React.ComponentType<any>; propsFor: PropsFor }> = [
      { label: 'control (no library)', Item: Base, propsFor: (_i, j) => ({ testID: `t${j}` }) },
      {
        label: 'control, children new each render',
        Item: Base,
        propsFor: () => ({ children: React.createElement('i') }),
      },
      {
        label: 'static style',
        Item: new StylizedBuilder(Base).style({ padding: 16, backgroundColor: 'white' } as any).build(),
        propsFor: (_i, j) => ({ testID: `t${j}` }),
      },
      {
        label: 'dynamic, same props (cache hit)',
        Item: new StylizedBuilder(Base).style(dynamicFn).build(),
        propsFor: () => ({ disabled: true }),
      },
      {
        // the common real case: JSX children are a new element on every parent render
        label: 'dynamic, children are new each render',
        Item: new StylizedBuilder(Base).style(dynamicFn).build(),
        propsFor: () => ({ disabled: true, children: React.createElement('i') }),
      },
      {
        label: 'dynamic, 2 values alternating',
        Item: new StylizedBuilder(Base).style(dynamicFn).build(),
        propsFor: (i) => ({ disabled: i % 2 === 0 }),
      },
      {
        // the style reads only `disabled`; testID is unique per item and onPress is a new closure
        // each render. Neither affects the style, so a perfect cache would hit every time.
        label: 'dynamic, unrelated props vary',
        Item: new StylizedBuilder(Base).style(dynamicFn).build(),
        propsFor: (i, j) => ({ disabled: true, testID: `t${i}-${j}`, onPress: () => i }),
      },
      {
        // the style reads `size`, which really changes: every render needs a new style
        label: 'dynamic, high-cardinality prop',
        Item: new StylizedBuilder(Base).style(sizeFn).build(),
        propsFor: (i, j) => ({ size: (i * SIBLINGS + j) % 5000 }),
      },
    ];

    const trees = scenarios.map((s) => ({ ...s, tree: mountTree(same(s.Item), s.propsFor), compiles: 0 }));
    const variants = Object.fromEntries(
      trees.map((t) => [
        t.label,
        () => {
          const before = compiles;
          t.tree.step();
          t.compiles += compiles - before;
        },
      ]),
    );

    const stats = compare(variants, { iterations: ITERATIONS, samples: 15, warmup: 30 });
    // compiles were also counted during warm-up: normalise by the number of steps actually taken
    const steps = 30 + ITERATIONS * 15;

    const rows: Row[] = trees.map((t) => ({
      label: t.label,
      stats: stats[t.label],
      counters: { 'compiles/render': Math.round((t.compiles / steps) * 10) / 10 },
    }));
    report(`render of ${SIBLINGS} siblings (re-rendered by the parent)`, rows, {
      control: 'control (no library)',
      controls: { 'dynamic, children are new each render': 'control, children new each render' },
      per: SIBLINGS,
      unit: 'µs',
    });

    trees.forEach((t) => t.tree.unmount());

    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.counters!['compiles/render']]));
    // deterministic gates: a repeat of identical props must never recompile
    expect(byLabel['dynamic, same props (cache hit)']).toBe(0);
    expect(byLabel['static style']).toBe(0);
    // props the style never reads must not fragment the cache (they used to: 300 compiles per render)
    expect(byLabel['dynamic, unrelated props vary']).toBe(0);
    expect(byLabel['dynamic, children are new each render']).toBe(0);
    expect(byLabel['dynamic, 2 values alternating']).toBe(0);
    // a prop the style does read, with thousands of values, legitimately compiles every time
    expect(byLabel['dynamic, high-cardinality prop']).toBe(SIBLINGS);
  });

  it('theme switch: recompiles per toggle with 100 components, back and forth', () => {
    const Items: React.ComponentType<any>[] = [];
    for (let b = 0; b < BUILDERS; b++) {
      const styled = new StylizedBuilder(Base)
        .style((({ theme }: any) => ({ backgroundColor: theme.colors?.bg, margin: b })) as any)
        .build();
      Items.push(styled, styled, styled); // 3 instances per builder
    }
    const staticItems = Array.from({ length: BUILDERS }, (_, b) =>
      new StylizedBuilder(Base).style({ padding: b } as any).build(),
    );

    act(() => {
      updateTheme({ colors: { bg: 'white' } } as any);
    });
    const dynamicTree = mountTree(Items, () => ({}));
    const staticTree = mountTree(staticItems, () => ({}));

    let dark = false;
    const toggle = () => {
      dark = !dark;
      act(() => {
        updateTheme({ colors: { bg: dark ? 'black' : 'white' } } as any);
      });
    };

    // prime both themes once: the first visit to each theme is a legitimate compile
    toggle();
    toggle();

    let toggles = 0;
    const before = compiles;
    const stats = compare(
      {
        'toggle light↔dark (mounted)': () => {
          toggles++;
          toggle();
        },
      },
      { iterations: 10, samples: 15, warmup: 10 },
    );
    const perToggle = (compiles - before) / (toggles || 1);

    report(`theme toggle with ${BUILDERS} dynamic + ${BUILDERS} static builders mounted`, [
      {
        label: 'toggle light↔dark (mounted)',
        stats: stats['toggle light↔dark (mounted)'],
        counters: { 'compiles/toggle': Math.round(perToggle * 10) / 10 },
      },
    ]);

    dynamicTree.unmount();
    staticTree.unmount();
    // both themes were seen during priming: switching between them again must not recompile anything
    expect(perToggle).toBe(0);
  });
});
