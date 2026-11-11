import { parseContent } from './pseudo';

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('parseContent', () => {
  it('absent content means an empty generated box', () => {
    expect(parseContent(undefined)).toBeUndefined();
    expect(parseContent('')).toBe('');
    expect(parseContent('""')).toBe('');
  });

  it('plain text and numbers are shown as written', () => {
    expect(parseContent('→')).toBe('→');
    expect(parseContent(3)).toBe('3');
    expect(parseContent(' ›')).toBe(' ›'); // espaços nas pontas são significativos
  });

  it('removes CSS quotes and unescapes', () => {
    expect(parseContent('"olá"')).toBe('olá');
    expect(parseContent("'x'")).toBe('x');
    expect(parseContent('"say \\"hi\\""')).toBe('say "hi"');
    expect(parseContent('"a\\A b"')).toBe('a\nb');
    expect(parseContent('"a\\\\b"')).toBe('a\\b');
  });

  it('none/normal render nothing', () => {
    expect(parseContent('none')).toBeNull();
    expect(parseContent('normal')).toBeNull();
  });

  it('attr()/counter()/url() have no mobile equivalent: skipped with a warning', () => {
    expect(parseContent('attr(title)')).toBeNull();
    expect(parseContent('url(a.png)')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('não tem equivalente no mobile'));
  });
});
