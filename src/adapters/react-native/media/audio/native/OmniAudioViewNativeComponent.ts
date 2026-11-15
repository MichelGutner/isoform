/**
 * Spec of the native audio component (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props, events and commands) used by:
 *  · iOS:     ios/audio/OmniAudioView.mm + ios/audio/OmniAudioPlayer.swift (AVPlayer + UIKit)
 *  · Android: android/src/audio/.../OmniAudioViewManager.kt + OmniAudioView.kt (Media3 + Compose)
 *
 * Codegen rules: the file name ends in `NativeComponent.ts`, types come from
 * `CodegenTypes`, and the `export default` calls `codegenNativeComponent`.
 */
import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type TimeEvent = Readonly<{ currentTime: CodegenTypes.Double; duration: CodegenTypes.Double }>;
type LoadEvent = Readonly<{ duration: CodegenTypes.Double }>;
type ErrorEvent = Readonly<{ message: string }>;
type SeekEvent = Readonly<{ from: CodegenTypes.Double; to: CodegenTypes.Double }>;
type BufferingEvent = Readonly<{ buffering: boolean }>;
type BufferedEvent = Readonly<{ buffered: CodegenTypes.Double }>;
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
  title?: string;
  artist?: string;
  artwork?: string;

  // `onPlayer*` prefix so they do not clash with events React Native already defines (e.g. `onError`).
  onPlayerPlay?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerPause?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerEnd?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPlayerTime?: CodegenTypes.DirectEventHandler<TimeEvent>;
  onPlayerLoad?: CodegenTypes.DirectEventHandler<LoadEvent>;
  onPlayerError?: CodegenTypes.DirectEventHandler<ErrorEvent>;
  onPlayerSeek?: CodegenTypes.DirectEventHandler<SeekEvent>;
  onPlayerBuffering?: CodegenTypes.DirectEventHandler<BufferingEvent>;
  onPlayerBuffered?: CodegenTypes.DirectEventHandler<BufferedEvent>;
  onPlayerVolume?: CodegenTypes.DirectEventHandler<VolumeEvent>;
  onPlayerRate?: CodegenTypes.DirectEventHandler<RateEvent>;
}

type ComponentType = HostComponent<NativeProps>;

// Codegen requires `React.ElementRef<...>` written inline as the first argument (no alias).
interface NativeCommands {
  play: (viewRef: React.ElementRef<ComponentType>) => void;
  pause: (viewRef: React.ElementRef<ComponentType>) => void;
  seekTo: (viewRef: React.ElementRef<ComponentType>, seconds: CodegenTypes.Double) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['play', 'pause', 'seekTo'],
});

export default codegenNativeComponent<NativeProps>('OmniAudioView') as ComponentType;
