/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Achata estilos (objetos, arrays aninhados, valores falsy) num único objeto,
 * com "o último vence". Substitui `StyleSheet.flatten` sem depender do RN.
 */
export function flattenStyle(style: unknown): Record<string, any> {
  const out: Record<string, any> = {};
  assign(out, style);
  return out;
}

function assign(out: Record<string, any>, style: unknown): void {
  if (!style) return;
  if (Array.isArray(style)) {
    for (let i = 0; i < style.length; i++) assign(out, style[i]);
    return;
  }
  if (typeof style === 'object') Object.assign(out, style);
}
