/**
 * `Modal` with the `modal` module on: the lib's own modal, the same design everywhere.
 * iOS: UIKit (spring animations, VoiceOver focus trap, keyboard avoidance), over a
 * transparent React Native `Modal` that owns the window (as on Android). Android: Jetpack Compose (scrim, spring, back button,
 * keyboard insets). Web: a native `<dialog>` (top layer, focus trap, Escape).
 * With the module off, `Modal` stays React Native's `Modal` (and is not drawn on the web).
 */

/**
 * How the modal is laid out.
 * - `'dialog'`: a card centered over a dimmed backdrop, as tall as its content. The default.
 * - `'fullScreen'`: covers the whole screen; the content stays inside the safe area.
 */
export type ModalPresentation = 'dialog' | 'fullScreen';

/**
 * How it comes in and goes out.
 * - `'scale'`: grows from 92% while fading in (default of `'dialog'`).
 * - `'slide'`: comes up from the bottom edge (default of `'fullScreen'`).
 * - `'fade'`: fades in place.
 * - `'none'`: no animation.
 */
export type ModalAnimation = 'scale' | 'slide' | 'fade' | 'none';

/** Props of `Modal` besides the common ones (`style`, `testID`…). */
export interface ModalOwnProps {
  /** Shown (`true`) or hidden (`false`). It animates in both directions. */
  open?: boolean;
  /**
   * Called when the user closes it (tap on the backdrop, back button on Android, Escape on
   * the web, the VoiceOver escape gesture on iOS). Set your `open` state to the value.
   */
  onOpenChange?: (open: boolean) => void;
  /** Layout: `'dialog'` (centered card) or `'fullScreen'`. Default `'dialog'`. */
  presentation?: ModalPresentation;
  /** Enter and exit animation. Default `'scale'` for a dialog, `'slide'` for full screen. */
  animation?: ModalAnimation;
  /** Whether the user can close it (backdrop, back button, Escape). Default `true`. */
  dismissible?: boolean;
  /** Color of the backdrop behind a dialog. Default `'rgba(0,0,0,0.4)'`. */
  backdropColor?: string;
  /** Called after the closing animation ends (the content is then unmounted). */
  onClosed?: () => void;
  /** Accessible name (`aria-label` on the web). */
  label?: string;
  /** The content. Its box takes the card's padding and layout from `style`. */
  children?: unknown;
  /** @deprecated Use `open`. React Native `Modal`'s name for it. */
  visible?: boolean;
  /** @deprecated Use `onOpenChange`. Called with no argument when the user closes it. */
  onRequestClose?: () => void;
  /** @deprecated Use `animation` (`'slide'` and `'fade'` keep their meaning). */
  animationType?: 'none' | 'slide' | 'fade';
}

/** Space kept around a dialog, in points. */
export const DIALOG_MARGIN = 24;

/** Default widest dialog, in points (a `width` or `maxWidth` in the style changes it). */
export const DIALOG_MAX_WIDTH = 420;

/** Default dialog corner radius, in points. */
export const DIALOG_RADIUS = 20;

/** Default backdrop color. */
export const DEFAULT_BACKDROP = 'rgba(0,0,0,0.4)';

/** Enter/exit duration on the web, in ms (native uses springs of about the same length). */
export const MODAL_DURATION = 280;

/** The animation used when none is given. */
export const defaultModalAnimation = (presentation: ModalPresentation = 'dialog'): ModalAnimation =>
  presentation === 'fullScreen' ? 'slide' : 'scale';

/** The props in their current names (`open`, `onOpenChange`, `animation`), with the old React Native names as fallbacks. */
export function modalProps(props: ModalOwnProps): {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  animation: ModalAnimation;
} {
  const { open, visible, onOpenChange, onRequestClose, animation, animationType, presentation } = props;
  return {
    open: Boolean(open ?? visible),
    onOpenChange: onOpenChange ?? (onRequestClose ? () => onRequestClose() : undefined),
    animation: animation ?? animationType ?? defaultModalAnimation(presentation),
  };
}

/**
 * Width of a dialog card, in points.
 * @param screen Width of the screen.
 * @param wanted `width` or `maxWidth` from the style, if any.
 */
export const dialogWidth = (screen: number, wanted?: number): number =>
  Math.max(0, Math.min(screen - 2 * DIALOG_MARGIN, wanted ?? DIALOG_MAX_WIDTH));
