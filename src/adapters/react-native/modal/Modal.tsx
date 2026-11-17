/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { useEffect, useState, type ReactNode } from 'react';
import { Modal as RNModal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { isModuleEnabled } from '../../../config';
import { DEFAULT_BACKDROP, DIALOG_MAX_WIDTH, dialogWidth, modalProps, type ModalOwnProps } from '../../../core/modal';
import { PlainModal } from './PlainModal';

declare const require: (id: string) => any;

/** The spec is only loaded when a modal renders: importing the adapter (tests included) does not need Codegen. */
type Spec = typeof import('./native/IsoModalViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoModalViewNativeComponent'));

type Props = Omit<ModalOwnProps, 'children'> & { children?: ReactNode; style?: any; testID?: string; [key: string]: any };

/**
 * Entry point of `Modal` on mobile: the lib's own modal with `modules.modal` on,
 * React Native's `Modal` otherwise (so turning the module off never breaks a screen).
 */
export const Modal = (props: Props) => (isModuleEnabled('modal') ? <NativeModal {...props} /> : <PlainModal {...props} />);
Modal.displayName = 'Modal';

/** The modal turns with the device, like the screen behind it. */
const ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'] as const;

/** Style keys that belong to the native card; the rest styles the content. */
function splitStyle(style: any) {
  const { backgroundColor, borderRadius, width, maxWidth, ...content } = StyleSheet.flatten(style) ?? {};
  const wanted = [width, maxWidth].filter((value): value is number => typeof value === 'number');
  return {
    color: backgroundColor,
    radius: typeof borderRadius === 'number' ? borderRadius : -1,
    maxWidth: wanted.length ? Math.min(...wanted) : undefined,
    content,
  };
}

/**
 * The modal: the native view keeps the children and moves them into its card
 * (UIKit on iOS, Compose on Android). The children's box is sized here, from the area
 * the native side reports: a dialog is as tall as its content (measured here, up to the
 * screen), full screen fills the safe area.
 *
 * On both platforms the native view covers a transparent React Native `Modal`, which
 * owns the window: it routes touches, the back button and the keyboard to React Native
 * views. The native view draws the backdrop, the card and the animations. Being full
 * screen, it also lays the children out like the screen does (a zero-size host would
 * measure a shrinkable dialog too short and cut it).
 */
function NativeModal(props: Props) {
  const { open, onOpenChange, animation } = modalProps(props);
  const { presentation = 'dialog', dismissible = true, backdropColor = DEFAULT_BACKDROP, onClosed, label, style, testID, children } = props;
  const { default: NativeView } = nativeSpec();
  const screen = useWindowDimensions();
  // stays mounted while the closing animation runs
  const [mounted, setMounted] = useState(open);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [content, setContent] = useState(0);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  const dialog = presentation === 'dialog';
  const { color, radius, maxWidth, content: contentStyle } = splitStyle(style);
  // until the native side reports its area: the screen
  const width = area?.width || (dialog ? dialogWidth(screen.width, maxWidth) : screen.width);
  const height = area?.height || screen.height;

  return (
    <RNModal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ORIENTATIONS as any}
      onRequestClose={() => dismissible && onOpenChange?.(false)}
    >
      <NativeView
        style={StyleSheet.absoluteFill}
        open={open}
        presentation={presentation}
        animation={animation}
        dismissible={dismissible}
        backdropColor={backdropColor}
        surfaceColor={color}
        cornerRadius={radius}
        maxWidth={maxWidth ?? DIALOG_MAX_WIDTH}
        contentHeight={content}
        accessibilityLabel={label}
        testID={testID}
        onModalLayout={({ nativeEvent }) => setArea({ width: nativeEvent.width, height: nativeEvent.height })}
        onModalDismiss={() => onOpenChange?.(false)}
        onModalClosed={() => {
          setMounted(false);
          onClosed?.();
        }}
      >
        <View style={dialog ? { width, maxHeight: height } : { width, height }} collapsable={false}>
          <View
            style={[dialog ? styles.shrink : styles.fill, contentStyle]}
            onLayout={dialog ? (e) => setContent(Math.ceil(e.nativeEvent.layout.height)) : undefined}
          >
            {children}
          </View>
        </View>
      </NativeView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // a dialog taller than the screen shrinks, so a `Scroll` inside it scrolls
  shrink: { flexShrink: 1 },
});
