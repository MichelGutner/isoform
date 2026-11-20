import { engine, getProvider } from 'react-isoform';
import { Badge, BadgeText, Body, Card, Row } from '../ui';
import { Code, PageShell, Section } from '../kit';

/** The same card: dashed on the web, solid on mobile. */
const PlatformCard = engine(Card)
  .when('platform:web', { style: { borderStyle: 'dashed' } })
  .when('platform:native', { style: { borderStyle: 'solid' } })
  .when('platform:ios', { style: { borderColor: '#0a84ff' } })
  .when('platform:android', { style: { borderColor: '#3ddc84' } });

/** Units: numbers are px; strings are CSS values (rem, %, line-height multiplier). */
const UnitsBox = engine('Box', ({ theme }) => ({
  width: '70%',
  paddingInline: '1.5rem',
  paddingBlock: 12,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.background,
  borderWidth: 1,
  borderColor: theme.color.border,
}));

const UnitsText = engine('Text', ({ theme }) => ({ color: theme.color.text, fontSize: 15, lineHeight: '1.5' }));

/** One codebase, every platform: platform conditions, units and the provider. */
export function PlatformPage() {
  const os = getProvider().os();

  return (
    <PageShell title="Platform" summary="provider 'auto' picks React DOM on the web and React Native on iOS/Android. Components never import either.">
      <Section title="Running on">
        <Row>
          <Badge tone="primary">
            <BadgeText tone="primary">{os}</BadgeText>
          </Badge>
          <Body muted>getProvider().os()</Body>
        </Row>
      </Section>

      <Section title="Platform rules" hint="The border style and color below depend on where this runs.">
        <PlatformCard>
          <Body>when('platform:web' | 'native' | 'ios' | 'android')</Body>
        </PlatformCard>
      </Section>

      <Section title="Units" hint="Numbers are px (dp on mobile). Strings are CSS: '70%', '1.5rem', lineHeight '1.5'.">
        <UnitsBox>
          <UnitsText>width 70%, paddingInline 1.5rem, lineHeight 1.5 — the same on every platform.</UnitsText>
        </UnitsBox>
      </Section>

      <Section title="In code">
        <Code>{`
configure({ provider: 'auto', theme });   // 'react-native' | 'react' to force one

const Card = engine('Box', { borderWidth: 1 })
  .when('platform:web', { style: { borderStyle: 'dashed' } })
  .when('platform:native', { style: { borderStyle: 'solid' } });
        `}</Code>
      </Section>
    </PageShell>
  );
}
