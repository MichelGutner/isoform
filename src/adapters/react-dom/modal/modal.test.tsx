/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactDomAdapter } from '../adapter';

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.useFakeTimers();
});
afterEach(() => {
  warnSpy.mockRestore();
  jest.useRealTimers();
});

const Dialog = engine('Modal', { padding: 16 });

describe('Modal (web) · loaded on demand', () => {
  it('renders nothing while it has never been opened', () => {
    configure({ modules: { modal: true } });
    const { container } = render(<Dialog open={false}>hi</Dialog>);
    expect(container.innerHTML).toBe('');
  });

  it('loads the dialog the first time it opens, and keeps it mounted after closing', async () => {
    jest.useRealTimers();
    configure({ modules: { modal: true } });
    const { container, rerender, findByText } = render(<Dialog open={false}>hello</Dialog>);
    expect(container.querySelector('dialog')).toBeNull();

    rerender(<Dialog open>hello</Dialog>);
    await findByText('hello');
    expect(container.querySelector('dialog')).not.toBeNull();

    rerender(<Dialog open={false}>hello</Dialog>);
    expect(container.querySelector('dialog')).not.toBeNull(); // it animates out, it does not vanish
  });
});

describe('Modal (web)', () => {
  it('renders nothing with the module off', () => {
    const { container } = render(<Dialog open>hi</Dialog>);
    expect(container.innerHTML).toBe('');
  });

  it('is a <dialog> that animates in and out, closed with Escape', () => {
    configure({ modules: { modal: true } });
    const onOpenChange = jest.fn();
    const onClosed = jest.fn();
    const { container, rerender } = render(
      <Dialog open onOpenChange={onOpenChange} onClosed={onClosed} label="Confirm" backdropColor="rgba(0,0,0,0.6)">
        hi
      </Dialog>,
    );
    const dialog = container.querySelector('dialog')!;
    expect(dialog.className).toContain('om-scale');
    expect(dialog.className).toContain('om-shown');
    expect(dialog.getAttribute('aria-label')).toBe('Confirm');
    expect(dialog.style.getPropertyValue('--om-backdrop')).toBe('rgba(0,0,0,0.6)');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <Dialog open={false} onOpenChange={onOpenChange} onClosed={onClosed}>
        hi
      </Dialog>,
    );
    expect(container.querySelector('dialog')!.className).not.toContain('om-shown');
    act(() => {
      jest.runAllTimers();
    });
    expect(onClosed).toHaveBeenCalled();
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('full screen slides, and does not close when not dismissible', () => {
    configure({ modules: { modal: true } });
    const onOpenChange = jest.fn();
    const { container } = render(<Dialog open presentation="fullScreen" dismissible={false} onOpenChange={onOpenChange} />);
    const dialog = container.querySelector('dialog')!;
    expect(dialog.className).toContain('om-full');
    expect(dialog.className).toContain('om-slide');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
