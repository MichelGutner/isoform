/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, use } from 'react';
import { PassThrough } from 'stream';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { configure, registerBundledProvider, resetProvider } from './config';
import { engine } from './core/engine';
import { reactDomAdapter } from './adapters/react-dom/adapter';
import { getStyleText } from './index';
import { getTheme, updateTheme, useTheme } from './theme';
import { runWithTheme } from './server';

const theme = (text: string) => ({ color: { text } }) as any;
const RED = theme('red');
const BLUE = theme('blue');
const GREEN = theme('green');

const Label = engine('Text', ({ theme: t }: any) => ({ color: t.color.text }));

/** The `color` the server CSS gives the first atomic class of `html`. */
function colorOf(html: string): string | undefined {
  const css = reactDomAdapter.getStyleText!();
  const classes = /class="([^"]+)"/.exec(html)?.[1].split(' ') ?? [];
  for (const cls of classes) {
    const rule = new RegExp(`\\.${cls}\\{color:([^}]+)\\}`).exec(css);
    if (rule) return rule[1];
  }
  return undefined;
}

/** A gate the render suspends on until `open()`: lets two renders interleave in one process. */
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

function Deferred({ until, children }: { until: Promise<void>; children: React.ReactNode }) {
  use(until);
  return <>{children}</>;
}

/** Streams `node` to a string; resolves when the whole shell and all boundaries are written. */
function stream(node: React.ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new PassThrough();
    sink.on('data', (chunk) => (html += chunk.toString()));
    sink.on('end', () => resolve(html));
    const { pipe } = renderToPipeableStream(node, {
      onAllReady: () => pipe(sink),
      onError: reject,
    });
  });
}

beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  updateTheme(GREEN);
});

describe('runWithTheme · per-request themes on the server', () => {
  it('keeps the theme of each interleaved render, whatever order they finish in', async () => {
    const a = gate();
    const b = gate();
    const tree = (until: Promise<void>) => (
      <Suspense fallback={null}>
        <Deferred until={until}>
          <Label>hi</Label>
        </Deferred>
      </Suspense>
    );

    // A starts (red) and waits; B starts (blue); the global theme moves on meanwhile; B finishes, then A.
    const renderA = runWithTheme(RED, () => stream(tree(a.promise)));
    const renderB = runWithTheme(BLUE, () => stream(tree(b.promise)));
    updateTheme(GREEN);
    b.open();
    const htmlB = await renderB;
    a.open();
    const htmlA = await renderA;

    expect(colorOf(htmlA)).toBe('red');
    expect(colorOf(htmlB)).toBe('blue');
  });

  it('does not leak a finished render into later ones', async () => {
    await runWithTheme(RED, () => stream(<Label>a</Label>));
    const later = renderToString(<Label>b</Label>);
    expect(colorOf(later)).toBe('green');
    expect((getTheme() as any).color.text).toBe('green'); // the global store was not touched
  });

  it('gives useTheme() and getTheme() inside a rule the scoped theme', () => {
    let hooked: any;
    const Probe = () => {
      hooked = useTheme();
      return null;
    };
    const ViaGetTheme = engine('Text', () => ({ color: (getTheme() as any).color.text }));
    const html = runWithTheme(BLUE, () =>
      renderToString(
        <>
          <Probe />
          <ViaGetTheme>x</ViaGetTheme>
        </>,
      ),
    );
    expect(hooked.color.text).toBe('blue');
    expect(colorOf(html)).toBe('blue');
  });

  describe('with themeVariables', () => {
    beforeEach(() => configure({ performance: { themeVariables: ['color'] } }));
    afterEach(() => configure({ performance: { themeVariables: [] } }));

    /** The value `--iso-color-text` has in the `:root` rule of `css`. */
    const rootToken = (css: string) => /:root\{[^}]*--iso-color-text:([^;}]+)/.exec(css)?.[1];

    it('compiles inside and outside runWithTheme to the same classes (var tokens), with the request values in :root', () => {
      let scopedCss = '';
      const scoped = runWithTheme(RED, () => {
        const out = renderToString(<Label>x</Label>);
        scopedCss = getStyleText();
        return out;
      });
      const global = renderToString(<Label>y</Label>);

      expect(colorOf(scoped)).toBe('var(--iso-color-text)');
      expect(colorOf(global)).toBe('var(--iso-color-text)');
      expect(/class="([^"]+)"/.exec(scoped)![1]).toBe(/class="([^"]+)"/.exec(global)![1]);
      expect(rootToken(scopedCss)).toBe('red');
      // outside a request the :root rule is the global theme's
      expect(rootToken(getStyleText())).toBe('green');
    });

    it('gives each interleaved request its own :root values, and leaves the global theme alone', async () => {
      const a = gate();
      const b = gate();
      const request = (t: any, until: Promise<void>) =>
        runWithTheme(t, async () => {
          const html = await stream(
            <Suspense fallback={null}>
              <Deferred until={until}>
                <Label>hi</Label>
              </Deferred>
            </Suspense>,
          );
          return { html, css: getStyleText() }; // after the await: the theme followed the async work
        });

      const renderA = request(RED, a.promise);
      const renderB = request(BLUE, b.promise);
      updateTheme(GREEN);
      b.open();
      const resultB = await renderB;
      a.open();
      const resultA = await renderA;

      expect(rootToken(resultA.css)).toBe('red');
      expect(rootToken(resultB.css)).toBe('blue');
      expect(colorOf(resultA.html)).toBe('var(--iso-color-text)');
      expect((getTheme() as any).color.text).toBe('green');
    });

    it('keeps a style that reads a token and a real value correct for each request', () => {
      const Mixed = engine('Box', ({ theme: t }: any) => ({ color: t.color.text, width: t.size }));
      const wide = { color: { text: 'red' }, size: 40 } as any;
      const narrow = { color: { text: 'blue' }, size: 10 } as any;
      const width = (html: string) => {
        const css = reactDomAdapter.getStyleText!();
        const classes = /class="([^"]+)"/.exec(html)![1].split(' ');
        return classes.map((cls) => new RegExp(`\\.${cls}\\{width:([^}]+)\\}`).exec(css)?.[1]).find(Boolean);
      };
      const first = runWithTheme(wide, () => renderToString(<Mixed />));
      const second = runWithTheme(narrow, () => renderToString(<Mixed />));
      const third = runWithTheme(wide, () => renderToString(<Mixed />));

      expect(width(first)).toBe('40px');
      expect(width(second)).toBe('10px');
      expect(width(third)).toBe('40px');
    });
  });
});
