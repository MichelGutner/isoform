import { SVG_ELEMENTS, splitSvgStyle } from './svg';

describe('svg style split', () => {
  it('keeps the box style on the root and lifts presentation keys to props', () => {
    expect(splitSvgStyle({ width: 48, height: 48, margin: 8, color: 'red', fill: 'none', strokeWidth: '2px' }, true)).toEqual({
      props: { color: 'red', fill: 'none', strokeWidth: 2 },
      style: { width: 48, height: 48, margin: 8 },
    });
  });

  it('turns the whole style of a shape into props', () => {
    expect(splitSvgStyle({ fill: '#f00', opacity: 0.5, transform: 'rotate(45)', strokeDasharray: '4 2' }, false)).toEqual({
      props: { fill: '#f00', opacity: 0.5, transform: 'rotate(45)', strokeDasharray: '4 2' },
      style: {},
    });
  });

  it('prefixes the names that clash with other primitives', () => {
    expect(SVG_ELEMENTS.SvgText).toEqual({ native: 'Text', dom: 'text' });
    expect(SVG_ELEMENTS.SvgLinearGradient).toEqual({ native: 'LinearGradient', dom: 'linearGradient' });
    expect(Object.keys(SVG_ELEMENTS)).not.toContain('Text');
    expect(Object.keys(SVG_ELEMENTS)).not.toContain('LinearGradient');
  });
});
