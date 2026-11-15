# omnistyle

> One styling API for **React** and **React Native**. Write a component once, run it on web and mobile.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```tsx
// showcase/ui.tsx — no react-native, no react-dom, no platform checks
import { engine } from 'omnistyle';

export const Button = engine<'Pressable', { variant?: 'primary' | 'ghost' }>(
  'Pressable',
  ({ theme }) => ({
    paddingBlock: theme.spacing.sm,
    paddingInline: '1.25rem',                  // rem works on both platforms
    borderRadius: 12,
    backgroundColor: theme.color.primary,
    boxShadow: '0 4px 12px rgba(0,0,0,.12)',   // same shadow on both platforms
  }),
)
  .when('props:variant=ghost', { style: { backgroundColor: 'transparent' } })
  .when('platform:web', { style: { cursor: 'pointer', transition: 'opacity .15s' } });
```

The same `Button` renders a `<div role="button">` with atomic CSS classes on the web and a React Native `Pressable` on iOS/Android.

---

## Why

- **One component library** for your web app and your mobile app. No more rebuilding every component twice.
- **One style vocabulary**: standard CSS names and values (`paddingInline`, `boxShadow`, `'1rem'`, `calc()`…) that both platforms understand. Numbers are px; strings are CSS.
- **Full CSS on the web** (grid, `backdrop-filter`, `var()`, `vh`…), with graceful degradation on mobile.
- **Choose the platform once, at startup** — like `updateTheme`. No providers.
- **Global theme**, conditional styling (`when`), `extend`, composition, full TypeScript support, and a style cache.

## Installation

```bash
npm install omnistyle
# or
yarn add omnistyle
```

Peer dependencies: `react >= 18`, plus **one** of:

| Target | Install |
|---|---|
| Web | `react-dom >= 18` |
| Mobile | `react-native >= 0.76` |

## Quick start

**1. One config file, shared by both apps**

```ts
// omni.config.ts
import { configure } from 'omnistyle';

configure({
  provider: 'auto',   // 'auto' | 'react-native' | 'react' | a custom adapter
  theme: {
    color: { background: '#fff', text: '#111', primary: '#6366f1' },
    spacing: { sm: 8, md: 16, lg: 24 },
  },
});
```

Import it once, before rendering: `import './omni.config'` in your app entry (`main.tsx` on Vite, `_layout.tsx` on Expo Router, `index.js` on bare RN).

**2. Build components from neutral primitives**

```tsx
import { engine } from 'omnistyle';

export const Card = engine('Box', ({ theme }) => ({
  padding: theme.spacing.md,
  borderRadius: 16,
  backgroundColor: theme.color.background,
}));

export const Title = engine('Text', ({ theme }) => ({
  fontSize: 22,
  fontWeight: '800',
  color: theme.color.text,
}));
```

**3. Use them anywhere**

```tsx
<Card>
  <Title>Hello, web and mobile</Title>
  <Button onPress={save} aria-label="Save" testID="save">…</Button>
</Card>
```

A complete runnable proof lives in this repo: [`examples/showcase`](./examples/showcase) is rendered by both the Expo app in [`example/`](./example) and the Vite + React DOM app in [`example-web/`](./example-web).

## How the platform is chosen

`configure({ provider })` selects and validates the provider; the **bundler** decides which code ships:

- Metro on iOS/Android loads the React Native adapter (`providers/index.native`).
- Vite, webpack, Next and Metro-web load the React DOM adapter (`providers/index`).

So a web bundle never contains `react-native`, and a mobile bundle never contains the DOM adapter.

| `provider` | Behaviour |
|---|---|
| `'auto'` (default) | Use whatever the bundler included |
| `'react-native'` / `'react'` | Explicit. Throws a clear error if it doesn't match the bundle |
| adapter object | Plug in another platform (see [`PlatformAdapter`](./docs/README.md#custom-providers)) |

Not calling `configure()` at all behaves like `'auto'`.

Components are defined *before* `configure()` runs (imports are hoisted), so `engine('Box')` only stores the primitive's **name**; the real component is resolved at render time by the active provider.

## The omnistyle vocabulary

Rule of thumb: **use the standard CSS / HTML / ARIA name whenever React Native also understands it.**

Two value rules, identical everywhere:

1. **Number = px** (dp on mobile) — except unitless properties (`opacity`, `flex`, `zIndex`, `fontWeight`, `aspectRatio`).
2. **String = a CSS value, exactly as on the web** — `'1rem'`, `'2em'`, `'50%'`, `'100vh'`, `'calc(100% - 16px)'`, `'1.5'` (unitless `lineHeight`), `'0 4px 10px rgba(0,0,0,.1)'`.

On the web strings go straight to CSS. On mobile the adapter converts what it can (`rem`, `em`, `vh`, `vw`, `px`, multi-value `padding`/`margin`, unitless `lineHeight`) and drops what it can't (`calc()`, `var()`, `cursor`, `transition`, grid…) with **one** dev warning per property.

### Style

| Concept | Write | Web | Mobile |
|---|---|---|---|
| Axis spacing | `paddingInline`, `paddingBlock`, `marginInline`, `marginBlock` | mapped to physical sides | native |
| Shadow | `boxShadow: '0 4px 10px rgba(0,0,0,.1)'` | CSS | native (RN ≥ 0.76, new architecture) |
| Transform | `'translateX(10px) rotate(-2deg)'` or the RN array | CSS | native |
| Any other CSS | `cursor`, `transition`, `backdropFilter`, `gridTemplateColumns`… | CSS | ignored (dev warning) |
| RN aliases | `paddingHorizontal`, `shadow*`, `elevation`, `resizeMode` | converted | native |

### Props

| Concept | Write | Web | Mobile |
|---|---|---|---|
| Press | `onPress` | `onClick` + Enter/Space | native |
| Text changed | `onChangeText(text)` | `onChange` → `e.target.value` | native |
| Accessibility | `role`, `aria-*` | DOM | native |
| Test id | `testID` | `data-testid` | native |
| Image | `src`, `alt` | DOM | native |
| Password input | `type="password"` | DOM | `secureTextEntry` |
| Disabled | `disabled` | `aria-disabled` and blocks `onPress` | native |
| Anything else | web: `href`, `id`, `onMouseEnter`, `data-*`… · mobile: `hitSlop`, `onLayout`… | passed to the DOM element if valid for it | passed to the RN component |

> Props that only drive styling (`variant`, `outlined`, `wrap`…) are **not** forwarded to DOM elements, so React never warns about unknown attributes. Valid HTML attributes, `data-*`, `aria-*` and `on*` handlers always pass.

## Primitives

| Name | Web | Mobile |
|---|---|---|
| `Box` | `div` (flex column, RN-like defaults) | `View` |
| `Text` | `span` | `Text` |
| `Pressable` | `div[role=button]`, keyboard accessible | `Pressable` |
| `Input` | `input` / `textarea` (`multiline`) | `TextInput` |
| `Image` | `img` | `Image` |
| `Scroll` | scrollable `div` | `ScrollView` |
| `Video`, `Audio`, `Pdf` | optional players and PDF viewer, see [Optional modules](#optional-modules-video-audio-and-pdf) | native players and viewer |

React Native names (`View`, `TouchableOpacity`, `TextInput`, `ScrollView`…) still work and are marked deprecated. Mobile-only names (`Switch`, `Modal`, `SafeAreaView`, `FlatList`…) work on mobile and throw a clear error on web. You can also wrap any component: `engine(MyComponent, style)`.

## Optional modules: `Video`, `Audio` and `Pdf`

The media players and the PDF viewer are **optional and off by default**, so apps that do not use them pay nothing (no native code, no dependencies, no bundle size). Turn them on in one file, `omnistyle.config.json` at the app root (next to `package.json`), and pass the same file to `configure`:

```json
{
  "modules": {
    "video": { "enabled": true },
    "audio": { "enabled": true, "mediaSession": false },
    "pdf": { "enabled": true }
  }
}
```

Each module takes `true` or an object (`{ "enabled": true, ...options }`), so `"video": true` works too. A module is only on with `true` or `enabled: true`; an object without it stays off.

```ts
import { configure } from 'omnistyle';
import omnistyle from './omnistyle.config.json';

configure({ modules: omnistyle.modules });
```

The same file drives every build, so a disabled module is really left out:

| Where | What the file decides |
|---|---|
| Web (Vite, webpack, Next) | The player is a separate chunk, downloaded only when the module is on and a player renders. |
| Metro (iOS/Android JS) | `withOmnistyle` in `metro.config.js` swaps disabled modules for an empty stub: `const { withOmnistyle } = require('omnistyle/metro'); module.exports = withOmnistyle(getDefaultConfig(__dirname));` |
| Android (Gradle) | Media3, Compose and the module's Kotlin code are only compiled when on. |
| iOS (CocoaPods) | The module's Swift and Objective-C++ are only compiled when on, with an empty shell otherwise. |

On iOS the file is read at `pod install`. If you change it, run `cd ios && pod install`: the build stops with a clear message if the two are out of sync. Without the file, everything is compiled and only `configure` decides at runtime.

| Module | Primitive | Web | iOS | Android |
|---|---|---|---|---|
| `video` | `engine('Video')` | `<video>` with the lib's controls (fullscreen, picture-in-picture, speed) | `AVPlayer` + `AVPlayerViewController` | Media3 + Compose controls |
| `audio` | `engine('Audio')` | `<audio>` with a card player | `AVPlayer` + a UIKit card | Media3 + Compose card |
| `pdf` | `engine('Pdf')` | pdf.js (`pdfjs-dist`) with the lib's toolbar | PDFKit + a UIKit toolbar | system `PdfRenderer` + Compose viewer |

```tsx
const Player = engine('Audio', () => ({ width: '100%' }));

<Player src="https://example.com/episode.mp3" title="Episode 1" artist="My show" artwork="https://example.com/cover.jpg" />
```

Both share the same props (`src`, `autoPlay`, `loop`, `muted`, `rate`, `volume`) and events (`onPlay`, `onPause`, `onEnded`, `onTimeUpdate`, `onLoad`, `onError`, `onSeek`, `onBuffering`, `onBufferedChange`, `onVolumeChange`, `onRateChange`). The `ref` gives `play()`, `pause()` and `seekTo(seconds)`. `Video` adds `poster`, `onFullscreenChange` and `setFullscreen()`; `Audio` adds `title`, `artist` and `artwork`.

### PDF viewer (`pdf`)

```tsx
const Document = engine('Pdf', () => ({ width: '100%', height: 560 }));

<Document
  src="https://example.com/handout.pdf"
  speechLanguage="pt-BR"
  onPageChange={({ page, pageCount }) => console.log(page, pageCount)}
  onSearch={({ query, total, current }) => console.log(query, current, total)}
/>
```

The viewer has its own colorless toolbar: thumbnails, page counter (tap to go to a page), read aloud, search, fullscreen, table of contents and a menu (voice, night mode, fit width/page, download/print on the web, share on iOS).

| Feature | Web | iOS | Android 15+, or 12–14 with system updates | Older Android |
|---|---|---|---|---|
| Pages, scroll, pinch/double-tap zoom, page counter, thumbnails, night mode, fullscreen | ✓ | ✓ | ✓ | ✓ |
| Search with every match highlighted (case- and accent-insensitive) | ✓ | ✓ | ✓ | – |
| Read aloud (word highlight on web and iOS) and voice picker | ✓ | ✓ | ✓ | – |
| Links (pages and websites), password prompt | ✓ | ✓ | ✓ | – |
| Text selection and copy, table of contents | ✓ | ✓ | – | – |
| Download / print / share | ✓ | ✓ | – | – |

"Android 12–14 with system updates" means SDK extension 13 (`PdfRendererPreV`, delivered by Google Play system updates). Older devices get the basic viewer: the search and read-aloud buttons are hidden and protected files show an error.

Props: `src`, `password`, `initialPage`, `controls`, `nightMode`, `fit` (`'width'` | `'page'`), `maxZoom`, `speechLanguage` (e.g. `'pt-BR'`), `speechVoice`. Events: `onLoad({ pageCount })`, `onPageChange({ page, pageCount })`, `onSearch({ query, total, current })`, `onError(message)`, `onPasswordRequired()`, `onLinkPress(url)`, `onFullscreenChange(fullscreen)`, `onReadAloudChange(reading)`. The `ref` gives `goToPage(page)`, `search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, `setZoom(scale)`, `setFullscreen(on)`, `startReadAloud()` and `stopReadAloud()`.

**Read aloud** uses the system voice (web `speechSynthesis`, iOS `AVSpeechSynthesizer`, Android `TextToSpeech`) and picks the most natural voice installed for the language: neural/"Natural" voices on the web (Edge, Chrome), Premium and Enhanced voices on iOS, the highest-quality voices on Android. Users can pick another in the menu ("Voice"); apps can set `speechVoice` (the voice `name` on the web, `AVSpeechSynthesisVoice.identifier` on iOS, `Voice.getName()` on Android). On iOS, better voices are downloaded in Settings › Accessibility › Spoken Content › Voices.

**Web worker.** `pdfjs-dist` comes with omnistyle and is only downloaded by the browser when a `Pdf` renders. By default the PDF is parsed on the main thread (no setup). For very large files, serve the worker and pass its URL:

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

```json
{ "modules": { "pdf": { "enabled": true, "workerSrc": "/pdf.worker.min.mjs" } } }
```

On the web the file must be same-origin or served with CORS. On mobile, `https://`, `file://` and (Android) `content://` addresses work; remote files are downloaded once to the cache.

### Background audio and notification controls (`mediaSession`)

Set `audio.mediaSession` to `true` (next to `"enabled": true`) so an `Audio` keeps playing with the screen locked or the app in the background, with controls outside the app. It is **build-time only** and off unless set explicitly, because it adds permissions to your app.

| Platform | What you get | What the lib sets up for you |
|---|---|---|
| Android | A media notification (play/pause, ±10 s, seek bar, cover, title) and a foreground service | The lib's own manifest is merged at build time: the `mediaPlayback` service and the `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `POST_NOTIFICATIONS` permissions. No native code in your app. |
| iOS | Lock screen and Control Center controls (play/pause, ±10 s, seek, cover, title) | The pod's build step adds `UIBackgroundModes` → `audio` to your app's `Info.plist` (a pod cannot declare it). The change shows up in git once. |

What is left to you:

- **Android 13+:** request the `POST_NOTIFICATIONS` permission at runtime. Without it, audio still plays but the notification is hidden.

  ```ts
  import { PermissionsAndroid, Platform } from 'react-native';

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
  }
  ```

- **iOS:** reinstall the pods after turning it on (the build then edits the `Info.plist` for you):

  ```bash
  cd ios && pod install
  ```

### Running the iOS setup by hand

To apply the `Info.plist` change without building (e.g. in CI, or after `expo prebuild`-style regeneration of `ios/`), run from the app root:

```bash
node node_modules/omnistyle/scripts/setup-ios.js
# or
npx omnistyle-setup-ios
# app in another folder (monorepo):
npx omnistyle-setup-ios path/to/app
```

It only acts when `omnistyle.config.json` has `audio: { enabled: true, mediaSession: true }`, runs on macOS only (it uses the system `plutil`) and is safe to run again.

### Setting it up manually (no script, no build step)

Prefer to own the native files? Leave `audio.mediaSession` as `false` in the config and add this yourself (the player works the same, the controls and background playback depend on these entries).

**iOS** (`ios/<App>/Info.plist`):

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

Or, from a terminal:

```bash
/usr/bin/plutil -insert UIBackgroundModes -json '["audio"]' ios/<App>/Info.plist
# if the key already exists (e.g. "fetch"), add to it instead:
/usr/bin/plutil -insert UIBackgroundModes.0 -string audio ios/<App>/Info.plist
```

The lock screen controls themselves (`MPNowPlayingInfoCenter`) are compiled only with `mediaSession: true`; the plist entry alone just lets audio keep playing in the background.

**Android** (`android/app/src/main/AndroidManifest.xml`). With `audio.mediaSession: true` the lib's own manifest already adds the entries below at build time, so there is nothing to write. They are listed so you can see what is added, or override it in your manifest (for example `tools:node="remove"` on `POST_NOTIFICATIONS` if you do not want that permission):

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<application ...>
  <service
    android:name="com.omnistyle.OmniMediaService"
    android:exported="true"
    android:foregroundServiceType="mediaPlayback">
    <intent-filter>
      <action android:name="androidx.media3.session.MediaSessionService" />
    </intent-filter>
  </service>
</application>
```

The `OmniMediaService` class only exists when `mediaSession` is `true`, so the flag must be on for the service to be compiled; the manifest entries alone do nothing.

Notes: the iOS build step and script run on macOS only (iOS builds happen there anyway); Android builds on any OS. If your Xcode project has `ENABLE_USER_SCRIPT_SANDBOXING = YES` the build step cannot write the plist (React Native's template sets it to `NO`); run the script or the `plutil` command by hand in that case.

## Conditional styling

```tsx
const Tag = engine<'Box', { tone?: 'ok' | 'bad'; dense?: boolean }>('Box')
  .style({ padding: 12 })
  .when('props:tone=ok', { style: { backgroundColor: '#dcfce7' } })      // exact value match
  .when('props:dense', { style: { padding: 6 } })                         // truthy prop
  .when(({ props, theme }) => props.tone === 'bad', ({ theme }) => ({ // function condition
    style: { backgroundColor: theme.color.error },
  }))
  .when('platform:ios', { style: { shadowOpacity: 0.2 } })                   // platform
  .when('platform:native', { style: { elevation: 2 } })                      // any non-web platform
  .when('platform:web', { style: { cursor: 'pointer' } });
```

Every string condition has a prefix that says what it checks, so it always reads unambiguously:

| Kind | Syntax | Example |
|---|---|---|
| Platform | `'platform:<ios \| android \| web \| native>'` | `'platform:web'`, `'platform:native'` (iOS and Android) |
| Interaction state | `'state:<hover \| focus \| focus-visible \| pressed>'` | `'state:pressed'` |
| Breakpoint | `'breakpoints:<name>'`, `'breakpoints:<<name>'`, `'breakpoints:<a>..<b>'` | `'breakpoints:md'`, `'breakpoints:<md'` |
| Prop (truthy) | `'props:<prop>'` | `'props:disabled'` |
| Prop (value) | `'props:<prop>=<value>'` | `'props:variant=ghost'` |
| Pseudo-element | the CSS name | `'::before'`, `'::placeholder'` |

Plus `(ctx) => boolean` and `boolean`. An unknown condition (a typo, or the old unprefixed syntax such as `'web'`) never matches and logs a development warning.
`attrs(...)` adds fixed props, `extend()` clones a component's rules, and `engine(OtherEngineComponent, style)` composes.

### Interaction states

```tsx
const Button = engine('Pressable', { backgroundColor: '#6366f1' })
  .when('state:hover', { style: { opacity: 0.85 } })
  .when('state:pressed', { style: { transform: 'scale(0.97)' } })
  .when('platform:web', { style: { transition: 'opacity .15s, transform .1s' } });

const Field = engine('Input', { borderColor: '#e4e7ee' })
  .when('state:focus', { style: { borderColor: '#6366f1' } });
```

| State | Web | Mobile |
|---|---|---|
| `'state:hover'` | `:hover` (inside `@media (hover: hover)`, so touch devices never get a stuck hover) | ignored |
| `'state:focus'` | `:focus` | `Input` only (focus state of the `TextInput`) |
| `'state:focus-visible'` | `:focus-visible` | same as `focus` on `Input` |
| `'state:pressed'` | `:active` | `Pressable` only (its `pressed` state) |

State rules only take `{ style }` (other attrs are ignored with a dev warning). They are compiled once as variants, not evaluated per render, so they don't re-render anything. A prop with the same name (`pressed`, `focus`…) never clashes: it is checked with `'props:pressed'`.

### Breakpoints

Mobile-first: `when('breakpoints:md')` applies from 768px **up**, and larger breakpoints stack on top of smaller ones.

```tsx
const Grid = engine('Box', { flexDirection: 'column', gap: 8 })
  .when('breakpoints:md', { style: { flexDirection: 'row' } })   // ≥ 768px
  .when('breakpoints:lg', { style: { gap: 24 } });               // ≥ 1024px
```

| Name | Default min width |
|---|---|
| `sm` | 480px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

**Below and ranges** (the upper bound is exclusive):

| Condition | Applies when |
|---|---|
| `'breakpoints:md'` | width ≥ md |
| `'breakpoints:<md'` | width < md |
| `'breakpoints:sm..lg'` | width ≥ sm **and** < lg |

```tsx
engine('Box').when('breakpoints:<md', { style: { display: 'none' } }).when('breakpoints:md..lg', { style: { gap: 12 } });
```

Change or add your own (this **replaces** the defaults); names can't collide with platforms or states (`ios`, `web`, `native`, `hover`…):

```ts
configure({ breakpoints: { tablet: 600, desktop: 1100 } });
// engine('Box').when('breakpoints:tablet', { style: { … } })
```

- **Web**: a real `@media (min-width: …)` rule in the atomic sheet. No JavaScript, so it works with SSR and never flashes the wrong layout.
- **Mobile**: components that use a breakpoint follow the window width (`useWindowDimensions`) and recompose their style when it changes (rotation, split-screen). Components without breakpoints don't subscribe to anything.

Like states, breakpoint rules only take `{ style }`. The `style` you pass at the call site always wins over breakpoint styles. A prop named like a breakpoint (`md`) is not forwarded to the DOM. Use `useWindowDimensions`/`matchMedia` directly if you need the current breakpoint in JS.

## Pseudo-elements

`when('::before', { style })` — the CSS pseudo-element syntax, working on both platforms wherever there is an honest translation:

```tsx
const Quote = engine('Text')
  .when('::before', { style: { content: '“', color: 'tomato', fontSize: 24 } })
  .when('::after', { style: { content: '”', color: 'tomato', fontSize: 24 } });

const Status = engine('Box', { flexDirection: 'row', alignItems: 'center', gap: 8 })
  .when('::before', { style: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'seagreen' } }); // empty → a dot

const Field = engine('Input')
  .when('::placeholder', { style: { color: '#f59e0b' } })
  .when('::selection', { style: { backgroundColor: '#fde68a' } });

const DropCap = engine('Text').when('::first-letter', { style: { fontSize: 36, fontWeight: '800' } });
```

| Pseudo-element | Web | Mobile |
|---|---|---|
| `'::before'`, `'::after'` | CSS `::before`/`::after` | a generated child before/after the real ones: a `Text` when `content` has text, an empty `View` otherwise (decorations). Not available on `Input`/`Image`. |
| `'::placeholder'` | CSS | `Input` → `placeholderTextColor` (uses `color`) |
| `'::selection'` | CSS | `Input` → `selectionColor` (uses `backgroundColor`) |
| `'::first-letter'` | CSS | `Text` with plain-text (string) children: the first letter gets its own nested `Text` |
| `'::first-line'`, `'::marker'` | CSS | **web only** — ignored (one dev warning) |
| `'::scrollbar'`, `'::scrollbar-thumb'`, `'::scrollbar-track'` | `::-webkit-scrollbar*` (Chrome, Edge, Safari) | **web only** — ignored (one dev warning) |

The web-only names are grouped in the `WebOnlyPseudoName` type and marked `@platform web`; the universal ones are in `UniversalPseudoName`. `hover` is also marked `@platform web` (touch has no hover).

**`content`**: plain text is quoted for you (`'→'` → `content: "→"`); an empty string or no `content` renders an empty box. CSS keywords and functions pass through on the web (`none`, `attr(title)`, `url(…)`, an already-quoted `'"x"'`); on mobile `none` renders nothing and `attr()`/`counter()`/`url()` are skipped with a warning.

Pseudo-element rules only take `{ style }`, like states and breakpoints.

## Animations

`keyframes()` declares an animation once and returns its name; use it in the standard CSS `animation` properties.

```tsx
import { engine, keyframes } from 'omnistyle';

const pulse = keyframes({
  from: { opacity: 1, transform: 'scale(1)' },
  '50%': { opacity: 0.5 },
  to: { opacity: 0.35, transform: 'scale(0.8)' },
});

const Dot = engine('Box', {
  width: 14, height: 14, borderRadius: 7, backgroundColor: 'seagreen',
  animation: `${pulse} 900ms ease-in-out infinite alternate`,
});
```

- **Web**: real `@keyframes` + `animation` in the atomic stylesheet (GPU-friendly, works with SSR).
- **Mobile**: the same declaration runs on React Native's `Animated`. `opacity`/`transform` use the native driver; layout props (`width`, `height`, colors…) fall back to the JS driver.

Supported on both: `animation` shorthand and the longhands (`animationName`, `animationDuration`, `animationDelay`, `animationTimingFunction`, `animationIterationCount`, `animationDirection`, `animationFillMode`, `animationPlayState`); `from`/`to`/`N%` frames (also `'0%, 100%'`); easings `linear`, `ease*`, `cubic-bezier()`, `steps()`; `reverse`/`alternate` directions. You can also inline frames: `animationName: { from: {…}, to: {…} }`.

Mobile limits: only the **first** animation of a list runs; fractional iteration counts are rounded; properties that can't be interpolated (`alignSelf`…) are skipped with a dev warning.

### Transitions

CSS `transition` animates style *changes* — from props, from states (`pressed`, `focus`) or from breakpoints:

```tsx
const Card = engine<'Box', { open?: boolean }>('Box', {
  width: 120,
  backgroundColor: '#6366f1',
  transition: 'background-color 500ms ease, width 500ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms',
}).when('props:open', { style: { width: 260, backgroundColor: '#16a34a' } });

const Press = engine('Pressable', { transition: 'transform 160ms ease-out' })
  .when('state:pressed', { style: { transform: 'scale(0.94)' } });
```

- **Web**: plain CSS `transition` (declared in the atomic sheet).
- **Mobile**: a host animates the final style with `Animated` whenever a transitioned property changes (the first render doesn't animate). Supported: the `transition` shorthand and the longhands (`transitionProperty`/`Duration`/`TimingFunction`/`Delay`), `all`, per-property timing and delay, `ease*`/`cubic-bezier()`/`steps()`, numbers, colors, strings with matching numbers (`'10%'`, `'45deg'`) and `transform` (function by function). `opacity`/`transform` use the native driver; anything else (or `all`) uses the JS driver.
- An interrupted transition continues from where it was (numbers, colors, matching strings); otherwise it restarts from the previous value.
- Not interpolable (e.g. `width: 'auto'` → `100`): the change is instant, with a dev warning.
- `animation` and `transition` on the same element: on mobile only the `animation` runs (dev warning).
- Whether an element has `transition`/`animation`/breakpoints must not depend on its props.

## Theme

Global and provider-less, with the same API as before:

```ts
import { updateTheme, useTheme, getTheme } from 'omnistyle';

updateTheme({ color: { primary: '#f43f5e' } });   // deep merge, notifies subscribers
updateTheme((prev) => ({ /* … */ }));
const theme = useTheme();                          // reactive (useSyncExternalStore)
```

Type your theme once by augmenting the global `EngineTheme` interface (see [`examples/showcase/theme.d.ts`](./examples/showcase/theme.d.ts)).

## Server-side rendering (web)

The web adapter emits atomic CSS. In the browser it is inserted into a `<style data-omnistyle>`. On the server, collect it with `getStyleText()`:

```tsx
import { getStyleText } from 'omnistyle';
// after rendering your tree:
<style data-omnistyle="ssr" dangerouslySetInnerHTML={{ __html: getStyleText() }} />
```

## Migrating from `react-native-stylized`

- Install `omnistyle` and replace `from 'react-native-stylized'` with `from 'omnistyle'`.
- Existing React Native code keeps working: `engine('View')`, `engine('TouchableOpacity')`, `shadow*`, `elevation`… (deprecated aliases).
- The `react-native-stylized/react-native` subpath is gone: everything comes from the root entry.
- `react-native` peer dependency is now `>= 0.76` and **optional** (together with `react-dom`).
- To go universal, move to the neutral primitives (`Box`, `Input`, `Scroll`…) and the standard CSS names.

## Not yet

- Web-only: `::first-line`, `::marker`, `::scrollbar*` and `hover` (typed `@platform web`, ignored on mobile).
- `::before`/`::after` on `Input`/`Image` on mobile (they take no children), and `::first-letter` on `Text` with non-string children.
- Combining `animation` with `transition` on one element, and `attr()`/`counter()` in `content`, on mobile.

## License

MIT
