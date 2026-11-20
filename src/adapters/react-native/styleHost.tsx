/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useState } from 'react';
import { useBreakpointWidth, type WidthRange } from './windowWidth';

/** O que o host precisa rastrear para recompor o estilo. */
export interface StyleHostFlags {
  /** Largura da janela (breakpoints). */
  width?: boolean;
  /** `pressed` por `onPressIn`/`onPressOut` (quando o estilo precisa ser um objeto, ex.: com transition). */
  pressed?: boolean;
  /** `focus` por `onFocus`/`onBlur` (Input). */
  focus?: boolean;
}

const hosts = new Map<string, WeakMap<React.ComponentType<any>, React.ComponentType<any>>>();

/** Faixas de largura que o estilo usa, passadas pelo adapter junto com `__isoStyleFor`. */
const NO_RANGES: readonly WidthRange[] = [];

/**
 * Envolve um componente RN num host que rastreia largura da janela, `pressed`
 * e `focus`, e pede ao adapter o estilo final (`__isoStyleFor(width, pressed,
 * focused)`). Só entram aqui os componentes que precisam (breakpoints,
 * `when('state:focus')`, `pressed` + transition); os demais seguem no caminho estático.
 *
 * Um host por combinação de flags e por componente: a mesma entrada devolve
 * sempre o mesmo host, e a ordem dos hooks é fixa dentro de cada host.
 */
export function styleHost(Component: React.ComponentType<any>, flags: StyleHostFlags): React.ComponentType<any> {
  const id = `${flags.width ? 'w' : ''}${flags.pressed ? 'p' : ''}${flags.focus ? 'f' : ''}`;
  let byComponent = hosts.get(id);
  if (!byComponent) hosts.set(id, (byComponent = new WeakMap()));
  let Host = byComponent.get(Component);
  if (Host) return Host;

  const { width: useWidth, pressed: usePressed, focus: useFocus } = flags;

  const Created = forwardRef<any, any>(({ __isoStyleFor: styleFor, __isoRanges: ranges, onPressIn, onPressOut, onFocus, onBlur, ...rest }, ref) => {
    // cada flag é constante por host, então a ordem dos hooks nunca muda
    // eslint-disable-next-line react-hooks/rules-of-hooks -- useWidth is fixed for this host
    const width = useWidth ? useBreakpointWidth(ranges ?? NO_RANGES) : undefined;
    const [pressed, setPressed] = useState(false);
    const [focused, setFocused] = useState(false);

    const props: Record<string, any> = { ...rest, ref };
    if (usePressed) {
      props.onPressIn = (e: any) => {
        setPressed(true);
        onPressIn?.(e);
      };
      props.onPressOut = (e: any) => {
        setPressed(false);
        onPressOut?.(e);
      };
    } else {
      if (onPressIn) props.onPressIn = onPressIn;
      if (onPressOut) props.onPressOut = onPressOut;
    }
    if (useFocus) {
      props.onFocus = (e: any) => {
        setFocused(true);
        onFocus?.(e);
      };
      props.onBlur = (e: any) => {
        setFocused(false);
        onBlur?.(e);
      };
    } else {
      if (onFocus) props.onFocus = onFocus;
      if (onBlur) props.onBlur = onBlur;
    }
    props.style = styleFor(width, pressed, focused);
    return React.createElement(Component, props);
  });
  Created.displayName = `Dynamic(${(Component as any).displayName || (Component as any).name || 'Component'})`;

  Host = Created;
  byComponent.set(Component, Host);
  return Host;
}
