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

  it('uses real values inside runWithTheme when theme variables are on (the :root rule holds the global theme)', () => {
    configure({ performance: { themeVariables: ['color'] } });
    const html = runWithTheme(RED, () => renderToString(<Label>x</Label>));
    expect(colorOf(html)).toBe('red');
    // outside a scope the same component still uses the variable
    const global = renderToString(<Label>y</Label>);
    expect(colorOf(global)).toBe('var(--iso-color-text)');
    configure({ performance: { themeVariables: [] } });
  });
});
