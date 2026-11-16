/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style);
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, absoluteFillObject: {}, flatten },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    View: function View({ children }: any) {
      return children ?? null;
    },
    Text: function Text({ children }: any) {
      return children ?? null;
    },
    Pressable: () => null,
    TextInput: () => null,
    Image: () => null,
    ScrollView: () => null,
  };
});

jest.mock('./native/OmniDatePickerViewNativeComponent', () => ({
  __esModule: true,
  default: function OmniDatePickerView() {
    return null;
  },
}));

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactNativeAdapter } from '../adapter';

const Spec: any = jest.requireMock('./native/OmniDatePickerViewNativeComponent');

const Picker = engine('DatePicker', { marginTop: 8 });

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

/** Props of the native picker view. */
const nativeProps = (tree: TestRenderer.ReactTestRenderer) => tree.root.findByType(Spec.default).props;

describe('DatePicker (native)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // react-test-renderer prints a deprecation notice
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactNativeAdapter);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the value, mode, limits and clock to the native view', () => {
    configure({ modules: { datePicker: true } });
    const value = new Date(2026, 10, 16, 14, 5);
    const tree = render(
      <Picker
        value={value}
        mode="datetime"
        display="wheel"
        minimumDate={new Date(2026, 0, 1)}
        locale="pt-BR"
        is24Hour
        tintColor="#ff0000"
        disabled
      />,
    );
    expect(nativeProps(tree)).toMatchObject({
      value: value.getTime(),
      mode: 'datetime',
      display: 'wheel',
      minimumDate: new Date(2026, 0, 1).getTime(),
      maximumDate: 8.64e15,
      locale: 'pt-BR',
      hourCycle: 'h24',
      tintColor: '#ff0000',
      disabled: true,
    });
  });

  it('takes the height the native picker reports', () => {
    configure({ modules: { datePicker: true } });
    const tree = render(<Picker value={new Date(0)} />);
    const heightOf = () => [nativeProps(tree).style].flat(3).reduce((all: any, item: any) => ({ ...all, ...item }), {}).height;
    expect(heightOf()).toBe(360);
    act(() => nativeProps(tree).onPickerSize({ nativeEvent: { width: 390, height: 372 } }));
    expect(heightOf()).toBe(372);
  });

  it('reports a pick clamped to the limits, and only when it is new', () => {
    configure({ modules: { datePicker: true } });
    const onValueChange = jest.fn();
    const value = new Date(2026, 5, 10);
    const tree = render(
      <Picker value={value} onValueChange={onValueChange} minimumDate={new Date(2026, 5, 1)} maximumDate={new Date(2026, 5, 30)} />,
    );
    const pick = (date: Date) => act(() => nativeProps(tree).onPickerChange({ nativeEvent: { value: date.getTime() } }));

    pick(new Date(2026, 5, 20));
    pick(new Date(2026, 8, 1));
    pick(value);
    expect(onValueChange.mock.calls.map(([date]) => date)).toEqual([new Date(2026, 5, 20), new Date(2026, 5, 30)]);
  });

  it('renders nothing (with a warning) while the module is off', () => {
    const tree = render(<Picker value={new Date(0)} />);
    expect(tree.toJSON()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"datePicker"'));
  });
});
