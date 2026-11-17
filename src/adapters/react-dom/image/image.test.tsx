/**
 * @jest-environment jsdom
 */
import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import type { ImageHandle } from '../../../core/image';
import { reactDomAdapter } from '../adapter';

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

const Picture = engine('Image', { width: 200, height: 100 });

describe('Image (web)', () => {
  it('is a plain <img> with the module off, without the module props as attributes', () => {
    const { container } = render(<Picture src="/a.png" alt="A" contentFit="contain" blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj" zoomable />);
    const img = container.querySelector('img')!;
    expect(container.firstElementChild).toBe(img);
    expect(img.getAttribute('src')).toBe('/a.png');
    expect(img.style.objectFit).toBe('contain');
    expect(img.hasAttribute('blurhash')).toBe(false);
    expect(img.hasAttribute('zoomable')).toBe(false);
  });

  it('draws the module image: fit, position, lazy loading, crossfade and load events', () => {
    configure({ modules: { image: true } });
    const onLoad = jest.fn();
    const onLoadStart = jest.fn();
    const { container } = render(
      <Picture src={{ uri: '/a.png' }} alt="A cat" contentFit="contain" contentPosition="top" priority="high" onLoad={onLoad} onLoadStart={onLoadStart} />,
    );
    const box = container.firstElementChild as HTMLElement;
    const img = container.querySelector('img')!;
    expect(box.tagName).toBe('SPAN');
    expect(box.getAttribute('aria-label')).toBe('A cat');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.objectPosition).toBe('top');
    expect(img.style.opacity).toBe('0');
    expect(onLoadStart).toHaveBeenCalled();
    fireEvent.load(img);
    expect(img.style.opacity).toBe('1');
    expect(onLoad).toHaveBeenCalledWith({ width: 0, height: 0, cacheType: 'none' });
  });

  it('zooms through the ref and reports it', () => {
    configure({ modules: { image: true } });
    const ref = createRef<ImageHandle>();
    const onZoomChange = jest.fn();
    const { container } = render(<Picture ref={ref as never} src="/a.png" zoomable onZoomChange={onZoomChange} />);
    act(() => ref.current!.zoomTo(9));
    expect(onZoomChange).toHaveBeenLastCalledWith({ scale: 4, x: 0, y: 0, rotation: 0 });
    act(() => ref.current!.rotateTo(90, false));
    expect(onZoomChange).toHaveBeenLastCalledWith({ scale: 4, x: 0, y: 0, rotation: 90 });
    const layer = container.querySelector('img')!.parentElement!;
    expect(layer.style.transform).toBe('translate(0px, 0px) rotate(90deg) scale(4)');
    act(() => ref.current!.resetZoom());
    expect(onZoomChange).toHaveBeenLastCalledWith({ scale: 1, x: 0, y: 0, rotation: 0 });
  });
});
