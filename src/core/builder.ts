/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef } from 'react';
import { getProvider } from '../config';
import { LRUCache } from '../cache/lru';
import { optimizedHash } from '../hash/optimizedHash';
import { useTheme } from '../theme';
import type { BreakpointStyle, PlatformAdapter, PseudoStyles, StateStyles } from './adapter';
import { getBreakpoints } from '../config';
import { evaluateCondition, isPseudoCondition, isStateCondition, isStaticCondition, parseBreakpoint } from './conditions';
import { warnOnce } from './dev';
import { flattenStyle } from './flatten';
import { keyframes } from './keyframes';
import type {
  Condition,
  EngineComponent,
  PseudoName,
  StateName,
  StyleContext,
  StyleFn,
  StyleObject,
  StyleOrFn,
} from './types';

/** Entrada do cache: resultado já compilado para o adapter ativo. */
interface Computed {
  adapter: PlatformAdapter;
  compiled: unknown;
  mergedAttrs: Record<string, any>;
}

function resolveStyle<C extends React.ComponentType<any>, P>(
  style: StyleOrFn<C, P>,
  ctx: StyleContext<P>,
): StyleObject<C> {
  return typeof style === 'function' ? ((style as StyleFn<C, P>)(ctx) as StyleObject<C>) : style;
}

/** `animationName: { from, to }` (keyframes inline) → nome registrado via `keyframes()`. */
function resolveInlineKeyframes(style: Record<string, any>): Record<string, any> {
  const name = style.animationName;
  if (name && typeof name === 'object') {
    const list = Array.isArray(name) ? name : [name];
    style.animationName = list
      .map((frames) => (typeof frames === 'string' ? frames : keyframes(frames)))
      .join(', ');
  }
  return style;
}

/**
 * Regra interna do builder:
 * - style: define estilos
 * - when: atributos/estilos condicionais
 * - attrs: props fixas
 */
type Rule<C extends React.ComponentType<any>, P> =
  | { kind: 'style'; style: StyleOrFn<C, P> }
  | {
      kind: 'when';
      condition: Condition<P, StyleContext<P>>;
      attrs?:
        | Partial<React.ComponentPropsWithRef<C> & P>
        | ((ctx: StyleContext<P>) => Partial<React.ComponentPropsWithRef<C> & P>);
    }
  | { kind: 'attrs'; attrs: Partial<React.ComponentPropsWithRef<C> & P> };

/**
 * Base do componente: um nome de primitiva (`'Box'`, resolvido no render pelo
 * provedor ativo) ou qualquer componente React.
 */
export type BaseComponent<C> = C | string;

export class StylizedBuilder<C extends React.ComponentType<any>, P extends object> {
  private rules: Rule<C, P>[] = [];

  /** Cache por tema → (hash das props → resultado compilado). */
  private cacheByTheme = new WeakMap<any, LRUCache<string, Computed>>();

  constructor(
    private readonly Base: BaseComponent<C>,
    baseRules: Rule<C, P>[] = [],
  ) {
    this.rules = [...baseRules];
  }

  /** Adiciona uma regra de estilo (objeto ou função de `{ theme, props, platform }`). */
  style(styleOrFn: StyleOrFn<C, P>): this {
    this.rules.push({ kind: 'style', style: styleOrFn });
    return this;
  }

  /**
   * Adiciona uma regra condicional.
   *
   * @example when('ios', { style: { shadowOpacity: 0.2 } })
   * @example when('variant:primary', { style: { backgroundColor: 'blue' } })
   * @example when(({ props }) => props.size > 40, { style: { opacity: 0.5 } })
   */
  when(
    condition: Condition<P, StyleContext<P>>,
    attrs?:
      | Partial<React.ComponentPropsWithRef<C> & P>
      | ((ctx: StyleContext<P>) => Partial<React.ComponentPropsWithRef<C> & P>),
  ): this {
    this.rules.push({ kind: 'when', condition, attrs });
    return this;
  }

  /** Adiciona props fixas (acessibilidade, testID, roles…). */
  attrs(attrs: Partial<React.ComponentPropsWithRef<C> & P>): this {
    this.rules.push({ kind: 'attrs', attrs });
    return this;
  }

  /** "Clona + adiciona": copia as regras atuais sem alterar o original. */
  extend(): StylizedBuilder<C, P> {
    return new StylizedBuilder<C, P>(this.Base, [...this.rules]);
  }

  /** Roda as regras para um contexto, produzindo estilo mesclado + attrs. */
  private computeFromRules(
    adapter: PlatformAdapter,
    theme: EngineTheme,
    platform: string,
    props: P,
  ): Computed {
    const styles: StyleObject<C>[] = [];
    const stateStyles: Partial<Record<StateName, StyleObject<C>[]>> = {};
    const bpStyles: Record<string, StyleObject<C>[]> = {};
    const pseudoStyles: Partial<Record<PseudoName, StyleObject<C>[]>> = {};
    const mergedAttrs: Record<string, any> = {};

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];

      const ctx: StyleContext<P> = {
        theme,
        platform,
        props: { ...mergedAttrs, ...props } as P,
      };

      if (rule.kind === 'when' && isStateCondition(rule.condition)) {
        // estados viram variantes compiladas pelo adapter (`:hover`, estado do Pressable…)
        const state = rule.condition;
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs } = ruleAttrs as any;
          if (ruleStyle) (stateStyles[state] ??= []).push(resolveStyle(ruleStyle as StyleOrFn<C, P>, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`state-attrs:${state}`, `when('${state}') só aceita { style }; as demais props foram ignoradas.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when' && isPseudoCondition(rule.condition)) {
        // pseudo-elementos: `::before` etc. viram variantes compiladas pelo adapter
        const name = rule.condition;
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs } = ruleAttrs as any;
          if (ruleStyle) (pseudoStyles[name] ??= []).push(resolveStyle(ruleStyle as StyleOrFn<C, P>, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`pseudo-attrs:${name}`, `when('${name}') só aceita { style }; as demais props foram ignoradas.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when' && parseBreakpoint(rule.condition)) {
        // breakpoints viram variantes por largura mínima (`@media` na web, largura da janela no mobile)
        const name = rule.condition as string;
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs } = ruleAttrs as any;
          if (ruleStyle) (bpStyles[name] ??= []).push(resolveStyle(ruleStyle as StyleOrFn<C, P>, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`bp-attrs:${name}`, `when('${name}') só aceita { style }; as demais props foram ignoradas.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when') {
        if (evaluateCondition(rule.condition, ctx)) {
          const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
          if (ruleAttrs) {
            const { style: ruleStyle, ...restAttrs } = ruleAttrs as any;
            Object.assign(mergedAttrs, restAttrs);
            if (ruleStyle) styles.push(resolveStyle(ruleStyle as StyleOrFn<C, P>, ctx));
          }
        }
      }

      if (rule.kind === 'style') {
        styles.push(resolveStyle(rule.style, ctx));
      }

      if (rule.kind === 'attrs') {
        const { style: attrStyle, ...restAttrs } = (rule?.attrs || {}) as any;
        Object.assign(mergedAttrs, restAttrs);
        if (attrStyle) styles.push(resolveStyle(attrStyle as StyleOrFn<C, P>, ctx));
      }
    }

    let states: StateStyles | undefined;
    for (const key in stateStyles) {
      const state = key as StateName;
      (states ??= {})[state] = resolveInlineKeyframes(flattenStyle(stateStyles[state]));
    }

    let pseudos: PseudoStyles | undefined;
    for (const key in pseudoStyles) {
      const name = key as PseudoName;
      (pseudos ??= {})[name] = resolveInlineKeyframes(flattenStyle(pseudoStyles[name]));
    }

    let breakpoints: BreakpointStyle[] | undefined;
    const names = Object.keys(bpStyles);
    if (names.length) {
      // ordem global das faixas: por largura mínima; dentro da mesma, as limitadas por `max` depois
      const mins = [0, ...new Set(Object.values(getBreakpoints()))].sort((a, b) => a - b);
      breakpoints = names
        .map((name) => {
          const { min, max } = parseBreakpoint(name)!;
          return {
            name,
            min,
            ...(max !== undefined ? { max } : null),
            order: mins.indexOf(min) * 2 + (max !== undefined ? 1 : 0),
            style: resolveInlineKeyframes(flattenStyle(bpStyles[name])),
          };
        })
        .sort((a, b) => a.min - b.min || (b.max ?? Infinity) - (a.max ?? Infinity) || a.name.localeCompare(b.name));
    }

    return {
      adapter,
      compiled: adapter.compileStyle(resolveInlineKeyframes(flattenStyle(styles)), states, breakpoints, pseudos),
      mergedAttrs,
    };
  }

  /**
   * `true` quando nenhuma regra depende de props — o resultado só varia por
   * tema e dispensa hash/lookup por render.
   */
  private isStatic(): boolean {
    return this.rules.every((rule) => {
      if (rule.kind === 'style') return typeof rule.style !== 'function';
      if (rule.kind === 'attrs') return typeof (rule.attrs as any)?.style !== 'function';
      return (
        isStaticCondition(rule.condition) &&
        typeof rule.attrs !== 'function' &&
        typeof (rule.attrs as any)?.style !== 'function'
      );
    });
  }

  /** `ref` estático vindo de `when(...).attrs({ ref })` (independe de props/tema). */
  private findStaticRef(): unknown {
    for (const rule of this.rules) {
      if (rule.kind === 'when' && (rule.attrs as any)?.ref) return (rule.attrs as any).ref;
    }
    return undefined;
  }

  /**
   * `build()` roda uma vez, antes do encadeamento `.style().when().attrs()`
   * (as regras são mutadas depois e lidas ao vivo pelo render — ver proxy.ts).
   * Por isso `isStatic`/`findStaticRef` são memoizados aqui, invalidados só
   * quando a lista de regras cresce.
   */
  private staticInfoCache: { length: number; isStatic: boolean; ref: unknown } | null = null;

  private getStaticInfo() {
    if (!this.staticInfoCache || this.staticInfoCache.length !== this.rules.length) {
      this.staticInfoCache = {
        length: this.rules.length,
        isStatic: this.isStatic(),
        ref: this.findStaticRef(),
      };
    }
    return this.staticInfoCache;
  }

  build(): EngineComponent<C, P> {
    const primitive = typeof this.Base === 'string' ? this.Base : undefined;
    const staticCacheByTheme = new WeakMap<any, Computed>();

    const StylizedComponent = forwardRef<unknown, React.ComponentProps<C> & P>((props, ref) => {
      const theme = useTheme();
      const adapter = getProvider();
      const platform = adapter.os();
      const { isStatic, ref: staticRef } = this.getStaticInfo();

      let result: Computed | undefined;

      if (isStatic) {
        result = staticCacheByTheme.get(theme);
        if (!result || result.adapter !== adapter) {
          result = this.computeFromRules(adapter, theme, platform, props as P);
          staticCacheByTheme.set(theme, result);
        }
      } else {
        const hash = optimizedHash({ theme, props: props as P, platform });

        let cache = this.cacheByTheme.get(theme);
        if (!cache) {
          cache = new LRUCache(300);
          this.cacheByTheme.set(theme, cache);
        }

        result = cache.get(hash);
        if (!result || result.adapter !== adapter) {
          result = this.computeFromRules(adapter, theme, platform, props as P);
          cache.set(hash, result);
        }
      }

      const { style: userStyle, ...restProps } = props as any;

      const Component = primitive
        ? (adapter.primitives[primitive] as React.ComponentType<any> | undefined)
        : (this.Base as React.ComponentType<any>);

      if (!Component) {
        throw new Error(
          `[omnistyle] a primitiva "${primitive}" não existe no provedor "${adapter.name}".`,
        );
      }

      const finalProps = adapter.applyProps({
        primitive,
        compiled: result.compiled,
        props: { ...result.mergedAttrs, ...restProps },
        userStyle,
      });

      const Final = adapter.resolveComponent
        ? adapter.resolveComponent(Component, result.compiled)
        : Component;

      return React.createElement(Final, {
        ...finalProps,
        ref: staticRef !== undefined ? staticRef : ref,
      });
    });

    const base: any = this.Base;
    StylizedComponent.displayName = `Stylized(${
      typeof base === 'string' ? base : base?.displayName || base?.name || 'Component'
    })`;

    return StylizedComponent as unknown as EngineComponent<C, P>;
  }
}

export function stylized<C extends React.ComponentType<any>>(
  component: BaseComponent<C>,
): StylizedBuilder<C, {}> {
  return new StylizedBuilder<C, {}>(component);
}
