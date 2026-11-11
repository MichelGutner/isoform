/**
 * Render benchmark for StylizedBuilder.
 *
 * Not part of the regular `yarn test` run (see the `bench` script) — measures
 * wall-clock render cost for a static (props-independent) style vs. a dynamic
 * (prop-dependent) one, to make the static fast path's win concrete.
 *
 * Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { registerBundledProvider } from '../config';
import { StylizedBuilder } from './builder';
import { createFakeAdapter } from './testing/fakeAdapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const Base: React.FC<any> = () => null;
registerBundledProvider(createFakeAdapter(Base));

const ITERATIONS = 10_000;
const WARMUP = 1_000;

/**
 * Re-renders the same mounted tree with new props each iteration (rather than
 * mounting fresh), matching the real case: a parent re-rendering a styled child.
 */
function timeRenders(Component: React.ComponentType<any>, propsAt: (i: number) => any): number {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Component, propsAt(0)));
  });

  for (let i = 0; i < WARMUP; i++) {
    act(() => {
      renderer.update(React.createElement(Component, propsAt(i)));
    });
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    act(() => {
      renderer.update(React.createElement(Component, propsAt(i)));
    });
  }
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const report = (label: string, ms: number) =>
  // eslint-disable-next-line no-console
  console.log(`[bench] ${label}: ${ITERATIONS} renders in ${ms.toFixed(1)}ms (${(ms / ITERATIONS).toFixed(4)}ms/render)`);

describe('render benchmark', () => {
  it('static style', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 16, backgroundColor: 'white' } as any).build();
    const ms = timeRenders(Component, () => ({ testID: 'static' }));
    report('static style', ms);
    expect(ms).toBeGreaterThan(0);
  });

  it('dynamic (prop-dependent) style', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ padding: 16, opacity: props.disabled ? 0.5 : 1 })) as any)
      .build();
    const ms = timeRenders(Component, (i) => ({ testID: 'dynamic', disabled: i % 2 === 0 }));
    report('dynamic style', ms);
    expect(ms).toBeGreaterThan(0);
  });

  it('dynamic style, repeated identical props (cache hit every render)', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ padding: 16, opacity: props.disabled ? 0.5 : 1 })) as any)
      .build();
    const ms = timeRenders(Component, () => ({ testID: 'dynamic-cached', disabled: true }));
    report('dynamic style (cache hit)', ms);
    expect(ms).toBeGreaterThan(0);
  });
});
