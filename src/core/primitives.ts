/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  HTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SVGProps,
  TextareaHTMLAttributes,
} from 'react';
import type { StyleInput } from './style/types';
import type { AudioHandle, AudioOwnProps, VideoHandle, VideoOwnProps } from './media';
import type { PdfHandle, PdfOwnProps } from './pdf';
import type { BottomSheetHandle, BottomSheetOwnProps } from './sheet';
import type { CameraHandle, CameraOwnProps } from './camera';
import type { DatePickerOwnProps } from './datePicker';
import type { ImageHandle, ImageOwnProps, ImageSourceInput } from './image';
import type { ModalOwnProps } from './modal';

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
 * declare module 'react-isoform' {
 *   interface IsoNativeProps { collapsable?: boolean }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IsoNativeProps {}

/** The element's DOM props, minus the ones isoform redefines (`style`, `onChange`, `autoCorrect`). */
type Dom<T extends HTMLAttributes<any>> = Omit<T, 'style' | 'onChange' | 'autoCorrect'>;

/**
 * Props of `Box`: a layout container.
 * Web: `<div>` with React Native defaults (flex column). Native: `View`.
 */
export type BoxProps = Dom<HTMLAttributes<HTMLDivElement>> & CommonProps & IsoNativeProps;

/**
 * Props of `Text`: a piece of text.
 * Web: `<span>`. Native: `Text`.
 */
export type TextProps = Dom<HTMLAttributes<HTMLSpanElement>> &
  CommonProps &
  IsoNativeProps & {
    /** Maximum number of lines; extra text is cut with an ellipsis. Web: `-webkit-line-clamp`. */
    numberOfLines?: number;
  };

/**
 * Props of `Pressable`: anything that reacts to a tap or click.
 * Web: `<div role="button">` (focusable, Enter/Space trigger `onPress`). Native: `Pressable`.
 */
export type PressableProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  IsoNativeProps & {
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
  IsoNativeProps & {
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
 * Props of `Image`: a picture. Use the web-standard `src` and `alt`.
 * With the `image` module on (see {@link ImageOwnProps}): the lib's own pipeline on iOS and
 * Android (caches, blurhash, crossfade, tint, blur, animated pictures) and `<img>` with the
 * same props on the web. Off: React Native's `Image` and a plain `<img>` (the extra props
 * that the plain image understands still apply: `contentFit`, `tintColor`, `blurRadius`).
 */
export type ImageProps = Omit<Dom<ImgHTMLAttributes<HTMLImageElement>>, 'src' | 'placeholder' | keyof ImageOwnProps> &
  ImageOwnProps &
  CommonProps &
  IsoNativeProps & {
    /** The picture: a URL, a `require('./pic.png')` or `{ uri, headers, cacheKey }`. */
    src?: ImageSourceInput;
    /** @deprecated Use `src`. */
    source?: { uri: string } | string | number;
  };

/**
 * Props of `Scroll`: a scrollable container.
 * Web: `<div>` with `overflow: auto`. Native: `ScrollView`.
 */
export type ScrollProps = Dom<HTMLAttributes<HTMLDivElement>> &
  CommonProps &
  IsoNativeProps & {
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
type Media<Own> = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof Own> & Own & CommonProps & IsoNativeProps;

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
  IsoNativeProps & {
    /** The content of the sheet. */
    children?: ReactNode;
  };

/**
 * Props of `Camera`: the live camera preview (see {@link CameraOwnProps}). The style sizes
 * the preview, which fills its box (cropping, like `objectFit: 'cover'`).
 * Requires `configure({ modules: { camera: true } })`.
 */
export type CameraProps = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof CameraOwnProps> &
  CameraOwnProps &
  CommonProps &
  IsoNativeProps;

/**
 * Props of `DatePicker`: pick a date, a time or both (see {@link DatePickerOwnProps}).
 * The style sizes the picker (native pickers have their own natural height).
 * Requires `configure({ modules: { datePicker: true } })`.
 */
export type DatePickerProps = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof DatePickerOwnProps> &
  DatePickerOwnProps &
  CommonProps &
  IsoNativeProps;

/**
 * Props of `Modal`: content over the whole app (see {@link ModalOwnProps}). The `style` styles
 * the card: `backgroundColor`, `borderRadius` and `width`/`maxWidth` go to the native
 * surface, the rest (padding, gap…) to the content. With the `modal` module off it is
 * React Native's `Modal` (native only).
 */
export type ModalProps = Omit<Dom<HTMLAttributes<HTMLElement>>, keyof ModalOwnProps> &
  Omit<ModalOwnProps, 'children'> &
  CommonProps &
  IsoNativeProps & {
    /** The content of the modal. */
    children?: ReactNode;
    /** React Native `Modal` (module off, written the old way): no full-screen background. */
    transparent?: boolean;
    /** React Native `Modal` (module off): `'fullScreen'`, `'pageSheet'`, `'formSheet'` or `'overFullScreen'`. @platform ios */
    presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
    /** React Native `Modal` (module off): draws under the status bar. @platform android */
    statusBarTranslucent?: boolean;
    /** React Native `Modal` (module off): draws under the navigation bar. @platform android */
    navigationBarTranslucent?: boolean;
    /** React Native `Modal` (module off): orientations allowed while it is shown. @platform ios */
    supportedOrientations?: Array<'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right'>;
    /** React Native `Modal` (module off): called once it is shown. */
    onShow?: (event?: any) => void;
    /** React Native `Modal` (module off): called once it is gone. Prefer `onClosed`. @platform ios */
    onDismiss?: () => void;
  };

/**
 * Props of an SVG primitive: the element's SVG attributes (`d`, `cx`, `viewBox`, `fill`…,
 * camelCase as in React) plus the common ones. Presentation attributes also work in the
 * style (`fill`, `stroke`, `strokeWidth`…), so they can come from the theme and `when()`.
 * Requires `configure({ modules: { svg: true } })`.
 */
export type SvgElementProps<E extends SVGElement = SVGElement> = Omit<SVGProps<E>, 'style' | 'ref' | 'children'> &
  CommonProps &
  IsoNativeProps & {
    /** Called on tap (native) or click (web). */
    onPress?: (event?: any) => void;
  };

/**
 * Props of `Svg`: the drawing's root. The style sizes and places the box (`width`,
 * `height`, `margin`…); presentation keys (`color`, `fill`, `stroke`…) are inherited
 * by the shapes inside. Native: `react-native-svg`'s `Svg` (fills its box by default).
 */
export type SvgProps = SvgElementProps<SVGSVGElement>;

/** Native-only (or legacy) components: loosely typed (any prop is accepted). */
type NativeLoose = BoxProps & { [key: string]: any };

/**
 * Primitive name → what its `ref` exposes, for the primitives that have methods.
 * `engine('Video')` and friends get a `ref` typed with it.
 */
export interface IsoPrimitiveHandles {
  /** `play`, `pause`, `seekTo`, `setFullscreen` (+ `next`/`previous`/`goTo` with `items`). */
  Video: VideoHandle;
  /** `play`, `pause`, `seekTo` (+ `next`/`previous`/`goTo` with `items`). */
  Audio: AudioHandle;
  /** `goToPage`, `search`, `setZoom`… (+ `next`/`previous`/`goTo` with `items`). */
  Pdf: PdfHandle;
  /** `snapTo`. */
  BottomSheet: BottomSheetHandle;
  /** `takePhoto`, `startRecording`, `stopRecording`. */
  Camera: CameraHandle;
  /** `zoomTo`, `resetZoom`, `rotateTo`, `play`, `pause`, `reload` (with the `image` module on). */
  Image: ImageHandle;
}

/**
 * Primitive name → props. This is what `engine('Name')` accepts.
 * Universal primitives come first; the rest are legacy or native-only.
 */
export interface IsoPrimitives {
  /** Layout container. Web: `<div>` (flex column). Native: `View`. */
  Box: BoxProps;
  /** Text. Web: `<span>`. Native: `Text`. */
  Text: TextProps;
  /** Tappable/clickable area. Web: `<div role="button">`. Native: `Pressable`. */
  Pressable: PressableProps;
  /** Text field. Web: `<input>` / `<textarea>`. Native: `TextInput`. */
  Input: InputProps;
  /**
   * Picture. Web: `<img>`. Native: `Image`. With `modules.image` on: the lib's own image
   * (caches, blurhash, crossfade, tint, blur, animated pictures) on every platform.
   */
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

  /**
   * Camera preview. Web: `getUserMedia` in a `<video>`. iOS: AVFoundation. Android:
   * CameraX with the Jetpack Compose viewfinder. The app draws its own controls.
   * The `ref` is a `CameraHandle` (`takePhoto`, `startRecording`, `stopRecording`).
   * Requires `configure({ modules: { camera: true } })`.
   */
  Camera: CameraProps;

  /**
   * Date, time or both. iOS (SwiftUI) and Android (Compose): the lib's own picker, the
   * same design on both. Web: the browser's `<input type="date">`.
   * Controlled: pass `value` and update it in `onValueChange`.
   * Requires `configure({ modules: { datePicker: true } })`.
   */
  DatePicker: DatePickerProps;

  /**
   * Root of an SVG drawing. Web: `<svg>`. Native: `react-native-svg`.
   * Requires `configure({ modules: { svg: true } })` (and, on iOS/Android, `react-native-svg` installed).
   */
  Svg: SvgProps;
  /** SVG group (`<g>`): shares presentation and `transform` with its children. */
  G: SvgElementProps<SVGGElement>;
  /** SVG path (`<path d="…">`). */
  Path: SvgElementProps<SVGPathElement>;
  /** SVG circle (`<circle cx cy r>`). */
  Circle: SvgElementProps<SVGCircleElement>;
  /** SVG rectangle (`<rect x y width height rx>`). */
  Rect: SvgElementProps<SVGRectElement>;
  /** SVG ellipse (`<ellipse cx cy rx ry>`). */
  Ellipse: SvgElementProps<SVGEllipseElement>;
  /** SVG line (`<line x1 y1 x2 y2>`). */
  Line: SvgElementProps<SVGLineElement>;
  /** SVG open shape through `points` (`<polyline>`). */
  Polyline: SvgElementProps<SVGPolylineElement>;
  /** SVG closed shape through `points` (`<polygon>`). */
  Polygon: SvgElementProps<SVGPolygonElement>;
  /** A run of text inside `SvgText` (`<tspan>`). */
  TSpan: SvgElementProps<SVGTSpanElement>;
  /** Definitions referenced by `id` (gradients, clip paths, masks…), not drawn (`<defs>`). */
  Defs: SvgElementProps<SVGDefsElement>;
  /** A color stop of a gradient (`<stop offset stopColor>`). */
  Stop: SvgElementProps<SVGStopElement>;
  /** SVG text (`<text>`). */
  SvgText: SvgElementProps<SVGTextElement>;
  /** A picture inside the drawing (`<image href>`). */
  SvgImage: SvgElementProps<SVGImageElement>;
  /** Linear gradient, used with `fill="url(#id)"` (`<linearGradient>`). */
  SvgLinearGradient: SvgElementProps<SVGLinearGradientElement>;
  /** Radial gradient, used with `fill="url(#id)"` (`<radialGradient>`). */
  SvgRadialGradient: SvgElementProps<SVGRadialGradientElement>;
  /** Clipping shape, used with `clipPath="url(#id)"` (`<clipPath>`). */
  SvgClipPath: SvgElementProps<SVGClipPathElement>;
  /** Mask, used with `mask="url(#id)"` (`<mask>`). */
  SvgMask: SvgElementProps<SVGMaskElement>;
  /** Repeating fill, used with `fill="url(#id)"` (`<pattern>`). */
  SvgPattern: SvgElementProps<SVGPatternElement>;
  /** A reusable drawing, shown with `SvgUse` (`<symbol>`). */
  SvgSymbol: SvgElementProps<SVGSymbolElement>;
  /** Draws a `SvgSymbol` or another element by `href="#id"` (`<use>`). */
  SvgUse: SvgElementProps<SVGUseElement>;

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
  /**
   * Content over the whole app. With `modules.modal` on: the lib's own modal (a centered
   * dialog or full screen, the same design on iOS, Android and the web). Off: React
   * Native's `Modal` (native only).
   */
  Modal: ModalProps;
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
