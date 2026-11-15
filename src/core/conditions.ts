import { getBreakpoints } from '../config';
import { warnOnce } from './dev';
import type { Condition, Platform, PseudoName, StateName, StyleContext } from './types';

/**
 * `when()` conditions are namespaced, so every kind reads unambiguously:
 * - `'platform:ios'`        → platform (`ios | android | web | native`)
 * - `'state:hover'`         → interaction state (compiled as a variant)
 * - `'breakpoints:md'`      → screen width (also `'breakpoints:<md'`, `'breakpoints:sm..lg'`)
 * - `'props:disabled'`      → a prop is truthy
 * - `'props:variant=ghost'` → a prop equals a value
 * - `'::before'`            → pseudo-element (the CSS syntax already namespaces it)
 */
export const PLATFORM_PREFIX = 'platform:';
export const STATE_PREFIX = 'state:';
export const BREAKPOINT_PREFIX = 'breakpoints:';
export const PROPS_PREFIX = 'props:';

const PLATFORMS = new Set<string>(['ios', 'android', 'web', 'native']);
const STATES = new Set<string>(['hover', 'focus', 'focus-visible', 'pressed']);
const PSEUDOS = new Set<string>([
  '::before',
  '::after',
  '::placeholder',
  '::selection',
  '::first-letter',
  '::first-line',
  '::marker',
  '::scrollbar',
  '::scrollbar-thumb',
  '::scrollbar-track',
]);

/** The part after `prefix`, or `null` when the condition does not start with it. */
const after = (condition: unknown, prefix: string): string | null =>
  typeof condition === 'string' && condition.startsWith(prefix) ? condition.slice(prefix.length) : null;

/** `'platform:ios'` → `'ios'`; anything else → `null`. */
export function platformOf(condition: unknown): Platform | null {
  const name = after(condition, PLATFORM_PREFIX);
  return name !== null && PLATFORMS.has(name) ? (name as Platform) : null;
}

/** `'state:hover'` → `'hover'`; anything else → `null`. States are compiled as variants, never evaluated. */
export function stateOf(condition: unknown): StateName | null {
  const name = after(condition, STATE_PREFIX);
  return name !== null && STATES.has(name) ? (name as StateName) : null;
}

export const isStateCondition = (condition: unknown): boolean => stateOf(condition) !== null;

/** `'::before'`, `'::placeholder'`… — compiled as pseudo-element variants. */
export function isPseudoCondition(condition: unknown): condition is PseudoName {
  return typeof condition === 'string' && PSEUDOS.has(condition);
}

/** Width range of a breakpoint condition, in px. `max` is exclusive. */
export interface BreakpointRange {
  /** Minimum width (inclusive). */
  min: number;
  /** Maximum width (exclusive), only for `'<md'` and `'sm..lg'` ranges. */
  max?: number;
}

const isKnown = (all: Record<string, number>, name: string) => Object.prototype.hasOwnProperty.call(all, name);

/** `'md'` → from md up; `'<md'` → below md; `'sm..lg'` → from sm up to (not including) lg. */
function parseRange(expression: string, all: Record<string, number>): BreakpointRange | null {
  if (isKnown(all, expression)) return { min: all[expression] };

  const below = expression.startsWith('<') ? expression.slice(1) : '';
  if (isKnown(all, below)) return { min: 0, max: all[below] };

  const [from, to, ...extra] = expression.split('..');
  const validRange = extra.length === 0 && to !== undefined && isKnown(all, from) && isKnown(all, to) && all[from] < all[to];
  return validRange ? { min: all[from], max: all[to] } : null;
}

/**
 * Parses a breakpoint condition (names come from `configure({ breakpoints })`):
 * - `'breakpoints:md'`     → width >= md (mobile-first)
 * - `'breakpoints:<md'`    → width <  md
 * - `'breakpoints:sm..lg'` → width >= sm and < lg
 * Returns `null` when it is not a (valid) breakpoint condition.
 */
export function parseBreakpoint(condition: unknown): BreakpointRange | null {
  const expression = after(condition, BREAKPOINT_PREFIX);
  return expression === null ? null : parseRange(expression, getBreakpoints());
}

export function isBreakpointCondition(condition: unknown): boolean {
  return parseBreakpoint(condition) !== null;
}

const matchesPlatform = (wanted: Platform, current: string): boolean =>
  wanted === 'native' ? current !== 'web' : current === wanted;

/** `'disabled'` → the prop is truthy; `'variant=ghost'` → the prop equals the value (compared as text). */
function matchesProp(expression: string, props: Record<string, unknown>): boolean {
  const separator = expression.indexOf('=');
  if (separator === -1) return !!props[expression];
  return String(props[expression.slice(0, separator)]) === expression.slice(separator + 1);
}

/** Development hint for a string that is not a known condition (typo, old syntax…). */
function warnUnknownCondition(condition: string): void {
  warnOnce(
    `condition-unknown:${condition}`,
    `condição desconhecida em when('${condition}'). Use 'platform:', 'state:', 'breakpoints:', 'props:' ou um pseudo-elemento ('::before'). ` +
      `Breakpoints ativos: ${Object.keys(getBreakpoints()).join(', ')}.`,
  );
}

/**
 * Evaluates a `when()` condition at render time.
 * - boolean → itself;
 * - function → `fn(ctx)`;
 * - `'platform:…'` → matches the current platform;
 * - `'props:…'` → checks a prop;
 * - states, pseudo-elements and breakpoints → `false` (they are compiled as variants instead);
 * - anything else → `false`, with a development warning.
 */
export function evaluateCondition<P extends object>(
  condition: Condition<P, StyleContext<P>>,
  ctx: StyleContext<P>,
): boolean {
  if (typeof condition === 'boolean') return condition;
  if (typeof condition === 'function') return condition(ctx);
  if (isStateCondition(condition) || isPseudoCondition(condition) || isBreakpointCondition(condition)) return false;

  const platform = platformOf(condition);
  if (platform) return matchesPlatform(platform, ctx.platform);

  const prop = after(condition, PROPS_PREFIX);
  if (prop !== null) return matchesProp(prop, ctx.props as Record<string, unknown>);

  warnUnknownCondition(String(condition));
  return false;
}

/**
 * A condition is "static" (does not depend on props) when it is a boolean, a
 * platform, a state, a pseudo-element or a breakpoint. Functions and prop
 * conditions depend on props.
 */
export function isStaticCondition<P extends object>(condition: Condition<P, StyleContext<P>>): boolean {
  return (
    typeof condition === 'boolean' ||
    platformOf(condition) !== null ||
    isStateCondition(condition) ||
    isPseudoCondition(condition) ||
    isBreakpointCondition(condition)
  );
}
