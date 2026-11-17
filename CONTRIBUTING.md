# Contributing to Isoform

Thanks for helping! This guide covers the setup, the checks a pull request must pass and how releases happen.

## Setup

```bash
git clone https://github.com/MichelGutner/isoform.git
cd isoform
nvm use          # Node from .nvmrc
yarn install
```

| Command | What it does |
|---|---|
| `yarn lint` | ESLint over `src`, `metro.js`, `react-native.config.js` and `scripts` |
| `yarn typecheck` | TypeScript, no output |
| `yarn test` | Jest (core, both adapters, codegen specs) |
| `yarn test:coverage` | Jest with coverage in `coverage/` |
| `yarn build` | Compiles `src` to `dist` |
| `yarn check:swift` | Type-checks every iOS module's Swift sources (macOS + Xcode) |

## Running the showcase

The same showcase (`examples/showcase`) runs in two apps that import the library from source:

```bash
cd example && yarn install && yarn ios        # or: yarn android
cd example-web && yarn install && yarn dev    # React DOM + Vite
```

`example/isoform.config.json` turns every optional native module on. After changing it, run `pod install` again (iOS) and rebuild.

## Project layout

| Path | What lives there |
|---|---|
| `src/core` | Platform-free engine: styles, theme, `when`, keyframes, shared types and helpers |
| `src/adapters/react-dom` | Web adapter: atomic CSS, DOM primitives, web versions of the modules |
| `src/adapters/react-native` | Native adapter: style translation, primitives, codegen specs (`**/native/*NativeComponent.ts`) |
| `ios/<module>` | Swift + Fabric shells (`.mm`); `ios/stubs` keep the class names when a module is off |
| `android/src/<module>` | Kotlin (Compose where there is UI); one source set per module |
| `isoform.podspec`, `android/build.gradle`, `metro.js` | Read `isoform.config.json` and leave disabled modules out |

## Pull requests

- Squash-merged: the **PR title** becomes the commit and must follow [Conventional Commits](https://www.conventionalcommits.org): `feat(image): pinch zoom`, `fix(modal): content cut on iOS`, `docs: …`.
- There is no hosted CI. Before opening a PR, run `yarn lint`, `yarn typecheck`, `yarn test` and `yarn build`, and `yarn check:swift` if you touched `ios/`. For `android/`, compile with `./gradlew :isoform:compileDebugKotlin` from an app that uses the library (such as `example/`).
- Add or update tests for behavior changes, and the README/docs for API changes.
- Exported types need English JSDoc on every member.

## Releases

The maintainer publishes from their own machine. The next version comes from the Conventional Commits since the last tag (`.releaserc.js` has the rules):

| Commits since the last release | Next version |
|---|---|
| `fix:` / `perf:` | patch |
| `feat:` | minor |
| `feat!:` or a `BREAKING CHANGE:` footer | major |
| only `docs:`, `chore:`, `ci:`, `test:`… | no release |

Logged in to npm and to `gh`, run `npx semantic-release --no-ci` on `main` (it needs the tools in `.releaserc.js` and a Node version that satisfies semantic-release), or publish by hand with `npm publish` after bumping the version. Both build the package first (`prepack`).
