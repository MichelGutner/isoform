<div align="center">

# Isoform

**One styling and component API for React and React Native.**<br>
Write a component once; it runs on the web, iOS and Android.

[![npm](https://img.shields.io/npm/v/isoform.svg)](https://www.npmjs.com/package/isoform)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-isoform-kappa.vercel.app-6366f1.svg)](https://isoform-kappa.vercel.app/)

[Documentation](https://isoform-kappa.vercel.app/) ·
[Quick start](https://isoform-kappa.vercel.app/getting-started/quick-start/) ·
[API reference](https://isoform-kappa.vercel.app/reference/engine/) ·
[Changelog](./CHANGELOG.md)

</div>

## In 30 seconds

```bash
npm install isoform
```

```tsx
import { configure, engine } from 'isoform';

configure({ theme: { color: { primary: '#6366f1' }, spacing: { sm: 8 } } }); // once, at startup

export const Button = engine<'Pressable', { variant?: 'primary' | 'ghost' }>('Pressable', ({ theme }) => ({
  paddingBlock: theme.spacing.sm,
  paddingInline: '1.25rem', // rem works on both platforms
  borderRadius: 12,
  backgroundColor: theme.color.primary,
  boxShadow: '0 4px 12px rgba(0,0,0,.12)', // same shadow on both platforms
}))
  .when('props:variant=ghost', { style: { backgroundColor: 'transparent' } })
  .when('state:pressed', { style: { transform: 'scale(0.97)' } })
  .when('platform:web', { style: { cursor: 'pointer' } });

<Button variant="ghost" onPress={save} aria-label="Save" />;
```

The same `Button` renders a keyboard-accessible `<div role="button">` with atomic CSS on the web and a React Native `Pressable` on iOS and Android. No platform checks, no providers.

## Features

|  |  |
|---|---|
| **One component library**<br>`engine('Box')`, `'Text'`, `'Pressable'`, `'Input'`, `'Image'`, `'Scroll'` resolve to DOM elements on the web and React Native components on mobile. | **Standard CSS vocabulary**<br>`paddingInline`, `boxShadow`, `'1rem'`, `transform: 'rotate(-2deg)'`. Numbers are px, strings are CSS; full CSS on the web, converted on mobile. |
| **Global theme, no providers**<br>`configure({ theme })` once, `updateTheme()` anywhere, `useTheme()` to read it. | **Variants with `when()`**<br>Props, `state:hover`/`pressed`/`focus`, `breakpoints:md`, `platform:web`, `::before`… all typed. |
| **Animations on both runtimes**<br>`keyframes()` and CSS `transition` become real CSS on the web and `Animated` on React Native. | **Optional native modules**<br>Video, audio, PDF, bottom sheet, SVG, camera, date picker, image pipeline and modal. Zero cost when off. |
| **SSR-ready atomic CSS**<br>Deduplicated, rank-ordered classes and real `@media` rules; `getStyleText()` on the server. | **TypeScript first**<br>Typed theme, custom props, conditions, breakpoints and `ref` handles. |

## Platform support

| Platform | Renders with | Requirements |
|---|---|---|
| Web | React DOM (atomic CSS) | `react >= 18`, `react-dom >= 18`; Vite, webpack, Next or Metro web |
| iOS | React Native | `react-native >= 0.76` (new architecture for `boxShadow` and the native modules) |
| Android | React Native | `react-native >= 0.76` |

The bundler picks the adapter: a web bundle never contains `react-native`, and a mobile bundle never contains the DOM adapter.

## Optional modules

Off by default. Turn on only what you use in `isoform.config.json`; disabled modules are left out of the JS bundle, the Gradle build and the pods.

| Module | Primitive | Web | iOS | Android |
|---|---|---|---|---|
| [`video`](https://isoform-kappa.vercel.app/modules/video/) | `Video` | `<video>` + the lib's controls | `AVPlayer` + UIKit | Media3 + Compose |
| [`audio`](https://isoform-kappa.vercel.app/modules/audio/) | `Audio` | `<audio>` card player | `AVPlayer` + UIKit, lock screen | Media3 + Compose, notification |
| [`pdf`](https://isoform-kappa.vercel.app/modules/pdf/) | `Pdf` | pdf.js | PDFKit | `PdfRenderer` + Compose |
| [`sheet`](https://isoform-kappa.vercel.app/modules/sheet/) | `BottomSheet` | `<dialog>` | SwiftUI sheet | Compose sheet |
| [`svg`](https://isoform-kappa.vercel.app/modules/svg/) | `Svg`, `Path`… | browser SVG | `react-native-svg` | `react-native-svg` |
| [`camera`](https://isoform-kappa.vercel.app/modules/camera/) | `Camera` | `getUserMedia` | AVFoundation | CameraX + Compose, ML Kit |
| [`datePicker`](https://isoform-kappa.vercel.app/modules/date-picker/) | `DatePicker` | `<input type="date">` | SwiftUI | Compose |
| [`image`](https://isoform-kappa.vercel.app/modules/image/) | `Image` | `<img>` + blurhash, zoom | URLSession, ImageIO | OkHttp, `ImageDecoder` |
| [`modal`](https://isoform-kappa.vercel.app/modules/modal/) | `Modal` | `<dialog>` | UIKit | Compose |

```json
{ "modules": { "video": true, "sheet": true, "camera": { "enabled": true, "codeScanner": true } } }
```

## Documentation

Everything else lives on the site, with live examples rendered by the library itself:

- [Getting started](https://isoform-kappa.vercel.app/getting-started/introduction/): installation for Expo, bare React Native, Vite and Next.
- [Guides](https://isoform-kappa.vercel.app/guides/style-vocabulary/): style vocabulary, theme, conditions, responsive design, states, animations, platform differences, TypeScript.
- [Primitives](https://isoform-kappa.vercel.app/primitives/overview/) and [native modules](https://isoform-kappa.vercel.app/modules/overview/).
- [API reference](https://isoform-kappa.vercel.app/reference/configure/) and [recipes](https://isoform-kappa.vercel.app/recipes/button-variants/).
- [Migrating from `react-native-stylized`](https://isoform-kappa.vercel.app/project/migration/).

A runnable proof lives in this repo: [`examples/showcase`](./examples/showcase) is rendered by both the Expo app in [`example/`](./example) and the Vite app in [`example-web/`](./example-web).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md), the [Code of Conduct](./CODE_OF_CONDUCT.md) and the [security policy](./SECURITY.md).

## License

[MIT](./LICENSE)
