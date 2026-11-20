/**
 * Bundle size of what an app actually ships when it installs this package.
 *
 * - Peer dependencies stay external (the app brings them).
 * - "initial load" treats every lazy `import()` as external, so it measures only what is
 *   downloaded up front. Moving code behind a lazy boundary shows up as a smaller initial load.
 * - "everything" inlines the lazy chunks too: the worst case, with every player/sheet used.
 *
 * `yarn size` runs the check; the limits below are the ceilings CI enforces.
 */
const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-native',
  'react-native-svg',
  'pdfjs-dist',
  'pdfjs-dist/build/pdf.worker.min.mjs',
];

/** Lazy `import()` → external: the bundle then holds the initial load only. */
const lazyExternal = {
  name: 'lazy-external',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) =>
      args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined,
    );
  },
};

const quiet = (config) => ({ ...config, logLevel: 'error' });
const initialLoad = (config) => ({ ...quiet(config), plugins: [...(config.plugins ?? []), lazyExternal] });
// Metro resolves `*.native.js` before `*.js`: that is how iOS/Android get the native adapter
const native = (modify) => (config) => ({ ...modify(config), resolveExtensions: ['.native.js', '.js', '.json'] });

module.exports = [
  {
    name: 'web · initial load',
    path: 'dist/index.js',
    limit: '16 kB', // 15.5 before the theme variables and the inline path (+0.5 kB); lower it when something shrinks
    ignore: external,
    modifyEsbuildConfig: initialLoad,
  },
  {
    name: 'web · everything (lazy chunks inlined)',
    path: 'dist/index.js',
    limit: '44 kB',
    ignore: external,
    modifyEsbuildConfig: quiet,
  },
  {
    name: 'react-native · JS bundle',
    path: 'dist/index.js',
    limit: '24.5 kB', // 24 before the theme probe on every platform and the inline path; lower it when something shrinks
    ignore: external,
    modifyEsbuildConfig: native(initialLoad),
  },
];
