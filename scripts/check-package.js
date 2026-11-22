#!/usr/bin/env node
// Checks what `npm publish` would ship: the build, the podspec, the codegen specs and the
// native sources must be in; tests and the docs site must be out. Run after `yarn build`.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
const pack = JSON.parse(raw)[0];
const files = pack.files.map((f) => f.path);

const required = [
  'dist/index.js',
  'dist/index.d.ts',
  'react-isoform.podspec',
  'metro.js',
  'babel.js',
  'dist/jsx-runtime.js',
  'dist/jsx-dev-runtime.js',
  'dist/server.js',
  'dist/server.d.ts',
  'react-native.config.js',
  'src/adapters/react-native/image/native/IsoImageViewNativeComponent.ts',
  'src/adapters/react-native/modal/native/IsoModalViewNativeComponent.ts',
  'src/adapters/react-native/gesture/native/IsoGestureViewNativeComponent.ts',
  'android/src/main/java/com/isoform/IsoformPackage.kt',
  'ios/image/IsoImage.swift',
];
const forbidden = [/\.test\.(ts|tsx|js)$/, /^website\//, /^example/, /^examples\//, /^\.claude\//];

const missing = required.filter((f) => !files.includes(f));
const leaked = files.filter((f) => forbidden.some((re) => re.test(f)));

if (missing.length || leaked.length) {
  if (missing.length) console.error('Missing from the package:\n  ' + missing.join('\n  '));
  if (leaked.length) console.error('Should not be in the package:\n  ' + leaked.join('\n  '));
  process.exit(1);
}
console.log(`ok    package: ${files.length} files, ${(pack.size / 1024) | 0} KB packed`);
