import * as RN from 'react-native';
import React from 'react';
import type {
  AnyComponent,
  BreakpointStyle,
  FlatStyle,
  PlatformAdapter,
  PseudoStyles,
  StateStyles,
} from '../../core/adapter';
import { warnOnce } from '../../core/dev';
import { getConfig } from '../../config';
import { getKeyframes } from '../../core/keyframes';
import { ANIMATION_KEYS, parseAnimation, parseEasing, parseFrames, planTracks, type Frame } from './animation';
import { animatedHost, type NativeAnimation } from './animatedHost';
import { normalizeNative } from './normalize';
import { styleHost, type StyleHostFlags } from './styleHost';
import { transitionHost } from './transitionHost';
import { parseTransition, TRANSITION_KEYS, usesNativeDriver, type ResolvedTransition } from './transition';
import { parseContent, WEB_ONLY_PSEUDOS, type NativePseudos } from './pseudo';
import { Audio, Pdf, Video } from './media';
import { BottomSheet } from './sheet/BottomSheet';
import { SvgPrimitives } from './svg/Svg';
import { Camera } from './camera/Camera';
import { DatePicker } from './datePicker/DatePicker';
import { Image } from './image/Image';
import { nativeImageCache } from './image/imageCache';
import { Modal } from './modal/Modal';
import { GestureView } from './gesture/GestureView';
import type { ResolvedGestures } from '../../core/gesture';

/** Nome isoform → nome do componente no `react-native`. */
const PRIMITIVES: Record<string, keyof typeof RN> = {
  // universais
  Box: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Input: 'TextInput',
  Scroll: 'ScrollView',
  // legado / só-mobile (o nome é o mesmo do RN)
  View: 'View',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  Switch: 'Switch',
  ActivityIndicator: 'ActivityIndicator',
  StatusBar: 'StatusBar',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  ImageBackground: 'ImageBackground',
  SafeAreaView: 'SafeAreaView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
};

/**
 * Getters preguiçosos: alguns exports do RN (ex.: `SafeAreaView`) avisam de
 * deprecação ao serem lidos, então só tocamos no que for realmente usado.
 */
const primitives: Record<string, AnyComponent> = {};
for (const name of Object.keys(PRIMITIVES)) {
  Object.defineProperty(primitives, name, {
    enumerable: true,
    get: () => RN[PRIMITIVES[name]],
  });
}

// vídeo e áudio: componentes nativos da própria lib (ios/ e android/ na raiz do pacote)
// `Image` and `Modal`: the lib's own with `modules.image` / `modules.modal` on, React Native's otherwise
Object.assign(primitives, { Video, Audio, Pdf, BottomSheet, Camera, DatePicker, Image, Modal }, SvgPrimitives);

const PRESSABLE = new Set(['Pressable']);
/** Primitivas sem `children`: não recebem `::before`/`::after`. */
const NO_CHILDREN = new Set(['Input', 'TextInput', 'Image', 'Video', 'Audio', 'Pdf']);
const INPUT = new Set(['Input', 'TextInput']);
/** Primitives `.gesture()` applies to on mobile (both render a `View`, swapped for the gesture view). */
const GESTURE_PRIMITIVES = new Set(['Box', 'View']);

/** Saída de `compileStyle` no mobile. */
export interface NativeCompiled {
  base: Record<string, unknown>;
  pressed?: Record<string, unknown>;
  focus?: Record<string, unknown>;
  animation?: NativeAnimation;
  transition?: ResolvedTransition;
  /** Largura mínima → estilo, em ordem crescente (os maiores vencem). */
  breakpoints?: Array<{ min: number; max?: number; style: Record<string, unknown> }>;
  pseudos?: NativePseudos;
  /** `hostFlags(this)`, computed once at compile time (it was recomputed twice per render). */
  hostFlags?: StyleHostFlags;
  /** What `.gesture()` declared (defaults applied). */
  gestures?: ResolvedGestures;
}

/**
 * With gestures the fingers own the transform through the native driver; `animation`
 * and `transition` (driven from JS on the same view) would fight over it, so they
 * are dropped on that element. They still work on its children.
 */
function withGestures(compiled: NativeCompiled, gestures: ResolvedGestures): void {
  compiled.gestures = gestures;
  if (!compiled.animation && !compiled.transition) return;
  warnOnce(
    'gesture-and-animation',
    'animation/transition on an element with .gesture(): on mobile they are ignored there; put them on a child.',
  );
  compiled.animation = undefined;
  compiled.transition = undefined;
}

/** Pseudo-elementos → o que o mobile consegue fazer com cada um. */
function compilePseudos(pseudos: PseudoStyles, e: ReturnType<typeof env>): NativePseudos {
  const out: NativePseudos = {};
  for (const name of Object.keys(pseudos) as Array<keyof PseudoStyles>) {
    const st = pseudos[name]!;
    switch (name) {
      case '::before':
      case '::after': {
        const { content, ...rest } = st;
        const text = parseContent(content);
        if (text === null) break; // content: none
        out[name === '::before' ? 'before' : 'after'] = { content: text ?? '', style: normalizeNative(rest, e) };
        break;
      }
      case '::placeholder':
        if (typeof st.color === 'string') out.placeholderColor = st.color;
        break;
      case '::selection': {
        const color = st.backgroundColor ?? st.color;
        if (typeof color === 'string') out.selectionColor = color;
        break;
      }
      case '::first-letter':
        out.firstLetter = normalizeNative(st, e);
        break;
      default:
        if (WEB_ONLY_PSEUDOS.has(name)) {
          warnOnce(`pseudo-web:${name}`, `${name} only exists on the web and was ignored on mobile.`);
        }
    }
  }
  return out;
}

const env = () => ({
  remBase: getConfig().native.remBase,
  viewport: () => RN.Dimensions.get('window'),
});

/** Quadros já normalizados para o mobile, por nome (a definição vem do core). */
const parsedFrames = new Map<string, Frame[]>();

function framesFor(name: string): Frame[] | undefined {
  let frames = parsedFrames.get(name);
  if (!frames) {
    const def = getKeyframes(name);
    if (!def) return undefined;
    frames = parseFrames(def, (s) => normalizeNative(s, env()));
    parsedFrames.set(name, frames);
  }
  return frames;
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => RN.Easing.bezier(x1, y1, x2, y2);

function buildAnimation(animationProps: Record<string, unknown>, base: Record<string, unknown>): NativeAnimation | undefined {
  const timing = parseAnimation(animationProps);
  if (!timing) return undefined;
  const frames = framesFor(timing.name);
  if (!frames) {
    warnOnce(`anim-unknown:${timing.name}`, `animation "${timing.name}" was not registered with keyframes().`);
    return undefined;
  }
  return {
    key: JSON.stringify(timing),
    duration: timing.duration,
    delay: timing.delay,
    easing: parseEasing(timing.timingFunction, bezier),
    iterations: timing.iterations,
    direction: timing.direction,
    fill: timing.fill,
    paused: timing.paused,
    plan: planTracks(frames, base),
  };
}

function buildTransition(transitionProps: Record<string, unknown>): ResolvedTransition | undefined {
  const spec = parseTransition(transitionProps);
  if (!spec) return undefined;
  const resolve = (t: { duration: number; delay: number; easing: string }) => ({
    duration: t.duration,
    delay: t.delay,
    easing: parseEasing(t.easing, bezier),
  });
  const props: ResolvedTransition['props'] = {};
  for (const key of Object.keys(spec.props)) props[key] = resolve(spec.props[key]);
  return {
    key: JSON.stringify(spec),
    all: spec.all ? resolve(spec.all) : undefined,
    props,
    nativeDriver: usesNativeDriver(Object.keys(props), !!spec.all),
  };
}

/** O que o host de estilo precisa rastrear (ou `undefined` quando o estilo é estático). */
function hostFlags(c: NativeCompiled): StyleHostFlags | undefined {
  const width = !!c.breakpoints;
  const focus = !!c.focus;
  // `pressed` precisa de estado no host quando o estilo é um objeto: com transition (para animar) ou
  // quando já há um host por outro motivo (o host controla `style`, então a função do Pressable não vale)
  const pressed = !!c.pressed && !c.animation && (!!c.transition || width || focus);
  return width || pressed || focus ? { width, pressed, focus } : undefined;
}

/**
 * `::before`/`::after` viram filhos gerados (antes e depois dos filhos reais);
 * `::placeholder`/`::selection` viram props do `Input`; `::first-letter` separa a
 * primeira letra de um `Text` com texto simples.
 */
function applyPseudos(out: Record<string, unknown>, p: NativePseudos, primitive?: string): void {
  if (primitive && INPUT.has(primitive)) {
    if (p.placeholderColor) out.placeholderTextColor ??= p.placeholderColor;
    if (p.selectionColor) out.selectionColor ??= p.selectionColor;
  } else if (p.placeholderColor || p.selectionColor) {
    warnOnce(`pseudo-input:${primitive}`, '::placeholder and ::selection only apply to Input on mobile.');
  }

  if (p.firstLetter) {
    const kids = out.children;
    if (primitive === 'Text' && typeof kids === 'string' && kids.length > 0) {
      out.children = [
        React.createElement(RN.Text, { key: 'iso-first-letter', style: p.firstLetter }, kids[0]),
        kids.slice(1),
      ];
    } else {
      warnOnce(`pseudo-first-letter:${primitive}`, '::first-letter on mobile only applies to Text with plain text (a string).');
    }
  }

  if (p.before || p.after) {
    if (!primitive || NO_CHILDREN.has(primitive)) {
      warnOnce(`pseudo-children:${primitive}`, '::before/::after on mobile only apply to primitives that accept children.');
      return;
    }
    const make = (key: string, g: NonNullable<NativePseudos['before']>) =>
      g.content
        ? React.createElement(RN.Text, { key, style: g.style }, g.content)
        : React.createElement(RN.View, { key, style: g.style });
    const wrap = (kids: unknown) => [
      p.before ? make('iso-before', p.before) : null,
      React.createElement(React.Fragment, { key: 'iso-children' }, kids as React.ReactNode),
      p.after ? make('iso-after', p.after) : null,
    ];
    const original = out.children;
    out.children = typeof original === 'function' ? (state: unknown) => wrap(original(state)) : wrap(original);
  }
}

export const reactNativeAdapter: PlatformAdapter = {
  name: 'react-native',

  os: () => RN.Platform.OS,

  primitives,

  images: nativeImageCache,

  compileStyle(
    style: FlatStyle,
    states?: StateStyles,
    breakpoints?: BreakpointStyle[],
    pseudos?: PseudoStyles,
    gestures?: ResolvedGestures,
  ): NativeCompiled {
    // `animation*` e `transition*` saem do estilo e viram execução com `Animated`
    let animationProps: Record<string, unknown> | undefined;
    let transitionProps: Record<string, unknown> | undefined;
    let rest = style;
    const hasAnimation = ANIMATION_KEYS.some((k) => k in style);
    const hasTransition = TRANSITION_KEYS.some((k) => k in style);
    if (hasAnimation || hasTransition) {
      rest = { ...style };
      const take = (keys: readonly string[]) => {
        const taken: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in rest) {
            taken[k] = rest[k];
            delete rest[k];
          }
        }
        return taken;
      };
      if (hasAnimation) animationProps = take(ANIMATION_KEYS);
      if (hasTransition) transitionProps = take(TRANSITION_KEYS);
    }

    // `transition` declarada num estado ou breakpoint (ex.: `.when('breakpoints:lg', { style: { transition } })`)
    // também vale: no mobile ela passa a valer para o elemento, se o base não declarar a sua.
    const withoutTransition = (st: Record<string, unknown>) => {
      if (!TRANSITION_KEYS.some((k) => k in st)) return st;
      const copy = { ...st };
      for (const k of TRANSITION_KEYS) {
        if (k in copy) {
          (transitionProps ??= {})[k] ??= copy[k];
          delete copy[k];
        }
      }
      return copy;
    };

    const e = env();
    const compiled: NativeCompiled = { base: normalizeNative(rest, e) };

    if (states?.pressed) compiled.pressed = normalizeNative(withoutTransition(states.pressed), e);
    const focus = withoutTransition({ ...states?.focus, ...states?.['focus-visible'] });
    if (Object.keys(focus).length) compiled.focus = normalizeNative(focus, e);
    // `hover` não existe no toque: ignorado no mobile (sem aviso — é comum declarar só para a web)

    if (breakpoints?.length) {
      compiled.breakpoints = breakpoints.map((b) => ({
        min: b.min,
        max: b.max,
        style: normalizeNative(withoutTransition(b.style), e),
      }));
    }

    if (pseudos) compiled.pseudos = compilePseudos(pseudos, e);

    if (animationProps) compiled.animation = buildAnimation(animationProps, compiled.base);
    if (transitionProps) compiled.transition = buildTransition(transitionProps);
    if (compiled.animation && compiled.transition) {
      warnOnce('anim-and-transition', 'animation and transition on the same element: on mobile only the animation runs.');
    }
    if (gestures) withGestures(compiled, gestures);
    compiled.hostFlags = hostFlags(compiled);
    return compiled;
  },

  applyProps({ primitive, compiled, props, userStyle }) {
    const out = props;
    const c = compiled as NativeCompiled;
    const isInput = !!primitive && INPUT.has(primitive);

    // `type="password"` (padrão web) → `secureTextEntry` (RN).
    if (isInput) {
      if (out.type === 'password') out.secureTextEntry = true;
      delete out.type;
    } else if (c.focus) {
      warnOnce(`focus:${primitive}`, `when('state:focus') on mobile only applies to Input.`);
    }
    const focusStyle = isInput ? c.focus : undefined;

    if (c.pseudos) applyPseudos(out, c.pseudos, primitive);

    if (c.gestures) {
      if (primitive && GESTURE_PRIMITIVES.has(primitive)) out.__isoGestures = c.gestures;
      else warnOnce(`gesture:${primitive}`, '.gesture() on mobile only applies to Box (wrap the element in a Box).');
    }
    if (c.animation) out.__isoAnimation = c.animation;
    if (c.transition && !c.animation) out.__isoTransition = c.transition;

    const flags = c.hostFlags;
    const pressedStyle =
      c.pressed && primitive && PRESSABLE.has(primitive) && !c.animation ? c.pressed : undefined;
    if (c.pressed && !pressedStyle) {
      warnOnce(
        `pressed:${primitive}`,
        c.animation
          ? "when('state:pressed') and animation on the same Pressable: on mobile pressed is ignored."
          : "when('state:pressed') on mobile only applies to Pressable.",
      );
    }

    // caso comum (sem breakpoint, foco nem pressed): nada de closure nem array por render
    if (!flags && !pressedStyle) {
      out.style = userStyle ? [c.base, userStyle] : c.base;
      return out;
    }

    /**
     * Estilo final, em ordem de prioridade: base < breakpoints (menor → maior) <
     * focus < pressed < estilo do usuário. Sem nada extra, devolve o próprio
     * `base` (mesma referência, cacheada pelo builder).
     */
    const build = (width?: number, isPressed = false, isFocused = false): unknown => {
      const parts: unknown[] = [c.base];
      if (c.breakpoints && width !== undefined) {
        for (const b of c.breakpoints) if (width >= b.min && (b.max === undefined || width < b.max)) parts.push(b.style);
      }
      if (isFocused && focusStyle) parts.push(focusStyle);
      if (isPressed && pressedStyle) parts.push(pressedStyle);
      if (userStyle) parts.push(userStyle);
      return parts.length === 1 ? parts[0] : parts;
    };

    if (flags) {
      out.__isoStyleFor = build; // o host de estilo chama com largura, pressed e focus
      // faixas dos breakpoints: o host só re-renderiza quando a faixa ativa muda, não a cada pixel de largura
      if (flags.width) out.__isoRanges = c.breakpoints;
    } else if (pressedStyle) {
      out.style = ({ pressed }: { pressed: boolean }) => build(undefined, !!pressed);
    } else {
      out.style = build();
    }
    return out;
  },

  resolveComponent(component, compiled) {
    const c = compiled as NativeCompiled;
    // Box/View with gestures → the gesture view (same check as `applyProps`: both primitives are `RN.View`)
    if (c.gestures && component === RN.View) {
      return c.hostFlags ? styleHost(GestureView, c.hostFlags) : GestureView;
    }
    let result = c.animation ? animatedHost(component) : component;
    if (c.transition && !c.animation) result = transitionHost(result);
    const flags = c.hostFlags;
    return flags ? styleHost(result, flags) : result;
  },
};
