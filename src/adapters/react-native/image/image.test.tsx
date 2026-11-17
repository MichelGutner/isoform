/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createRef } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style);
  const Image: any = function Image() {
    return null;
  };
  Image.resolveAssetSource = (n: number) => ({ uri: `asset://${n}` });
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    View: ({ children }: any) => children ?? null,
    Text: ({ children }: any) => children ?? null,
    Pressable: () => null,
    TextInput: () => null,
    ScrollView: () => null,
    Modal: () => null,
    Image,
  };
});

jest.mock('./native/IsoImageViewNativeComponent', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    // a class: the `ref` gets an instance, like the real host component
    default: class IsoImageView extends React.Component {
      render() {
        return null;
      }
    },
    Commands: { zoomTo: jest.fn(), resetZoom: jest.fn(), rotateTo: jest.fn(), play: jest.fn(), pause: jest.fn(), reload: jest.fn() },
  };
});

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import type { ImageHandle } from '../../../core/image';
import { reactNativeAdapter } from '../adapter';

const Spec: any = jest.requireMock('./native/IsoImageViewNativeComponent');
const RN: any = jest.requireMock('react-native');

const Picture = engine('Image', { width: 100, height: 80 });

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

describe('Image (native)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the source and the drawing options to the native view', () => {
    configure({ modules: { image: true } });
    const tree = render(
      <Picture
        src={{ uri: 'https://x/a.jpg', headers: { Authorization: 'token' }, cacheKey: 'a' }}
        alt="A cat"
        contentFit="scale-down"
        contentPosition="top right"
        blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
        cachePolicy="disk"
        zoomable
        style={{ borderRadius: 12 }}
      />,
    );
    const props = tree.root.findByType(Spec.default).props;
    expect(props).toMatchObject({
      uri: 'https://x/a.jpg',
      cacheKey: 'a',
      headers: ['Authorization', 'token'],
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      contentFit: 'scaleDown',
      positionX: 1,
      positionY: 0,
      cachePolicy: 'disk',
      transition: 250,
      zoomable: true,
      maxZoom: 4,
      cornerRadius: 12,
      accessibilityLabel: 'A cat',
      accessible: true,
    });
  });

  it('resolves require() sources and maps the events', () => {
    configure({ modules: { image: true } });
    const onLoad = jest.fn();
    const onError = jest.fn();
    const onZoomChange = jest.fn();
    const tree = render(<Picture src={7} placeholder={8} onLoad={onLoad} onError={onError} onZoomChange={onZoomChange} />);
    const props = tree.root.findByType(Spec.default).props;
    expect(props.uri).toBe('asset://7');
    expect(props.placeholderUri).toBe('asset://8');
    props.onImageLoad({ nativeEvent: { width: 640, height: 480, cacheType: 'disk' } });
    props.onImageError({ nativeEvent: { message: 'HTTP 404' } });
    props.onImageZoom({ nativeEvent: { scale: 2, x: 1, y: 2, rotation: 90 } });
    expect(onLoad).toHaveBeenCalledWith({ width: 640, height: 480, cacheType: 'disk' });
    expect(onError).toHaveBeenCalledWith({ message: 'HTTP 404' });
    expect(onZoomChange).toHaveBeenCalledWith({ scale: 2, x: 1, y: 2, rotation: 90 });
  });

  it('sends the ref commands to the native view', () => {
    configure({ modules: { image: true } });
    const ref = createRef<ImageHandle>();
    render(<Picture ref={ref as any} src="https://x/a.jpg" />);
    act(() => {
      ref.current!.zoomTo(2, { focusX: 10, focusY: 20 });
      ref.current!.resetZoom(false);
      ref.current!.rotateTo(90);
      ref.current!.reload();
    });
    const view = expect.any(Spec.default);
    expect(Spec.Commands.zoomTo).toHaveBeenCalledWith(view, 2, 10, 20, true);
    expect(Spec.Commands.resetZoom).toHaveBeenCalledWith(view, false);
    expect(Spec.Commands.rotateTo).toHaveBeenCalledWith(view, 90, true);
    expect(Spec.Commands.reload).toHaveBeenCalledWith(view);
  });

  it('is React Native’s Image with the module off', () => {
    const onLoad = jest.fn();
    const tree = render(<Picture src="https://x/a.jpg" contentFit="fill" tintColor="red" onLoad={onLoad} />);
    expect(tree.root.findAllByType(Spec.default)).toHaveLength(0);
    const props = tree.root.findByType(RN.Image).props;
    expect(props.source).toEqual({ uri: 'https://x/a.jpg', headers: undefined });
    expect(props.resizeMode).toBe('stretch');
    expect(props.tintColor).toBe('red');
    props.onLoad({ nativeEvent: { source: { width: 10, height: 20 } } });
    expect(onLoad).toHaveBeenCalledWith({ width: 10, height: 20, cacheType: 'none' });
  });
});
