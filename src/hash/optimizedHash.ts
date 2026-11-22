import { BaseStyleContext } from "../core/types";

/** Props that never influence a style: React bookkeeping, and `style` (merged separately as the user style). */
const HASH_EXCLUDED_PROPS = new Set(['children', 'key', 'ref', 'style']);

/**
 * Objects, arrays and functions are hashed by identity: the same reference hits the cache, a new
 * one misses. (Hashing their content would cost more than recompiling.) A `WeakMap` hands each
 * reference a small id without keeping it alive.
 */
const identities = new WeakMap<object, number>();
let nextIdentity = 1;

function identityOf(value: object): number {
  let id = identities.get(value);
  if (id === undefined) identities.set(value, (id = nextIdentity++));
  return id;
}

/**
 * One value → one unambiguous token. The type is part of the token (`1` and `"1"` differ) and strings
 * carry their length, so `a|b` can never be confused with two separate values.
 */
function tokenOf(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return `s${value.length}:${value}`;
    case 'number':
      return `n${value}`;
    case 'boolean':
      return value ? 'T' : 'F';
    case 'undefined':
      return 'u';
    case 'object':
      return value === null ? 'N' : `#${identityOf(value)}`;
    case 'function':
      return `#${identityOf(value)}`;
    default:
      return `x${String(value)}`;
  }
}

/**
 * Cache key of a style computation for one platform and one set of props.
 *
 * `keys` are the props the style rules actually **read** (see `trackReads`): only those can change the
 * result, so only those are hashed. A `testID`, an `onPress` closure or any prop the style never looks at
 * no longer fragments the cache. With `keys = null` (a rule enumerated all the props) every prop counts.
 */
export function optimizedHash<P extends object>(
  ctx: Pick<BaseStyleContext<P>, 'platform' | 'props'>,
  keys: ReadonlySet<string> | null = null,
): string {
  let hash = `${ctx?.platform ?? 'default'}`;
  const props = ctx.props as Record<string, unknown>;

  if (keys) {
    for (const key of keys) hash += `|${key}=${tokenOf(props[key])}`;
    return hash;
  }

  for (const key in props) {
    if (HASH_EXCLUDED_PROPS.has(key)) continue;
    const value = props[key];
    if (value === undefined) continue;
    hash += `|${key}=${tokenOf(value)}`;
  }
  return hash;
}
