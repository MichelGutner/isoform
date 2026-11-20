import { warnOnce } from '../../../core/dev';
import { stringHash } from '../../../hash/stringHash';

/**
 * Ordem das regras no stylesheet. Todas as classes têm a mesma especificidade,
 * então quem vem depois vence. Para que `padding` (shorthand) nunca derrube
 * `paddingLeft` (longhand), as regras são inseridas por "rank":
 *
 *   0 base das primitivas · 1 shorthands totais (`border`, `padding`…)
 *   2 shorthands de grupo (`borderWidth`…) · 3 de lado (`borderTop`…) · 4 longhands
 *
 * Variantes de estado repetem essa escada em blocos posteriores
 * (hover → focus → focus-visible → pressed), então `pressed` vence `hover`.
 */
const BLOCK = 5;
/** Pseudo-elementos ficam depois das regras base e dos estados e antes dos breakpoints. */
const PSEUDO_BLOCK = 5;
const STATE_BLOCK: Record<string, number> = { hover: 1, focus: 2, 'focus-visible': 3, pressed: 4 };
/** Blocos 0..4 = base + estados; breakpoints ocupam os blocos seguintes, por largura crescente. */
const BREAKPOINT_BLOCK_START = 6; // blocos 0..4 base/estados, 5 pseudo-elementos

/** Seletor de cada pseudo-elemento. As barras de rolagem usam o prefixo `-webkit-` (Chrome, Edge, Safari). */
const PSEUDO_ELEMENT: Record<string, string> = {
  '::before': '::before',
  '::after': '::after',
  '::placeholder': '::placeholder',
  '::selection': '::selection',
  '::first-letter': '::first-letter',
  '::first-line': '::first-line',
  '::marker': '::marker',
  '::scrollbar': '::-webkit-scrollbar',
  '::scrollbar-thumb': '::-webkit-scrollbar-thumb',
  '::scrollbar-track': '::-webkit-scrollbar-track',
};

/** Pseudo-classe de cada estado. `pressed` = `:active`. */
const PSEUDO: Record<string, string> = {
  hover: ':hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  pressed: ':active',
};

const RESET = new Set([
  'border', 'background', 'font', 'margin', 'padding', 'flex', 'flexFlow', 'transition',
  'animation', 'overflow', 'inset', 'gap', 'outline', 'listStyle', 'textDecoration', 'columns',
  'placeContent', 'placeItems', 'placeSelf', 'grid', 'gridArea', 'gridTemplate', 'mask',
  'offset', 'borderImage',
]);
const GROUP = new Set(['borderWidth', 'borderColor', 'borderStyle', 'borderRadius', 'borderBlock', 'borderInline']);
const SIDE = new Set(['borderTop', 'borderRight', 'borderBottom', 'borderLeft']);

export function rankOf(prop: string): number {
  if (RESET.has(prop)) return 1;
  if (GROUP.has(prop)) return 2;
  if (SIDE.has(prop)) return 3;
  return 4;
}

/** `paddingLeft` → `padding-left`, `WebkitLineClamp` → `-webkit-line-clamp`. */
export function toKebab(prop: string): string {
  if (prop.startsWith('--')) return prop;
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^ms-/, '-ms-');
}

/** Valores com `{`, `}` ou `</style` poderiam escapar da regra (principalmente no SSR). */
const UNSAFE = /[{}]|<\/style/i;

/** `(min-width:768px)`, `(max-width:767.98px)` ou as duas com `and`. `max` é exclusivo. */
function mediaFor({ min, max }: { min: number; max?: number }): string {
  const parts: string[] = [];
  if (min > 0) parts.push(`(min-width:${min}px)`);
  if (max !== undefined) parts.push(`(max-width:${+(max - 0.02).toFixed(2)}px)`);
  return parts.join(' and ');
}

export class AtomicSheet {
  /** chave da regra → nome da classe (dedupe). */
  private classes = new Map<string, string>();
  /** Texto das regras por rank (usado no SSR e em testes). */
  private text: string[][] = [];
  private counts: number[] = [];
  private cssSheet: CSSStyleSheet | null = null;
  /** The `:root{--iso-…}` rule of the theme variables (see `theme/variables.ts`). One rule, replaced on every theme change. */
  private variables = '';
  private variablesElement: HTMLStyleElement | null = null;

  /**
   * Sets the theme variables. They live in their own `<style>`, so a theme switch replaces one text node
   * and never touches the atomic rules (which hold `var(--iso-…)`, not values).
   */
  setVariables(css: string): void {
    if (css === this.variables) return;
    this.variables = css;
    if (typeof document === 'undefined') return;
    if (!this.variablesElement) {
      const el = document.createElement('style');
      el.setAttribute('data-isoform', 'theme');
      document.head.appendChild(el);
      this.variablesElement = el;
    }
    this.variablesElement.textContent = css;
  }

  private ensureBrowserSheet(): CSSStyleSheet | null {
    if (this.cssSheet) return this.cssSheet;
    if (typeof document === 'undefined') return null;
    const el = document.createElement('style');
    el.setAttribute('data-isoform', 'client');
    document.head.appendChild(el);
    this.cssSheet = el.sheet;
    return this.cssSheet;
  }

  private add(rule: string, rank: number): void {
    let index = 0;
    for (let r = 0; r <= rank; r++) index += this.counts[r] ?? 0;
    (this.text[rank] ??= []).push(rule);
    this.counts[rank] = (this.counts[rank] ?? 0) + 1;

    const sheet = this.ensureBrowserSheet();
    if (!sheet) return;
    try {
      sheet.insertRule(rule, Math.min(index, sheet.cssRules.length));
    } catch {
      warnOnce(`bad-rule:${rule}`, `regra CSS inválida ignorada: ${rule}`);
    }
  }

  /**
   * Uma declaração → uma classe atômica (reaproveitada se já existir).
   * Com `variant.state`, a regra vale só naquele estado (`.o-x:hover{…}`);
   * com `variant.bp`, só a partir da largura mínima (`@media (min-width:…)`).
   */
  declaration(
    prop: string,
    value: string,
    variant: { state?: string; pseudo?: string; bp?: { min: number; max?: number; order: number } } = {},
  ): string | undefined {
    const { state, bp, pseudo: pseudoElement } = variant;
    if (UNSAFE.test(value)) {
      warnOnce(`unsafe:${prop}`, `valor ignorado em "${prop}" (contém caracteres não permitidos).`);
      return undefined;
    }
    const pseudo = state ? PSEUDO[state] : pseudoElement ? PSEUDO_ELEMENT[pseudoElement] : '';
    if ((state || pseudoElement) && !pseudo) return undefined;

    const key = `d|${state ?? ''}|${pseudoElement ?? ''}|${bp ? `${bp.min}-${bp.max ?? ''}` : ''}|${prop}|${value}`;
    let cls = this.classes.get(key);
    if (!cls) {
      cls = `o-${stringHash(key).toString(36)}`;
      this.classes.set(key, cls);
      const body = `.${cls}${pseudo}{${toKebab(prop)}:${value}}`;
      // hover só em dispositivos com ponteiro real: evita o "hover grudado" no toque
      const rule = bp
        ? `@media ${mediaFor(bp)}{${body}}`
        : state === 'hover'
          ? `@media (hover:hover){${body}}`
          : body;
      const block = bp ? BREAKPOINT_BLOCK_START + bp.order : pseudoElement ? PSEUDO_BLOCK : state ? STATE_BLOCK[state] : 0;
      this.add(rule, block * BLOCK + rankOf(prop));
    }
    return cls;
  }

  /** Regra completa (ex.: `@keyframes`), inserida uma única vez por `key`. */
  rule(key: string, text: string, rank = 0): void {
    const k = `x|${key}`;
    if (this.classes.has(k)) return;
    this.classes.set(k, key);
    this.add(text, rank);
  }

  /** Regra com seletor próprio (reset de primitiva, `::placeholder`…), inserida uma única vez. */
  raw(key: string, className: string, body: string, rank: number, selectorSuffix = ''): string {
    const k = `r|${key}`;
    if (!this.classes.has(k)) {
      this.classes.set(k, className);
      this.add(`.${className}${selectorSuffix}{${body}}`, rank);
    }
    return className;
  }

  /** CSS acumulado, na ordem de rank — para SSR (`<style>{getStyleText()}</style>`). */
  getText(): string {
    return this.variables + this.text.map((rules) => (rules ?? []).join('')).join('');
  }
}

export const sheet = new AtomicSheet();
