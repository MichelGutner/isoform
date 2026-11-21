/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactDomAdapter } from '../adapter';

/** jsdom has no PointerEvent: a MouseEvent with the pointer fields is enough for the recognizer. */
function pointer(el: Element, type: string, id: number, x: number, y: number, time: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: id },
    pointerType: { value: 'touch' },
    timeStamp: { value: time },
  });
  el.dispatchEvent(event);
}

function mount(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { el: container.firstElementChild as HTMLElement, unmount: () => act(() => root.unmount()) };
}

describe('.gesture() on the web', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetProvider();
    registerBundledProvider(reactDomAdapter);
    configure({ modules: { gestures: true } });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('drags the element, reports the pan and springs back on release', () => {
    const onPan = jest.fn();
    const onSwipe = jest.fn();
    const Card = engine('Box').gesture({ pan: { axis: 'x' }, swipe: true });
    const { el, unmount } = mount(<Card onPan={onPan} onSwipe={onSwipe} />);
    expect(el.style.touchAction).toBe('pan-y');
    expect(el.getAttribute('onPan')).toBeNull();

    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 30, 2, 20);
    expect(el.style.translate).toBe('30px 0px');
    pointer(el, 'pointermove', 1, 120, 4, 60);
    pointer(el, 'pointerup', 1, 140, 4, 80);

    expect(onPan.mock.calls.map(([e]) => e.phase)).toEqual(['start', 'move', 'end']);
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ direction: 'right' }));
    // released: back to rest, animated
    expect(el.style.translate).toBe('');
    expect(el.style.transition).toContain('translate');
    unmount();
  });

  it("stays where it was left with release: 'stay', inside the bounds", () => {
    const Card = engine('Box').gesture({ pan: { release: 'stay', bounds: { right: 50 } } });
    const { el } = mount(<Card />);
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 80, 0, 50);
    pointer(el, 'pointerup', 1, 80, 0, 300);
    expect(el.style.translate).toBe('50px 0px');
  });

  it('with swipe.exit, flies off screen before onSwipe', () => {
    const onSwipe = jest.fn();
    const Row = engine('Box').gesture({ pan: { axis: 'x' }, swipe: { exit: true } });
    const { el } = mount(<Row onSwipe={onSwipe} />);
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 60, 0, 20);
    pointer(el, 'pointerup', 1, 120, 0, 60);
    expect(el.style.translate).toBe(`${window.innerWidth * 1.2}px 0px`);
    expect(onSwipe).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(220));
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ direction: 'right' }));
  });

  it('recognizes a double tap and a long press', () => {
    const onDoubleTap = jest.fn();
    const onLongPress = jest.fn();
    const Card = engine('Box').gesture({ doubleTap: true, longPress: { minDuration: 400 } });
    const { el } = mount(<Card onDoubleTap={onDoubleTap} onLongPress={onLongPress} />);

    pointer(el, 'pointerdown', 1, 10, 10, 0);
    pointer(el, 'pointerup', 1, 10, 10, 50);
    pointer(el, 'pointerdown', 2, 12, 11, 150);
    pointer(el, 'pointerup', 2, 12, 11, 200);
    expect(onDoubleTap).toHaveBeenCalledWith({ x: 12, y: 11 });

    pointer(el, 'pointerdown', 3, 5, 5, 1000);
    act(() => jest.advanceTimersByTime(400));
    expect(onLongPress).toHaveBeenCalledWith({ x: 5, y: 5 });
  });

  it('pinches and rotates with two fingers', () => {
    const onPinch = jest.fn();
    const onRotate = jest.fn();
    const Card = engine('Box').gesture({ pinch: true, rotate: true });
    const { el } = mount(<Card onPinch={onPinch} onRotate={onRotate} />);
    expect(el.style.touchAction).toBe('none');

    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointerdown', 2, 100, 0, 0);
    pointer(el, 'pointermove', 2, 0, 200, 50); // twice as far, a quarter turn
    expect(onPinch).toHaveBeenCalledWith(expect.objectContaining({ phase: 'start', scale: 2 }));
    expect(onRotate.mock.calls[0][0].rotation).toBeCloseTo(Math.PI / 2);
    expect(el.style.scale).toBe('2');

    pointer(el, 'pointerup', 2, 0, 200, 80);
    expect(onPinch.mock.calls.at(-1)[0].phase).toBe('end');
    expect(el.style.scale).toBe('');
  });

  it('snaps to the nearest point ahead of the finger and reports it', () => {
    const onSnap = jest.fn();
    const Sheet = engine('Box').gesture({ pan: { axis: 'y', snap: { y: [-300, 0] } } });
    const { el } = mount(<Sheet onSnap={onSnap} />);
    pointer(el, 'pointerdown', 1, 0, 300, 0);
    pointer(el, 'pointermove', 1, 0, 260, 20);
    pointer(el, 'pointerup', 1, 0, 220, 40); // a quick flick up
    expect(onSnap).toHaveBeenCalledWith({ x: 0, y: -300 });
    expect(el.style.translate).toBe('0px -300px');
    expect(el.style.transition).toContain('cubic-bezier');
  });

  it('resists past the bounds with the rubber band, then glides back inside', () => {
    const Card = engine('Box').gesture({ pan: { axis: 'x', release: 'stay', bounds: { right: 50 }, rubberBand: true } });
    const { el } = mount(<Card />);
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 150, 0, 200);
    const shown = parseFloat(el.style.translate);
    expect(shown).toBeGreaterThan(50);
    expect(shown).toBeLessThan(150);
    pointer(el, 'pointerup', 1, 150, 0, 400);
    expect(el.style.translate).toBe('50px 0px');
  });

  it("glides on with release: 'decay'", () => {
    const Card = engine('Box').gesture({ pan: { axis: 'x', release: 'decay' } });
    const { el } = mount(<Card />);
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 50, 0, 50);
    pointer(el, 'pointerup', 1, 100, 0, 100); // 1000 px/s
    expect(parseFloat(el.style.translate)).toBeCloseTo(100 + 1000 * 0.3);
    expect(el.style.transition).toContain('900ms');
  });

  it('drives the interpolate styles from the offset', () => {
    const Row = engine('Box').gesture({
      pan: { axis: 'x' },
      interpolate: [{ from: 'x', input: [0, 100], style: { opacity: [1, 0], backgroundColor: ['#000000', '#ffffff'] } }],
    });
    const { el } = mount(<Row />);
    expect(el.style.opacity).toBe('1');
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 50, 0, 50);
    expect(el.style.opacity).toBe('0.5');
    expect(el.style.backgroundColor).toBe('rgb(128, 128, 128)');
  });

  it('lets the innermost element with .gesture() win', () => {
    const outerPan = jest.fn();
    const innerPan = jest.fn();
    const Outer = engine('Box').gesture({ pan: true });
    const Inner = engine('Box').gesture({ pan: true });
    const { el } = mount(
      <Outer onPan={outerPan}>
        <Inner onPan={innerPan} />
      </Outer>,
    );
    const inner = el.firstElementChild as HTMLElement;
    pointer(inner, 'pointerdown', 1, 0, 0, 0);
    pointer(inner, 'pointermove', 1, 40, 0, 20);
    pointer(inner, 'pointermove', 1, 60, 0, 40);
    pointer(inner, 'pointerup', 1, 60, 0, 60);
    expect(innerPan.mock.calls.map(([e]) => e.phase)).toEqual(['start', 'move', 'end']);
    expect(outerPan).not.toHaveBeenCalled();
  });

  it('pinches with the trackpad (ctrl + wheel) without zooming the page', () => {
    const onPinch = jest.fn();
    const Card = engine('Box').gesture({ pinch: { release: 'stay' } });
    const { el } = mount(<Card onPinch={onPinch} />);
    const wheel = new WheelEvent('wheel', { deltaY: -50, ctrlKey: true, cancelable: true, bubbles: true });
    el.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(onPinch).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'start' }));
    expect(parseFloat(el.style.scale)).toBeCloseTo(Math.exp(0.5));
    act(() => jest.advanceTimersByTime(200));
    expect(onPinch).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'end' }));
  });

  it("keeps pan and pinch apart with simultaneous: false", () => {
    const onPinch = jest.fn();
    const Card = engine('Box').gesture({ pan: true, pinch: true, simultaneous: false });
    const { el } = mount(<Card onPinch={onPinch} />);
    pointer(el, 'pointerdown', 1, 0, 0, 0);
    pointer(el, 'pointermove', 1, 40, 0, 20);
    pointer(el, 'pointerdown', 2, 100, 0, 30);
    pointer(el, 'pointermove', 2, 200, 0, 40);
    expect(onPinch).not.toHaveBeenCalled();
  });

  it('only applies to Box', () => {
    const Label = engine('Text').gesture({ pan: true });
    mount(<Label>hi</Label>);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/only applies to Box/);
  });
});
