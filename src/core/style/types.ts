import type { CSSProperties } from 'react';

/** A length: a number (px on the web, dp on native) or a CSS string (`'1rem'`, `'50%'`). */
type Length = number | string;

/**
 * One item of a React Native-style `transform` array, e.g. `{ translateX: 10 }`
 * or `{ rotate: '45deg' }`. The CSS string form (`'translateX(10px) rotate(45deg)'`)
 * is also accepted by `transform`.
 */
export type TransformItem = Record<string, number | string | undefined>;

/**
 * React Native style aliases. They work on both platforms, but exist only for
 * compatibility: prefer the standard CSS name given in each description.
 */
export interface LegacyRNStyle {
  /** Left and right padding. @deprecated Use `paddingInline`. */
  paddingHorizontal?: Length;
  /** Top and bottom padding. @deprecated Use `paddingBlock`. */
  paddingVertical?: Length;
  /** Left and right margin. @deprecated Use `marginInline`. */
  marginHorizontal?: Length;
  /** Top and bottom margin. @deprecated Use `marginBlock`. */
  marginVertical?: Length;
  /** Shadow color. @deprecated Use `boxShadow` (e.g. `'0 4px 10px rgba(0,0,0,.1)'`). */
  shadowColor?: string;
  /** Shadow offset. @deprecated Use `boxShadow`. */
  shadowOffset?: {
    /** Horizontal offset, in px. */
    width: number;
    /** Vertical offset, in px. */
    height: number;
  };
  /** Shadow opacity, from `0` to `1`. @deprecated Use `boxShadow`. */
  shadowOpacity?: number;
  /** Shadow blur radius, in px. @deprecated Use `boxShadow`. */
  shadowRadius?: number;
  /** Android shadow depth. @deprecated Use `boxShadow` (still applied on Android). */
  elevation?: number;
  /**
   * How an image fits its box. @deprecated Use `objectFit`.
   * - `'cover'`: fills the box, cropping the overflow.
   * - `'contain'`: fits inside the box, keeping the whole image visible.
   * - `'stretch'`: fills the box, distorting the image.
   * - `'center'`: centered at its natural size (scaled down if needed).
   */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** Recolors a monochrome image (icons) with this color. @platform native — ignored on the web. */
  tintColor?: string;
  /**
   * Vertical alignment of the text inside a multiline input.
   * @platform native — ignored on the web (Android only on native).
   * - `'auto'`: platform default.
   * - `'top'`: at the top.
   * - `'bottom'`: at the bottom.
   * - `'center'`: in the middle.
   */
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  /** Adds the font's extra top/bottom padding to the text (Android default `true`). @platform native — ignored on the web. */
  includeFontPadding?: boolean;
}

/**
 * CSS custom properties (`'--brand-color': '#0af'`).
 * @platform web — ignored on native.
 */
interface CssVariables {
  [key: `--${string}`]: string | number | undefined;
}

/**
 * The universal isoform style: **full CSS** (`React.CSSProperties`) plus the
 * legacy React Native aliases ({@link LegacyRNStyle}).
 *
 * - A number is a length in px (dp on native), except for unitless properties
 *   (`opacity`, `flex`, `zIndex`, `fontWeight`, `aspectRatio`…).
 * - A string is a CSS value (`'1rem'`, `'50%'`, `'calc(100% - 8px)'`), used as-is on
 *   the web and converted on native when possible (unsupported values are dropped
 *   with a development warning).
 */
export type IsoStyle = Omit<CSSProperties, 'transform'> &
  LegacyRNStyle &
  CssVariables & {
    /** Transformations: a CSS string (`'translateX(10px) rotate(45deg)'`) or a React Native array of {@link TransformItem}. */
    transform?: CSSProperties['transform'] | TransformItem[];
  };

/**
 * What the `style` prop of any component accepts: a style object, a falsy value
 * (ignored, handy for `cond && style`) or a (nested) array of those, merged in
 * order (last wins).
 */
export type StyleInput = IsoStyle | false | null | undefined | readonly StyleInput[];
