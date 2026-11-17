/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { isModuleEnabled } from '../../../config';
import { warnModuleDisabled } from '../../../core/modules';
import { DEFAULT_DETENTS, SHEET_TOP_GAP, encodeDetents, resolveDetents, type BottomSheetHandle, type BottomSheetOwnProps } from '../../../core/sheet';

declare const require: (id: string) => any;

/** The spec is only loaded when a sheet renders: importing the adapter (tests included) does not need Codegen. */
type Spec = typeof import('./native/IsoSheetViewNativeComponent');
let spec: Spec | undefined;
const nativeSpec = (): Spec => (spec ??= require('./native/IsoSheetViewNativeComponent'));

type Props = Omit<BottomSheetOwnProps, 'children'> & { children?: ReactNode; style?: any; testID?: string };

/**
 * Entry point of `BottomSheet` on mobile. With `modules.sheet` off nothing is
 * rendered (and a dev warning is shown), instead of "native component not found".
 */
export const BottomSheet = forwardRef<BottomSheetHandle, Props>((props, ref) => {
  if (!isModuleEnabled('sheet')) {
    warnModuleDisabled('sheet');
    return null;
  }
  return <NativeBottomSheet ref={ref} {...props} />;
});
BottomSheet.displayName = 'BottomSheet';

/** Style keys that belong to the native surface; the rest styles the content. */
function splitStyle(style: any) {
  const { backgroundColor, borderRadius, borderTopLeftRadius, borderTopRightRadius, ...content } = StyleSheet.flatten(style) ?? {};
  const radius = borderTopLeftRadius ?? borderTopRightRadius ?? borderRadius;
  return { color: backgroundColor, radius: typeof radius === 'number' ? radius : -1, content };
}

/**
 * The sheet: the native view keeps the children and moves them into the sheet
 * (SwiftUI on iOS, Compose on Android). The children's box is sized here, from
 * the content area the native side reports, so flex layouts fill the sheet.
 *
 * Android draws the sheet inside a transparent React Native `Modal`: that window
 * already routes touches, the back button and the keyboard to React Native views,
 * which a Compose dialog window would not. A non-modal sheet (`modal={false}`) is
 * drawn over its parent instead, so the screen behind keeps working: place it at
 * the root of the screen.
 */
const NativeBottomSheet = forwardRef<BottomSheetHandle, Props>(
  (
    { open, onOpenChange, detents, detent = 0, onDetentChange, dismissible = true, modal = true, grabber = true, onClosed, label, style, testID, children },
    ref,
  ) => {
    const { default: NativeSheet } = nativeSpec();
    const screen = useWindowDimensions();
    // stays mounted while the closing animation runs
    const [mounted, setMounted] = useState(open);
    const [index, setIndex] = useState(detent);
    const [area, setArea] = useState<{ width: number; height: number } | null>(null);
    const [content, setContent] = useState(0);

    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);
    useEffect(() => setIndex(detent), [detent]);
    // `snapTo` reports the move like a drag does (read through a ref: the handle is created once)
    const report = useRef(onDetentChange);
    report.current = onDetentChange;
    useImperativeHandle(
      ref,
      () => ({
        snapTo: (next: number) => {
          setIndex(next);
          report.current?.({ index: next });
        },
      }),
      [],
    );

    if (!mounted) return null;

    const list = detents?.length ? detents : DEFAULT_DETENTS;
    const fits = list.includes('fit');
    const { color, radius, content: contentStyle } = splitStyle(style);
    // until the native side reports its area: the screen width and the tallest detent
    const tallest = resolveDetents(list, screen.height - SHEET_TOP_GAP, content).at(-1)?.height ?? 0;
    const width = area?.width || screen.width;
    const height = fits ? undefined : area?.height || tallest;

    const sheet = (
      <NativeSheet
        style={Platform.OS === 'android' ? StyleSheet.absoluteFill : styles.anchor}
        // non-modal: touches outside the sheet reach the views behind
        pointerEvents={modal ? 'auto' : 'box-none'}
        open={open}
        detents={encodeDetents(list)}
        detent={index}
        contentHeight={content}
        dismissible={dismissible}
        modal={modal}
        grabber={grabber}
        sheetColor={color}
        cornerRadius={radius}
        accessibilityLabel={label}
        testID={testID}
        onSheetLayout={({ nativeEvent }) => setArea({ width: nativeEvent.width, height: nativeEvent.height })}
        onSheetDismiss={() => onOpenChange?.(false)}
        onSheetClosed={() => {
          setMounted(false);
          onClosed?.();
        }}
        onSheetDetent={({ nativeEvent }) => {
          setIndex(nativeEvent.index);
          onDetentChange?.({ index: nativeEvent.index });
        }}
      >
        <View style={{ width, height }} collapsable={false}>
          <View
            style={[fits ? null : styles.fill, contentStyle]}
            onLayout={fits ? (e) => setContent(Math.ceil(e.nativeEvent.layout.height)) : undefined}
          >
            {children}
          </View>
        </View>
      </NativeSheet>
    );

    if (Platform.OS !== 'android' || !modal) return sheet;
    return (
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => dismissible && onOpenChange?.(false)}
      >
        {sheet}
      </Modal>
    );
  },
);
NativeBottomSheet.displayName = 'NativeBottomSheet';

const styles = StyleSheet.create({
  // iOS: the view itself takes no space; the children live in the SwiftUI sheet
  anchor: { position: 'absolute', width: 0, height: 0 },
  fill: { flex: 1 },
});
