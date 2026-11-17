/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef } from 'react';
import { Image as RNImage } from 'react-native';
import { resizeModeOf, type ImageOwnProps, type ImageSourceInput } from '../../../core/image';

/** Props the plain image reads; the rest goes straight to React Native's `Image`. */
type Props = ImageOwnProps & { src?: ImageSourceInput; source?: any; alt?: string; [key: string]: any };

/** `src` as React Native's `source` (`{ uri, headers }` or the `require` number). */
const toSource = (src: ImageSourceInput | undefined): any =>
  typeof src === 'string' ? { uri: src } : typeof src === 'object' && src ? { uri: src.uri, headers: src.headers } : src;

/**
 * `Image` with the `image` module off: React Native's own `Image`, with the module's
 * props it understands mapped onto it (`contentFit` → `resizeMode`, `tintColor`,
 * `blurRadius`, a local `placeholder` → `defaultSource`, the same event payloads).
 * Blurhash, crossfade, cache policies, priorities, zoom gestures and the `ref` commands need the module.
 */
export const PlainImage = forwardRef<any, Props>(
  (
    {
      src,
      source,
      alt,
      contentFit,
      contentPosition: _position,
      placeholder,
      blurhash: _blurhash,
      transition: _transition,
      tintColor,
      blurRadius,
      cachePolicy: _cachePolicy,
      priority: _priority,
      autoplay: _autoplay,
      zoomable: _zoomable,
      maxZoom: _maxZoom,
      doubleTapZoom: _doubleTapZoom,
      rotatable: _rotatable,
      onZoomChange: _onZoomChange,
      onLoadStart,
      onProgress,
      onLoad,
      onError,
      style,
      ...rest
    },
    ref,
  ) => (
    <RNImage
      ref={ref}
      {...rest}
      source={src !== undefined ? toSource(src) : source}
      alt={alt}
      accessibilityLabel={rest.accessibilityLabel ?? alt}
      resizeMode={rest.resizeMode ?? (contentFit ? resizeModeOf(contentFit) : undefined)}
      defaultSource={typeof placeholder === 'number' ? placeholder : undefined}
      tintColor={tintColor}
      blurRadius={blurRadius}
      style={style}
      onLoadStart={onLoadStart}
      onProgress={onProgress ? (e: any) => onProgress({ loaded: e.nativeEvent.loaded, total: e.nativeEvent.total }) : undefined}
      onLoad={
        onLoad
          ? (e: any) => onLoad({ width: e.nativeEvent.source?.width ?? 0, height: e.nativeEvent.source?.height ?? 0, cacheType: 'none' })
          : undefined
      }
      onError={onError ? (e: any) => onError({ message: String(e.nativeEvent?.error ?? 'Image failed to load') }) : undefined}
    />
  ),
);
PlainImage.displayName = 'Image';
