/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef } from 'react';
import { flattenStyle } from '../../core/flatten';
import { normalizeWebStyle } from './normalize/style';

/**
 * Componentes finos do DOM. A tradução de props e as classes já chegam
 * prontas de `applyWebProps`; aqui só escolhemos a tag.
 */
const make = (tag: string, name: string) => {
  const C = forwardRef<any, any>((props, ref) => createElement(tag, { ...props, ref }));
  C.displayName = name;
  return C;
};

export const Box = make('div', 'Box');
export const Text = make('span', 'Text');
export const Pressable = make('div', 'Pressable');
export const Image = make('img', 'Image');

export const Input = forwardRef<any, any>(({ multiline, ...props }, ref) =>
  createElement(multiline ? 'textarea' : 'input', { ...props, ref }),
);
Input.displayName = 'Input';

export const Scroll = forwardRef<any, any>(
  (
    {
      horizontal,
      contentContainerStyle,
      showsVerticalScrollIndicator,
      showsHorizontalScrollIndicator,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const hideBar = horizontal ? showsHorizontalScrollIndicator === false : showsVerticalScrollIndicator === false;
    const outerStyle = {
      ...(horizontal ? { overflowX: 'auto', overflowY: 'hidden' } : null),
      ...(hideBar ? { scrollbarWidth: 'none' } : null),
      ...style,
    };
    const innerStyle = {
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      flexGrow: 1,
      flexShrink: 0,
      boxSizing: 'border-box',
      ...normalizeWebStyle(flattenStyle(contentContainerStyle)),
    };
    return createElement(
      'div',
      { ...props, style: outerStyle, ref },
      createElement('div', { style: innerStyle }, children),
    );
  },
);
Scroll.displayName = 'Scroll';
