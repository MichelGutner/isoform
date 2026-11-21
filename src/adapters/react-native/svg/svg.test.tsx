/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any =>
    Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style ?? undefined);
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    View: () => null,
    Text: () => null,
    TextInput: () => null,
    Pressable: () => null,
    Image: () => null,
    ScrollView: () => null,
    Modal: () => null,
    Easing: { bezier: (...args: number[]) => Object.assign((t: number) => t, { args }) },
    // each `timing(...).start()` is recorded: the test decides what ran
    Animated: {
      View: () => null,
      Value: class {
        listeners: Array<(e: { value: number }) => void> = [];
        constructor(public value: number) {}
        setValue(v: number) {
          this.listeners.forEach((l) => l({ value: v }));
        }
        addListener(cb: any) {
          this.listeners.push(cb);
          return 'id';
        }
        removeAllListeners() {
          this.listeners = [];
        }
        stopAnimation() {}
        interpolate(config: any) {
          return { interpolated: config };
        }
      },
      timing: (value: any, config: any) => ({ start: () => mockRuns.push({ value, config }) }),
      createAnimatedComponent: (C: any) => C,
    },
  };
});

const mockRuns: Array<{ value: any; config: any }> = [];

jest.mock(
  'react-native-svg',
  () => ({
    // the root draws its shapes, like the real one
    Svg: function Svg({ children }: any) {
      return children ?? null;
    },
    Path: function Path() {
      return null;
    },
    Circle: function Circle() {
      return null;
    },
    LinearGradient: function LinearGradient() {
      return null;
    },
  }),
  { virtual: true },
);

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactNativeAdapter } from '../adapter';

/** The mocked `react-native-svg` (the lib is not a dependency of the package itself). */
const NativeSvg: any = jest.requireMock('react-native-svg');

const Icon = engine('Svg', { width: 24, height: 24, margin: 4, color: 'red' });
const Stroke = engine('Path', { fill: 'none', stroke: 'currentColor', strokeWidth: '2px' });

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

describe('svg primitives (native)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // react-test-renderer prints a deprecation notice
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRuns.length = 0;
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders react-native-svg with the style turned into props', () => {
    configure({ modules: { svg: true } });
    const tree = render(
      <Icon viewBox="0 0 24 24">
        <Stroke d="M4 12h16" />
      </Icon>,
    );
    const svg = tree.root.findByType(NativeSvg.Svg).props;
    expect(svg.viewBox).toBe('0 0 24 24');
    expect(svg.color).toBe('red');
    expect(svg.style).toEqual({ width: 24, height: 24, margin: 4 });

    const path = tree.root.findByType(NativeSvg.Path).props;
    expect(path).toMatchObject({ d: 'M4 12h16', fill: 'none', stroke: 'currentColor', strokeWidth: 2 });
    expect(path.style).toBeUndefined();
  });

  it('maps the prefixed names to the react-native-svg exports', () => {
    configure({ modules: { svg: true } });
    const Gradient = engine('SvgLinearGradient');
    const tree = render(<Gradient id="g" x1="0" x2="1" />);
    expect(tree.root.findByType(NativeSvg.LinearGradient).props.id).toBe('g');
  });

  it('renders nothing (with a warning) while the module is off', () => {
    const tree = render(<Icon viewBox="0 0 24 24" />);
    expect(tree.toJSON()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"svg"'));
  });

  it('animates a stroke-dashoffset transition on a shape (a progress ring), driven from JS', () => {
    configure({ modules: { svg: true } });
    const Ring = engine<'Circle', { value: number }>('Circle', ({ props }) => ({
      fill: 'none',
      strokeDasharray: 100,
      strokeDashoffset: 100 * (1 - props.value),
      transition: 'stroke-dashoffset 300ms ease',
    }));
    const tree = render(<Ring value={0.2} />);
    const offset = () => tree.root.findByType(NativeSvg.Circle).props.strokeDashoffset;
    expect(offset()).toBe(80);
    expect(mockRuns).toHaveLength(0);

    // a shape reads props, not `style`: the host redraws it with the value of each frame
    act(() => tree.update(<Ring value={0.75} />));
    expect(offset()).toBe(80);
    expect(mockRuns).toHaveLength(1);
    expect(mockRuns[0].config).toMatchObject({ toValue: 1, duration: 300, useNativeDriver: false });
    act(() => mockRuns[0].value.setValue(0.5));
    expect(offset()).toBe(52.5);
    act(() => mockRuns[0].value.setValue(1));
    expect(offset()).toBe(25);
  });
});
