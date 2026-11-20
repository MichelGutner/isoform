/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Profiler } from 'react';
import { act, render } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { updateTheme } from '../../theme';
import { createFakeAdapter } from '../../core/testing/fakeAdapter';
import { reactDomAdapter } from './adapter';

const LIGHT = { color: { bg: '#ffffff', text: '#111111' }, spacing: { md: 8 } };
const DARK = { color: { bg: '#000000', text: '#eeeeee' }, spacing: { md: 12 } };

const rootRule = () => document.head.querySelector('style[data-isoform="theme"]')?.textContent ?? '';

/** Renders under a Profiler and returns how many commits the subtree had after mount. */
function mountCounting(node: React.ReactElement) {
  let commits = 0;
  const utils = render(
    <Profiler id="p" onRender={() => commits++}>
      {node}
    </Profiler>,
  );
  const mountCommits = commits;
  return { ...utils, commitsSinceMount: () => commits - mountCommits };
}

let compileSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  compileSpy = jest.spyOn(reactDomAdapter, 'compileStyle');
  act(() => {
    updateTheme(LIGHT as any);
  });
});
afterEach(() => jest.restoreAllMocks());

describe('theme as CSS variables (web)', () => {
  it('writes the tokens of the listed keys to one :root rule, now and on every change', () => {
    configure({ performance: { themeVariables: ['color'] } });
    expect(rootRule()).toContain('--iso-color-bg:#ffffff');
    expect(rootRule()).toContain('--iso-color-text:#111111');
    expect(rootRule()).not.toContain('spacing');

    act(() => {
      updateTheme(DARK as any);
    });
    expect(rootRule()).toContain('--iso-color-bg:#000000');
    expect(rootRule()).not.toContain('#ffffff');
  });

  it('is part of the server-rendered CSS', () => {
    configure({ performance: { themeVariables: ['color'] } });
    expect(reactDomAdapter.getStyleText!().startsWith(':root{')).toBe(true);
  });

  it('compiles tokens to var(...) classes, not to values', () => {
    configure({ performance: { themeVariables: ['color'] } });
    const Card = engine('Box', ({ theme }: any) => ({ backgroundColor: theme.color.bg, color: theme.color.text }));
    const { container } = render(<Card />);
    const css = reactDomAdapter.getStyleText!();
    expect(css).toContain('background-color:var(--iso-color-bg)');
    expect(css).toContain('color:var(--iso-color-text)');
    expect(container.firstElementChild!.className).toContain('o-');
  });

  it('a style that only reads tokens does NOT re-render or recompile when the theme changes', () => {
    configure({ performance: { themeVariables: ['color'] } });
    const Card = engine('Box', ({ theme }: any) => ({ backgroundColor: theme.color.bg }));
    const { commitsSinceMount } = mountCounting(<Card />);
    const compilesAfterMount = compileSpy.mock.calls.length;

    act(() => {
      updateTheme(DARK as any);
    });
    act(() => {
      updateTheme(LIGHT as any);
    });

    expect(commitsSinceMount()).toBe(0);
    expect(compileSpy.mock.calls.length).toBe(compilesAfterMount);
  });

  it('a static style never follows the theme, with or without the feature', () => {
    const Card = engine('Box', { padding: 4 });
    const { commitsSinceMount } = mountCounting(<Card />);
    act(() => {
      updateTheme(DARK as any);
    });
    expect(commitsSinceMount()).toBe(0);
  });

  it('a style that reads a real value (a number) still follows the theme', () => {
    configure({ performance: { themeVariables: ['color'] } });
    const Card = engine('Box', ({ theme }: any) => ({ backgroundColor: theme.color.bg, padding: theme.spacing.md }));
    const { container, commitsSinceMount } = mountCounting(<Card />);
    const first = container.firstElementChild!.className;

    act(() => {
      updateTheme(DARK as any);
    });

    expect(commitsSinceMount()).toBeGreaterThan(0);
    expect(container.firstElementChild!.className).not.toBe(first); // padding 8 → 12
    expect(reactDomAdapter.getStyleText!()).toContain('padding:12px');
  });

  it('keeps working for components rendered before another one revealed a real-value read', () => {
    configure({ performance: { themeVariables: ['color'] } });
    const Cell = engine('Box', ({ theme, props }: any) => ({
      backgroundColor: theme.color.bg,
      ...(props.pad ? { padding: theme.spacing.md } : null),
    }));
    const { container } = render(
      <>
        <Cell data-id="plain" />
        <Cell data-id="padded" pad />
      </>,
    );
    act(() => {
      updateTheme(DARK as any);
    });
    expect(reactDomAdapter.getStyleText!()).toContain('padding:12px');
    expect(container.querySelector('[data-id="padded"]')!.className).toContain('o-');
  });

  it('without the feature, a theme change recompiles and re-renders as before', () => {
    const Card = engine('Box', ({ theme }: any) => ({ backgroundColor: theme.color.bg }));
    const { commitsSinceMount } = mountCounting(<Card />);
    const compilesAfterMount = compileSpy.mock.calls.length;
    act(() => {
      updateTheme(DARK as any);
    });
    expect(commitsSinceMount()).toBeGreaterThan(0);
    expect(compileSpy.mock.calls.length).toBeGreaterThan(compilesAfterMount);
  });

  it('removes the :root rule when turned off with an empty list, and stops following the theme', () => {
    configure({ performance: { themeVariables: ['color'] } });
    expect(rootRule()).not.toBe('');
    configure({ performance: { themeVariables: [] } });
    expect(rootRule()).toBe('');
    act(() => {
      updateTheme(DARK as any);
    });
    expect(rootRule()).toBe('');
  });

  it('is off again after resetProvider', () => {
    configure({ performance: { themeVariables: ['color'] } });
    resetProvider();
    registerBundledProvider(reactDomAdapter);
    const Card = engine('Box', ({ theme }: any) => ({ backgroundColor: theme.color.bg }));
    render(<Card />);
    expect(reactDomAdapter.getStyleText!()).toContain('background-color:#ffffff');
  });
});

describe('theme as CSS variables (other platforms)', () => {
  it('warns once and keeps resolving tokens to values on an adapter without CSS variables', () => {
    const Base: React.FC<any> = () => null;
    const adapter = createFakeAdapter(Base);
    resetProvider();
    registerBundledProvider(adapter);
    configure({ performance: { themeVariables: ['color'] } });
    configure({ performance: { themeVariables: ['color'] } });

    const Card = engine(Base as any, (({ theme }: any) => ({ backgroundColor: theme.color.bg })) as any);
    const { container } = render(<Card />);
    expect(container).toBeDefined();
    const warns = (console.warn as jest.Mock).mock.calls.filter(([m]) => String(m).includes('themeVariables'));
    expect(warns).toHaveLength(1);
  });
});
