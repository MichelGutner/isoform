// O bundler escolhe o provedor da plataforma: `providers/index.native.ts` (Metro
// iOS/Android) ou `providers/index.ts` (Vite, webpack, Next, Metro web). O caminho
// aponta para o arquivo (e não para a pasta) para a extensão de plataforma valer.
// Efeito colateral intencional: registra o adapter no import.
import './providers/index';

import { getProvider } from './config';

export { engine } from './core/engine';
export type { Engine } from './core/engine';
export { keyframes } from './core/keyframes';
export type { Keyframes } from './core/keyframes';
export { configure, getProvider } from './config';
export type {
  AudioModuleOptions,
  PdfModuleOptions,
  CameraModuleOptions,
  ConfigureOptions,
  ModuleName,
  ModuleOptions,
  IsoModules,
  ProviderName,
} from './config';
export type { PlatformAdapter, ApplyPropsInput, StateStyles } from './core/adapter';
export type {
  Condition,
  EngineComponent,
  BaseStyleContext,
  StyleContext,
  Platform,
  StateName,
  IsoBreakpointNames,
  BreakpointName,
  BreakpointCondition,
  BreakpointRangeCondition,
  DefaultBreakpointRange,
  PlatformCondition,
  StateCondition,
  PropConditionKeys,
  PseudoName,
} from './core/types';
export type { IsoStyle, StyleInput, LegacyRNStyle } from './core/style/types';
export type {
  IsoPrimitives,
  IsoNativeProps,
  BoxProps,
  TextProps,
  PressableProps,
  InputProps,
  ImageProps,
  ScrollProps,
  VideoProps,
  AudioProps,
  PdfProps,
  BottomSheetProps,
  SvgProps,
  SvgElementProps,
  CameraProps,
  DatePickerProps,
  ModalProps,
} from './core/primitives';
export type {
  MediaHandle,
  VideoHandle,
  AudioHandle,
  MediaInfo,
  MediaTime,
  PlaybackProps,
  VideoOwnProps,
  AudioOwnProps,
} from './core/media';
export type {
  AudioItem,
  MediaPlaylistProps,
  PdfItem,
  PlaylistChange,
  PlaylistHandle,
  PlaylistItem,
  PlaylistProps,
  VideoItem,
} from './core/playlist';
export type {
  DatePickerDisplay,
  DatePickerMode,
  DatePickerOwnProps,
} from './core/datePicker';
export { prefetchImages, clearImageCache } from './core/image';
export type {
  ClearImageCacheOptions,
  ImageCachePolicy,
  ImageCacheType,
  ImageContentFit,
  ImageContentPosition,
  ImageErrorEvent,
  ImageHandle,
  ImageLoadEvent,
  ImageOwnProps,
  ImagePriority,
  ImageProgressEvent,
  ImageSource,
  ImageSourceInput,
  ImageZoomEvent,
  ImageZoomOptions,
  PrefetchOptions,
} from './core/image';
export type { ModalAnimation, ModalOwnProps, ModalPresentation } from './core/modal';
export type {
  BottomSheetHandle,
  BottomSheetOwnProps,
  SheetDetent,
  SheetDetentChange,
} from './core/sheet';
export type {
  CameraCode,
  CameraCodeType,
  CameraFacing,
  CameraFlash,
  CameraHandle,
  CameraOwnProps,
  CameraPermission,
  CameraPermissionStatus,
  CameraPhoto,
  CameraVideo,
  TakePhotoOptions,
} from './core/camera';
export type {
  PdfDirection,
  PdfFit,
  PdfHandle,
  PdfLoadInfo,
  PdfOwnProps,
  PdfPageInfo,
  PdfSearchInfo,
} from './core/pdf';
export { useTheme, updateTheme, getTheme } from './theme';

/**
 * SSR (web): CSS gerado até agora, para injetar num `<style>` do servidor.
 * Em plataformas que não geram CSS (mobile) retorna `''`.
 */
export const getStyleText = (): string => getProvider().getStyleText?.() ?? '';

// EngineTheme é um tipo global (src/theme/theme.d.ts); o alias local evita o
// erro do Babel "Export 'EngineTheme' is not defined" ao reexportar um global.
type EngineThemeAlias = EngineTheme;
export type { EngineThemeAlias as EngineTheme };
