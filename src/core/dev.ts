declare const __DEV__: boolean | undefined;
// Declarado localmente para não exigir `@types/node` de quem consome o código-fonte.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/** `true` fora de produção (RN expõe `__DEV__`; bundlers web usam NODE_ENV). */
export const isDev = (): boolean => {
  if (typeof __DEV__ !== 'undefined') return !!__DEV__;
  return !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
};

const seen = new Set<string>();

/** Avisa uma única vez por `key`, e só em desenvolvimento. */
export function warnOnce(key: string, message: string): void {
  if (!isDev() || seen.has(key)) return;
  seen.add(key);
  console.warn(`[omnistyle] ${message}`);
}
