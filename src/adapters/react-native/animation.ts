/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Animações CSS (`animation` + `keyframes()`) traduzidas para o React Native.
 * Este módulo é puro (sem `react-native`): faz o parse e planeja as
 * interpolações. Quem executa é `animatedHost.tsx`, com `Animated`.
 */
import { warnOnce } from '../../core/dev';

export type EasingFn = (t: number) => number;
export type BezierFactory = (x1: number, y1: number, x2: number, y2: number) => EasingFn;

export interface Frame {
  offset: number; // 0..1
  style: Record<string, any>;
}

export type Direction = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export type FillMode = 'none' | 'forwards' | 'backwards' | 'both';

export interface AnimationTiming {
  name: string;
  duration: number; // ms
  delay: number; // ms
  timingFunction: string;
  iterations: number; // Infinity = infinite
  direction: Direction;
  fill: FillMode;
  paused: boolean;
}

/** Uma propriedade animada: valores por offset (para `progress.interpolate`). */
export interface Track {
  inputRange: number[];
  outputRange: Array<number | string>;
}

export interface TrackPlan {
  props: Record<string, Track>;
  /** Funções de transform, na ordem em que aparecem (`translateY`, `scale`…). */
  transform: Array<{ fn: string; track: Track }>;
  /** `true` quando só há `opacity`/`transform` (pode usar o native driver). */
  nativeDriver: boolean;
}

export const ANIMATION_KEYS = [
  'animation',
  'animationName',
  'animationDuration',
  'animationDelay',
  'animationTimingFunction',
  'animationIterationCount',
  'animationDirection',
  'animationFillMode',
  'animationPlayState',
] as const;

/* ───────────────────────── parse ───────────────────────── */

/** Divide por `sep` no nível 0 de parênteses. */
export function splitTopLevel(value: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && sep.test(ch)) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const TIME = /^(-?\d*\.?\d+)(ms|s)$/i;
export const EASING = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\(.*\)|steps\(.*\))$/i;
const DIRECTIONS = new Set(['normal', 'reverse', 'alternate', 'alternate-reverse']);
const FILLS = new Set(['none', 'forwards', 'backwards', 'both']);

export function parseTime(value: unknown): number | undefined {
  if (typeof value === 'number') return value; // número = ms
  if (typeof value !== 'string') return undefined;
  const m = TIME.exec(value.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 's' ? n * 1000 : n;
}

function parseIterations(value: unknown): number | undefined {
  if (value === 'infinite') return Infinity;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (!Number.isInteger(n)) warnOnce('anim-fraction', 'fractional iteration counts are not supported on mobile; rounding.');
  return Math.max(1, Math.round(n));
}

/**
 * `animation` (shorthand) + longhands → parâmetros de tempo.
 * Só a PRIMEIRA animação de uma lista é usada no mobile.
 */
export function parseAnimation(style: Record<string, any>): AnimationTiming | undefined {
  const timing: AnimationTiming = {
    name: '',
    duration: 0,
    delay: 0,
    timingFunction: 'ease',
    iterations: 1,
    direction: 'normal',
    fill: 'none',
    paused: false,
  };

  if (typeof style.animation === 'string' && style.animation.trim()) {
    const list = splitTopLevel(style.animation, /,/);
    if (list.length > 1) {
      warnOnce('anim-multi', 'several animations on one element: on mobile only the first one runs.');
    }
    let times = 0;
    for (const token of splitTopLevel(list[0], /\s/)) {
      const t = token.trim();
      if (TIME.test(t)) {
        if (times++ === 0) timing.duration = parseTime(t)!;
        else timing.delay = parseTime(t)!;
      } else if (EASING.test(t)) timing.timingFunction = t;
      else if (t === 'infinite' || /^\d*\.?\d+$/.test(t)) timing.iterations = parseIterations(t)!;
      else if (DIRECTIONS.has(t)) timing.direction = t as Direction;
      else if (FILLS.has(t)) timing.fill = t as FillMode;
      else if (t === 'running' || t === 'paused') timing.paused = t === 'paused';
      else timing.name = t;
    }
  }

  const first = (v: unknown) => (typeof v === 'string' ? splitTopLevel(v, /,/)[0] : v);
  if (style.animationName !== undefined) timing.name = String(first(style.animationName));
  if (style.animationDuration !== undefined) timing.duration = parseTime(first(style.animationDuration)) ?? timing.duration;
  if (style.animationDelay !== undefined) timing.delay = parseTime(first(style.animationDelay)) ?? timing.delay;
  if (style.animationTimingFunction !== undefined) timing.timingFunction = String(first(style.animationTimingFunction));
  if (style.animationIterationCount !== undefined) {
    timing.iterations = parseIterations(first(style.animationIterationCount)) ?? timing.iterations;
  }
  if (style.animationDirection !== undefined && DIRECTIONS.has(String(first(style.animationDirection)))) {
    timing.direction = first(style.animationDirection) as Direction;
  }
  if (style.animationFillMode !== undefined && FILLS.has(String(first(style.animationFillMode)))) {
    timing.fill = first(style.animationFillMode) as FillMode;
  }
  if (style.animationPlayState !== undefined) timing.paused = first(style.animationPlayState) === 'paused';

  if (!timing.name || timing.name === 'none') return undefined;
  return timing;
}

/** Nome CSS de easing → função. */
export function parseEasing(value: string, bezier: BezierFactory): EasingFn {
  const v = value.trim().toLowerCase();
  switch (v) {
    case 'linear':
      return (t) => t;
    case 'ease':
      return bezier(0.25, 0.1, 0.25, 1);
    case 'ease-in':
      return bezier(0.42, 0, 1, 1);
    case 'ease-out':
      return bezier(0, 0, 0.58, 1);
    case 'ease-in-out':
      return bezier(0.42, 0, 0.58, 1);
    case 'step-start':
      return (t) => (t > 0 ? 1 : 0);
    case 'step-end':
      return (t) => (t >= 1 ? 1 : 0);
  }
  const cubic = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (cubic) {
    const [a, b, c, d] = cubic[1].split(',').map((n) => parseFloat(n));
    if ([a, b, c, d].every(Number.isFinite)) return bezier(a, b, c, d);
  }
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+))?\s*\)$/.exec(v);
  if (steps) {
    const n = Math.max(1, parseInt(steps[1], 10));
    const start = steps[2] === 'start' || steps[2] === 'jump-start';
    return (t) => Math.min(1, (start ? Math.ceil(t * n) : Math.floor(t * n)) / n);
  }
  warnOnce(`anim-easing:${value}`, `easing "${value}" is not supported on mobile; using "ease".`);
  return bezier(0.25, 0.1, 0.25, 1);
}

/* ───────────────────────── quadros ───────────────────────── */

const SELECTOR = /^(from|to|\d+(\.\d+)?%)$/;

/** `{ from, '50%', to }` → quadros ordenados por offset (seletores inválidos são ignorados). */
export function parseFrames(
  frames: Record<string, Record<string, any>>,
  normalize: (style: Record<string, any>) => Record<string, any>,
): Frame[] {
  const out: Frame[] = [];
  for (const selector of Object.keys(frames)) {
    for (const part of selector.split(',').map((s) => s.trim())) {
      if (!SELECTOR.test(part)) {
        warnOnce(`kf-selector:${part}`, `invalid keyframe selector ignored: "${part}" (use from, to or N%).`);
        continue;
      }
      const offset = part === 'from' ? 0 : part === 'to' ? 1 : parseFloat(part) / 100;
      out.push({ offset: Math.min(1, Math.max(0, offset)), style: normalize(frames[selector] ?? {}) });
    }
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/* ───────────────────────── transform ───────────────────────── */

export const IDENTITY: Record<string, number | string> = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: '0deg',
  rotateX: '0deg',
  rotateY: '0deg',
  rotateZ: '0deg',
  skewX: '0deg',
  skewY: '0deg',
  perspective: 1000,
};

const toNumberIfPx = (v: string): number | string => {
  const m = /^(-?\d*\.?\d+)(px)?$/.exec(v.trim());
  return m ? parseFloat(m[1]) : v.trim();
};

/** `'translate(10px, 4px) rotate(45deg)'` ou array RN → `[{ fn, value }]`. */
export function parseTransform(transform: unknown): Array<{ fn: string; value: number | string }> {
  const out: Array<{ fn: string; value: number | string }> = [];
  if (Array.isArray(transform)) {
    for (const item of transform) {
      for (const fn of Object.keys(item ?? {})) out.push({ fn, value: item[fn] });
    }
    return out;
  }
  if (typeof transform !== 'string') return out;
  const re = /([a-zA-Z0-9]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(transform))) {
    const fn = m[1];
    const args = m[2].split(',').map((a) => a.trim());
    if (fn === 'translate') {
      out.push({ fn: 'translateX', value: toNumberIfPx(args[0]) });
      out.push({ fn: 'translateY', value: toNumberIfPx(args[1] ?? '0') });
    } else if (fn === 'scale' && args.length > 1) {
      out.push({ fn: 'scaleX', value: parseFloat(args[0]) });
      out.push({ fn: 'scaleY', value: parseFloat(args[1]) });
    } else if (/^scale/.test(fn)) {
      out.push({ fn, value: parseFloat(args[0]) });
    } else {
      out.push({ fn, value: toNumberIfPx(args[0]) });
    }
  }
  return out;
}

/* ───────────────────────── planejamento ───────────────────────── */

/** Palavras-chave que NÃO são cores (nomes de cor CSS são aceitos pelo `Animated`). */
const NOT_COLORS = new Set(['auto', 'none', 'inherit', 'initial', 'unset', 'normal', 'hidden', 'visible']);

/** Valores que `Animated.interpolate` sabe interpolar: números, cores e strings numéricas de mesmo formato. */
export function interpolatable(values: Array<number | string>): boolean {
  if (values.every((v) => typeof v === 'number')) return true;
  if (values.every((v) => typeof v === 'string')) {
    const shape = (v: string) => v.replace(/-?\d*\.?\d+/g, '#');
    const isColor = (v: string) =>
      /^(#|rgb|hsl)/i.test(v) || (/^[a-z]+$/i.test(v) && !NOT_COLORS.has(v.toLowerCase()));
    return values.every((v) => isColor(v as string)) || values.every((v) => shape(v as string) === shape(values[0] as string));
  }
  return false;
}

function buildTrack(points: Array<{ offset: number; value: number | string }>): Track | undefined {
  // offsets repetidos: o último vence (como no CSS)
  const byOffset = new Map<number, number | string>();
  for (const p of points) byOffset.set(p.offset, p.value);
  const offsets = [...byOffset.keys()].sort((a, b) => a - b);
  if (offsets.length === 0) return undefined;
  const values = offsets.map((o) => byOffset.get(o)!);
  if (offsets.length === 1) return { inputRange: [0, 1], outputRange: [values[0], values[0]] };
  return { inputRange: offsets, outputRange: values };
}

/**
 * Quadros → uma trilha por propriedade. Offsets ausentes em 0%/100% usam o
 * valor do estilo base (como o CSS faz); transforms ausentes usam a identidade.
 */
export function planTracks(frames: Frame[], base: Record<string, any>): TrackPlan {
  const props: Record<string, Track> = {};
  const transform: TrackPlan['transform'] = [];

  const keys = new Set<string>();
  for (const f of frames) for (const k of Object.keys(f.style)) if (k !== 'transform') keys.add(k);

  for (const key of keys) {
    const points = frames
      .filter((f) => f.style[key] !== undefined)
      .map((f) => ({ offset: f.offset, value: f.style[key] }));
    const fallback = base[key] ?? (key === 'opacity' ? 1 : undefined);
    if (fallback !== undefined) {
      if (!points.some((p) => p.offset === 0)) points.unshift({ offset: 0, value: fallback });
      if (!points.some((p) => p.offset === 1)) points.push({ offset: 1, value: fallback });
    }
    if (!interpolatable(points.map((p) => p.value))) {
      warnOnce(`anim-prop:${key}`, `"${key}" cannot be interpolated on mobile and was ignored in the animation.`);
      continue;
    }
    const track = buildTrack(points);
    if (track) props[key] = track;
  }

  // transform: uma trilha por função, na ordem da primeira aparição
  const parsed = frames.map((f) => ({ offset: f.offset, list: parseTransform(f.style.transform) }));
  const baseList = parseTransform(base.transform);
  const fns: string[] = [];
  for (const p of parsed) for (const { fn } of p.list) if (!fns.includes(fn)) fns.push(fn);

  for (const fn of fns) {
    const points = parsed
      .filter((p) => p.list.some((t) => t.fn === fn))
      .map((p) => ({ offset: p.offset, value: p.list.find((t) => t.fn === fn)!.value }));
    const fallback = baseList.find((t) => t.fn === fn)?.value ?? IDENTITY[fn];
    if (fallback !== undefined) {
      if (!points.some((p) => p.offset === 0)) points.unshift({ offset: 0, value: fallback });
      if (!points.some((p) => p.offset === 1)) points.push({ offset: 1, value: fallback });
    }
    if (!interpolatable(points.map((p) => p.value))) {
      warnOnce(`anim-transform:${fn}`, `transform "${fn}" cannot be interpolated on mobile.`);
      continue;
    }
    const track = buildTrack(points);
    if (track) transform.push({ fn, track });
  }

  const nativeDriver = Object.keys(props).every((k) => k === 'opacity');
  return { props, transform, nativeDriver };
}

/** Em qual sentido a iteração `i` roda (`true` = de 1 para 0). */
export function isReversed(direction: Direction, iteration: number): boolean {
  switch (direction) {
    case 'reverse':
      return true;
    case 'alternate':
      return iteration % 2 === 1;
    case 'alternate-reverse':
      return iteration % 2 === 0;
    default:
      return false;
  }
}
