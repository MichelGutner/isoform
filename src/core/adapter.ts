/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import type { PseudoName, StateName } from './types';

/** Styles per pseudo-element (`'::before'`…), already merged into flat objects. */
export type PseudoStyles = Partial<Record<PseudoName, Record<string, any>>>;

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
  style: Record<string, any>;
}

/** Styles per interaction state (`'hover'`, `'pressed'`…), already merged into flat objects. */
export type StateStyles = Partial<Record<StateName, Record<string, any>>>;

/** Input of {@link PlatformAdapter.applyProps}, built by the core on every render. */
export interface ApplyPropsInput {
  /** Primitive name (`'Box'`, `'Pressable'`…), or `undefined` for arbitrary components (`engine(MyComponent)`). */
  primitive?: string;
  /** The result of {@link PlatformAdapter.compileStyle} (already cached by the core). */
  compiled: unknown;
  /** Props from `attrs`/`when` merged with the user's props, WITHOUT `style`. */
  props: Record<string, any>;
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
  readonly primitives: Record<string, ComponentType<any>>;
  /**
   * Turns the merged style (a flat object) into the platform's final form
   * (React Native style objects, atomic CSS classes…). Runs once per
   * (theme, props) combination; the core caches the result.
   */
  compileStyle(
    style: Record<string, any>,
    states?: StateStyles,
    breakpoints?: BreakpointStyle[],
    pseudos?: PseudoStyles,
  ): unknown;
  /**
   * Builds the final props of the underlying component. Runs on every render,
   * so it must be cheap (the heavy work belongs in `compileStyle`).
   */
  applyProps(input: ApplyPropsInput): Record<string, any>;
  /**
   * Optional: swaps the underlying component based on the compiled style (e.g.
   * an animated host on native when there is an `animation`). Must return the
   * SAME reference for the same input, or React remounts the tree.
   */
  resolveComponent?(component: ComponentType<any>, compiled: unknown): ComponentType<any>;
  /** Server-side rendering: the CSS generated so far (only platforms that generate CSS). */
  getStyleText?(): string;
}
