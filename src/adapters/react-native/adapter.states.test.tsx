/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** Cada `Animated.timing(...).start(cb)` fica guardado aqui para o teste decidir quando termina. */
const mockRuns: Array<{ config: any; done: (r: { finished: boolean }) => void; stop: jest.Mock }> = [];
/** Largura da janela controlada pelo teste; `useWindowDimensions` relê isso a cada render. */
const mockWindow = { width: 400, height: 800 };
const mockWindowListeners = new Set<() => void>();

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
  }
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten: (style: any) => style },
    Dimensions: {
      get: () => ({ ...mockWindow }),
      // a mudança de largura chega por aqui, como no app real; o teste dispara via `mockWindowListeners`
      addEventListener: (_: 'change', handler: () => void) => {
        mockWindowListeners.add(handler);
        return { remove: () => mockWindowListeners.delete(handler) };
      },
    },
    useWindowDimensions: () => {
      // re-renderiza o componente quando o teste muda a largura (como a rotação da tela)
      const R = require('react');
      const [, force] = R.useReducer((n: number) => n + 1, 0);
      R.useEffect(() => {
        mockWindowListeners.add(force);
        return () => mockWindowListeners.delete(force);
      }, []);
      return { ...mockWindow };
    },
    Easing: { bezier: (...args: number[]) => Object.assign((t: number) => t, { args }) },
    Animated: {
      Value,
      timing: (value: any, config: any) => {
        const run: any = { config, stop: jest.fn() };
        return {
          start: (done: any) => {
            run.done = done;
            mockRuns.push(run);
          },
          stop: run.stop,
        };
      },
      createAnimatedComponent: (C: any) => C,
    },
    View: (_: any) => null,
    Text: (_: any) => null,
    TextInput: (_: any) => null,
    Pressable: (_: any) => null,
    ScrollView: (_: any) => null,
  };
});

import * as RN from 'react-native';
import { configure, registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { keyframes } from '../../core/keyframes';
import { reactNativeAdapter } from './adapter';

let renderer: TestRenderer.ReactTestRenderer;
/** Toda árvore montada, para desmontar no fim de cada teste (cancela as assinaturas, como no app real). */
const mounted: TestRenderer.ReactTestRenderer[] = [];
const mount = (el: React.ReactElement) => {
  act(() => {
    renderer = TestRenderer.create(el);
  });
  mounted.push(renderer);
  return renderer;
};
const propsOf = (type: any) => renderer.root.findByType(type).props;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRuns.length = 0;
  resetProvider();
  registerBundledProvider(reactNativeAdapter);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('react-native · keyframes + animation', () => {
  it('runs the animation with Animated, honouring iterations, direction and fill', () => {
    const fade = keyframes({
      from: { opacity: 0, transform: 'translateY(10px)' },
      to: { opacity: 1, transform: 'translateY(0px)' },
    });
    expect(fade).toMatch(/^o-kf-/);

    const Box = engine('Box', { padding: 4, animation: `${fade} 200ms linear 2 alternate` });
    mount(<Box />);
    act(() => jest.runOnlyPendingTimers()); // delay 0

    // estilo base + estilo animado
    const style = propsOf((RN as any).View).style;
    expect(style[0]).toEqual({ padding: 4 });
    expect(style[1].opacity).toEqual({ interpolated: { inputRange: [0, 1], outputRange: [0, 1] } });
    expect(style[1].transform).toEqual([
      { translateY: { interpolated: { inputRange: [0, 1], outputRange: [10, 0] } } },
    ]);

    // 1ª iteração: 0 → 1, com native driver (só opacity/transform)
    expect(mockRuns).toHaveLength(1);
    expect(mockRuns[0].config).toMatchObject({ toValue: 1, duration: 200, useNativeDriver: true });

    // alternate: 2ª iteração volta 1 → 0
    act(() => mockRuns[0].done({ finished: true }));
    expect(mockRuns).toHaveLength(2);
    expect(mockRuns[1].config.toValue).toBe(0);

    // acabou (2 iterações) e fill = none → estilo animado removido
    act(() => mockRuns[1].done({ finished: true }));
    expect(mockRuns).toHaveLength(2);
    expect(propsOf((RN as any).View).style).toEqual({ padding: 4 });
  });

  it('keeps the last frame with fill-mode forwards', () => {
    const grow = keyframes({ to: { opacity: 0.5 } });
    const Box = engine('Box', { animation: `${grow} 100ms forwards` });
    mount(<Box />);
    act(() => jest.runOnlyPendingTimers());
    act(() => mockRuns[0].done({ finished: true }));
    expect(Array.isArray(propsOf((RN as any).View).style)).toBe(true);
  });

  it('waits for the delay (no animated style before it, unless fill backwards)', () => {
    const k = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const Delayed = engine('Box', { animation: `${k} 100ms 500ms` });
    mount(<Delayed />);
    expect(mockRuns).toHaveLength(0);
    expect(Array.isArray(propsOf((RN as any).View).style)).toBe(false);
    act(() => jest.advanceTimersByTime(500));
    expect(mockRuns).toHaveLength(1);
    expect(Array.isArray(propsOf((RN as any).View).style)).toBe(true);
  });

  it('infinite animations keep looping until unmount, then stop', () => {
    const k = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const Loop = engine('Box', { animation: `${k} 100ms infinite` });
    mount(<Loop />);
    act(() => jest.runOnlyPendingTimers());
    for (let i = 0; i < 5; i++) act(() => mockRuns[i].done({ finished: true }));
    expect(mockRuns).toHaveLength(6);
    act(() => renderer.unmount());
    expect(mockRuns[5].stop).toHaveBeenCalled();
  });

  it('uses the JS driver when animating layout props', () => {
    const k = keyframes({ from: { width: 10 }, to: { width: '20rem' } });
    const Bar = engine('Box', { animation: `${k} 1s` });
    mount(<Bar />);
    act(() => jest.runOnlyPendingTimers());
    expect(mockRuns[0].config.useNativeDriver).toBe(false);
    expect(propsOf((RN as any).View).style[1].width.interpolated.outputRange).toEqual([10, 320]);
  });

  it('accepts inline keyframes in animationName', () => {
    const Inline = engine('Box', {
      animationName: { from: { opacity: 0 }, to: { opacity: 1 } } as any,
      animationDuration: '1s',
    });
    mount(<Inline />);
    act(() => jest.runOnlyPendingTimers());
    expect(mockRuns).toHaveLength(1);
  });

  it('warns and renders normally for an unknown animation name', () => {
    const Box = engine('Box', { opacity: 1, animation: 'nope 1s' });
    mount(<Box />);
    expect(propsOf((RN as any).View).style).toEqual({ opacity: 1 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"nope" was not registered'));
  });
});

describe('react-native · interaction states', () => {
  it("when('state:pressed') becomes a Pressable style function", () => {
    const Button = engine('Pressable', { opacity: 1 }).when('state:pressed', { style: { opacity: 0.5 } });
    mount(<Button />);
    const style = propsOf((RN as any).Pressable).style;
    expect(typeof style).toBe('function');
    expect(style({ pressed: false })).toEqual({ opacity: 1 });
    expect(style({ pressed: true })).toEqual([{ opacity: 1 }, { opacity: 0.5 }]);
  });

  it("when('state:pressed') still merges the user style on top", () => {
    const Button = engine('Pressable', { opacity: 1 }).when('state:pressed', { style: { opacity: 0.5 } });
    mount(<Button style={{ margin: 2 }} />);
    const style = propsOf((RN as any).Pressable).style;
    expect(style({ pressed: true })).toEqual([{ opacity: 1 }, { opacity: 0.5 }, { margin: 2 }]);
  });

  it("when('state:focus') applies the focus style to Input while focused", () => {
    const Field = engine('Input', { borderColor: 'gray' }).when('state:focus', { style: { borderColor: 'blue' } });
    const onFocus = jest.fn();
    mount(<Field onFocus={onFocus} />);
    const input = () => renderer.root.findByType((RN as any).TextInput).props;

    expect(input().style).toEqual({ borderColor: 'gray' });
    act(() => input().onFocus({}));
    expect(input().style).toEqual([{ borderColor: 'gray' }, { borderColor: 'blue' }]);
    expect(onFocus).toHaveBeenCalled();
    act(() => input().onBlur({}));
    expect(input().style).toEqual({ borderColor: 'gray' });
  });

  it("ignores when('state:hover') on mobile without warnings", () => {
    const Box = engine('Box', { opacity: 1 }).when('state:hover', { style: { opacity: 0.8 } });
    mount(<Box />);
    expect(propsOf((RN as any).View).style).toEqual({ opacity: 1 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('a prop named like a state does not trigger the state rule', () => {
    const Box = engine<'Box', { pressed?: boolean }>('Box', { opacity: 1 }).when('state:pressed', {
      style: { opacity: 0.5 },
    });
    mount(<Box pressed />);
    expect(propsOf((RN as any).View).style).toEqual({ opacity: 1 });
  });
});

describe('react-native · breakpoints', () => {
  const setWidth = (width: number) =>
    act(() => {
      mockWindow.width = width;
      mockWindowListeners.forEach((l) => l());
    });

  beforeEach(() => {
    mockWindow.width = 400;
  });

  it("applies when('breakpoints:md') only from 768 up, and re-composes when the window changes", () => {
    const Panel = engine('Box', { padding: 8 }).when('breakpoints:md', { style: { padding: 16 } });
    mount(<Panel />);
    expect(propsOf((RN as any).View).style).toEqual({ padding: 8 }); // 400 < 768

    setWidth(800); // ex.: girar o tablet
    expect(propsOf((RN as any).View).style).toEqual([{ padding: 8 }, { padding: 16 }]);

    setWidth(500);
    expect(propsOf((RN as any).View).style).toEqual({ padding: 8 });
  });

  it('is mobile-first: larger breakpoints stack on top of smaller ones, in width order', () => {
    const Panel = engine('Box', { gap: 1 })
      .when('breakpoints:lg', { style: { gap: 3 } })
      .when('breakpoints:md', { style: { gap: 2 } });
    mockWindow.width = 1100;
    mount(<Panel />);
    expect(propsOf((RN as any).View).style).toEqual([{ gap: 1 }, { gap: 2 }, { gap: 3 }]);
    setWidth(800);
    expect(propsOf((RN as any).View).style).toEqual([{ gap: 1 }, { gap: 2 }]);
  });

  it('the user style still wins over breakpoint styles', () => {
    const Panel = engine('Box', { padding: 8 }).when('breakpoints:md', { style: { padding: 16 } });
    mockWindow.width = 900;
    mount(<Panel style={{ padding: 1 }} />);
    expect(propsOf((RN as any).View).style).toEqual([{ padding: 8 }, { padding: 16 }, { padding: 1 }]);
  });

  it('converts CSS values inside breakpoint styles (rem → number)', () => {
    const Panel = engine('Box').when('breakpoints:md', { style: { paddingInline: '2rem', cursor: 'pointer' } });
    mockWindow.width = 900;
    mount(<Panel />);
    expect(propsOf((RN as any).View).style).toEqual([{}, { paddingInline: 32 }]);
  });

  it('honours configure({ breakpoints }) with custom names', () => {
    configure({ breakpoints: { tablet: 600 } });
    registerBundledProvider(reactNativeAdapter);
    const Cell = engine('Box', { width: 10 }).when('breakpoints:tablet', { style: { width: 20 } });
    mockWindow.width = 650;
    mount(<Cell />);
    expect(propsOf((RN as any).View).style).toEqual([{ width: 10 }, { width: 20 }]);
  });

  it('composes with when(pressed) on a Pressable: the host tracks pressed via onPressIn/onPressOut', () => {
    const Btn = engine('Pressable', { opacity: 1 })
      .when('breakpoints:md', { style: { opacity: 0.9 } })
      .when('state:pressed', { style: { opacity: 0.5 } });
    const onPressIn = jest.fn();
    mockWindow.width = 900;
    mount(<Btn onPressIn={onPressIn} />);
    expect(propsOf((RN as any).Pressable).style).toEqual([{ opacity: 1 }, { opacity: 0.9 }]);

    act(() => propsOf((RN as any).Pressable).onPressIn({}));
    expect(propsOf((RN as any).Pressable).style).toEqual([{ opacity: 1 }, { opacity: 0.9 }, { opacity: 0.5 }]);
    expect(onPressIn).toHaveBeenCalled(); // o handler do usuário continua sendo chamado

    act(() => propsOf((RN as any).Pressable).onPressOut({}));
    expect(propsOf((RN as any).Pressable).style).toEqual([{ opacity: 1 }, { opacity: 0.9 }]);
  });

  it('composes with animations: the animated host still receives the responsive style', () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const Box = engine('Box', { padding: 4, animation: `${fade} 100ms` }).when('breakpoints:md', { style: { padding: 8 } });
    mockWindow.width = 900;
    mount(<Box />);
    act(() => jest.runOnlyPendingTimers());
    expect(mockRuns).toHaveLength(1);
    const style = propsOf((RN as any).View).style;
    expect(style[0]).toEqual([{ padding: 4 }, { padding: 8 }]);
    expect(style[1].opacity).toBeDefined();
  });

  it("supports below ('<md') and range ('sm..lg') on the window width", () => {
    const Panel = engine('Box', { gap: 0 })
      .when('breakpoints:<md', { style: { gap: 1 } })
      .when('breakpoints:sm..lg', { style: { gap: 2 } });
    mockWindow.width = 400; // < sm
    mount(<Panel />);
    expect(propsOf((RN as any).View).style).toEqual([{ gap: 0 }, { gap: 1 }]);
    setWidth(600); // < md e dentro de sm..lg
    expect(propsOf((RN as any).View).style).toEqual([{ gap: 0 }, { gap: 1 }, { gap: 2 }]);
    setWidth(900); // >= md, ainda em sm..lg
    expect(propsOf((RN as any).View).style).toEqual([{ gap: 0 }, { gap: 2 }]);
    setWidth(1100); // >= lg
    expect(propsOf((RN as any).View).style).toEqual({ gap: 0 });
  });

  it('only components that use breakpoints pay for the window subscription', () => {
    const Plain = engine('Box', { padding: 4 });
    mount(<Plain />);
    expect(mockWindowListeners.size).toBe(0);
    const Responsive = engine('Box').when('breakpoints:md', { style: { padding: 8 } });
    mount(<Responsive />);
    expect(mockWindowListeners.size).toBe(1);
  });

  it('shares ONE window listener between all responsive components, and drops it on unmount', () => {
    const Responsive = engine('Box').when('breakpoints:md', { style: { padding: 8 } });
    const tree = mount(
      <>
        <Responsive />
        <Responsive />
        <Responsive />
      </>,
    );
    expect(mockWindowListeners.size).toBe(1);
    act(() => tree.unmount());
    mounted.length = 0;
    expect(mockWindowListeners.size).toBe(0);
  });

  it('re-renders only when the active breakpoint changes, not on every width change', () => {
    const renders = jest.fn();
    const Probe = (props: any) => {
      renders();
      return <RN.View {...props} />;
    };
    const Panel = engine(Probe as any, { padding: 8 }).when('breakpoints:md', { style: { padding: 16 } });
    mockWindow.width = 400;
    mount(<Panel />);
    renders.mockClear();

    setWidth(450); // still < md
    setWidth(500);
    expect(renders).not.toHaveBeenCalled();

    setWidth(800); // crosses md
    expect(renders).toHaveBeenCalledTimes(1);
    expect(propsOf(Probe).style).toEqual([{ padding: 8 }, { padding: 16 }]);

    setWidth(900); // still >= md
    expect(renders).toHaveBeenCalledTimes(1);

    setWidth(500); // back below md
    expect(renders).toHaveBeenCalledTimes(2);
    expect(propsOf(Probe).style).toEqual({ padding: 8 });
  });
});

describe('react-native · pseudo-elements', () => {
  const kids = (type: any) => propsOf(type).children as any[];

  it("::before / ::after become generated children around the real ones (Text with content, View without)", () => {
    const Quote = engine('Box')
      .when('::before', { style: { content: '“', color: 'teal', fontSize: '2rem' } })
      .when('::after', { style: { width: 8, height: 8, backgroundColor: 'tomato' } });
    mount(
      <Quote>
        <RN.Text>meio</RN.Text>
      </Quote>,
    );

    const [before, middle, after] = kids((RN as any).View);
    expect(before.type).toBe((RN as any).Text);
    expect(before.props.children).toBe('“');
    expect(before.props.style).toEqual({ color: 'teal', fontSize: 32 }); // 2rem → 32 (content sai do estilo)
    expect(middle.props.children.type).toBe((RN as any).Text); // o filho real fica no meio, intacto
    expect(after.type).toBe((RN as any).View); // sem content → View de decoração
    expect(after.props.style).toEqual({ width: 8, height: 8, backgroundColor: 'tomato' });
  });

  it('works with function children (Pressable) and keeps the real children', () => {
    const Btn = engine('Pressable').when('::after', { style: { content: ' ›' } });
    // children como função é uma API só do Pressable do RN (fora do tipo universal)
    mount(<Btn {...({ children: ({ pressed }: any) => (pressed ? 'on' : 'off') } as any)} />);
    const children = propsOf((RN as any).Pressable).children;
    expect(typeof children).toBe('function');
    const [before, middle, after] = children({ pressed: true });
    expect(before).toBeNull();
    expect(middle.props.children).toBe('on');
    expect(after.props.children).toBe(' ›');
  });

  it('content: none renders nothing; attr() is skipped with a warning', () => {
    const Box = engine('Box').when('::before', { style: { content: 'none' } });
    mount(<Box />);
    expect(propsOf((RN as any).View).children).toBeUndefined();
    const Attr = engine('Box').when('::before', { style: { content: 'attr(title)' } });
    mount(<Attr />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('attr(title)'));
  });

  it("::placeholder and ::selection become the Input's native props (user props win)", () => {
    const Field = engine('Input')
      .when('::placeholder', { style: { color: 'silver' } })
      .when('::selection', { style: { backgroundColor: 'gold' } });
    mount(<Field />);
    let props = propsOf((RN as any).TextInput);
    expect(props.placeholderTextColor).toBe('silver');
    expect(props.selectionColor).toBe('gold');

    mount(<Field placeholderTextColor="red" />);
    props = propsOf((RN as any).TextInput);
    expect(props.placeholderTextColor).toBe('red');
  });

  it('::first-letter styles the first letter of a plain-text Text', () => {
    const Drop = engine('Text').when('::first-letter', { style: { fontSize: '2em', fontWeight: 800 } });
    mount(<Drop>Hello</Drop>);
    const [first, rest] = kids((RN as any).Text);
    expect(first.props.children).toBe('H');
    expect(first.props.style).toEqual({ fontSize: 32, fontWeight: '800' });
    expect(rest).toBe('ello');
  });

  it('::first-letter warns (and does nothing) when the children are not plain text', () => {
    const Drop = engine('Text').when('::first-letter', { style: { fontSize: 30 } });
    mount(
      <Drop>
        <RN.Text>x</RN.Text>
      </Drop>,
    );
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('::first-letter on mobile only applies to Text with plain text'));
  });

  it('web-only pseudo-elements are ignored on mobile with ONE warning each', () => {
    const Scroller = engine('Box')
      .when('::scrollbar', { style: { width: 6 } })
      .when('::scrollbar-thumb', { style: { backgroundColor: 'gray' } })
      .when('::marker', { style: { color: 'red' } })
      .when('::first-line', { style: { letterSpacing: 2 } });
    mount(<Scroller />);
    mount(<Scroller />);
    const warnings = (console.warn as jest.Mock).mock.calls.map((c) => String(c[0]));
    for (const name of ['::scrollbar', '::scrollbar-thumb', '::marker', '::first-line']) {
      expect(warnings.filter((w) => w.includes(`${name} only exists on the web`))).toHaveLength(1);
    }
    expect(propsOf((RN as any).View).style).toEqual({});
  });

  it('::before / ::after on an Input warn instead of crashing', () => {
    const Field = engine('Input').when('::before', { style: { content: 'x' } });
    mount(<Field />);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('::before/::after on mobile only apply to primitives that accept children'));
  });
});
