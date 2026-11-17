/**
 * `Camera`: the device camera's live preview, with photo capture, video recording
 * and a code scanner. The app draws its own interface (shutter, switches…) and
 * drives the camera through props and the `ref`.
 * - Android: CameraX with the Jetpack Compose viewfinder (`CameraXViewfinder`).
 * - iOS: AVFoundation (`AVCaptureSession`).
 * - Web: `getUserMedia` in a `<video>`, `MediaRecorder` and `BarcodeDetector`.
 */

/** Which camera to use. */
export type CameraFacing = 'back' | 'front';

/** Flash for photos. */
export type CameraFlash = 'off' | 'on' | 'auto';

/**
 * Access to a device (camera or microphone).
 * - `'undetermined'`: not asked yet (the camera asks when it becomes active).
 * - `'granted'`: allowed.
 * - `'denied'`: refused, but the app may ask again.
 * - `'blocked'`: refused for good; only the system settings can change it.
 */
export type CameraPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked';

/** Permission state reported by `onPermissionChange`. */
export interface CameraPermission {
  /** Camera access. */
  camera: CameraPermissionStatus;
  /** Microphone access (only asked when `video` is on). */
  microphone: CameraPermissionStatus;
}

/**
 * Kind of code the scanner looks for.
 * - 2D: `'qr'`, `'aztec'`, `'data-matrix'`, `'pdf417'`.
 * - 1D: `'ean-13'`, `'ean-8'`, `'upc-a'`, `'upc-e'`, `'code-128'`, `'code-39'`, `'code-93'`, `'codabar'`, `'itf'`.
 */
export type CameraCodeType =
  | 'qr'
  | 'aztec'
  | 'data-matrix'
  | 'pdf417'
  | 'ean-13'
  | 'ean-8'
  | 'upc-a'
  | 'upc-e'
  | 'code-128'
  | 'code-39'
  | 'code-93'
  | 'codabar'
  | 'itf';

/** Every code type, in the order the docs list them. */
export const CAMERA_CODE_TYPES: readonly CameraCodeType[] = [
  'qr',
  'aztec',
  'data-matrix',
  'pdf417',
  'ean-13',
  'ean-8',
  'upc-a',
  'upc-e',
  'code-128',
  'code-39',
  'code-93',
  'codabar',
  'itf',
];

/** One code seen by the scanner. */
export interface CameraCode {
  /** What it encodes (text, URL…). */
  value: string;
  /** Its kind. */
  type: CameraCodeType;
}

/** A photo taken with `takePhoto`. */
export interface CameraPhoto {
  /** Where the JPEG was saved (`file://` on iOS/Android, a `blob:` URL on the web). */
  uri: string;
  /** Width in pixels, as the photo is meant to be seen (rotation applied). */
  width: number;
  /** Height in pixels, as the photo is meant to be seen (rotation applied). */
  height: number;
}

/** A video recorded with `startRecording` / `stopRecording`. */
export interface CameraVideo {
  /** Where the file was saved (`file://` MP4/MOV on iOS/Android, a `blob:` URL on the web). */
  uri: string;
  /** Length in seconds. */
  duration: number;
}

/** Options of `takePhoto`. */
export interface TakePhotoOptions {
  /** Flash for this photo. Default: the `flash` prop. */
  flash?: CameraFlash;
}

/** Props of `Camera` besides the common ones (`style`, `testID`…). */
export interface CameraOwnProps {
  /** Which camera. Default `'back'`. */
  facing?: CameraFacing;
  /**
   * Whether the camera runs. `false` stops it (and turns the light off) while the
   * component stays on screen: use it for hidden tabs and screens. Default `true`.
   */
  active?: boolean;
  /** Flash for photos. Default `'off'`. */
  flash?: CameraFlash;
  /** Keeps the light on (back camera with a flash). Default `false`. */
  torch?: boolean;
  /**
   * Zoom factor: `1` is no zoom, `2` is twice as close. Clamped to what the device
   * supports. With `zoomGesture` on, pinching changes it and reports `onZoomChange`.
   * Default `1`.
   */
  zoom?: number;
  /** Called with the new factor when pinching changes the zoom. */
  onZoomChange?: (zoom: number) => void;
  /** Pinch to zoom on the preview. Default `true`. */
  zoomGesture?: boolean;
  /** Tap on the preview to focus and expose there. Default `true`. */
  focusGesture?: boolean;
  /**
   * Enables recording (`startRecording`): adds the video output and asks for the
   * microphone. Requires `camera.video` in `isoform.config.json`. Default `false`.
   */
  video?: boolean;
  /** Records sound with the video. Default `true`. */
  audio?: boolean;
  /**
   * Called with the codes in sight whenever they change (not on every frame).
   * Setting it turns the scanner on. Requires `camera.codeScanner` in `isoform.config.json`.
   */
  onCodeScanned?: (codes: CameraCode[]) => void;
  /** Code kinds to look for. Default `['qr']` (fewer kinds scan faster). */
  codeTypes?: CameraCodeType[];
  /** Called when the preview is showing frames. */
  onReady?: () => void;
  /** Called when the camera fails (no camera, in use by another app…). */
  onError?: (message: string) => void;
  /** Called when the camera or microphone permission changes. */
  onPermissionChange?: (permission: CameraPermission) => void;
  /**
   * Text shown over the preview while the camera is not allowed. The system dialog
   * itself uses the platform's text (on iOS, `NSCameraUsageDescription` in Info.plist).
   * Default `'Allow camera access to use the camera.'`.
   */
  permissionMessage?: string;
  /**
   * Label of the button under `permissionMessage`: it asks again, or opens the system
   * settings once the permission is blocked. Default `'Allow camera'` / `'Open settings'`.
   */
  permissionButtonLabel?: string;
}

/** `ref` of a `Camera`. */
export interface CameraHandle {
  /** Takes a photo (JPEG). Rejects when the camera is not ready. */
  takePhoto(options?: TakePhotoOptions): Promise<CameraPhoto>;
  /** Starts recording (needs `video`). Resolves once recording has started. */
  startRecording(): Promise<void>;
  /** Stops recording and resolves with the file. */
  stopRecording(): Promise<CameraVideo>;
}

/** Default code kinds. */
export const DEFAULT_CODE_TYPES: CameraCodeType[] = ['qr'];

/** Default texts of the permission notice. */
export const CAMERA_TEXT = {
  message: 'Allow camera access to use the camera.',
  ask: 'Allow camera',
  settings: 'Open settings',
} as const;

/** Clamps a zoom factor to `[min, max]` (a non-finite value becomes `min`). */
export const clampZoom = (zoom: number, min: number, max: number): number =>
  Number.isFinite(zoom) ? Math.min(Math.max(zoom, min), max) : min;

/** Whether two code lists hold the same codes (order ignored), so unchanged scans are not reported. */
export function sameCodes(a: CameraCode[], b: CameraCode[]): boolean {
  if (a.length !== b.length) return false;
  const key = (code: CameraCode) => `${code.type}:${code.value}`;
  const seen = new Set(a.map(key));
  return b.every((code) => seen.has(key(code)));
}
