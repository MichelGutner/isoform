/**
 * Spec do componente nativo de vídeo (New Architecture / Fabric).
 *
 * O Codegen do React Native lê ESTE arquivo no build do app e gera as
 * interfaces nativas (props, eventos e comandos) usadas por:
 *  · iOS:     ios/IsoVideoView.mm + ios/IsoVideoPlayer.swift (AVPlayer)
 *  · Android: android/.../IsoVideoViewManager.kt + IsoVideoView.kt (Media3)
 *
 * Regras do Codegen: o nome do arquivo termina em `NativeComponent.ts`, os
 * tipos vêm de `CodegenTypes` e o `export default` chama `codegenNativeComponent`.
 * Tudo é importado da raiz de `react-native` (imports de `react-native/Libraries/...`
 * estão depreciados).
 */
import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type TimeEvent = Readonly<{ currentTime: CodegenTypes.Double; duration: CodegenTypes.Double }>;
type LoadEvent = Readonly<{ duration: CodegenTypes.Double; width: CodegenTypes.Double; height: CodegenTypes.Double }>;
type ErrorEvent = Readonly<{ message: string }>;
type SeekEvent = Readonly<{ from: CodegenTypes.Double; to: CodegenTypes.Double }>;
type BufferingEvent = Readonly<{ buffering: boolean }>;
type BufferedEvent = Readonly<{ buffered: CodegenTypes.Double }>;
type FullscreenEvent = Readonly<{ fullscreen: boolean }>;
type VolumeEvent = Readonly<{ volume: CodegenTypes.Double; muted: boolean }>;
type RateEvent = Readonly<{ rate: CodegenTypes.Double }>;

export interface NativeProps extends ViewProps {
  src?: string;
  controls?: CodegenTypes.WithDefault<boolean, true>;
  autoPlay?: CodegenTypes.WithDefault<boolean, false>;
  loop?: CodegenTypes.WithDefault<boolean, false>;
  muted?: CodegenTypes.WithDefault<boolean, false>;
  rate?: CodegenTypes.WithDefault<CodegenTypes.Float, 1.0>;
  volume?: CodegenTypes.WithDefault<CodegenTypes.Float, 1.0>;
  // list (`items`): the controls show a playlist button with the position
  playlistIndex?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  playlistCount?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  // the entries as JSON (`[{ title, image }]`): the fullscreen draws its own carousel with them
  playlistItems?: string;

  // Prefixo `onPlayer*` para não colidir com eventos que o RN já define (ex.: `onError`).
  onPlayerPlay?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerPause?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerEnd?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerTime?: CodegenTypes.DirectEventHandler<TimeEvent>;
  onPlayerLoad?: CodegenTypes.DirectEventHandler<LoadEvent>;
  onPlayerError?: CodegenTypes.DirectEventHandler<ErrorEvent>;
  onPlayerSeek?: CodegenTypes.DirectEventHandler<SeekEvent>;
  onPlayerBuffering?: CodegenTypes.DirectEventHandler<BufferingEvent>;
  onPlayerBuffered?: CodegenTypes.DirectEventHandler<BufferedEvent>;
  onPlayerFullscreen?: CodegenTypes.DirectEventHandler<FullscreenEvent>;
  onPlayerVolume?: CodegenTypes.DirectEventHandler<VolumeEvent>;
  onPlayerRate?: CodegenTypes.DirectEventHandler<RateEvent>;
  onPlayerPlaylist?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerPlaylistSelect?: CodegenTypes.DirectEventHandler<Readonly<{ index: CodegenTypes.Int32 }>>;
}

type ComponentType = HostComponent<NativeProps>;

// O Codegen exige `React.ElementRef<...>` escrito direto no primeiro argumento (não aceita alias).
interface NativeCommands {
  play: (viewRef: React.ElementRef<ComponentType>) => void;
  pause: (viewRef: React.ElementRef<ComponentType>) => void;
  seekTo: (viewRef: React.ElementRef<ComponentType>, seconds: CodegenTypes.Double) => void;
  setFullscreen: (viewRef: React.ElementRef<ComponentType>, fullscreen: boolean) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['play', 'pause', 'seekTo', 'setFullscreen'],
});

export default codegenNativeComponent<NativeProps>('IsoVideoView') as ComponentType;
