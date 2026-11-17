import { warnOnce } from '../../../core/dev';
import { flattenStyle } from '../../../core/flatten';

/** Props numéricas que NÃO recebem `px`. */
const UNITLESS = new Set([
  'opacity', 'flex', 'flexGrow', 'flexShrink', 'order', 'zIndex', 'fontWeight', 'aspectRatio',
  'zoom', 'scale', 'columnCount', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'lineClamp',
  'orphans', 'widows', 'tabSize', 'gridRow', 'gridColumn',
]);

/** Props só-mobile, sem efeito na web. */
const NATIVE_ONLY = new Set([
  'tintColor', 'textAlignVertical', 'includeFontPadding', 'borderCurve', 'overlayColor',
]);

const OBJECT_FIT: Record<string, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

/** Aliases de eixo → lados físicos (assim `paddingLeft` e `paddingInline` nunca disputam). */
const AXIS: Record<string, string[]> = {
  paddingHorizontal: ['paddingLeft', 'paddingRight'],
  paddingInline: ['paddingLeft', 'paddingRight'],
  paddingVertical: ['paddingTop', 'paddingBottom'],
  paddingBlock: ['paddingTop', 'paddingBottom'],
  marginHorizontal: ['marginLeft', 'marginRight'],
  marginInline: ['marginLeft', 'marginRight'],
  marginVertical: ['marginTop', 'marginBottom'],
  marginBlock: ['marginTop', 'marginBottom'],
  insetInline: ['left', 'right'],
  insetBlock: ['top', 'bottom'],
};

/** Valores de `content` que o CSS aceita sem aspas. */
const CONTENT_KEYWORD = /^(none|normal|inherit|initial|unset|open-quote|close-quote|no-open-quote|no-close-quote)$/;
const CONTENT_FUNCTION = /^(attr|counter|counters|url|image-set|var|linear-gradient|radial-gradient)\(/;

/**
 * `content: '→'` vira `content: "→"`. Palavras-chave do CSS (`none`), funções
 * (`attr(title)`, `url(…)`) e strings já entre aspas passam intactas; `''` vira `""`.
 */
export function cssContent(value: unknown): string {
  if (typeof value === 'number') return `"${value}"`;
  const v = String(value);
  if (v === '') return '""';
  if (CONTENT_KEYWORD.test(v) || CONTENT_FUNCTION.test(v) || /^["']/.test(v)) return v;
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`;
}

const px = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

function format(prop: string, value: unknown): string | undefined {
  if (typeof value === 'number') {
    if (prop.startsWith('--') || UNITLESS.has(prop)) return String(value);
    return value === 0 ? '0' : `${value}px`;
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(' '); // fontVariant etc.
  return undefined;
}

/** `[{ translateX: 10 }, { rotate: '45deg' }]` → `translateX(10px) rotate(45deg)` */
function transformToString(items: Array<Record<string, number | string | undefined>>): string {
  return items
    .map((item) =>
      Object.keys(item)
        .map((fn) => {
          const v = item[fn];
          if (v === undefined) return '';
          const unitless = /^(scale|scaleX|scaleY|matrix)/.test(fn);
          return `${fn}(${typeof v === 'number' && !unitless ? px(v) : v})`;
        })
        .join(' '),
    )
    .join(' ');
}

/**
 * Estilo isoform → declarações CSS (`{ paddingLeft: '8px' }`).
 *
 * - strings passam intactas (`rem`, `em`, `vh`, `calc()`, `var()`…)
 * - número vira `px`, exceto props sem unidade
 * - aliases do RN são convertidos; props só-mobile são descartadas
 */
export function normalizeWebStyle(input: unknown): Record<string, string> {
  const style = flattenStyle(input);
  const direct: Record<string, string> = {};
  const axis: Record<string, string> = {};

  const set = (prop: string, value: string | undefined) => {
    if (value !== undefined && value !== '') direct[prop] = value;
  };

  for (const key in style) {
    const value = style[key];
    if (value === undefined || value === null || value === false) continue;

    if (NATIVE_ONLY.has(key)) continue;

    // sombras/elevação do RN são tratadas depois (viram boxShadow)
    if (/^shadow(Color|Offset|Opacity|Radius)$/.test(key) || key === 'elevation') continue;
    if (/^textShadow(Color|Offset|Radius)$/.test(key)) continue;

    if (AXIS[key]) {
      const v = format(key, value);
      if (v !== undefined) AXIS[key].forEach((side) => (axis[side] = v));
      continue;
    }

    switch (key) {
      case 'flex':
        if (typeof value === 'number') {
          set('flexGrow', String(value));
          set('flexShrink', '1');
          set('flexBasis', '0%');
        } else set('flex', String(value));
        continue;
      case 'transform':
        set('transform', Array.isArray(value) ? transformToString(value) : String(value));
        continue;
      case 'resizeMode':
        set('objectFit', OBJECT_FIT[value as string] ?? String(value));
        continue;
      case 'writingDirection':
        set('direction', String(value));
        continue;
      case 'fontWeight':
        set('fontWeight', String(value));
        continue;
      case 'content':
        set('content', cssContent(value));
        continue;
      default:
        set(key, format(key, value));
    }
  }

  // sombra do RN → box-shadow (a menos que boxShadow tenha sido definido)
  if (!direct.boxShadow) {
    const opacity = style.shadowOpacity;
    if (typeof opacity === 'number' && opacity > 0) {
      const { width = 0, height = 0 } = style.shadowOffset ?? {};
      const color = style.shadowColor ?? '#000';
      const radius = style.shadowRadius ?? 0;
      direct.boxShadow = `${px(width)} ${px(height)} ${px(radius)} color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
    } else if (typeof style.elevation === 'number' && style.elevation > 0) {
      const e = style.elevation;
      direct.boxShadow = `0 ${e}px ${Math.round(e * 1.5)}px rgba(0,0,0,0.25)`;
    }
  }

  if (!direct.textShadow && style.textShadowColor) {
    const { width = 0, height = 0 } = style.textShadowOffset ?? {};
    direct.textShadow = `${px(width)} ${px(height)} ${px(style.textShadowRadius ?? 0)} ${style.textShadowColor}`;
  }

  // props diretas (`paddingLeft`) vencem os aliases de eixo (`paddingInline`), como no RN
  const out = { ...axis, ...direct };

  for (const key in out) {
    if (/[{}]/.test(out[key])) {
      warnOnce(`unsafe:${key}`, `valor ignorado em "${key}" (contém caracteres não permitidos).`);
      delete out[key];
    }
  }
  return out;
}
