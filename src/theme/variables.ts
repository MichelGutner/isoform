/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Theme as CSS variables (web, opt-in: `configure({ performance: { themeVariables: ['color'] } })`).
 *
 * The problem: a style rule that reads `theme.color.background` compiles to a class holding that
 * *value*, so every theme switch recompiles the style and re-renders the component.
 *
 * The idea: for the theme branches the app lists (`'color'`…), the style rules are given
 * `var(--iso-color-background)` instead of the value, and the real values live in one `:root` rule.
 * A theme switch then rewrites that one rule. A component whose styles only read those tokens does
 * not depend on the theme object any more: it does not subscribe to it, does not re-render and
 * does not recompile.
 *
 * What it asks of the app: the listed branches must hold **CSS-ready string values** that the style
 * only passes through (`backgroundColor: theme.color.bg`, or inside a template string). A rule that
 * computes with them (`theme.color.bg + '80'`, parsing a color) would get a `var(...)` text instead of a
 * value. Numbers, booleans and anything outside the listed branches stay real values, and a style
 * that reads one of them keeps depending on the theme, exactly as before.
 */

/** Custom property prefix: `theme.color.bg` → `--iso-color-bg`. */
const PREFIX = '--iso-';

/** Values that could escape a CSS rule (also checked by the web sheet). Left as real values instead. */
const UNSAFE = /[{}]|<\/style/i;

const nameOf = (path: readonly string[]): string => PREFIX + path.map((part) => part.replace(/[^\w-]/g, '_')).join('-');

const isContainer = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVariableValue = (value: unknown): value is string => typeof value === 'string' && !UNSAFE.test(value);

/**
 * `--iso-…` name → value, for every string under the listed top-level keys.
 * Arrays are not walked: a token list is not something a style references by name.
 */
export function variablesOf(theme: unknown, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: unknown, path: string[]) => {
    if (isContainer(node)) {
      for (const key of Object.keys(node)) walk(node[key], [...path, key]);
    } else if (isVariableValue(node)) {
      out[nameOf(path)] = node;
    }
  };
  if (isContainer(theme)) for (const key of keys) if (key in theme) walk(theme[key], [key]);
  return out;
}

/** The `:root` rule that carries the values. */
export const themeCss = (variables: Record<string, string>): string => {
  const body = Object.keys(variables)
    .map((name) => `${name}:${variables[name]}`)
    .join(';');
  return body ? `:root{${body}}` : '';
};

/** What a style computation read from the theme that is NOT a variable. */
export interface ThemeProbe {
  dependent: boolean;
}

let activeProbe: ThemeProbe | null = null;

/** Starts recording theme reads that are real values. Returns what to pass to `endThemeReads`. */
export const beginThemeReads = (probe: ThemeProbe): ThemeProbe | null => {
  const previous = activeProbe;
  activeProbe = probe;
  return previous;
};

export const endThemeReads = (previous: ThemeProbe | null): void => {
  activeProbe = previous;
};

/** A style computation reached the theme some other way (`getTheme()` inside a rule): it depends on it. */
export const noteThemeRead = (): void => {
  if (activeProbe) activeProbe.dependent = true;
};

/** A property whose value is real: reading it marks the running computation as theme-dependent. */
const reportedValue = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (activeProbe) activeProbe.dependent = true;
      return value;
    },
  });
};

/** A branch of the listed keys: strings become `var(...)`, every other leaf is a reporting getter. */
function mirror(node: Record<string, unknown>, path: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    const value = node[key];
    const here = [...path, key];
    if (isContainer(value)) out[key] = mirror(value, here);
    else if (isVariableValue(value)) out[key] = `var(${nameOf(here)})`;
    else reportedValue(out, key, value);
  }
  return out;
}

let cache = new WeakMap<object, unknown>();
let cacheKeys = '';

/**
 * The theme as style rules should see it. Same shape as `theme`; under the listed keys every safe
 * string is `var(--iso-…)`, and every other value reports its read (see `ThemeProbe`).
 * One view per theme object.
 */
export function themeView<T extends object>(theme: T, keys: readonly string[]): T {
  const signature = keys.join('\u0000');
  if (signature !== cacheKeys) {
    cache = new WeakMap();
    cacheKeys = signature;
  }
  let view = cache.get(theme) as T | undefined;
  if (view) return view;

  const built: Record<string, unknown> = {};
  for (const key of Object.keys(theme)) {
    const value = (theme as Record<string, unknown>)[key];
    if (keys.includes(key) && isContainer(value)) built[key] = mirror(value, [key]);
    else if (keys.includes(key) && isVariableValue(value)) built[key] = `var(${nameOf([key])})`;
    else reportedValue(built, key, value);
  }
  view = built as T;
  cache.set(theme, view);
  return view;
}
