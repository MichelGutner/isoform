import type { PlatformAdapter } from '../core/adapter';
import { warnOnce } from '../core/dev';
import { getTheme, themeStore, updateTheme } from '../theme/store';
import { themeCss, variablesOf } from '../theme/variables';

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
   * To type new names, augment `IsoBreakpointNames`.
   */
  breakpoints?: Record<string, number>;
  /**
   * Performance switches. Defaults are right for almost every app.
   */
  performance?: {
    /**
     * With the isoform JSX runtime (`jsxImportSource: 'react-isoform'`), render a styled component
     * whose style never reads the theme as the component underneath directly (`<View style={…}>`), with
     * no wrapper component in between (default `true`). Set it once, at startup: switching it later
     * remounts those components. Without the JSX runtime it has no effect.
     */
    inline?: boolean;
    /**
     * Web only. Top-level theme keys whose values are CSS-ready strings (`['color']` for `theme.color.bg`).
     * Their tokens reach the style rules as `var(--iso-color-bg)`, and the real values live in one
     * `:root` rule: a theme switch rewrites that rule instead of recompiling and re-rendering every
     * component whose styles only read those tokens.
     *
     * The style must only pass those values through (`backgroundColor: theme.color.bg`, or inside a template
     * string). Computing with them (`theme.color.bg + '80'`) would see a `var(...)` text. Numbers and other keys
     * stay real values, and a style that reads one keeps depending on the theme. Define the tokens up front
     * (in `configure({ theme })`): a token added later is not seen by styles already compiled.
     * Ignored (with a development warning) on platforms without CSS variables. Default: off.
     */
    themeVariables?: readonly string[];
  };
  /** Settings of the CSS → React Native conversion. */
  native?: {
    /** Pixel size of `1rem` (and the fallback for `em`) on native. Default `16`. */
    remBase?: number;
  };
  /**
   * Optional modules. **All off by default.** The recommended way is an
   * `isoform.config.json` at the app root, passed here:
   * ```ts
   * // isoform.config.json → { "modules": { "video": true, "audio": { "enabled": true, "mediaSession": true }, "pdf": true } }
   * import isoform from './isoform.config.json';
   * configure({ modules: isoform.modules });
   * ```
   * The same file drives the build: Gradle and CocoaPods only compile the
   * enabled modules, and `react-isoform/metro` removes the disabled ones from the
   * JS bundle. On the web, a disabled module's code is never downloaded.
   */
  modules?: IsoModules;
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
   * from `isoform.config.json`; it is ignored in JS. Only applies when `enabled` is `true`.
   * Extra app setup: Android 13+ runtime `POST_NOTIFICATIONS` permission to show the
   * notification. (On iOS the build adds `UIBackgroundModes` → `audio` to Info.plist.)
   * Default `false`.
   */
  mediaSession?: boolean;
}

/** Options of the `camera` module. Each feature only enters the app when it is on. */
export interface CameraModuleOptions extends ModuleOptions {
  /**
   * Video recording (`startRecording`): CameraX `VideoCapture` on Android, the movie
   * output on iOS, `MediaRecorder` on the web. Adds the microphone permission
   * (Android manifest, iOS `NSMicrophoneUsageDescription`). Default `false`.
   */
  video?: boolean;
  /**
   * Code scanner (`onCodeScanned`): ML Kit barcode scanning on Android (bundled model,
   * about 2.4 MB), `AVCaptureMetadataOutput` on iOS, `BarcodeDetector` on the web
   * (Chromium browsers). Default `false`.
   */
  codeScanner?: boolean;
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
export interface IsoModules {
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
   * Jetpack Compose sheet. The content is regular isoform/React Native children.
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
  /**
   * `engine('Camera')`: the camera preview, photos, video and a code scanner. The app
   * draws its own interface. Android: CameraX with the Jetpack Compose viewfinder.
   * iOS: AVFoundation. Web: `getUserMedia`.
   * Use an object for the extra features: `{ enabled: true, video: true, codeScanner: true }`.
   * Default `false`.
   */
  camera?: boolean | CameraModuleOptions;
  /**
   * `engine('DatePicker')`: pick a date, a time or both. iOS (SwiftUI) and Android
   * (Jetpack Compose): the lib's own picker, the same design on both (calendar, wheels,
   * compact pills with a sheet). Web: the browser's own `<input type="date">`.
   * Default `false`.
   */
  datePicker?: boolean | ModuleOptions;
  /**
   * `engine('Image')` becomes the lib's own image: memory and disk caches, downloads
   * shared between views, progress, decoding at the size on screen, animated GIF/WebP,
   * blurhash placeholders, crossfade, tint and blur, plus `prefetchImages` and
   * `clearImageCache`. iOS (URLSession, ImageIO) and Android (OkHttp, ImageDecoder) run
   * the same pipeline design; no extra dependency. Web: `<img>` with the same props.
   * Off: `Image` stays the platform's plain image.
   * Default `false`.
   */
  image?: boolean | ModuleOptions;
  /**
   * `engine('Modal')` becomes the lib's own modal: a centered dialog or a full-screen
   * cover with spring animations, backdrop, keyboard avoidance and a focus trap. iOS:
   * UIKit. Android: Jetpack Compose. Web: a native `<dialog>`. The content is regular
   * isoform/React Native children.
   * Off: `Modal` stays React Native's `Modal` (native only).
   * Default `false`.
   */
  modal?: boolean | ModuleOptions;
}

/** Name of an optional module (`'video'` | `'audio'` | `'pdf'` | `'sheet'` | `'svg'` | `'camera'` | `'datePicker'` | `'image'` | `'modal'`). */
export type ModuleName = keyof IsoModules;

/** Whether a module setting (`true`, or `{ enabled: true }`) turns the module on. */
const isOn = (setting: boolean | ModuleOptions | undefined): boolean =>
  setting === true || (typeof setting === 'object' && setting !== null && setting.enabled === true);

/** Default state of every optional module (all off). */
export const DEFAULT_MODULES: Readonly<IsoModules> = { video: false, audio: false, pdf: false, sheet: false, svg: false, camera: false, datePicker: false, image: false, modal: false };
let modules: IsoModules = { ...DEFAULT_MODULES };

/** The adapter the bundler picked (through `providers/index(.native).ts`). */
let bundled: PlatformAdapter | null = null;
/** The adapter explicitly chosen by `configure`. */
let active: PlatformAdapter | null = null;
let used = false;
let remBase = 16;
let inline = true;
/** Top-level theme keys exposed as CSS variables, or `null` when the feature is off. */
let themeVariableKeys: readonly string[] | null = null;
let stopThemeVariables: (() => void) | null = null;

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
  inline = true;
  stopThemeVariables?.();
  stopThemeVariables = null;
  themeVariableKeys = null;
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

/** A feature of the `camera` module (`video`, `codeScanner`): on only with the module on and the option `true`. */
export const isCameraFeatureEnabled = (feature: 'video' | 'codeScanner'): boolean => {
  const setting = modules.camera;
  return isOn(setting) && typeof setting === 'object' && setting !== null && setting[feature] === true;
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
      '[isoform] nenhum provedor disponível. Importe `isoform` (o bundler escolhe o provedor) ' +
        'ou chame configure({ provider: <adapter> }).',
    );
  }
  return provider;
}

/** Runtime settings read by the adapters. */
export function getConfig(): { native: { remBase: number } } {
  return { native: { remBase } };
}

/**
 * The theme keys exposed as CSS variables, or `null` when the feature is off. Only meaningful together with an
 * adapter that has `applyThemeVariables` (the builder checks both).
 */
export const getThemeVariableKeys = (): readonly string[] | null => themeVariableKeys;

/** Keeps the `:root` variables in step with the theme: once now, then on every change. */
function syncThemeVariables(adapter: PlatformAdapter, keys: readonly string[]): void {
  stopThemeVariables?.();
  const write = () => adapter.applyThemeVariables?.(themeCss(variablesOf(getTheme(), keys)));
  write();
  stopThemeVariables = themeStore.subscribe(write);
}

/** Whether the JSX runtime may render theme-free styled components without their wrapper (see `configure({ performance })`). */
export const isInlineEnabled = (): boolean => inline;

/** The active breakpoints (name → minimum width in px). */
export function getBreakpoints(): Readonly<Record<string, number>> {
  return breakpoints;
}

/**
 * Configures isoform: provider, theme, breakpoints, native conversion and
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
      throw new Error('[isoform] provider "auto" sem provedor no bundle. Passe um adapter.');
    }
    next = bundled;
  } else {
    if (!bundled || bundled.name !== provider) {
      const available = bundled ? `"${bundled.name}"` : 'nenhum';
      throw new Error(
        `[isoform] provider "${provider}" não está disponível neste bundle (disponível: ${available}). ` +
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
        throw new Error(`[isoform] nome de breakpoint inválido: "${name}" (use letras, números, _ ou -).`);
      }
      if (RESERVED.has(name)) {
        throw new Error(`[isoform] "${name}" não pode ser nome de breakpoint (já é uma condição de when()).`);
      }
      if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) {
        throw new Error(`[isoform] breakpoint "${name}" precisa de uma largura mínima em px (número >= 0).`);
      }
    }
    breakpoints = { ...bps };
  }

  if (options.performance?.inline !== undefined) inline = options.performance.inline;
  const variableKeys = options.performance?.themeVariables;
  if (variableKeys !== undefined) {
    stopThemeVariables?.();
    stopThemeVariables = null;
    themeVariableKeys = variableKeys.length > 0 ? [...variableKeys] : null;
    if (!themeVariableKeys) next.applyThemeVariables?.(''); // turned off: the `:root` rule goes away with it
    if (themeVariableKeys && !next.applyThemeVariables) {
      warnOnce(
        'theme-variables-unsupported',
        `performance.themeVariables só vale em plataformas com CSS (a web). No provedor "${next.name}" os tokens continuam sendo valores.`,
      );
    }
  }
  if (native?.remBase !== undefined) remBase = native.remBase;
  if (enabled) modules = { ...DEFAULT_MODULES, ...enabled };
  if (theme) updateTheme(theme);
  // depois do tema inicial: as variáveis já nascem com os valores certos, antes do primeiro render
  if (themeVariableKeys && next.applyThemeVariables) syncThemeVariables(next, themeVariableKeys);
}
