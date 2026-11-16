/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { isCameraFeatureEnabled } from '../../../config';
import { warnOnce } from '../../../core/dev';
import {
  CAMERA_TEXT,
  DEFAULT_CODE_TYPES,
  clampZoom,
  sameCodes,
  type CameraCode,
  type CameraHandle,
  type CameraOwnProps,
  type CameraPermission,
  type CameraPermissionStatus,
} from '../../../core/camera';
import {
  BARCODE_FORMATS,
  DIGITAL_ZOOM_MAX,
  permissionFromError,
  recorderMimeType,
  streamConstraints,
  toCodes,
  trackHasTorch,
  trackZoomRange,
} from './webCamera';

/** Props of the web camera: its own, plus what the adapter adds (`className`, `data-*`…). */
export type CameraElementProps = CameraOwnProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof CameraOwnProps | 'children'> & {
    children?: ReactNode;
  };

/** How often the code scanner looks at the preview (ms). */
const SCAN_INTERVAL = 250;

/** A feature prop used without its config option: warn once and leave it off. */
function feature(name: 'video' | 'codeScanner', wanted: boolean): boolean {
  if (!wanted) return false;
  if (isCameraFeatureEnabled(name)) return true;
  warnOnce(`camera-${name}-off`, `Camera: "${name}" está desligado. Ligue com "camera": { "enabled": true, "${name}": true }.`);
  return false;
}

const stopStream = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

/** Keeps the latest value in a ref, for callbacks read inside long-lived effects. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * The web camera: `getUserMedia` in a `<video>` that covers the box, the children
 * over it, photos from the video frame (or `ImageCapture` with flash), `MediaRecorder`
 * for video and `BarcodeDetector` for codes.
 */
export const Camera = forwardRef<CameraHandle, CameraElementProps>(
  (
    {
      facing = 'back',
      active = true,
      flash = 'off',
      torch = false,
      zoom = 1,
      onZoomChange,
      zoomGesture = true,
      // the web has no tap-to-focus API worth relying on
      focusGesture: _focusGesture,
      video = false,
      audio = true,
      onCodeScanned,
      codeTypes = DEFAULT_CODE_TYPES,
      onReady,
      onError,
      onPermissionChange,
      permissionMessage = CAMERA_TEXT.message,
      permissionButtonLabel = CAMERA_TEXT.ask,
      children,
      style,
      ...rest
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [permission, setPermission] = useState<CameraPermission | null>(null);
    const [attempt, setAttempt] = useState(0);
    const recorder = useRef<{ instance: MediaRecorder; chunks: Blob[]; startedAt: number } | null>(null);
    const recording = feature('video', video);
    const scanning = feature('codeScanner', !!onCodeScanned);
    const callbacks = useLatest({ onReady, onError, onPermissionChange, onCodeScanned, onZoomChange });

    const track = stream?.getVideoTracks()[0];
    const nativeZoom = trackZoomRange(track);
    const range = nativeZoom ?? { min: 1, max: DIGITAL_ZOOM_MAX };
    const zoomFactor = clampZoom(zoom, range.min, range.max);
    const digitalZoom = nativeZoom ? 1 : zoomFactor;

    // the stream: (re)opened when the camera, the microphone or a retry changes
    useEffect(() => {
      if (!active) return undefined;
      const media = (globalThis as any).navigator?.mediaDevices as MediaDevices | undefined;
      if (!media?.getUserMedia) {
        callbacks.current.onError?.('Camera: this browser has no camera access (getUserMedia needs https).');
        return undefined;
      }
      let cancelled = false;
      let opened: MediaStream | null = null;
      const report = (camera: CameraPermissionStatus, microphone: CameraPermissionStatus) => {
        const next = { camera, microphone };
        setPermission(next);
        callbacks.current.onPermissionChange?.(next);
      };
      const open = async () => {
        const withAudio = recording && audio;
        try {
          return { stream: await media.getUserMedia(streamConstraints(facing, withAudio)), microphone: withAudio ? 'granted' : 'undetermined' } as const;
        } catch (error) {
          // microphone refused: keep the camera, record without sound
          if (!withAudio || !permissionFromError(error)) throw error;
          return { stream: await media.getUserMedia(streamConstraints(facing, false)), microphone: 'denied' } as const;
        }
      };
      open()
        .then((result) => {
          if (cancelled) return stopStream(result.stream);
          opened = result.stream;
          setStream(result.stream);
          report('granted', result.microphone);
        })
        .catch((error) => {
          if (cancelled) return;
          const status = permissionFromError(error);
          if (status) report(status, 'undetermined');
          else callbacks.current.onError?.(error?.message ?? String(error));
        });
      return () => {
        cancelled = true;
        if (opened) stopStream(opened);
        setStream(null);
      };
    }, [active, facing, recording, audio, attempt, callbacks]);

    useEffect(() => {
      const element = videoRef.current;
      if (!element) return;
      element.srcObject = stream;
      if (stream) element.play().catch(() => undefined);
    }, [stream]);

    useEffect(() => {
      if (!track || !trackHasTorch(track)) return;
      track.applyConstraints({ advanced: [{ torch } as any] }).catch(() => undefined);
    }, [track, torch]);

    useEffect(() => {
      if (!track || !nativeZoom) return;
      track.applyConstraints({ advanced: [{ zoom: zoomFactor } as any] }).catch(() => undefined);
    }, [track, nativeZoom, zoomFactor]);

    // code scanner: a few looks per second, reported only when the codes change
    const typesKey = codeTypes.join(',');
    useEffect(() => {
      if (!scanning || !stream) return undefined;
      const Detector = (globalThis as any).BarcodeDetector;
      if (!Detector) {
        warnOnce('camera-barcode-detector', 'Camera: este navegador não tem BarcodeDetector (só Chromium); onCodeScanned não será chamado.');
        return undefined;
      }
      const detector = new Detector({ formats: typesKey.split(',').map((type) => BARCODE_FORMATS[type as keyof typeof BARCODE_FORMATS]) });
      let last: CameraCode[] = [];
      let busy = false;
      const timer = setInterval(() => {
        const element = videoRef.current;
        if (busy || !element || element.readyState < 2) return;
        busy = true;
        detector
          .detect(element)
          .then((found: Array<{ rawValue: string; format: string }>) => {
            const codes = toCodes(found);
            if (sameCodes(codes, last)) return;
            last = codes;
            callbacks.current.onCodeScanned?.(codes);
          })
          .catch(() => undefined)
          .finally(() => {
            busy = false;
          });
      }, SCAN_INTERVAL);
      return () => clearInterval(timer);
    }, [scanning, stream, typesKey, callbacks]);

    // a recording still running when the camera goes away is stopped
    useEffect(
      () => () => {
        if (recorder.current?.instance.state === 'recording') recorder.current.instance.stop();
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        async takePhoto(options) {
          const element = videoRef.current;
          if (!stream || !track || !element || element.readyState < 2) throw new Error('Camera is not ready');
          const light = options?.flash ?? flash;
          const ImageCapture = (globalThis as any).ImageCapture;
          if (ImageCapture && light !== 'off') {
            try {
              const blob: Blob = await new ImageCapture(track).takePhoto({ fillLightMode: light });
              const bitmap = await createImageBitmap(blob);
              return { uri: URL.createObjectURL(blob), width: bitmap.width, height: bitmap.height };
            } catch {
              // no flash on this camera: take the frame below
            }
          }
          // the current frame, cropped like the digital zoom shows it
          const width = Math.round(element.videoWidth / digitalZoom);
          const height = Math.round(element.videoHeight / digitalZoom);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas
            .getContext('2d')!
            .drawImage(element, (element.videoWidth - width) / 2, (element.videoHeight - height) / 2, width, height, 0, 0, width, height);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          if (!blob) throw new Error('Camera: could not encode the photo');
          return { uri: URL.createObjectURL(blob), width, height };
        },

        startRecording() {
          if (!recording) return Promise.reject(new Error('Camera: set the `video` prop (and camera.video in the config) to record.'));
          if (!stream) return Promise.reject(new Error('Camera is not ready'));
          if (recorder.current?.instance.state === 'recording') return Promise.reject(new Error('Camera is already recording'));
          const mimeType = recorderMimeType();
          const instance = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          const chunks: Blob[] = [];
          instance.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          return new Promise<void>((resolve, reject) => {
            instance.onstart = () => {
              recorder.current = { instance, chunks, startedAt: performance.now() };
              resolve();
            };
            instance.onerror = () => reject(new Error('Camera: recording failed'));
            instance.start(1000);
          });
        },

        stopRecording() {
          const current = recorder.current;
          if (!current || current.instance.state !== 'recording') return Promise.reject(new Error('Camera is not recording'));
          return new Promise((resolve) => {
            current.instance.onstop = () => {
              recorder.current = null;
              const blob = new Blob(current.chunks, { type: current.instance.mimeType || 'video/webm' });
              resolve({ uri: URL.createObjectURL(blob), duration: (performance.now() - current.startedAt) / 1000 });
            };
            current.instance.stop();
          });
        },
      }),
      [digitalZoom, flash, recording, stream, track],
    );

    // pinch to zoom: two pointers on the preview scale the zoom from where they started
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const pinch = useRef<{ distance: number; zoom: number } | null>(null);
    const distance = () => {
      const [a, b] = [...pointers.current.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const pinchHandlers = zoomGesture
      ? {
          onPointerDown: (event: React.PointerEvent) => {
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.current.size === 2) pinch.current = { distance: distance(), zoom: zoomFactor };
          },
          onPointerMove: (event: React.PointerEvent) => {
            if (!pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (!pinch.current || pointers.current.size !== 2) return;
            const next = clampZoom((pinch.current.zoom * distance()) / pinch.current.distance, range.min, range.max);
            callbacks.current.onZoomChange?.(Math.round(next * 100) / 100);
          },
          onPointerUp: (event: React.PointerEvent) => {
            pointers.current.delete(event.pointerId);
            pinch.current = null;
          },
          onPointerCancel: (event: React.PointerEvent) => {
            pointers.current.delete(event.pointerId);
            pinch.current = null;
          },
        }
      : {};

    const mirror = facing === 'front' ? 'scaleX(-1)' : '';
    const scale = digitalZoom !== 1 ? `scale(${digitalZoom})` : '';
    const notice = permission?.camera === 'denied' || permission?.camera === 'blocked';

    return (
      <div {...rest} style={{ ...style, touchAction: zoomGesture ? 'none' : undefined }} {...pinchHandlers}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedData={() => callbacks.current.onReady?.()}
          style={{ ...VIDEO_STYLE, transform: `${mirror} ${scale}`.trim() || undefined }}
        />
        {children}
        {notice ? (
          <div style={NOTICE_STYLE} role="alert">
            <span style={MESSAGE_STYLE}>{permissionMessage}</span>
            <button type="button" style={BUTTON_STYLE} onClick={() => setAttempt((n) => n + 1)}>
              {permissionButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  },
);
Camera.displayName = 'Camera';

const VIDEO_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const NOTICE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  background: '#000',
  textAlign: 'center',
};

const MESSAGE_STYLE: CSSProperties = { color: '#fff', fontSize: 16 };

const BUTTON_STYLE: CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: '10px 18px',
  background: '#fff',
  color: '#000',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
