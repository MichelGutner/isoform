/* eslint-disable @typescript-eslint/no-empty-object-type */
import React, { forwardRef, useSyncExternalStore } from 'react';
import { getProvider, getThemeVariableKeys, isInlineEnabled } from '../config';
import { LRUCache } from '../cache/lru';
import { optimizedHash } from '../hash/optimizedHash';
import { beginPropReads, createReads, endPropReads, trackReads, type PropReads } from '../hash/trackReads';
import { getTheme, scopedTheme, themeStore } from '../theme/store';
import { beginThemeReads, endThemeReads, themeView, type ThemeProbe } from '../theme/variables';
import type { AnyComponent, BreakpointStyle, FlatStyle, PlatformAdapter, PseudoStyles, StateStyles } from './adapter';
import { getBreakpoints } from '../config';
import { evaluateCondition, isPseudoCondition, isStaticCondition, parseBreakpoint, stateOf } from './conditions';
import { warnOnce } from './dev';
import { flattenStyle } from './flatten';
import { mergeGestures, resolveGestures, type GestureConfig } from './gesture';
import { INLINE, isThemeFree, type InlineElement, type InlineFn } from './inline';
import { keyframes } from './keyframes';
import type { Condition, EngineComponent, PseudoName, StateName, StyleContext, StyleOrFn } from './types';

/** Entrada do cache: resultado já compilado para o adapter ativo. */
interface Computed {
  adapter: PlatformAdapter;
  compiled: unknown;
  mergedAttrs: Record<string, unknown>;
  /** `false` when no rule added props, so the render can reuse the caller's props object as is. */
  hasAttrs: boolean;
}

/** Dynamic styles are cached per theme, up to this many distinct prop combinations. */
const CACHE_LIMIT = 300;

let builderCount = 0;

/**
 * Cache key shared by every theme, for styles that do not depend on the theme object (they only read
 * CSS-variable tokens, see `theme/variables.ts`): a theme switch then keeps their cache.
 */
const ANY_THEME = {};

/** Snapshot of a component that does not follow the theme: never changes, so the store never re-renders it. */
const noTheme = () => 0;

/** Theme keys turned into CSS variables when none are configured: every theme read is a real value. */
const NO_VARIABLE_KEYS: readonly string[] = [];


/**
 * A style rule's style, or the `style` inside attrs: an object (returned as is), or a function of the
 * style context. The result only goes to `flattenStyle`, which takes any style shape.
 */
function resolveStyle<P>(style: unknown, ctx: StyleContext<P>): unknown {
  return typeof style === 'function' ? style(ctx) : style;
}

/** `animationName: { from, to }` (keyframes inline) → nome registrado via `keyframes()`. */
function resolveInlineKeyframes(style: FlatStyle): FlatStyle {
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
type Rule<C extends AnyComponent, P> =
  | { kind: 'style'; style: StyleOrFn<C, P> }
  | {
      kind: 'when';
      condition: Condition<P, StyleContext<P>>;
      attrs?:
        | Partial<React.ComponentPropsWithRef<C> & P>
        | ((ctx: StyleContext<P>) => Partial<React.ComponentPropsWithRef<C> & P>);
    }
  | { kind: 'attrs'; attrs: Partial<React.ComponentPropsWithRef<C> & P> }
  | { kind: 'gesture'; config: GestureConfig };

/** `true` for an attrs object (`attrs({ style })`, `when(…, { style, ref })`), `false` for an attrs function. */
const isAttrsObject = (attrs: unknown): attrs is Readonly<Record<string, unknown>> =>
  !!attrs && typeof attrs === 'object';

/** The `style` inside an attrs object; `undefined` for an attrs function. */
const styleOf = (attrs: unknown): unknown => (isAttrsObject(attrs) ? attrs.style : undefined);

/** A readable name for a component: its `displayName`, else its function/class name. */
const componentName = (component: AnyComponent): string | undefined =>
  component?.displayName || component?.name;

/** Every function a rule holds: a style function, a `when()` condition, an attrs function, a style inside attrs. */
const functionsOf = <C extends AnyComponent, P>(rule: Rule<C, P>): unknown[] => {
  const attrs = 'attrs' in rule ? rule.attrs : undefined;
  const candidates = [
    rule.kind === 'style' ? rule.style : undefined,
    rule.kind === 'when' ? rule.condition : undefined,
    attrs,
    styleOf(attrs),
  ];
  return candidates.filter((candidate) => typeof candidate === 'function');
};

/**
 * Base do componente: um nome de primitiva (`'Box'`, resolvido no render pelo
 * provedor ativo) ou qualquer componente React.
 */
export type BaseComponent<C> = C | string;

export class StylizedBuilder<C extends AnyComponent, P extends object> {
  private rules: Rule<C, P>[] = [];

  /** Cache por tema → (hash das props → resultado compilado). */
  private cacheByTheme = new WeakMap<object, LRUCache<string, Computed>>();

  /**
   * Props que as regras já leram. Só elas entram no hash: o resto (`testID`, `onPress`…) não muda o estilo.
   * Cresce no primeiro cache miss que lê uma prop nova; nesse momento o cache é zerado (ver `learn`).
   */
  private readKeys = new Set<string>();
  /** Alguma regra enumerou as props (`{ ...props }`): não dá para saber quais contam, então todas contam. */
  private readAll = false;
  private readonly id = ++builderCount;

  /**
   * `true` once a style rule read a real value from the theme (with `themeVariables` on, a value that is
   * not a CSS variable). Until then the styles do not depend on the theme: the cache is shared by every
   * theme and a theme switch does not re-render the component.
   * Sticky: when it flips, the caches built under "any theme" are dropped (see `resolveDynamic`).
   */
  private themeDependent = false;
  /** The variable keys `themeDependent` was learned under; a different `configure` starts over. */
  private variablesSignature = '';

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
   * @example when('platform:ios', { style: { shadowOpacity: 0.2 } })
   * @example when('props:variant=primary', { style: { backgroundColor: 'blue' } })
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

  /**
   * Declares the gestures the element recognizes (pan, swipe, pinch, rotate, double tap, long press).
   * Several calls merge, gesture by gesture (the last one wins). Needs the `gestures` module.
   */
  gesture(config: GestureConfig): this {
    this.rules.push({ kind: 'gesture', config });
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
    reads: PropReads | null,
  ): Computed {
    // resolved styles of every shape (objects, arrays, falsy values): `flattenStyle` merges them
    const styles: unknown[] = [];
    const stateStyles: Partial<Record<StateName, unknown[]>> = {};
    const bpStyles: Record<string, unknown[]> = {};
    const pseudoStyles: Partial<Record<PseudoName, unknown[]>> = {};
    const mergedAttrs: Record<string, unknown> = {};
    const gestureConfigs: GestureConfig[] = [];

    // Contexto reaproveitado entre as regras: só é refeito quando uma regra anterior adicionou props
    // (`attrsVersion`). As leituras de `props` ficam registradas em `reads` (ver `trackReads`).
    let attrsVersion = 0;
    let ctxVersion = -1;
    let ctx!: StyleContext<P>;

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];

      if (rule.kind === 'gesture') {
        // gestures do not depend on the context: they are collected and handed to the adapter with the style
        gestureConfigs.push(rule.config);
        continue;
      }

      if (ctxVersion !== attrsVersion) {
        const view = { ...mergedAttrs, ...props } as P;
        ctx = { theme, platform, props: reads ? trackReads(view) : view };
        ctxVersion = attrsVersion;
      }

      const state = rule.kind === 'when' ? stateOf(rule.condition) : null;
      if (rule.kind === 'when' && state) {
        // estados viram variantes compiladas pelo adapter (`:hover`, estado do Pressable…)
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs }: Readonly<Record<string, unknown>> = ruleAttrs;
          if (ruleStyle) (stateStyles[state] ??= []).push(resolveStyle(ruleStyle, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`state-attrs:${state}`, `when('state:${state}') only accepts { style }; the other props were ignored.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when' && isPseudoCondition(rule.condition)) {
        // pseudo-elementos: `::before` etc. viram variantes compiladas pelo adapter
        const name = rule.condition;
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs }: Readonly<Record<string, unknown>> = ruleAttrs;
          if (ruleStyle) (pseudoStyles[name] ??= []).push(resolveStyle(ruleStyle, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`pseudo-attrs:${name}`, `when('${name}') only accepts { style }; the other props were ignored.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when' && parseBreakpoint(rule.condition)) {
        // breakpoints viram variantes por largura mínima (`@media` na web, largura da janela no mobile)
        const name = rule.condition as string;
        const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
        if (ruleAttrs) {
          const { style: ruleStyle, ...restAttrs }: Readonly<Record<string, unknown>> = ruleAttrs;
          if (ruleStyle) (bpStyles[name] ??= []).push(resolveStyle(ruleStyle, ctx));
          if (Object.keys(restAttrs).length) {
            warnOnce(`bp-attrs:${name}`, `when('${name}') only accepts { style }; the other props were ignored.`);
          }
        }
        continue;
      }

      if (rule.kind === 'when') {
        if (evaluateCondition(rule.condition, ctx)) {
          const ruleAttrs = typeof rule.attrs === 'function' ? rule.attrs(ctx) : rule.attrs;
          if (ruleAttrs) {
            const { style: ruleStyle, ...restAttrs }: Readonly<Record<string, unknown>> = ruleAttrs;
            Object.assign(mergedAttrs, restAttrs);
            attrsVersion++;
            if (ruleStyle) styles.push(resolveStyle(ruleStyle, ctx));
          }
        }
      }

      if (rule.kind === 'style') {
        styles.push(resolveStyle(rule.style, ctx));
      }

      if (rule.kind === 'attrs') {
        const { style: attrStyle, ...restAttrs }: Readonly<Record<string, unknown>> = rule.attrs || {};
        Object.assign(mergedAttrs, restAttrs);
        attrsVersion++;
        if (attrStyle) styles.push(resolveStyle(attrStyle, ctx));
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

    const merged = resolveInlineKeyframes(flattenStyle(styles));
    // the 5th argument is only passed when gestures exist, so adapters written before `.gesture()` see the same call
    const gestures = gestureConfigs.length ? resolveGestures(mergeGestures(gestureConfigs)) : undefined;

    return {
      adapter,
      compiled: gestures
        ? adapter.compileStyle(merged, states, breakpoints, pseudos, gestures)
        : adapter.compileStyle(merged, states, breakpoints, pseudos),
      mergedAttrs,
      hasAttrs: attrsVersion > 0,
    };
  }

  /**
   * `true` quando nenhuma regra depende de props — o resultado só varia por
   * tema e dispensa hash/lookup por render.
   */
  private isStatic(): boolean {
    return this.rules.every((rule) => {
      if (rule.kind === 'style') return typeof rule.style !== 'function';
      if (rule.kind === 'attrs') return typeof styleOf(rule.attrs) !== 'function';
      if (rule.kind === 'gesture') return true;
      return (
        isStaticCondition(rule.condition) &&
        typeof rule.attrs !== 'function' &&
        typeof styleOf(rule.attrs) !== 'function'
      );
    });
  }

  /** `ref` estático vindo de `when(...).attrs({ ref })` (independe de props/tema). */
  private findStaticRef(): unknown {
    for (const rule of this.rules) {
      if (rule.kind === 'when' && isAttrsObject(rule.attrs) && rule.attrs.ref) return rule.attrs.ref;
    }
    return undefined;
  }

  /**
   * `build()` roda uma vez, antes do encadeamento `.style().when().attrs()`
   * (as regras são mutadas depois e lidas ao vivo pelo render — ver proxy.ts).
   * Por isso `isStatic`/`findStaticRef` são memoizados aqui, invalidados só
   * quando a lista de regras cresce.
   */
  private staticInfoCache: { length: number; isStatic: boolean; ref: unknown; inlinable: boolean } | null = null;

  private getStaticInfo() {
    if (!this.staticInfoCache || this.staticInfoCache.length !== this.rules.length) {
      const isStatic = this.isStatic();
      this.staticInfoCache = {
        length: this.rules.length,
        isStatic,
        ref: this.findStaticRef(),
        inlinable: isStatic || this.rules.every((rule) => functionsOf(rule).every(isThemeFree)),
      };
    }
    return this.staticInfoCache;
  }

  /** Registra o que uma compilação leu. `true` quando passou a depender de props que o hash ainda não via. */
  private learn(reads: PropReads): boolean {
    let grew = false;
    if (reads.all && !this.readAll) {
      this.readAll = true;
      grew = true;
    }
    for (const key of reads.keys) {
      if (!this.readKeys.has(key)) {
        this.readKeys.add(key);
        grew = true;
      }
    }
    return grew;
  }

  private hashOf(platform: string, props: P): string {
    return optimizedHash({ platform, props }, this.readAll ? null : this.readKeys);
  }

  /** Theme cache key: the theme itself, or `ANY_THEME` while the style never read a real theme value. */
  private cacheKey(theme: EngineTheme): object {
    return this.themeDependent ? (theme as object) : ANY_THEME;
  }

  /** Estilo dinâmico: cache por tema, chaveado pelas props que as regras leem. */
  private resolveDynamic(
    adapter: PlatformAdapter,
    theme: EngineTheme,
    variableKeys: readonly string[] | null,
    platform: string,
    props: P,
  ): Computed {
    const signature = variableKeys ? variableKeys.join(',') : '';
    if (signature !== this.variablesSignature) {
      this.variablesSignature = signature;
      this.themeDependent = false;
      this.cacheByTheme = new WeakMap();
    }

    let key = this.cacheKey(theme);
    let cache = this.cacheByTheme.get(key);
    if (!cache) {
      cache = new LRUCache(CACHE_LIMIT);
      this.cacheByTheme.set(key, cache);
    }

    let hash = this.hashOf(platform, props);
    const hit = cache.get(hash);
    if (hit && hit.adapter === adapter) return hit;

    const reads = createReads();
    const probe: ThemeProbe = { dependent: false };
    let computed: Computed;
    // as regras rodam de forma síncrona: as leituras de props (e do tema) vão para os registros ativos
    const previousReads = beginPropReads(reads);
    const previousProbe = beginThemeReads(probe);
    try {
      // The rules see a view of the theme that reports what they read (`dependent`). With CSS variables
      // the listed tokens are `var(--iso-…)` and do not count; without them every theme read counts.
      const seen = themeView(theme as object, variableKeys ?? NO_VARIABLE_KEYS) as EngineTheme;
      computed = this.computeFromRules(adapter, seen, platform, props, reads);
    } finally {
      endThemeReads(previousProbe);
      endPropReads(previousReads);
    }

    let stale = this.learn(reads);
    if (probe.dependent && !this.themeDependent) {
      // o estilo lê valores reais do tema: o que foi guardado como "vale para qualquer tema" não vale mais
      this.themeDependent = true;
      stale = true;
    }
    if (stale) {
      // as entradas antigas foram chaveadas com menos props (ou com menos tema) do que o estilo realmente usa
      this.cacheByTheme = new WeakMap();
      key = this.cacheKey(theme);
      cache = new LRUCache(CACHE_LIMIT);
      this.cacheByTheme.set(key, cache);
      hash = this.hashOf(platform, props); // agora com as props novas
    }
    cache.set(hash, computed);

    if (cache.evictions > 0) this.warnThrashing();
    return computed;
  }

  /** A function marked theme-free read the theme: rendered inline, the component cannot follow theme switches. */
  private warnThemeFreeRead(): void {
    warnOnce(
      `theme-free-read:${this.id}`,
      'a style marked `themeFree` read the theme. Rendered without the wrapper component, it does not follow ' +
        'theme changes. Remove `themeFree` from that function (or read the theme only in rules that are not marked).',
    );
  }

  /** O aviso de thrash já foi decidido para este builder (a mensagem não é montada a cada miss). */
  private thrashWarned = false;

  private warnThrashing(): void {
    if (this.thrashWarned) return;
    this.thrashWarned = true;
    const name = typeof this.Base === 'string' ? this.Base : componentName(this.Base);
    warnOnce(
      `cache-thrash:${this.id}`,
      `the style of "${name ?? 'component'}" reads props with more than ${CACHE_LIMIT} value combinations and is recompiled on every render. ` +
        'Props that change all the time (position, progress, time) belong in `style` or an animation, not in style rules.',
    );
  }

  build(): EngineComponent<C, P> {
    const primitive = typeof this.Base === 'string' ? this.Base : undefined;
    // Sem função nas regras o resultado não depende do tema nem das props: um único resultado por adapter.
    let staticResult: Computed | undefined;

    /** What the component renders for `props`: no hooks, so the JSX runtime can call it too (see `inline`). */
    const resolve = (props: Readonly<Record<string, unknown>>, ref: unknown): InlineElement => {
      const adapter = getProvider();
      const platform = adapter.os();
      const { isStatic, ref: staticRef } = this.getStaticInfo();
      // tema como variáveis CSS (web, opt-in): só com um adapter que escreve as variáveis no `:root`
      const variableKeys = adapter.applyThemeVariables ? getThemeVariableKeys() : null;
      // tema da requisição (servidor, `runWithTheme`) ou o global; a assinatura vem depois, quando já se sabe se o estilo depende do tema.
      // Both go through the same path (the same `var(--iso-…)` or values the client compiles), so the classes match.
      const theme = scopedTheme() ?? getTheme();

      let result: Computed | undefined;

      if (isStatic) {
        result = staticResult;
        if (!result || result.adapter !== adapter) {
          result = this.computeFromRules(adapter, theme, platform, props as P, null);
          staticResult = result;
        }
      } else {
        result = this.resolveDynamic(adapter, theme, variableKeys, platform, props as P);
      }

      const { style: userStyle, ...restProps } = props;

      const Base = this.Base;
      // a primitive the active provider does not have is a missing key: `undefined`, checked below
      const Component: AnyComponent | undefined = typeof Base === 'string' ? adapter.primitives[Base] : Base;

      if (!Component) {
        throw new Error(
          `[isoform] ISO007: the primitive "${primitive}" does not exist in the provider "${adapter.name}".`,
        );
      }

      // `restProps` já é uma cópia só deste render: sem props das regras, dispensa copiar de novo
      const input = result.hasAttrs ? { ...result.mergedAttrs, ...restProps } : restProps;
      const finalProps = adapter.applyProps({ primitive, compiled: result.compiled, props: input, userStyle });

      const Final = adapter.resolveComponent
        ? adapter.resolveComponent(Component, result.compiled)
        : Component;

      // Os adapters devolvem o objeto que receberam (uma cópia deste render): o `ref` vai nele, sem outra cópia.
      // Um adapter que devolva outro objeto (talvez compartilhado) é copiado antes, por segurança.
      const element = finalProps === input ? finalProps : { ...finalProps };
      element.ref = staticRef !== undefined ? staticRef : ref;
      return { type: Final, props: element };
    };

    const StylizedComponent: React.ForwardRefExoticComponent<Record<string, unknown>> & { [INLINE]?: InlineFn } =
      forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      const { type, props: element } = resolve(props, ref);
      // Only a style that read a real theme value re-renders on a theme switch; for the others the
      // snapshot is constant. Always exactly one hook.
      const followsTheme = !this.getStaticInfo().isStatic && this.themeDependent;
      const snapshot: () => unknown = followsTheme ? getTheme : noTheme;
      useSyncExternalStore(themeStore.subscribe, snapshot, snapshot);
      return React.createElement(type, element);
    });

    /**
     * Called by the isoform JSX runtime instead of creating a `<Stylized>` element: a style that never
     * reads the theme needs no hook, so the element can be the component underneath, with no wrapper.
     */
    const inline: InlineFn = (props) => {
      if (!isInlineEnabled() || !this.getStaticInfo().inlinable) return null;
      const element = resolve(props, props.ref);
      if (this.themeDependent) this.warnThemeFreeRead();
      return element;
    };

    StylizedComponent[INLINE] = inline;

    StylizedComponent.displayName = `Stylized(${
      typeof this.Base === 'string' ? this.Base : componentName(this.Base) || 'Component'
    })`;

    // Sem `memo` de propósito. Medido numa lista de 500 linhas (cada linha repassa `children` novos),
    // o `memo` não consegue pular nada, adiciona uma fibra por componente (~+1 µs na montagem) e deixa a
    // atualização ~10% mais lenta. Quem tem props estáveis memoiza a própria linha, ou deixa o React Compiler fazer.
    return StylizedComponent as unknown as EngineComponent<C, P>;
  }
}

export function stylized<C extends AnyComponent>(
  component: BaseComponent<C>,
): StylizedBuilder<C, {}> {
  return new StylizedBuilder<C, {}>(component);
}
