/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { WithoutPlaylist } from '../../../../core/playlist';
import type { AudioHandle, AudioOwnProps } from '../../../../core/media';
import { AudioControls, SHORTCUTS, type AudioActions, type AudioState } from './AudioControls';
import { ensureAudioStyles } from './audioStyles';
import { bufferedEnd, changeVolume, classNames, finite, playSafely, seek, togglePlayback } from '../shared/helpers';

/**
 * `Audio` on the web: a card with the browser's `<audio>` (hidden) and the lib's
 * controls. Element events are translated to the omnistyle contract
 * (`onTimeUpdate({ currentTime, duration })`, `onSeek({ from, to })`…).
 *
 * The style of `engine('Audio', …)` goes to the card.
 */

interface AudioElementProps extends Partial<AudioOwnProps> {
  className?: string;
  style?: React.CSSProperties;
  [rest: string]: any;
}

const INITIAL_STATE: AudioState = {
  playing: false,
  buffering: false,
  current: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  rate: 1,
};

/** The buffer is only reported every new half second. */
const BUFFER_STEP = 0.5;

/** What the player shows, read straight from the element. */
const readElement = (a: HTMLAudioElement): Partial<AudioState> => ({
  current: a.currentTime,
  duration: finite(a.duration),
  volume: a.volume,
  muted: a.muted,
  rate: a.playbackRate,
});

export const Audio = forwardRef<WithoutPlaylist<AudioHandle>, AudioElementProps>(
  (
    {
      src,
      controls = true,
      title,
      artist,
      artwork,
      autoPlay,
      loop,
      muted,
      rate,
      volume,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onLoad,
      onError,
      onSeek,
      onBuffering,
      onBufferedChange,
      onVolumeChange,
      onRateChange,
      overlay,
      controlsExtra,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    ensureAudioStyles();
    const audio = useRef<HTMLAudioElement>(null);
    const [state, setState] = useState<AudioState>(() => ({ ...INITIAL_STATE, muted: !!muted }));
    const patch = (changes: Partial<AudioState>) => setState((s) => ({ ...s, ...changes }));

    // position before the seek (`seeking` already arrives with the new one)
    const lastTime = useRef(0);
    const seekFrom = useRef(0);
    const buffering = useRef(false);
    const lastBuffered = useRef(0);

    /** Actions on the element (used by the controls and by the `ref`). */
    const actions = useMemo<AudioActions>(() => {
      const run = (fn: (a: HTMLAudioElement) => void) => audio.current && fn(audio.current);
      return {
        togglePlay: () => run(togglePlayback),
        seekTo: (seconds) => run((a) => seek(a, seconds)),
        skip: (seconds) => run((a) => seek(a, a.currentTime + seconds)),
        setVolume: (value) => run((a) => changeVolume(a, value)),
        toggleMute: () => run((a) => void (a.muted = !a.muted)),
        setRate: (value) => run((a) => void (a.playbackRate = value)),
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        play: () => audio.current && playSafely(audio.current),
        pause: () => audio.current?.pause(),
        seekTo: actions.seekTo,
      }),
      [actions],
    );

    // `playbackRate` and `volume` are not HTML attributes: they must be set on the element.
    useEffect(() => {
      if (audio.current && rate !== undefined) audio.current.playbackRate = rate;
    }, [rate, src]);
    useEffect(() => {
      if (audio.current && volume !== undefined) audio.current.volume = volume;
    }, [volume, src]);

    const setBuffering = (value: boolean) => {
      if (buffering.current === value) return;
      buffering.current = value;
      patch({ buffering: value });
      onBuffering?.(value);
    };

    /** `<audio>` events → controls state + omnistyle contract. */
    const events: React.AudioHTMLAttributes<HTMLAudioElement> = {
      onPlay: () => {
        patch({ playing: true });
        onPlay?.();
      },
      onPause: () => {
        patch({ playing: false });
        onPause?.();
      },
      onEnded: () => {
        patch({ playing: false });
        onEnded?.();
      },
      onTimeUpdate: () => {
        const a = audio.current!;
        if (!a.seeking) lastTime.current = a.currentTime;
        patch({ current: a.currentTime, duration: finite(a.duration) });
        onTimeUpdate?.({ currentTime: a.currentTime, duration: finite(a.duration) });
      },
      onDurationChange: () => patch({ duration: finite(audio.current?.duration) }),
      onLoadedMetadata: () => {
        const a = audio.current!;
        patch(readElement(a));
        onLoad?.({ duration: finite(a.duration), width: 0, height: 0 });
      },
      onError: () => onError?.(audio.current?.error?.message || 'Failed to load the audio.'),
      onSeeking: () => {
        seekFrom.current = lastTime.current;
        patch({ current: audio.current?.currentTime ?? 0 });
      },
      onSeeked: () => {
        const to = audio.current?.currentTime ?? 0;
        lastTime.current = to;
        onSeek?.({ from: seekFrom.current, to });
      },
      onWaiting: () => setBuffering(true),
      onPlaying: () => setBuffering(false),
      onCanPlay: () => setBuffering(false),
      onProgress: () => {
        const end = bufferedEnd(audio.current!);
        patch({ buffered: end });
        if (Math.abs(end - lastBuffered.current) < BUFFER_STEP) return;
        lastBuffered.current = end;
        onBufferedChange?.(end);
      },
      onVolumeChange: () => {
        const { volume: value, muted: isMuted } = audio.current!;
        patch({ volume: value, muted: isMuted });
        onVolumeChange?.({ volume: value, muted: isMuted });
      },
      onRateChange: () => {
        const value = audio.current!.playbackRate;
        patch({ rate: value });
        onRateChange?.(value);
      },
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      const shortcut = SHORTCUTS[e.key];
      if (!shortcut || e.target !== e.currentTarget) return; // buttons handle Space/Enter themselves
      e.preventDefault();
      shortcut(actions, state);
    };

    return (
      <div
        {...rest}
        className={classNames(className, controls ? 'oa' : undefined)}
        style={style}
        tabIndex={controls ? 0 : undefined}
        role={controls ? 'group' : undefined}
        aria-label={controls ? 'Audio player' : undefined}
        onKeyDown={controls ? onKeyDown : undefined}
      >
        <audio
          ref={audio}
          className="oa-media"
          src={src}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          preload="metadata"
          {...events}
        />
        {controls ? <AudioControls state={state} actions={actions} meta={{ title, artist, artwork }} extra={controlsExtra} /> : null}
        {overlay}
      </div>
    );
  },
);
Audio.displayName = 'Audio';
