/**
 * SVG primitives: `engine('Svg')`, `engine('Path')`… Web: the browser's own SVG
 * elements. iOS and Android: `react-native-svg`. Names that clash with other
 * primitives or common libraries (`Text`, `Image`, `LinearGradient`, `Symbol`…)
 * carry the `Svg` prefix.
 */

/** One SVG primitive: the `react-native-svg` export and the DOM tag behind it. */
export interface SvgElement {
  /** Export of `react-native-svg` (`'Path'`, `'LinearGradient'`…). */
  native: string;
  /** SVG tag on the web (`'path'`, `'linearGradient'`…). */
  dom: string;
}

/** Every SVG primitive, by its omnistyle name. */
export const SVG_ELEMENTS = {
  Svg: { native: 'Svg', dom: 'svg' },
  G: { native: 'G', dom: 'g' },
  Path: { native: 'Path', dom: 'path' },
  Circle: { native: 'Circle', dom: 'circle' },
  Rect: { native: 'Rect', dom: 'rect' },
  Ellipse: { native: 'Ellipse', dom: 'ellipse' },
  Line: { native: 'Line', dom: 'line' },
  Polyline: { native: 'Polyline', dom: 'polyline' },
  Polygon: { native: 'Polygon', dom: 'polygon' },
  TSpan: { native: 'TSpan', dom: 'tspan' },
  Defs: { native: 'Defs', dom: 'defs' },
  Stop: { native: 'Stop', dom: 'stop' },
  SvgText: { native: 'Text', dom: 'text' },
  SvgImage: { native: 'Image', dom: 'image' },
  SvgLinearGradient: { native: 'LinearGradient', dom: 'linearGradient' },
  SvgRadialGradient: { native: 'RadialGradient', dom: 'radialGradient' },
  SvgClipPath: { native: 'ClipPath', dom: 'clipPath' },
  SvgMask: { native: 'Mask', dom: 'mask' },
  SvgPattern: { native: 'Pattern', dom: 'pattern' },
  SvgSymbol: { native: 'Symbol', dom: 'symbol' },
  SvgUse: { native: 'Use', dom: 'use' },
} as const satisfies Record<string, SvgElement>;

/** Name of an SVG primitive (`'Svg'`, `'Path'`, `'SvgLinearGradient'`…). */
export type SvgElementName = keyof typeof SVG_ELEMENTS;

/** SVG presentation properties: CSS on the web, props of the element on native. */
export const SVG_PRESENTATION = new Set([
  'color',
  'fill',
  'fillOpacity',
  'fillRule',
  'stroke',
  'strokeWidth',
  'strokeOpacity',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'stopColor',
  'stopOpacity',
  'clipRule',
  'vectorEffect',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'textAnchor',
]);

/** `'2px'` → `2` (react-native-svg wants plain numbers); anything else unchanged. */
const PX = /^-?\d*\.?\d+px$/;
const plain = (value: unknown): unknown => (typeof value === 'string' && PX.test(value) ? parseFloat(value) : value);

/** A flat style split into the native element's props and what stays in `style`. */
export interface SvgStyleSplit {
  /** Presentation props (`fill`, `stroke`…), applied to the element. */
  props: Record<string, unknown>;
  /** The rest: layout of the `<Svg>` box (only the root keeps a style). */
  style: Record<string, unknown>;
}

/**
 * Native: moves the style into the element's props, as the web's CSS would apply it.
 * The root `Svg` keeps its box style (size, margin, background…) and passes the
 * presentation keys down as props, so the shapes inherit them. A shape has no box:
 * every key of its style becomes a prop (`fill`, `opacity`, `transform`…).
 * @param style The flattened style.
 * @param root Whether the element is the root `Svg`.
 */
export function splitSvgStyle(style: Record<string, unknown>, root: boolean): SvgStyleSplit {
  const props: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(style)) {
    const target = !root || SVG_PRESENTATION.has(key) ? props : rest;
    target[key] = target === props ? plain(style[key]) : style[key];
  }
  return { props, style: rest };
}
