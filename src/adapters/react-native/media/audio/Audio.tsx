/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import type { WithoutPlaylist } from '../../../../core/playlist';
import { StyleSheet, View } from 'react-native';
import { isModuleEnabled } from '../../../../config';
import type { AudioHandle, AudioOwnProps } from '../../../../core/media';
import { warnModuleDisabled } from '../../../../core/modules';

declare const require: (id: string) => any;

/**
 * The spec is only loaded when an `Audio` renders: importing the adapter
 * (tests included) does not need the Codegen runtime.
 */
type Spec = typeof import('./native/OmniAudioViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/OmniAudioViewNativeComponent'));

type Props = Partial<AudioOwnProps> & { style?: any; testID?: string; /** Drawn over the player (the playlist button and panel). */ overlay?: React.ReactNode; /** List position for the playlist button in the native controls (set by the playlist wrapper). */ playlist?: { index: number; count: number; onPress(): void } };

/**
 * Entry point of `Audio` on mobile. With `modules.audio` off not even the native
 * spec is loaded: an empty box with the same style stays (and a dev warning),
 * instead of the "native component not found" error.
 */
export const Audio = forwardRef<WithoutPlaylist<AudioHandle>, Props>((props, ref) => {
  if (!isModuleEnabled('audio')) {
    warnModuleDisabled('audio');
    return <View style={props.style} testID={props.testID} />;
  }
  return <AudioPlayer ref={ref} {...props} />;
});
Audio.displayName = 'Audio';

/**
 * The player: the lib's native component (AVPlayer + UIKit on iOS, Media3 +
 * Compose on Android). It only translates the omnistyle contract to the native
 * props and events. The card draws its own background, so the style just sizes it.
 */
const AudioPlayer = forwardRef<WithoutPlaylist<AudioHandle>, Props>(
  (
    {
      src,
      controls = true,
      title,
      artist,
      artwork,
      autoPlay = false,
      loop = false,
      muted = false,
      rate = 1,
      volume = 1,
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
      style,
      testID,
      overlay,
      playlist,
    },
    ref,
  ) => {
    const { default: NativeAudio, Commands } = nativeSpec();
    const native = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => native.current && Commands.play(native.current),
        pause: () => native.current && Commands.pause(native.current),
        seekTo: (seconds) => native.current && Commands.seekTo(native.current, seconds),
      }),
      [Commands],
    );

    return (
      <View style={[styles.container, style]} testID={testID}>
        <NativeAudio
          ref={native}
          playlistIndex={playlist?.index ?? -1}
          playlistCount={playlist?.count ?? 0}
          onPlayerPlaylist={() => playlist?.onPress()}
          style={StyleSheet.absoluteFill}
          src={src}
          controls={controls}
          title={title}
          artist={artist}
          artwork={artwork}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          rate={rate}
          volume={volume}
          onPlayerPlay={() => onPlay?.()}
          onPlayerPause={() => onPause?.()}
          onPlayerEnd={() => onEnded?.()}
          onPlayerTime={(e) => onTimeUpdate?.({ currentTime: e.nativeEvent.currentTime, duration: e.nativeEvent.duration })}
          onPlayerLoad={({ nativeEvent: { duration } }) => onLoad?.({ duration, width: 0, height: 0 })}
          onPlayerError={(e) => onError?.(e.nativeEvent.message)}
          onPlayerSeek={(e) => onSeek?.({ from: e.nativeEvent.from, to: e.nativeEvent.to })}
          onPlayerBuffering={(e) => onBuffering?.(e.nativeEvent.buffering)}
          onPlayerBuffered={(e) => onBufferedChange?.(e.nativeEvent.buffered)}
          onPlayerVolume={(e) => onVolumeChange?.({ volume: e.nativeEvent.volume, muted: e.nativeEvent.muted })}
          onPlayerRate={(e) => onRateChange?.(e.nativeEvent.rate)}
        />
        {overlay}
      </View>
    );
  },
);
AudioPlayer.displayName = 'AudioPlayer';

/** Default card height (padding + title row + seek bar with times + play row), so an unsized `Audio` is neither collapsed nor clipped. */
const styles = StyleSheet.create({ container: { minHeight: 180, overflow: 'hidden' } });
