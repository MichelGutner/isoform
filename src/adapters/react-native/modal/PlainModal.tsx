/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
import { DEFAULT_BACKDROP, DIALOG_MARGIN, DIALOG_MAX_WIDTH, DIALOG_RADIUS, modalProps, type ModalOwnProps } from '../../../core/modal';

type Props = ModalOwnProps & { style?: any; children?: React.ReactNode; [key: string]: any };

/**
 * `Modal` with the `modal` module off: React Native's own `Modal`.
 * Written the old way (`visible`, `transparent`…) it is passed through untouched; written
 * with `open`, it draws the same layout as the lib's modal (a centered card over a
 * backdrop, or full screen) with React Native's animations.
 */
export function PlainModal(props: Props) {
  if (props.open === undefined) return <RNModal {...(props as any)} />;
  const { open, onOpenChange, animation } = modalProps(props);
  const {
    presentation = 'dialog',
    dismissible = true,
    backdropColor = DEFAULT_BACKDROP,
    onClosed,
    label,
    style,
    testID,
    children,
    // consumed above
    open: _open,
    onOpenChange: _onOpenChange,
    animation: _animation,
    visible: _visible,
    onRequestClose: _onRequestClose,
    animationType: _animationType,
    ...rest
  } = props;
  const close = () => dismissible && onOpenChange?.(false);
  const dialog = presentation === 'dialog';

  return (
    <RNModal
      {...rest}
      visible={open}
      transparent={dialog}
      statusBarTranslucent
      animationType={animation === 'none' ? 'none' : animation === 'slide' ? 'slide' : 'fade'}
      onRequestClose={close}
      onDismiss={onClosed}
      testID={testID}
    >
      {dialog ? (
        <View style={styles.center}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor }]} onPress={close} accessible={false} />
          <View style={[styles.card, style]} accessibilityViewIsModal accessibilityLabel={label}>
            {children}
          </View>
        </View>
      ) : (
        <View style={[styles.full, style]} accessibilityViewIsModal accessibilityLabel={label}>
          {children}
        </View>
      )}
    </RNModal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: DIALOG_MARGIN },
  card: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, borderRadius: DIALOG_RADIUS, backgroundColor: '#fff', overflow: 'hidden' },
  full: { flex: 1, backgroundColor: '#fff' },
});
