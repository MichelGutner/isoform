import type { PlatformAdapter } from '../core/adapter';
import { warnOnce } from '../core/dev';
import { updateTheme } from '../theme/store';

/**
 * Built-in platform providers.
 * - `'react-native'`: iOS and Android, through React Native (picked by Metro).
 * - `'react'`: the web, through React DOM (picked by Vite, Next, webpack…).
 */
export type ProviderName = 'react-native' | 'react';

/** Options of `configure()`. Call it once, when the app starts, before the first render. */
export interface ConfigureOptions {
  /**
   * Which platform to render with.
   * - `'auto'` (default): the provider the bundler included (React Native on Metro, React DOM on Vite/Next/webpack).
   * - `'react-native'` | `'react'`: explicit; throws a clear error if it does not match the bundle.
   * - a `PlatformAdapter`: a custom platform.
   */
  provider?: 'auto' | ProviderName | PlatformAdapter;
  /** The theme (colors, spacing, typography…). Shortcut for `updateTheme(theme)`. */
  theme?: Partial<EngineTheme>;
  /**
   * Minimum widths (px) of the breakpoints used by `when('breakpoints:md')` and friends.
   * Mobile-first: a rule applies when the screen is at least that wide.
   * Replaces the whole set. Default `{ sm: 480, md: 768, lg: 1024, xl: 1280 }`.
   * To type new names, augment `OmniBreakpointNames`.
   */
  breakpoints?: Record<string, number>;
  /** Settings of the CSS → React Native conversion. */
  native?: {
    /** Pixel size of `1rem` (and the fallback for `em`) on native. Default `16`. */
    remBase?: number;
  };
  /**
   * Optional modules. **All off by default.** The recommended way is an
   * `omnistyle.config.json` at the app root, passed here:
   * ```ts
   * // omnistyle.config.json → { "modules": { "video": true, "audio": { "enabled": true, "mediaSession": true }, "pdf": true } }
   * import omnistyle from './omnistyle.config.json';
   * configure({ modules: omnistyle.modules });
   * ```
   * The same file drives the build: Gradle and CocoaPods only compile the
   * enabled modules, and `omnistyle/metro` removes the disabled ones from the
   * JS bundle. On the web, a disabled module's code is never downloaded.
   */
  modules?: OmniModules;
}

/** Options every optional module accepts when it is turned on with an object. */
export interface ModuleOptions {
  /** Turns the module on. Default `false`: an object without `enabled: true` leaves it off. */
  enabled?: boolean;
}

/** Options of the `audio` module. */
export interface AudioModuleOptions extends ModuleOptions {
  /**
   * Background audio with system controls: Android foreground service and media
   * notification (Media3 `MediaSession`), iOS lock screen / Control Center
   * (`MPNowPlayingInfoCenter`). **Build-time only**: Gradle and CocoaPods read it
   * from `omnistyle.config.json`; it is ignored in JS. Only applies when `enabled` is `true`.
   * Extra app setup: Android 13+ runtime `POST_NOTIFICATIONS` permission to show the
   * notification. (On iOS the build adds `UIBackgroundModes` → `audio` to Info.plist.)
   * Default `false`.
   */
  mediaSession?: boolean;
}

/** Options of the `pdf` module. */
export interface PdfModuleOptions extends ModuleOptions {
  /**
   * Web only: URL of the pdf.js worker (`pdfjs-dist/build/pdf.worker.min.mjs`,
   * copied to your public folder, same `pdfjs-dist` version). With it, PDFs are
   * parsed in a background thread; without it (default) they are parsed on the
   * main thread, which needs no setup but can stutter on very large files.
   */
  workerSrc?: string;
}

/**
 * The lib's optional modules. Every one is off unless turned on, either with
 * `true` or with an object (`{ enabled: true, ...options }`).
 */
export interface OmniModules {
  /**
   * `engine('Video')`: a video player. Web: `<video>` with the lib's controls
   * (loaded on demand). iOS: AVPlayer. Android: Media3 ExoPlayer with Jetpack Compose controls.
   * Default `false`.
   */
  video?: boolean | ModuleOptions;
  /**
   * `engine('Audio')`: an audio player with title, artist and cover. Web: `<audio>`
   * with the lib's controls (loaded on demand). iOS: AVPlayer with a UIKit card.
   * Android: Media3 ExoPlayer with Jetpack Compose controls.
   * Use an object for options: `{ enabled: true, mediaSession: true }`.
   * Default `false`.
   */
  audio?: boolean | AudioModuleOptions;
  /**
   * `engine('Pdf')`: a PDF viewer with search and highlighted matches, thumbnails,
   * zoom, links, password prompt and night mode. Web: pdf.js (`pdfjs-dist`, loaded on
   * demand). iOS: PDFKit. Android: the system `PdfRenderer` with Jetpack Compose
   * (a basic viewer, without search and links, on Android older than 12).
   * Use an object for options: `{ enabled: true, workerSrc: '/pdf.worker.min.mjs' }`.
   * Default `false`.
   */
  pdf?: boolean | PdfModuleOptions;
  /**
   * `engine('BottomSheet')`: a panel that slides up from the bottom, with detents,
   * drag, backdrop and the platform's own feel. Web: a native `<dialog>` (top layer,
   * focus trap, Escape). iOS: a SwiftUI sheet (`presentationDetents`). Android: a
   * Jetpack Compose sheet. The content is regular omnistyle/React Native children.
   * Default `false`.
   */
  sheet?: boolean | ModuleOptions;
  /**
   * SVG primitives (`engine('Svg')`, `'Path'`, `'Circle'`, `'SvgLinearGradient'`…), styled
   * like any other primitive (`fill`, `stroke`, `strokeWidth` in the style, from the theme).
   * Web: the browser's own `<svg>` elements (no dependency). iOS and Android:
   * [`react-native-svg`](https://github.com/software-mansion/react-native-svg), which the
   * app installs only when this module is on (`npx expo install react-native-svg`).
   * Default `false`.
   */
  svg?: boolean | ModuleOptions;
}

/** Name of an optional module (`'video'` | `'audio'` | `'pdf'` | `'sheet'` | `'svg'`). */
export type ModuleName = keyof OmniModules;

/** Whether a module setting (`true`, or `{ enabled: true }`) turns the module on. */
const isOn = (setting: boolean | ModuleOptions | undefined): boolean =>
  setting === true || (typeof setting === 'object' && setting !== null && setting.enabled === true);

/** Default state of every optional module (all off). */
export const DEFAULT_MODULES: Readonly<OmniModules> = { video: false, audio: false, pdf: false, sheet: false, svg: false };
let modules: OmniModules = { ...DEFAULT_MODULES };

/** The adapter the bundler picked (through `providers/index(.native).ts`). */
let bundled: PlatformAdapter | null = null;
/** The adapter explicitly chosen by `configure`. */
let active: PlatformAdapter | null = null;
let used = false;
let remBase = 16;

/** Default breakpoint widths, in px (mobile-first minimums). */
export const DEFAULT_BREAKPOINTS: Readonly<Record<string, number>> = { sm: 480, md: 768, lg: 1024, xl: 1280 };
let breakpoints: Record<string, number> = { ...DEFAULT_BREAKPOINTS };

/** Names that already mean something else in `when()` and cannot be breakpoints. */
const RESERVED = new Set(['ios', 'android', 'web', 'native', 'hover', 'focus', 'focus-visible', 'pressed']);

/** Called by the `providers/*` modules on import. Not public API. */
export function registerBundledProvider(adapter: PlatformAdapter): void {
  bundled = adapter;
}

/** Resets the provider and the configuration. Tests only. */
export function resetProvider(): void {
  bundled = null;
  active = null;
  used = false;
  remBase = 16;
  breakpoints = { ...DEFAULT_BREAKPOINTS };
  modules = { ...DEFAULT_MODULES };
}

/** Whether the module was turned on with `configure({ modules })`. */
export const isModuleEnabled = (name: ModuleName): boolean => isOn(modules[name]);

/** Web: the pdf.js worker URL from `modules.pdf.workerSrc` (`undefined` when not set). */
export const pdfWorkerSrc = (): string | undefined => {
  const setting = modules.pdf;
  return typeof setting === 'object' && setting !== null ? setting.workerSrc : undefined;
};

/**
 * The active platform adapter (the one chosen by `configure`, or the bundled one).
 * Marks the provider as in use, so a later `configure()` that switches it warns.
 */
export function getProvider(): PlatformAdapter {
  const provider = peekProvider();
  used = true;
  return provider;
}

/** Like `getProvider`, but without marking the provider as in use (for import-time definitions). */
export function peekProvider(): PlatformAdapter {
  const provider = active ?? bundled;
  if (!provider) {
    throw new Error(
      '[omnistyle] nenhum provedor disponível. Importe `omnistyle` (o bundler escolhe o provedor) ' +
        'ou chame configure({ provider: <adapter> }).',
    );
  }
  return provider;
}

/** Runtime settings read by the adapters. */
export function getConfig(): { native: { remBase: number } } {
  return { native: { remBase } };
}

/** The active breakpoints (name → minimum width in px). */
export function getBreakpoints(): Readonly<Record<string, number>> {
  return breakpoints;
}

/**
 * Configures omnistyle: provider, theme, breakpoints, native conversion and
 * optional modules. Call it once, when the app starts, before the first render.
 *
 * @example
 * configure({ theme: tokens, modules: { video: true } });
 */
export function configure(options: ConfigureOptions = {}): void {
  const { provider = 'auto', theme, native, breakpoints: bps, modules: enabled } = options;

  let next: PlatformAdapter;
  if (typeof provider === 'object') {
    next = provider;
  } else if (provider === 'auto') {
    if (!bundled) {
      throw new Error('[omnistyle] provider "auto" sem provedor no bundle. Passe um adapter.');
    }
    next = bundled;
  } else {
    if (!bundled || bundled.name !== provider) {
      const available = bundled ? `"${bundled.name}"` : 'nenhum';
      throw new Error(
        `[omnistyle] provider "${provider}" não está disponível neste bundle (disponível: ${available}). ` +
          `Use "auto" ou o provider que a plataforma atual carrega.`,
      );
    }
    next = bundled;
  }

  if (used && next !== (active ?? bundled)) {
    warnOnce(
      'configure-after-render',
      'configure() trocou o provedor depois do primeiro render. Chame configure() uma vez, no boot do app.',
    );
  }
  active = next;

  if (bps) {
    for (const [name, min] of Object.entries(bps)) {
      if (!/^[A-Za-z_][\w-]*$/.test(name)) {
        throw new Error(`[omnistyle] nome de breakpoint inválido: "${name}" (use letras, números, _ ou -).`);
      }
      if (RESERVED.has(name)) {
        throw new Error(`[omnistyle] "${name}" não pode ser nome de breakpoint (já é uma condição de when()).`);
      }
      if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) {
        throw new Error(`[omnistyle] breakpoint "${name}" precisa de uma largura mínima em px (número >= 0).`);
      }
    }
    breakpoints = { ...bps };
  }

  if (native?.remBase !== undefined) remBase = native.remBase;
  if (enabled) modules = { ...DEFAULT_MODULES, ...enabled };
  if (theme) updateTheme(theme);
}
