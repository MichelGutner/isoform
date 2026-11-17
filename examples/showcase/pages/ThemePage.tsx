import { engine, useTheme } from '@michelgutner/isoform';
import { Body, Button, ButtonLabel, Card, Chip, ChipLabel, Heading, Row, themeFade } from '../ui';
import { Choice, Code, PageShell, Section } from '../kit';
import { useSettings } from '../settings';
import { ACCENTS, type AccentName } from '../tokens';

const Swatch = engine<'Pressable', { color: string; selected?: boolean }>('Pressable', ({ theme, props }) => ({
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: props.color,
  borderWidth: 3,
  borderColor: 'transparent',
  transition: themeFade('transform 120ms'),
}))
  .attrs({ role: 'button' })
  .when('props:selected', ({ theme }) => ({ style: { borderColor: theme.color.text } }))
  .when('state:pressed', { style: { transform: 'scale(0.92)' } });

/** Live theming: `updateTheme` re-renders every component, and colors fade between themes. */
export function ThemePage() {
  const theme = useTheme();
  const { mode, accent, density, toggleMode, setAccent, setDensity } = useSettings();

  return (
    <PageShell title="Theme" summary="One theme object feeds every component. updateTheme() swaps it at runtime and colors transition smoothly.">
      <Section title="Live theme" hint="Everything on this screen is styled from the theme: try the options.">
        <Row wrap>
          <Button onPress={toggleMode} testID="toggle-theme">
            <ButtonLabel>{mode === 'dark' ? 'Switch to light' : 'Switch to dark'}</ButtonLabel>
          </Button>
        </Row>
        <Body muted>Accent</Body>
        <Row>
          {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
            <Swatch key={name} color={ACCENTS[name]} selected={name === accent} onPress={() => setAccent(name)} aria-label={name} />
          ))}
        </Row>
        <Choice label="Density" value={density} options={['comfortable', 'compact'] as const} onChange={setDensity} />
      </Section>

      <Section title="Tokens" hint="What useTheme() returns right now.">
        <Row wrap>
          {Object.entries(theme.color).map(([name, value]) => (
            <Chip key={name}>
              <ChipLabel>{`${name} ${value}`}</ChipLabel>
            </Chip>
          ))}
        </Row>
        <Card flat>
          <Heading>Spacing</Heading>
          <Body muted>{JSON.stringify(theme.spacing)}</Body>
        </Card>
      </Section>

      <Section title="In code">
        <Code>{`
import { configure, updateTheme, useTheme } from '@michelgutner/isoform';

configure({ theme: lightTokens });      // once, at startup
updateTheme(darkTokens);                // anywhere, any time
const theme = useTheme();               // re-renders on change
        `}</Code>
      </Section>
    </PageShell>
  );
}
