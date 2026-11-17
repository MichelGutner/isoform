/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** Cada `Animated.timing(...).start()` fica aqui: o teste decide o progresso e quando termina. */
const mockRuns: Array<{ value: any; config: any }> = [];
const mockValues: any[] = [];

jest.mock('react-native', () => {
  class Value {
    value: number;
    listeners: Array<(e: { value: number }) => void> = [];
    stopped = 0;
    constructor(v: number) {
      this.value = v;
      mockValues.push(this);
    }
    setValue(v: number) {
      this.value = v;
      this.listeners.forEach((l) => l({ value: v }));
    }
    addListener(cb: any) {
      this.listeners.push(cb);
      return 'id';
    }
    removeAllListeners() {
      this.listeners = [];
    }
    stopAnimation() {
      this.stopped++;
    }
    interpolate(config: any) {
      return { interpolated: config };
    }
  }
  const host = (props: any) => props.children ?? null;
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten: (style: any) => style },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    Easing: { bezier: (...args: number[]) => Object.assign((t: number) => t, { args }) },
    Animated: {
      Value,
      timing: (value: any, config: any) => ({
        start: () => mockRuns.push({ value, config }),
        stop: () => {},
      }),
      createAnimatedComponent: (C: any) => C,
    },
    View: host,
    Text: host,
    Pressable: host,
    TextInput: host,
    Image: host,
    ScrollView: host,
  };
});

import * as RN from 'react-native';
import { registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { keyframes } from '../../core/keyframes';
import { reactNativeAdapter } from './adapter';

let renderer: TestRenderer.ReactTestRenderer;
const mount = (el: React.ReactElement) => {
  act(() => {
    renderer = TestRenderer.create(el);
  });
};
const update = (el: React.ReactElement) => act(() => renderer.update(el));
const style = (type: any = (RN as any).View) => renderer.root.findByType(type).props.style;
const interp = (node: any) => node.interpolated;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRuns.length = 0;
  mockValues.length = 0;
  resetProvider();
  registerBundledProvider(reactNativeAdapter);
});
afterEach(() => jest.restoreAllMocks());

describe('react-native · transition', () => {
  const Fade = engine<'Box', { dim?: boolean }>('Box', { opacity: 1, transition: 'opacity 200ms linear' } as any).when(
    'props:dim',
    { style: { opacity: 0.5 } },
  );

  it('does not animate on the first render; the style already holds an animated node', () => {
    mount(<Fade />);
    expect(mockRuns).toHaveLength(0);
    expect(interp(style().opacity)).toEqual({ inputRange: [0, 1], outputRange: [1, 1] });
  });

  it('animates the change after commit, with the declared timing and the native driver (opacity only)', () => {
    mount(<Fade />);
    update(<Fade dim />);
    expect(interp(style().opacity)).toEqual({ inputRange: [0, 1], outputRange: [1, 0.5] });
    expect(mockRuns).toHaveLength(1);
    expect(mockRuns[0].config).toMatchObject({ toValue: 1, duration: 200, delay: 0, useNativeDriver: true });
    expect((mockRuns[0].config.easing as any)(0.3)).toBe(0.3); // linear
  });

  it('does nothing when the value did not change', () => {
    mount(<Fade />);
    update(<Fade />);
    update(<Fade />);
    expect(mockRuns).toHaveLength(0);
  });

  it('resumes from where an interrupted transition was', () => {
    mount(<Fade />);
    update(<Fade dim />); // 1 → 0.5
    act(() => mockRuns[0].value.setValue(0.5)); // metade do caminho: 0.75
    update(<Fade />); // volta para 1 no meio da transição
    expect(interp(style().opacity)).toEqual({ inputRange: [0, 1], outputRange: [0.75, 1] });
    expect(mockRuns).toHaveLength(2);
  });

  it('interpolates colors and resumes them mid-flight', () => {
    const Tint = engine<'Box', { on?: boolean }>('Box', { backgroundColor: '#000000', transition: 'background-color 1s' } as any).when(
      'props:on',
      { style: { backgroundColor: '#ffffff' } },
    );
    mount(<Tint />);
    update(<Tint on />);
    expect(interp(style().backgroundColor).outputRange).toEqual(['#000000', '#ffffff']);
    expect(mockRuns[0].config.useNativeDriver).toBe(false); // cor não roda no native driver
    act(() => mockRuns[0].value.setValue(0.5));
    update(<Tint />);
    expect(interp(style().backgroundColor).outputRange).toEqual(['rgba(128,128,128,1)', '#000000']);
  });

  it("'all' animates any interpolable property (JS driver) and leaves non-numeric ones alone", () => {
    const Box = engine<'Box', { big?: boolean }>('Box', { width: 10, alignSelf: 'flex-start', transition: 'all 100ms' } as any).when(
      'props:big',
      { style: { width: 20, alignSelf: 'flex-end' } },
    );
    mount(<Box />);
    update(<Box big />);
    expect(interp(style().width).outputRange).toEqual([10, 20]);
    expect(mockRuns).toHaveLength(2); // width e alignSelf (strings: troca na hora, sem interpolação)
    expect(mockRuns.every((r) => r.config.useNativeDriver === false)).toBe(true);
    expect(style().alignSelf).toBe('flex-end');
  });

  it('only listed properties transition; the others change instantly', () => {
    const Box = engine<'Box', { on?: boolean }>('Box', { opacity: 1, width: 10, transition: 'opacity 100ms' } as any).when('props:on', {
      style: { opacity: 0.2, width: 50 },
    });
    mount(<Box />);
    update(<Box on />);
    expect(typeof style().width).toBe('number');
    expect(style().width).toBe(50);
    expect(mockRuns).toHaveLength(1);
  });

  it('animates transform function by function, using the identity for missing ones', () => {
    const Pop = engine<'Box', { on?: boolean }>('Box', { transform: 'scale(1)', transition: 'transform 300ms ease-out' } as any).when(
      'props:on',
      { style: { transform: 'scale(1.5) rotate(45deg)' } },
    );
    mount(<Pop />);
    update(<Pop on />);
    const t = style().transform.map((fn: any) => Object.fromEntries(Object.entries(fn).map(([k, v]: any) => [k, interp(v).outputRange])));
    expect(t).toEqual([{ scale: [1, 1.5] }, { rotate: ['0deg', '45deg'] }]);
    expect(mockRuns[0].config).toMatchObject({ duration: 300, useNativeDriver: true });
  });

  it('honours the delay and a different timing per property', () => {
    const Box = engine<'Box', { on?: boolean }>('Box', {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: 'opacity 100ms linear, transform 400ms ease 80ms',
    } as any).when('props:on', { style: { opacity: 0, transform: 'translateY(20px)' } });
    mount(<Box />);
    update(<Box on />);
    const byDuration = Object.fromEntries(mockRuns.map((r) => [r.config.duration, r.config]));
    expect(byDuration[100]).toMatchObject({ delay: 0 });
    expect(byDuration[400]).toMatchObject({ delay: 80 });
  });

  it('warns and swaps instantly when the values cannot be interpolated', () => {
    const Box = engine<'Box', { on?: boolean }>('Box', { width: 'auto', transition: 'width 100ms' } as any).when('props:on', {
      style: { width: 100 },
    });
    mount(<Box />);
    update(<Box on />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"width" não pode ser animado'));
    expect(style().width).toBe(100);
  });

  it("animates when('state:pressed') through onPressIn/onPressOut (the host tracks the press)", () => {
    const Btn = engine('Pressable', { opacity: 1, transition: 'opacity 150ms' } as any).when('state:pressed', { style: { opacity: 0.6 } });
    mount(<Btn />);
    const P = (RN as any).Pressable;
    act(() => renderer.root.findByType(P).props.onPressIn({}));
    expect(interp(style(P).opacity).outputRange).toEqual([1, 0.6]);
    expect(mockRuns).toHaveLength(1);
    act(() => renderer.root.findByType(P).props.onPressOut({}));
    expect(interp(style(P).opacity).outputRange[1]).toBe(1);
    expect(mockRuns).toHaveLength(2);
  });

  it("animates when('state:focus') on an Input", () => {
    const Field = engine('Input', { borderColor: '#cccccc', transition: 'border-color 120ms' } as any).when('state:focus', {
      style: { borderColor: '#0000ff' },
    });
    mount(<Field />);
    const T = (RN as any).TextInput;
    act(() => renderer.root.findByType(T).props.onFocus({}));
    expect(interp(style(T).borderColor).outputRange).toEqual(['#cccccc', '#0000ff']);
  });

  it('animation wins over transition on the same element (with a warning)', () => {
    const k = keyframes({ to: { opacity: 0 } });
    const Box = engine('Box', { opacity: 1, animation: `${k} 1s`, transition: 'opacity 1s' } as any);
    mount(<Box />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('só a animation é executada'));
  });

  it('stops animations and listeners on unmount', () => {
    mount(<Fade />);
    update(<Fade dim />);
    act(() => renderer.unmount());
    expect(mockValues.some((v) => v.stopped > 0)).toBe(true);
    expect(mockValues.every((v) => v.listeners.length === 0)).toBe(true);
  });

  it('does not touch components without transition (no host, plain style)', () => {
    const Plain = engine('Box', { opacity: 1 });
    mount(<Plain />);
    expect(style()).toEqual({ opacity: 1 });
  });
});
