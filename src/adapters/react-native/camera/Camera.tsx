/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { isCameraFeatureEnabled, isModuleEnabled } from '../../../config';
import { warnOnce } from '../../../core/dev';
import { warnModuleDisabled } from '../../../core/modules';
import {
  CAMERA_TEXT,
  DEFAULT_CODE_TYPES,
  sameCodes,
  type CameraCode,
  type CameraCodeType,
  type CameraHandle,
  type CameraOwnProps,
  type CameraPermission,
  type CameraPhoto,
  type CameraVideo,
} from '../../../core/camera';
import { CameraRequests } from '../../../core/cameraRequests';

declare const require: (id: string) => any;

/** The spec is only loaded when a camera renders: importing the adapter (tests included) does not need Codegen. */
type Spec = typeof import('./native/IsoCameraViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoCameraViewNativeComponent'));

type Props = CameraOwnProps & { children?: ReactNode; style?: any; testID?: string };

/**
 * Entry point of `Camera` on mobile. With `modules.camera` off nothing is rendered
 * (and a dev warning is shown), instead of "native component not found".
 */
export const Camera = forwardRef<CameraHandle, Props>((props, ref) => {
  if (!isModuleEnabled('camera')) {
    warnModuleDisabled('camera');
    return null;
  }
  return <NativeCamera ref={ref} {...props} />;
});
Camera.displayName = 'Camera';

/** A feature prop used without its build option: warn once and leave it off. */
function feature(name: 'video' | 'codeScanner', wanted: boolean): boolean {
  if (!wanted) return false;
  if (isCameraFeatureEnabled(name)) return true;
  warnOnce(
    `camera-${name}-off`,
    `ISO011: Camera: "${name}" is off. Turn it on with "camera": { "enabled": true, "${name}": true } in isoform.config.json (and rebuild the native app).`,
  );
  return false;
}

/**
 * The camera: the native preview fills the box, the children are drawn over it
 * (shutter, switches…), and a notice with a button replaces the preview while the
 * camera is not allowed.
 */
const NativeCamera = forwardRef<CameraHandle, Props>(
  (
    {
      facing = 'back',
      active = true,
      flash = 'off',
      torch = false,
      zoom = 1,
      onZoomChange,
      zoomGesture = true,
      focusGesture = true,
      video = false,
      audio = true,
      onCodeScanned,
      codeTypes = DEFAULT_CODE_TYPES,
      onReady,
      onError,
      onPermissionChange,
      permissionMessage = CAMERA_TEXT.message,
      permissionButtonLabel,
      style,
      testID,
      children,
    },
    ref,
  ) => {
    const { default: NativeView, Commands } = nativeSpec();
    const view = useRef<any>(null);
    const photos = useRef(new CameraRequests<CameraPhoto>()).current;
    const starts = useRef(new CameraRequests<void>()).current;
    const stops = useRef(new CameraRequests<CameraVideo>()).current;
    const lastCodes = useRef<CameraCode[]>([]);
    const [permission, setPermission] = useState<CameraPermission | null>(null);
    const recording = feature('video', video);
    const scanning = feature('codeScanner', !!onCodeScanned);

    // promises still waiting when the camera goes away are rejected, not left hanging
    useEffect(
      () => () => {
        const reason = 'Camera unmounted';
        photos.cancelAll(reason);
        starts.cancelAll(reason);
        stops.cancelAll(reason);
      },
      [photos, starts, stops],
    );

    useImperativeHandle(
      ref,
      () => ({
        takePhoto: (options) => photos.start((id) => Commands.takePhoto(view.current, id, options?.flash ?? flash)),
        startRecording: () => {
          if (!recording) return Promise.reject(new Error('Camera: set the `video` prop (and camera.video in isoform.config.json) to record.'));
          return starts.start((id) => Commands.startRecording(view.current, id));
        },
        stopRecording: () => stops.start((id) => Commands.stopRecording(view.current, id)),
      }),
      [Commands, flash, photos, recording, starts, stops],
    );

    const blocked = permission?.camera === 'blocked';
    const notice = permission?.camera === 'denied' || blocked;
    const buttonLabel = permissionButtonLabel ?? (blocked ? CAMERA_TEXT.settings : CAMERA_TEXT.ask);

    return (
      <View style={[styles.box, style]} testID={testID}>
        <NativeView
          ref={view}
          style={StyleSheet.absoluteFill}
          facing={facing}
          active={active}
          flash={flash}
          torch={torch}
          zoom={zoom}
          zoomGesture={zoomGesture}
          focusGesture={focusGesture}
          video={recording}
          audio={audio}
          codeScanner={scanning}
          codeTypes={codeTypes as CameraCodeType[]}
          onCameraReady={() => onReady?.()}
          onCameraError={({ nativeEvent }) => onError?.(nativeEvent.message)}
          onCameraPermission={({ nativeEvent }) => {
            const next = nativeEvent as CameraPermission;
            setPermission(next);
            onPermissionChange?.(next);
          }}
          onCameraZoom={({ nativeEvent }) => onZoomChange?.(nativeEvent.zoom)}
          onCameraCodes={({ nativeEvent }) => {
            const codes = nativeEvent.codes.map((code) => ({ value: code.value, type: code.type as CameraCodeType }));
            if (sameCodes(codes, lastCodes.current)) return;
            lastCodes.current = codes;
            onCodeScanned?.(codes);
          }}
          onCameraPhoto={({ nativeEvent: e }) => {
            photos.settle(e.requestId, e.error, { uri: e.uri, width: e.width, height: e.height });
          }}
          onCameraRecordStart={({ nativeEvent: e }) => {
            starts.settle(e.requestId, e.error, undefined);
          }}
          onCameraRecordEnd={({ nativeEvent: e }) => {
            const settled = stops.settle(e.requestId, e.error, { uri: e.uri, duration: e.duration });
            // a recording that ended by itself (error, storage full…) is reported here
            if (!settled && e.error) onError?.(e.error);
          }}
        />
        {children}
        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.message}>{permissionMessage}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => (blocked ? Linking.openSettings() : Commands.requestPermission(view.current))}
            >
              <Text style={styles.buttonLabel}>{buttonLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  },
);
NativeCamera.displayName = 'NativeCamera';

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#000' },
  notice: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#000',
  },
  message: { color: '#fff', fontSize: 16, textAlign: 'center' },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#fff' },
  buttonLabel: { color: '#000', fontSize: 15, fontWeight: '600' },
});
