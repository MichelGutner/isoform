/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { isModuleEnabled } from '../../../config';
import {
  DEFAULT_DOUBLE_TAP_ZOOM,
  DEFAULT_MAX_ZOOM,
  DEFAULT_TRANSITION,
  clampOffset,
  clampZoom,
  decodeBlurhash,
  isBlurhash,
  sourceUri,
  zoomOffset,
  type ImageHandle,
  type ImageOwnProps,
  type ImageSourceInput,
  type ImageZoomEvent,
} from '../../../core/image';
import { warnOnce } from '../../../core/dev';

type Props = ImageOwnProps & {
  src?: ImageSourceInput;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  [key: string]: any;
};

/** The module's props, kept away from the plain `<img>`. */
const OWN = [
  'contentFit',
  'contentPosition',
  'placeholder',
  'blurhash',
  'transition',
  'tintColor',
  'blurRadius',
  'cachePolicy',
  'priority',
  'autoplay',
  'zoomable',
  'maxZoom',
  'doubleTapZoom',
  'rotatable',
  'onZoomChange',
  'onLoadStart',
  'onProgress',
] as const;

/** The URL `<img>` takes (a `require` number does not exist on the web). */
function webSrc(src: ImageSourceInput | undefined): string | undefined {
  if (typeof src === 'number') warnOnce('web-image-require', 'a numeric `require()` is not supported on the web; use a URL in `src`.');
  return sourceUri(src);
}

/** A blurhash as a small PNG data URL (cached), or `undefined` where there is no canvas. */
const hashUrls = new Map<string, string | undefined>();
function blurhashUrl(hash: string | undefined): string | undefined {
  if (!isBlurhash(hash) || typeof document === 'undefined') return undefined;
  if (hashUrls.has(hash)) return hashUrls.get(hash);
  const pixels = decodeBlurhash(hash, 32, 32);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext?.('2d');
  let url: string | undefined;
  if (pixels && context) {
    const data = context.createImageData(32, 32);
    data.data.set(pixels);
    context.putImageData(data, 0, 0);
    url = canvas.toDataURL();
  }
  hashUrls.set(hash, url);
  return url;
}

/**
 * Web `Image`: the browser's `<img>`. With `modules.image` on it gets the module's props:
 * blurhash/placeholder behind it, a crossfade, `object-fit`/`object-position`, tint (a colored
 * `drop-shadow`, which works without CORS), blur, lazy loading, `fetchpriority`, and the viewer gestures (pinch, ctrl + wheel,
 * drag, double click) with the same `ref`. Off: a plain `<img>`.
 */
export const Image = forwardRef<ImageHandle | HTMLImageElement, Props>((props, ref) => {
  if (isModuleEnabled('image')) return <RichImage ref={ref as any} {...props} />;
  const { src, contentFit, blurRadius, style, ...rest } = props;
  OWN.forEach((key) => delete rest[key]);
  return (
    <img
      ref={ref as any}
      {...rest}
      src={webSrc(src)}
      style={{ ...(contentFit ? { objectFit: contentFit } : null), ...(blurRadius ? { filter: `blur(${blurRadius}px)` } : null), ...style }}
    />
  );
});
Image.displayName = 'Image';

interface Zoom {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

const IDENTITY: Zoom = { scale: 1, x: 0, y: 0, rotation: 0 };

const RichImage = forwardRef<ImageHandle, Props>(
  (
    {
      src,
      alt = '',
      contentFit = 'cover',
      contentPosition = 'center',
      placeholder,
      blurhash,
      transition = DEFAULT_TRANSITION,
      tintColor,
      blurRadius = 0,
      cachePolicy: _cachePolicy,
      priority = 'normal',
      autoplay: _autoplay,
      zoomable = false,
      maxZoom = DEFAULT_MAX_ZOOM,
      doubleTapZoom = DEFAULT_DOUBLE_TAP_ZOOM,
      rotatable = false,
      onZoomChange,
      onLoadStart,
      onProgress: _onProgress,
      onLoad,
      onError,
      className,
      style,
      width,
      height,
      ...rest
    },
    ref,
  ) => {
    const url = webSrc(src);
    const box = useRef<HTMLSpanElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [zoom, setZoomState] = useState<Zoom>(IDENTITY);
    const [animate, setAnimate] = useState(false);
    const current = useRef(zoom);
    // the tint's shadow is cast one box-width away (in px: Chrome does not paint a `vw` one)
    const [boxWidth, setBoxWidth] = useState(0);
    useEffect(() => {
      const element = box.current;
      if (!tintColor || !element) return undefined;
      const update = () => setBoxWidth(element.clientWidth);
      update();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }, [tintColor]);

    useEffect(() => {
      setLoaded(false);
      if (url) onLoadStart?.();
    }, [url, attempt]);

    const setZoom = (next: Zoom, animated: boolean) => {
      current.current = next;
      setAnimate(animated);
      setZoomState(next);
      onZoomChange?.({ ...next } as ImageZoomEvent);
    };

    const size = () => ({ width: box.current?.clientWidth ?? 0, height: box.current?.clientHeight ?? 0 });

    /** Zooms keeping the focus (from the center) still, offsets kept inside the box. */
    const zoomAround = (target: number, focusX: number, focusY: number, animated: boolean, overshoot = false) => {
      const from = current.current;
      const next = overshoot ? Math.max(0.8, Math.min(maxZoom * 1.2, target)) : clampZoom(target, maxZoom);
      const { width: w, height: h } = size();
      const x = zoomOffset(from.x, focusX, from.scale, next);
      const y = zoomOffset(from.y, focusY, from.scale, next);
      setZoom(
        { ...from, scale: next, x: overshoot ? x : clampOffset(x, w, next), y: overshoot ? y : clampOffset(y, h, next) },
        animated,
      );
    };

    useImperativeHandle(
      ref,
      (): ImageHandle => ({
        zoomTo: (scale, { focusX, focusY, animated = true } = {}) => {
          const { width: w, height: h } = size();
          const centered = focusX === undefined || focusY === undefined;
          zoomAround(scale, centered ? 0 : focusX - w / 2, centered ? 0 : focusY - h / 2, animated);
        },
        resetZoom: (animated = true) => setZoom(IDENTITY, animated),
        rotateTo: (degrees, animated = true) => setZoom({ ...current.current, rotation: degrees }, animated),
        // the browser plays GIFs by itself and cannot pause them
        play: () => undefined,
        pause: () => undefined,
        reload: () => setAttempt((n) => n + 1),
      }),
      [maxZoom],
    );

    // ── gestures: pointers (drag, pinch, rotate), ctrl + wheel (trackpad pinch), double click ──
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const pinch = useRef<{ distance: number; angle: number } | null>(null);

    const local = (event: { clientX: number; clientY: number }) => {
      const rect = box.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
    };

    const gestures = zoomable
      ? {
          onPointerDown: (event: React.PointerEvent) => {
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
            pinch.current = null;
          },
          onPointerMove: (event: React.PointerEvent) => {
            const last = pointers.current.get(event.pointerId);
            if (!last) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const all = [...pointers.current.values()];
            const from = current.current;
            const { width: w, height: h } = size();
            if (all.length >= 2) {
              const [a, b] = all;
              const distance = Math.hypot(b.x - a.x, b.y - a.y);
              const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
              const previous = pinch.current;
              pinch.current = { distance, angle };
              if (!previous) return;
              const focus = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
              zoomAround(from.scale * (distance / previous.distance), focus.x, focus.y, false, true);
              if (rotatable) setZoom({ ...current.current, rotation: current.current.rotation + (angle - previous.angle) }, false);
              return;
            }
            if (from.scale <= 1.01) return;
            setZoom(
              { ...from, x: clampOffset(from.x + event.clientX - last.x, w, from.scale), y: clampOffset(from.y + event.clientY - last.y, h, from.scale) },
              false,
            );
          },
          onPointerUp: (event: React.PointerEvent) => {
            pointers.current.delete(event.pointerId);
            if (pointers.current.size > 0 || !pinch.current) return;
            pinch.current = null;
            // back inside the limits, and a right angle
            const from = current.current;
            const rotation = rotatable ? Math.round(from.rotation / 90) * 90 : from.rotation;
            current.current = { ...from, rotation };
            zoomAround(from.scale, 0, 0, true);
          },
          onPointerCancel: (event: React.PointerEvent) => pointers.current.delete(event.pointerId),
          onWheel: (event: React.WheelEvent) => {
            if (!event.ctrlKey && current.current.scale <= 1.01) return;
            const focus = local(event);
            zoomAround(current.current.scale * Math.exp(-event.deltaY / 200), focus.x, focus.y, false);
          },
          onDoubleClick: (event: React.MouseEvent) => {
            const focus = local(event);
            if (current.current.scale > 1.01) setZoom(IDENTITY, true);
            else zoomAround(doubleTapZoom, focus.x, focus.y, true);
          },
        }
      : {};

    const hash = blurhashUrl(blurhash);
    const behind = hash ?? (placeholder !== undefined ? webSrc(placeholder) : undefined);
    const fit = hash ? 'cover' : contentFit;
    const transform = `translate(${zoom.x}px, ${zoom.y}px) rotate(${zoom.rotation}deg) scale(${zoom.scale})`;
    const fade = transition > 0 ? `opacity ${transition}ms ease-out` : undefined;
    const move = animate ? 'transform 320ms cubic-bezier(.2,0,0,1)' : undefined;

    return (
      <span
        ref={box}
        className={className}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        style={{
          display: 'block',
          position: 'relative',
          overflow: 'hidden',
          width,
          height,
          touchAction: zoomable ? 'none' : undefined,
          ...style,
        }}
        {...gestures}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            transform,
            transition: move,
            backgroundImage: behind ? `url("${behind}")` : undefined,
            backgroundSize: fit === 'fill' ? '100% 100%' : fit === 'none' ? 'auto' : fit === 'scale-down' ? 'contain' : fit,
            backgroundPosition: hash ? 'center' : contentPosition,
            backgroundRepeat: 'no-repeat',
            filter: blurRadius ? `blur(${blurRadius}px)` : undefined,
          }}
        >
          <img
            key={attempt}
            {...rest}
            src={url}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            fetchPriority={priority === 'normal' ? 'auto' : priority}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: contentFit,
              objectPosition: contentPosition,
              opacity: loaded && !tintColor ? 1 : 0,
              transition: fade,
            }}
            onLoad={(event) => {
              setLoaded(true);
              const image = event.currentTarget;
              onLoad?.({ width: image.naturalWidth, height: image.naturalHeight, cacheType: 'none' });
            }}
            onError={() => onError?.({ message: `Image failed to load: ${url ?? ''}` })}
          />
          {tintColor && url ? (
            // tint without CORS (a CSS mask would need it): a copy moved out of the box casts a
            // shadow of the tint color exactly where the picture is; the box hides the copy
            <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: loaded ? 1 : 0, transition: fade }}>
              <img
                src={url}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -boxWidth,
                  width: '100%',
                  height: '100%',
                  objectFit: contentFit,
                  objectPosition: contentPosition,
                  filter: `drop-shadow(${boxWidth}px 0 0 ${tintColor})`,
                }}
              />
            </span>
          ) : null}
        </span>
      </span>
    );
  },
);
RichImage.displayName = 'Image';

/** `prefetchImages` on the web: the browser downloads them into its cache; `clearImageCache` cannot touch that cache. */
export const webImageCache = {
  prefetch: (urls: string[]) =>
    Promise.all(
      urls.map(
        (url) =>
          new Promise<boolean>((resolve) => {
            if (typeof window === 'undefined' || typeof window.Image !== 'function') return resolve(false);
            const image = new window.Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = url;
          }),
      ),
    ).then((all) => all.every(Boolean)),
  clear: () => Promise.resolve(),
};

