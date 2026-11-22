/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server.node';
import { registerBundledProvider, resetProvider } from './config';
import { engine } from './core/engine';
import { reactDomAdapter } from './adapters/react-dom/adapter';
import { updateTheme, useTheme } from './theme';
import { runWithTheme } from './server';

const RED = { color: { text: 'red' } } as any;

const Label = engine('Text', ({ theme }: any) => ({ color: theme.color.text }));

function ThemeName() {
  return <i>{(useTheme() as any).color.text}</i>;
}

beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  act(() => {
    updateTheme({ color: { text: 'green' } } as any);
  });
});

describe('runWithTheme · hydration', () => {
  it('hydrates without mismatches once the client sets the same theme', async () => {
    const app = (
      <StrictMode>
        <Label>hi</Label>
        <ThemeName />
      </StrictMode>
    );
    const container = document.createElement('div');
    container.innerHTML = runWithTheme(RED, () => renderToString(app));
    const serverHtml = container.innerHTML;
    document.body.appendChild(container);

    // the client: the theme the server used, then hydrate (no wrapper component)
    updateTheme(RED);
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, app, { onRecoverableError: (e) => errors.push(e) });
    });

    expect(errors).toEqual([]);
    expect(container.innerHTML).toBe(serverHtml);
    expect(container.querySelector('i')!.textContent).toBe('red');

    // and the global theme keeps driving the client afterwards
    act(() => {
      updateTheme({ color: { text: 'blue' } } as any);
    });
    expect(container.querySelector('i')!.textContent).toBe('blue');
    container.remove();
  });
});
