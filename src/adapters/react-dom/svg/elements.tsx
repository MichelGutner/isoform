/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef, type ComponentType } from 'react';
import { isModuleEnabled } from '../../../config';
import { warnModuleDisabled } from '../../../core/modules';
import { SVG_ELEMENTS, type SvgElementName } from '../../../core/svg';

/**
 * One SVG primitive on the web: the browser's own element. The style arrives as
 * classes (`fill`, `stroke`… are CSS properties of SVG elements), so nothing is
 * converted; `onPress` becomes `onClick`, as on the other primitives.
 */
function element(name: SvgElementName): ComponentType<any> {
  const tag = SVG_ELEMENTS[name].dom;
  const Element = forwardRef<any, any>(({ onPress, ...props }, ref) => {
    if (!isModuleEnabled('svg')) {
      warnModuleDisabled('svg');
      return null;
    }
    if (onPress) {
      const userClick = props.onClick;
      props.onClick = (event: any) => {
        userClick?.(event);
        onPress(event);
      };
    }
    return createElement(tag, { ...props, ref });
  });
  Element.displayName = name;
  return Element;
}

/** Every SVG primitive, by name (`Svg`, `Path`, `SvgLinearGradient`…). */
export const SvgPrimitives = Object.fromEntries(
  (Object.keys(SVG_ELEMENTS) as SvgElementName[]).map((name) => [name, element(name)]),
) as Record<SvgElementName, ComponentType<any>>;
