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
| `yarn check:package` | Checks what `npm publish` would ship (after `yarn build`) |
| `yarn check:swift` | Type-checks every iOS module's Swift sources (macOS + Xcode) |
| `yarn check:android` | Compiles the Kotlin of every module through `example/android` (JDK 17+, Android SDK) |
| `yarn verify` | Lint, types, tests, build and the package check: what must pass before a PR |
| `yarn verify:all` | `verify` plus the Swift and Kotlin checks |

Node `>=22.13` is required. Git hooks (husky, installed by `yarn install`) run `yarn typecheck` on commit and `yarn verify` on push.

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
- There is no hosted CI: the checks run on your machine. `yarn verify` must pass (the push hook runs it), plus `yarn check:swift` if you touched `ios/` and `yarn check:android` if you touched `android/`.
- Add or update tests for behavior changes, and the README/docs for API changes.
- Exported types need English JSDoc on every member.

## Releases

The maintainer publishes from their own machine. The next version comes from the Conventional Commits since the last tag (`.releaserc.js` has the rules):

| Commits since the last release | Next version |
|---|---|
| `fix:` / `perf:` | patch |
| `feat:` | minor |
| `feat!:` or a `BREAKING CHANGE:` footer | major (minor while the version is 0.x) |
| only `docs:`, `chore:`, `ci:`, `test:`… | no release |

Logged in to npm (`npm login`) and GitHub (`gh auth login`):

```bash
yarn release:dry   # the version and notes semantic-release would produce, nothing changes
yarn release       # on main: runs yarn verify, then publishes, tags and writes the GitHub release
```

### The first release (0.1.0)

semantic-release always starts at 1.0.0 when the repository has no tag, so the first version is published by hand and tagged; from then on `yarn release` continues from that tag. On `main`, in sync with `origin`, with `version` set to `0.1.0` in `package.json`:

```bash
yarn verify
npm publish                                   # prepack builds; confirm with your 2FA code
git tag v0.1.0 && git push origin v0.1.0
gh release create v0.1.0 --title v0.1.0 --generate-notes
```

While the version is 0.x, a breaking change bumps the minor (`releaseRules` in `.releaserc.js`); delete that rule to go to 1.0.0.

`yarn release` refuses to run off `main`/`next`, with uncommitted changes, or out of sync with origin. It fetches semantic-release at the versions pinned in `scripts/release.sh`; the commits and the notes come from `.releaserc.js`. Pushing to `next` publishes prereleases under the `next` dist-tag. If you would rather publish by hand, bump the version and run `npm publish` (`prepack` builds first).
