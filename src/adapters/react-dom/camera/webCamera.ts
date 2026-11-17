/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CameraCode, CameraCodeType, CameraFacing, CameraPermissionStatus } from '../../../core/camera';

/** Code kind → `BarcodeDetector` format. */
export const BARCODE_FORMATS: Record<CameraCodeType, string> = {
  qr: 'qr_code',
  aztec: 'aztec',
  'data-matrix': 'data_matrix',
  pdf417: 'pdf417',
  'ean-13': 'ean_13',
  'ean-8': 'ean_8',
  'upc-a': 'upc_a',
  'upc-e': 'upc_e',
  'code-128': 'code_128',
  'code-39': 'code_39',
  'code-93': 'code_93',
  codabar: 'codabar',
  itf: 'itf',
};

const CODE_TYPES = Object.fromEntries(Object.entries(BARCODE_FORMATS).map(([type, format]) => [format, type])) as Record<
  string,
  CameraCodeType
>;

/** `BarcodeDetector` results → codes (formats the lib does not name are dropped). */
export const toCodes = (barcodes: Array<{ rawValue: string; format: string }>): CameraCode[] =>
  barcodes.filter((code) => CODE_TYPES[code.format]).map((code) => ({ value: code.rawValue, type: CODE_TYPES[code.format] }));

/** The `getUserMedia` constraints for a camera (and its microphone). */
export const streamConstraints = (facing: CameraFacing, withAudio: boolean): MediaStreamConstraints => ({
  video: {
    facingMode: facing === 'front' ? 'user' : 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: withAudio,
});

/**
 * A `getUserMedia` failure → permission state. `NotAllowedError` means the user (or a
 * browser policy) refused; anything else (no camera, in use…) is not a permission problem.
 */
export const permissionFromError = (error: unknown): CameraPermissionStatus | null =>
  (error as { name?: string })?.name === 'NotAllowedError' ? 'denied' : null;

/** First container the browser can record (MP4 on Safari, WebM on Chrome and Firefox). */
export function recorderMimeType(): string | undefined {
  const Recorder = (globalThis as any).MediaRecorder;
  if (!Recorder?.isTypeSupported) return undefined;
  return ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((type) =>
    Recorder.isTypeSupported(type),
  );
}

/** Zoom range the camera track supports natively (`null` when only digital zoom is possible). */
export function trackZoomRange(track: MediaStreamTrack | undefined): { min: number; max: number } | null {
  const capabilities = (track as any)?.getCapabilities?.();
  const zoom = capabilities?.zoom;
  return zoom && typeof zoom.max === 'number' ? { min: zoom.min ?? 1, max: zoom.max } : null;
}

/** Whether the camera track can keep its light on. */
export const trackHasTorch = (track: MediaStreamTrack | undefined): boolean => Boolean((track as any)?.getCapabilities?.()?.torch);

/** Highest digital zoom when the track has no zoom of its own. */
export const DIGITAL_ZOOM_MAX = 4;
