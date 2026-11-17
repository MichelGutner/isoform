/* eslint-disable @typescript-eslint/no-explicit-any */
export function makeProxy<
  Component extends React.ComponentType<unknown>,
  Output extends object,
>(component: Component, builder: Output) {
  const proxy = new Proxy(component, {
    get(target, prop) {
      if (prop in builder) {
        const original = (builder as any)[prop];
        if (typeof original === 'function') {
          return (...args: unknown[]) => {
            const result = original.apply(builder, args);
            if (result === builder) {
              return proxy;
            }
            if (result instanceof builder.constructor) {
              return makeProxy((result as any).build(), result);
            }
            return proxy;
          };
        }
      }
      return (target as any)[prop];
    },
  });

  return proxy;
}
