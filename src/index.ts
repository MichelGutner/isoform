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
  ConfigureOptions,
  ModuleName,
  ModuleOptions,
  OmniModules,
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
  OmniBreakpointNames,
  BreakpointName,
  BreakpointCondition,
  BreakpointRangeCondition,
  DefaultBreakpointRange,
  PlatformCondition,
  StateCondition,
  PropConditionKeys,
  PseudoName,
} from './core/types';
export type { OmniStyle, StyleInput, LegacyRNStyle } from './core/style/types';
export type {
  OmniPrimitives,
  OmniNativeProps,
  BoxProps,
  TextProps,
  PressableProps,
  InputProps,
  ImageProps,
  ScrollProps,
  VideoProps,
  AudioProps,
  PdfProps,
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
