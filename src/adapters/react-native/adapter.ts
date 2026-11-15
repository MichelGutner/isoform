/* eslint-disable @typescript-eslint/no-explicit-any */
import * as RN from 'react-native';
import React, { type ComponentType } from 'react';
import type { BreakpointStyle, PlatformAdapter, PseudoStyles, StateStyles } from '../../core/adapter';
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
import { Audio, Embed, Pdf, Video } from './media';

/** Nome omnistyle → nome do componente no `react-native`. */
const PRIMITIVES: Record<string, string> = {
  // universais
  Box: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Input: 'TextInput',
  Image: 'Image',
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
  Modal: 'Modal',
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
const primitives: Record<string, ComponentType<any>> = {};
for (const name of Object.keys(PRIMITIVES)) {
  Object.defineProperty(primitives, name, {
    enumerable: true,
    get: () => (RN as any)[PRIMITIVES[name]],
  });
}

// mídia: componentes nossos (carregam a dependência nativa opcional sob demanda)
Object.assign(primitives, { Video, Audio, Pdf, Embed });

const PRESSABLE = new Set(['Pressable']);
/** Primitivas sem `children`: não recebem `::before`/`::after`. */
const NO_CHILDREN = new Set(['Input', 'TextInput', 'Image', 'Video', 'Audio', 'Pdf', 'Embed']);
const INPUT = new Set(['Input', 'TextInput']);

/** Saída de `compileStyle` no mobile. */
export interface NativeCompiled {
  base: Record<string, any>;
  pressed?: Record<string, any>;
  focus?: Record<string, any>;
  animation?: NativeAnimation;
  transition?: ResolvedTransition;
  /** Largura mínima → estilo, em ordem crescente (os maiores vencem). */
  breakpoints?: Array<{ min: number; max?: number; style: Record<string, any> }>;
  pseudos?: NativePseudos;
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
          warnOnce(`pseudo-web:${name}`, `${name} só existe na web e foi ignorado no mobile.`);
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

function buildAnimation(animationProps: Record<string, any>, base: Record<string, any>): NativeAnimation | undefined {
  const timing = parseAnimation(animationProps);
  if (!timing) return undefined;
  const frames = framesFor(timing.name);
  if (!frames) {
    warnOnce(`anim-unknown:${timing.name}`, `animação "${timing.name}" não foi registrada com keyframes().`);
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

function buildTransition(transitionProps: Record<string, any>): ResolvedTransition | undefined {
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
function applyPseudos(out: Record<string, any>, p: NativePseudos, primitive?: string): void {
  if (primitive && INPUT.has(primitive)) {
    if (p.placeholderColor) out.placeholderTextColor ??= p.placeholderColor;
    if (p.selectionColor) out.selectionColor ??= p.selectionColor;
  } else if (p.placeholderColor || p.selectionColor) {
    warnOnce(`pseudo-input:${primitive}`, '::placeholder e ::selection só valem para Input no mobile.');
  }

  if (p.firstLetter) {
    const kids = out.children;
    if (primitive === 'Text' && typeof kids === 'string' && kids.length > 0) {
      out.children = [
        React.createElement(RN.Text, { key: 'omni-first-letter', style: p.firstLetter }, kids[0]),
        kids.slice(1),
      ];
    } else {
      warnOnce(`pseudo-first-letter:${primitive}`, '::first-letter no mobile só vale para Text com texto simples (string).');
    }
  }

  if (p.before || p.after) {
    if (!primitive || NO_CHILDREN.has(primitive)) {
      warnOnce(`pseudo-children:${primitive}`, '::before/::after no mobile só valem em primitivas que aceitam filhos.');
      return;
    }
    const make = (key: string, g: NonNullable<NativePseudos['before']>) =>
      g.content
        ? React.createElement(RN.Text, { key, style: g.style }, g.content)
        : React.createElement(RN.View, { key, style: g.style });
    const wrap = (kids: unknown) => [
      p.before ? make('omni-before', p.before) : null,
      React.createElement(React.Fragment, { key: 'omni-children' }, kids as React.ReactNode),
      p.after ? make('omni-after', p.after) : null,
    ];
    const original = out.children;
    out.children = typeof original === 'function' ? (state: unknown) => wrap(original(state)) : wrap(original);
  }
}

export const reactNativeAdapter: PlatformAdapter = {
  name: 'react-native',

  os: () => RN.Platform.OS,

  primitives,

  compileStyle(
    style,
    states?: StateStyles,
    breakpoints?: BreakpointStyle[],
    pseudos?: PseudoStyles,
  ): NativeCompiled {
    // `animation*` e `transition*` saem do estilo e viram execução com `Animated`
    let animationProps: Record<string, any> | undefined;
    let transitionProps: Record<string, any> | undefined;
    let rest = style;
    const hasAnimation = ANIMATION_KEYS.some((k) => k in style);
    const hasTransition = TRANSITION_KEYS.some((k) => k in style);
    if (hasAnimation || hasTransition) {
      rest = { ...style };
      const take = (keys: readonly string[]) => {
        const taken: Record<string, any> = {};
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

    const e = env();
    const compiled: NativeCompiled = { base: normalizeNative(rest, e) };

    if (states?.pressed) compiled.pressed = normalizeNative(states.pressed, e);
    const focus = { ...states?.focus, ...states?.['focus-visible'] };
    if (Object.keys(focus).length) compiled.focus = normalizeNative(focus, e);
    // `hover` não existe no toque: ignorado no mobile (sem aviso — é comum declarar só para a web)

    if (breakpoints?.length) {
      compiled.breakpoints = breakpoints.map((b) => ({ min: b.min, max: b.max, style: normalizeNative(b.style, e) }));
    }

    if (pseudos) compiled.pseudos = compilePseudos(pseudos, e);

    if (animationProps) compiled.animation = buildAnimation(animationProps, compiled.base);
    if (transitionProps) compiled.transition = buildTransition(transitionProps);
    if (compiled.animation && compiled.transition) {
      warnOnce('anim-and-transition', 'animation e transition no mesmo elemento: no mobile só a animation é executada.');
    }
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
      warnOnce(`focus:${primitive}`, `when('focus') no mobile só vale para Input.`);
    }
    const focusStyle = isInput ? c.focus : undefined;

    if (c.pseudos) applyPseudos(out, c.pseudos, primitive);

    if (c.animation) out.__omniAnimation = c.animation;
    if (c.transition && !c.animation) out.__omniTransition = c.transition;

    const flags = hostFlags(c);
    const pressedStyle =
      c.pressed && primitive && PRESSABLE.has(primitive) && !c.animation ? c.pressed : undefined;
    if (c.pressed && !pressedStyle) {
      warnOnce(
        `pressed:${primitive}`,
        c.animation
          ? "when('pressed') e animation no mesmo Pressable: no mobile o pressed é ignorado."
          : "when('pressed') no mobile só vale para Pressable.",
      );
    }

    /**
     * Estilo final, em ordem de prioridade: base < breakpoints (menor → maior) <
     * focus < pressed < estilo do usuário. Sem nada extra, devolve o próprio
     * `base` (mesma referência, cacheada pelo builder).
     */
    const build = (width?: number, isPressed = false, isFocused = false): any => {
      const parts: any[] = [c.base];
      if (c.breakpoints && width !== undefined) {
        for (const b of c.breakpoints) if (width >= b.min && (b.max === undefined || width < b.max)) parts.push(b.style);
      }
      if (isFocused && focusStyle) parts.push(focusStyle);
      if (isPressed && pressedStyle) parts.push(pressedStyle);
      if (userStyle) parts.push(userStyle);
      return parts.length === 1 ? parts[0] : parts;
    };

    if (flags) {
      out.__omniStyleFor = build; // o host de estilo chama com largura, pressed e focus
    } else if (pressedStyle) {
      out.style = ({ pressed }: { pressed: boolean }) => build(undefined, !!pressed);
    } else {
      out.style = build();
    }
    return out;
  },

  resolveComponent(component, compiled) {
    const c = compiled as NativeCompiled;
    let result = c.animation ? animatedHost(component) : component;
    if (c.transition && !c.animation) result = transitionHost(result);
    const flags = hostFlags(c);
    return flags ? styleHost(result, flags) : result;
  },
};
