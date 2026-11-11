import { getBreakpoints } from '../config';
import { warnOnce } from './dev';
import type { Condition, PseudoName, StateName, StyleContext } from './types';

const PLATFORMS = new Set(['ios', 'android', 'web', 'native']);
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

/** `'::before'`, `'::placeholder'`… — compilados como variantes de pseudo-elemento. */
export function isPseudoCondition(condition: unknown): condition is PseudoName {
  return typeof condition === 'string' && PSEUDOS.has(condition);
}

/** Faixa de largura de uma condição de breakpoint. `max` é exclusivo. */
export interface BreakpointRange {
  min: number;
  max?: number;
}

/**
 * Sintaxes (nomes vêm de `configure({ breakpoints })`; estados e plataformas têm prioridade):
 * - `'md'`       → largura >= md (mobile-first)
 * - `'<md'`      → largura <  md
 * - `'sm..lg'`   → largura >= sm e < lg
 * Devolve `null` quando não é uma condição de breakpoint.
 */
export function parseBreakpoint(condition: unknown): BreakpointRange | null {
  if (typeof condition !== 'string' || STATES.has(condition) || PLATFORMS.has(condition)) return null;
  const all = getBreakpoints();
  const known = (name: string) => Object.prototype.hasOwnProperty.call(all, name);

  if (known(condition)) return { min: all[condition] };
  if (condition.startsWith('<') && known(condition.slice(1))) return { min: 0, max: all[condition.slice(1)] };
  const range = condition.split('..');
  if (range.length === 2 && known(range[0]) && known(range[1]) && all[range[0]] < all[range[1]]) {
    return { min: all[range[0]], max: all[range[1]] };
  }
  return null;
}

export function isBreakpointCondition(condition: unknown): boolean {
  return parseBreakpoint(condition) !== null;
}

/** `'hover' | 'focus' | 'focus-visible' | 'pressed'` — compilados como variantes, não avaliados. */
export function isStateCondition(condition: unknown): condition is StateName {
  return typeof condition === 'string' && STATES.has(condition);
}

function matchesPlatform(condition: string, platform: string): boolean {
  if (condition === 'native') return platform !== 'web';
  return platform === condition;
}

/**
 * Avalia uma condição de `when()`.
 *
 * Formatos:
 * - boolean
 * - função: (ctx) => boolean
 * - plataforma: 'ios' | 'android' | 'web' | 'native'
 * - valor de prop (match exato): 'variant:primary'
 * - existência/truthiness de prop: 'disabled'
 */
export function evaluateCondition<P extends object>(
  condition: Condition<P, StyleContext<P>>,
  ctx: StyleContext<P>,
): boolean {
  if (typeof condition === 'boolean') return condition;
  if (typeof condition === 'function') return condition(ctx);

  const { props, platform } = ctx;

  // estados são variantes de estilo; nunca "verdadeiros" como condição simples
  if (isStateCondition(condition) || isPseudoCondition(condition) || isBreakpointCondition(condition)) return false;

  if (typeof condition === 'string' && condition.startsWith('::')) {
    warnOnce(`pseudo-unknown:${condition}`, `pseudo-elemento desconhecido em when('${condition}').`);
    return false;
  }

  if (typeof condition === 'string') {
    if (PLATFORMS.has(condition)) return matchesPlatform(condition, platform);

    if (condition.includes(':')) {
      const [key, value] = condition.split(':');
      return String((props as Record<string, unknown>)[key]) === value;
    }
  }

  return !!(props as Record<string, unknown>)[condition as string];
}

/**
 * Uma condição é "estática" (independe de props) se for um booleano literal ou
 * uma plataforma. Funções e condições por prop dependem de props.
 */
export function isStaticCondition<P extends object>(
  condition: Condition<P, StyleContext<P>>,
): boolean {
  return (
    typeof condition === 'boolean' ||
    (typeof condition === 'string' &&
      (PLATFORMS.has(condition) ||
        STATES.has(condition) ||
        PSEUDOS.has(condition) ||
        isBreakpointCondition(condition)))
  );
}
