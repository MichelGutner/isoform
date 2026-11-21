import { useState } from 'react';
import { engine } from 'react-isoform';
import { Body, Button, ButtonLabel, Row, themeFade } from '../ui';
import { Code, Flags, PageShell, Section } from '../kit';

/** SVG colors glide on a theme switch or a state change (CSS on the web, redrawn per frame on iOS and Android). */
const SVG_FADE = 'fill 550ms ease, stroke 550ms ease, stop-color 550ms ease';

// ── icons: `color` on the root, `currentColor` in the shapes ──

const Icon = engine<'Svg', { active?: boolean }>('Svg', ({ theme, props }) => ({
  width: 32,
  height: 32,
  color: props.active ? theme.color.error : theme.color.text,
  transition: 'color 300ms ease',
}));

/** The fill is always `currentColor`: its opacity animates in, where `none` → color could not. */
const Outline = engine<'Path', { filled?: boolean }>('Path', ({ props }) => ({
  fill: 'currentColor',
  fillOpacity: props.filled ? 1 : 0,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  transition: 'fill-opacity 300ms ease',
}));

const OutlinePolygon = engine('Polygon', {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinejoin: 'round',
});

const IconButton = engine('Pressable', ({ theme }) => ({
  transition: themeFade(),
  padding: theme.spacing.sm,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.background,
}))
  .attrs({ role: 'button' })
  .when('state:pressed', { style: { transform: 'scale(0.92)' } })
  .when('platform:web', { style: { cursor: 'pointer' } });

const HEART = 'M12 20s-7-4.4-9.2-8.8A4.9 4.9 0 0 1 12 6.3a4.9 4.9 0 0 1 9.2 4.9C19 15.6 12 20 12 20z';
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const STAR = '12 3 14.8 9 21 9.6 16.3 13.8 17.7 20 12 16.8 6.3 20 7.7 13.8 3 9.6 9.2 9';

// ── shapes and a gradient, colored by the theme ──

const Canvas = engine('Svg', { width: '100%', height: 160 });
const Defs = engine('Defs');
const SvgLinearGradient = engine('SvgLinearGradient');
const Rect = engine('Rect');

const StopFrom = engine('Stop', ({ theme }) => ({ stopColor: theme.color.primary, transition: SVG_FADE }));
const StopTo = engine('Stop', ({ theme }) => ({ stopColor: theme.color.secondary, transition: SVG_FADE }));

const Dot = engine('Circle', ({ theme }) => ({ fill: theme.color.warning, transition: SVG_FADE }));
const Triangle = engine('Polygon', ({ theme }) => ({ fill: theme.color.success, opacity: 0.9, transition: SVG_FADE }));

const Caption = engine('SvgText', {
  fill: '#ffffff',
  fontSize: 22,
  fontWeight: '700',
  textAnchor: 'middle',
});

// ── a progress ring: a dashed stroke whose offset is the progress ──

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const Ring = engine('Svg', { width: 120, height: 120 });

const Track = engine('Circle', ({ theme }) => ({
  fill: 'none',
  stroke: theme.color.border,
  strokeWidth: 10,
  transition: SVG_FADE,
}));

const Progress = engine<'Circle', { value: number }>('Circle', ({ theme, props }) => ({
  fill: 'none',
  stroke: theme.color.primary,
  strokeWidth: 10,
  strokeLinecap: 'round',
  strokeDasharray: CIRCUMFERENCE,
  strokeDashoffset: CIRCUMFERENCE * (1 - props.value),
  transition: `stroke-dashoffset 300ms ease, ${SVG_FADE}`,
}));

const Percent = engine('SvgText', ({ theme }) => ({
  fill: theme.color.text,
  fontSize: 22,
  fontWeight: '700',
  textAnchor: 'middle',
}));

// ── a stroke that draws itself: dash length = path length, the offset hides it ──

const DRAW_LENGTH = 90;

const DrawCanvas = engine('Svg', { width: 96, height: 96 });

const Draw = engine<'Path', { drawn?: boolean }>('Path', ({ theme, props }) => ({
  fill: 'none',
  stroke: theme.color.primary,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeDasharray: DRAW_LENGTH,
  strokeDashoffset: props.drawn ? 0 : DRAW_LENGTH,
  transition: `stroke-dashoffset 900ms ease-in-out, ${SVG_FADE}`,
}));

const DrawStar = engine<'Polygon', { drawn?: boolean }>('Polygon', ({ theme, props }) => ({
  fill: 'none',
  stroke: theme.color.warning,
  strokeWidth: 2.5,
  strokeLinejoin: 'round',
  strokeDasharray: 80,
  strokeDashoffset: props.drawn ? 0 : 80,
  transition: `stroke-dashoffset 900ms ease-in-out 150ms, ${SVG_FADE}`,
}));

// ── bars: a thick line whose dash is the value (vertical, growing from the bottom) ──

const BAR_HEIGHT = 100;
const BAR_COLORS = ['primary', 'secondary', 'success', 'warning', 'error'] as const;

const Chart = engine('Svg', { width: '100%', height: 140 });

const Bar = engine<'Line', { value: number; tone: (typeof BAR_COLORS)[number] }>('Line', ({ theme, props }) => ({
  stroke: theme.color[props.tone],
  strokeWidth: 26,
  strokeLinecap: 'round',
  strokeDasharray: BAR_HEIGHT,
  strokeDashoffset: BAR_HEIGHT * (1 - props.value),
  transition: `stroke-dashoffset 600ms cubic-bezier(0.34, 1.2, 0.64, 1), ${SVG_FADE}`,
}));

const Baseline = engine('Line', ({ theme }) => ({ stroke: theme.color.border, strokeWidth: 2, transition: SVG_FADE }));

const randomBars = () => BAR_COLORS.map(() => Math.round((0.15 + Math.random() * 0.85) * 100) / 100);

// ── shapes that change color, outline and opacity together ──

const PALETTE = ['primary', 'secondary', 'success', 'warning', 'error'] as const;

const Palette = engine('Svg', { width: '100%', height: 120 });

const Swatch = engine<'Circle', { tone: (typeof PALETTE)[number]; on?: boolean }>('Circle', ({ theme, props }) => ({
  fill: theme.color[props.tone],
  fillOpacity: props.on ? 1 : 0.25,
  stroke: props.on ? theme.color.text : theme.color[props.tone],
  strokeWidth: props.on ? 5 : 1,
  transition: 'fill-opacity 400ms ease, stroke-width 400ms ease, stroke 400ms ease, fill 550ms ease',
}));

/** SVG: icons, shapes with a gradient, a progress ring and animated strokes, all styled from the theme. */
export function SvgPage() {
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0.4);
  const [drawn, setDrawn] = useState(true);
  const [bars, setBars] = useState([0.4, 0.8, 0.6, 0.95, 0.3]);
  const [tone, setTone] = useState(0);
  const step = (delta: number) => setProgress((value) => Math.min(1, Math.max(0, Math.round((value + delta) * 10) / 10)));

  return (
    <PageShell
      title="Svg"
      summary="Full SVG with the same styling as everything else: fill, stroke and friends go in the style, so they follow the theme and when(). The browser's own SVG on the web, react-native-svg on iOS and Android."
    >
      <Section title="Icons" hint="color on the root, currentColor in the shapes: one prop recolors the whole icon. Tap the heart.">
        <Row wrap>
          <IconButton onPress={() => setLiked((on) => !on)} aria-label={liked ? 'Unlike' : 'Like'} testID="svg-like">
            <Icon viewBox="0 0 24 24" active={liked}>
              <Outline d={HEART} filled={liked} />
            </Icon>
          </IconButton>
          <IconButton aria-label="Done">
            <Icon viewBox="0 0 24 24">
              <Outline d={CHECK} />
            </Icon>
          </IconButton>
          <IconButton aria-label="Favorite">
            <Icon viewBox="0 0 24 24">
              <OutlinePolygon points={STAR} />
            </Icon>
          </IconButton>
        </Row>
      </Section>

      <Section title="Shapes and gradients" hint="SvgLinearGradient + Stop with theme colors, referenced with fill='url(#id)'. Switch the accent on the Theme page.">
        <Canvas viewBox="0 0 320 160" preserveAspectRatio="xMidYMid meet">
          <Defs>
            <SvgLinearGradient id="showcase-gradient" x1="0" y1="0" x2="1" y2="1">
              <StopFrom offset="0" />
              <StopTo offset="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="320" height="160" rx="20" fill="url(#showcase-gradient)" />
          <Dot cx="250" cy="48" r="26" />
          <Triangle points="40,130 90,40 140,130" />
          <Caption x="200" y="128">
            isoform
          </Caption>
        </Canvas>
      </Section>

      <Section title="Progress ring" hint="strokeDasharray / strokeDashoffset from a prop, with a transition on the offset: the ring fills smoothly on every platform.">
        <Row wrap>
          <Ring viewBox="0 0 120 120">
            <Track cx="60" cy="60" r={RADIUS} />
            <Progress cx="60" cy="60" r={RADIUS} value={progress} transform="rotate(-90 60 60)" />
            <Percent x="60" y="68">
              {`${Math.round(progress * 100)}%`}
            </Percent>
          </Ring>
          <Button size="sm" variant="secondary" onPress={() => step(-0.1)} testID="svg-less">
            <ButtonLabel>−10%</ButtonLabel>
          </Button>
          <Button size="sm" onPress={() => step(0.1)} testID="svg-more">
            <ButtonLabel>+10%</ButtonLabel>
          </Button>
        </Row>
        <Body muted>Progress: {Math.round(progress * 100)}%</Body>
      </Section>

      <Section title="Draw on" hint="A dashed stroke as long as the path, and the offset hides it: toggling it draws the line by itself.">
        <Row wrap>
          <DrawCanvas viewBox="0 0 96 96">
            <Draw drawn={drawn} d="M16 52l22 22L80 22" />
            <DrawStar drawn={drawn} points="48,4 56,24 78,26 62,40 67,62 48,51 29,62 34,40 18,26 40,24" transform="translate(0 28) scale(0.5)" />
          </DrawCanvas>
          <Button size="sm" onPress={() => setDrawn((on) => !on)} testID="svg-draw">
            <ButtonLabel>{drawn ? 'Erase' : 'Draw'}</ButtonLabel>
          </Button>
        </Row>
      </Section>

      <Section title="Bars" hint="Each bar is a thick line whose dash is the value; new values glide with a little overshoot.">
        <Chart viewBox="0 0 300 140" preserveAspectRatio="xMidYMid meet">
          <Baseline x1="10" y1="128" x2="290" y2="128" />
          {BAR_COLORS.map((color, i) => (
            <Bar key={color} x1={40 + i * 55} y1="120" x2={40 + i * 55} y2="20" value={bars[i]} tone={color} />
          ))}
        </Chart>
        <Row wrap>
          <Button size="sm" onPress={() => setBars(randomBars())} testID="svg-bars">
            <ButtonLabel>Randomize</ButtonLabel>
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setBars([1, 1, 1, 1, 1])}>
            <ButtonLabel>Full</ButtonLabel>
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setBars([0.05, 0.05, 0.05, 0.05, 0.05])}>
            <ButtonLabel>Empty</ButtonLabel>
          </Button>
        </Row>
      </Section>

      <Section title="Color, outline and opacity" hint="fill, fill-opacity, stroke and stroke-width animate together. Tap a swatch, then switch the theme: the colors glide.">
        <Palette viewBox="0 0 300 120" preserveAspectRatio="xMidYMid meet">
          {PALETTE.map((color, i) => (
            <Swatch key={color} cx={34 + i * 58} cy="60" r="24" tone={color} on={i === tone} onPress={() => setTone(i)} />
          ))}
        </Palette>
        <Flags>
          <Button size="sm" variant="secondary" onPress={() => setTone((i) => (i + 1) % PALETTE.length)} testID="svg-next">
            <ButtonLabel>Next</ButtonLabel>
          </Button>
        </Flags>
      </Section>

      <Section title="In code">
        <Code>{`
// isoform.config.json → { "modules": { "svg": true } }
// iOS/Android: npx expo install react-native-svg

const Icon = engine('Svg', ({ theme }) => ({ width: 24, height: 24, color: theme.color.text }));
const Stroke = engine('Path', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 });

<Icon viewBox="0 0 24 24">
  <Stroke d="M5 12.5l4.5 4.5L19 7.5" />
</Icon>

// animate any shape with a transition (CSS on the web, redrawn per frame on iOS/Android):
const Progress = engine('Circle', ({ props }) => ({
  strokeDasharray: 264,
  strokeDashoffset: 264 * (1 - props.value),
  transition: 'stroke-dashoffset 300ms ease',
}));

// clashing names carry the Svg prefix:
// SvgText, SvgImage, SvgLinearGradient, SvgRadialGradient,
// SvgClipPath, SvgMask, SvgPattern, SvgSymbol, SvgUse
        `}</Code>
      </Section>
    </PageShell>
  );
}
