/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The isoform JSX runtime: `jsxImportSource: 'react-isoform'` (Babel preset, Vite, `tsconfig`).
 *
 * Every element goes to React's own runtime, except a styled component whose style never reads the
 * theme: for those it creates the element the component would have rendered (`<View style={…}>`)
 * directly. Same props, same host, one component less per element, and no hook. Everything else
 * (strings, `Fragment`, memo/forwardRef objects, any other component) is passed through untouched.
 */
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';
import { INLINE, type InlineFn } from './core/inline';

export { Fragment };
export type { JSX } from 'react/jsx-runtime';

/** The inline function of a styled component (a `forwardRef` object), or `undefined` for any other element type. */
export const inlineOf = (type: unknown): InlineFn | undefined =>
  typeof type === 'object' && type !== null ? (type as any)[INLINE] : undefined;

/** Element with one child, or none. */
export function jsx(type: any, props: any, key?: any) {
  const element = inlineOf(type)?.(props);
  return element ? reactJsx(element.type, element.props, key) : reactJsx(type, props, key);
}

/** Element with a static list of children. */
export function jsxs(type: any, props: any, key?: any) {
  const element = inlineOf(type)?.(props);
  return element ? reactJsxs(element.type, element.props, key) : reactJsxs(type, props, key);
}
