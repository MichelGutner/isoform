## [0.2.0](https://github.com/MichelGutner/isoform/compare/v0.1.0...v0.2.0) (2026-11-22)

### Features

* animate SVG shapes with transition on iOS and Android ([#29](https://github.com/MichelGutner/isoform/issues/29)) ([12c777d](https://github.com/MichelGutner/isoform/commit/12c777d9add68185b5a4e260af65276f024eacdd))
* gestures module, [secure] switch flash fix, sheet and showcase fixes ([#28](https://github.com/MichelGutner/isoform/issues/28)) ([16ac60c](https://github.com/MichelGutner/isoform/commit/16ac60ce4d21f7756e3ad88d63127cc5d4345c02))
* per-request server [secure]s (runWithTheme), SVG transitions and tighter core types ([#30](https://github.com/MichelGutner/isoform/issues/30)) ([76b72ef](https://github.com/MichelGutner/isoform/commit/76b72ef1e5578b0151a78f5ac32aeeb7f1da3686))

### Bug Fixes

* hydrate runWithTheme renders with [secure]Variables on ([#31](https://github.com/MichelGutner/isoform/issues/31)) ([436bc2f](https://github.com/MichelGutner/isoform/commit/436bc2f11de43da1b9b649aac247180f553b6132))
* name the podspec [secure]-isoform.podspec so iOS autolinking finds it ([#27](https://github.com/MichelGutner/isoform/issues/27)) ([6fe55be](https://github.com/MichelGutner/isoform/commit/6fe55bea0b76577ca3b08021ed741f308ab63556))
* pin the changelog preset to 9.3.1 so semantic-release can render notes ([#32](https://github.com/MichelGutner/isoform/issues/32)) ([181b5b1](https://github.com/MichelGutner/isoform/commit/181b5b18ac53c2537c24a913af3c31c84ac32ecc))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — a theme per server request
- `react-isoform/server` exports `runWithTheme(theme, render)`: everything the render produces (styled components, `useTheme()`, `getTheme()` inside a rule) uses that theme, without a provider and without touching the global store. Before, the only theme was the global one, so two requests rendering with different themes at the same time could receive each other's (reproduced with two interleaved streaming renders). Node only (`AsyncLocalStorage`); browser and React Native bundles do not include it. On the client, call `updateTheme(sameTheme)` before `hydrateRoot`. With `themeVariables` on, a request compiles to the same `var(--iso-…)` classes as the client (no hydration mismatch), and `getStyleText()` called inside `runWithTheme` returns that request's `:root` values.

### Changed

- Errors and development warnings are now written in English (they were Portuguese). The ones that need more than the text to fix carry a stable code, `ISO001` to `ISO012`, documented in [Troubleshooting](https://isoform-kappa.vercel.app/recipes/troubleshooting/). Code that matched the old Portuguese text must be updated. The accessibility labels of the video player are unchanged.
- **BREAKING:** package renamed from `@michelgutner/isoform` to `react-isoform`. Update the dependency, every `import ... from '@michelgutner/isoform'` (including `/metro`, `/babel`, `/jsx-runtime`), `jsxImportSource` and the Babel plugin path. The Android module is now `:react-isoform`.

### Added — rendering without the wrapper (optional JSX runtime)
- `@michelgutner/isoform/jsx-runtime` (and `/jsx-dev-runtime`), selected with `jsxImportSource: '@michelgutner/isoform'`: a styled component whose style never reads the theme is created directly as the component underneath, with its final props. No extra component and no hook per element. Measured on an Android phone, 300 list cells re-rendered in the same time as plain `View`s (they took 37% longer with the wrapper).
- `@michelgutner/isoform/babel`: marks the style functions that provably cannot read the theme (`({ props })`, `(ctx) => ctx.props…`), so they qualify too. `themeFree()` marks a function by hand.
- `configure({ performance: { inline: false } })` keeps every wrapper.
- The package root exports `createElement`, which JSX compilers import from the `jsxImportSource` root.

### Performance
- Dynamic styles are cached by the props the rules actually read: a `testID`, an `onPress` closure or `children` that change no longer recompile the style. Values are hashed by type (`1` and `"1"` differ), and objects and functions by identity (an object prop that changes is followed).
- A theme switch only re-renders and recompiles the components whose style read the theme, on every platform; `getTheme()` inside a rule counts as a read. Returning to a theme already seen (light ↔ dark) reuses its cached styles.
- Web: `configure({ performance: { themeVariables: ['color'] } })` exposes those theme tokens as CSS variables, so a switch rewrites one `:root` rule and re-renders nothing that only reads them.
- React Native breakpoints share one `Dimensions` listener and re-render a component only when the active range changes, not on every pixel of width.
- Web: the playlist player and the modal are loaded in their own chunk the first time they render, like the sheet, camera and players already were (initial bundle about 20% smaller).
- A development warning names a component whose style keeps seeing more than 300 combinations of the props it reads (values that belong in `style`).

### Changed
- `pdfjs-dist` is now an optional peer dependency (it was a 45 MB dependency of every install). Install it only for the `pdf` module on the web; a clear error says so when it is missing.

### Added — `Image` pipeline (optional `image` module)
- With the module on, `engine('Image')` becomes the lib's own picture, with the same pipeline design on iOS (URLSession, ImageIO, CoreImage) and Android (React Native's OkHttp, `ImageDecoder`) and no extra dependency. It keeps a memory cache and a 300 MB disk cache. A download is shared by the views that show the same picture and cancelled when no view waits for it. Pictures are decoded at the size on screen with the EXIF orientation applied, and animated GIF/WebP/APNG play with their own frame delays. Web: `<img>` with the same props.
- `contentFit` / `contentPosition` (the CSS names), `blurhash` and `placeholder`, crossfade `transition`, `tintColor`, `blurRadius`, `cachePolicy`, `priority`, `autoplay`, `src` with `headers` and `cacheKey`, and the events `onLoadStart`, `onProgress`, `onLoad` (`cacheType`) and `onError`.
- Viewer gestures: `zoomable` (pinch, drag while zoomed, double tap), `maxZoom`, `doubleTapZoom`, `rotatable` and `onZoomChange`. Inside scroll views they take over only while zoomed or with two fingers. On the web: pointers, ctrl + wheel and double click.
- `ref` (`ImageHandle`): `zoomTo`, `resetZoom`, `rotateTo`, `play`, `pause`, `reload`. New exports: `prefetchImages` and `clearImageCache` (a TurboModule on native; the lib's codegen is now `type: "all"`).
- With the module off, `Image` stays React Native's `Image` and a plain `<img>`, which still apply `contentFit`, `tintColor` and `blurRadius`.

### Added — `Modal` (optional `modal` module)
- With the module on, `engine('Modal')` becomes the lib's own modal, with the same design on iOS (UIKit), Android (Jetpack Compose) and the web (a native `<dialog>`). It is a centered dialog as tall as its content, or `presentation="fullScreen"` with the content in the safe area. Animations: `'scale'`, `'slide'`, `'fade'` or `'none'`. It has a backdrop (`backdropColor`), keyboard avoidance, a focus trap, `dismissible` (backdrop, back button, Escape, VoiceOver escape) and `onClosed`.
- Controlled with `open` / `onOpenChange`. The style's `backgroundColor`, `borderRadius` and `width`/`maxWidth` go to the card; the rest goes to the content. React Native's `visible`, `onRequestClose` and `animationType` still work (deprecated).
- With the module off, `Modal` stays React Native's `Modal` (written the old way it is passed through untouched). `Modal` now also exists on the web, with the module on.

### Added — `DatePicker` (optional `datePicker` module)
- `engine('DatePicker')`: a date, a time or both. iOS (SwiftUI) and Android (Jetpack Compose) draw the lib's own picker with the same design: a calendar with a month/year panel, wheels that snap and tick (a real nested scroll view on iOS, so they work inside scroll views), and compact pills that open a bottom sheet. Web: the browser's `<input type="date | time | datetime-local">`.
- Controlled `value` / `onValueChange` (already clamped to `minimumDate` / `maximumDate`), `mode`, `display` (`'inline'`, `'wheel'`, `'compact'`), `locale`, `is24Hour`, `tintColor`, `disabled`, `label`. The native view takes the natural height the picker reports.
- Turned on with `"datePicker": { "enabled": true }` in `isoform.config.json` (Gradle, CocoaPods and Metro leave it out otherwise).

### Added — `Camera` (optional `camera` module)
- `engine('Camera')`: the camera preview with the app's own interface on top (children are drawn over it). Android: CameraX 1.6 with the Jetpack Compose viewfinder (`CameraXViewfinder`); iOS: AVFoundation; web: `getUserMedia`.
- Photos (`takePhoto`, flash, zero shutter lag where supported), torch, zoom with pinch (`onZoomChange`; `0.5` is the ultra wide where there is one), tap to focus, front/back, `active` to pause.
- Sub-options that only enter the app when on: `camera.video` (recording with sound: CameraX `VideoCapture`, movie output, `MediaRecorder`) and `camera.codeScanner` (`onCodeScanned`: ML Kit, `AVCaptureMetadataOutput`, `BarcodeDetector`).
- Permissions asked automatically, with `onPermissionChange` and a notice (`permissionMessage`, `permissionButtonLabel`) that asks again or opens the settings. The iOS build adds `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` when missing; the Android manifest adds `CAMERA` / `RECORD_AUDIO`.
- iOS 17+: rotation coordinator and responsive capture; iOS 18: Camera Control zoom slider.
- Android: the lib's manifest is now generated from the enabled modules (so `mediaSession` and the camera permissions can be combined).

### Added — SVG (optional `svg` module)
- Every SVG element is a primitive: `Svg`, `G`, `Path`, `Circle`, `Rect`, `Ellipse`, `Line`, `Polyline`, `Polygon`, `TSpan`, `Defs`, `Stop`, and, where the name clashes, `SvgText`, `SvgImage`, `SvgLinearGradient`, `SvgRadialGradient`, `SvgClipPath`, `SvgMask`, `SvgPattern`, `SvgSymbol`, `SvgUse`.
- Presentation properties (`fill`, `stroke`, `strokeWidth`, `stopColor`…) go in the style, so they follow the theme and `when()`. Web: the browser's own SVG elements, styled with classes. iOS/Android: `react-native-svg`, with the style turned into the element's props.
- Turned on with `"svg": { "enabled": true }` in `isoform.config.json`. `react-native-svg` is an optional peer dependency the app installs only for this module; `isoform/metro` leaves the SVG code out of the bundle when it is off and stops with a clear message when it is on but the package is missing.

### Added — `BottomSheet` (optional `sheet` module)
- `engine('BottomSheet')`: the platform's own sheet. Web: a native `<dialog>` with drag and snapping; iOS: SwiftUI `.sheet` with `presentationDetents` (Liquid Glass on iOS 26); Android: a Jetpack Compose sheet. The content is regular components.
- Detents (`'fit'`, `'full'`, `'40%'`, a height), `detent` + `onDetentChange`, `dismissible`, non-modal sheets (`modal={false}`), `grabber`, `onClosed`, `label`, and `ref.snapTo(index)`.
- Turned on with `"sheet": { "enabled": true }` in `isoform.config.json` (Gradle, CocoaPods and Metro leave it out otherwise).
- `engine('Video' | 'Audio' | 'Pdf' | 'BottomSheet')` now types its `ref` with the primitive's handle (`VideoHandle`, `BottomSheetHandle`…).

### Added — multi-platform (React + React Native)
- **The package is now `isoform`** and runs on both React Native and React DOM from a single entry. Write a component once, use it on web and mobile.
- **`configure({ provider, theme, native })`**: choose the platform once at startup, like `updateTheme`. `provider` is `'auto'` (default), `'react-native'`, `'react'` or a custom `PlatformAdapter`. `theme` is a shortcut for `updateTheme`.
- **Platform selection by the bundler**: `providers/index.native.ts` (Metro iOS/Android) registers the React Native adapter; `providers/index.ts` (Vite, webpack, Next, Metro-web) registers the React DOM adapter. A web bundle never contains `react-native`.
- **Neutral primitives**: `Box`, `Text`, `Pressable`, `Input`, `Image`, `Scroll`. Primitive names are resolved at render time, so components can be defined before `configure()` runs.
- **Unified style vocabulary**: full CSS (`React.CSSProperties`) — number = px, string = CSS value (`rem`, `em`, `vh`, `%`, `calc()`…). React Native receives converted values; web-only CSS is dropped with one dev warning.
- **React DOM adapter** with atomic CSS (deduplicated classes, rank-ordered so shorthands never beat longhands), RN-like primitive defaults, props translation (`onPress`, `onChangeText`, `testID`, `accessibility*`…) and per-element prop filtering.
- **`getStyleText()`** for SSR on the web.
- **`when('native')`** (any non-web platform) alongside `'ios' | 'android' | 'web'`.
- **Interaction states**: `when('hover' | 'focus' | 'focus-visible' | 'pressed')`. Web: `:hover` (inside `@media (hover: hover)`), `:focus`, `:focus-visible`, `:active`. Mobile: `pressed` on `Pressable`, `focus` on `Input`, `hover` ignored.
- **Breakpoints**: `when('sm' | 'md' | 'lg' | 'xl')`, mobile-first (`min-width`), configurable with `configure({ breakpoints })` (defaults 480 / 768 / 1024 / 1280). Web: real `@media (min-width)` rules (no JS, SSR-friendly). Mobile: a host that follows the window width, only for components that use breakpoints.
- **Breakpoint ranges**: `when('<md')` (below) and `when('sm..lg')` (≥ sm and < lg, upper bound exclusive), next to the mobile-first `when('md')`.
- **Pseudo-elements**: `when('::before' | '::after' | '::placeholder' | '::selection' | '::first-letter')` on both platforms (mobile: generated children, `Input` props, nested `Text`), and `'::first-line' | '::marker' | '::scrollbar' | '::scrollbar-thumb' | '::scrollbar-track'` on the web (typed `WebOnlyPseudoName`, `@platform web`; ignored with a dev warning on mobile). `content` is quoted automatically on the web.
- **`transition` on mobile**: the CSS `transition` shorthand and longhands animate style changes from props, `pressed`/`focus` and breakpoints, with `Animated` (colors, numbers, matching strings, transforms; resumes interrupted transitions).
- `onPressIn`/`onPressOut` on `Pressable` work on both platforms (pointer events on the web).
- **`keyframes()` + CSS `animation`**: one declaration, two runtimes. Web emits real `@keyframes`; mobile plays them with `Animated` (shorthand and longhands, `from`/`to`/`N%`, easings incl. `cubic-bezier()`/`steps()`, delay, iterations, direction, fill mode, play state; native driver for `opacity`/`transform`). Inline frames in `animationName` are supported.
- `keyframes()` is provider-independent (a core registry); adapters materialize the animation lazily when a style that uses it is compiled. `PlatformAdapter` gained the optional `resolveComponent`, and `compileStyle` receives the state and breakpoint variants.
- `StyleFn` now returns an object style type, so literals such as `flexDirection: 'row'` are no longer widened to `string` when `engine('Box', ({ theme }) => ({ … }))` infers the primitive name (covered by `src/core/engine.types.test.ts`).
- `when('focus')` on `Input` is now tracked by the shared style host (no more dedicated `TextInput` wrapper), so `focus` changes can be transitioned and combine with breakpoints.
- Web primitives default to `border-style: solid; border-width: 0`, matching React Native's border model.
- `extend()` is now part of the public component type.
- Example apps: `examples/showcase` (an interactive showcase with one page per feature: theme, components, states, responsive, animations, platform, Video, Audio, Pdf), the Expo app (`example/`) and a Vite + React DOM app (`example-web/`) render the same pages.

### Changed
- **BREAKING:** package renamed from `react-native-stylized` to `@michelgutner/isoform`; the `/react-native` subpath export was removed — import everything from the root.
- `react-native` peer dependency is now `>=0.76` and optional, alongside optional `react-dom` (props such as `paddingInline` and `boxShadow` need RN ≥ 0.76).
- The core, theme, cache and hash modules no longer import `react-native`; only the adapters do (enforced by `src/boundaries.test.ts`).
- `StyleSheet.flatten` replaced by a platform-independent `flattenStyle`.
- Removed an unused, duplicated runtime `engine` implementation that lived in the old `types.ts`.
- Build output no longer includes test and benchmark files.

### Fixed
- `em` on `fontSize` is resolved against the parent size (the base) on mobile, as in CSS; it used to be resolved against itself.
- **`when('key:value', ...)` conditions now require an exact match.** Previously the value was matched with `String(props[key]).includes(value)`, a substring check — e.g. `when('status:active', ...)` incorrectly matched `props.status === 'inactive'`. This is a behavior change: conditions that relied on partial/substring matches must be updated to match the full prop value.

### Performance
- Added a static fast path for `stylized`/`engine` components whose rules don't depend on props (no function styles/attrs, no prop-based `when` conditions) — these now skip per-render prop hashing and cache lookups entirely.
- Removed `useMemo` wrappers in the render path that never actually memoized (their dependency array included `props`, a new reference every render) and added no benefit beyond the internal style cache.
- Chained builder calls (`.style().when().attrs()`) no longer rebuild the underlying component on every hop — only one component is built per definition.
- Built components now get a `displayName` (e.g. `Stylized(View)`) for easier identification in React DevTools.

### Added
- Initial release of stylized
- **React Native styling engine** with conditional styling
- **React Web styling engine** with CSS properties support
- **Global theme system** without providers
- **TypeScript support** with full autocomplete
- **Method chaining API** with `.style()`, `.when()`, and `.attrs()`
- **Performance optimizations** with caching
- **Platform-specific styling** support
- **Cross-platform compatibility** (React & React Native)
- **Comprehensive documentation** and examples

### Features
- **Conditional Styling**: Apply styles based on props, platform, or custom conditions
- **Global Theme**: Access theme anywhere without providers
- **Type Safety**: Full TypeScript support with autocomplete for all methods
- **Performance**: Optimized caching and minimal re-renders
- **React Native Support**: Built-in support for all React Native components
- **React Web Support**: Built-in support for all HTML elements and CSS properties
- **Unified API**: Same API works for both React and React Native

### Platform Support
- **React Native**: `import { engine } from 'stylized/react-native'`
  - All React Native components
  - Native style properties
  - Platform-specific styling
- **React Web**: `import { engine } from 'stylized/web'`
  - All HTML elements
  - CSS properties
  - Responsive design support

### API
- `engine(component, style?)` - Create styled components
- `.style(styleOrFn)` - Apply styles with theme support
- `.when(condition, attrs)` - Apply conditional attributes
- `.attrs(attrs)` - Apply static attributes
- `useTheme()` - Access current theme
- `updateTheme(theme)` - Update global theme
- `getTheme()` - Get current theme value

### TypeScript
- Full autocomplete for `.when()` conditions
- Platform unions: `'ios' | 'android' | 'web'`
- Prop condition generation from component interfaces
- Global `EngineTheme` interface for type extension
- Type-safe CSS properties for web
- Type-safe React Native styles for mobile

### Examples
- React Native components with conditional styling
- React web components with CSS properties
- Theme integration across platforms
- Responsive design patterns
- Complex conditional logic
