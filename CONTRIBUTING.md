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

- Squash-merged: the **PR title** becomes the commit and must follow [Conventional Commits](https://www.conventionalcommits.org): `feat(image): pinch zoom`, `fix(modal): content cut on iOS`, `docs: …`. A check enforces it.
- CI runs lint, types, tests, the build, a check of the published files, a Kotlin compile of every module and a Swift type-check. All must pass.
- Add or update tests for behavior changes, and the README/docs for API changes.
- Exported types need English JSDoc on every member.

## Releases

Nobody publishes by hand. Every push to `main` runs CI and then [semantic-release](https://semantic-release.gitbook.io):

| Commits since the last release | Next version |
|---|---|
| `fix:` / `perf:` | patch |
| `feat:` | minor |
| `feat!:` or a `BREAKING CHANGE:` footer | major |
| only `docs:`, `chore:`, `ci:`, `test:`… | no release |

It publishes to npm with provenance, creates the tag and the GitHub release, and commits `CHANGELOG.md` and `package.json` back with `[skip ci]`. Pushing to `next` publishes prereleases under the `next` dist-tag.

### Maintainer setup (once)

1. npm: create an automation token and save it as the `NPM_TOKEN` repository secret (Settings → Secrets and variables → Actions).
2. After the first release, turn on **Trusted publishing** for `isoform` on npmjs.com (GitHub Actions, workflow `release.yml`) and delete `NPM_TOKEN`.
3. If `main` is protected, allow GitHub Actions to push the release commit, or drop `@semantic-release/git` from `.releaserc.js`.
