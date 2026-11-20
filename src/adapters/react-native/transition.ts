/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CSS `transition` traduzida para o React Native. Este módulo é puro (sem
 * `react-native`): faz o parse e as contas de interpolação. Quem executa é
 * `transitionHost.tsx`, com `Animated`.
 */
import { warnOnce } from '../../core/dev';
import { EASING, parseTime, splitTopLevel, type EasingFn } from './animation';

export const TRANSITION_KEYS = [
  'transition',
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
] as const;

export interface TransitionTiming {
  duration: number; // ms
  delay: number; // ms
  easing: string;
}

export interface TransitionSpec {
  /** `transition: all …` — vale para toda propriedade interpolável que mudar. */
  all?: TransitionTiming;
  /** Por propriedade, em camelCase (`backgroundColor`). */
  props: Record<string, TransitionTiming>;
}

/** Spec pronta para executar (easing já resolvido). */
export interface ResolvedTransition {
  /** Identidade: muda → o host recria o estado. */
  key: string;
  all?: ResolvedTiming;
  props: Record<string, ResolvedTiming>;
  /** `true` quando só `opacity`/`transform` são animados (pode usar o native driver). */
  nativeDriver: boolean;
}
export interface ResolvedTiming {
  duration: number;
  delay: number;
  easing: EasingFn;
}

const camel = (property: string) => property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** `transition` (shorthand) + longhands → duração/atraso/easing por propriedade. */
export function parseTransition(style: Record<string, any>): TransitionSpec | undefined {
  let properties: string[] = [];
  let durations: number[] = [];
  let delays: number[] = [];
  let easings: string[] = [];

  if (typeof style.transition === 'string' && style.transition.trim() && style.transition.trim() !== 'none') {
    for (const item of splitTopLevel(style.transition, /,/)) {
      let property = 'all';
      let duration = 0;
      let delay = 0;
      let easing = 'ease';
      let times = 0;
      for (const token of splitTopLevel(item, /\s/)) {
        if (parseTime(token) !== undefined && /^-?\d*\.?\d+(ms|s)$/i.test(token)) {
          if (times++ === 0) duration = parseTime(token)!;
          else delay = parseTime(token)!;
        } else if (EASING.test(token)) easing = token;
        else property = camel(token);
      }
      properties.push(property);
      durations.push(duration);
      delays.push(delay);
      easings.push(easing);
    }
  }

  // longhands sobrescrevem a lista inteira do componente correspondente
  const list = (value: unknown) => (typeof value === 'string' ? splitTopLevel(value, /,/) : undefined);
  const lp = list(style.transitionProperty);
  if (lp) properties = lp.map(camel);
  const ld = list(style.transitionDuration);
  if (ld) durations = ld.map((v) => parseTime(v) ?? 0);
  else if (typeof style.transitionDuration === 'number') durations = [style.transitionDuration];
  const ldelay = list(style.transitionDelay);
  if (ldelay) delays = ldelay.map((v) => parseTime(v) ?? 0);
  else if (typeof style.transitionDelay === 'number') delays = [style.transitionDelay];
  const le = list(style.transitionTimingFunction);
  if (le) easings = le;

  if (properties.length === 0) return undefined;

  const spec: TransitionSpec = { props: {} };
  properties.forEach((property, i) => {
    const timing: TransitionTiming = {
      duration: durations.length ? durations[i % durations.length] : 0,
      delay: delays.length ? delays[i % delays.length] : 0,
      easing: easings.length ? easings[i % easings.length] : 'ease',
    };
    if (property === 'none' || timing.duration + timing.delay <= 0) return;
    if (property === 'all') spec.all = timing;
    else spec.props[property] = timing;
  });

  return spec.all || Object.keys(spec.props).length ? spec : undefined;
}

/* ───────────────────────── interpolação manual ───────────────────────── */

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `transparent` → [r, g, b, a]. */
export function parseColor(value: string): [number, number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const h = m[1];
    const full = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a];
  }
  return null;
}

/** Valor intermediário entre dois estilos (para retomar uma transição interrompida). */
export function lerpValue(from: unknown, to: unknown, t: number): number | string | undefined {
  if (typeof from === 'number' && typeof to === 'number') return from + (to - from) * t;
  if (typeof from !== 'string' || typeof to !== 'string') return undefined;

  const a = parseColor(from);
  const b = parseColor(to);
  if (a && b) {
    const c = a.map((x, i) => x + (b[i] - x) * t);
    return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+c[3].toFixed(3)})`;
  }

  // strings com os mesmos números em posições iguais ('10%', '0deg')
  const num = /-?\d*\.?\d+/g;
  const fa = from.match(num);
  const fb = to.match(num);
  if (fa && fb && fa.length === fb.length && from.replace(num, '#') === to.replace(num, '#')) {
    let i = 0;
    return to.replace(num, () => String(+(+fa[i] + (+fb[i] - +fa[i++]) * t).toFixed(4)));
  }
  return undefined;
}

/** `true` quando dois valores de estilo representam o mesmo destino. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && typeof b === 'object' && a && b) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/** Propriedades que o native driver anima. */
export const NATIVE_DRIVER_PROPS = new Set(['opacity', 'transform']);

/** Só `opacity`/`transform` (e sem `all`) → native driver. */
export function usesNativeDriver(properties: string[], hasAll: boolean): boolean {
  return !hasAll && properties.length > 0 && properties.every((p) => NATIVE_DRIVER_PROPS.has(p));
}

export function warnUnsupportedTransition(property: string): void {
  warnOnce(`transition-prop:${property}`, `"${property}" cannot be animated with transition on mobile; the change is instant.`);
}
