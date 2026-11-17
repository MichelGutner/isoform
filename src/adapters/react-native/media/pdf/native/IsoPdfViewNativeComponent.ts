/**
 * Spec of the native PDF component (New Architecture / Fabric).
 *
 * The React Native Codegen reads THIS file when the app is built and generates
 * the native interfaces (props, events and commands) used by:
 *  · iOS:     ios/pdf/IsoPdfView.mm + ios/pdf/IsoPdfViewer.swift (PDFKit + UIKit)
 *  · Android: android/src/pdf/.../IsoPdfViewManager.kt + IsoPdfView.kt (PdfRenderer + Compose)
 *
 * Codegen rules: the file name ends in `NativeComponent.ts`, types come from
 * `CodegenTypes`, and the `export default` calls `codegenNativeComponent`.
 */
import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type EmptyEvent = Readonly<{}>;
type LoadEvent = Readonly<{ pageCount: CodegenTypes.Int32 }>;
type PageEvent = Readonly<{ page: CodegenTypes.Int32; pageCount: CodegenTypes.Int32 }>;
type SearchEvent = Readonly<{ query: string; total: CodegenTypes.Int32; current: CodegenTypes.Int32 }>;
type ErrorEvent = Readonly<{ message: string }>;
type LinkEvent = Readonly<{ url: string }>;
type FullscreenEvent = Readonly<{ fullscreen: boolean }>;
type ReadAloudEvent = Readonly<{ reading: boolean }>;

export interface NativeProps extends ViewProps {
  src?: string;
  password?: string;
  initialPage?: CodegenTypes.WithDefault<CodegenTypes.Int32, 1>;
  controls?: CodegenTypes.WithDefault<boolean, true>;
  nightMode?: CodegenTypes.WithDefault<boolean, false>;
  fit?: CodegenTypes.WithDefault<'width' | 'page', 'width'>;
  direction?: CodegenTypes.WithDefault<'vertical' | 'horizontal', 'vertical'>;
  maxZoom?: CodegenTypes.WithDefault<CodegenTypes.Float, 5.0>;
  speechLanguage?: string;
  speechVoice?: string;
  // list (`items`): the controls show a playlist button with the position
  playlistIndex?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  playlistCount?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;

  // `onPdf*` prefix so they do not clash with events React Native already defines (e.g. `onError`).
  onPdfLoad?: CodegenTypes.DirectEventHandler<LoadEvent>;
  onPdfPage?: CodegenTypes.DirectEventHandler<PageEvent>;
  onPdfSearch?: CodegenTypes.DirectEventHandler<SearchEvent>;
  onPdfError?: CodegenTypes.DirectEventHandler<ErrorEvent>;
  onPdfPassword?: CodegenTypes.DirectEventHandler<EmptyEvent>;
  onPdfLink?: CodegenTypes.DirectEventHandler<LinkEvent>;
  onPdfFullscreen?: CodegenTypes.DirectEventHandler<FullscreenEvent>;
  onPdfReadAloud?: CodegenTypes.DirectEventHandler<ReadAloudEvent>;
  onPdfPlaylist?: CodegenTypes.DirectEventHandler<EmptyEvent>;
}

type ComponentType = HostComponent<NativeProps>;

// Codegen requires `React.ElementRef<...>` written inline as the first argument (no alias).
interface NativeCommands {
  goToPage: (viewRef: React.ElementRef<ComponentType>, page: CodegenTypes.Int32) => void;
  search: (viewRef: React.ElementRef<ComponentType>, query: string) => void;
  searchNext: (viewRef: React.ElementRef<ComponentType>) => void;
  searchPrevious: (viewRef: React.ElementRef<ComponentType>) => void;
  clearSearch: (viewRef: React.ElementRef<ComponentType>) => void;
  setZoom: (viewRef: React.ElementRef<ComponentType>, scale: CodegenTypes.Float) => void;
  setFullscreen: (viewRef: React.ElementRef<ComponentType>, fullscreen: boolean) => void;
  startReadAloud: (viewRef: React.ElementRef<ComponentType>) => void;
  stopReadAloud: (viewRef: React.ElementRef<ComponentType>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['goToPage', 'search', 'searchNext', 'searchPrevious', 'clearSearch', 'setZoom', 'setFullscreen', 'startReadAloud', 'stopReadAloud'],
});

export default codegenNativeComponent<NativeProps>('IsoPdfView') as ComponentType;
