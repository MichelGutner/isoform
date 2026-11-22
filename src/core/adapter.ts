import type { ComponentType } from 'react';
import type { ResolvedGestures } from './gesture';
import type { ImageCacheApi } from './image';
import type { PseudoName, StateName } from './types';

/**
 * A merged style as the core hands it to an adapter: one flat object, property name → value.
 * The values are whatever the app wrote (numbers, strings, theme tokens, `transform` arrays…),
 * so they are `unknown`: an adapter checks each one before using it.
 */
export type FlatStyle = Record<string, unknown>;

/**
 * Any React component, whatever its props: a styled component's base, a platform primitive. Only the
 * component's own props type knows what it accepts, so a slot that holds any of them needs `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = ComponentType<any>;

/** Styles per pseudo-element (`'::before'`…), already merged into flat objects. */
export type PseudoStyles = Partial<Record<PseudoName, FlatStyle>>;

/** A style variant for a width range, already merged into a flat object. Sorted by ascending `min`. */
export interface BreakpointStyle {
  /** The condition as written in `when()` (`'breakpoints:md'`, `'breakpoints:<md'`, `'breakpoints:sm..lg'`). */
  name: string;
  /** Minimum width in px (mobile-first); `0` for `'<md'`. */
  min: number;
  /** Maximum width in px, EXCLUSIVE (only for `'<md'` and `'sm..lg'`). */
  max?: number;
  /** Global position of the range (keeps CSS rule order stable across components; ranges with `max` come later). */
  order: number;
  /** The style applied inside the range. */
  style: FlatStyle;
}

/** Styles per interaction state (`'hover'`, `'pressed'`…), already merged into flat objects. */
export type StateStyles = Partial<Record<StateName, FlatStyle>>;

/** Input of {@link PlatformAdapter.applyProps}, built by the core on every render. */
export interface ApplyPropsInput {
  /** Primitive name (`'Box'`, `'Pressable'`…), or `undefined` for arbitrary components (`engine(MyComponent)`). */
  primitive?: string;
  /** The result of {@link PlatformAdapter.compileStyle} (already cached by the core). */
  compiled: unknown;
  /**
   * Props from `attrs`/`when` merged with the user's props, WITHOUT `style`. A copy made for this render:
   * the adapter may change it and return it. The values come from the app, so they are `unknown`.
   */
  props: Record<string, unknown>;
  /** The `style` prop the user passed when rendering the component. */
  userStyle: unknown;
}

/**
 * The contract each platform implements. The core knows nothing about
 * `react-native` or `react-dom`: everything platform-specific goes through here.
 * Pass a custom one to `configure({ provider })` to support another platform.
 */
export interface PlatformAdapter {
  /** Name matched by `configure({ provider })` (`'react-native'`, `'react'` or a custom one). */
  readonly name: 'react-native' | 'react' | (string & {});
  /** The current OS (`'ios'`, `'android'`, `'web'`…); drives `when('platform:ios' | 'platform:android' | 'platform:web' | 'platform:native')`. */
  os(): string;
  /** Neutral primitive name (`'Box'`) → the platform's real component (`View`, a `<div>`…). */
  readonly primitives: Record<string, AnyComponent>;
  /**
   * Turns the merged style (a flat object) into the platform's final form
   * (React Native style objects, atomic CSS classes…). Runs once per
   * (theme, props) combination; the core caches the result.
   * `gestures` carries what `.gesture()` declared (defaults applied); a platform
   * without gesture support can ignore it.
   */
  compileStyle(
    style: FlatStyle,
    states?: StateStyles,
    breakpoints?: BreakpointStyle[],
    pseudos?: PseudoStyles,
    gestures?: ResolvedGestures,
  ): unknown;
  /**
   * Builds the final props of the underlying component. Runs on every render,
   * so it must be cheap (the heavy work belongs in `compileStyle`).
   */
  applyProps(input: ApplyPropsInput): Record<string, unknown>;
  /**
   * Optional: swaps the underlying component based on the compiled style (e.g.
   * an animated host on native when there is an `animation`). Must return the
   * SAME reference for the same input, or React remounts the tree.
   */
  resolveComponent?(component: AnyComponent, compiled: unknown): AnyComponent;
  /**
   * Optional, CSS platforms only: receives the `:root{--iso-…}` rule that carries the theme values, on every
   * theme change. Its presence is what lets `configure({ performance: { themeVariables } })` turn tokens into
   * `var(--iso-…)`; a platform without it keeps resolving tokens to values.
   */
  applyThemeVariables?(css: string): void;
  /**
   * Server-side rendering: the CSS generated so far (only platforms that generate CSS).
   * `themeCss` replaces the stored `:root{--iso-…}` rule: a server render with its own theme passes that
   * theme's rule here, so the response carries the values of its own request.
   */
  getStyleText?(themeCss?: string): string;
  /** Optional: the image cache behind `prefetchImages` and `clearImageCache` (the `image` module). */
  readonly images?: ImageCacheApi;
}
