import { useState } from 'react';
import { engine } from 'react-isoform';
import { Body, Button, ButtonLabel, Row, themeFade } from '../ui';
import { Code, PageShell, Section } from '../kit';

// ── icons: `color` on the root, `currentColor` in the shapes ──

const Icon = engine<'Svg', { active?: boolean }>('Svg', ({ theme, props }) => ({
  width: 32,
  height: 32,
  color: props.active ? theme.color.error : theme.color.text,
}));

const Outline = engine<'Path', { filled?: boolean }>('Path', ({ props }) => ({
  fill: props.filled ? 'currentColor' : 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
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

const StopFrom = engine('Stop', ({ theme }) => ({ stopColor: theme.color.primary }));
const StopTo = engine('Stop', ({ theme }) => ({ stopColor: theme.color.secondary }));

const Dot = engine('Circle', ({ theme }) => ({ fill: theme.color.warning }));
const Triangle = engine('Polygon', ({ theme }) => ({ fill: theme.color.success, opacity: 0.9 }));

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
}));

const Progress = engine<'Circle', { value: number }>('Circle', ({ theme, props }) => ({
  fill: 'none',
  stroke: theme.color.primary,
  strokeWidth: 10,
  strokeLinecap: 'round',
  strokeDasharray: CIRCUMFERENCE,
  strokeDashoffset: CIRCUMFERENCE * (1 - props.value),
})).when('platform:web', { style: { transition: 'stroke-dashoffset 300ms ease' } });

const Percent = engine('SvgText', ({ theme }) => ({
  fill: theme.color.text,
  fontSize: 22,
  fontWeight: '700',
  textAnchor: 'middle',
}));

/** SVG: icons, shapes with a gradient and a progress ring, all styled from the theme. */
export function SvgPage() {
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0.4);
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

      <Section title="Progress ring" hint="strokeDasharray / strokeDashoffset from a prop. On the web the offset also has a CSS transition.">
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

      <Section title="In code">
        <Code>{`
// isoform.config.json → { "modules": { "svg": true } }
// iOS/Android: npx expo install react-native-svg

const Icon = engine('Svg', ({ theme }) => ({ width: 24, height: 24, color: theme.color.text }));
const Stroke = engine('Path', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 });

<Icon viewBox="0 0 24 24">
  <Stroke d="M5 12.5l4.5 4.5L19 7.5" />
</Icon>

// clashing names carry the Svg prefix:
// SvgText, SvgImage, SvgLinearGradient, SvgRadialGradient,
// SvgClipPath, SvgMask, SvgPattern, SvgSymbol, SvgUse
        `}</Code>
      </Section>
    </PageShell>
  );
}
