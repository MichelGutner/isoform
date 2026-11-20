/* eslint-disable @typescript-eslint/no-explicit-any */
import { warnOnce } from '../../core/dev';

/**
 * `content` de `::before`/`::after` no mobile.
 * - `undefined`: ausente → um elemento vazio (`View`), como na web (`content: ""`)
 * - `null`: `none`/`normal` ou algo sem equivalente (`attr()`, `url()`…) → não renderiza nada
 * - `string`: o texto a exibir (aspas e escapes do CSS são removidos)
 */
export function parseContent(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;

  const v = value.trim();
  if (v === '') return '';
  if (v === 'none' || v === 'normal') return null;
  if (/^(attr|counter|counters|url|image-set|var)\(/.test(v)) {
    warnOnce(`pseudo-content:${v}`, `content: ${v} has no equivalent on mobile; the pseudo-element was ignored.`);
    return null;
  }
  const quoted = /^(["'])([\s\S]*)\1$/.exec(v);
  if (quoted) {
    return quoted[2].replace(/\\A ?/g, '\n').replace(/\\(["'\\])/g, '$1');
  }
  return value; // texto puro: espaços nas pontas são significativos (` ›`)
}

/** Elemento gerado por `::before`/`::after`. */
export interface GeneratedNode {
  /** `''` → renderiza um `View` (decoração); com texto → um `Text`. */
  content: string;
  style: Record<string, any>;
}

/** O que cada pseudo-elemento vira no mobile (já normalizado). */
export interface NativePseudos {
  before?: GeneratedNode;
  after?: GeneratedNode;
  /** `::placeholder { color }` → `placeholderTextColor` do `Input`. */
  placeholderColor?: string;
  /** `::selection { backgroundColor }` → `selectionColor` do `Input`. */
  selectionColor?: string;
  /** `::first-letter` → estilo da primeira letra de um `Text` com texto simples. */
  firstLetter?: Record<string, any>;
}

/** Pseudo-elementos que só existem na web (ignorados no mobile, com um aviso em dev). */
export const WEB_ONLY_PSEUDOS = new Set([
  '::first-line',
  '::marker',
  '::scrollbar',
  '::scrollbar-thumb',
  '::scrollbar-track',
]);
