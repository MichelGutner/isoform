/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { ComponentPropsWithRef, ComponentType, ForwardRefExoticComponent } from 'react';
import type { OmniStyle } from './style/types';

/** Plataformas que `when()` entende. `'native'` = qualquer uma que não seja web. */
export type Platform = 'ios' | 'android' | 'web' | 'native';

export interface BaseStyleContext<P> {
  theme: EngineTheme;
  props: P;
  platform?: string;
}

/** Contexto entregue às funções de estilo/condição (a plataforma é sempre conhecida). */
export interface StyleContext<P> extends BaseStyleContext<P> {
  platform: string;
}

export type PropConditionKeys<P> =
  P extends Record<string, any>
    ? {
        [K in keyof P]-?: NonNullable<P[K]> extends string | number | boolean
          ? NonNullable<P[K]> extends boolean
            ? `${string & K}` | `${string & K}:true` | `${string & K}:false`
            :
                | `${string & K}`
                | `${string & K}:${NonNullable<P[K]> extends string | number ? NonNullable<P[K]> : never}`
          : never;
      }[keyof P]
    : P;

/**
 * Estados de interação. Não são booleanos avaliados no render: o estilo dentro
 * de `when('hover', …)` é compilado como variante (`:hover` na web, estado do
 * componente no mobile). Têm prioridade sobre props com o mesmo nome.
 */
export type StateName = HoverState | 'focus' | 'focus-visible' | 'pressed';

/** @platform web — o toque não tem hover: no mobile é ignorado. */
export type HoverState = 'hover';

/**
 * Pseudo-elementos que funcionam nas DUAS plataformas (`when('::before', { style })`):
 * - `'::before'` / `'::after'`: web = CSS; mobile = um filho gerado (`Text` se houver `content`, senão `View`)
 * - `'::placeholder'`: web = CSS; mobile = `placeholderTextColor` do `Input` (usa `color`)
 * - `'::selection'`: web = CSS; mobile = `selectionColor` do `Input` (usa `backgroundColor`)
 * - `'::first-letter'`: web = CSS; mobile = primeira letra de um `Text` com texto simples
 */
export type UniversalPseudoName =
  | '::before'
  | '::after'
  | '::placeholder'
  | '::selection'
  | '::first-letter';

/**
 * Pseudo-elementos que só existem na web.
 * @platform web — no mobile são ignorados (com um aviso em desenvolvimento).
 * As barras de rolagem usam os seletores `::-webkit-scrollbar*` (Chrome, Edge, Safari).
 */
export type WebOnlyPseudoName =
  | '::first-line'
  | '::marker'
  | '::scrollbar'
  | '::scrollbar-thumb'
  | '::scrollbar-track';

export type PseudoName = UniversalPseudoName | WebOnlyPseudoName;

/**
 * Nomes de breakpoint (mobile-first: `when('md')` vale de `md` para cima).
 * Os valores vêm de `configure({ breakpoints })`. Para tipar nomes próprios,
 * augmente: `declare module 'omnistyle' { interface OmniBreakpointNames { tablet: unknown } }`
 */
export interface OmniBreakpointNames {
  sm: unknown;
  md: unknown;
  lg: unknown;
  xl: unknown;
}

export type ConditionString<P> =
  | Platform
  | StateName
  | PseudoName
  | keyof OmniBreakpointNames
  | PropConditionKeys<P>;
export type ConditionFn<Ctx> = (ctx: Ctx) => boolean;

export type Condition<P, Ctx = BaseStyleContext<P>> =
  | ConditionString<P> // 'ios' | 'android' | 'web' | 'native' | 'prop:value'
  | ConditionFn<Ctx> // (ctx) => boolean
  | boolean // true | false
  | (string & NonNullable<unknown>); // fallback string support

/* ───────────────────────── estilo ───────────────────────── */

export type ExtractStyle<C extends ComponentType<any>> =
  ComponentPropsWithRef<C> extends { style?: infer S }
    ? Exclude<S, (...args: any[]) => any>
    : never;

/** Tipo de estilo aceito pelo componente (cai para `OmniStyle` quando não dá para inferir). */
export type ComponentStyle<C extends ComponentType<any>> = [ExtractStyle<C>] extends [never]
  ? OmniStyle
  : ExtractStyle<C>;

export type StyleObject<C extends ComponentType<any>> = ComponentStyle<C>;

/**
 * O que uma função de estilo devolve: só o tipo de OBJETO (sem arrays, `false`
 * ou `null`). Um retorno que é uma união com esses tipos faz o TypeScript
 * alargar literais (`flexDirection: 'row'` virava `string`).
 */
export type ObjectStyle<C extends ComponentType<any>> = Exclude<
  Extract<ComponentStyle<C>, object>,
  readonly any[]
>;

export type StyleFn<C extends ComponentType<any>, P> = (ctx: StyleContext<P>) => ObjectStyle<C>;

export type StyleOrFn<C extends ComponentType<any>, P> = StyleObject<C> | StyleFn<C, P>;

/* ───────────────────────── componente ───────────────────────── */

export interface BaseEngineComponent<C extends ComponentType<any>, P extends object = {}>
  extends ForwardRefExoticComponent<ComponentPropsWithRef<C> & P> {
  /**
   * Aplica atributos quando a condição é verdadeira.
   *
   * Condições: plataforma (`'ios' | 'android' | 'web' | 'native'`), valor de prop
   * (`'variant:primary'`), prop booleana (`'disabled'`), função `(ctx) => boolean`
   * ou booleano.
   */
  when(
    condition: Condition<P, StyleContext<P>>,
    attrs:
      | Partial<ComponentPropsWithRef<C> & P>
      | ((ctx: StyleContext<P>) => Partial<ComponentPropsWithRef<C> & P>),
  ): EngineComponent<C, P>;

  /** Aplica atributos incondicionalmente. */
  attrs(attrs: Partial<ComponentPropsWithRef<C> & P>): EngineComponent<C, P>;

  /** Aplica um estilo (objeto ou função de `{ theme, props, platform }`). */
  style(s: StyleFn<C, P>): EngineComponent<C, P>;
  style(s: StyleObject<C>): EngineComponent<C, P>;

  /** Clona as regras atuais para criar uma variação sem alterar o original. */
  extend(): EngineComponent<C, P>;
}

export type EngineComponent<C extends ComponentType<any>, P extends object = {}> =
  BaseEngineComponent<C, P> & {
    __engine: true;
    __component: C;
    __props: P;
  };
