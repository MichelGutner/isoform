/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import type { StyleInput } from './style/types';

/**
 * Props que existem nas duas plataformas. As demais props do DOM
 * (`href`, `onMouseEnter`, `data-*`…) são aceitas via `HTMLAttributes` e vão
 * direto ao elemento na web; props nativas extras (`hitSlop`, `onLayout`…)
 * vão direto ao componente do RN.
 */
export interface CommonProps {
  style?: StyleInput;
  children?: ReactNode;
  /** Vira `data-testid` na web. */
  testID?: string;
  /** Mobile: área extra de toque (ignorado na web). */
  hitSlop?: any;
  /** Mobile: medição de layout (ignorado na web). */
  onLayout?: (event: any) => void;
  /** @deprecated use `aria-label` (na web é traduzido para `aria-label`) */
  accessibilityLabel?: string;
  /** @deprecated use `role` (na web é traduzido para `role`) */
  accessibilityRole?: string;
  /** @deprecated use `aria-*` (na web é traduzido para `aria-disabled`/`aria-selected`/…) */
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
  /** @deprecated use `aria-description` */
  accessibilityHint?: string;
}

/**
 * Augmente para declarar props nativas que a lib não lista:
 * `declare module 'omnistyle' { interface OmniNativeProps { collapsable?: boolean } }`
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OmniNativeProps {}

/** Props DOM do elemento, sem as que o omnistyle redefine (`style`, `onChange`, `autoCorrect`). */
type Dom<T extends HTMLAttributes<any>> = Omit<T, 'style' | 'onChange' | 'autoCorrect'>;

export type BoxProps = Dom<HTMLAttributes<HTMLDivElement>> & CommonProps & OmniNativeProps;

export type TextProps = Dom<HTMLAttributes<HTMLSpanElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Limita o número de linhas (reticências no fim). */
    numberOfLines?: number;
  };

export type PressableProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Toque (mobile) / clique ou Enter/Espaço (web). */
    onPress?: (event?: any) => void;
    onLongPress?: (event?: any) => void;
    /** Início do toque. Web: `pointerdown`. */
    onPressIn?: (event?: any) => void;
    /** Fim do toque (soltar, sair da área ou cancelar). Web: `pointerup`/`pointerleave`/`pointercancel`. */
    onPressOut?: (event?: any) => void;
    disabled?: boolean;
  };

export type InputProps = Dom<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Recebe o texto (e não o evento), nas duas plataformas. */
    onChangeText?: (text: string) => void;
    onChange?: (event: any) => void;
    /** Na web renderiza `<textarea>`. */
    multiline?: boolean;
    numberOfLines?: number;
    placeholderTextColor?: string;
    onSubmitEditing?: (event?: any) => void;
    /** @deprecated use `type="password"` */
    secureTextEntry?: boolean;
    /** @deprecated use `readOnly` */
    editable?: boolean;
    /** @deprecated use `inputMode` */
    keyboardType?: string;
    autoCorrect?: boolean | string;
  };

export type ImageProps = Dom<ImgHTMLAttributes<HTMLImageElement>> &
  CommonProps &
  OmniNativeProps & {
    /** @deprecated use `src` */
    source?: { uri: string } | string | number;
  };

export type ScrollProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  OmniNativeProps & {
    horizontal?: boolean;
    contentContainerStyle?: StyleInput;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    onScroll?: (event: any) => void;
  };

/** Componentes só-mobile (ou legados): tipados de forma frouxa. */
type NativeLoose = BoxProps & { [key: string]: any };

/**
 * Mapa nome → props. É o que `engine('Nome')` aceita.
 * As primitivas universais vêm primeiro; o restante é legado/só-mobile.
 */
export interface OmniPrimitives {
  Box: BoxProps;
  Text: TextProps;
  Pressable: PressableProps;
  Input: InputProps;
  Image: ImageProps;
  Scroll: ScrollProps;

  /** @deprecated use `Box` */
  View: BoxProps;
  /** @deprecated use `Input` */
  TextInput: InputProps;
  /** @deprecated use `Scroll` */
  ScrollView: ScrollProps;
  /** @deprecated use `Pressable` */
  TouchableOpacity: PressableProps & { activeOpacity?: number };
  /** @deprecated use `Pressable` */
  TouchableHighlight: PressableProps & { underlayColor?: string };
  /** @deprecated use `Pressable` */
  TouchableWithoutFeedback: PressableProps;

  /** @platform native */
  Switch: NativeLoose;
  /** @platform native */
  ActivityIndicator: NativeLoose;
  /** @platform native */
  Modal: NativeLoose;
  /** @platform native */
  StatusBar: NativeLoose;
  /** @platform native */
  KeyboardAvoidingView: NativeLoose;
  /** @platform native */
  ImageBackground: NativeLoose;
  /** @platform native */
  SafeAreaView: NativeLoose;
  /** @platform native */
  FlatList: NativeLoose;
  /** @platform native */
  SectionList: NativeLoose;
}
