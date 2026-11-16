/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../config';
import { engine } from '../../../core/engine';
import { reactDomAdapter } from '../adapter';

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

const Icon = engine('Svg', { width: 24, height: 24, color: 'red' });
const Stroke = engine('Path', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 });

describe('svg primitives (web)', () => {
  it('renders the browser SVG elements, styled with classes', () => {
    configure({ modules: { svg: true } });
    const onPress = jest.fn();
    const { container } = render(
      <Icon viewBox="0 0 24 24" testID="icon">
        <Stroke d="M4 12h16" onPress={onPress} />
      </Icon>,
    );
    const svg = container.querySelector('svg')!;
    const path = container.querySelector('path')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('data-testid')).toBe('icon');
    expect(svg.getAttribute('class')).toContain('o-svg');
    expect(path.getAttribute('d')).toBe('M4 12h16');
    expect(path.getAttribute('class')).toBeTruthy();
    fireEvent.click(path);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders nothing (with a warning) while the module is off', () => {
    const { container } = render(
      <Icon viewBox="0 0 24 24">
        <Stroke d="M4 12h16" />
      </Icon>,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"svg"'));
  });
});
