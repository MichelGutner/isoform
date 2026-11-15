/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { MediaHandle, PlaybackProps } from '../../../core/media';

/**
 * `Video` e `Audio` na web: o elemento nativo do navegador, com os eventos
 * traduzidos para o contrato do omnistyle (`onTimeUpdate({ currentTime, duration })`…).
 */

interface MediaElementProps extends Partial<PlaybackProps> {
  poster?: string;
  controls?: boolean;
  [rest: string]: any;
}

function createMedia(tag: 'video' | 'audio', name: string) {
  const Media = forwardRef<MediaHandle, MediaElementProps>(
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
        ...rest
      },
      ref,
    ) => {
      const element = useRef<HTMLMediaElement>(null);

      useImperativeHandle(
        ref,
        () => ({
          play: () => void element.current?.play().catch(() => undefined),
          pause: () => element.current?.pause(),
          seekTo: (seconds) => {
            if (element.current) element.current.currentTime = seconds;
          },
        }),
        [],
      );

      // `playbackRate` e `volume` não são atributos HTML: precisam ser aplicados no elemento.
      useEffect(() => {
        if (element.current && rate !== undefined) element.current.playbackRate = rate;
      }, [rate, src]);
      useEffect(() => {
        if (element.current && volume !== undefined) element.current.volume = volume;
      }, [volume, src]);

      const duration = () => {
        const value = element.current?.duration;
        return value !== undefined && Number.isFinite(value) ? value : 0;
      };

      return createElement(tag, {
        ...rest,
        ref: element,
        src,
        poster: tag === 'video' ? poster : undefined,
        controls,
        autoPlay,
        loop,
        muted,
        playsInline: tag === 'video' ? true : undefined,
        onPlay: () => onPlay?.(),
        onPause: () => onPause?.(),
        onEnded: () => onEnded?.(),
        onTimeUpdate: () => onTimeUpdate?.({ currentTime: element.current?.currentTime ?? 0, duration: duration() }),
        onLoadedMetadata: () => onLoad?.({ duration: duration() }),
        onError: () => onError?.(element.current?.error?.message || 'Falha ao carregar a mídia.'),
      });
    },
  );
  Media.displayName = name;
  return Media;
}

export const Video = createMedia('video', 'Video');
export const Audio = createMedia('audio', 'Audio');
