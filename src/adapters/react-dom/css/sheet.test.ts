import { AtomicSheet, rankOf, toKebab } from './sheet';
import { stringHash } from '../../../hash/stringHash';

// ambiente "node": sem `document`, o sheet só acumula texto (caso SSR)
describe('AtomicSheet (SSR / no document)', () => {
  it('creates one class per declaration and dedupes', () => {
    const s = new AtomicSheet();
    const a = s.declaration('color', 'red');
    const b = s.declaration('color', 'red');
    const c = s.declaration('color', 'blue');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(s.getText().match(/color:red/g)).toHaveLength(1);
  });

  it('orders rules by rank: shorthands before longhands, base first', () => {
    const s = new AtomicSheet();
    s.declaration('paddingLeft', '8px'); // longhand
    s.declaration('borderTop', '1px solid red'); // lado
    s.declaration('borderWidth', '2px'); // grupo
    s.declaration('padding', '4px'); // shorthand total
    s.raw('base:Box', 'o-box', 'display:flex', 0); // base

    const css = s.getText();
    const at = (needle: string) => css.indexOf(needle);
    expect(at('display:flex')).toBeLessThan(at('padding:4px'));
    expect(at('padding:4px')).toBeLessThan(at('border-width:2px'));
    expect(at('border-width:2px')).toBeLessThan(at('border-top:'));
    expect(at('border-top:')).toBeLessThan(at('padding-left:8px'));
  });

  it('inserts raw rules once and supports a selector suffix', () => {
    const s = new AtomicSheet();
    s.raw('ph:red', 'o-ph-red', 'color:red', 4, '::placeholder');
    s.raw('ph:red', 'o-ph-red', 'color:red', 4, '::placeholder');
    expect(s.getText()).toBe('.o-ph-red::placeholder{color:red}');
  });

  it('refuses values that could escape the rule', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new AtomicSheet();
    expect(s.declaration('color', 'red} body{display:none')).toBeUndefined();
    expect(s.getText()).toBe('');
    jest.restoreAllMocks();
  });
});

describe('AtomicSheet · pseudo-elements', () => {
  it('maps pseudo-elements to selectors (scrollbar gets the -webkit- prefix)', () => {
    const s = new AtomicSheet();
    const names = ['::before', '::after', '::placeholder', '::selection', '::first-letter', '::first-line', '::marker'];
    for (const n of names) s.declaration('color', 'red', { pseudo: n });
    s.declaration('width', '6px', { pseudo: '::scrollbar' });
    s.declaration('backgroundColor', 'gray', { pseudo: '::scrollbar-thumb' });
    s.declaration('backgroundColor', 'white', { pseudo: '::scrollbar-track' });
    const css = s.getText();
    for (const n of names) expect(css).toMatch(new RegExp(`\\.o-[a-z0-9]+${n}\\{color:red\\}`));
    expect(css).toMatch(/\.o-[a-z0-9]+::-webkit-scrollbar\{width:6px\}/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb\{background-color:gray\}/);
    expect(css).toMatch(/::-webkit-scrollbar-track\{background-color:white\}/);
  });

  it('ignores unknown pseudo-elements and orders rules after base/states, before breakpoints', () => {
    const s = new AtomicSheet();
    expect(s.declaration('color', 'red', { pseudo: '::nope' })).toBeUndefined();
    s.declaration('width', '1px', { bp: { min: 768, order: 4 } });
    s.declaration('height', '2px', { pseudo: '::before' });
    s.declaration('opacity', '0.5', { state: 'pressed' });
    s.declaration('margin', '3px');
    const css = s.getText();
    expect(css.indexOf('margin:3px')).toBeLessThan(css.indexOf('opacity:0.5'));
    expect(css.indexOf('opacity:0.5')).toBeLessThan(css.indexOf('::before'));
    expect(css.indexOf('::before')).toBeLessThan(css.indexOf('min-width:768px'));
  });

  it('keeps the same declaration on different pseudo-elements in different classes', () => {
    const s = new AtomicSheet();
    expect(s.declaration('color', 'red', { pseudo: '::before' })).not.toBe(s.declaration('color', 'red', { pseudo: '::after' }));
    expect(s.declaration('color', 'red', { pseudo: '::before' })).not.toBe(s.declaration('color', 'red'));
  });
});

describe('AtomicSheet · breakpoints', () => {
  it('wraps rules in @media (min-width) and orders them after base and states, by width', () => {
    const s = new AtomicSheet();
    s.declaration('padding', '30px', { bp: { min: 1024, order: 2 } });
    s.declaration('padding', '20px', { bp: { min: 768, order: 1 } });
    s.declaration('padding', '10px', { state: 'hover' });
    s.declaration('padding', '1px');

    const css = s.getText();
    const at = (needle: string) => css.indexOf(needle);
    expect(css).toMatch(/@media \(min-width:768px\)\{\.o-[a-z0-9]+\{padding:20px\}\}/);
    expect(at('padding:1px')).toBeLessThan(at('padding:10px'));
    expect(at('padding:10px')).toBeLessThan(at('min-width:768px'));
    expect(at('min-width:768px')).toBeLessThan(at('min-width:1024px'));
  });

  it('keeps shorthand-before-longhand inside the same breakpoint', () => {
    const s = new AtomicSheet();
    s.declaration('paddingLeft', '8px', { bp: { min: 768, order: 1 } });
    s.declaration('padding', '4px', { bp: { min: 768, order: 1 } });
    expect(s.getText().indexOf('padding:4px')).toBeLessThan(s.getText().indexOf('padding-left:8px'));
  });

  it('emits max-width (exclusive, -0.02px) and combined range media queries', () => {
    const s = new AtomicSheet();
    s.declaration('color', 'red', { bp: { min: 0, max: 768, order: 1 } });
    s.declaration('color', 'blue', { bp: { min: 480, max: 1024, order: 3 } });
    expect(s.getText()).toContain('@media (max-width:767.98px){');
    expect(s.getText()).toContain('@media (min-width:480px) and (max-width:1023.98px){');
  });

  it('dedupes per breakpoint (same declaration at different widths gets different classes)', () => {
    const s = new AtomicSheet();
    const a = s.declaration('color', 'red', { bp: { min: 768, order: 1 } });
    const b = s.declaration('color', 'red', { bp: { min: 768, order: 1 } });
    const c = s.declaration('color', 'red', { bp: { min: 1024, order: 2 } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('helpers', () => {
  it('kebab-cases properties, vendor prefixes and custom properties', () => {
    expect(toKebab('paddingLeft')).toBe('padding-left');
    expect(toKebab('WebkitLineClamp')).toBe('-webkit-line-clamp');
    expect(toKebab('msTransform')).toBe('-ms-transform');
    expect(toKebab('--brandColor')).toBe('--brandColor');
  });

  it('ranks shorthands below longhands', () => {
    expect(rankOf('padding')).toBeLessThan(rankOf('borderWidth'));
    expect(rankOf('borderWidth')).toBeLessThan(rankOf('borderTop'));
    expect(rankOf('borderTop')).toBeLessThan(rankOf('paddingLeft'));
  });

  it('stringHash is deterministic and spreads', () => {
    expect(stringHash('a')).toBe(stringHash('a'));
    expect(stringHash('a')).not.toBe(stringHash('b'));
    const seen = new Set(Array.from({ length: 5000 }, (_, i) => stringHash(`d|width|${i}px`)));
    expect(seen.size).toBe(5000);
  });
});
