/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { configure, registerBundledProvider, resetProvider } from '../config';
import { optimizedHash } from '../hash/optimizedHash';
import { updateTheme } from '../theme';
import { StylizedBuilder } from './builder';
import { getKeyframes } from './keyframes';
import { createFakeAdapter } from './testing/fakeAdapter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../hash/optimizedHash', () => ({
  optimizedHash: jest.fn(jest.requireActual('../hash/optimizedHash').optimizedHash),
}));

const Base: React.FC<any> = () => null;
const platform = { os: 'ios' };

function renderAndCapture(Component: React.ComponentType<any>, props: any = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Component, props));
  });
  const testInstance = renderer!.root.findByType(Base as any);
  return { captured: testInstance.props, renderer: renderer! };
}

describe('StylizedBuilder', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (optimizedHash as jest.Mock).mockClear();
    platform.os = 'ios';
    resetProvider();
    registerBundledProvider(createFakeAdapter(Base, platform));
  });

  afterEach(() => jest.restoreAllMocks());

  it('applies a static style object without depending on props', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 16 } as any).build();
    const { captured } = renderAndCapture(Component, { testID: 'a' });
    expect(captured.style).toEqual({ padding: 16 });
  });

  it('skips hash computation entirely for static-only rules', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 8 } as any).build();
    renderAndCapture(Component);
    renderAndCapture(Component);
    expect(optimizedHash).not.toHaveBeenCalled();
  });

  it('computes hash and caches results for dynamic (prop-dependent) rules', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ props }: any) => ({ opacity: props.disabled ? 0.5 : 1 })) as any)
      .build();

    const { captured: first } = renderAndCapture(Component, { disabled: true });
    const { captured: second } = renderAndCapture(Component, { disabled: true });

    expect(optimizedHash).toHaveBeenCalled();
    expect(first.style).toEqual({ opacity: 0.5 });
    expect(first.style).toBe(second.style);
  });

  it('applies attrs unconditionally', () => {
    const Component = new StylizedBuilder(Base).attrs({ testID: 'fixed' } as any).build();
    expect(renderAndCapture(Component).captured.testID).toBe('fixed');
  });

  it('applies when(...) attrs/style only when the condition is true', () => {
    const Component = new StylizedBuilder(Base)
      .style({ padding: 4 } as any)
      .when('props:active', { style: { opacity: 1 }, testID: 'on' } as any)
      .build();

    const { captured: on } = renderAndCapture(Component, { active: true });
    const { captured: off } = renderAndCapture(Component, { active: false });

    expect(on.style).toEqual({ padding: 4, opacity: 1 });
    expect(on.testID).toBe('on');
    expect(off.style).toEqual({ padding: 4 });
    expect(off.testID).toBeUndefined();
  });

  it("matches 'key:value' conditions exactly, not as a substring", () => {
    const Component = new StylizedBuilder(Base).when('props:status=active', { testID: 'matched' } as any).build();
    expect(renderAndCapture(Component, { status: 'active' }).captured.testID).toBe('matched');
    expect(renderAndCapture(Component, { status: 'inactive' }).captured.testID).toBeUndefined();
  });

  it('matches platform conditions statically', () => {
    const Component = new StylizedBuilder(Base).when('platform:ios', { style: { shadowOpacity: 0.2 } } as any).build();
    expect(renderAndCapture(Component).captured.style).toEqual({ shadowOpacity: 0.2 });
  });

  it("treats 'native' as any platform except web", () => {
    const build = () =>
      new StylizedBuilder(Base)
        .when('platform:native', { style: { elevation: 2 } } as any)
        .when('platform:web', { style: { cursor: 'pointer' } } as any)
        .build();

    platform.os = 'android';
    expect(renderAndCapture(build()).captured.style).toEqual({ elevation: 2 });

    platform.os = 'web';
    expect(renderAndCapture(build()).captured.style).toEqual({ cursor: 'pointer' });
  });

  it('merges rules in order, later rules overriding earlier ones', () => {
    const Component = new StylizedBuilder(Base)
      .style({ padding: 4, color: 'red' } as any)
      .style({ color: 'blue' } as any)
      .build();
    expect(renderAndCapture(Component).captured.style).toEqual({ padding: 4, color: 'blue' });
  });

  it('merges the user style prop on top of the computed style', () => {
    const Component = new StylizedBuilder(Base).style({ padding: 4 } as any).build();
    const { captured } = renderAndCapture(Component, { style: { margin: 1 } });
    expect(captured.style).toEqual([{ padding: 4 }, { margin: 1 }]);
  });

  it('forwards a static ref supplied via when(...).attrs({ ref })', () => {
    const myRef = { current: null };
    const Component = new StylizedBuilder(Base).when(true, { ref: myRef } as any).build();
    expect(renderAndCapture(Component).captured.ref).toBe(myRef);
  });

  it('recomputes styles by theme, keyed independently from props', () => {
    const Component = new StylizedBuilder(Base)
      .style((({ theme }: any) => ({ color: theme?.color ?? 'black' })) as any)
      .build();

    act(() => updateTheme({ color: 'green' } as any));
    expect(renderAndCapture(Component).captured.style).toEqual({ color: 'green' });

    act(() => updateTheme({ color: 'yellow' } as any));
    expect(renderAndCapture(Component).captured.style).toEqual({ color: 'yellow' });
  });

  describe('primitives', () => {
    it('resolves a primitive name lazily, at render time, from the active provider', () => {
      // o componente é criado ANTES de o provedor existir…
      resetProvider();
      const Component = new StylizedBuilder<any, object>('Box').style({ padding: 2 } as any).build();

      // …e só no render é resolvido
      registerBundledProvider(createFakeAdapter(Base, platform));
      expect(renderAndCapture(Component).captured.style).toEqual({ padding: 2 });
    });

    it('throws a clear error when the provider does not have the primitive', () => {
      const Component = new StylizedBuilder<any, object>('Nope').build();
      expect(() => renderAndCapture(Component)).toThrow(/primitiva "Nope" não existe no provedor "fake"/);
    });

    it('throws a clear error when no provider was registered', () => {
      resetProvider();
      const Component = new StylizedBuilder<any, object>('Box').build();
      expect(() => renderAndCapture(Component)).toThrow(/nenhum provedor disponível/);
    });
  });

  describe('interaction states', () => {
    it('collects when(<state>) styles separately and passes them to compileStyle', () => {
      const compileStyle = jest.fn((style: any, states: any) => ({ style, states }));
      const adapter = { ...createFakeAdapter(Base, platform), compileStyle };
      resetProvider();
      registerBundledProvider(adapter);

      const Component = new StylizedBuilder(Base)
        .style({ opacity: 1 } as any)
        .when('state:hover', { style: { opacity: 0.9 } } as any)
        .when('state:hover', (({ theme }: any) => ({ style: { color: theme?.color ?? 'red' } })) as any)
        .when('state:pressed', { style: { opacity: 0.5 } } as any)
        .build();
      renderAndCapture(Component);

      expect(compileStyle).toHaveBeenLastCalledWith(
        { opacity: 1 },
        { hover: { opacity: 0.9, color: expect.any(String) }, pressed: { opacity: 0.5 } },
        undefined,
        undefined,
      );
    });

    it('passes no states when there are none', () => {
      const compileStyle = jest.fn((style: any) => style);
      registerBundledProvider({ ...createFakeAdapter(Base, platform), compileStyle });
      renderAndCapture(new StylizedBuilder(Base).style({ opacity: 1 } as any).build());
      expect(compileStyle).toHaveBeenLastCalledWith({ opacity: 1 }, undefined, undefined, undefined);
    });

    it('keeps a component with only state rules on the static fast path', () => {
      const Component = new StylizedBuilder(Base).when('state:hover', { style: { opacity: 0.9 } } as any).build();
      renderAndCapture(Component);
      expect(optimizedHash).not.toHaveBeenCalled();
    });
  });

  describe('pseudo-elements', () => {
    it('collects when(<::pseudo>) styles separately and passes them as the 4th argument', () => {
      const compileStyle = jest.fn((style: any, _s: any, _b: any, pseudos: any) => ({ style, pseudos }));
      resetProvider();
      registerBundledProvider({ ...createFakeAdapter(Base, platform), compileStyle });
      const Component = new StylizedBuilder(Base)
        .style({ opacity: 1 } as any)
        .when('::before', { style: { content: '→' } } as any)
        .when('::before', (() => ({ style: { color: 'red' } })) as any)
        .when('::scrollbar', { style: { width: 6 } } as any)
        .build();
      renderAndCapture(Component);
      expect(compileStyle).toHaveBeenLastCalledWith({ opacity: 1 }, undefined, undefined, {
        '::before': { content: '→', color: 'red' },
        '::scrollbar': { width: 6 },
      });
    });

    it('ignores non-style attrs (with a dev warning) and stays on the static fast path', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const compileStyle = jest.fn((style: any) => style);
      registerBundledProvider({ ...createFakeAdapter(Base, platform), compileStyle });
      renderAndCapture(new StylizedBuilder(Base).when('::after', { style: { opacity: 1 }, title: 'x' } as any).build());
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("when('::after') só aceita { style }"));
      expect(optimizedHash).not.toHaveBeenCalled();
    });
  });

  describe('breakpoints', () => {
    const spy = () => {
      const compileStyle = jest.fn((style: any, _states: any, breakpoints: any) => ({ style, breakpoints }));
      resetProvider();
      registerBundledProvider({ ...createFakeAdapter(Base, platform), compileStyle });
      return compileStyle;
    };

    it('collects when(<breakpoint>) styles, sorted by min width, with their order', () => {
      const compileStyle = spy();
      const Component = new StylizedBuilder(Base)
        .style({ padding: 4 } as any)
        .when('breakpoints:lg', { style: { padding: 24 } } as any)
        .when('breakpoints:md', { style: { padding: 16 } } as any)
        .when('breakpoints:md', (({ theme }: any) => ({ style: { margin: theme?.color ? 1 : 2 } })) as any)
        .build();
      renderAndCapture(Component);

      expect(compileStyle).toHaveBeenLastCalledWith({ padding: 4 }, undefined, [
        { name: 'breakpoints:md', min: 768, order: 4, style: { padding: 16, margin: expect.any(Number) } },
        { name: 'breakpoints:lg', min: 1024, order: 6, style: { padding: 24 } },
      ], undefined);
    });

    it('respects configured breakpoints and never evaluates them as plain props', () => {
      const compileStyle = spy();
      configure({ breakpoints: { tablet: 600, desktop: 1100 } });
      registerBundledProvider({ ...createFakeAdapter(Base, platform), compileStyle });
      const Component = new StylizedBuilder<any, object>(Base)
        .when('breakpoints:tablet', { style: { padding: 10 } } as any)
        .when('breakpoints:md', { style: { padding: 99 } } as any) // `md` já não é breakpoint: vira condição de prop
        .build();
      const { captured } = renderAndCapture(Component, { md: true });
      expect(compileStyle.mock.calls.at(-1)![2]).toEqual([{ name: 'breakpoints:tablet', min: 600, order: 2, style: { padding: 10 } }]);
      expect(captured.style.breakpoints).toHaveLength(1);
    });

    it("supports below ('<md') and range ('sm..lg') conditions, narrower ranges after broader ones", () => {
      const compileStyle = spy();
      const Component = new StylizedBuilder(Base)
        .when('breakpoints:md', { style: { a: 1 } } as any)
        .when('breakpoints:sm..lg', { style: { b: 2 } } as any)
        .when('breakpoints:<md', { style: { c: 3 } } as any)
        .build();
      renderAndCapture(Component);
      expect(compileStyle.mock.calls.at(-1)![2]).toEqual([
        { name: 'breakpoints:<md', min: 0, max: 768, order: 1, style: { c: 3 } },
        { name: 'breakpoints:sm..lg', min: 480, max: 1024, order: 3, style: { b: 2 } },
        { name: 'breakpoints:md', min: 768, order: 4, style: { a: 1 } },
      ]);
    });

    it('ignores ranges that reference unknown names or are inverted (they become plain prop conditions)', () => {
      const compileStyle = spy();
      renderAndCapture(
        new StylizedBuilder(Base).when('breakpoints:<nope', { style: { a: 1 } } as any).when('breakpoints:lg..sm', { style: { b: 1 } } as any).build(),
      );
      expect(compileStyle.mock.calls.at(-1)![2]).toBeUndefined();
    });

    it('keeps a component with only breakpoint rules on the static fast path', () => {
      spy();
      renderAndCapture(new StylizedBuilder(Base).when('breakpoints:md', { style: { padding: 1 } } as any).build());
      expect(optimizedHash).not.toHaveBeenCalled();
    });

    it('ignores non-style attrs in breakpoint rules (with a dev warning)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const compileStyle = spy();
      renderAndCapture(new StylizedBuilder(Base).when('breakpoints:sm', { style: { opacity: 1 }, title: 'x' } as any).build());
      expect(compileStyle.mock.calls.at(-1)![2][0].style).toEqual({ opacity: 1 });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("when('breakpoints:sm') só aceita { style }"));
    });
  });

  it('resolves inline keyframes in animationName into a registered name (provider-independent)', () => {
    const frames = { from: { opacity: 0 }, to: { opacity: 1 } };
    const Component = new StylizedBuilder(Base).style({ animationName: frames, animationDuration: '1s' } as any).build();
    const { style } = renderAndCapture(Component).captured;
    expect(style.animationDuration).toBe('1s');
    expect(style.animationName).toMatch(/^o-kf-[a-z0-9]+$/);
    expect(getKeyframes(style.animationName)).toEqual(frames);
  });

  it('lets the adapter swap the rendered component (resolveComponent)', () => {
    const Other: React.FC<any> = () => null;
    registerBundledProvider({ ...createFakeAdapter(Base, platform), resolveComponent: () => Other });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(React.createElement(new StylizedBuilder(Base).build()));
    });
    expect(renderer!.root.findAllByType(Other)).toHaveLength(1);
  });

  it('extend() inherits rules without changing the original', () => {
    const original = new StylizedBuilder(Base).style({ padding: 10 } as any);
    const extended = original.extend().style({ margin: 20 } as any);

    expect(renderAndCapture(extended.build()).captured.style).toEqual({ padding: 10, margin: 20 });
    expect(renderAndCapture(original.build()).captured.style).toEqual({ padding: 10 });
  });
});
