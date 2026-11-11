import type { CSSProperties } from 'react';

type Length = number | string;

/** Item de `transform` no formato array do RN: `{ translateX: 10 }`, `{ rotate: '45deg' }`. */
export type TransformItem = Record<string, number | string | undefined>;

/**
 * Aliases do React Native. Funcionam nas duas plataformas, mas existem só por
 * compatibilidade: prefira o nome padrão de CSS indicado em cada JSDoc.
 */
export interface LegacyRNStyle {
  /** @deprecated use `paddingInline` */
  paddingHorizontal?: Length;
  /** @deprecated use `paddingBlock` */
  paddingVertical?: Length;
  /** @deprecated use `marginInline` */
  marginHorizontal?: Length;
  /** @deprecated use `marginBlock` */
  marginVertical?: Length;
  /** @deprecated use `boxShadow` */
  shadowColor?: string;
  /** @deprecated use `boxShadow` */
  shadowOffset?: { width: number; height: number };
  /** @deprecated use `boxShadow` */
  shadowOpacity?: number;
  /** @deprecated use `boxShadow` */
  shadowRadius?: number;
  /** @deprecated use `boxShadow` (no mobile continua valendo) */
  elevation?: number;
  /** @deprecated use `objectFit` */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** Só mobile (ignorado na web). */
  tintColor?: string;
  /** Só mobile (ignorado na web). */
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  /** Só mobile (ignorado na web). */
  includeFontPadding?: boolean;
}

/** Variáveis CSS (`--minha-cor`), aceitas nas duas plataformas (no mobile são ignoradas). */
interface CssVariables {
  [key: `--${string}`]: string | number | undefined;
}

/**
 * O estilo universal do omnistyle: **CSS completo** (`React.CSSProperties`) +
 * os aliases legados do RN.
 *
 * - número = px (dp no mobile), exceto props sem unidade (`opacity`, `flex`, `zIndex`…)
 * - string = valor CSS (`'1rem'`, `'50%'`, `'calc(100% - 8px)'`)
 */
export type OmniStyle = Omit<CSSProperties, 'transform'> &
  LegacyRNStyle &
  CssVariables & {
    transform?: CSSProperties['transform'] | TransformItem[];
  };

/** Valor aceito na prop `style` de qualquer componente (objeto, array, falsy). */
export type StyleInput = OmniStyle | false | null | undefined | readonly StyleInput[];
