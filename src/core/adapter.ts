/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import type { PseudoName, StateName } from './types';

/** Estilos por pseudo-elemento (`'::before'`…), já mesclados em objetos planos. */
export type PseudoStyles = Partial<Record<PseudoName, Record<string, any>>>;

/** Variante por faixa de largura, já mesclada em objeto plano. Chega ordenada por `min` crescente. */
export interface BreakpointStyle {
  name: string;
  /** Largura mínima em px (mobile-first); 0 para `'<md'`. */
  min: number;
  /** Largura máxima em px, EXCLUSIVA (`'<md'`, `'sm..lg'`). */
  max?: number;
  /** Posição global da faixa (ordem estável de regras CSS entre componentes; faixas com `max` vêm depois). */
  order: number;
  style: Record<string, any>;
}

/** Estilos por estado de interação (já mesclados em objetos planos). */
export type StateStyles = Partial<Record<StateName, Record<string, any>>>;

export interface ApplyPropsInput {
  /** Nome da primitiva (`'Box'`, `'Pressable'`…) ou `undefined` para componentes arbitrários. */
  primitive?: string;
  /** Resultado de `compileStyle` (já cacheado pelo builder). */
  compiled: unknown;
  /** `attrs`/`when` + props do usuário, SEM a prop `style`. */
  props: Record<string, any>;
  /** Prop `style` passada pelo usuário no uso do componente. */
  userStyle: unknown;
}

/**
 * Contrato que cada plataforma implementa. O core não sabe nada de
 * `react-native` nem de `react-dom`: tudo que é específico passa por aqui.
 */
export interface PlatformAdapter {
  /** Nome usado em `configure({ provider })`. */
  readonly name: 'react-native' | 'react' | (string & {});
  /** Alimenta `when('ios' | 'android' | 'web' | 'native')`. */
  os(): string;
  /** Nome neutro da primitiva (`'Box'`) → componente real da plataforma. */
  readonly primitives: Record<string, ComponentType<any>>;
  /**
   * Estilo já mesclado (objeto plano) → representação final da plataforma.
   * Roda uma vez por combinação (tema, props) — o builder cacheia o resultado.
   */
  compileStyle(
    style: Record<string, any>,
    states?: StateStyles,
    breakpoints?: BreakpointStyle[],
    pseudos?: PseudoStyles,
  ): unknown;
  /**
   * Monta as props finais do componente base. Roda a cada render, então
   * precisa ser barato (o trabalho pesado fica em `compileStyle`).
   */
  applyProps(input: ApplyPropsInput): Record<string, any>;
  /**
   * Opcional: troca o componente base conforme o estilo compilado (ex.: no
   * mobile, um host animado quando há `animation`). Deve devolver a MESMA
   * referência para a mesma entrada, senão o React remonta a árvore.
   */
  resolveComponent?(component: ComponentType<any>, compiled: unknown): ComponentType<any>;
  /** SSR: CSS acumulado até agora (só plataformas que geram CSS). */
  getStyleText?(): string;
}
