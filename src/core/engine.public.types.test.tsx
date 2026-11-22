/**
 * Type tests of the public API as an app sees it (imported from 'react-isoform'): only compiling matters.
 * ts-jest only transpiles, so `yarn typecheck` compiles this file (tsconfig.typetests.json), where an unused
 * `@ts-expect-error` is an error too: each invalid example must stay rejected. The usages live in functions
 * that never run, so no platform is needed at run time.
 */
import { createRef, type AnchorHTMLAttributes, type ComponentRef, type CSSProperties } from 'react';
import type { Text as RNText, View as RNView } from 'react-native';
import { engine, type AudioHandle, type PlatformAdapter, type VideoHandle } from 'react-isoform';

/** React Native components, typed only: these tests never render them. */
declare const NativeText: typeof RNText;
declare const NativeView: typeof RNView;

/** A plain web component, as a third-party one would be written. */
const Link = (props: AnchorHTMLAttributes<HTMLAnchorElement> & { style?: CSSProperties }) => (
  <a {...props} />
);

function webUsage() {
  // primitive with custom props: `P` reaches the props, the style function and the `when()` conditions
  const Button = engine<'Pressable', { tone?: 'primary' | 'ghost' }>('Pressable', ({ props }) => ({
    opacity: props.tone === 'ghost' ? 0.6 : 1,
  })).when('props:tone=primary', { style: { backgroundColor: 'blue' } });
  const ok = [
    <Button key="a" tone="primary" onPress={() => undefined} onMouseEnter={() => undefined} aria-label="Save" />,
    // @ts-expect-error 'danger' is not one of the declared tones
    <Button key="b" tone="danger" />,
    // @ts-expect-error `onPress` takes a function
    <Button key="c" onPress="save" />,
  ];

  // any web component: its own props and its `style` type (CSSProperties) are kept
  const StyledLink = engine(Link, { textDecoration: 'none' });
  const links = [
    <StyledLink key="a" href="/home" target="_blank" />,
    // @ts-expect-error `href` is a string
    <StyledLink key="b" href={42} />,
  ];
  // @ts-expect-error 'sticky-ish' is not a CSS position
  engine(Link, { position: 'sticky-ish' });

  // `attrs` only takes the component's props (plus the custom ones)
  engine('Text').attrs({ numberOfLines: 2 });
  // @ts-expect-error typo: `numberOfLine` is not a Text prop
  engine('Text').attrs({ numberOfLine: 2 });

  return [ok, links];
}

function refHandles() {
  // primitives with an imperative API type their `ref` with the handle
  const Player = engine('Video', { width: '100%' });
  const video = createRef<VideoHandle>();
  const audio = createRef<AudioHandle>();
  video.current?.setFullscreen(true);
  return [
    <Player key="a" ref={video} src="https://example.com/a.mp4" />,
    // @ts-expect-error a Video's ref is a VideoHandle (an AudioHandle has no `setFullscreen`)
    <Player key="b" ref={audio} src="https://example.com/a.mp4" />,
  ];
}

function composition() {
  // building on another engine component keeps its custom props
  const Card = engine<'Box', { elevated?: boolean }>('Box');
  const Hero = engine(Card, ({ props }) => ({ opacity: props.elevated ? 1 : 0.9 }));
  // `.gesture()` adds the gesture callbacks to the props
  const Draggable = Hero.gesture({ pan: true });
  return [
    <Hero key="a" elevated />,
    <Draggable key="b" elevated onPan={(event) => event} />,
    // @ts-expect-error `elevated` is a boolean
    <Hero key="c" elevated="yes" />,
  ];
}

function nativeUsage() {
  // a React Native component: its props, its style type (TextStyle) and its literals are kept
  const Title = engine(NativeText, { fontWeight: '700', textTransform: 'uppercase' });
  // @ts-expect-error 'shout' is not a React Native textTransform
  engine(NativeText, { textTransform: 'shout' });

  // the `ref` is the React Native component's own instance
  const Row = engine(NativeView, () => ({ flexDirection: 'row' }));
  const view = createRef<ComponentRef<typeof RNView>>();
  const div = createRef<HTMLDivElement>();

  // custom props on a React Native component are required when declared so
  const Badge = engine<typeof RNView, { count: number }>(NativeView, ({ props }) => ({
    opacity: props.count > 0 ? 1 : 0,
  }));

  return [
    <Title key="a" numberOfLines={1}>
      Hi
    </Title>,
    // @ts-expect-error `numberOfLines` is a number
    <Title key="b" numberOfLines="1" />,
    <Row key="c" ref={view} />,
    // @ts-expect-error a View's ref is not a DOM element
    <Row key="d" ref={div} />,
    <Badge key="e" count={2} />,
    // @ts-expect-error `count` is required
    <Badge key="f" />,
  ];
}

function adapterContract() {
  // a custom platform: style values and props are `unknown`, checked before use
  const adapter: PlatformAdapter = {
    name: 'custom',
    os: () => 'custom',
    primitives: { Box: NativeView },
    compileStyle: (style) => {
      // @ts-expect-error a style value is `unknown` until checked
      style.color.toUpperCase();
      return typeof style.color === 'string' ? style.color.toUpperCase() : null;
    },
    applyProps: ({ props, compiled }) => ({ ...props, className: compiled }),
  };
  const broken: PlatformAdapter = {
    ...adapter,
    // @ts-expect-error `applyProps` returns the props object
    applyProps: () => 'props',
  };
  return [adapter, broken];
}

describe('public API typing (web and React Native)', () => {
  it('compiles the valid usages and rejects the invalid ones', () => {
    // compiling is the test; the functions only need to exist
    expect([webUsage, refHandles, composition, nativeUsage, adapterContract].every(Boolean)).toBe(true);
  });
});
