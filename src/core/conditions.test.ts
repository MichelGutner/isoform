/* eslint-disable @typescript-eslint/no-explicit-any */
import { configure, registerBundledProvider, resetProvider } from '../config';
import { createFakeAdapter } from './testing/fakeAdapter';
import {
  evaluateCondition,
  isBreakpointCondition,
  isPseudoCondition,
  isStateCondition,
  isStaticCondition,
  parseBreakpoint,
  stateOf,
} from './conditions';
import { flattenStyle } from './flatten';

const ctx = (props: any = {}, platform = 'ios') => ({ theme: {} as any, props, platform });

describe('evaluateCondition', () => {
  it('handles booleans and functions', () => {
    expect(evaluateCondition(true, ctx())).toBe(true);
    expect(evaluateCondition(false, ctx())).toBe(false);
    expect(evaluateCondition(({ props }: any) => props.n > 1, ctx({ n: 2 }))).toBe(true);
  });

  it.each([
    ['platform:ios', 'ios', true],
    ['platform:ios', 'android', false],
    ['platform:android', 'android', true],
    ['platform:web', 'web', true],
    ['platform:web', 'ios', false],
    ['platform:native', 'ios', true],
    ['platform:native', 'android', true],
    ['platform:native', 'web', false],
  ])("'%s' on %s → %s", (condition, platform, expected) => {
    expect(evaluateCondition(condition as any, ctx({}, platform))).toBe(expected);
  });

  it("matches 'props:key=value' exactly", () => {
    expect(evaluateCondition('props:size=lg', ctx({ size: 'lg' }))).toBe(true);
    expect(evaluateCondition('props:size=lg', ctx({ size: 'lgx' }))).toBe(false);
    expect(evaluateCondition('props:on=true', ctx({ on: true }))).toBe(true);
  });

  it("checks prop truthiness with 'props:key'", () => {
    expect(evaluateCondition('props:disabled', ctx({ disabled: true }))).toBe(true);
    expect(evaluateCondition('props:disabled', ctx({ disabled: false }))).toBe(false);
    expect(evaluateCondition('props:disabled', ctx())).toBe(false);
  });

  it('unknown conditions (old unprefixed syntax, typos) warn once and never match', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evaluateCondition('disabled' as any, ctx({ disabled: true }))).toBe(false);
    expect(evaluateCondition('platform:tv' as any, ctx({}, 'tv'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown condition in when('disabled')"));
    warn.mockRestore();
  });
});

describe('state conditions', () => {
  it.each(['hover', 'focus', 'focus-visible', 'pressed'])("'state:%s' is a state, never evaluated true", (state) => {
    const condition = `state:${state}`;
    expect(isStateCondition(condition)).toBe(true);
    expect(stateOf(condition)).toBe(state);
    expect(evaluateCondition(condition as any, ctx({ [state]: true }))).toBe(false);
    expect(isStaticCondition(condition as any)).toBe(true);
  });

  it('other strings are not states', () => {
    expect(isStateCondition('props:disabled')).toBe(false);
    expect(isStateCondition('platform:web')).toBe(false);
    expect(isStateCondition('hover')).toBe(false); // sem o prefixo
    expect(isStateCondition('state:nope')).toBe(false);
  });
});

describe('pseudo-element conditions', () => {
  const ALL = [
    '::before', '::after', '::placeholder', '::selection', '::first-letter',
    '::first-line', '::marker', '::scrollbar', '::scrollbar-thumb', '::scrollbar-track',
  ];

  it.each(ALL)("'%s' is a pseudo-element: static and never evaluated true", (name) => {
    expect(isPseudoCondition(name)).toBe(true);
    expect(isStaticCondition(name as any)).toBe(true);
    expect(evaluateCondition(name as any, ctx({ [name]: true }))).toBe(false);
  });

  it('unknown ::names warn once and never match', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isPseudoCondition('::nope')).toBe(false);
    expect(evaluateCondition('::nope' as any, ctx({ '::nope': true }))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown condition in when('::nope')"));
    warn.mockRestore();
  });
});

describe('breakpoint conditions', () => {
  beforeEach(() => {
    resetProvider();
    registerBundledProvider(createFakeAdapter(() => null));
  });

  it('knows the defaults and is static, never evaluated true', () => {
    for (const bp of ['sm', 'md', 'lg', 'xl']) {
      const condition = `breakpoints:${bp}`;
      expect(isBreakpointCondition(condition)).toBe(true);
      expect(isStaticCondition(condition as any)).toBe(true);
      expect(evaluateCondition(condition as any, ctx({ [bp]: true }))).toBe(false);
    }
    expect(isBreakpointCondition('breakpoints:xxl')).toBe(false);
    expect(isBreakpointCondition('md')).toBe(false); // sem o prefixo
  });

  it('follows configure({ breakpoints }) (replaces the defaults)', () => {
    configure({ breakpoints: { tablet: 600 } });
    expect(isBreakpointCondition('breakpoints:tablet')).toBe(true);
    expect(isBreakpointCondition('breakpoints:md')).toBe(false);
  });

  it('parses min, below and range syntaxes', () => {
    expect(parseBreakpoint('breakpoints:md')).toEqual({ min: 768 });
    expect(parseBreakpoint('breakpoints:<md')).toEqual({ min: 0, max: 768 });
    expect(parseBreakpoint('breakpoints:sm..lg')).toEqual({ min: 480, max: 1024 });
    for (const bad of ['<nope', 'sm..nope', 'lg..sm', 'sm..sm', 'sm..md..lg', '<', '..', 'md<']) {
      expect(parseBreakpoint(`breakpoints:${bad}`)).toBeNull();
    }
    expect(isStaticCondition('breakpoints:<md' as any)).toBe(true);
    expect(evaluateCondition('breakpoints:sm..lg' as any, ctx({ 'sm..lg': true }))).toBe(false);
  });

  it('an unknown breakpoint warns once and never matches', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evaluateCondition('breakpoints:huge' as any, ctx())).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("when('breakpoints:huge')"));
    warn.mockRestore();
  });
});

describe('isStaticCondition', () => {
  it('is true for booleans and platforms (including native)', () => {
    for (const c of [true, false, 'platform:ios', 'platform:android', 'platform:web', 'platform:native']) {
      expect(isStaticCondition(c as any)).toBe(true);
    }
  });

  it('is false for functions and prop conditions', () => {
    expect(isStaticCondition((() => true) as any)).toBe(false);
    expect(isStaticCondition('props:disabled')).toBe(false);
    expect(isStaticCondition('props:variant=primary')).toBe(false);
  });
});

describe('flattenStyle', () => {
  it('merges objects, nested arrays and ignores falsy values, last wins', () => {
    expect(flattenStyle([{ a: 1, b: 1 }, false, null, undefined, [{ b: 2 }, [{ c: 3 }]]])).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it('returns an empty object for nothing', () => {
    expect(flattenStyle(undefined)).toEqual({});
    expect(flattenStyle([])).toEqual({});
  });
});
