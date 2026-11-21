/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style);
  /** Records what JS asks of each value (the native driver itself is not simulated). */
  class Value {
    calls: Array<[string, unknown]> = [];
    constructor(public value: number) {}
    setValue(v: number) {
      this.calls.push(['setValue', v]);
    }
    setOffset(v: number) {
      this.calls.push(['setOffset', v]);
    }
    stopAnimation() {
      this.calls.push(['stopAnimation', undefined]);
    }
    interpolate(config: any) {
      return { interpolated: this, config, interpolate: (c: any) => ({ interpolated: this, config: c }) };
    }
  }
  const node = (kind: string, a: any, b: any) => ({ kind, a, b, interpolate: (config: any) => ({ of: kind, config }) });
  const springs: any[] = [];
  const timings: any[] = [];
  const glides: any[] = [];
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }), addEventListener: () => ({ remove: () => {} }) },
    View: function View({ children }: any) {
      return children ?? null;
    },
    Text: function Text({ children }: any) {
      return children ?? null;
    },
    Pressable: () => null,
    TextInput: () => null,
    ScrollView: () => null,
    Easing: { bezier: () => (t: number) => t },
    Animated: {
      Value,
      multiply: (a: any, b: any) => node('multiply', a, b),
      add: (a: any, b: any) => node('add', a, b),
      spring: (value: any, config: any) => ({ start: () => springs.push({ value, config }) }),
      timing: (value: any, config: any) => ({ value, config, start: (done: any) => glides.push({ value, config, done }) }),
      parallel: (animations: any[]) => ({ start: (done: any) => timings.push({ animations, done }) }),
      event: (mapping: any, config: any) => {
        const handler = (event: any) => config.listener?.(event);
        return Object.assign(handler, { __mapping: mapping, __config: config });
      },
      createAnimatedComponent: (C: any) => C,
      __springs: springs,
      __timings: timings,
      __glides: glides,
    },
  };
});

jest.mock('./native/IsoGestureViewNativeComponent', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: React.forwardRef(function IsoGestureView({ children }: any, ref: any) {
      React.useImperativeHandle(ref, () => ({ native: true }));
      return children ?? null;
    }),
    Commands: { haptic: jest.fn() },
  };
});

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactNativeAdapter } from '../adapter';

const Spec: any = jest.requireMock('./native/IsoGestureViewNativeComponent');
const RN: any = jest.requireMock('react-native');

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

const nativeProps = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByType(Spec.default).props;
const pan = (state: number, extra: Record<string, number> = {}) => ({
  nativeEvent: { state, translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, x: 0, y: 0, ...extra },
});

describe('.gesture() on mobile', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
    configure({ modules: { gestures: true } });
    RN.Animated.__springs.length = 0;
    RN.Animated.__timings.length = 0;
    RN.Animated.__glides.length = 0;
    Spec.Commands.haptic.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders the native gesture view with the recognizers that are on', () => {
    const Card = engine('Box', { padding: 8 }).gesture({ pan: { axis: 'x' }, pinch: true, longPress: { minDuration: 300 } });
    const props = nativeProps(render(<Card testID="card" />));
    expect(props).toMatchObject({
      testID: 'card',
      panAxis: 'x',
      pinchEnabled: true,
      rotateEnabled: false,
      doubleTapEnabled: false,
      longPressEnabled: true,
      longPressDuration: 300,
    });
    expect(props.__isoGestures).toBeUndefined();
  });

  it('binds the followed axis to the native driver and prepends the gesture transform', () => {
    const Card = engine('Box', { transform: [{ rotate: '5deg' }] }).gesture({ pan: { axis: 'x', bounds: { left: 50, right: 50 } } });
    const props = nativeProps(render(<Card />));
    const [mapping] = props.onIsoPan.__mapping;
    expect(props.onIsoPan.__config.useNativeDriver).toBe(true);
    expect(Object.keys(mapping.nativeEvent)).toEqual(['translationX']);

    const transform = RN.StyleSheet.flatten(props.style).transform;
    expect(transform).toHaveLength(2);
    expect(transform[0].translateX.config).toMatchObject({ inputRange: [-50, 50], extrapolate: 'clamp' });
    expect(transform[1]).toEqual({ rotate: '5deg' });
  });

  it('runs the callbacks, detects a swipe and glides back on release', () => {
    const onPan = jest.fn();
    const onSwipe = jest.fn();
    const Card = engine('Box').gesture({ pan: true, swipe: true });
    const renderer = render(<Card onPan={onPan} onSwipe={onSwipe} />);
    const { onIsoPan } = nativeProps(renderer);

    act(() => onIsoPan(pan(0)));
    act(() => onIsoPan(pan(1, { translationX: 40 })));
    act(() => onIsoPan(pan(2, { translationX: 140, velocityX: 1200 })));

    expect(onPan.mock.calls.map(([e]) => e.phase)).toEqual(['start', 'move', 'end']);
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ direction: 'right' }));
    // the value now holds the distance to the resting place (0) and glides to 0 on the UI thread
    const panX = onIsoPan.__mapping[0].nativeEvent.translationX;
    expect(panX.calls.slice(-2)).toEqual([
      ['setOffset', 0],
      ['setValue', 140],
    ]);
    expect(RN.Animated.__glides.map((g: any) => g.config)).toEqual([expect.objectContaining({ toValue: 0, useNativeDriver: true })]);
  });

  it('with swipe.exit, sends the element off screen and only then calls onSwipe', () => {
    const onSwipe = jest.fn();
    const Row = engine('Box').gesture({ pan: { axis: 'x' }, swipe: { exit: true } });
    const { onIsoPan } = nativeProps(render(<Row onSwipe={onSwipe} />));
    act(() => onIsoPan(pan(2, { translationX: -140, velocityX: -1500 })));

    expect(RN.Animated.__springs).toHaveLength(0); // no spring back
    const [{ animations, done }] = RN.Animated.__timings;
    expect(animations[0].config).toMatchObject({ toValue: -480, useNativeDriver: true }); // 400 wide × 1.2, to the left
    expect(onSwipe).not.toHaveBeenCalled();
    act(() => done({ finished: true }));
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ direction: 'left' }));
  });

  it("keeps the element where it was left with release: 'stay', inside the bounds", () => {
    const Card = engine('Box').gesture({ pan: { release: 'stay', bounds: { right: 100 } } });
    const { onIsoPan } = nativeProps(render(<Card />));
    act(() => onIsoPan(pan(2, { translationX: 150, translationY: 20 })));
    const panX = onIsoPan.__mapping[0].nativeEvent.translationX;
    expect(panX.calls).toEqual([
      ['setOffset', 100],
      ['setValue', 0],
    ]);
    expect(RN.Animated.__springs).toHaveLength(0);
  });

  it('snaps to the nearest point ahead of the finger and reports it, with a haptic', () => {
    const onSnap = jest.fn();
    const Sheet = engine('Box').gesture({ pan: { axis: 'y', snap: { y: [-300, 0] } }, haptics: true });
    const { onIsoPan } = nativeProps(render(<Sheet onSnap={onSnap} />));
    act(() => onIsoPan(pan(0)));
    act(() => onIsoPan(pan(2, { translationY: -80, velocityY: -1800 })));
    expect(onSnap).toHaveBeenCalledWith({ x: 0, y: -300 });
    const panY = onIsoPan.__mapping[0].nativeEvent.translationY;
    expect(panY.calls.slice(-2)).toEqual([
      ['setOffset', -300],
      ['setValue', 220],
    ]);
    expect(Spec.Commands.haptic).toHaveBeenCalledWith({ native: true }, 0);
  });

  it('picks a running glide up where it is when a new drag starts', () => {
    const Card = engine('Box').gesture({ pan: { axis: 'x', release: 'stay' } });
    const { onIsoPan } = nativeProps(render(<Card />));
    act(() => onIsoPan(pan(2, { translationX: 100 })));
    act(() => onIsoPan(pan(0, { translationX: 5 })));
    const panX = onIsoPan.__mapping[0].nativeEvent.translationX;
    expect(panX.calls.slice(-2)).toEqual([
      ['stopAnimation', undefined],
      ['setOffset', 100],
    ]);
  });

  it('drives the interpolate styles from the same native nodes', () => {
    const Row = engine('Box', { opacity: 0.9 }).gesture({
      pan: { axis: 'x' },
      interpolate: [{ from: 'x', input: [-200, 0], style: { opacity: [0, 1], backgroundColor: ['red', 'white'] } }],
    });
    const style = RN.StyleSheet.flatten(nativeProps(render(<Row />)).style);
    expect(style.opacity.config).toMatchObject({ inputRange: [-200, 0], outputRange: [0, 1], extrapolate: 'clamp' });
    expect(style.backgroundColor.config.outputRange).toEqual(['red', 'white']);
  });

  it('adds screen-reader actions that run the gestures, and keeps the element own ones', () => {
    const onSwipe = jest.fn();
    const onOwn = jest.fn();
    const Row = engine('Box').gesture({ swipe: { directions: ['left'] }, longPress: true });
    const props = nativeProps(
      render(<Row onSwipe={onSwipe} accessibilityActions={[{ name: 'magicTap' }]} onAccessibilityAction={onOwn} />),
    );
    expect(props.accessible).toBe(true);
    expect(props.accessibilityActions.map((a: any) => a.name)).toEqual(['magicTap', 'swipeLeft', 'longpress']);
    act(() => props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeLeft' } }));
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ direction: 'left' }));
    act(() => props.onAccessibilityAction({ nativeEvent: { actionName: 'magicTap' } }));
    expect(onOwn).toHaveBeenCalledTimes(1);
  });

  it('passes simultaneous to the native view', () => {
    const Card = engine('Box').gesture({ pan: true, pinch: true, simultaneous: false });
    expect(nativeProps(render(<Card />)).simultaneous).toBe(false);
  });

  it('uses a plain JS handler when the element does not follow, and fires taps', () => {
    const onDoubleTap = jest.fn();
    const onLongPress = jest.fn();
    const Card = engine('Box').gesture({ pan: { follow: false }, doubleTap: true, longPress: true });
    const props = nativeProps(render(<Card onDoubleTap={onDoubleTap} onLongPress={onLongPress} />));
    expect(props.onIsoPan.__mapping).toBeUndefined();
    expect(RN.StyleSheet.flatten(props.style)?.transform).toBeUndefined();

    act(() => props.onIsoTap({ nativeEvent: { kind: 0, x: 1, y: 2 } }));
    act(() => props.onIsoTap({ nativeEvent: { kind: 1, x: 3, y: 4 } }));
    expect(onDoubleTap).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(onLongPress).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it('drops animation/transition on the element, with a warning', () => {
    const Card = engine('Box', { transition: 'opacity 200ms' } as any).gesture({ pan: true });
    render(<Card />);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/ignored there; put them on a child/);
  });

  it('only applies to Box: other primitives warn and render as usual', () => {
    const Label = engine('Text').gesture({ pan: true });
    const renderer = render(<Label>hi</Label>);
    expect(renderer.root.findAllByType(Spec.default)).toHaveLength(0);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/only applies to Box/);
  });

  it('renders a plain View when the module is off', () => {
    configure({ modules: {} });
    const onPan = jest.fn();
    const Card = engine('Box').gesture({ pan: true });
    const renderer = render(<Card onPan={onPan} />);
    expect(renderer.root.findAllByType(Spec.default)).toHaveLength(0);
    const view = renderer.root.findByType(RN.View);
    expect(view.props.onPan).toBeUndefined();
    expect(warn.mock.calls.flat().join(' ')).toMatch(/module "gestures" is off/);
  });
});
