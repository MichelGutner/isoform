/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Valida o `AnimationLab` REAL do exemplo compartilhado (o mesmo que roda no
 * navegador) no caminho nativo: cada animação vira um host `Animated` com os
 * parâmetros certos. `Animated` é mockado para controlarmos o tempo.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockRuns: Array<{ config: any }> = [];

jest.mock('react-native', () => {
  class Value {
    value: number;
    constructor(v: number) {
      this.value = v;
    }
    setValue(v: number) {
      this.value = v;
    }
    interpolate(config: any) {
      return { interpolated: config };
    }
    addListener() {
      return '';
    }
    removeAllListeners() {}
    stopAnimation() {}
  }
  // componentes falsos que renderizam os filhos (senão a árvore some)
  const host = (props: any) => props.children ?? null;
  const View = host;
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten: (style: any) => style },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    Easing: { bezier: (...args: number[]) => Object.assign((t: number) => t, { args }) },
    Animated: {
      Value,
      timing: (_: any, config: any) => ({
        start: () => mockRuns.push({ config }),
        stop: () => {},
      }),
      createAnimatedComponent: (C: any) => C,
    },
    View,
    Text: host,
    Pressable: host,
    TextInput: host,
    Image: host,
    ScrollView: host,
  };
});

import * as RN from 'react-native';
import { registerBundledProvider, resetProvider } from '../../config';
import { updateTheme } from '../../theme';
import { AnimationLab } from '../../../examples/showcase/demos/Animations';
import { lightTokens } from '../../../examples/showcase/tokens';
import { reactNativeAdapter } from './adapter';

const byTestId = (root: TestRenderer.ReactTestInstance, id: string) =>
  root.findAll((n) => n.props?.testID === id && n.type === (RN as any).View)[0];

describe('AnimationLab on the React Native adapter', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRuns.length = 0;
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
    act(() => {
      updateTheme(lightTokens as any);
    });
    act(() => {
      renderer = TestRenderer.create(<AnimationLab />);
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders without warnings: every property/easing/frame used is supported on mobile', () => {
    act(() => jest.advanceTimersByTime(2000));
    expect(warn.mock.calls.map((c) => c[0])).toEqual([]);
  });

  it('starts all 15 animations (ring, orbit, core, 5 bars, 3 dots, glow, 3 reveals)', () => {
    act(() => jest.advanceTimersByTime(2000));
    expect(mockRuns).toHaveLength(15);
  });

  it('picks the right driver and timing per animation', () => {
    act(() => jest.advanceTimersByTime(2000));
    const durations = mockRuns.map((r) => r.config.duration).sort((a, b) => a - b);

    // ring (1800), orbit (2400), core (1200), glow (1400), 5 bars (700..1060), dots (1000 x3), reveals (600 x3)
    expect(durations).toEqual([600, 600, 600, 700, 790, 880, 970, 1000, 1000, 1000, 1060, 1200, 1400, 1800, 2400]);

    const nonNative = mockRuns.filter((r) => !r.config.useNativeDriver);
    // só o núcleo anima `backgroundColor` → driver JS; o resto roda no driver nativo
    expect(nonNative).toHaveLength(1);
    expect(nonNative[0].config.duration).toBe(1200);
  });

  it('builds the interpolations: rotation, color, multi-frame bounce and combined transforms', () => {
    const ring = byTestId(renderer.root, 'anim-ring').props.style;
    expect(ring[1].transform).toEqual([
      { rotate: { interpolated: { inputRange: [0, 1], outputRange: ['0deg', '360deg'] } } },
    ]);

    const core = byTestId(renderer.root, 'anim-core').props.style;
    expect(core[1].backgroundColor.interpolated).toEqual({
      inputRange: [0, 0.5, 1],
      outputRange: ['#6366f1', '#f43f5e', '#6366f1'],
    });
    expect(core[1].transform[0].scale.interpolated.outputRange).toEqual([1, 1.5, 1]);

    const reveal = byTestId(renderer.root, 'anim-reveal-1').props.style;
    expect(reveal[1].opacity.interpolated.outputRange).toEqual([0, 1]);
    expect(reveal[1].transform).toEqual([
      { translateY: { interpolated: { inputRange: [0, 1], outputRange: [24, 0] } } },
      { scale: { interpolated: { inputRange: [0, 1], outputRange: [0.96, 1] } } },
    ]);
  });

  it("fill-mode 'both': the cascade items are already at the first frame during their delay", () => {
    // nada rodou ainda (delays pendentes), mas os itens com delay > 0 já têm o estilo animado
    expect(mockRuns.length).toBeLessThan(15);
    const third = byTestId(renderer.root, 'anim-reveal-2').props.style;
    expect(Array.isArray(third)).toBe(true);
    // sem fill (equalizador com delay): só começa a aplicar o estilo animado depois do delay
    const bar4 = byTestId(renderer.root, 'anim-bar-4').props.style;
    expect(Array.isArray(bar4) && bar4.length === 2 && bar4[1] && Object.keys(bar4[1]).length).toBeFalsy();
  });

  it('applies staggered delays: bar 4 waits 440ms before it starts', () => {
    act(() => jest.advanceTimersByTime(439));
    const before = mockRuns.length;
    act(() => jest.advanceTimersByTime(2));
    expect(mockRuns.length).toBeGreaterThan(before);
  });
});
