/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlatformAdapter } from '../../core/adapter';
import { warnOnce } from '../../core/dev';
import { getKeyframes, keyframeNamesIn } from '../../core/keyframes';
import { sheet, toKebab } from './css/sheet';
import { applyWebProps } from './normalize/props';
import { normalizeWebStyle } from './normalize/style';
import { Box, Image, Input, Pressable, Scroll, Text } from './primitives';
import { Video } from './media';

/** Seletores válidos de quadro: `from`, `to`, `50%`, `12.5%` (e listas separadas por vírgula). */
const FRAME_SELECTOR = /^(from|to|\d+(\.\d+)?%)$/;

function declarations(style: Record<string, any>): string {
  const decls = normalizeWebStyle(style);
  return Object.keys(decls)
    .map((prop) => `${toKebab(prop)}:${decls[prop]}`)
    .join(';');
}

/** Insere (uma vez) o `@keyframes` registrado por `keyframes()`. */
function ensureKeyframes(name: string): void {
  const frames = getKeyframes(name);
  if (!frames) {
    warnOnce(`kf-unknown:${name}`, `animação "${name}" não foi registrada com keyframes().`);
    return;
  }
  const blocks: string[] = [];
  for (const selector of Object.keys(frames)) {
    const parts = selector.split(',').map((s) => s.trim());
    if (!parts.every((p) => FRAME_SELECTOR.test(p))) {
      warnOnce(`kf-selector:${selector}`, `quadro de keyframes inválido ignorado: "${selector}" (use from, to ou N%).`);
      continue;
    }
    blocks.push(`${parts.join(',')}{${declarations(frames[selector])}}`);
  }
  sheet.rule(`kf:${name}`, `@keyframes ${name}{${blocks.join('')}}`, 0);
}

function addClasses(
  classes: string[],
  style: Record<string, any>,
  variant?: { state?: string; pseudo?: string; bp?: { min: number; max?: number; order: number } },
): void {
  const decls = normalizeWebStyle(style);
  for (const prop in decls) {
    if (prop === 'animation' || prop === 'animationName') keyframeNamesIn(decls[prop]).forEach(ensureKeyframes);
    const cls = sheet.declaration(prop, decls[prop], variant);
    if (cls) classes.push(cls);
  }
}

export const reactDomAdapter: PlatformAdapter = {
  name: 'react',

  os: () => 'web',

  primitives: {
    Box,
    Text,
    Pressable,
    Input,
    Image,
    Scroll,
    Video,
    // nomes legados do RN que têm equivalente na web
    View: Box,
    TextInput: Input,
    ScrollView: Scroll,
    TouchableOpacity: Pressable,
    TouchableHighlight: Pressable,
    TouchableWithoutFeedback: Pressable,
  },

  /** Estilo mesclado (+ variantes de estado e de breakpoint) → classes atômicas. */
  compileStyle(style, states, breakpoints, pseudos) {
    const classes: string[] = [];
    addClasses(classes, style);
    if (states) {
      for (const state in states) addClasses(classes, states[state as keyof typeof states]!, { state });
    }
    // pseudo-elementos: `.o-x::before{…}`. `::before`/`::after` precisam de `content` para existir;
    // sem ele usamos `""` (uma caixa vazia, como o `View` gerado no mobile).
    if (pseudos) {
      for (const name in pseudos) {
        let pseudoStyle = pseudos[name as keyof typeof pseudos]!;
        if ((name === '::before' || name === '::after') && !('content' in pseudoStyle)) {
          pseudoStyle = { content: '', ...pseudoStyle };
        }
        addClasses(classes, pseudoStyle, { pseudo: name });
      }
    }
    // `@media (min-width)`, da menor para a maior largura (a maior vence, como mobile-first)
    if (breakpoints) {
      for (const { min, max, order, style: bpStyle } of breakpoints) {
        addClasses(classes, bpStyle, { bp: { min, max, order } });
      }
    }
    return { className: classes.join(' ') };
  },

  applyProps: applyWebProps,

  getStyleText: () => sheet.getText(),
};
