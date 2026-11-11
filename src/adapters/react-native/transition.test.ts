/* eslint-disable @typescript-eslint/no-explicit-any */
import { lerpValue, parseColor, parseTransition, sameValue, usesNativeDriver } from './transition';

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('parseTransition', () => {
  it('parses a shorthand list: property, duration, easing and delay in any order', () => {
    expect(parseTransition({ transition: 'opacity .2s ease, transform 0.3s ease-out 50ms' })).toEqual({
      props: {
        opacity: { duration: 200, delay: 0, easing: 'ease' },
        transform: { duration: 300, delay: 50, easing: 'ease-out' },
      },
    });
    expect(parseTransition({ transition: '1s linear opacity' })).toEqual({
      props: { opacity: { duration: 1000, delay: 0, easing: 'linear' } },
    });
  });

  it("'all' applies to every property; missing property means all", () => {
    expect(parseTransition({ transition: 'all 200ms' })).toEqual({
      all: { duration: 200, delay: 0, easing: 'ease' },
      props: {},
    });
    expect(parseTransition({ transition: '300ms ease-in' })!.all).toEqual({ duration: 300, delay: 0, easing: 'ease-in' });
  });

  it('converts kebab-case properties to camelCase', () => {
    expect(Object.keys(parseTransition({ transition: 'background-color 1s, border-top-color 1s' })!.props)).toEqual([
      'backgroundColor',
      'borderTopColor',
    ]);
  });

  it('keeps cubic-bezier()/steps() easings intact', () => {
    expect(parseTransition({ transition: 'opacity 1s cubic-bezier(0.1, 0.7, 1, 0.1)' })!.props.opacity.easing).toBe(
      'cubic-bezier(0.1, 0.7, 1, 0.1)',
    );
    expect(parseTransition({ transition: 'opacity 1s steps(4, end)' })!.props.opacity.easing).toBe('steps(4, end)');
  });

  it('builds specs from longhands, cycling shorter lists across properties', () => {
    expect(
      parseTransition({
        transitionProperty: 'opacity, backgroundColor, width',
        transitionDuration: '1s, 2s',
        transitionDelay: '100ms',
        transitionTimingFunction: 'linear',
      }),
    ).toEqual({
      props: {
        opacity: { duration: 1000, delay: 100, easing: 'linear' },
        backgroundColor: { duration: 2000, delay: 100, easing: 'linear' },
        width: { duration: 1000, delay: 100, easing: 'linear' }, // ciclo: volta para 1s
      },
    });
  });

  it('lets longhands override the shorthand components', () => {
    expect(parseTransition({ transition: 'opacity 1s', transitionDuration: '2s', transitionDelay: 30 })).toEqual({
      props: { opacity: { duration: 2000, delay: 30, easing: 'ease' } },
    });
  });

  it('skips none and zero-duration entries', () => {
    expect(parseTransition({ transition: 'none' })).toBeUndefined();
    expect(parseTransition({ transition: 'opacity 0s' })).toBeUndefined();
    expect(parseTransition({ transition: 'opacity 0s, transform 1s' })!.props).toEqual({
      transform: { duration: 1000, delay: 0, easing: 'ease' },
    });
    expect(parseTransition({})).toBeUndefined();
  });
});

describe('lerpValue / parseColor', () => {
  it('interpolates numbers', () => {
    expect(lerpValue(10, 20, 0.25)).toBe(12.5);
  });

  it('interpolates hex and rgb(a) colors (including different notations)', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#00000080')![3]).toBeCloseTo(0.502, 2);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('rgba(0,0,0,.5)')).toEqual([0, 0, 0, 0.5]);
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
    expect(parseColor('papayawhip')).toBeNull();
    expect(lerpValue('#000000', '#ffffff', 0.5)).toBe('rgba(128,128,128,1)');
    expect(lerpValue('rgb(0,0,0)', 'rgba(255,0,0,0)', 0.5)).toBe('rgba(128,0,0,0.5)');
  });

  it('interpolates strings with the same shape and refuses the rest', () => {
    expect(lerpValue('0%', '100%', 0.25)).toBe('25%');
    expect(lerpValue('0deg', '90deg', 0.5)).toBe('45deg');
    expect(lerpValue('auto', 100, 0.5)).toBeUndefined();
    expect(lerpValue('10px', '10%', 0.5)).toBeUndefined();
    expect(lerpValue('papayawhip', 'tomato', 0.5)).toBeUndefined();
  });

  it('sameValue compares primitives and plain objects', () => {
    expect(sameValue(1, 1)).toBe(true);
    expect(sameValue({ a: 1 }, { a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue('a', 'b')).toBe(false);
  });

  it('only opacity/transform (without all) can use the native driver', () => {
    expect(usesNativeDriver(['opacity', 'transform'], false)).toBe(true);
    expect(usesNativeDriver(['opacity', 'width'], false)).toBe(false);
    expect(usesNativeDriver(['opacity'], true)).toBe(false);
    expect(usesNativeDriver([], false)).toBe(false);
  });
});
