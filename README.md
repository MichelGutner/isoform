# omnistyle

> One styling API for **React** and **React Native**. Write a component once, run it on web and mobile.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```tsx
// shared-ui/Button.tsx — no react-native, no react-dom, no platform checks
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
  .when('variant:ghost', { style: { backgroundColor: 'transparent' } })
  .when('web', { style: { cursor: 'pointer', transition: 'opacity .15s' } });
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

A complete runnable proof lives in this repo: [`examples/shared-ui`](./examples/shared-ui) is rendered by both the Expo app in [`example/`](./example) and the Vite + React DOM app in [`example-web/`](./example-web).

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

React Native names (`View`, `TouchableOpacity`, `TextInput`, `ScrollView`…) still work and are marked deprecated. Mobile-only names (`Switch`, `Modal`, `SafeAreaView`, `FlatList`…) work on mobile and throw a clear error on web. You can also wrap any component: `engine(MyComponent, style)`.

## Conditional styling

```tsx
const Tag = engine<'Box', { tone?: 'ok' | 'bad'; dense?: boolean }>('Box')
  .style({ padding: 12 })
  .when('tone:ok', { style: { backgroundColor: '#dcfce7' } })      // exact value match
  .when('dense', { style: { padding: 6 } })                         // truthy prop
  .when(({ props, theme }) => props.tone === 'bad', ({ theme }) => ({ // function condition
    style: { backgroundColor: theme.color.error },
  }))
  .when('ios', { style: { shadowOpacity: 0.2 } })                   // platform
  .when('native', { style: { elevation: 2 } })                      // any non-web platform
  .when('web', { style: { cursor: 'pointer' } });
```

Conditions: `'ios' | 'android' | 'web' | 'native'`, `'prop'`, `'prop:value'`, `(ctx) => boolean`, `boolean`, and the interaction states below.
`attrs(...)` adds fixed props, `extend()` clones a component's rules, and `engine(OtherEngineComponent, style)` composes.

### Interaction states

```tsx
const Button = engine('Pressable', { backgroundColor: '#6366f1' })
  .when('hover', { style: { opacity: 0.85 } })
  .when('pressed', { style: { transform: 'scale(0.97)' } })
  .when('web', { style: { transition: 'opacity .15s, transform .1s' } });

const Field = engine('Input', { borderColor: '#e4e7ee' })
  .when('focus', { style: { borderColor: '#6366f1' } });
```

| State | Web | Mobile |
|---|---|---|
| `'hover'` | `:hover` (inside `@media (hover: hover)`, so touch devices never get a stuck hover) | ignored |
| `'focus'` | `:focus` | `Input` only (focus state of the `TextInput`) |
| `'focus-visible'` | `:focus-visible` | same as `focus` on `Input` |
| `'pressed'` | `:active` | `Pressable` only (its `pressed` state) |

State rules only take `{ style }` (other attrs are ignored with a dev warning). They are compiled once as variants, not evaluated per render, so they don't re-render anything. If your component has a prop with the same name (`pressed`, `focus`…), the state wins.

### Breakpoints

Mobile-first: `when('md')` applies from 768px **up**, and larger breakpoints stack on top of smaller ones.

```tsx
const Grid = engine('Box', { flexDirection: 'column', gap: 8 })
  .when('md', { style: { flexDirection: 'row' } })   // ≥ 768px
  .when('lg', { style: { gap: 24 } });               // ≥ 1024px
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
| `'md'` | width ≥ md |
| `'<md'` | width < md |
| `'sm..lg'` | width ≥ sm **and** < lg |

```tsx
engine('Box').when('<md', { style: { display: 'none' } }).when('md..lg', { style: { gap: 12 } });
```

Change or add your own (this **replaces** the defaults); names can't collide with platforms or states (`ios`, `web`, `native`, `hover`…):

```ts
configure({ breakpoints: { tablet: 600, desktop: 1100 } });
// engine('Box').when('tablet', { style: { … } })
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
}).when('open', { style: { width: 260, backgroundColor: '#16a34a' } });

const Press = engine('Pressable', { transition: 'transform 160ms ease-out' })
  .when('pressed', { style: { transform: 'scale(0.94)' } });
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

Type your theme once by augmenting the global `EngineTheme` interface (see [`examples/shared-ui/theme.d.ts`](./examples/shared-ui/theme.d.ts)).

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
