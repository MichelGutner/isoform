import type { FlatStyle, PlatformAdapter } from '../../core/adapter';
import { warnOnce } from '../../core/dev';
import { getKeyframes, keyframeNamesIn } from '../../core/keyframes';
import { sheet, toKebab } from './css/sheet';
import { applyWebProps } from './normalize/props';
import { normalizeWebStyle } from './normalize/style';
import { Box, Input, Pressable, Scroll, Text } from './primitives';
import { Image, webImageCache } from './image/Image';
import { Modal } from './modal/LazyModal';
import { Audio, Pdf, Video } from './media';
import { BottomSheet } from './sheet/LazySheet';
import { SvgPrimitives } from './svg/elements';
import { Camera } from './camera/LazyCamera';
import { DatePicker } from './datePicker/DatePicker';
import { gestureHost } from './gesture/GestureBox';
import { GESTURE_PROPS, type ResolvedGestures } from '../../core/gesture';

/** Output of `compileStyle` on the web. */
interface WebCompiled {
  /** Atomic classes of the style. */
  className: string;
  /** What `.gesture()` declared, when it did. */
  gestures?: ResolvedGestures;
}

/** Primitives `.gesture()` applies to (same set as on mobile, so both platforms behave alike). */
const GESTURE_PRIMITIVES = new Set(['Box', 'View']);

/** Seletores válidos de quadro: `from`, `to`, `50%`, `12.5%` (e listas separadas por vírgula). */
const FRAME_SELECTOR = /^(from|to|\d+(\.\d+)?%)$/;

function declarations(style: FlatStyle): string {
  const decls = normalizeWebStyle(style);
  return Object.keys(decls)
    .map((prop) => `${toKebab(prop)}:${decls[prop]}`)
    .join(';');
}

/** Insere (uma vez) o `@keyframes` registrado por `keyframes()`. */
function ensureKeyframes(name: string): void {
  const frames = getKeyframes(name);
  if (!frames) {
    warnOnce(`kf-unknown:${name}`, `animation "${name}" was not registered with keyframes().`);
    return;
  }
  const blocks: string[] = [];
  for (const selector of Object.keys(frames)) {
    const parts = selector.split(',').map((s) => s.trim());
    if (!parts.every((p) => FRAME_SELECTOR.test(p))) {
      warnOnce(`kf-selector:${selector}`, `invalid keyframe selector ignored: "${selector}" (use from, to or N%).`);
      continue;
    }
    blocks.push(`${parts.join(',')}{${declarations(frames[selector])}}`);
  }
  sheet.rule(`kf:${name}`, `@keyframes ${name}{${blocks.join('')}}`, 0);
}

function addClasses(
  classes: string[],
  style: FlatStyle,
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

  images: webImageCache,

  primitives: {
    Box,
    Text,
    Pressable,
    Input,
    Image,
    Scroll,
    Video,
    Audio,
    Pdf,
    BottomSheet,
    Camera,
    DatePicker,
    Modal,
    ...SvgPrimitives,
    // nomes legados do RN que têm equivalente na web
    View: Box,
    TextInput: Input,
    ScrollView: Scroll,
    TouchableOpacity: Pressable,
    TouchableHighlight: Pressable,
    TouchableWithoutFeedback: Pressable,
  },

  /** Estilo mesclado (+ variantes de estado e de breakpoint) → classes atômicas. */
  compileStyle(style, states, breakpoints, pseudos, gestures) {
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
    return gestures ? { className: classes.join(' '), gestures } : { className: classes.join(' ') };
  },

  applyProps(input) {
    const gestures = (input.compiled as WebCompiled).gestures;
    if (!gestures) return applyWebProps(input);
    const applies = !!input.primitive && GESTURE_PRIMITIVES.has(input.primitive);
    if (!applies) warnOnce(`gesture-web:${input.primitive}`, '.gesture() only applies to Box (wrap the element in a Box).');
    // `applyWebProps` drops RN-only props such as `onLongPress`: keep the gesture callbacks aside until it is done
    const kept: Record<string, unknown> = {};
    if (applies) {
      for (const name of GESTURE_PROPS) {
        kept[name] = input.props[name];
        delete input.props[name];
      }
    }
    const out = applyWebProps(input);
    if (applies) Object.assign(out, kept, { __isoGestures: gestures });
    return out;
  },

  resolveComponent(component, compiled) {
    return (compiled as WebCompiled).gestures && component === Box ? gestureHost(component) : component;
  },

  applyThemeVariables: (css) => sheet.setVariables(css),

  getStyleText: () => sheet.getText(),
};
