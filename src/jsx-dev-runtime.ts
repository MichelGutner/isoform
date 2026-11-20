/* eslint-disable @typescript-eslint/no-explicit-any */
/** Development build of the isoform JSX runtime (see `jsx-runtime.ts`). */
import { Fragment, jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';
import { inlineOf } from './jsx-runtime';

export { Fragment };
export type { JSX } from 'react/jsx-dev-runtime';

/** Every element in development, with the source location React uses in its warnings. */
export function jsxDEV(type: any, props: any, key: any, isStatic: boolean, source?: any, self?: any) {
  const element = inlineOf(type)?.(props);
  return element
    ? reactJsxDEV(element.type, element.props, key, isStatic, source, self)
    : reactJsxDEV(type, props, key, isStatic, source, self);
}
