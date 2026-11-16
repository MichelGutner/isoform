/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import type { StyleInput } from './style/types';
import type { AudioHandle, AudioOwnProps, VideoHandle, VideoOwnProps } from './media';
import type { PdfHandle, PdfOwnProps } from './pdf';
import type { BottomSheetHandle, BottomSheetOwnProps } from './sheet';

/**
 * Props shared by every primitive on both platforms. Any other DOM prop
 * (`href`, `onMouseEnter`, `data-*`…) is accepted through `HTMLAttributes` and
 * goes straight to the element on the web; extra native props go straight to
 * the React Native component.
 */
export interface CommonProps {
  /** Style overrides. Always wins over the `engine()` styles. Web: applied inline. */
  style?: StyleInput;
  /** Child elements. */
  children?: ReactNode;
  /** Test identifier. Web: rendered as `data-testid`. Native: `testID`. */
  testID?: string;
  /**
   * Extra touch area around the element (a number or `{ top, left, bottom, right }`).
   * @platform native — ignored on the web.
   */
  hitSlop?: any;
  /**
   * Called with the element's layout (position and size) after it is laid out.
   * @platform native — ignored on the web.
   */
  onLayout?: (event: any) => void;
  /** @deprecated Use `aria-label` (on the web it is translated to `aria-label`). */
  accessibilityLabel?: string;
  /** @deprecated Use `role` (on the web it is translated to `role`). */
  accessibilityRole?: string;
  /** @deprecated Use the `aria-*` props (on the web they are translated to `aria-disabled`, `aria-selected`…). */
  accessibilityState?: {
    /** The element is disabled (`aria-disabled`). */
    disabled?: boolean;
    /** The element is selected (`aria-selected`). */
    selected?: boolean;
    /** The element is checked, or partially checked with `'mixed'` (`aria-checked`). */
    checked?: boolean | 'mixed';
    /** The element is busy, e.g. loading (`aria-busy`). */
    busy?: boolean;
    /** The element is expanded, e.g. an open accordion (`aria-expanded`). */
    expanded?: boolean;
  };
  /** @deprecated Use `aria-description`. */
  accessibilityHint?: string;
}

/**
 * Augment this interface to type native props the lib does not list:
 * ```ts
 * declare module 'omnistyle' {
 *   interface OmniNativeProps { collapsable?: boolean }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OmniNativeProps {}

/** The element's DOM props, minus the ones omnistyle redefines (`style`, `onChange`, `autoCorrect`). */
type Dom<T extends HTMLAttributes<any>> = Omit<T, 'style' | 'onChange' | 'autoCorrect'>;

/**
 * Props of `Box`: a layout container.
 * Web: `<div>` with React Native defaults (flex column). Native: `View`.
 */
export type BoxProps = Dom<HTMLAttributes<HTMLDivElement>> & CommonProps & OmniNativeProps;

/**
 * Props of `Text`: a piece of text.
 * Web: `<span>`. Native: `Text`.
 */
export type TextProps = Dom<HTMLAttributes<HTMLSpanElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Maximum number of lines; extra text is cut with an ellipsis. Web: `-webkit-line-clamp`. */
    numberOfLines?: number;
  };

/**
 * Props of `Pressable`: anything that reacts to a tap or click.
 * Web: `<div role="button">` (focusable, Enter/Space trigger `onPress`). Native: `Pressable`.
 */
export type PressableProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Called on tap (native) or on click / Enter / Space (web). */
    onPress?: (event?: any) => void;
    /** Called when the element is held down for a while. */
    onLongPress?: (event?: any) => void;
    /** Called when the press starts. Web: `pointerdown`. */
    onPressIn?: (event?: any) => void;
    /** Called when the press ends (release, leaving the area or cancel). Web: `pointerup` / `pointerleave` / `pointercancel`. */
    onPressOut?: (event?: any) => void;
    /** Disables presses. Web: also sets `aria-disabled`. */
    disabled?: boolean;
  };

/**
 * Props of `Input`: a text field.
 * Web: `<input>` (or `<textarea>` with `multiline`). Native: `TextInput`.
 */
export type InputProps = Dom<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Called with the new text (not the event) on every change, on both platforms. */
    onChangeText?: (text: string) => void;
    /** Called with the raw platform event on every change. Prefer `onChangeText`. */
    onChange?: (event: any) => void;
    /** Allows several lines of text. Web: renders a `<textarea>`. */
    multiline?: boolean;
    /** Number of visible lines when `multiline` (web: `rows`). */
    numberOfLines?: number;
    /** Placeholder text color. Prefer `when('::placeholder', { style: { color } })`. */
    placeholderTextColor?: string;
    /** Called when the user submits the field (Enter on the web, the return key on native). */
    onSubmitEditing?: (event?: any) => void;
    /** @deprecated Use `type="password"`. */
    secureTextEntry?: boolean;
    /** @deprecated Use `readOnly`. */
    editable?: boolean;
    /** @deprecated Use `inputMode`. */
    keyboardType?: string;
    /** Turns autocorrection on or off (web: the `autocorrect` attribute; `'on' | 'off'` also accepted). */
    autoCorrect?: boolean | string;
  };

/**
 * Props of `Image`: a picture.
 * Web: `<img>`. Native: `Image`. Use the web-standard `src` and `alt`.
 */
export type ImageProps = Dom<ImgHTMLAttributes<HTMLImageElement>> &
  CommonProps &
  OmniNativeProps & {
    /** @deprecated Use `src`. */
    source?: { uri: string } | string | number;
  };

/**
 * Props of `Scroll`: a scrollable container.
 * Web: `<div>` with `overflow: auto`. Native: `ScrollView`.
 */
export type ScrollProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  OmniNativeProps & {
    /** Scrolls sideways instead of vertically. */
    horizontal?: boolean;
    /** Style of the inner content container (padding, gap, alignment of the scrolled content). */
    contentContainerStyle?: StyleInput;
    /** Shows the vertical scrollbar. @platform native */
    showsVerticalScrollIndicator?: boolean;
    /** Shows the horizontal scrollbar. @platform native */
    showsHorizontalScrollIndicator?: boolean;
    /**
     * Whether taps inside the scroll dismiss the keyboard. @platform native
     * - `'always'`: taps never dismiss the keyboard and are handled by the children.
     * - `'never'`: a tap outside the focused input dismisses the keyboard (default).
     * - `'handled'`: the keyboard stays when a child handles the tap.
     */
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    /** Called while scrolling, with the platform scroll event. */
    onScroll?: (event: any) => void;
  };

/**
 * A media primitive: its own props (`src`, `onPlay`…) plus the common ones.
 * DOM props that clash with ours (`onPlay`, `onError`…) are omitted.
 */
type Media<Own> = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof Own> & Own & CommonProps & OmniNativeProps;

/**
 * Props of `Video`: a video player (see {@link VideoOwnProps} for the playback props).
 * Requires `configure({ modules: { video: true } })`.
 */
export type VideoProps = Media<VideoOwnProps>;

/**
 * Props of `Audio`: an audio player with the lib's own controls (see {@link AudioOwnProps}).
 * Requires `configure({ modules: { audio: true } })`.
 */
export type AudioProps = Media<AudioOwnProps>;

/**
 * Props of `Pdf`: a document viewer with search, thumbnails and zoom (see {@link PdfOwnProps}).
 * Requires `configure({ modules: { pdf: true } })`.
 */
export type PdfProps = Media<PdfOwnProps>;

/**
 * Props of `BottomSheet`: a panel that slides up from the bottom (see {@link BottomSheetOwnProps}).
 * The `style` styles the sheet surface: `backgroundColor` and the top corner radius go to the
 * native sheet, the rest (padding, gap…) to the content. Requires `configure({ modules: { sheet: true } })`.
 */
export type BottomSheetProps = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof BottomSheetOwnProps> &
  Omit<BottomSheetOwnProps, 'children'> &
  CommonProps &
  OmniNativeProps & {
    /** The content of the sheet. */
    children?: ReactNode;
  };

/** Native-only (or legacy) components: loosely typed (any prop is accepted). */
type NativeLoose = BoxProps & { [key: string]: any };

/**
 * Primitive name → what its `ref` exposes, for the primitives that have methods.
 * `engine('Video')` and friends get a `ref` typed with it.
 */
export interface OmniPrimitiveHandles {
  /** `play`, `pause`, `seekTo`, `setFullscreen` (+ `next`/`previous`/`goTo` with `items`). */
  Video: VideoHandle;
  /** `play`, `pause`, `seekTo` (+ `next`/`previous`/`goTo` with `items`). */
  Audio: AudioHandle;
  /** `goToPage`, `search`, `setZoom`… (+ `next`/`previous`/`goTo` with `items`). */
  Pdf: PdfHandle;
  /** `snapTo`. */
  BottomSheet: BottomSheetHandle;
}

/**
 * Primitive name → props. This is what `engine('Name')` accepts.
 * Universal primitives come first; the rest are legacy or native-only.
 */
export interface OmniPrimitives {
  /** Layout container. Web: `<div>` (flex column). Native: `View`. */
  Box: BoxProps;
  /** Text. Web: `<span>`. Native: `Text`. */
  Text: TextProps;
  /** Tappable/clickable area. Web: `<div role="button">`. Native: `Pressable`. */
  Pressable: PressableProps;
  /** Text field. Web: `<input>` / `<textarea>`. Native: `TextInput`. */
  Input: InputProps;
  /** Picture. Web: `<img>`. Native: `Image`. */
  Image: ImageProps;
  /** Scrollable container. Web: `<div>` with `overflow: auto`. Native: `ScrollView`. */
  Scroll: ScrollProps;

  /**
   * Video player. Web: `<video>` with the lib's controls. Native: the lib's
   * native player (AVPlayer on iOS, Media3 on Android).
   * The `ref` is a `VideoHandle` (`play`, `pause`, `seekTo`, `setFullscreen`).
   * Requires `configure({ modules: { video: true } })`.
   */
  Video: VideoProps;

  /**
   * Audio player. Web: `<audio>` with the lib's controls. Native: the lib's
   * native player (AVPlayer on iOS, Media3 on Android) with a card-style UI.
   * The `ref` is an `AudioHandle` (`play`, `pause`, `seekTo`).
   * Requires `configure({ modules: { audio: true } })`.
   */
  Audio: AudioProps;

  /**
   * PDF viewer. Web: pdf.js (loaded on demand). iOS: PDFKit. Android: the system
   * `PdfRenderer` with Jetpack Compose (basic viewer on Android older than 12).
   * The `ref` is a `PdfHandle` (`goToPage`, `search`, `searchNext`, `searchPrevious`, `clearSearch`, `setZoom`).
   * Requires `configure({ modules: { pdf: true } })`.
   */
  Pdf: PdfProps;

  /**
   * Bottom sheet. Web: a native `<dialog>` with drag and snapping. iOS: a SwiftUI
   * sheet (`presentationDetents`). Android: a Jetpack Compose sheet.
   * The `ref` is a `BottomSheetHandle` (`snapTo`).
   * Requires `configure({ modules: { sheet: true } })`.
   */
  BottomSheet: BottomSheetProps;

  /** @deprecated Use `Box`. */
  View: BoxProps;
  /** @deprecated Use `Input`. */
  TextInput: InputProps;
  /** @deprecated Use `Scroll`. */
  ScrollView: ScrollProps;
  /** @deprecated Use `Pressable` (with `when('state:pressed', { style: { opacity } })`). */
  TouchableOpacity: PressableProps & {
    /** Opacity while pressed (0–1). */
    activeOpacity?: number;
  };
  /** @deprecated Use `Pressable` (with `when('state:pressed', { style: { backgroundColor } })`). */
  TouchableHighlight: PressableProps & {
    /** Background color shown while pressed. */
    underlayColor?: string;
  };
  /** @deprecated Use `Pressable`. */
  TouchableWithoutFeedback: PressableProps;

  /** On/off toggle (React Native `Switch`). @platform native */
  Switch: NativeLoose;
  /** Loading spinner (React Native `ActivityIndicator`). @platform native */
  ActivityIndicator: NativeLoose;
  /** Content shown over the app (React Native `Modal`). @platform native */
  Modal: NativeLoose;
  /** Controls the system status bar (React Native `StatusBar`). @platform native */
  StatusBar: NativeLoose;
  /** Moves its content out of the keyboard's way (React Native `KeyboardAvoidingView`). @platform native */
  KeyboardAvoidingView: NativeLoose;
  /** A container with a background image (React Native `ImageBackground`). @platform native */
  ImageBackground: NativeLoose;
  /** Keeps content inside the device's safe area (React Native `SafeAreaView`). @platform native */
  SafeAreaView: NativeLoose;
  /** Virtualized list for long data (React Native `FlatList`). @platform native */
  FlatList: NativeLoose;
  /** Virtualized list grouped in sections (React Native `SectionList`). @platform native */
  SectionList: NativeLoose;
}
