/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useCallback, useEffect, useRef, type ComponentType } from 'react';
import { isModuleEnabled } from '../../../config';
import { GESTURE_PROPS, type GestureProps, type ResolvedGestures } from '../../../core/gesture';
import { warnModuleDisabled } from '../../../core/modules';
import { attachGestures, type GestureSource } from './recognizer';

/** Splits the gesture callbacks from the props that go to the element. */
function splitCallbacks(props: Record<string, any>): [GestureProps, Record<string, any>] {
  const rest = { ...props };
  const callbacks: Record<string, unknown> = {};
  for (const name of GESTURE_PROPS) {
    callbacks[name] = rest[name];
    delete rest[name];
  }
  return [callbacks as GestureProps, rest];
}

const hosts = new WeakMap<ComponentType<any>, ComponentType<any>>();

/**
 * `Box` with `.gesture()` on the web: the same element, with Pointer Events
 * attached once. Callbacks and options are read through a ref, so new props do
 * not re-attach anything; the listeners only change with the gesture config.
 * Cached per component: the same input always returns the same host.
 */
export function gestureHost(Component: ComponentType<any>): ComponentType<any> {
  let Host = hosts.get(Component);
  if (Host) return Host;

  const Created = forwardRef<any, any>(({ __isoGestures, ...props }, ref) => {
    const spec = __isoGestures as ResolvedGestures;
    const [callbacks, rest] = splitCallbacks(props);
    const source = useRef<GestureSource>({ spec, callbacks });
    source.current = { spec, callbacks };

    const element = useRef<HTMLElement | null>(null);
    const setRef = useCallback(
      (node: HTMLElement | null) => {
        element.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const enabled = isModuleEnabled('gestures');
    useEffect(() => {
      const node = element.current;
      if (!enabled || !node) return undefined;
      return attachGestures(node, () => source.current);
    }, [enabled, spec.key]);

    if (!enabled) warnModuleDisabled('gestures');
    return <Component {...rest} ref={setRef} />;
  });

  Created.displayName = `Gesture(${(Component as any).displayName || (Component as any).name || 'Component'})`;
  Host = Created;
  hosts.set(Component, Host);
  return Host;
}
