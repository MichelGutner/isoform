/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style);
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }), addEventListener: () => ({ remove: () => {} }) },
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    View: function View({ children }: any) {
      return children ?? null;
    },
    Text: ({ children }: any) => children ?? null,
    Pressable: () => null,
    TextInput: () => null,
    ScrollView: () => null,
    Image: () => null,
    Modal: function Modal({ children }: any) {
      return children ?? null;
    },
  };
});

jest.mock('./native/IsoModalViewNativeComponent', () => ({
  __esModule: true,
  default: function IsoModalView({ children }: any) {
    return children ?? null;
  },
}));

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactNativeAdapter } from '../adapter';

const Spec: any = jest.requireMock('./native/IsoModalViewNativeComponent');
const RN: any = jest.requireMock('react-native');

const Dialog = engine('Modal', { padding: 16 });

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

describe('Modal (native)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the props and splits the card style from the content style', () => {
    configure({ modules: { modal: true } });
    const tree = render(
      <Dialog open style={{ backgroundColor: 'pink', borderRadius: 8, maxWidth: 360 }} label="Confirm">
        <></>
      </Dialog>,
    );
    const props = tree.root.findByType(Spec.default).props;
    expect(props).toMatchObject({
      open: true,
      presentation: 'dialog',
      animation: 'scale',
      dismissible: true,
      surfaceColor: 'pink',
      cornerRadius: 8,
      maxWidth: 360,
      contentHeight: 0,
      accessibilityLabel: 'Confirm',
    });
    // the content box: the card width until the native side reports its area
    const [outer, inner] = tree.root.findAllByType(RN.View);
    expect(outer.props.style).toEqual({ width: 352, maxHeight: 800 });
    expect(RN.StyleSheet.flatten(inner.props.style)).toMatchObject({ padding: 16, flexShrink: 1 });

    act(() => props.onModalLayout({ nativeEvent: { width: 300, height: 600 } }));
    expect(tree.root.findAllByType(RN.View)[0].props.style).toEqual({ width: 300, maxHeight: 600 });
    act(() => inner.props.onLayout({ nativeEvent: { layout: { height: 120.2 } } }));
    expect(tree.root.findByType(Spec.default).props.contentHeight).toBe(121);
  });

  it('reports the user dismiss and unmounts after the closing animation', () => {
    configure({ modules: { modal: true } });
    const onOpenChange = jest.fn();
    const onClosed = jest.fn();
    const tree = render(<Dialog open onOpenChange={onOpenChange} onClosed={onClosed} />);
    act(() => tree.root.findByType(Spec.default).props.onModalDismiss());
    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => tree.update(<Dialog open={false} onOpenChange={onOpenChange} onClosed={onClosed} />));
    expect(tree.root.findByType(Spec.default).props.open).toBe(false);
    act(() => tree.root.findByType(Spec.default).props.onModalClosed());
    expect(onClosed).toHaveBeenCalled();
    expect(tree.root.findAllByType(Spec.default)).toHaveLength(0);
  });

  it('full screen: the safe area, and the slide animation', () => {
    configure({ modules: { modal: true } });
    const tree = render(<Dialog open presentation="fullScreen" />);
    expect(tree.root.findByType(Spec.default).props.animation).toBe('slide');
    expect(tree.root.findAllByType(RN.View)[0].props.style).toEqual({ width: 400, height: 800 });
  });

  it('is React Native’s Modal with the module off', () => {
    const onRequestClose = jest.fn();
    const tree = render(<Dialog visible transparent onRequestClose={onRequestClose} />);
    expect(tree.root.findAllByType(Spec.default)).toHaveLength(0);
    const props = tree.root.findByType(RN.Modal).props;
    expect(props).toMatchObject({ visible: true, transparent: true, onRequestClose });

    // written with `open`: the same layout, drawn by React Native's Modal
    const next = render(<Dialog open presentation="dialog" />);
    expect(next.root.findByType(RN.Modal).props).toMatchObject({ visible: true, transparent: true, animationType: 'fade' });
  });
});
