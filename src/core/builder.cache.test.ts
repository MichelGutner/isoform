/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { configure, registerBundledProvider, resetProvider } from '../config';
import { updateTheme } from '../theme';
import { themeStore } from '../theme/store';
import { StylizedBuilder } from './builder';
import { createFakeAdapter } from './testing/fakeAdapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const Base: React.FC<any> = () => null;

let compiles = 0;
const adapter = createFakeAdapter(Base);
const compileStyle = adapter.compileStyle;
adapter.compileStyle = (...args: Parameters<typeof compileStyle>) => {
  compiles++;
  return compileStyle(...args);
};

let renderer: TestRenderer.ReactTestRenderer | undefined;
const render = (Component: React.ComponentType<any>, props: Record<string, unknown> = {}) => {
  act(() => {
    if (renderer) renderer.update(React.createElement(Component, props));
    else renderer = TestRenderer.create(React.createElement(Component, props));
  });
  return renderer!.root.findByType(Base).props;
};

beforeEach(() => {
  compiles = 0;
  resetProvider();
  registerBundledProvider(adapter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

describe('cache keyed by the props a style reads', () => {
  const sized = () => new StylizedBuilder(Base).style((({ props }: any) => ({ width: props.size })) as any).build();

  it('does not recompile when props the style never reads change', () => {
    const Component = sized();
    render(Component, { size: 10, testID: 'a', onPress: () => 1 });
    render(Component, { size: 10, testID: 'b', onPress: () => 2 });
    render(Component, { size: 10, testID: 'c', onPress: () => 3 });
    expect(compiles).toBe(1);
  });

  it('recompiles when a prop the style reads changes', () => {
    const Component = sized();
    expect(render(Component, { size: 10 }).style).toEqual({ width: 10 });
    expect(render(Component, { size: 20 }).style).toEqual({ width: 20 });
    expect(render(Component, { size: 10 }).style).toEqual({ width: 10 });
    expect(compiles).toBe(2); // the third render is a hit
  });

  it('follows an object prop that changes (it used to serve the stale style)', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ width: props.box.width })) as any)
      .build();
    expect(render(Component, { box: { width: 10 } }).style).toEqual({ width: 10 });
    expect(render(Component, { box: { width: 99 } }).style).toEqual({ width: 99 });
  });

  it('reuses the style for the same object reference', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ width: props.box.width })) as any)
      .build();
    const box = { width: 10 };
    render(Component, { box });
    render(Component, { box });
    expect(compiles).toBe(1);
  });

  it('keeps 1 and "1" apart', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ kind: typeof props.value })) as any)
      .build();
    expect(render(Component, { value: 1 }).style).toEqual({ kind: 'number' });
    expect(render(Component, { value: '1' }).style).toEqual({ kind: 'string' });
  });

  it('learns a prop that is only read under some values of another', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => (props.mode === 'wide' ? { width: props.size } : { width: 1 })) as any)
      .build();
    expect(render(Component, { mode: 'narrow', size: 5 }).style).toEqual({ width: 1 });
    expect(render(Component, { mode: 'wide', size: 5 }).style).toEqual({ width: 5 });
    expect(render(Component, { mode: 'wide', size: 8 }).style).toEqual({ width: 8 });
    // back to narrow with another size: still the narrow style, never a leftover from `wide`
    expect(render(Component, { mode: 'narrow', size: 8 }).style).toEqual({ width: 1 });
  });

  it("tracks 'props:' conditions", () => {
    const Component = new StylizedBuilder(Base)
      .style({ padding: 1 } as any)
      .when('props:variant=ghost', { style: { opacity: 0.5 } } as any)
      .when(({ props }: any) => props.size > 10, { style: { margin: 2 } } as any)
      .build();
    expect(render(Component, { variant: 'ghost', size: 5 }).style).toEqual({ padding: 1, opacity: 0.5 });
    expect(render(Component, { variant: 'solid', size: 20 }).style).toEqual({ padding: 1, margin: 2 });
  });

  it('counts every prop when a rule enumerates them', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ count: Object.keys(props).length })) as any)
      .build();
    expect(render(Component, { a: 1 }).style).toEqual({ count: 1 });
    expect(render(Component, { a: 1, b: 2 }).style).toEqual({ count: 2 });
    expect(render(Component, { a: 1, b: 3 }).style).toEqual({ count: 2 });
  });

  it('warns once when the cache keeps evicting (a prop with too many values)', () => {
    const warn = console.warn as jest.Mock;
    const Component = sized();
    for (let i = 0; i < 305; i++) render(Component, { size: i });
    const hits = warn.mock.calls.filter(([message]) => String(message).includes('recompiled on every render'));
    expect(hits).toHaveLength(1);
  });
});

describe('static styles', () => {
  it('compile once, whatever the theme does', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 4 } as any).build();
    render(Component);
    act(() => {
      updateTheme({ colors: { a: 'one' } } as any);
    });
    act(() => {
      updateTheme({ colors: { a: 'two' } } as any);
    });
    expect(compiles).toBe(1);
  });

  it('compile again when the provider changes', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 4 } as any).build();
    render(Component);
    const other = createFakeAdapter(Base);
    registerBundledProvider(other);
    act(() => renderer!.update(React.createElement(Component)));
    expect(renderer!.root.findByType(Base).props.style).toEqual({ padding: 4 });
  });
});

describe('props added by rules', () => {
  it('reach the component, and user props win over them', () => {
    const Component = new StylizedBuilder(Base).attrs({ testID: 'fixed', accessibilityRole: 'button' } as any).build();
    expect(render(Component).testID).toBe('fixed');
    expect(render(Component, { testID: 'mine' })).toMatchObject({ testID: 'mine', accessibilityRole: 'button' });
  });

  it('do not leak between renders', () => {
    const Component = new StylizedBuilder(Base).attrs({ testID: 'fixed' } as any).build();
    render(Component, { extra: 1 });
    expect(render(Component, {}).extra).toBeUndefined();
  });
});

describe('rendering', () => {
  it('follows the theme', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ theme }: any) => ({ backgroundColor: theme.colors.bg })) as any)
      .build();
    act(() => {
      updateTheme({ colors: { bg: 'white' } } as any);
    });
    expect(render(Component).style).toEqual({ backgroundColor: 'white' });
    act(() => {
      updateTheme({ colors: { bg: 'black' } } as any);
    });
    expect(renderer!.root.findByType(Base).props.style).toEqual({ backgroundColor: 'black' });
  });

  it('forwards the ref to the component underneath', () => {
    const WithHandle = React.forwardRef<{ ok: boolean }, any>((_props, ref) => {
      React.useImperativeHandle(ref, () => ({ ok: true }));
      return null;
    });
    const registerFake = createFakeAdapter(WithHandle as any);
    registerBundledProvider(registerFake);
    const Component = new StylizedBuilder(WithHandle as any).style({ padding: 4 } as any).build();
    const ref = React.createRef<{ ok: boolean }>();
    act(() => {
      renderer = TestRenderer.create(React.createElement(Component as any, { ref }));
    });
    expect(ref.current).toEqual({ ok: true });
  });
});

describe('following the theme', () => {
  /** A base that counts its renders: it only re-renders when the styled component does. */
  const counting = () => {
    const counter = { renders: 0 };
    const Counted: React.FC<any> = () => {
      counter.renders++;
      return null;
    };
    return { Counted, counter };
  };

  it('a dynamic style that never reads the theme neither re-renders nor recompiles on a theme switch', () => {
    const { Counted, counter } = counting();
    const Component = new StylizedBuilder(Counted).style((({ props }: any) => ({ width: props.size })) as any).build();
    act(() => {
      renderer = TestRenderer.create(React.createElement(Component as any, { size: 1 }));
    });
    const before = counter.renders;
    act(() => {
      updateTheme({ colors: { bg: 'red' } } as any);
    });
    act(() => {
      updateTheme({ colors: { bg: 'blue' } } as any);
    });
    expect(counter.renders).toBe(before);
    expect(compiles).toBe(1);
  });

  it('starts following the theme once its style reads it', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ theme, props }: any) => (props.themed ? { color: theme.colors.fg } : { width: 1 })) as any)
      .build();
    act(() => {
      updateTheme({ colors: { fg: 'white' } } as any);
    });
    expect(render(Component, { themed: false }).style).toEqual({ width: 1 });
    expect(render(Component, { themed: true }).style).toEqual({ color: 'white' });
    act(() => {
      updateTheme({ colors: { fg: 'black' } } as any);
    });
    expect(renderer!.root.findByType(Base).props.style).toEqual({ color: 'black' });
  });

  it('a theme read inside a `when()` condition counts', () => {
    const Component = new StylizedBuilder(Base)
      .when(((ctx: any) => ctx.theme.dense) as any, { style: { padding: 2 } } as any)
      .build();
    act(() => {
      updateTheme({ dense: false } as any);
    });
    expect(render(Component).style).toEqual({});
    act(() => {
      updateTheme({ dense: true } as any);
    });
    expect(renderer!.root.findByType(Base).props.style).toEqual({ padding: 2 });
  });

  it('a dynamic style subscribes once per mounted component', () => {
    const subscribe = jest.spyOn(themeStore, 'subscribe');
    const Component = new StylizedBuilder(Base).style((({ props }: any) => ({ width: props.size })) as any).build();
    render(Component, { size: 1 });
    render(Component, { size: 2 });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

});

describe('ref', () => {
  /** A component with an imperative handle, like a native input or a video player. */
  const WithHandle = React.forwardRef<{ ok: boolean }, any>((_props, ref) => {
    React.useImperativeHandle(ref, () => ({ ok: true }));
    return null;
  });

  it('reaches the component underneath when the app wraps the styled component in its own forwardRef', () => {
    const Styled = new StylizedBuilder(WithHandle as any).style({ padding: 4 } as any).build();
    const AppInput = React.forwardRef<{ ok: boolean }, any>((props, ref) =>
      React.createElement(Styled as any, { ...props, ref }),
    );
    const ref = React.createRef<{ ok: boolean }>();
    act(() => {
      renderer = TestRenderer.create(React.createElement(AppInput, { ref }));
    });
    expect(ref.current).toEqual({ ok: true });
  });

  it('a ref added by a rule wins over the one passed in', () => {
    const fixed = React.createRef<{ ok: boolean }>();
    const Styled = new StylizedBuilder(WithHandle as any).when(true as any, { ref: fixed } as any).build();
    act(() => {
      renderer = TestRenderer.create(React.createElement(Styled as any, { ref: React.createRef() }));
    });
    expect(fixed.current).toEqual({ ok: true });
  });

});
