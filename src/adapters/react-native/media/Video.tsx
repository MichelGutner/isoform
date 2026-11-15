/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { isModuleEnabled } from '../../../config';
import type { VideoHandle, VideoOwnProps } from '../../../core/media';
import { warnModuleDisabled } from '../../../core/modules';

declare const require: (id: string) => any;

/**
 * A spec só é carregada quando um `Video` é renderizado: assim importar o
 * adaptador (inclusive em testes) não exige o runtime do Codegen.
 */
type Spec = typeof import('./native/OmniVideoViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/OmniVideoViewNativeComponent'));

type Props = Partial<VideoOwnProps> & { style?: any; testID?: string };

/**
 * Porta de entrada do `Video` no mobile. Com `modules.video` desligado, nem a
 * spec nativa é carregada: fica só um espaço vazio com o mesmo estilo (e um
 * aviso em dev), em vez do erro "componente nativo não encontrado".
 */
export const Video = forwardRef<VideoHandle, Props>((props, ref) => {
  if (!isModuleEnabled('video')) {
    warnModuleDisabled('video');
    return <View style={[styles.container, props.style]} testID={props.testID} />;
  }
  return <VideoPlayer ref={ref} {...props} />;
});
Video.displayName = 'Video';

/**
 * O player: o componente nativo da lib (AVPlayer no iOS, Media3 no Android).
 * Aqui só traduzimos o contrato do omnistyle para as props e os eventos
 * nativos, e mostramos o `poster` até o primeiro play.
 */
const VideoPlayer = forwardRef<VideoHandle, Props>(
  (
    {
      src,
      poster,
      controls = true,
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
      onFullscreenChange,
      style,
      testID,
    },
    ref,
  ) => {
    const { default: NativeVideo, Commands } = nativeSpec();
    const native = useRef<any>(null);
    const [started, setStarted] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        play: () => native.current && Commands.play(native.current),
        pause: () => native.current && Commands.pause(native.current),
        seekTo: (seconds) => native.current && Commands.seekTo(native.current, seconds),
        setFullscreen: (fullscreen) => native.current && Commands.setFullscreen(native.current, fullscreen),
      }),
      [Commands],
    );

    return (
      <View style={[styles.container, style]} testID={testID}>
        <NativeVideo
          ref={native}
          style={StyleSheet.absoluteFill}
          src={src}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          rate={rate}
          volume={volume}
          onPlayerPlay={() => {
            setStarted(true);
            onPlay?.();
          }}
          onPlayerPause={() => onPause?.()}
          onPlayerEnd={() => onEnded?.()}
          onPlayerTime={(e) => onTimeUpdate?.({ currentTime: e.nativeEvent.currentTime, duration: e.nativeEvent.duration })}
          onPlayerLoad={({ nativeEvent: { duration, width, height } }) => onLoad?.({ duration, width, height })}
          onPlayerError={(e) => onError?.(e.nativeEvent.message)}
          onPlayerSeek={(e) => onSeek?.({ from: e.nativeEvent.from, to: e.nativeEvent.to })}
          onPlayerBuffering={(e) => onBuffering?.(e.nativeEvent.buffering)}
          onPlayerBuffered={(e) => onBufferedChange?.(e.nativeEvent.buffered)}
          onPlayerVolume={(e) => onVolumeChange?.({ volume: e.nativeEvent.volume, muted: e.nativeEvent.muted })}
          onPlayerRate={(e) => onRateChange?.(e.nativeEvent.rate)}
          onPlayerFullscreen={(e) => onFullscreenChange?.(e.nativeEvent.fullscreen)}
        />
        {poster && !started ? (
          // `pointerEvents="none"`: o toque passa direto para os controles nativos
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ) : null}
      </View>
    );
  },
);
VideoPlayer.displayName = 'VideoPlayer';

const styles = StyleSheet.create({ container: { backgroundColor: '#000', overflow: 'hidden' } });
