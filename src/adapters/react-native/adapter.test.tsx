/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlatform = { OS: 'ios' };
const mockSafeAreaGetter = jest.fn(() => () => null);

jest.mock('react-native', () => {
  const View = (props: any) => null;
  const Text = (props: any) => null;
  const TextInput = (props: any) => null;
  const rn: any = {
    Platform: mockPlatform,
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    View,
    Text,
    TextInput,
    Pressable: () => null,
    Image: () => null,
    ScrollView: () => null,
    TouchableOpacity: () => null,
  };
  // como no RN 0.81: ler SafeAreaView dispara aviso de deprecação
  Object.defineProperty(rn, 'SafeAreaView', { get: () => mockSafeAreaGetter(), enumerable: true });
  return rn;
});

import * as RN from 'react-native';
import { registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { reactNativeAdapter } from './adapter';

function renderProps(element: React.ReactElement, type: any) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root.findByType(type).props;
}

describe('react-native adapter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
    mockPlatform.OS = 'ios';
    mockSafeAreaGetter.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports the OS from Platform', () => {
    expect(reactNativeAdapter.name).toBe('react-native');
    expect(reactNativeAdapter.os()).toBe('ios');
    mockPlatform.OS = 'android';
    expect(reactNativeAdapter.os()).toBe('android');
  });

  it('maps universal primitives to RN components', () => {
    const p = reactNativeAdapter.primitives;
    expect(p.Box).toBe((RN as any).View);
    expect(p.Input).toBe((RN as any).TextInput);
    expect(p.Scroll).toBe((RN as any).ScrollView);
    expect(p.Pressable).toBe((RN as any).Pressable);
  });

  it('reads legacy/deprecated RN exports lazily (no warning until used)', () => {
    void reactNativeAdapter.primitives.Box;
    void reactNativeAdapter.primitives.Text;
    expect(mockSafeAreaGetter).not.toHaveBeenCalled();
    void reactNativeAdapter.primitives.SafeAreaView;
    expect(mockSafeAreaGetter).toHaveBeenCalledTimes(1);
  });

  it('renders a primitive with the normalized style (rem → number, drops web-only CSS)', () => {
    const Card = engine('Box', { padding: '1rem', cursor: 'pointer', flexDirection: 'row' });
    const props = renderProps(<Card testID="c" />, (RN as any).View);
    expect(props.style).toEqual({ padding: 16, flexDirection: 'row' });
    expect(props.testID).toBe('c');
  });

  it('keeps the same style reference across renders (cached) and merges the user style as an array', () => {
    const Card = engine('Box', { padding: 4 });
    const a = renderProps(<Card />, (RN as any).View).style;
    const b = renderProps(<Card />, (RN as any).View).style;
    expect(a).toBe(b);

    const withUser = renderProps(<Card style={{ margin: 1 }} />, (RN as any).View).style;
    expect(withUser).toEqual([{ padding: 4 }, { margin: 1 }]);
  });

  it("resolves when('ios' | 'android' | 'native' | 'web') from Platform.OS", () => {
    mockPlatform.OS = 'android';
    const Tag = engine('Box')
      .when('android', { style: { elevation: 2 } })
      .when('native', { style: { opacity: 0.9 } })
      .when('ios', { style: { shadowOpacity: 1 } })
      .when('web', { style: { cursor: 'pointer' } });
    expect(renderProps(<Tag />, (RN as any).View).style).toEqual({ elevation: 2, opacity: 0.9 });
  });

  it('Input: type="password" becomes secureTextEntry', () => {
    const Field = engine('Input');
    const props = renderProps(<Field type="password" />, (RN as any).TextInput);
    expect(props.secureTextEntry).toBe(true);
    expect('type' in props).toBe(false);
  });

  it('keeps accepting legacy names such as TouchableOpacity', () => {
    const Legacy = engine('TouchableOpacity', { padding: 2 });
    expect(renderProps(<Legacy />, (RN as any).TouchableOpacity).style).toEqual({ padding: 2 });
  });
});
