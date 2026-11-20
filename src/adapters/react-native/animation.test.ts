/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isReversed,
  parseAnimation,
  parseEasing,
  parseFrames,
  parseTime,
  parseTransform,
  planTracks,
} from './animation';

const id = (s: any) => s;

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('parseAnimation', () => {
  it('parses the full shorthand', () => {
    expect(parseAnimation({ animation: 'pulse 1.5s ease-in-out 200ms infinite alternate both paused' })).toEqual({
      name: 'pulse',
      duration: 1500,
      delay: 200,
      timingFunction: 'ease-in-out',
      iterations: Infinity,
      direction: 'alternate',
      fill: 'both',
      paused: true,
    });
  });

  it('applies CSS defaults', () => {
    expect(parseAnimation({ animation: 'spin 300ms' })).toMatchObject({
      name: 'spin',
      duration: 300,
      delay: 0,
      timingFunction: 'ease',
      iterations: 1,
      direction: 'normal',
      fill: 'none',
      paused: false,
    });
  });

  it('understands cubic-bezier()/steps() inside the shorthand', () => {
    expect(parseAnimation({ animation: 'a 1s cubic-bezier(0.1, 0.7, 1, 0.1) 3' })).toMatchObject({
      timingFunction: 'cubic-bezier(0.1, 0.7, 1, 0.1)',
      iterations: 3,
    });
    expect(parseAnimation({ animation: 'a 1s steps(4, end)' })!.timingFunction).toBe('steps(4, end)');
  });

  it('lets longhands override the shorthand', () => {
    expect(
      parseAnimation({
        animation: 'a 1s',
        animationName: 'b',
        animationDuration: '2s',
        animationDelay: 50,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDirection: 'reverse',
        animationFillMode: 'forwards',
        animationPlayState: 'running',
      }),
    ).toEqual({
      name: 'b',
      duration: 2000,
      delay: 50,
      timingFunction: 'linear',
      iterations: Infinity,
      direction: 'reverse',
      fill: 'forwards',
      paused: false,
    });
  });

  it('uses only the first animation of a list (with a warning)', () => {
    expect(parseAnimation({ animation: 'a 1s, b 2s' })!.name).toBe('a');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('only the first one runs'));
  });

  it('returns undefined without a name or with `none`', () => {
    expect(parseAnimation({ animation: '1s linear' })).toBeUndefined();
    expect(parseAnimation({ animationName: 'none', animationDuration: '1s' })).toBeUndefined();
  });

  it('parses times', () => {
    expect(parseTime('250ms')).toBe(250);
    expect(parseTime('.5s')).toBe(500);
    expect(parseTime(120)).toBe(120);
    expect(parseTime('soon')).toBeUndefined();
  });
});

describe('parseEasing', () => {
  const bezier = jest.fn((a: number, b: number, c: number, d: number) => Object.assign((t: number) => t, { args: [a, b, c, d] }));

  it('maps CSS keywords to the right bezier curves', () => {
    expect((parseEasing('ease', bezier) as any).args).toEqual([0.25, 0.1, 0.25, 1]);
    expect((parseEasing('ease-in', bezier) as any).args).toEqual([0.42, 0, 1, 1]);
    expect((parseEasing('ease-out', bezier) as any).args).toEqual([0, 0, 0.58, 1]);
    expect((parseEasing('ease-in-out', bezier) as any).args).toEqual([0.42, 0, 0.58, 1]);
    expect((parseEasing('cubic-bezier(0.1, 0.7, 1, 0.1)', bezier) as any).args).toEqual([0.1, 0.7, 1, 0.1]);
  });

  it('implements linear and steps()', () => {
    expect(parseEasing('linear', bezier)(0.3)).toBe(0.3);
    const end = parseEasing('steps(4)', bezier);
    expect([0, 0.2, 0.26, 0.99, 1].map(end)).toEqual([0, 0, 0.25, 0.75, 1]);
    const start = parseEasing('steps(4, start)', bezier);
    expect([0, 0.01, 0.26].map(start)).toEqual([0, 0.25, 0.5]);
    expect(parseEasing('step-end', bezier)(0.99)).toBe(0);
    expect(parseEasing('step-start', bezier)(0.01)).toBe(1);
  });

  it('falls back to ease (with a warning) for unknown values', () => {
    expect((parseEasing('wobbly', bezier) as any).args).toEqual([0.25, 0.1, 0.25, 1]);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('parseFrames / parseTransform', () => {
  it('sorts frames, expands comma lists and drops invalid selectors', () => {
    const frames = parseFrames(
      { to: { opacity: 1 }, from: { opacity: 0 }, '25%, 75%': { opacity: 0.5 }, middle: { opacity: 9 } },
      id,
    );
    expect(frames.map((f) => [f.offset, f.style.opacity])).toEqual([
      [0, 0],
      [0.25, 0.5],
      [0.75, 0.5],
      [1, 1],
    ]);
  });

  it('parses transform strings and RN arrays', () => {
    expect(parseTransform('translate(10px, 4px) scale(1.2) rotate(45deg)')).toEqual([
      { fn: 'translateX', value: 10 },
      { fn: 'translateY', value: 4 },
      { fn: 'scale', value: 1.2 },
      { fn: 'rotate', value: '45deg' },
    ]);
    expect(parseTransform([{ translateY: 8 }, { rotate: '90deg' }])).toEqual([
      { fn: 'translateY', value: 8 },
      { fn: 'rotate', value: '90deg' },
    ]);
  });
});

describe('planTracks', () => {
  it('builds one track per property and per transform function', () => {
    const plan = planTracks(
      [
        { offset: 0, style: { opacity: 0, transform: 'translateY(10px)' } },
        { offset: 1, style: { opacity: 1, transform: 'translateY(0px) rotate(90deg)' } },
      ],
      {},
    );
    expect(plan.props.opacity).toEqual({ inputRange: [0, 1], outputRange: [0, 1] });
    expect(plan.transform).toEqual([
      { fn: 'translateY', track: { inputRange: [0, 1], outputRange: [10, 0] } },
      { fn: 'rotate', track: { inputRange: [0, 1], outputRange: ['0deg', '90deg'] } }, // identidade no 0%
    ]);
    expect(plan.nativeDriver).toBe(true);
  });

  it('fills missing 0%/100% from the base style, like CSS', () => {
    const plan = planTracks([{ offset: 0.5, style: { width: 200 } }], { width: 100 });
    expect(plan.props.width).toEqual({ inputRange: [0, 0.5, 1], outputRange: [100, 200, 100] });
    expect(plan.nativeDriver).toBe(false); // width não roda no native driver
  });

  it('interpolates colors and same-shape strings, drops the rest', () => {
    const plan = planTracks(
      [
        { offset: 0, style: { backgroundColor: '#fff', width: '10%', alignSelf: 'flex-start' } },
        { offset: 1, style: { backgroundColor: 'rgba(0,0,0,0.5)', width: '90%', alignSelf: 'center' } },
      ],
      {},
    );
    expect(plan.props.backgroundColor.outputRange).toEqual(['#fff', 'rgba(0,0,0,0.5)']);
    expect(plan.props.width.outputRange).toEqual(['10%', '90%']);
    expect(plan.props.alignSelf).toBeUndefined();
  });

  it('a single frame becomes a constant track', () => {
    const plan = planTracks([{ offset: 0.3, style: { height: 5 } }], {});
    expect(plan.props.height).toEqual({ inputRange: [0, 1], outputRange: [5, 5] });
  });
});

describe('isReversed', () => {
  it.each([
    ['normal', [false, false, false]],
    ['reverse', [true, true, true]],
    ['alternate', [false, true, false]],
    ['alternate-reverse', [true, false, true]],
  ] as const)('%s', (direction, expected) => {
    expect([0, 1, 2].map((i) => isReversed(direction, i))).toEqual(expected);
  });
});
