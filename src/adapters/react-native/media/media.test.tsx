/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createRef } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const R = require('react');
  const host = (name: string) => {
    const C = ({ children }: any) => children ?? null;
    C.displayName = name;
    return C;
  };
  return {
    Platform: { OS: 'ios' },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    StyleSheet: { create: (s: any) => s, absoluteFill: { position: 'absolute' } },
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    Image: host('Image'),
    TextInput: host('TextInput'),
    ScrollView: host('ScrollView'),
    __R: R,
  };
});

/* ───────────── dependências nativas simuladas ───────────── */

const listeners: Record<string, (event: any) => void> = {};
const videoPlayer: any = {
  currentTime: 0,
  duration: 120,
  loop: false,
  muted: false,
  playbackRate: 1,
  volume: 1,
  timeUpdateEventInterval: 0,
  play: jest.fn(),
  pause: jest.fn(),
  addListener: jest.fn((event: string, fn: (e: any) => void) => {
    listeners[event] = fn;
    return { remove: jest.fn() };
  }),
};
const VideoView = () => null;
const useVideoPlayer = jest.fn((_src: unknown, setup?: (p: any) => void) => {
  setup?.(videoPlayer);
  return videoPlayer;
});
jest.mock('expo-video', () => ({ useVideoPlayer: (...a: any[]) => useVideoPlayer(...(a as [any, any])), VideoView: () => null }), {
  virtual: true,
});

let audioStatus: any = { isLoaded: true, playing: false, currentTime: 0, duration: 125, didJustFinish: false };
const audioPlayer: any = {
  loop: false,
  muted: false,
  volume: 1,
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setPlaybackRate: jest.fn(),
};
jest.mock('expo-audio', () => ({ useAudioPlayer: () => audioPlayer, useAudioPlayerStatus: () => audioStatus }), { virtual: true });

const NativePdf = () => null;
jest.mock('react-native-pdf', () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock('react-native-webview', () => ({ WebView: () => null }), { virtual: true });

import { registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import type { MediaHandle } from '../../../core/media';
import { reactNativeAdapter } from '../adapter';

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}
const find = (r: TestRenderer.ReactTestRenderer, type: any) => r.root.findAllByType(type);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetProvider();
  registerBundledProvider(reactNativeAdapter);
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  Object.assign(videoPlayer, { currentTime: 0, loop: false, muted: false, playbackRate: 1, volume: 1 });
  videoPlayer.play.mockClear();
  videoPlayer.pause.mockClear();
  useVideoPlayer.mockClear();
  audioStatus = { isLoaded: true, playing: false, currentTime: 0, duration: 125, didJustFinish: false };
  Object.values(audioPlayer).forEach((f: any) => f?.mockClear?.());
});
afterEach(() => jest.restoreAllMocks());

describe('Video (mobile, expo-video)', () => {
  const Clip = engine('Video', { aspectRatio: 16 / 9 });
  const viewOf = (r: TestRenderer.ReactTestRenderer) => r.root.findByProps({ nativeControls: true }, { deep: true });

  it('creates the player from src and shows the native controls by default', () => {
    const r = mount(<Clip src="a.mp4" />);
    expect(useVideoPlayer.mock.calls[0][0]).toBe('a.mp4');
    expect(viewOf(r).props.player).toBe(videoPlayer);
    expect(viewOf(r).props.contentFit).toBe('contain');
  });

  it('hides the controls with controls={false}', () => {
    const r = mount(<Clip src="a.mp4" controls={false} />);
    expect(r.root.findByProps({ nativeControls: false })).toBeTruthy();
  });

  it('autoPlay starts the player when it is created', () => {
    mount(<Clip src="a.mp4" autoPlay />);
    expect(videoPlayer.play).toHaveBeenCalled();
  });

  it('syncs loop, muted, rate and volume to the player', () => {
    mount(<Clip src="a.mp4" loop muted rate={1.5} volume={0.4} />);
    expect(videoPlayer.loop).toBe(true);
    expect(videoPlayer.muted).toBe(true);
    expect(videoPlayer.playbackRate).toBe(1.5);
    expect(videoPlayer.volume).toBe(0.4);
  });

  it('translates player events to the omnistyle contract', () => {
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onEnded = jest.fn();
    const onTimeUpdate = jest.fn();
    const onLoad = jest.fn();
    const onError = jest.fn();
    mount(<Clip src="a.mp4" onPlay={onPlay} onPause={onPause} onEnded={onEnded} onTimeUpdate={onTimeUpdate} onLoad={onLoad} onError={onError} />);

    act(() => listeners.playingChange({ isPlaying: true }));
    act(() => listeners.playingChange({ isPlaying: false }));
    act(() => listeners.playToEnd({}));
    act(() => listeners.timeUpdate({ currentTime: 7 }));
    act(() => listeners.statusChange({ status: 'readyToPlay' }));
    act(() => listeners.statusChange({ status: 'error', error: { message: 'boom' } }));

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledWith({ currentTime: 7, duration: 120 });
    expect(onLoad).toHaveBeenCalledWith({ duration: 120 });
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('shows the poster until the first play', () => {
    const r = mount(<Clip src="a.mp4" poster="p.png" />);
    const hasPoster = () => r.root.findAllByProps({ source: { uri: 'p.png' } }).length > 0;
    expect(hasPoster()).toBe(true);
    act(() => listeners.playingChange({ isPlaying: true }));
    expect(hasPoster()).toBe(false);
  });

  it('exposes play, pause and seekTo through the ref', () => {
    const ref = createRef<MediaHandle>();
    mount(<Clip ref={ref} src="a.mp4" />);
    ref.current!.play();
    ref.current!.pause();
    ref.current!.seekTo(42);
    expect(videoPlayer.play).toHaveBeenCalled();
    expect(videoPlayer.pause).toHaveBeenCalled();
    expect(videoPlayer.currentTime).toBe(42);
  });

  it('always calls the latest callback without resubscribing', () => {
    const first = jest.fn();
    const second = jest.fn();
    const r = mount(<Clip src="a.mp4" onPlay={first} />);
    const subscriptions = videoPlayer.addListener.mock.calls.length;
    act(() => r.update(<Clip src="a.mp4" onPlay={second} />));
    act(() => listeners.playingChange({ isPlaying: true }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(videoPlayer.addListener.mock.calls.length).toBe(subscriptions);
  });
});

describe('Audio (mobile, expo-audio)', () => {
  const Track = engine('Audio');
  const texts = (r: TestRenderer.ReactTestRenderer) =>
    r.root.findAll((n) => (n.type as any)?.displayName === 'Text').map((n) => [n.props.children].flat().join(''));

  it('draws a minimal control bar with the time', () => {
    const r = mount(<Track src="a.mp3" />);
    expect(texts(r)).toContain('0:00 / 2:05');
  });

  it('renders nothing visible with controls={false}', () => {
    const r = mount(<Track src="a.mp3" controls={false} />);
    expect(texts(r)).toHaveLength(0);
  });

  it('the play button toggles play and pause', () => {
    const r = mount(<Track src="a.mp3" />);
    const press = () => r.root.findAll((n) => (n.type as any)?.displayName === 'Pressable')[0].props.onPress();
    press();
    expect(audioPlayer.play).toHaveBeenCalled();
    audioStatus = { ...audioStatus, playing: true };
    act(() => r.update(<Track src="a.mp3" />));
    press();
    expect(audioPlayer.pause).toHaveBeenCalled();
  });

  it('reports load, play and end, and applies rate', () => {
    const onLoad = jest.fn();
    const onPlay = jest.fn();
    const onEnded = jest.fn();
    const r = mount(<Track src="a.mp3" rate={1.25} onLoad={onLoad} onPlay={onPlay} onEnded={onEnded} />);
    expect(onLoad).toHaveBeenCalledWith({ duration: 125 });
    expect(audioPlayer.setPlaybackRate).toHaveBeenCalledWith(1.25);

    audioStatus = { ...audioStatus, playing: true };
    act(() => r.update(<Track src="a.mp3" rate={1.25} onLoad={onLoad} onPlay={onPlay} onEnded={onEnded} />));
    expect(onPlay).toHaveBeenCalledTimes(1);

    audioStatus = { ...audioStatus, playing: false, didJustFinish: true };
    act(() => r.update(<Track src="a.mp3" rate={1.25} onLoad={onLoad} onPlay={onPlay} onEnded={onEnded} />));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('autoPlay plays once, when the audio is loaded', () => {
    mount(<Track src="a.mp3" autoPlay />);
    expect(audioPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('seekTo goes through the ref', () => {
    const ref = createRef<MediaHandle>();
    mount(<Track ref={ref} src="a.mp3" />);
    ref.current!.seekTo(30);
    expect(audioPlayer.seekTo).toHaveBeenCalledWith(30);
  });
});

describe('Pdf and Embed (mobile)', () => {
  it('Pdf passes the source and maps load and page events', () => {
    const Doc = engine('Pdf');
    const onLoad = jest.fn();
    const onPageChange = jest.fn();
    const r = mount(<Doc src="https://x/a.pdf" page={3} onLoad={onLoad} onPageChange={onPageChange} />);
    const native = r.root.findByProps({ page: 3 });
    expect(native.props.source).toEqual({ uri: 'https://x/a.pdf', cache: true });
    native.props.onLoadComplete(12);
    native.props.onPageChanged(2, 12);
    expect(onLoad).toHaveBeenCalledWith({ pages: 12 });
    expect(onPageChange).toHaveBeenCalledWith(2, 12);
    void NativePdf;
  });

  it('Embed uses uri for src and html for inline content', () => {
    const Frame = engine('Embed');
    const byUri = mount(<Frame src="https://example.com" />).root.findByProps({ source: { uri: 'https://example.com' } });
    expect(byUri).toBeTruthy();
    const byHtml = mount(<Frame html="<p>oi</p>" />).root.findByProps({ source: { html: '<p>oi</p>' } });
    expect(byHtml).toBeTruthy();
  });
});

describe('missing optional dependency', () => {
  it('shows a clear install message instead of crashing', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-pdf', () => {
        throw new Error("Cannot find module 'react-native-pdf'");
      }, { virtual: true });
      const { Pdf } = require('./Pdf');
      const r = mount(<Pdf src="a.pdf" />);
      const text = r.root.findAll((n) => (n.type as any)?.displayName === 'Text')[0].props.children;
      expect(text).toContain('react-native-pdf');
      expect(text).toContain('npx expo install');
    });
  });
});
