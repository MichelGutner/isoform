/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';

/**
 * Key of the function a styled component exposes to the isoform JSX runtime (see `jsx-runtime.ts`).
 * A registered symbol, so the runtime finds it without importing the rest of the library.
 */
export const INLINE = Symbol.for('isoform.inline');

/** Mark of a style function that never reads the theme (see `themeFree`). */
const THEME_FREE = Symbol.for('isoform.themeFree');

/** What a styled component would render: the component underneath and its final props. */
export interface InlineElement {
  /** The component underneath (`View`, a `div` primitive, an app component…). */
  type: ComponentType<any>;
  /** Its props: style already applied, `ref` included. */
  props: Record<string, any>;
}

/**
 * Turns the props of a styled component into the element it would render, or `null` when it must
 * render as a component (its style may depend on the theme, or inlining is off).
 */
export type InlineFn = (props: Record<string, any>) => InlineElement | null;

/**
 * Marks a style function (or a `when()` condition / attrs function) as never reading the theme: it
 * only uses `props` and `platform`. A styled component whose functions are all marked can be rendered
 * without its wrapper by the isoform JSX runtime.
 *
 * The isoform Babel plugin adds the mark by itself when it can prove it from the code (the function
 * takes `({ props })`, `({ props, platform })` or nothing). Mark by hand only where the plugin does not run.
 *
 * @example
 * const Cell = engine<'Box', { size: number }>('Box', themeFree(({ props }) => ({ width: props.size })));
 */
export const themeFree = <F extends (...args: any[]) => any>(fn: F): F => {
  (fn as any)[THEME_FREE] = true;
  return fn;
};

/** `true` for a function marked by `themeFree`. */
export const isThemeFree = (fn: unknown): boolean => typeof fn === 'function' && (fn as any)[THEME_FREE] === true;
