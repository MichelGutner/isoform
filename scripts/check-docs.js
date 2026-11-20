#!/usr/bin/env node
// Type-checks the ```ts / ```tsx examples in the docs against the real public API (src/index.ts), so
// a renamed or removed export fails CI instead of leaving a wrong example on the site.
//
// Examples are often fragments, so errors that only say "this name/module is not defined here" are
// ignored (IGNORED_CODES). Everything else (a missing export, a wrong prop, a bad argument) fails.
// Opt a block out with `ts skip-check` / `tsx skip-check` on the opening fence.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'website/src/content/docs');
const outDir = path.join(root, '.docs-snippets');

/** Errors caused by an example being a fragment rather than a real mistake. */
const IGNORED_CODES = new Set([
  2304, // Cannot find name 'x'
  2552, // Cannot find name 'x'. Did you mean 'y'?
  2307, // Cannot find module 'x' (fictional imports in examples)
  2792, // Cannot find module 'x'. Did you mean to set moduleResolution
  2300, // Duplicate identifier
  2451, // Cannot redeclare block-scoped variable
  2393, // Duplicate function implementation
  2395, 2440, 2484, // Declaration conflicts from importing and declaring the same name
  2582, 2584, 2591, 2593, 2868, // Missing test/node globals (describe, it, process, ...)
  6133, 6196, // Unused locals
  7006, 7031, // Implicit any in fragments
  1375, 1378, // top-level await in a fragment
  2686, // 'React' refers to a UMD global
  2708, // Cannot use namespace as a value
  18004, 18046, 2571, // Fragment values of unknown type
  2391, // Overload signatures listed without a body (API reference blocks)
  1108, // `return` in a fragment lifted out of its function
  7016, // react-native ships no types in this repo
]);

/**
 * Examples read tokens the reader declared in their own `theme.d.ts` (`theme.color.error`, a partial theme in
 * `configure()`), but here `EngineTheme` is the library's default shape. Those mismatches are not doc bugs.
 */
const isAppThemeMismatch = (code, message) =>
  (code === 2339 || code === 2739) && /background: string; surface: string; text: string|xs: number; sm: number; md: number/.test(message);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const sources = [...walk(docsDir).filter((f) => /\.mdx?$/.test(f)), path.join(root, 'README.md')];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

/** snippet file name -> "docs file:line" of its opening fence. */
const origin = new Map();
let count = 0;

for (const file of sources) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(tsx?)\b(.*)$/.exec(lines[i]);
    if (!open) continue;
    const start = i + 1;
    const body = [];
    for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
    if (open[2].includes('skip-check')) continue;
    const name = `snippet-${String(count++).padStart(3, '0')}.${open[1]}`;
    // `export {}` makes each block its own module, so examples cannot clash with each other.
    fs.writeFileSync(path.join(outDir, name), `export {};\n${body.join('\n')}\n`);
    origin.set(name, `${path.relative(root, file)}:${start}`);
  }
}

fs.writeFileSync(
  path.join(outDir, 'tsconfig.json'),
  JSON.stringify({
    extends: '../tsconfig.base.json',
    compilerOptions: {
      noEmit: true,
      strict: true,
      jsx: 'react-jsx',
      baseUrl: '..',
      paths: { 'react-isoform': ['src/index.ts'] },
      types: ['react', 'node'],
      typeRoots: ['../node_modules/@types'],
      lib: ['esnext', 'dom'],
    },
    include: ['./*'],
  }),
);

let output = '';
try {
  execFileSync('npx', ['tsc', '-p', path.join(outDir, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

const failures = output
  .split('\n')
  .map((l) => /^\.docs-snippets\/(snippet-\d+\.tsx?)\((\d+),\d+\): error TS(\d+): (.*)$/.exec(l))
  .filter((m) => m && !IGNORED_CODES.has(Number(m[3])) && !isAppThemeMismatch(Number(m[3]), m[4]))
  .map((m) => `  ${origin.get(m[1])} (+${Number(m[2]) - 1}) TS${m[3]}: ${m[4]}`);

fs.rmSync(outDir, { recursive: true, force: true });

if (failures.length) {
  console.error(`Docs examples that do not type-check:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`ok    docs: ${count} examples type-check against the public API`);
