/**
 * Where the time of a style-cache MISS goes, on the React Native adapter.
 *
 * Mirrors the "Style cache perf" device page (scenario 1): 300 cells re-rendered with sizes never seen
 * before. Compares the same tree with no library, with the size passed through `style` (no rule, no
 * compile), and with the size read by a style rule. The direct `compileStyle` /
 * `normalize` rows isolate the adapter's own work per style.
 *
 * Informative only (no gates). Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten: (style: any) => style },
  Dimensions: { get: () => ({ width: 400, height: 800 }), addEventListener: () => ({ remove: () => {} }) },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  Easing: { bezier: () => (t: number) => t },
  Animated: { Value: class {}, timing: () => ({ start: () => {}, stop: () => {} }), createAnimatedComponent: (C: any) => C },
  View: () => null,
  Text: () => null,
  TextInput: () => null,
  Pressable: () => null,
  ScrollView: () => null,
}));

import * as RN from 'react-native';
import { registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { compare, flushResults, report } from '../../core/testing/benchHarness';
import { reactNativeAdapter } from './adapter';
import { normalizeNative } from './normalize';

const CELLS = 300;
const STATIC = { height: 6, borderRadius: 2, backgroundColor: '#93c5fd' };

describe('style-cache miss breakdown (react-native adapter)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterAll(() => flushResults('miss'));

  it('300 new styles per render', () => {
    const View = (RN as any).View;
    const Rule = engine<'Box', { size: number }>('Box', ({ props }) => ({ ...STATIC, width: 6 + props.size }));
    const StyleProp = engine('Box', STATIC);

    let seed = 0;
    const sized = (i: number) => seed * CELLS + i;
    const tree = (cell: (i: number) => React.ReactElement) => <>{Array.from({ length: CELLS }, (_, i) => cell(i))}</>;

    const variants: Record<string, () => React.ReactElement> = {
      'control: RN View, width in style': () => tree((i) => <View key={i} style={[STATIC, { width: 6 + sized(i) }]} />),
      'library, width in `style` prop': () => tree((i) => <StyleProp key={i} style={{ width: 6 + sized(i) }} />),
      'library rule (compiles every cell)': () => tree((i) => <Rule key={i} size={sized(i)} />),
    };

    const steps = Object.fromEntries(
      Object.entries(variants).map(([label, el]) => {
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
          renderer = TestRenderer.create(el());
        });
        return [
          label,
          () => {
            seed++;
            act(() => renderer.update(el()));
          },
        ];
      }),
    );
    const stats = compare(steps, { iterations: 5, samples: 15, warmup: 10 });

    report(`${CELLS} cells, every style new (all misses)`, Object.keys(stats).map((label) => ({ label, stats: stats[label] })), {
      control: 'control: RN View, width in style',
      per: CELLS,
      unit: 'µs',
    });

    let n = 0;
    const direct = compare(
      {
        'compileStyle (adapter) per style': () => {
          reactNativeAdapter.compileStyle({ ...STATIC, width: ++n });
        },
        'normalizeNative per style': () => {
          normalizeNative({ ...STATIC, width: ++n }, { remBase: 16, viewport: () => ({ width: 400, height: 800 }) });
        },
      },
      { iterations: 2000, samples: 9, warmup: 500 },
    );
    report(
      'adapter work per style, outside React',
      Object.keys(direct).map((label) => ({ label, stats: direct[label] })),
    );
    expect(stats['library rule (compiles every cell)'].median).toBeGreaterThan(0);
  });
});
