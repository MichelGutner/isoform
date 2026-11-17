import { useState } from 'react';
import { engine } from '@michelgutner/isoform';
import { Badge, BadgeText, Body, Button, ButtonLabel, Card, Field, Heading, Row, themeFade } from '../ui';
import { Code, Flag, Flags, PageShell, Section } from '../kit';

/** `#rrggbb` + a hex alpha, for soft backgrounds. */
const tint = (color: string | undefined, alpha = '33') => `${color ?? '#888888'}${alpha}`;

const StatusDot = engine<'Box', { status: 'active' | 'inactive' | 'pending' }>('Box', { width: 12, height: 12, borderRadius: 6 })
  .when('props:status=active', ({ theme }) => ({ style: { backgroundColor: theme.color.success } }))
  .when('props:status=inactive', ({ theme }) => ({ style: { backgroundColor: theme.color.error } }))
  .when('props:status=pending', ({ theme }) => ({ style: { backgroundColor: theme.color.warning } }));

const Meter = engine<'Box', { level: number }>('Box', ({ theme }) => ({
  transition: themeFade(),
  paddingBlock: 10,
  paddingInline: 14,
  borderRadius: theme.borderRadius?.md ?? 14,
}))
  .when(({ props }) => props.level >= 7, ({ theme }) => ({ style: { backgroundColor: tint(theme.color.error) } }))
  .when(({ props }) => props.level >= 4 && props.level < 7, ({ theme }) => ({ style: { backgroundColor: tint(theme.color.warning) } }))
  .when(({ props }) => props.level < 4, ({ theme }) => ({ style: { backgroundColor: tint(theme.color.success) } }));

const Tag = engine('Box', ({ theme }) => ({
  paddingBlock: 6,
  paddingInline: 12,
  borderRadius: 8,
  backgroundColor: theme.color.border,
}));

/** `extend()` copies the rules: the base stays untouched. */
const DangerTag = Tag.extend().when(() => true, ({ theme }) => ({ style: { backgroundColor: tint(theme.color.error) } }));

/** `engine(OtherComponent, style)` stacks styles on top of an existing component. */
const BigCard = engine(Card, { padding: 24, borderRadius: 28 });

const LEVEL_NOTE = (level: number) => (level >= 7 ? 'Critical (red)' : level >= 4 ? 'Warning (amber)' : 'Healthy (green)');

/** The styling engine: variants, prop conditions, function conditions, extend and composition. */
export function ComponentsPage() {
  const [outlined, setOutlined] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [level, setLevel] = useState(3);
  const [name, setName] = useState('');

  return (
    <PageShell title="Components" summary="engine() turns any primitive into a styled component. when() adds rules for props, state, platform and screen size.">
      <Section title="Variants" hint="One Button, styled by its props: variant, size, outlined, disabled.">
        <Row wrap>
          {(['primary', 'secondary', 'success', 'warning', 'error'] as const).map((variant) => (
            <Button key={variant} variant={variant} size="sm" outlined={outlined} disabled={disabled}>
              <ButtonLabel outlined={outlined} variant={variant}>{variant}</ButtonLabel>
            </Button>
          ))}
        </Row>
        <Row wrap>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Button key={size} size={size}>
              <ButtonLabel>{size}</ButtonLabel>
            </Button>
          ))}
        </Row>
        <Flags>
          <Flag label="outlined" on={outlined} onChange={setOutlined} />
          <Flag label="disabled" on={disabled} onChange={setDisabled} />
        </Flags>
        <Code>{`
const Button = engine('Pressable', ({ theme, props }) => ({ ... }))
  .when('props:outlined', ({ theme }) => ({ style: { backgroundColor: 'transparent' } }))
  .when('props:size=sm', { style: { paddingBlock: 6 } })
  .when('props:disabled', { style: { opacity: 0.4 } });
        `}</Code>
      </Section>

      <Section title="Exact prop match" hint="'props:status=active' matches only that value ('inactive' does not).">
        {(['active', 'inactive', 'pending'] as const).map((status) => (
          <Row key={status}>
            <StatusDot status={status} />
            <Body style={{ flex: 1 }}>{status}</Body>
          </Row>
        ))}
      </Section>

      <Section title="Function conditions" hint="when(({ props }) => …) for ranges and any logic.">
        <Row between>
          <Button size="sm" variant="secondary" onPress={() => setLevel((n) => Math.max(0, n - 1))}>
            <ButtonLabel>−</ButtonLabel>
          </Button>
          <Heading>Level {level}</Heading>
          <Button size="sm" variant="secondary" onPress={() => setLevel((n) => Math.min(10, n + 1))}>
            <ButtonLabel>+</ButtonLabel>
          </Button>
        </Row>
        <Meter level={level}>
          <Body>{LEVEL_NOTE(level)}</Body>
        </Meter>
      </Section>

      <Section title="Inputs" hint="The same Field handles focus (state:focus) and an invalid prop. Type fewer than 3 characters.">
        <Field value={name} onChangeText={setName} placeholder="Your name" invalid={name.length > 0 && name.length < 3} />
        <Row>
          <Badge tone={name.length >= 3 ? 'success' : 'warning'}>
            <BadgeText tone={name.length >= 3 ? 'success' : 'warning'}>{name.length >= 3 ? 'valid' : 'too short'}</BadgeText>
          </Badge>
        </Row>
      </Section>

      <Section title="extend() and composition" hint="extend() clones a component's rules; engine(Component, style) stacks styles.">
        <Row wrap>
          <Tag><Body>Base</Body></Tag>
          <DangerTag><Body>Extended</Body></DangerTag>
          <Tag><Body>Base again (untouched)</Body></Tag>
        </Row>
        <BigCard flat>
          <Body>engine(Card, …): bigger padding and radius on top of Card.</Body>
        </BigCard>
      </Section>
    </PageShell>
  );
}
