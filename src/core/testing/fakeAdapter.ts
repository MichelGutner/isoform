/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import type { PlatformAdapter } from '../adapter';

/** Adapter mínimo para testar o core sem react-native/react-dom. */
export function createFakeAdapter(
  Base: ComponentType<any>,
  state: { os: string } = { os: 'ios' },
): PlatformAdapter {
  return {
    name: 'fake',
    os: () => state.os,
    primitives: { Box: Base },
    compileStyle: (style) => style,
    applyProps: ({ props, compiled, userStyle }) => ({
      ...props,
      style: userStyle ? [compiled, userStyle] : compiled,
    }),
  };
}
