/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { MediaHandle, VideoOwnProps } from '../../../core/media';
import { MissingModule } from './MissingModule';

declare const require: (id: string) => any;

/**
 * O `require` fica dentro de um `try/catch` de propósito: é assim que o Metro
 * entende que a dependência é OPCIONAL (sem isso, o app nem compilaria sem ela).
 */
let cached: any;
function expoVideo(): any {
  if (cached === undefined) {
    try {
      cached = require('expo-video');
    } catch {
      cached = null;
    }
  }
  return cached;
}

type Props = Partial<VideoOwnProps> & { style?: any; testID?: string };

/** Parte que usa os hooks do `expo-video` (só é montada quando a lib existe). */
const Player = forwardRef<MediaHandle, Props & { lib: any }>(
  ({ lib, src, poster, controls = true, autoPlay, loop, muted, rate, volume, style, testID, ...callbacks }, ref) => {
    const player = lib.useVideoPlayer(src ?? null, (p: any) => {
      p.timeUpdateEventInterval = 0.25;
      if (autoPlay) p.play();
    });
    const [started, setStarted] = useState(false);

    // sempre o callback mais recente, sem reassinar os eventos a cada render
    const latest = useRef(callbacks);
    latest.current = callbacks;

    useImperativeHandle(
      ref,
      () => ({
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (seconds) => {
          player.currentTime = seconds;
        },
      }),
      [player],
    );

    useEffect(() => {
      player.loop = !!loop;
    }, [player, loop]);
    useEffect(() => {
      player.muted = !!muted;
    }, [player, muted]);
    useEffect(() => {
      if (rate !== undefined) player.playbackRate = rate;
    }, [player, rate]);
    useEffect(() => {
      if (volume !== undefined) player.volume = volume;
    }, [player, volume]);

    useEffect(() => {
      const subscriptions = [
        player.addListener('playingChange', ({ isPlaying }: { isPlaying: boolean }) => {
          if (isPlaying) {
            setStarted(true);
            latest.current.onPlay?.();
          } else {
            latest.current.onPause?.();
          }
        }),
        player.addListener('playToEnd', () => latest.current.onEnded?.()),
        player.addListener('timeUpdate', ({ currentTime }: { currentTime: number }) =>
          latest.current.onTimeUpdate?.({ currentTime, duration: player.duration || 0 }),
        ),
        player.addListener('statusChange', ({ status, error }: { status: string; error?: { message?: string } }) => {
          if (status === 'readyToPlay') latest.current.onLoad?.({ duration: player.duration || 0 });
          if (status === 'error') latest.current.onError?.(error?.message ?? 'Falha ao carregar o vídeo.');
        }),
      ];
      return () => subscriptions.forEach((s: any) => s.remove());
    }, [player]);

    return (
      <View style={[styles.container, style]} testID={testID}>
        <lib.VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={controls} contentFit="contain" />
        {poster && !started ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ) : null}
      </View>
    );
  },
);
Player.displayName = 'VideoPlayer';

export const Video = forwardRef<MediaHandle, Props>((props, ref) => {
  const lib = expoVideo();
  if (!lib) return <MissingModule primitive="Video" pkg="expo-video" style={props.style} />;
  return <Player ref={ref} lib={lib} {...props} />;
});
Video.displayName = 'Video';

const styles = StyleSheet.create({ container: { backgroundColor: '#000', overflow: 'hidden' } });
