/* eslint-disable @typescript-eslint/no-explicit-any */
import { cssContent, normalizeWebStyle } from './style';

const w = (style: any) => normalizeWebStyle(style);

describe('normalizeWebStyle', () => {
  it('turns numbers into px, except unitless properties', () => {
    expect(w({ width: 10, height: 0, opacity: 0.5, zIndex: 3, flexGrow: 2, lineHeight: 20 })).toEqual({
      width: '10px',
      height: '0',
      opacity: '0.5',
      zIndex: '3',
      flexGrow: '2',
      lineHeight: '20px',
    });
  });

  it('keeps strings intact: rem, em, vh, %, calc(), var()', () => {
    const style = {
      padding: '1rem 2rem',
      width: 'calc(100% - 8px)',
      height: '100vh',
      margin: '2em',
      color: 'var(--brand)',
      lineHeight: '1.5',
      gridTemplateColumns: '1fr 1fr',
      backdropFilter: 'blur(4px)',
    };
    expect(w(style)).toEqual(style);
  });

  it('keeps CSS custom properties, numbers as-is', () => {
    expect(w({ '--gap': 8, '--brand': '#f00' })).toEqual({ '--gap': '8', '--brand': '#f00' });
  });

  it('maps axis aliases to physical sides', () => {
    expect(w({ paddingInline: '1rem', paddingBlock: 4, marginHorizontal: 2, marginVertical: 3 })).toEqual({
      paddingLeft: '1rem',
      paddingRight: '1rem',
      paddingTop: '4px',
      paddingBottom: '4px',
      marginLeft: '2px',
      marginRight: '2px',
      marginTop: '3px',
      marginBottom: '3px',
    });
  });

  it('lets a specific side win over an axis alias, regardless of key order', () => {
    expect(w({ paddingLeft: 8, paddingHorizontal: 20 })).toMatchObject({ paddingLeft: '8px', paddingRight: '20px' });
    expect(w({ paddingHorizontal: 20, paddingLeft: 8 })).toMatchObject({ paddingLeft: '8px', paddingRight: '20px' });
  });

  it('keeps shorthands as shorthands (the sheet orders them before longhands)', () => {
    expect(w({ padding: 4, paddingLeft: 8, border: '1px solid red' })).toEqual({
      padding: '4px',
      paddingLeft: '8px',
      border: '1px solid red',
    });
  });

  it('applies RN flex semantics to numbers and passes strings through', () => {
    expect(w({ flex: 1 })).toEqual({ flexGrow: '1', flexShrink: '1', flexBasis: '0%' });
    expect(w({ flex: '1 1 auto' })).toEqual({ flex: '1 1 auto' });
  });

  it('converts transform arrays and keeps transform strings', () => {
    expect(w({ transform: [{ translateX: 10 }, { rotate: '-2deg' }, { scale: 1.5 }] })).toEqual({
      transform: 'translateX(10px) rotate(-2deg) scale(1.5)',
    });
    expect(w({ transform: 'rotate(45deg)' })).toEqual({ transform: 'rotate(45deg)' });
  });

  it('converts RN shadows and elevation into box-shadow', () => {
    const shadow = w({
      shadowColor: '#000',
      shadowOffset: { width: 1, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    });
    expect(shadow).toEqual({ boxShadow: '1px 2px 4px color-mix(in srgb, #000 25%, transparent)' });
    expect(w({ elevation: 4 }).boxShadow).toMatch(/^0 4px 6px/);
  });

  it('prefers an explicit boxShadow over RN shadow props', () => {
    expect(w({ boxShadow: '0 0 1px red', shadowOpacity: 1, elevation: 3 })).toEqual({ boxShadow: '0 0 1px red' });
  });

  it('maps resizeMode to objectFit and fontWeight to a string', () => {
    expect(w({ resizeMode: 'stretch', fontWeight: 700 })).toEqual({ objectFit: 'fill', fontWeight: '700' });
  });

  it('drops mobile-only props and empty values', () => {
    expect(
      w({ tintColor: 'red', textAlignVertical: 'center', includeFontPadding: false, color: undefined, margin: null }),
    ).toEqual({});
  });

  it('flattens arrays with last-wins', () => {
    expect(w([{ width: 1, color: 'red' }, false, { width: 2 }])).toEqual({ width: '2px', color: 'red' });
  });

  it('drops values that could break out of a rule', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(w({ color: 'red;} body{display:none', width: 4 })).toEqual({ width: '4px' });
    jest.restoreAllMocks();
  });
});

describe('cssContent / content', () => {
  it('quotes plain text and escapes quotes, backslashes and newlines', () => {
    expect(cssContent('→')).toBe('"→"');
    expect(cssContent('say "hi"')).toBe('"say \\"hi\\""');
    expect(cssContent('a\\b')).toBe('"a\\\\b"');
    expect(cssContent('a\nb')).toBe('"a\\A b"');
    expect(cssContent(3)).toBe('"3"');
  });

  it('turns the empty string into an empty CSS string', () => {
    expect(cssContent('')).toBe('""');
  });

  it('passes CSS keywords, functions and already-quoted strings through', () => {
    for (const v of ['none', 'normal', 'open-quote', 'attr(title)', 'counter(item)', 'url(a.png)', '"x"', "'y'"]) {
      expect(cssContent(v)).toBe(v);
    }
  });

  it('is applied by normalizeWebStyle', () => {
    expect(normalizeWebStyle({ content: '→', color: 'red' })).toEqual({ content: '"→"', color: 'red' });
    expect(normalizeWebStyle({ content: '' })).toEqual({ content: '""' });
  });
});
