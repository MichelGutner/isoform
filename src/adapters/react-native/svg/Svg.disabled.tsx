/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import { warnModuleDisabled } from '../../../core/modules';
import { SVG_ELEMENTS, type SvgElementName } from '../../../core/svg';

/**
 * The SVG primitives without `react-native-svg`: `react-isoform/metro` uses this file instead
 * of `Svg.tsx` when `svg` is off in `isoform.config.json`, so `react-native-svg` is
 * neither in the JS bundle nor needed in the app.
 */
function element(name: SvgElementName): ComponentType<any> {
  const Element = () => {
    warnModuleDisabled('svg');
    return null;
  };
  Element.displayName = name;
  return Element;
}

/** Every SVG primitive, rendering nothing. */
export const SvgPrimitives = Object.fromEntries(
  (Object.keys(SVG_ELEMENTS) as SvgElementName[]).map((name) => [name, element(name)]),
) as Record<SvgElementName, ComponentType<any>>;
