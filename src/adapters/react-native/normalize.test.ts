/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeNative } from './normalize';

const env = { remBase: 16, viewport: () => ({ width: 400, height: 800 }) };
const n = (style: any, e = env) => normalizeNative(style, e);

describe('normalizeNative', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('keeps numbers and passes unrelated values through', () => {
    expect(n({ padding: 8, color: 'red', opacity: 0.5, boxShadow: '0 1px 2px red' })).toEqual({
      padding: 8,
      color: 'red',
      opacity: 0.5,
      boxShadow: '0 1px 2px red',
    });
  });

  it.each([
    ['10px', 10],
    ['1rem', 16],
    ['1.5rem', 24],
    ['50%', '50%'],
    ['auto', 'auto'],
    ['10vh', 80],
    ['25vw', 100],
  ])("width '%s' → %s", (input, expected) => {
    expect(n({ width: input }).width).toBe(expected);
  });

  it('resolves em against the fontSize of the same style', () => {
    expect(n({ fontSize: 20, padding: '2em' })).toEqual({ fontSize: 20, padding: 40 });
  });

  it('resolves em on fontSize against the parent (base), not against itself', () => {
    expect(n({ fontSize: '2em' }).fontSize).toBe(32);
    expect(n({ fontSize: '1.5rem', padding: '2em' })).toEqual({ fontSize: 24, padding: 48 });
  });

  it('honours a custom remBase', () => {
    expect(n({ width: '2rem' }, { ...env, remBase: 10 }).width).toBe(20);
  });

  it("converts unitless string lineHeight into a multiple of fontSize", () => {
    expect(n({ fontSize: 10, lineHeight: '1.5' }).lineHeight).toBe(15);
    expect(n({ lineHeight: '2rem' }).lineHeight).toBe(32);
    expect(n({ lineHeight: 22 }).lineHeight).toBe(22);
  });

  it('expands multi-value padding/margin into the four sides', () => {
    expect(n({ padding: '1rem 2rem' })).toEqual({
      paddingTop: 16,
      paddingRight: 32,
      paddingBottom: 16,
      paddingLeft: 32,
    });
    expect(n({ margin: '1px 2px 3px 4px' })).toEqual({
      marginTop: 1,
      marginRight: 2,
      marginBottom: 3,
      marginLeft: 4,
    });
  });

  it('drops values without a mobile equivalent, warning only once', () => {
    const warn = console.warn as jest.Mock;
    const out = n({ width: 'calc(100% - 8px)', height: '3ch', color: 'red' });
    expect(out).toEqual({ color: 'red' });
    n({ width: 'calc(100% - 8px)' });
    const widthWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('calc(100% - 8px)'));
    expect(widthWarnings).toHaveLength(1);
  });

  it('drops web-only properties', () => {
    expect(n({ cursor: 'pointer', transition: 'all .2s', gridTemplateColumns: '1fr 1fr', padding: 4 })).toEqual({
      padding: 4,
    });
  });

  it('stringifies numeric fontWeight (RN requires strings)', () => {
    expect(n({ fontWeight: 600 }).fontWeight).toBe('600');
  });

  it('leaves legacy RN keys untouched', () => {
    const style = { paddingHorizontal: 8, shadowOpacity: 0.2, elevation: 3, resizeMode: 'cover' };
    expect(n(style)).toEqual(style);
  });
});
