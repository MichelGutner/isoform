/**
 * `Image` with the `image` module on: the lib's own image pipeline.
 * iOS and Android: memory and disk caches, downloads shared between views, progress,
 * decoding at the size on screen, animated GIF/WebP, blurhash placeholders, crossfade,
 * tint and blur (the same pipeline design on both). Web: the browser's `<img>` with the
 * same props (`object-fit`, lazy loading, blurhash, crossfade).
 * With the module off, `Image` stays the platform's plain image.
 */
import { getProvider } from '../config';

/**
 * How the picture fills its box (the CSS `object-fit` names).
 * - `'cover'`: fills the box, keeping the aspect ratio; the overflow is cropped. The default.
 * - `'contain'`: fits inside the box, keeping the aspect ratio (letterboxed).
 * - `'fill'`: stretched to the box.
 * - `'none'`: its own size, cropped by the box.
 * - `'scale-down'`: like `'none'`, or `'contain'` when it is bigger than the box.
 */
export type ImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

/** Where the picture sits in its box when it does not fill it (CSS `object-position` keywords). */
export type ImageContentPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right';

/** A remote or local picture with options. */
export interface ImageSource {
  /** `https://…`, `file://…`, `data:image/…;base64,…` (and `content://…` on Android). */
  uri: string;
  /** HTTP headers of the request (auth tokens…). Native only: the web cannot set headers on `<img>`. */
  headers?: Record<string, string>;
  /** Cache key instead of the URL: for signed URLs that change while the picture does not. Native only. */
  cacheKey?: string;
}

/** What `src` and `placeholder` accept: a URL, a `require('./pic.png')` or an `ImageSource`. */
export type ImageSourceInput = string | number | ImageSource;

/**
 * Which caches keep the picture. Native only (the browser owns its cache on the web).
 * - `'memory-disk'` (default): both; the fastest on the next show, and offline.
 * - `'memory'`: only while the app runs.
 * - `'disk'`: only on disk (lighter on memory, for large lists).
 * - `'none'`: always downloaded again.
 */
export type ImageCachePolicy = 'memory-disk' | 'memory' | 'disk' | 'none';

/** Download order when many pictures load at once (`fetchpriority` on the web). */
export type ImagePriority = 'low' | 'normal' | 'high';

/** Where a loaded picture came from. */
export type ImageCacheType = 'memory' | 'disk' | 'none';

/** `onLoad` payload. */
export interface ImageLoadEvent {
  /** Width of the picture in pixels (as decoded from the file). */
  width: number;
  /** Height of the picture in pixels. */
  height: number;
  /** `'memory'` or `'disk'` for a cache hit, `'none'` when it was downloaded (always `'none'` on the web). */
  cacheType: ImageCacheType;
}

/** `onProgress` payload (native only). */
export interface ImageProgressEvent {
  /** Bytes received so far. */
  loaded: number;
  /** Size of the file in bytes, or `0` when the server does not say. */
  total: number;
}

/** `onError` payload. */
export interface ImageErrorEvent {
  /** What went wrong (HTTP status, decoding…). */
  message: string;
}

/** Props of `Image` added by the `image` module, besides `src`, `alt` and the common ones. */
export interface ImageOwnProps {
  /** How the picture fills its box. Default `'cover'`. */
  contentFit?: ImageContentFit;
  /** Where the picture sits in its box. Default `'center'`. */
  contentPosition?: ImageContentPosition;
  /**
   * Shown until the picture loads (and when it fails): usually a small local file or a
   * thumbnail URL. Drawn with the same `contentFit`. `blurhash` wins when both are set.
   */
  placeholder?: ImageSourceInput;
  /**
   * A [blurhash](https://blurha.sh) of the picture: a blurred preview from a ~30 character
   * string (keep it in your API next to the URL). Drawn as `cover`.
   */
  blurhash?: string;
  /** Crossfade from the placeholder, in ms, when the picture was not in memory. `0` turns it off. Default `250`. */
  transition?: number;
  /** Paints every non-transparent pixel with this color (icons, monochrome logos). */
  tintColor?: string;
  /** Gaussian blur radius, in points. Default `0`. */
  blurRadius?: number;
  /** Which caches keep the picture. Default `'memory-disk'`. Native only. */
  cachePolicy?: ImageCachePolicy;
  /** Download order. Default `'normal'`. */
  priority?: ImagePriority;
  /** Plays animated GIF/WebP/APNG pictures. `false` shows the first frame. Default `true`. */
  autoplay?: boolean;
  /**
   * Turns on the viewer gestures: pinch to zoom, drag while zoomed (it stays inside the
   * box), double tap to zoom in and back out. Inside a scroll view the gestures win only
   * while zoomed or with two fingers. Default `false`.
   */
  zoomable?: boolean;
  /** Largest zoom. Default `4`. */
  maxZoom?: number;
  /** Zoom of a double tap. Default `2.5`. */
  doubleTapZoom?: number;
  /** With `zoomable`: two-finger rotation as well (it snaps to right angles). Default `false`. */
  rotatable?: boolean;
  /** Called when the zoom, the offset or the rotation change (by a gesture or through the `ref`). */
  onZoomChange?: (event: ImageZoomEvent) => void;
  /** The download started. */
  onLoadStart?: () => void;
  /** Bytes received while downloading. Native only. */
  onProgress?: (event: ImageProgressEvent) => void;
  /** The picture is on screen. */
  onLoad?: (event: ImageLoadEvent) => void;
  /** The picture could not be loaded or decoded (the placeholder stays). */
  onError?: (event: ImageErrorEvent) => void;
}

/** `onZoomChange` payload. */
export interface ImageZoomEvent {
  /** Zoom (`1` = the picture as `contentFit` draws it). */
  scale: number;
  /** Horizontal offset of the zoomed picture, in points. */
  x: number;
  /** Vertical offset of the zoomed picture, in points. */
  y: number;
  /** Rotation, in degrees (clockwise). */
  rotation: number;
}

/** Options of `ImageHandle.zoomTo`. */
export interface ImageZoomOptions {
  /** Point of the view (in points from its top-left corner) that stays still. Default: the center. */
  focusX?: number;
  /** Point of the view (in points from its top-left corner) that stays still. Default: the center. */
  focusY?: number;
  /** Animates the change. Default `true`. */
  animated?: boolean;
}

/** `ref` of an `Image` (with the `image` module on). */
export interface ImageHandle {
  /** Zooms to `scale` (clamped to `1…maxZoom`), keeping the focus point still. Works without `zoomable`. */
  zoomTo(scale: number, options?: ImageZoomOptions): void;
  /** Back to scale 1, centered, without rotation. */
  resetZoom(animated?: boolean): void;
  /** Rotates to `degrees` (clockwise). Works without `rotatable`. */
  rotateTo(degrees: number, animated?: boolean): void;
  /** Plays an animated picture. */
  play(): void;
  /** Pauses an animated picture on the current frame. */
  pause(): void;
  /** Loads the picture again, skipping the memory and disk caches. */
  reload(): void;
}

/** Default largest zoom. */
export const DEFAULT_MAX_ZOOM = 4;
/** Default zoom of a double tap. */
export const DEFAULT_DOUBLE_TAP_ZOOM = 2.5;

/**
 * Keeps a zoomed picture covering its box: the offset (from the centered position) is
 * limited to the part of the picture that overflows. The native views use the same rule.
 * @param offset Wanted offset on one axis, in points.
 * @param box Size of the view on that axis.
 * @param scale Current zoom.
 */
export const clampOffset = (offset: number, box: number, scale: number): number => {
  const limit = Math.max(0, (box * scale - box) / 2);
  return Math.max(-limit, Math.min(limit, offset));
};

/** Zoom limited to `1…maxZoom`. */
export const clampZoom = (scale: number, maxZoom = DEFAULT_MAX_ZOOM): number => Math.max(1, Math.min(Math.max(1, maxZoom), scale));

/**
 * Offset that keeps the focus point still while the zoom goes from `from` to `to`
 * (one axis; offsets are from the centered position, the focus from the view's center).
 */
export const zoomOffset = (offset: number, focus: number, from: number, to: number): number =>
  focus - ((focus - offset) * to) / from;

/** Options of `prefetchImages`. */
export interface PrefetchOptions {
  /**
   * Where the pictures are kept. Default `'disk'`: the files only, light on memory (they
   * are decoded when shown). `'memory-disk'` and `'memory'` also decode them right away,
   * at their full size, so they show without any wait. Native only.
   */
  cachePolicy?: Exclude<ImageCachePolicy, 'none'>;
  /** HTTP headers of the requests. Native only. */
  headers?: Record<string, string>;
}

/** Options of `clearImageCache`. */
export interface ClearImageCacheOptions {
  /** Empties the memory cache. Default `true`. */
  memory?: boolean;
  /** Deletes the files of the disk cache. Default `true`. */
  disk?: boolean;
}

/** What a platform does for `prefetchImages` and `clearImageCache` (`PlatformAdapter.images`). */
export interface ImageCacheApi {
  /** Downloads the pictures into the cache. Resolves `true` when all of them loaded. */
  prefetch(urls: string[], options: PrefetchOptions): Promise<boolean>;
  /** Empties the caches. */
  clear(options: Required<ClearImageCacheOptions>): Promise<void>;
}

/**
 * Downloads pictures before they are shown (the next screen, the next page of a list),
 * so they appear at once. Needs the `image` module.
 * @param urls One URL or many.
 * @returns `true` when every picture was cached, `false` otherwise (or with the module off).
 */
export function prefetchImages(urls: string | string[], options: PrefetchOptions = {}): Promise<boolean> {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  const api = getProvider().images;
  return api && list.length ? api.prefetch(list, options) : Promise.resolve(false);
}

/**
 * Empties the image caches (memory and disk by default). Needs the `image` module on
 * native; does nothing on the web (the browser owns its cache).
 */
export function clearImageCache(options: ClearImageCacheOptions = {}): Promise<void> {
  const api = getProvider().images;
  return api ? api.clear({ memory: options.memory ?? true, disk: options.disk ?? true }) : Promise.resolve();
}

/** Default crossfade, in ms. */
export const DEFAULT_TRANSITION = 250;

/** `contentFit` as the native views read it (`'scaleDown'`: no hyphen in a native enum). */
export type NativeContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scaleDown';

/** `contentFit` → the native views' name. */
export const nativeContentFit = (fit: ImageContentFit = 'cover'): NativeContentFit => (fit === 'scale-down' ? 'scaleDown' : fit);

/** A position as fractions of the free space: `0` left/top, `0.5` center, `1` right/bottom. */
export interface PositionFractions {
  x: number;
  y: number;
}

const AXIS: Record<string, Partial<PositionFractions>> = {
  left: { x: 0 },
  right: { x: 1 },
  top: { y: 0 },
  bottom: { y: 1 },
  center: {},
};

/** `'top left'` → `{ x: 0, y: 0 }`; unknown words stay centered. */
export function positionFractions(position: ImageContentPosition = 'center'): PositionFractions {
  return position
    .split(/\s+/)
    .reduce<PositionFractions>((out, word) => ({ ...out, ...AXIS[word] }), { x: 0.5, y: 0.5 });
}

/** A rectangle in points. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scale of the picture for each `contentFit` (`fill` is handled apart: it has two). */
const FIT_SCALE: Record<Exclude<ImageContentFit, 'fill'>, (box: Size, image: Size) => number> = {
  cover: (box, image) => Math.max(box.width / image.width, box.height / image.height),
  contain: (box, image) => Math.min(box.width / image.width, box.height / image.height),
  none: () => 1,
  'scale-down': (box, image) => Math.min(1, box.width / image.width, box.height / image.height),
};

/** A size in points. */
export interface Size {
  width: number;
  height: number;
}

/**
 * Where the picture is drawn inside its box (it may overflow the box: the box crops it).
 * The native views use the same rule.
 * @param box Size of the view.
 * @param image Size of the picture, in points.
 */
export function fitRect(fit: ImageContentFit, position: ImageContentPosition, box: Size, image: Size): Rect {
  if (image.width <= 0 || image.height <= 0) return { x: 0, y: 0, ...box };
  if (fit === 'fill') return { x: 0, y: 0, width: box.width, height: box.height };
  const scale = FIT_SCALE[fit](box, image);
  const width = image.width * scale;
  const height = image.height * scale;
  const { x, y } = positionFractions(position);
  // `+ 0` turns `-0` into `0`
  return { x: (box.width - width) * x + 0, y: (box.height - height) * y + 0, width, height };
}

/** `contentFit` → React Native's `resizeMode`, for the plain image used with the module off. */
export const resizeModeOf = (fit: ImageContentFit = 'cover'): 'cover' | 'contain' | 'stretch' | 'center' =>
  ({ cover: 'cover', contain: 'contain', fill: 'stretch', none: 'center', 'scale-down': 'contain' } as const)[fit];

/** The URL of a source, or `undefined` for a `require()` (resolved by the platform). */
export const sourceUri = (source: ImageSourceInput | undefined): string | undefined =>
  typeof source === 'string' ? source : typeof source === 'object' && source ? source.uri : undefined;

/** Headers as a flat list (`[name, value, name, value…]`), the way the native views read them. */
export const flatHeaders = (headers: Record<string, string> | undefined): string[] =>
  Object.entries(headers ?? {}).flatMap(([name, value]) => [name, String(value)]);

// ── blurhash ──

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

const decode83 = (text: string): number => [...text].reduce((value, char) => value * 83 + BASE83.indexOf(char), 0);

const toLinear = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const toSrgb = (value: number): number => {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308 ? Math.round(v * 12.92 * 255 + 0.5) : Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
};

const signPow = (value: number, exponent: number): number => Math.sign(value) * Math.pow(Math.abs(value), exponent);

/** Whether `hash` is a well-formed blurhash. */
export function isBlurhash(hash: string | undefined): hash is string {
  if (!hash || hash.length < 6 || [...hash].some((char) => !BASE83.includes(char))) return false;
  const size = decode83(hash[0]);
  return hash.length === 4 + 2 * ((size % 9) + 1) * (Math.floor(size / 9) + 1);
}

/**
 * Decodes a blurhash into RGBA pixels (the same algorithm runs natively on iOS and Android).
 * @param width Width of the output, in pixels (32 is plenty: it is drawn blurred).
 * @param height Height of the output, in pixels.
 * @param punch Contrast boost. Default `1`.
 * @returns `width * height * 4` bytes, or `null` for an invalid hash.
 */
export function decodeBlurhash(hash: string, width: number, height: number, punch = 1): Uint8ClampedArray | null {
  if (!isBlurhash(hash)) return null;
  const size = decode83(hash[0]);
  const countY = Math.floor(size / 9) + 1;
  const countX = (size % 9) + 1;
  const maximum = ((decode83(hash[1]) + 1) / 166) * punch;

  const colors: number[][] = [];
  for (let i = 0; i < countX * countY; i++) {
    if (i === 0) {
      const value = decode83(hash.substring(2, 6));
      colors.push([toLinear(value >> 16), toLinear((value >> 8) & 255), toLinear(value & 255)]);
    } else {
      const value = decode83(hash.substring(4 + i * 2, 6 + i * 2));
      colors.push([
        signPow((Math.floor(value / (19 * 19)) - 9) / 9, 2) * maximum,
        signPow(((Math.floor(value / 19) % 19) - 9) / 9, 2) * maximum,
        signPow(((value % 19) - 9) / 9, 2) * maximum,
      ]);
    }
  }

  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < countY; j++) {
        for (let i = 0; i < countX; i++) {
          const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
          const color = colors[i + j * countX];
          r += color[0] * basis;
          g += color[1] * basis;
          b += color[2] * basis;
        }
      }
      const at = 4 * (x + y * width);
      pixels[at] = toSrgb(r);
      pixels[at + 1] = toSrgb(g);
      pixels[at + 2] = toSrgb(b);
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}
