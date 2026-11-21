/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, type ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import { isModuleEnabled } from '../../../config';
import { warnOnce } from '../../../core/dev';
import { warnModuleDisabled } from '../../../core/modules';
import { SVG_ELEMENTS, splitSvgStyle, type SvgElementName } from '../../../core/svg';
import { RERENDER } from '../transitionHost';

declare const require: (id: string) => any;

/**
 * `react-native-svg`, loaded on the first render of an SVG primitive (importing the
 * adapter, tests included, does not need it). `null` when the app did not install it.
 */
let lib: Record<string, ComponentType<any>> | null | undefined;
function loadLib(): Record<string, ComponentType<any>> | null {
  if (lib !== undefined) return lib;
  try {
    lib = require('react-native-svg');
  } catch {
    lib = null;
  }
  return lib ?? null;
}

/**
 * The `react-native-svg` component behind a primitive, or `null` (with a dev warning)
 * when the module is off or the package is missing.
 */
function nativeComponent(name: SvgElementName): ComponentType<any> | null {
  if (!isModuleEnabled('svg')) {
    warnModuleDisabled('svg');
    return null;
  }
  const svg = loadLib();
  if (!svg) {
    warnOnce('svg-missing', 'ISO010: module "svg" is on, but react-native-svg is not installed: run `npx expo install react-native-svg` (or `yarn add react-native-svg`) and `pod install`.');
    return null;
  }
  return svg[SVG_ELEMENTS[name].native] ?? null;
}

/**
 * One SVG primitive on native: the isoform style (already converted for React Native)
 * becomes the element's props, as CSS would apply it on the web. Props written on the
 * element lose to the style, like SVG attributes lose to CSS. `onPress` is native already.
 */
function element(name: SvgElementName): ComponentType<any> {
  const root = name === 'Svg';
  const Element = forwardRef<any, any>(({ style, ...props }, ref) => {
    const Native = nativeComponent(name);
    if (!Native) return null;
    const split = splitSvgStyle(StyleSheet.flatten(style) ?? {}, root);
    return <Native ref={ref} {...props} {...split.props} style={root ? split.style : undefined} />;
  });
  Element.displayName = name;
  // `react-native-svg` shapes read props, not `style`: a `transition` redraws them frame by frame
  (Element as any)[RERENDER] = true;
  return Element;
}

/** Every SVG primitive, by name (`Svg`, `Path`, `SvgLinearGradient`…). */
export const SvgPrimitives = Object.fromEntries(
  (Object.keys(SVG_ELEMENTS) as SvgElementName[]).map((name) => [name, element(name)]),
) as Record<SvgElementName, ComponentType<any>>;
