/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import { StylizedBuilder } from './builder';
import type { OmniPrimitives } from './primitives';
import { makeProxy } from './proxy';
import type { EngineComponent, StyleOrFn } from './types';

type PrimitiveComponent<K extends keyof OmniPrimitives> = ComponentType<OmniPrimitives[K]>;

type ExtractComponent<T> = T extends { __engine: true; __component: infer C }
  ? C extends ComponentType<any>
    ? C
    : never
  : T extends ComponentType<any>
    ? T
    : never;

type ExtractProps<T> = T extends { __engine: true; __props: infer P } ? P : {};

export interface Engine {
  /** Primitiva universal (`'Box'`, `'Text'`, `'Pressable'`…) ou nome legado do RN. */
  <K extends keyof OmniPrimitives, P extends object = {}>(
    component: K,
    style?: StyleOrFn<PrimitiveComponent<K>, P>,
  ): EngineComponent<PrimitiveComponent<K>, P>;

  /** Outro componente do engine (composição). */
  <C extends { __engine: true }, P extends object = {}>(
    component: C,
    style?: StyleOrFn<ExtractComponent<C>, P & ExtractProps<C>>,
  ): EngineComponent<ExtractComponent<C>, P & ExtractProps<C>>;

  /** Qualquer componente React (inclusive de terceiros). */
  <C extends ComponentType<any>, P extends object = {}>(
    component: C,
    style?: StyleOrFn<C, P>,
  ): EngineComponent<C, P>;
}

/**
 * Cria componentes estilizados que funcionam em qualquer provedor.
 *
 * Um nome de primitiva (`engine('Box')`) só é resolvido **no render**, pelo
 * provedor ativo — por isso os componentes podem ser definidos antes do
 * `configure()` rodar.
 *
 * @example
 * const Card = engine('Box', ({ theme }) => ({
 *   padding: theme.spacing.md,
 *   borderRadius: 12,
 *   boxShadow: '0 2px 8px rgba(0,0,0,.1)',
 * }));
 *
 * const Button = engine('Pressable')
 *   .style({ paddingInline: '1rem' })
 *   .when('disabled', { style: { opacity: 0.5 } })
 *   .when('web', { style: { cursor: 'pointer' } });
 */
export const engine = ((component: any, style?: any) => {
  const builder = new StylizedBuilder<any, any>(component);
  const proxy = makeProxy(builder.build() as any, builder as any) as any;
  return style ? proxy.style(style) : proxy;
}) as Engine;
