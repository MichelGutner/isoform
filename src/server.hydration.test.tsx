/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import type { ReactElement } from 'react';

/**
 * Server and client are two separate copies of the library (fresh module registries: no theme, style cache or
 * stylesheet shared between them), like two processes. Only the HTML and the theme travel from one to the other.
 */
interface Library {
  React: typeof import('react');
  act: (callback: () => void | Promise<void>) => Promise<void>;
  hydrateRoot: typeof import('react-dom/client').hydrateRoot;
  renderToString: typeof import('react-dom/server.node').renderToString;
  configure: typeof import('./config').configure;
  engine: typeof import('./core/engine').engine;
  updateTheme: typeof import('./theme').updateTheme;
  useTheme: typeof import('./theme').useTheme;
  getStyleText: () => string;
  runWithTheme: typeof import('./server').runWithTheme;
}

function loadLibrary(): Library {
  let lib!: Library;
  jest.isolateModules(() => {
    const React = require('react');
    const config = require('./config');
    const { reactDomAdapter } = require('./adapters/react-dom/adapter');
    config.resetProvider();
    config.registerBundledProvider(reactDomAdapter);
    lib = {
      React,
      act: React.act,
      hydrateRoot: require('react-dom/client').hydrateRoot,
      renderToString: require('react-dom/server.node').renderToString,
      configure: config.configure,
      engine: require('./core/engine').engine,
      updateTheme: require('./theme').updateTheme,
      useTheme: require('./theme').useTheme,
      getStyleText: require('./index').getStyleText,
      runWithTheme: require('./server').runWithTheme,
    };
  });
  return lib;
}

const theme = (text: string, size = 8) => ({ color: { text }, size }) as any;
const GREEN = theme('green');
const RED = theme('red');
const BLUE = theme('blue');

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** `[class, rule]` of the first atomic `color` class of `html` in `css`. */
function colorRule(html: string, css: string): { cls: string; value: string } | undefined {
  const classes = / class="([^"]+)"/.exec(html)?.[1].split(' ') ?? [];
  for (const cls of classes) {
    const rule = new RegExp(`\\.${cls}\\{color:([^}]+)\\}`).exec(css);
    if (rule) return { cls, value: rule[1] };
  }
  return undefined;
}

/** The value `--iso-color-text` has in the `:root` rule of `css`. */
const rootToken = (css: string) => /:root\{[^}]*--iso-color-text:([^;}]+)/.exec(css)?.[1];

let consoleError: jest.SpyInstance;
let container: HTMLElement | undefined;
let root: { unmount(): void } | undefined;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  try {
    root?.unmount();
  } catch {
    // already unmounted
  }
  root = undefined;
  container?.remove();
  container = undefined;
  document.head.querySelectorAll('style[data-isoform]').forEach((el) => el.remove());
  consoleError.mockRestore();
});

describe.each([
  ['with themeVariables', ['color']],
  ['without themeVariables', []],
])('runWithTheme · hydration %s', (_name, themeVariables) => {
  const withStrictMode = [false, true];

  it.each(withStrictMode)('hydrates server markup without diagnostics and follows later theme changes (StrictMode: %s)', async (strict) => {
    // --- server: the global theme is green, this request renders red
    const server = loadLibrary();
    server.updateTheme(GREEN);
    server.configure({ performance: { themeVariables } });
    const appOf = (lib: Library): ReactElement => {
      const { React, engine, useTheme } = lib;
      const Label = engine('Text', ({ theme: t }: any) => ({ color: t.color.text }));
      const ThemeName = () => <i>{(useTheme() as any).color.text}</i>;
      const tree = (
        <>
          <Label>hi</Label>
          <ThemeName />
        </>
      );
      return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
    };
    let serverCss = '';
    const html = server.runWithTheme(RED, () => {
      const out = server.renderToString(appOf(server));
      serverCss = server.getStyleText();
      return out;
    });
    const serverRule = colorRule(html, serverCss)!;
    expect(serverRule).toBeDefined();
    if (themeVariables.length) expect(rootToken(serverCss)).toBe('red');
    // the global theme was not touched by the request
    expect((server.updateTheme({}) as any).color.text).toBe('green');

    // --- client: a fresh copy of the library, same theme and same configuration
    const client = loadLibrary();
    container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    client.updateTheme(RED);
    client.configure({ performance: { themeVariables } });

    const recoverable: unknown[] = [];
    await client.act(async () => {
      root = client.hydrateRoot(container!, appOf(client), { onRecoverableError: (e) => recoverable.push(e) });
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(recoverable).toEqual([]);
    // the class the client computed is the one the server wrote
    const clientCss = client.getStyleText();
    const clientRule = colorRule(container.innerHTML, clientCss);
    expect(clientRule).toEqual(serverRule);
    expect(container.querySelector('i')!.textContent).toBe('red');

    // --- a later theme change keeps working: red → blue → red
    const text = () => container!.querySelector('i')!.textContent;
    const effective = () => {
      const rule = colorRule(container!.innerHTML, client.getStyleText())!;
      // with variables the rule names the token and `:root` holds its value; without them the rule holds the value
      return rule.value.startsWith('var(') ? rootToken(client.getStyleText()) : rule.value;
    };
    await client.act(async () => {
      client.updateTheme(BLUE);
    });
    expect(text()).toBe('blue');
    expect(effective()).toBe('blue');
    await client.act(async () => {
      client.updateTheme(RED);
    });
    expect(text()).toBe('red');
    expect(effective()).toBe('red');
    expect(consoleError).not.toHaveBeenCalled();
    expect(recoverable).toEqual([]);
  });
});
