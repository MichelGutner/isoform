/* eslint-disable @typescript-eslint/no-explicit-any */
import { stringHash } from '../hash/stringHash';
import type { OmniStyle } from './style/types';

/** Seletor de quadro: `'from'`, `'to'`, `'50%'` ou lista (`'0%, 100%'`). */
export type KeyframeSelector = 'from' | 'to' | `${number}%` | (string & {});

/** Quadros de uma animação, com o mesmo vocabulário de estilo do resto da lib. */
export type Keyframes = Partial<Record<KeyframeSelector, OmniStyle>>;

/** Prefixo dos nomes gerados (`o-kf-<hash>`). */
export const KEYFRAMES_PREFIX = 'o-kf-';

const registry = new Map<string, Keyframes>();

/**
 * Declara uma animação e devolve o nome para usar em `animation`/`animationName`.
 * Funciona nas duas plataformas: `@keyframes` na web, `Animated` no mobile.
 *
 * Não depende do provedor ativo: só guarda a definição. Cada adapter a
 * materializa quando um estilo que usa o nome é compilado — por isso pode ser
 * chamada no topo do módulo, antes de `configure()`.
 *
 * @example
 * const pulse = keyframes({ from: { opacity: 1 }, to: { opacity: 0.3 } });
 * const Dot = engine('Box', { animation: `${pulse} 1s ease-in-out infinite alternate` });
 *
 * O nome é derivado do conteúdo (determinístico, seguro para SSR).
 */
export function keyframes(frames: Keyframes): string {
  const name = `${KEYFRAMES_PREFIX}${stringHash(JSON.stringify(frames)).toString(36)}`;
  registry.set(name, frames);
  return name;
}

/** Definição registrada por `keyframes()` (para os adapters). */
export function getKeyframes(name: string): Record<string, Record<string, any>> | undefined {
  return registry.get(name) as Record<string, Record<string, any>> | undefined;
}

/** Nomes de keyframes citados num valor CSS (`'o-kf-abc 1s ease'`). */
export function keyframeNamesIn(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.match(/o-kf-[a-z0-9]+/g) ?? [];
}
