/**
 * Spec of the native camera (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props, events and commands) used by:
 *  · iOS:     ios/camera/OmniCameraView.mm + ios/camera/OmniCamera.swift (AVFoundation)
 *  · Android: android/src/camera/.../OmniCameraViewManager.kt + OmniCameraView.kt (CameraX + Compose)
 *
 * Captures answer through events carrying the `requestId` of the command, which
 * the JS side turns back into promises.
 */
import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type ErrorEvent = Readonly<{ message: string }>;
type PermissionEvent = Readonly<{ camera: string; microphone: string }>;
type ZoomEvent = Readonly<{ zoom: CodegenTypes.Double }>;
// Codegen reads event arrays only in the `T[]` form
type CodesEvent = Readonly<{ codes: { value: string; type: string }[] }>;
type PhotoEvent = Readonly<{
  requestId: CodegenTypes.Int32;
  uri: string;
  width: CodegenTypes.Int32;
  height: CodegenTypes.Int32;
  error: string;
}>;
type RecordStartEvent = Readonly<{ requestId: CodegenTypes.Int32; error: string }>;
type RecordEndEvent = Readonly<{
  requestId: CodegenTypes.Int32;
  uri: string;
  duration: CodegenTypes.Double;
  error: string;
}>;

export interface NativeProps extends ViewProps {
  facing?: CodegenTypes.WithDefault<'back' | 'front', 'back'>;
  active?: CodegenTypes.WithDefault<boolean, true>;
  flash?: CodegenTypes.WithDefault<'off' | 'on' | 'auto', 'off'>;
  torch?: CodegenTypes.WithDefault<boolean, false>;
  zoom?: CodegenTypes.WithDefault<CodegenTypes.Float, 1.0>;
  zoomGesture?: CodegenTypes.WithDefault<boolean, true>;
  focusGesture?: CodegenTypes.WithDefault<boolean, true>;
  /** Binds the video output and asks for the microphone. */
  video?: CodegenTypes.WithDefault<boolean, false>;
  /** Records sound with the video. */
  audio?: CodegenTypes.WithDefault<boolean, true>;
  /** Runs the code scanner. */
  codeScanner?: CodegenTypes.WithDefault<boolean, false>;
  /** Code kinds (`qr`, `ean-13`…). */
  codeTypes?: ReadonlyArray<string>;

  // `onCamera*` prefix so they do not clash with events React Native already defines.
  onCameraReady?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onCameraError?: CodegenTypes.DirectEventHandler<ErrorEvent>;
  onCameraPermission?: CodegenTypes.DirectEventHandler<PermissionEvent>;
  onCameraZoom?: CodegenTypes.DirectEventHandler<ZoomEvent>;
  onCameraCodes?: CodegenTypes.DirectEventHandler<CodesEvent>;
  onCameraPhoto?: CodegenTypes.DirectEventHandler<PhotoEvent>;
  onCameraRecordStart?: CodegenTypes.DirectEventHandler<RecordStartEvent>;
  onCameraRecordEnd?: CodegenTypes.DirectEventHandler<RecordEndEvent>;
}

type ComponentType = HostComponent<NativeProps>;

// Codegen requires `React.ElementRef<...>` written inline as the first argument (no alias).
interface NativeCommands {
  takePhoto: (viewRef: React.ElementRef<ComponentType>, requestId: CodegenTypes.Int32, flash: string) => void;
  startRecording: (viewRef: React.ElementRef<ComponentType>, requestId: CodegenTypes.Int32) => void;
  stopRecording: (viewRef: React.ElementRef<ComponentType>, requestId: CodegenTypes.Int32) => void;
  requestPermission: (viewRef: React.ElementRef<ComponentType>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['takePhoto', 'startRecording', 'stopRecording', 'requestPermission'],
});

export default codegenNativeComponent<NativeProps>('OmniCameraView') as ComponentType;
