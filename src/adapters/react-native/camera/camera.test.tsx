/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createRef } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style);
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, absoluteFillObject: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    Linking: { openSettings: jest.fn() },
    View: function View({ children }: any) {
      return children ?? null;
    },
    Text: function Text({ children }: any) {
      return children ?? null;
    },
    Pressable: function Pressable() {
      return null;
    },
    TextInput: () => null,
    Image: () => null,
    ScrollView: () => null,
  };
});

jest.mock('./native/OmniCameraViewNativeComponent', () => ({
  __esModule: true,
  default: function OmniCameraView() {
    return null;
  },
  Commands: {
    takePhoto: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    requestPermission: jest.fn(),
  },
}));

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import type { CameraHandle } from '../../../core/camera';
import { engine } from '../../../core/engine';
import { reactNativeAdapter } from '../adapter';

const RN: any = jest.requireMock('react-native');
const Spec: any = jest.requireMock('./native/OmniCameraViewNativeComponent');

const Preview = engine('Camera', { height: 300 });

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

/** Props of the native camera view. */
const nativeProps = (tree: TestRenderer.ReactTestRenderer) => tree.root.findByType(Spec.default).props;

describe('Camera (native)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // react-test-renderer prints a deprecation notice
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterEach(() => jest.restoreAllMocks());

  it('resolves takePhoto with the event that carries the same request id', async () => {
    configure({ modules: { camera: true } });
    const ref = createRef<CameraHandle>();
    const tree = render(<Preview ref={ref} flash="auto" />);

    let photo: Promise<unknown>;
    act(() => {
      photo = ref.current!.takePhoto();
    });
    const [, requestId, flash] = Spec.Commands.takePhoto.mock.calls[0];
    expect(flash).toBe('auto');

    act(() => {
      nativeProps(tree).onCameraPhoto({ nativeEvent: { requestId, uri: 'file:///p.jpg', width: 3024, height: 4032, error: '' } });
    });
    await expect(photo!).resolves.toEqual({ uri: 'file:///p.jpg', width: 3024, height: 4032 });
  });

  it('rejects takePhoto with the native error', async () => {
    configure({ modules: { camera: true } });
    const ref = createRef<CameraHandle>();
    const tree = render(<Preview ref={ref} />);
    let photo: Promise<unknown>;
    act(() => {
      photo = ref.current!.takePhoto({ flash: 'on' });
    });
    const [, requestId, flash] = Spec.Commands.takePhoto.mock.calls[0];
    expect(flash).toBe('on');
    act(() => {
      nativeProps(tree).onCameraPhoto({ nativeEvent: { requestId, uri: '', width: 0, height: 0, error: 'Camera is not ready' } });
    });
    await expect(photo!).rejects.toThrow('Camera is not ready');
  });

  it('keeps video and the scanner off (with a warning) until the config turns them on', async () => {
    configure({ modules: { camera: true } });
    const ref = createRef<CameraHandle>();
    const tree = render(<Preview ref={ref} video onCodeScanned={() => {}} />);
    expect(nativeProps(tree)).toMatchObject({ video: false, codeScanner: false });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"video"'));
    await expect(ref.current!.startRecording()).rejects.toThrow('video');

    configure({ modules: { camera: { enabled: true, video: true, codeScanner: true } } });
    const on = render(<Preview video onCodeScanned={() => {}} codeTypes={['qr', 'ean-13']} />);
    expect(nativeProps(on)).toMatchObject({ video: true, codeScanner: true, codeTypes: ['qr', 'ean-13'] });
  });

  it('reports codes only when they change', () => {
    configure({ modules: { camera: { enabled: true, codeScanner: true } } });
    const onCodeScanned = jest.fn();
    const tree = render(<Preview onCodeScanned={onCodeScanned} />);
    const send = (codes: any[]) => act(() => nativeProps(tree).onCameraCodes({ nativeEvent: { codes } }));
    send([{ value: 'a', type: 'qr' }]);
    send([{ value: 'a', type: 'qr' }]);
    send([]);
    expect(onCodeScanned.mock.calls).toEqual([[[{ value: 'a', type: 'qr' }]], [[]]]);
  });

  it('shows the permission notice: ask again while denied, open settings once blocked', () => {
    configure({ modules: { camera: true } });
    const onPermissionChange = jest.fn();
    const tree = render(<Preview permissionMessage="We need the camera" onPermissionChange={onPermissionChange} />);
    const permission = (camera: string) =>
      act(() => nativeProps(tree).onCameraPermission({ nativeEvent: { camera, microphone: 'undetermined' } }));

    permission('granted');
    expect(tree.root.findAllByType(RN.Pressable)).toHaveLength(0);

    permission('denied');
    expect(JSON.stringify(tree.toJSON())).toContain('We need the camera');
    act(() => tree.root.findByType(RN.Pressable).props.onPress());
    expect(Spec.Commands.requestPermission).toHaveBeenCalledTimes(1);

    permission('blocked');
    act(() => tree.root.findByType(RN.Pressable).props.onPress());
    expect(RN.Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(onPermissionChange).toHaveBeenLastCalledWith({ camera: 'blocked', microphone: 'undetermined' });
  });

  it('renders nothing (with a warning) while the module is off', () => {
    const tree = render(<Preview />);
    expect(tree.toJSON()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"camera"'));
  });
});
