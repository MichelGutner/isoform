/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlatformAdapter } from '../core/adapter';
import { createFakeAdapter } from '../core/testing/fakeAdapter';
import { getTheme } from '../theme';
import {
  configure,
  DEFAULT_BREAKPOINTS,
  getBreakpoints,
  getConfig,
  getProvider,
  registerBundledProvider,
  resetProvider,
} from './index';

const bundled = { ...createFakeAdapter(() => null), name: 'react' } as PlatformAdapter;
const custom = { ...createFakeAdapter(() => null), name: 'custom' } as PlatformAdapter;

describe('configure()', () => {
  beforeEach(() => {
    resetProvider();
    registerBundledProvider(bundled);
  });

  it("uses the bundled provider by default and with 'auto'", () => {
    expect(getProvider()).toBe(bundled);
    configure({ provider: 'auto' });
    expect(getProvider()).toBe(bundled);
  });

  it('accepts the explicit name that matches the bundle', () => {
    configure({ provider: 'react' });
    expect(getProvider()).toBe(bundled);
  });

  it('fails with a clear error when the requested provider is not in the bundle', () => {
    expect(() => configure({ provider: 'react-native' })).toThrow(
      /provider "react-native" is not available in this bundle \(available: "react"\)/,
    );
  });

  it('accepts a custom adapter', () => {
    configure({ provider: custom });
    expect(getProvider()).toBe(custom);
  });

  it("fails for 'auto' when nothing is bundled", () => {
    resetProvider();
    expect(() => configure({ provider: 'auto' })).toThrow(/no provider is in the bundle/);
  });

  it('forwards `theme` to updateTheme', () => {
    configure({ theme: { configureProbe: { a: 1 } } as any });
    expect((getTheme() as any).configureProbe).toEqual({ a: 1 });
  });

  it('stores native.remBase', () => {
    expect(getConfig().native.remBase).toBe(16);
    configure({ native: { remBase: 10 } });
    expect(getConfig().native.remBase).toBe(10);
  });

  it('warns (dev) when the provider changes after the first use', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getProvider(); // marca como "usado"
    configure({ provider: custom });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('after the first render'));
    warn.mockRestore();
  });

  describe('breakpoints', () => {
    it('has mobile-first defaults', () => {
      expect(getBreakpoints()).toEqual({ sm: 480, md: 768, lg: 1024, xl: 1280 });
      expect(DEFAULT_BREAKPOINTS.md).toBe(768);
    });

    it('replaces the defaults when configured and resets with the registry', () => {
      configure({ breakpoints: { tablet: 600, desktop: 1100 } });
      expect(getBreakpoints()).toEqual({ tablet: 600, desktop: 1100 });
      resetProvider();
      expect(getBreakpoints()).toEqual(DEFAULT_BREAKPOINTS);
    });

    it('rejects names that already mean something in when()', () => {
      for (const name of ['ios', 'web', 'native', 'hover', 'pressed', 'focus-visible']) {
        expect(() => configure({ breakpoints: { [name]: 100 } })).toThrow(/cannot be a breakpoint name/);
      }
    });

    it('rejects names that would clash with the range syntax', () => {
      for (const name of ['<md', 'a..b', 'has space', '1abc']) {
        expect(() => configure({ breakpoints: { [name]: 100 } })).toThrow(/invalid breakpoint name/);
      }
    });

    it('rejects invalid widths', () => {
      expect(() => configure({ breakpoints: { md: -1 } })).toThrow(/minimum width in px/);
      expect(() => configure({ breakpoints: { md: NaN } })).toThrow(/minimum width in px/);
      expect(() => configure({ breakpoints: { md: '768' as any } })).toThrow(/minimum width in px/);
    });
  });
});
