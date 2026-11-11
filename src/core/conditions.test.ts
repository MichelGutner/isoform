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
    ['ios', 'ios', true],
    ['ios', 'android', false],
    ['android', 'android', true],
    ['web', 'web', true],
    ['web', 'ios', false],
    ['native', 'ios', true],
    ['native', 'android', true],
    ['native', 'web', false],
  ])("platform '%s' on %s → %s", (condition, platform, expected) => {
    expect(evaluateCondition(condition as any, ctx({}, platform))).toBe(expected);
  });

  it("matches 'key:value' exactly", () => {
    expect(evaluateCondition('size:lg', ctx({ size: 'lg' }))).toBe(true);
    expect(evaluateCondition('size:lg', ctx({ size: 'lgx' }))).toBe(false);
    expect(evaluateCondition('on:true', ctx({ on: true }))).toBe(true);
  });

  it('checks prop truthiness', () => {
    expect(evaluateCondition('disabled', ctx({ disabled: true }))).toBe(true);
    expect(evaluateCondition('disabled', ctx({ disabled: false }))).toBe(false);
    expect(evaluateCondition('disabled', ctx())).toBe(false);
  });
});

describe('state conditions', () => {
  it.each(['hover', 'focus', 'focus-visible', 'pressed'])("'%s' is a state, never evaluated true", (state) => {
    expect(isStateCondition(state)).toBe(true);
    expect(evaluateCondition(state as any, ctx({ [state]: true }))).toBe(false);
    expect(isStaticCondition(state as any)).toBe(true);
  });

  it('other strings are not states', () => {
    expect(isStateCondition('disabled')).toBe(false);
    expect(isStateCondition('web')).toBe(false);
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("pseudo-elemento desconhecido em when('::nope')"));
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
      expect(isBreakpointCondition(bp)).toBe(true);
      expect(isStaticCondition(bp as any)).toBe(true);
      expect(evaluateCondition(bp as any, ctx({ [bp]: true }))).toBe(false);
    }
    expect(isBreakpointCondition('xxl')).toBe(false);
  });

  it('follows configure({ breakpoints }) (replaces the defaults)', () => {
    configure({ breakpoints: { tablet: 600 } });
    expect(isBreakpointCondition('tablet')).toBe(true);
    expect(isBreakpointCondition('md')).toBe(false);
    expect(evaluateCondition('md', ctx({ md: true }))).toBe(true); // volta a ser uma prop comum
  });

  it('parses min, below and range syntaxes', () => {
    expect(parseBreakpoint('md')).toEqual({ min: 768 });
    expect(parseBreakpoint('<md')).toEqual({ min: 0, max: 768 });
    expect(parseBreakpoint('sm..lg')).toEqual({ min: 480, max: 1024 });
    for (const bad of ['<nope', 'sm..nope', 'lg..sm', 'sm..sm', 'sm..md..lg', '<', '..', 'md<']) {
      expect(parseBreakpoint(bad)).toBeNull();
    }
    expect(isStaticCondition('<md' as any)).toBe(true);
    expect(evaluateCondition('sm..lg' as any, ctx({ 'sm..lg': true }))).toBe(false);
  });

  it('platforms and states win over a breakpoint with the same name', () => {
    expect(isBreakpointCondition('web')).toBe(false);
    expect(isBreakpointCondition('hover')).toBe(false);
  });
});

describe('isStaticCondition', () => {
  it('is true for booleans and platforms (including native)', () => {
    for (const c of [true, false, 'ios', 'android', 'web', 'native']) {
      expect(isStaticCondition(c as any)).toBe(true);
    }
  });

  it('is false for functions and prop conditions', () => {
    expect(isStaticCondition((() => true) as any)).toBe(false);
    expect(isStaticCondition('disabled')).toBe(false);
    expect(isStaticCondition('variant:primary')).toBe(false);
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
