/* eslint-disable @typescript-eslint/no-explicit-any */
import { warnOnce } from '../../core/dev';

export interface NormalizeEnv {
  remBase: number;
  viewport: () => { width: number; height: number };
}

/** Props de CSS que não existem no mobile: removidas com um aviso (dev). */
const WEB_ONLY = new Set([
  'cursor',
  'transition',
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
  'animation',
  'animationName',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridTemplateAreas',
  'gridColumn',
  'gridRow',
  'gridArea',
  'gridAutoFlow',
  'gridAutoColumns',
  'gridAutoRows',
  'backdropFilter',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'float',
  'clear',
  'content',
  'listStyle',
  'appearance',
  'willChange',
  'scrollBehavior',
  'scrollbarWidth',
]);

/** Props cujo valor é um comprimento (aceitam rem/em/vh/px…). */
const LENGTH_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'insetBlock',
  'insetInline',
  'gap',
  'rowGap',
  'columnGap',
  'flexBasis',
  'fontSize',
  'letterSpacing',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingInline',
  'paddingBlock',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginInline',
  'marginBlock',
  'marginHorizontal',
  'marginVertical',
]);

const SIDES: Record<string, string[]> = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
};

const NUM_UNIT = /^(-?\d*\.?\d+)([a-z%]*)$/i;

/** Converte um comprimento CSS em número (ou mantém `%`/`auto`). `undefined` = sem equivalente. */
function toLength(value: string, env: NormalizeEnv, fontSize: number): number | string | undefined {
  const v = value.trim();
  if (v === 'auto' || v === '0') return v === '0' ? 0 : 'auto';
  const m = NUM_UNIT.exec(v);
  if (!m) return undefined; // calc(), var(), etc.
  const n = parseFloat(m[1]);
  switch (m[2].toLowerCase()) {
    case '':
    case 'px':
      return n;
    case '%':
      return v;
    case 'rem':
      return n * env.remBase;
    case 'em':
      return n * fontSize;
    case 'vh':
      return (n / 100) * env.viewport().height;
    case 'vw':
      return (n / 100) * env.viewport().width;
    default:
      return undefined;
  }
}

/** Divide `'1rem 2rem'` respeitando parênteses. */
function splitParts(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** 1–4 valores CSS → [top, right, bottom, left]. */
function expandBox<T>(parts: T[]): T[] | undefined {
  switch (parts.length) {
    case 1:
      return [parts[0], parts[0], parts[0], parts[0]];
    case 2:
      return [parts[0], parts[1], parts[0], parts[1]];
    case 3:
      return [parts[0], parts[1], parts[2], parts[1]];
    case 4:
      return parts;
    default:
      return undefined;
  }
}

/**
 * Estilo omnistyle → estilo que o React Native entende.
 * Roda uma vez por combinação (tema, props): o builder cacheia a saída.
 */
export function normalizeNative(style: Record<string, any>, env: NormalizeEnv): Record<string, any> {
  const out: Record<string, any> = {};
  const fontSize =
    typeof style.fontSize === 'number'
      ? style.fontSize
      : typeof style.fontSize === 'string'
        ? ((toLength(style.fontSize, env, env.remBase) as number | undefined) ?? env.remBase)
        : env.remBase;

  for (const key in style) {
    const value = style[key];
    if (value === undefined || value === null) continue;

    if (WEB_ONLY.has(key) || /^[&:@]/.test(key) || key.startsWith('--')) {
      warnOnce(`native-drop:${key}`, `"${key}" não tem equivalente no mobile e foi ignorada.`);
      continue;
    }

    if (key === 'fontWeight' && typeof value === 'number') {
      out[key] = String(value);
      continue;
    }

    if (key === 'lineHeight' && typeof value === 'string') {
      // '1.5' (sem unidade) = multiplicador do fontSize; com unidade = comprimento.
      const unitless = /^\d*\.?\d+$/.test(value.trim());
      const resolved = unitless ? parseFloat(value) * fontSize : toLength(value, env, fontSize);
      if (typeof resolved === 'number') out[key] = resolved;
      else warnOnce(`native-value:${key}:${value}`, `lineHeight "${value}" não é suportado no mobile.`);
      continue;
    }

    if (typeof value === 'string' && LENGTH_KEYS.has(key)) {
      // padding/margin com 2–4 valores: expande para os 4 lados.
      if ((key === 'padding' || key === 'margin') && splitParts(value).length > 1) {
        const lengths = splitParts(value).map((p) => toLength(p, env, fontSize));
        const box = expandBox(lengths);
        if (box && box.every((l) => l !== undefined)) {
          SIDES[key].forEach((side, i) => {
            out[side] = box[i];
          });
        } else {
          warnOnce(`native-value:${key}:${value}`, `${key} "${value}" não é suportado no mobile.`);
        }
        continue;
      }

      // `em` em `fontSize` é relativo ao tamanho do PAI (a base), não ao próprio valor
      const resolved = toLength(value, env, key === 'fontSize' ? env.remBase : fontSize);
      if (resolved === undefined) {
        warnOnce(
          `native-value:${key}:${value}`,
          `${key}: "${value}" não tem equivalente no mobile e foi ignorado (use px, rem, em, %, vh ou vw).`,
        );
      } else {
        out[key] = resolved;
      }
      continue;
    }

    out[key] = value;
  }

  return out;
}
