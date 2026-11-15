/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import type { MediaHandle } from '../../../core/media';
import { reactDomAdapter } from '../adapter';

const play = jest.fn(() => Promise.resolve());
const pause = jest.fn();

beforeAll(() => {
  // o jsdom não implementa reprodução de mídia
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
});

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  play.mockClear();
  pause.mockClear();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

const first = (container: HTMLElement) => container.firstElementChild as HTMLMediaElement;

describe('Video (web)', () => {
  const Clip = engine('Video', { aspectRatio: 16 / 9, borderRadius: 8 });

  it('renders a <video> with controls, inline playback and the engine style', () => {
    const { container } = render(<Clip src="a.mp4" poster="p.png" testID="clip" />);
    const el = first(container);
    expect(el.tagName).toBe('VIDEO');
    expect(el.getAttribute('src')).toBe('a.mp4');
    expect(el.getAttribute('poster')).toBe('p.png');
    expect(el.controls).toBe(true);
    expect(el.getAttribute('playsinline')).not.toBeNull();
    expect(el.getAttribute('data-testid')).toBe('clip');
    expect(el.className).toContain('o-video');
    expect(el.className.split(' ').length).toBeGreaterThan(1); // + classes do estilo
  });

  it('lets the controls be turned off and forwards loop, muted and autoPlay', () => {
    const { container } = render(<Clip src="a.mp4" controls={false} loop muted autoPlay />);
    const el = first(container);
    expect(el.controls).toBe(false);
    expect(el.loop).toBe(true);
    expect(el.muted).toBe(true);
    expect(el.autoplay).toBe(true);
  });

  it('translates DOM events to the omnistyle contract', () => {
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onEnded = jest.fn();
    const onTimeUpdate = jest.fn();
    const onLoad = jest.fn();
    const onError = jest.fn();
    const { container } = render(
      <Clip
        src="a.mp4"
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onLoad={onLoad}
        onError={onError}
      />,
    );
    const el = first(container);
    Object.defineProperty(el, 'currentTime', { configurable: true, writable: true, value: 12 });
    Object.defineProperty(el, 'duration', { configurable: true, value: 90 });

    fireEvent.play(el);
    fireEvent.pause(el);
    fireEvent.ended(el);
    fireEvent.timeUpdate(el);
    fireEvent(el, new Event('loadedmetadata'));
    fireEvent.error(el);

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 12, duration: 90 });
    expect(onLoad).toHaveBeenCalledWith({ duration: 90 });
    expect(onError).toHaveBeenCalledWith('Falha ao carregar a mídia.');
  });

  it('reports duration 0 while it is unknown (NaN in the browser)', () => {
    const onTimeUpdate = jest.fn();
    const { container } = render(<Clip src="a.mp4" onTimeUpdate={onTimeUpdate} />);
    fireEvent.timeUpdate(first(container));
    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 0, duration: 0 });
  });

  it('exposes play, pause and seekTo through the ref', () => {
    const ref = createRef<MediaHandle>();
    const { container } = render(<Clip ref={ref} src="a.mp4" />);
    ref.current!.play();
    ref.current!.pause();
    ref.current!.seekTo(33);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(first(container).currentTime).toBe(33);
  });

  it('applies rate and volume (they are not HTML attributes) and updates them', () => {
    const { container, rerender } = render(<Clip src="a.mp4" rate={1.5} volume={0.3} />);
    expect(first(container).playbackRate).toBe(1.5);
    expect(first(container).volume).toBeCloseTo(0.3);
    rerender(<Clip src="a.mp4" rate={2} volume={1} />);
    expect(first(container).playbackRate).toBe(2);
    expect(first(container).volume).toBe(1);
  });

  it('does not leak omnistyle props to the DOM (no React warnings)', () => {
    render(<Clip src="a.mp4" rate={2} volume={1} onTimeUpdate={() => {}} onLoad={() => {}} />);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('Audio (web)', () => {
  const Track = engine('Audio');

  it('renders an <audio> with controls and no poster', () => {
    const { container } = render(<Track src="a.mp3" poster="ignored.png" as any />);
    const el = first(container);
    expect(el.tagName).toBe('AUDIO');
    expect(el.controls).toBe(true);
    expect(el.hasAttribute('poster')).toBe(false);
    expect(el.hasAttribute('playsinline')).toBe(false);
  });

  it('shares the handle and events with Video', () => {
    const ref = createRef<MediaHandle>();
    const onEnded = jest.fn();
    const { container } = render(<Track ref={ref} src="a.mp3" onEnded={onEnded} />);
    ref.current!.seekTo(5);
    fireEvent.ended(first(container));
    expect(first(container).currentTime).toBe(5);
    expect(onEnded).toHaveBeenCalled();
  });
});

describe('Pdf (web)', () => {
  const Doc = engine('Pdf', { height: 400 });

  it('renders the browser viewer in an iframe starting at page 1', () => {
    const { container } = render(<Doc src="/a.pdf" />);
    const el = first(container) as unknown as HTMLIFrameElement;
    expect(el.tagName).toBe('IFRAME');
    expect(el.getAttribute('src')).toBe('/a.pdf#page=1');
    expect(el.className).toContain('o-pdf');
  });

  it('opens on the requested page and reports load (without a page count)', () => {
    const onLoad = jest.fn();
    const { container } = render(<Doc src="/a.pdf" page={4} onLoad={onLoad} />);
    expect(first(container).getAttribute('src')).toBe('/a.pdf#page=4');
    fireEvent.load(first(container));
    expect(onLoad).toHaveBeenCalledWith({});
  });

  it('does not leak onPageChange to the DOM', () => {
    render(<Doc src="/a.pdf" onPageChange={() => {}} />);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('Embed (web)', () => {
  const Frame = engine('Embed');

  it('embeds a page by src, with an accessible title', () => {
    const { container } = render(<Frame src="https://example.com" title="Exemplo" />);
    const el = first(container);
    expect(el.tagName).toBe('IFRAME');
    expect(el.getAttribute('src')).toBe('https://example.com');
    expect(el.getAttribute('title')).toBe('Exemplo');
  });

  it('uses html as srcdoc and lets it win over src', () => {
    const { container } = render(<Frame src="https://example.com" html="<p>oi</p>" />);
    const el = first(container);
    expect(el.getAttribute('srcdoc')).toBe('<p>oi</p>');
    expect(el.hasAttribute('src')).toBe(false);
  });

  it('reports load', () => {
    const onLoad = jest.fn();
    const { container } = render(<Frame src="x" onLoad={onLoad} />);
    fireEvent.load(first(container));
    expect(onLoad).toHaveBeenCalled();
  });
});
