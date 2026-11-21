import {
  angleDelta,
  bezier,
  boundedOffset,
  boundedRanges,
  detectSwipe,
  gestureActions,
  interpolateAt,
  mergeGestures,
  movesAlong,
  phaseOf,
  resolveGestures,
  restingPlace,
  stepSnap,
  swipeFromAction,
  twoFingers,
  velocityOf,
} from './gesture';

describe('resolveGestures', () => {
  it('is undefined when nothing is on', () => {
    expect(resolveGestures(undefined)).toBeUndefined();
    expect(resolveGestures({})).toBeUndefined();
    expect(resolveGestures({ pan: false, doubleTap: false })).toBeUndefined();
  });

  it('applies the defaults of each gesture that is on', () => {
    const resolved = resolveGestures({ pan: true, swipe: true, pinch: true, rotate: true, doubleTap: true, longPress: true })!;
    expect(resolved.pan).toEqual({
      axis: 'both',
      follow: true,
      release: 'reset',
      minX: -Infinity,
      maxX: Infinity,
      minY: -Infinity,
      maxY: Infinity,
      snapX: [0],
      snapY: [0],
      rubberBand: false,
    });
    expect(resolved.swipe).toEqual({ directions: ['left', 'right', 'up', 'down'], minVelocity: 500, minDistance: 30, exit: false });
    expect(resolved.pinch).toEqual({ follow: true, release: 'reset', minScale: 0.5, maxScale: 4 });
    expect(resolved.rotate).toEqual({ follow: true, release: 'reset' });
    expect(resolved.doubleTap).toBe(true);
    expect(resolved.longPress).toEqual({ minDuration: 500 });
    expect(resolved).toMatchObject({ interpolate: [], haptics: false, simultaneous: true });
    expect(resolved.actionLabels.swipeLeft).toBe('Swipe left');
  });

  it("makes 'snap' the default release when snap points are given, sorted", () => {
    const { pan } = resolveGestures({ pan: { axis: 'y', snap: { y: [300, -200, 0] } } })!;
    expect(pan).toMatchObject({ release: 'snap', snapY: [-200, 0, 300], snapX: [0] });
    expect(resolveGestures({ pan: { snap: { y: [100] }, release: 'stay' } })!.pan!.release).toBe('stay');
  });

  it('keeps only interpolations that can run', () => {
    const { interpolate } = resolveGestures({
      pan: true,
      interpolate: [
        { from: 'x', input: [-100, 0, 100], style: { opacity: [0, 1, 0], backgroundColor: ['red', 'blue'] } },
        { from: 'y', input: [0, 0], style: { opacity: [1, 0] } },
      ],
    })!;
    expect(interpolate).toEqual([{ from: 'x', input: [-100, 0, 100], style: [['opacity', [0, 1, 0]]] }]);
  });

  it('turns bounds into signed limits', () => {
    const { pan } = resolveGestures({ pan: { axis: 'x', bounds: { left: 40, right: -80 } } })!;
    expect(pan).toMatchObject({ axis: 'x', minX: -40, maxX: 80, minY: -Infinity, maxY: Infinity });
  });

  it('tracks the pan axis, or both axes for a swipe on its own', () => {
    expect(resolveGestures({ pan: { axis: 'y' }, swipe: true })!.trackAxis).toBe('y');
    expect(resolveGestures({ swipe: true })!.trackAxis).toBe('both');
    expect(resolveGestures({ doubleTap: true })!.trackAxis).toBe('none');
  });

  it('has a key that changes with the config (and survives Infinity)', () => {
    const a = resolveGestures({ pan: true })!.key;
    expect(a).toContain('Infinity');
    expect(resolveGestures({ pan: true })!.key).toBe(a);
    expect(resolveGestures({ pan: { axis: 'x' } })!.key).not.toBe(a);
  });

  it('merges several configs gesture by gesture (the last one wins)', () => {
    const merged = mergeGestures([{ pan: true, pinch: true }, { pan: { axis: 'x' } }]);
    expect(merged).toEqual({ pan: { axis: 'x' }, pinch: true });
  });
});

describe('detectSwipe', () => {
  const swipe = resolveGestures({ swipe: true })!.swipe!;

  it('reports the direction of a fast, long enough movement', () => {
    expect(detectSwipe({ translationX: -120, translationY: 10, velocityX: -900, velocityY: 50 }, swipe)?.direction).toBe('left');
    expect(detectSwipe({ translationX: 5, translationY: 80, velocityX: 20, velocityY: 700 }, swipe)?.direction).toBe('down');
  });

  it('ignores slow, short or backwards movements', () => {
    expect(detectSwipe({ translationX: 120, translationY: 0, velocityX: 200, velocityY: 0 }, swipe)).toBeUndefined();
    expect(detectSwipe({ translationX: 10, translationY: 0, velocityX: 900, velocityY: 0 }, swipe)).toBeUndefined();
    // flicked back the other way at the end: no swipe
    expect(detectSwipe({ translationX: 120, translationY: 0, velocityX: -900, velocityY: 0 }, swipe)).toBeUndefined();
  });

  it('only counts the allowed directions', () => {
    const horizontal = resolveGestures({ swipe: { directions: ['left', 'right'] } })!.swipe!;
    expect(detectSwipe({ translationX: 0, translationY: -100, velocityX: 0, velocityY: -900 }, horizontal)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('movesAlong decides whether a pan on one axis may start', () => {
    expect(movesAlong('x', 10, 3)).toBe(true);
    expect(movesAlong('x', 3, 10)).toBe(false);
    expect(movesAlong('y', 3, 10)).toBe(true);
    expect(movesAlong('both', 0, 0)).toBe(true);
  });

  it('phaseOf maps the native codes', () => {
    expect([0, 1, 2, 3, 9].map(phaseOf)).toEqual(['start', 'move', 'end', 'cancel', 'cancel']);
  });

  it('twoFingers and angleDelta measure two fingers without jumping across ±π', () => {
    const f = twoFingers({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(f.distance).toBe(5);
    expect(f.center).toEqual({ x: 1.5, y: 2 });
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it('velocityOf uses the most recent samples, per second', () => {
    expect(velocityOf([{ value: 0, time: 0 }])).toBe(0);
    const samples = [
      { value: 0, time: 0 },
      { value: 100, time: 500 },
      { value: 150, time: 550 },
      { value: 200, time: 600 },
    ];
    // only the last 100 ms count: 100 px in 100 ms
    expect(velocityOf(samples)).toBe(1000);
  });
});

describe('release and bounds', () => {
  const pan = (options: object) => resolveGestures({ pan: options })!.pan!;

  it('picks the resting place of each release, inside the bounds', () => {
    const v = { x: 1000, y: 0 };
    expect(restingPlace(pan({}), { x: 50, y: 20 }, v)).toEqual({ x: 0, y: 0 });
    expect(restingPlace(pan({ release: 'stay', bounds: { right: 40 } }), { x: 50, y: 20 }, v)).toEqual({ x: 40, y: 20 });
    expect(restingPlace(pan({ release: 'decay' }), { x: 50, y: 0 }, v)).toEqual({ x: 350, y: 0 });
    expect(restingPlace(pan({ release: 'decay', bounds: { right: 200 } }), { x: 50, y: 0 }, v)).toEqual({ x: 200, y: 0 });
  });

  it('snaps to the nearest point ahead of the finger (a flick reaches the next one)', () => {
    const sheet = pan({ axis: 'y', snap: { y: [-400, -200, 0] } });
    expect(restingPlace(sheet, { x: 0, y: -60 }, { x: 0, y: 0 }).y).toBe(0);
    expect(restingPlace(sheet, { x: 0, y: -60 }, { x: 0, y: -1000 }).y).toBe(-200);
    // an axis the pan does not move keeps its position
    expect(restingPlace(sheet, { x: 12, y: -60 }, { x: 0, y: 0 }).x).toBe(12);
  });

  it('resists past the bounds with the rubber band, and clamps without it', () => {
    expect(boundedOffset(150, -100, 100, false)).toBe(100);
    const past = boundedOffset(150, -100, 100, true);
    expect(past).toBeGreaterThan(100);
    expect(past).toBeLessThan(150);
    expect(boundedOffset(1e5, -100, 100, true)).toBeLessThan(100 + 120);
    expect(boundedOffset(50, -100, 100, true)).toBe(50);
  });

  it('builds native ranges that follow the same curve', () => {
    expect(boundedRanges(-Infinity, Infinity, true, 1e6)).toBeNull();
    expect(boundedRanges(-50, Infinity, false, 1e6)).toEqual({ input: [-50, 1e6], output: [-50, 1e6] });
    const { input, output } = boundedRanges(-100, 100, true, 1e6)!;
    expect(input).toEqual([...input].sort((a, b) => a - b));
    expect(new Set(input).size).toBe(input.length);
    input.forEach((value, i) => expect(output[i]).toBeCloseTo(boundedOffset(value, -100, 100, true)));
  });

  it('steps between snap points (for the screen-reader actions)', () => {
    expect(stepSnap([-400, -200, 0], -10, -1)).toBe(-200);
    expect(stepSnap([-400, -200, 0], -10, 1)).toBeUndefined();
  });
});

describe('interpolation and actions', () => {
  it('interpolates numbers and colors piecewise, holding past the ends', () => {
    expect(interpolateAt([-100, 0, 100], [0, 1, 0], -50)).toBe(0.5);
    expect(interpolateAt([-100, 0, 100], [0, 1, 0], 500)).toBe(0);
    expect(interpolateAt([0, 100], ['#000000', '#ffffff'], 50)).toBe('rgba(128,128,128,1)');
  });

  it('eases like the CSS cubic-bezier', () => {
    const linear = bezier([0, 0, 1, 1]);
    expect(linear(0.3)).toBeCloseTo(0.3, 3);
    const ease = bezier([0.2, 0.9, 0.3, 1.1]);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.9);
  });

  it('lists the screen-reader alternatives of the gestures that are on', () => {
    const spec = resolveGestures({
      pan: { axis: 'y', snap: { y: [-200, 0] } },
      swipe: { directions: ['left'] },
      longPress: true,
      doubleTap: true,
      actionLabels: { swipeLeft: 'Arquivar' },
    })!;
    expect(gestureActions(spec)).toEqual([
      { name: 'swipeLeft', label: 'Arquivar' },
      { name: 'snapNext', label: 'Next position' },
      { name: 'snapPrevious', label: 'Previous position' },
      { name: 'longpress' },
      { name: 'activate' },
    ]);
    expect(swipeFromAction('left', spec.swipe!)).toMatchObject({ direction: 'left', velocityX: -500, velocityY: 0 });
  });
});
