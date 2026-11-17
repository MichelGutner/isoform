/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { ComponentPropsWithRef, ComponentType, ForwardRefExoticComponent } from 'react';
import type { IsoStyle } from './style/types';

/* ───────────────────────── conditions ───────────────────────── */

/**
 * Platform names.
 * - `'ios'`: iOS.
 * - `'android'`: Android.
 * - `'web'`: the web (React DOM).
 * - `'native'`: any platform that is not the web (iOS and Android).
 */
export type Platform = 'ios' | 'android' | 'web' | 'native';

/**
 * Platform condition for `when()`: `'platform:ios'`, `'platform:android'`,
 * `'platform:web'` or `'platform:native'` (iOS and Android).
 */
export type PlatformCondition = `platform:${Platform}`;

/** Context passed to style functions and condition functions. */
export interface BaseStyleContext<P> {
  /** The active theme (`EngineTheme`), as set by `configure({ theme })` / `updateTheme`. */
  theme: EngineTheme;
  /** The props the component was rendered with (including the custom ones declared in `engine<…, P>`). */
  props: P;
  /** The current platform (`'ios' | 'android' | 'web'`, or a custom adapter name). May be absent before resolution. */
  platform?: string;
}

/** Same as {@link BaseStyleContext}, but the platform is always resolved. */
export interface StyleContext<P> extends BaseStyleContext<P> {
  /** The current platform (`'ios' | 'android' | 'web'`, or a custom adapter name). */
  platform: string;
}

/**
 * Prop conditions for `when()`, derived from the component's custom props `P`:
 * - boolean prop `disabled` → `'props:disabled'` (when `true`), `'props:disabled=true'`, `'props:disabled=false'`;
 * - string/number prop `variant: 'primary' | 'ghost'` → `'props:variant'` (when truthy),
 *   `'props:variant=primary'`, `'props:variant=ghost'`.
 * Props of other types (objects, functions) produce no condition.
 */
export type PropConditionKeys<P> =
  P extends Record<string, any>
    ? {
        [K in keyof P]-?: NonNullable<P[K]> extends string | number | boolean
          ? NonNullable<P[K]> extends boolean
            ? `props:${string & K}` | `props:${string & K}=true` | `props:${string & K}=false`
            :
                | `props:${string & K}`
                | `props:${string & K}=${NonNullable<P[K]> extends string | number ? NonNullable<P[K]> : never}`
          : never;
      }[keyof P]
    : never;

/**
 * Interaction state names. They are not evaluated booleans: the style inside
 * `when('state:hover', …)` is compiled as a variant (a CSS pseudo-class on the
 * web, component state on native).
 * - `'hover'`: pointer over the element (see {@link HoverState}).
 * - `'focus'`: the element has focus. Native: only for `Input`.
 * - `'focus-visible'`: focus that came from the keyboard (web); on native, same as `'focus'`.
 * - `'pressed'`: while being pressed (`:active` on the web). Native: only for `Pressable`.
 */
export type StateName = HoverState | 'focus' | 'focus-visible' | 'pressed';

/**
 * Pointer hover state.
 * @platform web — touch screens have no hover, so it is ignored on native.
 */
export type HoverState = 'hover';

/**
 * State condition for `when()`: `'state:hover'`, `'state:focus'`,
 * `'state:focus-visible'` or `'state:pressed'`. Accepts only `{ style }`.
 */
export type StateCondition = `state:${StateName}`;

/**
 * Pseudo-elements that work on BOTH platforms (`when('::before', { style })`).
 * - `'::before'`: content before the element. Web: CSS. Native: a generated child
 *   (`Text` when `content` is set, otherwise a `View`).
 * - `'::after'`: content after the element (same rules as `'::before'`).
 * - `'::placeholder'`: an `Input`'s placeholder. Native: becomes `placeholderTextColor` (uses `color`).
 * - `'::selection'`: selected text. Native: becomes the `Input`'s `selectionColor` (uses `backgroundColor`).
 * - `'::first-letter'`: the first letter of a text. Native: only for a `Text` with plain-string children.
 */
export type UniversalPseudoName =
  | '::before'
  | '::after'
  | '::placeholder'
  | '::selection'
  | '::first-letter';

/**
 * Pseudo-elements that only exist on the web.
 * @platform web — ignored on native (with a development warning).
 * - `'::first-line'`: the first line of a text block.
 * - `'::marker'`: the bullet/number of a list item.
 * - `'::scrollbar'`: the whole scrollbar (`::-webkit-scrollbar`: Chrome, Edge, Safari).
 * - `'::scrollbar-thumb'`: the draggable part of the scrollbar.
 * - `'::scrollbar-track'`: the scrollbar's background track.
 */
export type WebOnlyPseudoName =
  | '::first-line'
  | '::marker'
  | '::scrollbar'
  | '::scrollbar-thumb'
  | '::scrollbar-track';

/** Any pseudo-element accepted by `when()`: {@link UniversalPseudoName} or {@link WebOnlyPseudoName}. */
export type PseudoName = UniversalPseudoName | WebOnlyPseudoName;

/**
 * Breakpoint names usable in `when()`. Mobile-first: `when('breakpoints:md', …)` applies
 * from the `md` width **and up** (like a CSS `@media (min-width: …)`).
 *
 * Only the keys matter here (the `unknown` values are placeholders); the actual
 * widths come from `configure({ breakpoints })`, which defaults to
 * `{ sm: 480, md: 768, lg: 1024, xl: 1280 }`.
 *
 * Web: compiled to `@media` rules. Native: re-evaluated with `useWindowDimensions`.
 *
 * To type your own names, augment this interface (and set the widths in `configure`):
 * ```ts
 * declare module '@michelgutner/isoform' {
 *   interface IsoBreakpointNames { tablet: unknown }
 * }
 * configure({ breakpoints: { tablet: 600 } });
 * ```
 */
export interface IsoBreakpointNames {
  /** Small: large phones and up (default `480px`). */
  sm: unknown;
  /** Medium: tablets in portrait and up (default `768px`). */
  md: unknown;
  /** Large: tablets in landscape, small laptops and up (default `1024px`). */
  lg: unknown;
  /** Extra large: desktops and wide screens (default `1280px`). */
  xl: unknown;
}
// export interface IsoBreakpointNames {
//   /** Small: large phones and up (default `480px`). */
//   large_phones_up: unknown;
//   /** Medium: tablets in portrait and up (default `768px`). */
//   tablets_in_portrait_up: unknown;
//   /** Large: tablets in landscape, small laptops and up (default `1024px`). */
//   tablets_landscape_small_laptops_up: unknown;
//   /** Extra large: desktops and wide screens (default `1280px`). */
//   desktop_wide_screens: unknown;
// }


/** A configured breakpoint name (`'sm' | 'md' | 'lg' | 'xl'` plus any augmented ones). */
export type BreakpointName = Extract<keyof IsoBreakpointNames, string>;

/**
 * Breakpoint condition for `when()`: `'breakpoints:md'` applies from `md` and up.
 * Accepts only `{ style }`. See {@link BreakpointRangeCondition} for ranges.
 */
export type BreakpointCondition = `breakpoints:${BreakpointName}`;

/**
 * The valid (ascending) ranges between the default breakpoints. Only these are
 * suggested, so autocomplete never offers an invalid one such as `'lg..sm'`.
 * - `'sm..md'`: from 480px up to (not including) 768px.
 * - `'sm..lg'`: from 480px up to (not including) 1024px.
 * - `'sm..xl'`: from 480px up to (not including) 1280px.
 * - `'md..lg'`: from 768px up to (not including) 1024px.
 * - `'md..xl'`: from 768px up to (not including) 1280px.
 * - `'lg..xl'`: from 1024px up to (not including) 1280px.
 */
export type DefaultBreakpointRange = 'sm..md' | 'sm..lg' | 'sm..xl' | 'md..lg' | 'md..xl' | 'lg..xl';

/**
 * Breakpoint range conditions for `when()`:
 * - `'breakpoints:<md'`: below `md` (from 0 up to, but not including, `md`);
 * - `'breakpoints:md..lg'`: from `md` up to, but not including, `lg` (the first must be the smaller one).
 *
 * Autocomplete suggests `<name` for every breakpoint and the valid ranges between
 * the defaults ({@link DefaultBreakpointRange}). Ranges with your own names
 * (`'breakpoints:tablet..desktop'`) are accepted too, they are just not suggested.
 */
export type BreakpointRangeCondition = `breakpoints:<${BreakpointName}` | `breakpoints:${DefaultBreakpointRange}`;

/**
 * Every string condition suggested by `when()`. Each kind has its own prefix,
 * so a condition always reads unambiguously:
 * - {@link PlatformCondition}: `'platform:ios'`, `'platform:web'`, `'platform:native'`…;
 * - {@link StateCondition}: `'state:hover'`, `'state:pressed'`…;
 * - {@link BreakpointCondition}: `'breakpoints:md'`;
 * - {@link BreakpointRangeCondition}: `'breakpoints:<md'`, `'breakpoints:md..lg'`;
 * - {@link PropConditionKeys}: `'props:disabled'`, `'props:variant=primary'`…;
 * - {@link PseudoName}: `'::before'`, `'::placeholder'`… (the CSS syntax).
 */
export type ConditionString<P> =
  | PlatformCondition
  | StateCondition
  | BreakpointCondition
  | BreakpointRangeCondition
  | PropConditionKeys<P>
  | PseudoName;

/** A condition computed at render time: return `true` to apply the rule. */
export type ConditionFn<Ctx> = (ctx: Ctx) => boolean;

/**
 * Anything `when()` accepts as its first argument:
 * - a {@link ConditionString} (platform, state, pseudo-element, breakpoint or prop);
 * - a {@link ConditionFn} `(ctx) => boolean`;
 * - a plain `boolean` (`true` always applies, `false` never does);
 * - any other string: ranges with your own breakpoint names (`'breakpoints:tablet..desktop'`); unknown conditions warn in development.
 */
export type Condition<P, Ctx = BaseStyleContext<P>> =
  | ConditionString<P>
  | ConditionFn<Ctx>
  | boolean
  | (string & NonNullable<unknown>);

/* ───────────────────────── style ───────────────────────── */

/** The `style` prop type of component `C` (without style functions such as `Pressable`'s `({ pressed }) => …`). */
export type ExtractStyle<C extends ComponentType<any>> =
  ComponentPropsWithRef<C> extends { style?: infer S }
    ? Exclude<S, (...args: any[]) => any>
    : never;

/** The style type accepted by component `C`; falls back to {@link IsoStyle} when it cannot be inferred. */
export type ComponentStyle<C extends ComponentType<any>> = [ExtractStyle<C>] extends [never]
  ? IsoStyle
  : ExtractStyle<C>;

/** A static style for component `C` (an object, or anything its `style` prop accepts). */
export type StyleObject<C extends ComponentType<any>> = ComponentStyle<C>;

/**
 * What a style function returns: only the OBJECT form of the style (no arrays,
 * `false` or `null`). Returning a union with those types would make TypeScript
 * widen literals (`flexDirection: 'row'` would become `string`).
 */
export type ObjectStyle<C extends ComponentType<any>> = Exclude<
  Extract<ComponentStyle<C>, object>,
  readonly any[]
>;

/** A style computed from `{ theme, props, platform }` at render time. */
export type StyleFn<C extends ComponentType<any>, P> = (ctx: StyleContext<P>) => ObjectStyle<C>;

/** A style given either as an object ({@link StyleObject}) or as a function ({@link StyleFn}). */
export type StyleOrFn<C extends ComponentType<any>, P> = StyleObject<C> | StyleFn<C, P>;

/* ───────────────────────── component ───────────────────────── */

/**
 * A component created by `engine()`. It renders `C` with the accumulated rules
 * and exposes chainable methods to add more. Each method returns a NEW
 * component; the original is never changed.
 */
export interface BaseEngineComponent<C extends ComponentType<any>, P extends object = {}>
  extends ForwardRefExoticComponent<ComponentPropsWithRef<C> & P> {
  /**
   * Applies props (including `style`) only when `condition` is true.
   *
   * @param condition A platform (`'platform:ios'`, `'platform:web'`…), a state
   * (`'state:hover'`, `'state:pressed'`…), a breakpoint (`'breakpoints:md'`,
   * `'breakpoints:<md'`, `'breakpoints:sm..lg'`), a prop (`'props:disabled'`,
   * `'props:variant=primary'`), a pseudo-element (`'::before'`…), a function
   * `(ctx) => boolean` or a boolean.
   * @param attrs The props to apply, or a function of `{ theme, props, platform }` returning them.
   * @returns A new component with the rule added.
   */
  when(
    condition: Condition<P, StyleContext<P>>,
    attrs:
      | Partial<ComponentPropsWithRef<C> & P>
      | ((ctx: StyleContext<P>) => Partial<ComponentPropsWithRef<C> & P>),
  ): EngineComponent<C, P>;

  /**
   * Applies props unconditionally (e.g. a default `accessibilityRole` or `type`).
   * @returns A new component with the props added.
   */
  attrs(attrs: Partial<ComponentPropsWithRef<C> & P>): EngineComponent<C, P>;

  /**
   * Adds a style: an object, or a function of `{ theme, props, platform }`.
   * Later styles override earlier ones (last wins).
   * @returns A new component with the style added.
   */
  style(s: StyleFn<C, P>): EngineComponent<C, P>;
  style(s: StyleObject<C>): EngineComponent<C, P>;

  /** Clones the current rules into a new component, to build a variation without touching the original. */
  extend(): EngineComponent<C, P>;
}

/**
 * The public type of an `engine()` component: {@link BaseEngineComponent} plus
 * internal markers used by the type system.
 */
export type EngineComponent<C extends ComponentType<any>, P extends object = {}> =
  BaseEngineComponent<C, P> & {
    /** Internal marker: identifies an engine component. */
    __engine: true;
    /** Internal: the underlying component `C` (type-level only). */
    __component: C;
    /** Internal: the custom props `P` (type-level only). */
    __props: P;
  };
