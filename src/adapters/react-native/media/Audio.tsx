/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AudioOwnProps, MediaHandle } from '../../../core/media';
import { MissingModule } from './MissingModule';

declare const require: (id: string) => any;

/** `require` dentro de `try/catch`: dependência OPCIONAL para o Metro (veja `Video.tsx`). */
let cached: any;
function expoAudio(): any {
  if (cached === undefined) {
    try {
      cached = require('expo-audio');
    } catch {
      cached = null;
    }
  }
  return cached;
}

type Props = Partial<AudioOwnProps> & { style?: any; testID?: string };

const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * O `expo-audio` não tem interface: com `controls` (padrão) desenhamos uma
 * barra mínima (play/pause e tempo), como o `<audio controls>` da web.
 * `onError` não é chamado no mobile: o `expo-audio` não expõe esse evento.
 */
const Player = forwardRef<MediaHandle, Props & { lib: any }>(
  ({ lib, src, controls = true, autoPlay, loop, muted, rate, volume, style, testID, ...callbacks }, ref) => {
    const player = lib.useAudioPlayer(src ?? null);
    const status = lib.useAudioPlayerStatus(player);

    const latest = useRef(callbacks);
    latest.current = callbacks;

    useImperativeHandle(
      ref,
      () => ({
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (seconds) => void player.seekTo(seconds),
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
      if (volume !== undefined) player.volume = volume;
    }, [player, volume]);
    useEffect(() => {
      if (rate !== undefined) player.setPlaybackRate(rate);
    }, [player, rate]);

    const autoPlayed = useRef(false);
    useEffect(() => {
      if (!status.isLoaded) return;
      latest.current.onLoad?.({ duration: status.duration });
      if (autoPlay && !autoPlayed.current) {
        autoPlayed.current = true;
        player.play();
      }
    }, [status.isLoaded]);

    const wasPlaying = useRef(false);
    useEffect(() => {
      if (status.playing === wasPlaying.current) return;
      wasPlaying.current = status.playing;
      if (status.playing) latest.current.onPlay?.();
      else latest.current.onPause?.();
    }, [status.playing]);

    useEffect(() => {
      if (status.didJustFinish) latest.current.onEnded?.();
    }, [status.didJustFinish]);

    useEffect(() => {
      latest.current.onTimeUpdate?.({ currentTime: status.currentTime, duration: status.duration });
    }, [status.currentTime]);

    if (!controls) return null;
    return (
      <View style={[styles.bar, style]} testID={testID}>
        <Pressable
          onPress={() => (status.playing ? player.pause() : player.play())}
          accessibilityRole="button"
          style={styles.button}
        >
          <Text style={styles.icon}>{status.playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Text style={styles.time}>
          {clock(status.currentTime)} / {clock(status.duration)}
        </Text>
      </View>
    );
  },
);
Player.displayName = 'AudioPlayer';

export const Audio = forwardRef<MediaHandle, Props>((props, ref) => {
  const lib = expoAudio();
  if (!lib) return <MissingModule primitive="Audio" pkg="expo-audio" style={props.style} />;
  return <Player ref={ref} lib={lib} {...props} />;
});
Audio.displayName = 'Audio';

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, backgroundColor: '#f1f3f4', borderRadius: 24 },
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0e0e0' },
  icon: { fontSize: 12 },
  time: { fontSize: 12, color: '#444' },
});
