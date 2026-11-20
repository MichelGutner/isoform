import { beginThemeReads, endThemeReads, themeCss, themeView, variablesOf, type ThemeProbe } from './variables';

const theme = {
  color: { bg: '#fff', text: { primary: '#111', muted: '#666' }, alpha: 0.5, unsafe: 'red}' },
  spacing: { md: 8 },
  mode: 'light',
};

describe('variablesOf', () => {
  it('lists every safe string under the listed keys, with nested paths', () => {
    expect(variablesOf(theme, ['color'])).toEqual({
      '--iso-color-bg': '#fff',
      '--iso-color-text-primary': '#111',
      '--iso-color-text-muted': '#666',
    });
  });

  it('skips numbers, other keys and values that could escape a CSS rule', () => {
    const vars = variablesOf(theme, ['color']);
    expect(vars).not.toHaveProperty('--iso-color-alpha');
    expect(vars).not.toHaveProperty('--iso-color-unsafe');
    expect(vars).not.toHaveProperty('--iso-spacing-md');
    expect(vars).not.toHaveProperty('--iso-mode');
  });

  it('ignores listed keys the theme does not have', () => {
    expect(variablesOf(theme, ['missing'])).toEqual({});
  });

  it('turns characters that are not valid in a custom property name into underscores', () => {
    expect(variablesOf({ color: { 'a b': 'x' } }, ['color'])).toEqual({ '--iso-color-a_b': 'x' });
  });
});

describe('themeCss', () => {
  it('writes one :root rule', () => {
    expect(themeCss({ '--iso-a': '1', '--iso-b': '2' })).toBe(':root{--iso-a:1;--iso-b:2}');
  });

  it('writes nothing when there are no variables', () => {
    expect(themeCss({})).toBe('');
  });
});

describe('themeView', () => {
  const view = themeView(theme, ['color']) as any;

  it('keeps the shape of the theme and turns safe strings into var(...)', () => {
    expect(view.color.bg).toBe('var(--iso-color-bg)');
    expect(view.color.text.primary).toBe('var(--iso-color-text-primary)');
  });

  it('gives the same view for the same theme object', () => {
    expect(themeView(theme, ['color'])).toBe(view);
  });

  it('builds another view for another theme object, or other keys', () => {
    expect(themeView({ ...theme }, ['color'])).not.toBe(view);
    expect(themeView(theme, ['color', 'spacing'])).not.toBe(view);
    themeView(theme, ['color']); // restore the cache for the next tests
  });

  describe('theme reads that are real values', () => {
    const read = (fn: (t: any) => unknown): boolean => {
      const probe: ThemeProbe = { dependent: false };
      const previous = beginThemeReads(probe);
      try {
        fn(themeView(theme, ['color']));
      } finally {
        endThemeReads(previous);
      }
      return probe.dependent;
    };

    it('are not reported for variable tokens', () => {
      expect(read((t) => t.color.bg)).toBe(false);
      expect(read((t) => t.color.text.muted)).toBe(false);
    });

    it('are reported for numbers under a listed key', () => {
      expect(read((t) => t.color.alpha)).toBe(true);
    });

    it('are reported for unsafe strings, which stay real values', () => {
      expect(read((t) => t.color.unsafe)).toBe(true);
    });

    it('are reported for keys that are not listed', () => {
      expect(read((t) => t.spacing)).toBe(true);
      expect(read((t) => t.mode)).toBe(true);
    });

    it('are not reported outside a recording', () => {
      expect(() => (themeView(theme, ['color']) as any).spacing).not.toThrow();
    });

    it('restore the previous recording when nested', () => {
      const outer: ThemeProbe = { dependent: false };
      const inner: ThemeProbe = { dependent: false };
      const a = beginThemeReads(outer);
      const b = beginThemeReads(inner);
      void (themeView(theme, ['color']) as any).mode;
      endThemeReads(b);
      void (themeView(theme, ['color']) as any).mode;
      endThemeReads(a);
      expect(inner.dependent).toBe(true);
      expect(outer.dependent).toBe(true);
    });
  });
});
