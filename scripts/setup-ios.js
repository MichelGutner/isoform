#!/usr/bin/env node
/**
 * Setup for `modules.mediaSession` on iOS: adds `UIBackgroundModes` → `audio` to
 * the app's Info.plist, so audio keeps playing with the screen locked or the app
 * in the background. A pod cannot declare this key, so the pod's build phase
 * (`omnistyle.podspec`) already does the same on every iOS build; this script is
 * for running it by hand or in CI, without building.
 *
 *   node node_modules/omnistyle/scripts/setup-ios.js [app-root]
 *
 * It only acts when `omnistyle.config.json` (at the app root) has
 * `modules.audio: { enabled: true, mediaSession: true }` and is safe to run again (idempotent).
 * Android needs nothing: the library's own manifest is merged at build time.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(process.argv[2] ?? process.cwd());
const MODE = 'audio';

/** `true` or `{ enabled: true }`. */
const isOn = (setting) => setting === true || (typeof setting === 'object' && setting !== null && setting.enabled === true);

const log = (message) => console.log(`[omnistyle] ${message}`);
const fail = (message) => {
  console.error(`[omnistyle] ${message}`);
  process.exit(1);
};

/** `modules` of the app's `omnistyle.config.json` (or `{}` when there is none). */
function readModules() {
  const file = path.join(root, 'omnistyle.config.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')).modules ?? {};
}

/** The app's Info.plist files: `ios/<Target>/Info.plist` (Pods and build output are skipped). */
function findPlists() {
  const ios = path.join(root, 'ios');
  if (!fs.existsSync(ios)) return [];
  return fs
    .readdirSync(ios, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !['Pods', 'build'].includes(entry.name))
    .map((entry) => path.join(ios, entry.name, 'Info.plist'))
    .filter((file) => fs.existsSync(file));
}

const plutil = (...args) => execFileSync('/usr/bin/plutil', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Current `UIBackgroundModes` of the plist (`null` when the key is missing). */
function backgroundModes(file) {
  try {
    return JSON.parse(plutil('-extract', 'UIBackgroundModes', 'json', '-o', '-', file));
  } catch {
    return null;
  }
}

/** Adds `audio` to the plist. Returns `false` when it was already there. */
function enableAudio(file) {
  const modes = backgroundModes(file);
  if (modes?.includes(MODE)) return false;
  if (modes === null) plutil('-insert', 'UIBackgroundModes', '-json', JSON.stringify([MODE]), file);
  else plutil('-insert', 'UIBackgroundModes.0', '-string', MODE, file);
  return true;
}

function main() {
  const modules = readModules();
  if (!isOn(modules.audio) || modules.audio.mediaSession !== true) {
    return log('modules.audio is not { enabled: true, mediaSession: true } in omnistyle.config.json: nothing to do.');
  }
  if (process.platform !== 'darwin') return fail('run this on macOS (it uses plutil).');

  const plists = findPlists();
  if (!plists.length) return fail(`no ios/<App>/Info.plist found under ${root}. Pass the app root as an argument.`);

  for (const file of plists) {
    const relative = path.relative(root, file);
    log(enableAudio(file) ? `${relative}: added UIBackgroundModes → ${MODE}` : `${relative}: already has ${MODE}`);
  }
}

main();
