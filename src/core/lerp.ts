/**
 * Interpolation between two style values (numbers, colors, strings with the same
 * numbers in the same places). Platform-free: used by the mobile transitions and
 * by the gestures' `interpolate` on the web.
 */

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `transparent` → [r, g, b, a]. */
export function parseColor(value: string): [number, number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const h = m[1];
    const full = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a];
  }
  return null;
}

/** Valor intermediário entre dois estilos (para retomar uma transição interrompida). */
export function lerpValue(from: unknown, to: unknown, t: number): number | string | undefined {
  if (typeof from === 'number' && typeof to === 'number') return from + (to - from) * t;
  if (typeof from !== 'string' || typeof to !== 'string') return undefined;

  const a = parseColor(from);
  const b = parseColor(to);
  if (a && b) {
    const c = a.map((x, i) => x + (b[i] - x) * t);
    return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+c[3].toFixed(3)})`;
  }

  // strings com os mesmos números em posições iguais ('10%', '0deg')
  const num = /-?\d*\.?\d+/g;
  const fa = from.match(num);
  const fb = to.match(num);
  if (fa && fb && fa.length === fb.length && from.replace(num, '#') === to.replace(num, '#')) {
    let i = 0;
    return to.replace(num, () => String(+(+fa[i] + (+fb[i] - +fa[i++]) * t).toFixed(4)));
  }
  return undefined;
}
