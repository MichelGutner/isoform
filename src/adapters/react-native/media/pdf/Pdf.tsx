/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import type { WithoutPlaylist } from '../../../../core/playlist';
import { StyleSheet, View } from 'react-native';
import { isModuleEnabled } from '../../../../config';
import type { PdfHandle, PdfOwnProps } from '../../../../core/pdf';
import { warnModuleDisabled } from '../../../../core/modules';

declare const require: (id: string) => any;

/**
 * The spec is only loaded when a `Pdf` renders: importing the adapter
 * (tests included) does not need the Codegen runtime.
 */
type Spec = typeof import('./native/IsoPdfViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoPdfViewNativeComponent'));

type Props = Partial<PdfOwnProps> & { style?: any; testID?: string; /** Drawn over the player (the playlist button and panel). */ overlay?: React.ReactNode; /** List position for the playlist button in the native controls (set by the playlist wrapper). */ playlist?: { index: number; count: number; onPress(): void } };

/**
 * Entry point of `Pdf` on mobile. With `modules.pdf` off not even the native
 * spec is loaded: an empty box with the same style stays (and a dev warning),
 * instead of the "native component not found" error.
 */
export const Pdf = forwardRef<WithoutPlaylist<PdfHandle>, Props>((props, ref) => {
  if (!isModuleEnabled('pdf')) {
    warnModuleDisabled('pdf');
    return <View style={props.style} testID={props.testID} />;
  }
  return <PdfViewer ref={ref} {...props} />;
});
Pdf.displayName = 'Pdf';

/**
 * The viewer: the lib's native component (PDFKit + UIKit on iOS, PdfRenderer +
 * Compose on Android). It only translates the isoform contract to the native
 * props and events.
 */
const PdfViewer = forwardRef<WithoutPlaylist<PdfHandle>, Props>(
  (
    {
      src,
      password,
      initialPage = 1,
      controls = true,
      nightMode = false,
      fit = 'width',
      direction = 'vertical',
      maxZoom = 5,
      speechLanguage,
      speechVoice,
      onLoad,
      onPageChange,
      onSearch,
      onError,
      onPasswordRequired,
      onLinkPress,
      onFullscreenChange,
      onReadAloudChange,
      style,
      testID,
      overlay,
      playlist,
    },
    ref,
  ) => {
    const { default: NativePdf, Commands } = nativeSpec();
    const native = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        goToPage: (page) => native.current && Commands.goToPage(native.current, Math.round(page)),
        search: (query) => native.current && Commands.search(native.current, query),
        searchNext: () => native.current && Commands.searchNext(native.current),
        searchPrevious: () => native.current && Commands.searchPrevious(native.current),
        clearSearch: () => native.current && Commands.clearSearch(native.current),
        setZoom: (scale) => native.current && Commands.setZoom(native.current, scale),
        setFullscreen: (fullscreen) => native.current && Commands.setFullscreen(native.current, fullscreen),
        startReadAloud: () => native.current && Commands.startReadAloud(native.current),
        stopReadAloud: () => native.current && Commands.stopReadAloud(native.current),
      }),
      [Commands],
    );

    return (
      <View style={[styles.container, style]} testID={testID}>
        <NativePdf
          ref={native}
          playlistIndex={playlist?.index ?? -1}
          playlistCount={playlist?.count ?? 0}
          onPdfPlaylist={() => playlist?.onPress()}
          style={StyleSheet.absoluteFill}
          src={src}
          password={password}
          initialPage={Math.max(1, Math.round(initialPage))}
          controls={controls}
          nightMode={nightMode}
          fit={fit}
          direction={direction}
          maxZoom={maxZoom}
          speechLanguage={speechLanguage}
          speechVoice={speechVoice}
          onPdfLoad={(e) => onLoad?.({ pageCount: e.nativeEvent.pageCount })}
          onPdfPage={(e) => onPageChange?.({ page: e.nativeEvent.page, pageCount: e.nativeEvent.pageCount })}
          onPdfSearch={({ nativeEvent: { query, total, current } }) => onSearch?.({ query, total, current })}
          onPdfError={(e) => onError?.(e.nativeEvent.message)}
          onPdfPassword={() => onPasswordRequired?.()}
          onPdfLink={(e) => onLinkPress?.(e.nativeEvent.url)}
          onPdfFullscreen={(e) => onFullscreenChange?.(e.nativeEvent.fullscreen)}
          onPdfReadAloud={(e) => onReadAloudChange?.(e.nativeEvent.reading)}
        />
        {overlay}
      </View>
    );
  },
);
PdfViewer.displayName = 'PdfViewer';

/** Default height, so an unsized `Pdf` still shows a page and the toolbar. */
const styles = StyleSheet.create({ container: { minHeight: 420, overflow: 'hidden' } });
