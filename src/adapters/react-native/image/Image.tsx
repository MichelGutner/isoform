/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Image as RNImage, StyleSheet } from 'react-native';
import { isModuleEnabled } from '../../../config';
import {
  DEFAULT_DOUBLE_TAP_ZOOM,
  DEFAULT_MAX_ZOOM,
  DEFAULT_TRANSITION,
  flatHeaders,
  isBlurhash,
  nativeContentFit,
  positionFractions,
  type ImageHandle,
  type ImageOwnProps,
  type ImageSourceInput,
} from '../../../core/image';
import { warnOnce } from '../../../core/dev';
import { PlainImage } from './PlainImage';

declare const require: (id: string) => any;

/** The spec is only loaded when an image renders: importing the adapter (tests included) does not need Codegen. */
type Spec = typeof import('./native/IsoImageViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoImageViewNativeComponent'));

type Props = ImageOwnProps & {
  src?: ImageSourceInput;
  /** @deprecated React Native's name for `src`. */
  source?: any;
  alt?: string;
  width?: number;
  height?: number;
  style?: any;
  testID?: string;
  [key: string]: any;
};

/** A source as the native view reads it: the URL (a `require` resolved by Metro), the cache key and the headers. */
export function nativeSource(src: ImageSourceInput | undefined): { uri: string; cacheKey: string; headers: string[] } {
  if (typeof src === 'number') return { uri: RNImage.resolveAssetSource(src)?.uri ?? '', cacheKey: '', headers: [] };
  if (typeof src === 'string') return { uri: src, cacheKey: '', headers: [] };
  return { uri: src?.uri ?? '', cacheKey: src?.cacheKey ?? '', headers: flatHeaders(src?.headers) };
}

/**
 * Entry point of `Image` on mobile: the lib's own image with `modules.image` on,
 * React Native's `Image` otherwise (so turning the module off never breaks a screen).
 */
export const Image = forwardRef<ImageHandle | any, Props>((props, ref) =>
  isModuleEnabled('image') ? <NativeImage ref={ref} {...props} /> : <PlainImage ref={ref} {...props} />,
);
Image.displayName = 'Image';

/**
 * The lib's image: the native view loads, caches and draws the picture; this side only
 * resolves the sources and maps the events to the documented payloads.
 */
const NativeImage = forwardRef<ImageHandle, Props>(
  (
    {
      src,
      source,
      alt,
      width,
      height,
      contentFit,
      contentPosition,
      placeholder,
      blurhash,
      transition = DEFAULT_TRANSITION,
      tintColor,
      blurRadius = 0,
      cachePolicy = 'memory-disk',
      priority = 'normal',
      autoplay = true,
      zoomable = false,
      maxZoom = DEFAULT_MAX_ZOOM,
      doubleTapZoom = DEFAULT_DOUBLE_TAP_ZOOM,
      rotatable = false,
      onZoomChange,
      onLoadStart,
      onProgress,
      onLoad,
      onError,
      style,
      testID,
      ...rest
    },
    ref,
  ) => {
    const { default: NativeView, Commands } = nativeSpec();
    const view = useRef<any>(null);
    // the handle sends commands to the native view (a no-op until it is mounted)
    useImperativeHandle(
      ref,
      (): ImageHandle => {
        const send = (run: (target: any) => void) => view.current && run(view.current);
        return {
          zoomTo: (scale, options = {}) =>
            send((target) => Commands.zoomTo(target, scale, options.focusX ?? -1, options.focusY ?? -1, options.animated ?? true)),
          resetZoom: (animated = true) => send((target) => Commands.resetZoom(target, animated)),
          rotateTo: (degrees, animated = true) => send((target) => Commands.rotateTo(target, degrees, animated)),
          play: () => send((target) => Commands.play(target)),
          pause: () => send((target) => Commands.pause(target)),
          reload: () => send((target) => Commands.reload(target)),
        };
      },
      [Commands],
    );
    const picture = nativeSource(src ?? source);
    const position = positionFractions(contentPosition);
    if (blurhash && !isBlurhash(blurhash)) warnOnce(`image-blurhash:${blurhash}`, `blurhash inválido: "${blurhash}".`);
    const radius = StyleSheet.flatten(style)?.borderRadius;

    return (
      <NativeView
        ref={view}
        {...rest}
        style={[width !== undefined || height !== undefined ? { width, height } : null, style]}
        uri={picture.uri}
        cacheKey={picture.cacheKey}
        headers={picture.headers}
        placeholderUri={placeholder === undefined ? '' : nativeSource(placeholder).uri}
        blurhash={isBlurhash(blurhash) ? blurhash : ''}
        contentFit={nativeContentFit(contentFit)}
        positionX={position.x}
        positionY={position.y}
        transition={Math.max(0, transition)}
        tintColor={tintColor}
        blurRadius={Math.max(0, blurRadius)}
        cachePolicy={cachePolicy === 'memory-disk' ? 'memoryDisk' : cachePolicy}
        priority={priority}
        autoplay={autoplay}
        zoomable={zoomable}
        maxZoom={Math.max(1, maxZoom)}
        doubleTapZoom={Math.max(1, doubleTapZoom)}
        rotatable={rotatable}
        cornerRadius={typeof radius === 'number' ? radius : 0}
        accessible={alt !== undefined && alt !== ''}
        accessibilityRole="image"
        accessibilityLabel={rest.accessibilityLabel ?? alt}
        testID={testID}
        onImageLoadStart={onLoadStart ? () => onLoadStart() : undefined}
        onImageProgress={onProgress ? ({ nativeEvent }) => onProgress({ loaded: nativeEvent.loaded, total: nativeEvent.total }) : undefined}
        onImageLoad={
          onLoad
            ? ({ nativeEvent }) => onLoad({ width: nativeEvent.width, height: nativeEvent.height, cacheType: nativeEvent.cacheType as any })
            : undefined
        }
        onImageError={onError ? ({ nativeEvent }) => onError({ message: nativeEvent.message }) : undefined}
        onImageZoom={
          onZoomChange
            ? ({ nativeEvent }) =>
                onZoomChange({ scale: nativeEvent.scale, x: nativeEvent.x, y: nativeEvent.y, rotation: nativeEvent.rotation })
            : undefined
        }
      />
    );
  },
);
NativeImage.displayName = 'NativeImage';
