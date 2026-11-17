/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { WithoutPlaylist } from '../../../../core/playlist';
import type { VideoHandle, VideoOwnProps } from '../../../../core/media';
import { setFullscreen, watchFullscreen } from './fullscreen';
import { isPictureInPictureSupported, togglePictureInPicture, watchPictureInPicture } from './pictureInPicture';
import { VideoControls, type PlayerActions, type PlayerState } from './VideoControls';
import {
  bufferedEnd,
  changeVolume,
  classNames,
  finite,
  playSafely,
  seek,
  togglePlayback,
  useLatest,
} from '../shared/helpers';
import { ensureVideoStyles } from './videoStyles';

/**
 * `Video` na web: um container com o `<video>` do navegador e os controles da
 * lib por cima (os mesmos do Android/iOS). Os eventos do elemento são
 * traduzidos para o contrato do isoform (`onTimeUpdate({ currentTime, duration })`,
 * `onSeek({ from, to })`…).
 *
 * O estilo do `engine('Video', …)` vai para o container; o vídeo o preenche.
 */

interface VideoElementProps extends Partial<VideoOwnProps> {
  className?: string;
  style?: React.CSSProperties;
  [rest: string]: any;
}

const INITIAL_STATE: PlayerState = {
  playing: false,
  buffering: false,
  current: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  rate: 1,
  fullscreen: false,
  pip: false,
  pipSupported: false,
};

/** O buffer só é avisado a cada meio segundo novo (evita uma enxurrada de eventos). */
const BUFFER_STEP = 0.5;

/** O que o player mostra, lido direto do elemento. */
const readElement = (v: HTMLVideoElement): Partial<PlayerState> => ({
  current: v.currentTime,
  duration: finite(v.duration),
  volume: v.volume,
  muted: v.muted,
  rate: v.playbackRate,
});

export const Video = forwardRef<WithoutPlaylist<VideoHandle>, VideoElementProps>(
  (
    {
      src,
      poster,
      controls = true,
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
      onFullscreenChange,
      onPictureInPictureChange,
      overlay,
      controlsExtra,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    ensureVideoStyles();
    const root = useRef<HTMLDivElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const [state, setState] = useState<PlayerState>(() => ({ ...INITIAL_STATE, muted: !!muted }));
    const patch = (changes: Partial<PlayerState>) => setState((s) => ({ ...s, ...changes }));

    // posição antes do seek (o `seeking` já chega com a posição nova)
    const lastTime = useRef(0);
    const seekFrom = useRef(0);
    const buffering = useRef(false);
    const lastBuffered = useRef(0);
    const fullscreen = useRef(false);

    /** Ações sobre o elemento (usadas pelos controles e pelo `ref`). */
    const actions = useMemo<PlayerActions>(() => {
      const run = (fn: (v: HTMLVideoElement) => void) => video.current && fn(video.current);
      return {
        togglePlay: () => run(togglePlayback),
        seekTo: (seconds) => run((v) => seek(v, seconds)),
        skip: (seconds) => run((v) => seek(v, v.currentTime + seconds)),
        setVolume: (value) => run((v) => changeVolume(v, value)),
        toggleMute: () => run((v) => void (v.muted = !v.muted)),
        setRate: (value) => run((v) => void (v.playbackRate = value)),
        toggleFullscreen: () => setFullscreen(!fullscreen.current, root.current, video.current),
        togglePictureInPicture: () => togglePictureInPicture(video.current),
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        play: () => video.current && playSafely(video.current),
        pause: () => video.current?.pause(),
        seekTo: actions.seekTo,
        setFullscreen: (on) => setFullscreen(on, root.current, video.current),
      }),
      [actions],
    );

    // `playbackRate` e `volume` não são atributos HTML: precisam ser aplicados no elemento.
    useEffect(() => {
      if (video.current && rate !== undefined) video.current.playbackRate = rate;
    }, [rate, src]);
    useEffect(() => {
      if (video.current && volume !== undefined) video.current.volume = volume;
    }, [volume, src]);

    // Tela cheia não tem prop no React: escuta no documento e no próprio vídeo (iPhone).
    const fullscreenHandler = useLatest(onFullscreenChange);
    useEffect(
      () =>
        watchFullscreen(root.current!, video.current!, (on) => {
          if (on === fullscreen.current) return;
          fullscreen.current = on;
          patch({ fullscreen: on });
          fullscreenHandler.current?.(on);
        }),
      [],
    );

    // PiP: só dá para saber se o navegador suporta depois de montar (não existe no SSR).
    const pipHandler = useLatest(onPictureInPictureChange);
    useEffect(() => {
      const v = video.current!;
      patch({ pipSupported: isPictureInPictureSupported(v) });
      return watchPictureInPicture(v, (active) => {
        patch({ pip: active });
        pipHandler.current?.(active);
      });
    }, []);

    const setBuffering = (value: boolean) => {
      if (buffering.current === value) return;
      buffering.current = value;
      patch({ buffering: value });
      onBuffering?.(value);
    };

    /** Eventos do `<video>` → estado dos controles + contrato do isoform. */
    const events: React.VideoHTMLAttributes<HTMLVideoElement> = {
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
        const v = video.current!;
        if (!v.seeking) lastTime.current = v.currentTime;
        patch({ current: v.currentTime, duration: finite(v.duration) });
        onTimeUpdate?.({ currentTime: v.currentTime, duration: finite(v.duration) });
      },
      onDurationChange: () => patch({ duration: finite(video.current?.duration) }),
      onLoadedMetadata: () => {
        const v = video.current!;
        patch(readElement(v));
        onLoad?.({ duration: finite(v.duration), width: v.videoWidth, height: v.videoHeight });
      },
      onError: () => onError?.(video.current?.error?.message || 'Falha ao carregar a mídia.'),
      onSeeking: () => {
        seekFrom.current = lastTime.current;
        patch({ current: video.current?.currentTime ?? 0 });
      },
      onSeeked: () => {
        const to = video.current?.currentTime ?? 0;
        lastTime.current = to;
        onSeek?.({ from: seekFrom.current, to });
      },
      onWaiting: () => setBuffering(true),
      onPlaying: () => setBuffering(false),
      onCanPlay: () => setBuffering(false),
      onProgress: () => {
        const end = bufferedEnd(video.current!);
        patch({ buffered: end });
        if (Math.abs(end - lastBuffered.current) < BUFFER_STEP) return;
        lastBuffered.current = end;
        onBufferedChange?.(end);
      },
      onVolumeChange: () => {
        const { volume: value, muted: isMuted } = video.current!;
        patch({ volume: value, muted: isMuted });
        onVolumeChange?.({ volume: value, muted: isMuted });
      },
      onRateChange: () => {
        const value = video.current!.playbackRate;
        patch({ rate: value });
        onRateChange?.(value);
      },
    };

    return (
      <div
        {...rest}
        ref={root}
        className={classNames(className, 'ov')}
        style={style}
        data-fullscreen={state.fullscreen || undefined}
      >
        <video
          ref={video}
          className="ov-media"
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline
          {...events}
        />
        {controls ? <VideoControls state={state} actions={actions} extra={controlsExtra} /> : null}
        {overlay}
      </div>
    );
  },
);
Video.displayName = 'Video';
