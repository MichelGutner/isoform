# isoform — Guide

One styling API for React and React Native. See the [README](../README.md) for the overview and quick start; this guide covers how it works under the hood.

## Contents

- [Architecture](#architecture)
- [Choosing a provider](#choosing-a-provider)
- [What each adapter does](#what-each-adapter-does)
- [Atomic CSS on the web](#atomic-css-on-the-web)
- [States, breakpoints, pseudo-elements and animations](#states-breakpoints-pseudo-elements-and-animations)
- [Custom providers](#custom-providers)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Architecture

```
src/
  index.ts              single public entry (imports ./providers/index)
  config/               configure(), provider registry
  providers/
    index.ts            web:    registers the React DOM adapter   (Vite / webpack / Next / Metro-web)
    index.native.ts     mobile: registers the React Native adapter (Metro iOS/Android)
  core/                 platform-agnostic: builder, engine, conditions, types (never imports react-native/react-dom)
  theme/ cache/ hash/   platform-agnostic
  adapters/
    react-native/       primitives → RN components, CSS → RN style normalization
    react-dom/          primitives → DOM, props translation, atomic CSS sheet
```

A test (`src/boundaries.test.ts`) fails the build if the core imports `react-native`/`react-dom`, or if one provider reaches the other platform's adapter.

Render pipeline of an engine component:

1. Read the theme (`useTheme`) and the active adapter (`getProvider()`); `platform = adapter.os()`.
2. Run the rules (`style`, `when`, `attrs`) → one merged style object + merged attrs. Cached per theme and per props hash; components whose rules don't depend on props skip hashing entirely.
3. `adapter.compileStyle(style)` (cached with the step above): React Native normalizes CSS values; the DOM adapter emits atomic classes.
4. `adapter.applyProps(...)` (every render, cheap): translates universal props and merges the user's `style`/`className`.

## Choosing a provider

`configure({ provider })` accepts `'auto'` (default), `'react-native'`, `'react'` or an adapter object.

The provider that actually ships is picked by the **bundler**, through platform file resolution (`index.native.ts` vs `index.ts`), so a web bundle never sees `react-native`. `configure` validates your choice against what was bundled:

```
[isoform] provider "react-native" não está disponível neste bundle (disponível: "react"). Use "auto" ou o provider que a plataforma atual carrega.
```

Call `configure()` once, at boot. Switching providers after the first render only produces a dev warning.

## What each adapter does

### React Native (`adapters/react-native`)

`normalizeNative` turns the isoform vocabulary into RN styles (once per cached combination):

| Input | Output |
|---|---|
| `'10px'` | `10` |
| `'1rem'`, `'1.5rem'` | `16`, `24` (`configure({ native: { remBase } })`) |
| `'2em'` | 2 × the `fontSize` of the same style |
| `'50%'`, `'auto'` | unchanged |
| `'10vh'`, `'25vw'` | proportion of the window |
| `lineHeight: '1.5'` | `1.5 × fontSize` |
| `padding: '1rem 2rem'` | the four sides |
| `fontWeight: 600` | `'600'` |
| `calc()`, `var()`, `ch`… on length props | dropped, one dev warning |
| `cursor`, `transition`, `animation`, `grid*`, `backdropFilter`… | dropped, one dev warning |

Props: `type="password"` on `Input` becomes `secureTextEntry`. Everything else is passed straight to the RN component. Deprecated RN exports (e.g. `SafeAreaView`) are read lazily so you only get RN's deprecation warning if you use them.

### React DOM (`adapters/react-dom`)

Style (`normalizeWebStyle`):

- Strings pass through untouched (`rem`, `em`, `vh`, `calc()`, `var()`…); every CSS property is accepted.
- Numbers become `px`, except unitless properties.
- Axis aliases (`paddingInline`, `paddingHorizontal`…) map to physical sides, and a specific side always beats an axis alias (as in RN).
- `flex: 1` (number) follows RN semantics (`grow 1, shrink 1, basis 0%`); `flex: '1 1 auto'` is plain CSS.
- RN aliases convert: `shadow*`/`elevation` → `box-shadow`, `resizeMode` → `object-fit`, `transform` arrays → strings. Mobile-only keys (`tintColor`, `includeFontPadding`…) are dropped.
- Values containing `{`, `}` or `</style` are refused (protects the generated CSS, mainly for SSR).

Props (`applyWebProps`):

- Translated: `onPress`, `onChangeText`, `onSubmitEditing`, `testID`, `disabled`, `multiline`, `numberOfLines`, `placeholderTextColor`, `secureTextEntry`, `editable`, `keyboardType`, `source`, `accessibilityLabel/Role/Hint/State`.
- Filtered per element: only attributes valid for the target element, `data-*`, `aria-*` and `on*` handlers reach the DOM. Style-driving props (`variant`, `outlined`…) never leak.
- Mobile-only props (`hitSlop`, `onLayout`, `activeOpacity`…) are removed.
- Primitives get RN-like defaults through low-priority base rules (e.g. `Box` is `display:flex; flex-direction:column`, and borders are `solid` with width `0`, so `borderWidth` alone draws a border as it does in React Native).
- The user's `style` prop is normalized and applied inline (it always wins); `className` is concatenated.

## Atomic CSS on the web

Each `property: value` declaration becomes one class (`o-<hash>`), deduplicated across the whole app.

All classes have the same specificity, so rules are inserted by **rank** to keep CSS semantics intuitive:

| Rank | Contains |
|---|---|
| 0 | primitive base rules |
| 1 | total shorthands (`padding`, `margin`, `border`, `background`, `font`, `flex`…) |
| 2 | group shorthands (`borderWidth`, `borderColor`, `borderRadius`…) |
| 3 | side shorthands (`borderTop`…) |
| 4 | longhands (`paddingLeft`, `color`, …) |

So `{ padding: 4, paddingLeft: 8 }` yields `padding-left: 8px` regardless of key order, and a primitive's base style never overrides yours.

Highly dynamic values (a `width` that changes with props) create one class per distinct value, the usual atomic-CSS trade-off. For fully dynamic values, use the inline `style` prop.

In the browser rules go into `<style data-isoform="client">`. On the server, `getStyleText()` returns the CSS collected so far.

## States, breakpoints, pseudo-elements and animations

**States** (`when('state:hover' | 'focus' | 'focus-visible' | 'pressed')`) never reach `evaluateCondition`: the builder collects their `style` separately and calls `adapter.compileStyle(style, states)`.

- Web: each declaration becomes `.o-x:hover{…}` / `:focus` / `:focus-visible` / `:active`. They sit in later rank blocks (hover → focus → focus-visible → pressed), so `:active` beats `:hover` when both set the same property. `hover` is wrapped in `@media (hover:hover)`.
- Mobile: `pressed` turns the `Pressable` style into `({ pressed }) => …`; `focus` is handled by the `Input` primitive (a `TextInput` wrapper that tracks focus). `hover` is a silent no-op.

**Breakpoints** (`when('breakpoints:sm' | 'breakpoints:md' | 'breakpoints:lg' | 'breakpoints:xl' | 'breakpoints:<your name>')`) are `min-width` variants, resolved by name from `configure({ breakpoints })` (defaults 480 / 768 / 1024 / 1280). Like states, they never reach `evaluateCondition`: the builder collects their `style` and calls `adapter.compileStyle(style, states, breakpoints)`, with the list sorted by width and each entry carrying its `order` among all configured breakpoints.

- Web: each declaration becomes `@media (min-width:768px){.o-x{…}}`. Breakpoint rules live in rank blocks after base and state rules, ordered by width, so a larger breakpoint wins over a smaller one and shorthands still sit before longhands inside each block. Specificity note: a state rule such as `:hover` (class + pseudo-class) beats a breakpoint rule for the same property.
- Mobile: when a compiled style has breakpoints, `resolveComponent` wraps the base component in a host (cached per component) that calls `useWindowDimensions()` and asks `applyProps` for the style of that width. The final order is: base < breakpoints (small → large) < `pressed` < the `style` prop. Only components with breakpoints get the host, so the static fast path of the rest is untouched; the host composes with the animation host.
- Names that already mean something in `when()` (platforms, states) can't be used as breakpoint names, and `configure` throws a clear error. Names must match `[A-Za-z_][\w-]*` so they can't clash with the range syntax.
- Syntax (`parseBreakpoint`): `'breakpoints:md'` (≥), `'breakpoints:<md'` (below, exclusive) and `'breakpoints:sm..lg'` (≥ sm and < lg). On the web the upper bound is emitted as `max-width: <px − 0.02>`; media rules are ordered by lower bound, with bounded ranges after unbounded ones at the same lower bound.

**Pseudo-elements** (`when('::before' | '::after' | '::placeholder' | '::selection' | '::first-letter' | '::first-line' | '::marker' | '::scrollbar' | '::scrollbar-thumb' | '::scrollbar-track')`) are collected like states and passed as the 4th argument of `compileStyle`.

- Web: `.o-x::before{…}` rules in their own rank block (after base and states, before breakpoints), so they always beat the base rules and never depend on insertion order. `::before`/`::after` get `content: ""` when none is given; `content` is quoted by `normalizeWebStyle`. The scrollbar names map to `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb` and `::-webkit-scrollbar-track`.
- Mobile: `compilePseudos` normalizes each one. `::before`/`::after` become generated children injected by `applyProps` (a keyed `Text` or `View` before/after a `Fragment` holding the real children; function children — as in `Pressable` — are wrapped). `::placeholder`/`::selection` set `placeholderTextColor`/`selectionColor` when the user didn't. `::first-letter` splits a string child. Web-only names are ignored with one warning.
- Typing: `UniversalPseudoName` vs `WebOnlyPseudoName` (`@platform web`).

**Transitions on mobile** (`transition` / `transition*`): the adapter takes the keys out of the style (like `animation*`), parses them (`transition.ts`) and `resolveComponent` wraps the component in `transitionHost`, which keeps one `Animated.Value` progress per transitioned property. On each render it compares the new target with the previous one; when it differs it starts from the current value (using the last progress seen by a listener), resets progress to 0 and animates to 1 after commit. Values are interpolated with `Animated` (`interpolate`), and the current value of an interrupted transition is computed by `lerpValue` (numbers, colors, strings with matching numbers). Transforms are tracked per function. All the values of one host use the same driver: native only when the spec lists just `opacity`/`transform` (no `all`).

**The style host**: a single `styleHost` tracks what the style depends on at render time — window width (breakpoints), `pressed` (`onPressIn`/`onPressOut`, only when the style must be an object: with transition, or when a host already exists) and `focus` (`onFocus`/`onBlur`) — and asks `applyProps` for the final style via `__isoStyleFor(width, pressed, focused)`. Hosts are cached per component and per flag combination, so the hook order is fixed. Chain order: `styleHost` → `transitionHost` → `animatedHost` → component; only the needed hosts are created, and one decision function (`hostFlags`) is shared by `applyProps` and `resolveComponent` so they can never disagree.

**Keyframes**: `keyframes(frames)` only stores the definition in a platform-agnostic registry (in `core/`) and returns a content-hashed name (`o-kf-<hash>`). It never touches the active provider, so it can be called at module top level, before `configure()`, and works with custom adapters. Each adapter materializes the name **when a style that uses it is compiled**:

- Web: the adapter finds `o-kf-…` names in `animation`/`animationName` (also inside `hover`/`focus`… variants) and inserts the `@keyframes` rule once. Unused keyframes emit no CSS, and SSR only collects what was rendered. Frame selectors are validated (`from`, `to`, `N%`).
- Mobile: frames are parsed and cached by name. When a component's compiled style has `animation`, the adapter's `resolveComponent` swaps the base component for an `Animated` host (cached per component) that plays it: `Animated.timing` driven by one progress value, one `interpolate` per property and per transform function, with delay, iterations, direction, fill mode and play state. Missing 0%/100% frames fall back to the base style (identity for transforms), as in CSS.

## Custom providers

A provider implements `PlatformAdapter`:

```ts
interface PlatformAdapter {
  name: string;                                   // matches configure({ provider })
  os(): string;                                   // drives when('platform:ios' | 'android' | 'web' | 'native')
  primitives: Record<string, ComponentType<any>>; // 'Box' → real component
  compileStyle(style, states?: StateStyles, breakpoints?: BreakpointStyle[], pseudos?: PseudoStyles): unknown; // cached per (theme, props)
  resolveComponent?(component: ComponentType<any>, compiled: unknown): ComponentType<any>; // optional
  applyProps(input: {
    primitive?: string;
    compiled: unknown;
    props: Record<string, any>;   // attrs + user props, without `style`
    userStyle: unknown;
  }): Record<string, any>;                        // final props of the base component
  getStyleText?(): string;                        // SSR
}
```

Pass it with `configure({ provider: myAdapter })`. `src/core/testing/fakeAdapter.ts` is a minimal reference implementation.

## Testing

Component libraries built on isoform can test with either platform's tooling:

```ts
// jest + @testing-library/react (jsdom): the default provider is the DOM adapter
import { configure } from 'react-isoform';
configure({ provider: 'auto' });
```

For tests that need a specific provider regardless of bundling, pass an adapter object. In this repo: `yarn test` (unit), `yarn bench` (render benchmark).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `nenhum provedor disponível` | The entry wasn't imported before rendering (a custom bundler skipped `providers/*`). Import `react-isoform` first, or pass `provider: <adapter>`. Make sure `sideEffects` isn't stripping `providers/*`. |
| `provider "react-native" não está disponível neste bundle` | You forced a provider that the current bundle doesn't include. Use `'auto'`. |
| `a primitiva "Switch" não existe no provedor "react"` | A mobile-only primitive was rendered on the web. Branch with `Platform`/`when('platform:native')` or build the web variant. |
| A CSS property has no effect on mobile | It has no React Native equivalent; check the dev warning. Scope it with `.when('platform:web', …)`. |
| `boxShadow`/`paddingInline` ignored on mobile | Needs React Native ≥ 0.76 (new architecture for `boxShadow`). |
