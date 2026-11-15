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

/** The `engine()` function: three overloads, one per kind of base component. */
export interface Engine {
  /**
   * Styles a universal primitive (`'Box'`, `'Text'`, `'Pressable'`, `'Input'`,
   * `'Image'`, `'Scroll'`, `'Video'`, `'Audio'`) or a legacy React Native name (`'View'`…).
   * @param component The primitive name (see `OmniPrimitives`).
   * @param style An optional initial style: an object, or a function of `{ theme, props, platform }`.
   * @typeParam P Custom props of the new component (they become `when()` conditions such as `'props:variant=primary'`).
   */
  <K extends keyof OmniPrimitives, P extends object = {}>(
    component: K,
    style?: StyleOrFn<PrimitiveComponent<K>, P>,
  ): EngineComponent<PrimitiveComponent<K>, P>;

  /**
   * Builds on another `engine()` component (composition): inherits its rules and custom props.
   * @param component An existing engine component.
   * @param style An optional extra style, applied after the inherited ones.
   * @typeParam P Extra custom props, added to the inherited ones.
   */
  <C extends { __engine: true }, P extends object = {}>(
    component: C,
    style?: StyleOrFn<ExtractComponent<C>, P & ExtractProps<C>>,
  ): EngineComponent<ExtractComponent<C>, P & ExtractProps<C>>;

  /**
   * Styles any React component, including third-party ones. It receives the
   * style through its `style` prop (native) or `className` + `style` (web).
   * @param component Any React component.
   * @param style An optional initial style: an object, or a function of `{ theme, props, platform }`.
   * @typeParam P Custom props of the new component.
   */
  <C extends ComponentType<any>, P extends object = {}>(
    component: C,
    style?: StyleOrFn<C, P>,
  ): EngineComponent<C, P>;
}

/**
 * Creates styled components that work with any provider (React Native or React DOM).
 *
 * A primitive name (`engine('Box')`) is only resolved **at render time**, by the
 * active provider, so components can be defined before `configure()` runs.
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
 *   .when('props:disabled', { style: { opacity: 0.5 } })
 *   .when('platform:web', { style: { cursor: 'pointer' } });
 */
export const engine = ((component: any, style?: any) => {
  const builder = new StylizedBuilder<any, any>(component);
  const proxy = makeProxy(builder.build() as any, builder as any) as any;
  return style ? proxy.style(style) : proxy;
}) as Engine;
