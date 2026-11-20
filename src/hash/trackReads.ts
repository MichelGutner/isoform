/** What a style computation looked at in its props. */
export interface PropReads {
  /** Props read by name (`props.size`, `'props:variant=ghost'`). */
  keys: Set<string>;
  /** `true` when the props were enumerated (`{ ...props }`, `Object.keys(props)`): every prop counts. */
  all: boolean;
}

export const createReads = (): PropReads => ({ keys: new Set(), all: false });

/**
 * Where the running computation records its reads. The rules run synchronously and never nest, so one
 * module-level slot is enough, and it lets every tracked props object share ONE `Proxy` handler.
 * (A handler per object meant four closures and an object allocated on every cache miss; on Hermes,
 * on a phone, that was ~14% of a miss.) Reads outside a recording, such as a style function that keeps
 * `props` and reads it later, are ignored.
 */
let active: PropReads | null = null;

/** Starts recording into `reads`. Pass what it returns to `endPropReads`. */
export const beginPropReads = (reads: PropReads): PropReads | null => {
  const previous = active;
  active = reads;
  return previous;
};

export const endPropReads = (previous: PropReads | null): void => {
  active = previous;
};

const handler: ProxyHandler<object> = {
  get(target, key) {
    if (active !== null && typeof key === 'string') active.keys.add(key);
    return (target as Record<string | symbol, unknown>)[key];
  },
  has(target, key) {
    if (active !== null && typeof key === 'string') active.keys.add(key);
    return key in target;
  },
  ownKeys(target) {
    if (active !== null) active.all = true;
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, key) {
    if (active !== null && typeof key === 'string') active.keys.add(key);
    return Reflect.getOwnPropertyDescriptor(target, key);
  },
};

/**
 * Wraps `props` so reads made while a recording is active are noted (see `beginPropReads`).
 *
 * This is what lets the builder cache by the props a style really depends on. Only a cache **miss**
 * pays for the Proxy (a hit never runs the rules). Names are recorded for `get` and `in`;
 * enumeration marks `all`, because there is no way to know which of the props the rule used.
 */
export const trackReads = <P extends object>(props: P): P => new Proxy(props, handler) as P;
