/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createRef } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../../config';
import { engine } from '../../../../core/engine';
import type { MediaHandle } from '../../../../core/media';
import { reactDomAdapter } from '../../adapter';

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
  configure({ modules: { video: true } }); // módulos vêm desligados por padrão
  play.mockClear();
  pause.mockClear();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

const first = (container: HTMLElement) => container.querySelector('video') as HTMLMediaElement;

/** O player é carregado sob demanda (`import()`): espera o <video> aparecer. */
async function renderVideo(ui: React.ReactElement) {
  const result = render(ui);
  await waitFor(() => expect(first(result.container)).not.toBeNull());
  return result;
}

describe('Video (web)', () => {
  const Clip = engine('Video', { aspectRatio: 16 / 9, borderRadius: 8 });

  it('renders a container with the engine style, a <video> and the lib controls', async () => {
    const { container, getByLabelText } = await renderVideo(<Clip src="a.mp4" poster="p.png" testID="clip" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('data-testid')).toBe('clip');
    expect(box.className).toContain('o-video');
    expect(box.className.split(' ').length).toBeGreaterThan(2); // + classes do estilo
    const el = first(container);
    expect(el.getAttribute('src')).toBe('a.mp4');
    expect(el.getAttribute('poster')).toBe('p.png');
    expect(el.controls).toBe(false); // os controles são os da lib, não os do navegador
    expect(el.getAttribute('playsinline')).not.toBeNull();
    expect(getByLabelText('Reproduzir')).toBeTruthy();
  });

  it('lets the controls be turned off and forwards loop, muted and autoPlay', async () => {
    const { container } = await renderVideo(<Clip src="a.mp4" controls={false} loop muted autoPlay />);
    const el = first(container);
    expect(container.querySelector('button')).toBeNull();
    expect(el.loop).toBe(true);
    expect(el.muted).toBe(true);
    expect(el.autoplay).toBe(true);
  });

  it('translates DOM events to the omnistyle contract', async () => {
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onEnded = jest.fn();
    const onTimeUpdate = jest.fn();
    const onLoad = jest.fn();
    const onError = jest.fn();
    const { container } = await renderVideo(
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
    expect(onLoad).toHaveBeenCalledWith({ duration: 90, width: 0, height: 0 });
    expect(onError).toHaveBeenCalledWith('Falha ao carregar a mídia.');
  });

  it('reports duration 0 while it is unknown (NaN in the browser)', async () => {
    const onTimeUpdate = jest.fn();
    const { container } = await renderVideo(<Clip src="a.mp4" onTimeUpdate={onTimeUpdate} />);
    fireEvent.timeUpdate(first(container));
    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 0, duration: 0 });
  });

  it('exposes play, pause and seekTo through the ref', async () => {
    const ref = createRef<MediaHandle>();
    const { container } = await renderVideo(<Clip ref={ref} src="a.mp4" />);
    ref.current!.play();
    ref.current!.pause();
    ref.current!.seekTo(33);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(first(container).currentTime).toBe(33);
  });

  it('applies rate and volume (they are not HTML attributes) and updates them', async () => {
    const { container, rerender } = await renderVideo(<Clip src="a.mp4" rate={1.5} volume={0.3} />);
    expect(first(container).playbackRate).toBe(1.5);
    expect(first(container).volume).toBeCloseTo(0.3);
    rerender(<Clip src="a.mp4" rate={2} volume={1} />);
    expect(first(container).playbackRate).toBe(2);
    expect(first(container).volume).toBe(1);
  });

  it('does not leak omnistyle props to the DOM (no React warnings)', async () => {
    await renderVideo(<Clip src="a.mp4" rate={2} volume={1} onTimeUpdate={() => {}} onLoad={() => {}} />);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
