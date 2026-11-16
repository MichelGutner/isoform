# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — `BottomSheet` (optional `sheet` module)
- `engine('BottomSheet')`: the platform's own sheet. Web: a native `<dialog>` with drag and snapping; iOS: SwiftUI `.sheet` with `presentationDetents` (Liquid Glass on iOS 26); Android: a Jetpack Compose sheet. The content is regular components.
- Detents (`'fit'`, `'full'`, `'40%'`, a height), `detent` + `onDetentChange`, `dismissible`, non-modal sheets (`modal={false}`), `grabber`, `onClosed`, `label`, and `ref.snapTo(index)`.
- Turned on with `"sheet": { "enabled": true }` in `omnistyle.config.json` (Gradle, CocoaPods and Metro leave it out otherwise).
- `engine('Video' | 'Audio' | 'Pdf' | 'BottomSheet')` now types its `ref` with the primitive's handle (`VideoHandle`, `BottomSheetHandle`…).

### Added — multi-platform (React + React Native)
- **The package is now `omnistyle`** and runs on both React Native and React DOM from a single entry. Write a component once, use it on web and mobile.
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
- **BREAKING:** package renamed from `react-native-stylized` to `omnistyle`; the `/react-native` subpath export was removed — import everything from the root.
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
