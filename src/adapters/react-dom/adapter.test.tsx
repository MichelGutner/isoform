/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../config';
import { engine } from '../../core/engine';
import { keyframes } from '../../core/keyframes';
import { reactDomAdapter } from './adapter';

beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
});

const css = () => reactDomAdapter.getStyleText!();
const idx = (needle: string) => css().indexOf(needle);

describe('react-dom adapter · styles', () => {
  it('renders a div with RN-like defaults and atomic classes for the style', () => {
    const Card = engine('Box', { paddingInline: '1rem', width: 10, opacity: 0.5, borderRadius: 8 });
    const { container } = render(<Card testID="card" />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('data-testid')).toBe('card');
    expect(el.className).toContain('o-box');
    expect(el.className.split(' ').filter((c) => c.startsWith('o-') && c !== 'o-box')).toHaveLength(5);
    expect(css()).toContain('display:flex;flex-direction:column');
    for (const rule of ['padding-left:1rem', 'padding-right:1rem', 'width:10px', 'opacity:0.5', 'border-radius:8px']) {
      expect(css()).toContain(rule);
    }
  });

  it('accepts the full CSS vocabulary (grid, backdrop-filter, calc, var, vh)', () => {
    const Fancy = engine('Box', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      backdropFilter: 'blur(4px)',
      width: 'calc(100% - 2rem)',
      minHeight: '100vh',
      color: 'var(--brand)',
    });
    render(<Fancy />);
    for (const rule of [
      'grid-template-columns:repeat(2, 1fr)',
      'backdrop-filter:blur(4px)',
      'width:calc(100% - 2rem)',
      'min-height:100vh',
      'color:var(--brand)',
    ]) {
      expect(css()).toContain(rule);
    }
  });

  it('reuses classes between components (atomic dedupe)', () => {
    const A = engine('Box', { color: 'rebeccapurple', margin: 3 });
    const B = engine('Box', { color: 'rebeccapurple', padding: 9 });
    const { container } = render(
      <>
        <A />
        <B />
      </>,
    );
    const [a, b] = Array.from(container.children) as HTMLElement[];
    const colorClass = a.className.split(' ').find((c) => b.className.split(' ').includes(c) && c !== 'o-box');
    expect(colorClass).toBeDefined();
    expect(css().match(/color:rebeccapurple/g)).toHaveLength(1);
  });

  it('draws borders like RN: no border by default (width 0), borderWidth alone is visible (solid) and the user can override', () => {
    const Bordered = engine('Box', { borderWidth: 4, borderColor: 'tomato', borderStyle: 'dashed' });
    render(<Bordered />);
    expect(css()).toMatch(/\.o-box\{border-style:solid;border-width:0;/); // sem largura, `solid` viraria 3px (medium)
    // o estilo do usuário (dashed) vem DEPOIS da base e vence
    expect(idx('border-style:solid')).toBeLessThan(idx('border-style:dashed'));
  });

  it('places the primitive base BEFORE user classes so user styles win', () => {
    const Hidden = engine('Box', { display: 'none' });
    render(<Hidden />);
    expect(idx('o-box{')).toBeLessThan(idx('display:none'));
  });

  it('orders shorthands before longhands in the stylesheet', () => {
    const Padded = engine('Box', { paddingLeft: 8, padding: 4 });
    render(<Padded />);
    expect(idx('padding:4px')).toBeLessThan(idx('padding-left:8px'));
  });

  it('applies when() conditions by prop and platform (web = true, native = false)', () => {
    const Tag = engine<'Box', { tone?: 'a' | 'b' }>('Box')
      .when('tone:a', { style: { color: 'tomato' } })
      .when('web', { style: { cursor: 'help' } })
      .when('native', { style: { elevation: 9 } });
    render(<Tag tone="a" />);
    expect(css()).toContain('color:tomato');
    expect(css()).toContain('cursor:help');
    expect(css()).not.toContain('elevation');
  });

  it('merges the user `style` inline (normalized) and user `className`', () => {
    const Box = engine('Box', { color: 'red' });
    const { container } = render(<Box style={[{ padding: 4 }, { marginLeft: '2rem' }]} className="mine" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.padding).toBe('4px');
    expect(el.style.marginLeft).toBe('2rem');
    expect(el.className.split(' ')).toContain('mine');
  });

  it('converts RN shadow props to box-shadow', () => {
    const Shadowed = engine('Box', { shadowOpacity: 0.5, shadowRadius: 3, shadowColor: '#123456' });
    render(<Shadowed />);
    expect(css()).toContain('box-shadow:0px 0px 3px color-mix(in srgb, #123456 50%, transparent)');
  });
});

describe('react-dom adapter · states and animations', () => {
  it("compiles when('hover' | 'focus' | 'focus-visible' | 'pressed') into pseudo-class rules", () => {
    const Button = engine('Pressable', { backgroundColor: 'navy' })
      .when('hover', { style: { backgroundColor: 'blue' } })
      .when('focus', { style: { outlineColor: 'gold' } })
      .when('focus-visible', { style: { outlineWidth: 3 } })
      .when('pressed', { style: { transform: 'scale(0.98)' } });
    const { container } = render(<Button />);

    expect(css()).toMatch(/@media \(hover:hover\)\{\.o-[a-z0-9]+:hover\{background-color:blue\}\}/);
    expect(css()).toMatch(/\.o-[a-z0-9]+:focus\{outline-color:gold\}/);
    expect(css()).toMatch(/\.o-[a-z0-9]+:focus-visible\{outline-width:3px\}/);
    expect(css()).toMatch(/\.o-[a-z0-9]+:active\{transform:scale\(0\.98\)\}/);

    // as classes de estado estão no elemento
    const el = container.firstElementChild as HTMLElement;
    expect(el.className.split(' ').length).toBeGreaterThanOrEqual(6);
  });

  it('orders pressed after hover so :active wins over :hover', () => {
    const B = engine('Pressable')
      .when('pressed', { style: { color: 'crimson' } })
      .when('hover', { style: { color: 'coral' } });
    render(<B />);
    expect(idx('color:coral')).toBeLessThan(idx('color:crimson'));
  });

  it('state rules ignore non-style attrs (with a dev warning)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const B = engine('Box').when('hover', { style: { opacity: 0.9 }, title: 'x' } as any);
    const { container } = render(<B />);
    expect((container.firstElementChild as HTMLElement).hasAttribute('title')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("when('hover') só aceita { style }"));
    warn.mockRestore();
  });

  it('keyframes() is lazy: @keyframes is only emitted when a style that uses it is compiled', () => {
    const frames = {
      from: { opacity: 0, transform: [{ translateY: 8 }] },
      '50%': { opacity: 0.5 },
      to: { opacity: 1, transform: 'translateY(0)' },
    } as const;
    const a = keyframes(frames as any);
    const b = keyframes(frames as any);
    expect(a).toBe(b); // determinístico
    expect(a).toMatch(/^o-kf-/);
    expect(css()).not.toContain(a); // ainda não foi usado

    const One = engine('Box', { animation: `${a} 1s` });
    const Two = engine('Box', { animation: `${a} 2s` });
    render(
      <>
        <One />
        <Two />
      </>,
    );
    expect(css()).toContain(
      `@keyframes ${a}{from{opacity:0;transform:translateY(8px)}50%{opacity:0.5}to{opacity:1;transform:translateY(0)}}`,
    );
    expect(css().split(`@keyframes ${a}`)).toHaveLength(2); // uma única vez
  });

  it('keyframes() works when called BEFORE the provider exists (module-level declaration)', () => {
    resetProvider();
    const early = keyframes({ to: { opacity: 0.2 } }); // nenhum provedor registrado ainda
    registerBundledProvider(reactDomAdapter);
    const Fade = engine('Box', { animation: `${early} 1s` });
    render(<Fade />);
    expect(css()).toContain(`@keyframes ${early}{to{opacity:0.2}}`);
  });

  it('emits @keyframes used only inside a state variant (hover)', () => {
    const wiggle = keyframes({ '0%, 100%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(8deg)' } });
    const B = engine('Box').when('hover', { style: { animation: `${wiggle} 400ms ease` } });
    render(<B />);
    expect(css()).toContain(`@keyframes ${wiggle}{0%,100%{transform:rotate(0deg)}50%{transform:rotate(8deg)}}`);
    expect(css()).toMatch(/:hover\{animation:o-kf-[a-z0-9]+ 400ms ease\}/);
  });

  it('uses the keyframes name in `animation` like plain CSS', () => {
    const spin = keyframes({ to: { transform: 'rotate(360deg)' } });
    const Spinner = engine('Box', { animation: `${spin} 1s linear infinite` });
    render(<Spinner />);
    expect(css()).toContain(`animation:${spin} 1s linear infinite`);
    expect(css()).toContain(`@keyframes ${spin}{to{transform:rotate(360deg)}}`);
  });

  it('accepts inline keyframes in animationName', () => {
    const Inline = engine('Box', {
      animationName: { from: { opacity: 0 }, to: { opacity: 1 } } as any,
      animationDuration: '300ms',
    });
    render(<Inline />);
    const name = /animation-name:(o-kf-[a-z0-9]+)/.exec(css())![1];
    expect(css()).toContain(`@keyframes ${name}{from{opacity:0}to{opacity:1}}`);
  });

  it('ignores invalid frame selectors', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const name = keyframes({ middle: { opacity: 0.2 }, to: { opacity: 1 } } as any);
    const Bad = engine('Box', { animation: `${name} 1s` });
    render(<Bad />);
    expect(css()).toContain(`@keyframes ${name}{to{opacity:1}}`);
    warn.mockRestore();
  });
});

describe('react-dom adapter · pseudo-elements', () => {
  it("compiles when('::before' | '::after') with quoted content, defaulting to an empty content", () => {
    const Quote = engine('Text')
      .when('::before', { style: { content: '“', color: 'teal' } })
      .when('::after', { style: { width: 8, height: 8, backgroundColor: 'tomato' } });
    const { container } = render(<Quote>texto</Quote>);

    expect(css()).toMatch(/\.o-[a-z0-9]+::before\{content:"“"\}/);
    expect(css()).toMatch(/\.o-[a-z0-9]+::before\{color:teal\}/);
    expect(css()).toMatch(/\.o-[a-z0-9]+::after\{content:""\}/); // sem content → caixa vazia
    expect(css()).toMatch(/::after\{background-color:tomato\}/);
    expect((container.firstElementChild as HTMLElement).className.split(' ').length).toBeGreaterThanOrEqual(5);
  });

  it('passes CSS content keywords/functions through and drops braces', () => {
    const B = engine('Box')
      .when('::before', { style: { content: 'attr(title)' } })
      .when('::after', { style: { content: 'none' } });
    render(<B />);
    expect(css()).toMatch(/::before\{content:attr\(title\)\}/);
    expect(css()).toMatch(/::after\{content:none\}/);
  });

  it('supports the other pseudo-elements, including WebKit scrollbars', () => {
    const Field = engine('Input')
      .when('::placeholder', { style: { color: 'silver' } })
      .when('::selection', { style: { backgroundColor: 'gold' } });
    const Para = engine('Text')
      .when('::first-letter', { style: { fontSize: 32, fontWeight: '800' } })
      .when('::first-line', { style: { letterSpacing: 2 } });
    const List = engine('Box').when('::marker', { style: { color: 'crimson' } });
    const Scroller = engine('Scroll')
      .when('::scrollbar', { style: { width: 6 } })
      .when('::scrollbar-thumb', { style: { backgroundColor: 'slategray', borderRadius: 3 } })
      .when('::scrollbar-track', { style: { backgroundColor: 'whitesmoke' } });
    render(
      <>
        <Field />
        <Para>Hello</Para>
        <List />
        <Scroller />
      </>,
    );
    for (const rule of [
      /::placeholder\{color:silver\}/,
      /::selection\{background-color:gold\}/,
      /::first-letter\{font-size:32px\}/,
      /::first-letter\{font-weight:800\}/,
      /::first-line\{letter-spacing:2px\}/,
      /::marker\{color:crimson\}/,
      /::-webkit-scrollbar\{width:6px\}/,
      /::-webkit-scrollbar-thumb\{background-color:slategray\}/,
      /::-webkit-scrollbar-thumb\{border-radius:3px\}/,
      /::-webkit-scrollbar-track\{background-color:whitesmoke\}/,
    ]) {
      expect(css()).toMatch(rule);
    }
  });

  it('puts pseudo-element rules after the base rules so they are never overridden by them', () => {
    const Box = engine('Box', { color: 'red' }).when('::before', { style: { color: 'blue' } });
    render(<Box />);
    expect(idx('color:red')).toBeLessThan(idx('::before{color:blue}'));
  });

  it('does not leak pseudo-element conditions to the DOM', () => {
    const Box = engine('Box').when('::before', { style: { content: 'x' } });
    const { container } = render(<Box testID="p" />);
    expect((container.firstElementChild as HTMLElement).getAttributeNames().sort()).toEqual(['class', 'data-testid']);
  });
});

describe('react-dom adapter · breakpoints', () => {
  it("compiles when('md' | 'lg') into mobile-first @media (min-width) rules", () => {
    const Panel = engine('Box', { padding: 8, flexDirection: 'column' })
      .when('lg', { style: { padding: 32 } })
      .when('md', { style: { padding: 16, flexDirection: 'row' } });
    const { container } = render(<Panel />);

    expect(css()).toMatch(/@media \(min-width:768px\)\{\.o-[a-z0-9]+\{padding:16px\}\}/);
    expect(css()).toMatch(/@media \(min-width:768px\)\{\.o-[a-z0-9]+\{flex-direction:row\}\}/);
    expect(css()).toMatch(/@media \(min-width:1024px\)\{\.o-[a-z0-9]+\{padding:32px\}\}/);

    // ordem: base → md → lg (o maior vence quando as duas valem)
    expect(idx('padding:8px')).toBeLessThan(idx('min-width:768px'));
    expect(idx('min-width:768px')).toBeLessThan(idx('min-width:1024px'));

    // as classes estão no elemento (nenhuma prop vaza)
    const el = container.firstElementChild as HTMLElement;
    expect(el.className.split(' ').length).toBeGreaterThanOrEqual(6);
  });

  it("compiles below ('<md') and range ('sm..lg') into max-width / combined media queries", () => {
    const Box = engine('Box')
      .when('<md', { style: { padding: 4 } })
      .when('sm..lg', { style: { margin: 8 } });
    render(<Box />);
    expect(css()).toMatch(/@media \(max-width:767\.98px\)\{\.o-[a-z0-9]+\{padding:4px\}\}/);
    expect(css()).toMatch(/@media \(min-width:480px\) and \(max-width:1023\.98px\)\{\.o-[a-z0-9]+\{margin:8px\}\}/);
  });

  it('honours configure({ breakpoints }) with custom names', () => {
    configure({ breakpoints: { tablet: 600 } });
    const Cell = engine('Box').when('tablet', { style: { width: '50%' } });
    render(<Cell />);
    expect(css()).toMatch(/@media \(min-width:600px\)\{\.o-[a-z0-9]+\{width:50%\}\}/);
  });

  it('works together with states and keyframes inside a breakpoint', () => {
    const slide = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    const Card = engine('Box')
      .when('hover', { style: { opacity: 0.9 } })
      .when('md', { style: { animation: `${slide} 300ms ease-out` } });
    render(<Card />);
    expect(css()).toContain(`@keyframes ${slide}{from{opacity:0}to{opacity:1}}`);
    expect(css()).toMatch(/@media \(min-width:768px\)\{\.o-[a-z0-9]+\{animation:o-kf-[a-z0-9]+ 300ms ease-out\}\}/);
    expect(css()).toMatch(/@media \(hover:hover\)\{\.o-[a-z0-9]+:hover\{opacity:0\.9\}\}/);
  });

  it('does not forward a prop named like a breakpoint to the DOM', () => {
    const Box = engine<'Box', { md?: boolean }>('Box').when('md', { style: { opacity: 0.5 } });
    const { container } = render(<Box md />);
    expect((container.firstElementChild as HTMLElement).hasAttribute('md')).toBe(false);
  });
});

describe('react-dom adapter · props', () => {
  it('Pressable: onPress on click and on Enter/Space, with role and tabIndex', () => {
    const onPress = jest.fn();
    const Button = engine('Pressable');
    render(<Button onPress={onPress} testID="b" aria-label="Salvar" />);
    const el = screen.getByTestId('b');

    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('Salvar');

    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    fireEvent.keyDown(el, { key: 'a' });
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('Pressable: onPressIn/onPressOut map to pointer events (and never reach the DOM by name)', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const Button = engine('Pressable');
    render(<Button onPressIn={onPressIn} onPressOut={onPressOut} testID="b" />);
    const el = screen.getByTestId('b');
    fireEvent.pointerDown(el);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el);
    fireEvent.pointerLeave(el);
    expect(onPressOut).toHaveBeenCalledTimes(2); // soltar e sair da área
    expect(el.hasAttribute('onpressin')).toBe(false);
  });

  it('Pressable: disabled blocks onPress and sets aria-disabled', () => {
    const onPress = jest.fn();
    const Button = engine('Pressable');
    render(<Button onPress={onPress} disabled testID="b" />);
    const el = screen.getByTestId('b');
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onPress).not.toHaveBeenCalled();
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });

  it('Pressable: accepts legacy name TouchableOpacity', () => {
    const onPress = jest.fn();
    const Legacy = engine('TouchableOpacity', { padding: 1 });
    render(<Legacy onPress={onPress} testID="t" activeOpacity={0.5} />);
    fireEvent.click(screen.getByTestId('t'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByTestId('t').hasAttribute('activeopacity')).toBe(false);
  });

  it('Input: onChangeText receives the text; multiline renders a textarea', () => {
    const onChangeText = jest.fn();
    const Field = engine('Input');
    const { rerender } = render(<Field onChangeText={onChangeText} testID="i" placeholder="nome" />);
    fireEvent.change(screen.getByTestId('i'), { target: { value: 'ana' } });
    expect(onChangeText).toHaveBeenCalledWith('ana');
    expect(screen.getByTestId('i').tagName).toBe('INPUT');

    rerender(<Field multiline numberOfLines={3} testID="i" />);
    expect(screen.getByTestId('i').tagName).toBe('TEXTAREA');
    expect(screen.getByTestId('i').getAttribute('rows')).toBe('3');
  });

  it('Input: maps legacy RN props (secureTextEntry, editable, keyboardType, placeholderTextColor)', () => {
    const Field = engine('Input');
    render(
      <Field secureTextEntry editable={false} keyboardType="email-address" placeholderTextColor="#999" testID="i" />,
    );
    const el = screen.getByTestId('i') as HTMLInputElement;
    expect(el.type).toBe('password');
    expect(el.readOnly).toBe(true);
    expect(el.getAttribute('inputmode')).toBe('email');
    expect(css()).toContain('::placeholder{color:#999');
  });

  it('Input: onSubmitEditing fires on Enter', () => {
    const onSubmit = jest.fn();
    const Field = engine('Input');
    render(<Field onSubmitEditing={onSubmit} testID="i" />);
    fireEvent.keyDown(screen.getByTestId('i'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('passes any other DOM prop straight through (id, data-*, aria-*, handlers)', () => {
    const onMouseEnter = jest.fn();
    const Box = engine('Box');
    render(<Box id="x" data-foo="bar" aria-hidden="true" onMouseEnter={onMouseEnter} testID="b" />);
    const el = screen.getByTestId('b');
    expect(el.id).toBe('x');
    expect(el.getAttribute('data-foo')).toBe('bar');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    fireEvent.mouseEnter(el);
    expect(onMouseEnter).toHaveBeenCalled();
  });

  it('does not leak style-driving props (variant, outlined, wrap…) to the DOM nor make React complain', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const Row = engine<'Box', { wrap?: boolean; variant?: string; accent?: boolean; size?: string }>('Box')
      .when('wrap', { style: { flexWrap: 'wrap' } })
      .when('accent', { style: { borderColor: 'red' } });
    render(<Row wrap accent variant="primary" size="lg" testID="r" aria-label="ok" />);
    const el = screen.getByTestId('r');

    for (const attr of ['wrap', 'accent', 'variant', 'size']) expect(el.hasAttribute(attr)).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('ok');
    expect(css()).toContain('flex-wrap:wrap'); // …mas a regra when() foi aplicada
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('keeps element-valid props per primitive (Input keeps `wrap`/`size`, Box does not)', () => {
    const Field = engine('Input');
    render(<Field multiline wrap="soft" size={4} testID="f" />);
    const el = screen.getByTestId('f');
    expect(el.getAttribute('wrap')).toBe('soft');

    const Plain = engine<'Box', { size?: number }>('Box');
    render(<Plain size={4} testID="p" />);
    expect(screen.getByTestId('p').hasAttribute('size')).toBe(false);
  });

  it('translates legacy accessibility* props to role/aria-* (and aria-* wins)', () => {
    const Box = engine('Box');
    render(
      <Box
        testID="a"
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        accessibilityHint="Fecha o painel"
        accessibilityState={{ selected: true, disabled: false }}
        aria-label="Sobrescreve"
      />,
    );
    const el = screen.getByTestId('a');
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Sobrescreve');
    expect(el.getAttribute('aria-description')).toBe('Fecha o painel');
    expect(el.getAttribute('aria-selected')).toBe('true');
    expect(el.getAttribute('aria-disabled')).toBe('false');
    expect(el.hasAttribute('accessibilityrole')).toBe(false);
  });

  it('strips mobile-only props so they never reach the DOM', () => {
    const Box = engine('Box');
    render(<Box hitSlop={{ top: 4 }} onLayout={() => {}} testID="b" />);
    const el = screen.getByTestId('b');
    expect(el.hasAttribute('hitslop')).toBe(false);
    expect(el.hasAttribute('onlayout')).toBe(false);
  });

  it('Text: numberOfLines clamps; renders a span', () => {
    const Label = engine('Text');
    render(<Label numberOfLines={2} testID="t">hello</Label>);
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('o-clamp-2');
    expect(css()).toContain('-webkit-line-clamp:2');
  });

  it('Image: src/alt pass through and `source.uri` is translated', () => {
    const Pic = engine('Image');
    const { rerender } = render(<Pic src="/a.png" alt="A" testID="p" />);
    expect((screen.getByTestId('p') as HTMLImageElement).getAttribute('src')).toBe('/a.png');

    rerender(<Pic source={{ uri: '/b.png' }} testID="p" />);
    expect((screen.getByTestId('p') as HTMLImageElement).getAttribute('src')).toBe('/b.png');
  });

  it('Scroll: renders an inner container and honours horizontal + contentContainerStyle', () => {
    const List = engine('Scroll');
    render(
      <List horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} testID="s">
        <span data-testid="child" />
      </List>,
    );
    const outer = screen.getByTestId('s');
    const inner = screen.getByTestId('child').parentElement!;
    expect(outer.style.overflowX).toBe('auto');
    expect(inner.style.flexDirection).toBe('row');
    expect(inner.style.gap).toBe('8px');
  });

  it('forwards refs to the DOM element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const Box = engine('Box');
    render(<Box ref={ref as any} />);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('wraps third-party components: className + style, no prop translation', () => {
    const Custom = ({ className, style, onPress }: any) => (
      <button data-testid="c" className={className} style={style} onClick={onPress} />
    );
    const Styled = engine(Custom, { padding: 3 });
    const onPress = jest.fn();
    render(<Styled onPress={onPress} />);
    fireEvent.click(screen.getByTestId('c'));
    expect(onPress).toHaveBeenCalled();
    expect(css()).toContain('padding:3px');
  });

  it('throws a clear error for mobile-only primitives', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const Toggle = engine('Switch');
    expect(() => render(<Toggle />)).toThrow(/primitiva "Switch" não existe no provedor "react"/);
    jest.restoreAllMocks();
  });
});
