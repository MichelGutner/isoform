import { useState } from 'react';
import { engine } from 'omnistyle';
import { Body, Button, ButtonLabel, Card, Heading, Row } from './ui';

/**
 * Pseudo-elementos e transições: a mesma declaração vira CSS na web
 * (`::before`, `::first-letter`, `transition`…) e componentes/Animated no mobile.
 */

// ───────────── ::before / ::after com texto ─────────────
const Quote = engine('Text', ({ theme }) => ({
  fontSize: 16,
  fontStyle: 'italic',
  color: theme.color.text,
}))
  .when('::before', ({ theme }) => ({ style: { content: '“', color: theme.color.primary, fontSize: 24, fontWeight: '800' } }))
  .when('::after', ({ theme }) => ({ style: { content: '”', color: theme.color.primary, fontSize: 24, fontWeight: '800' } }));

// ───────────── ::before sem texto = uma caixa de decoração ─────────────
const StatusRow = engine('Box', ({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing.sm,
}))
  .when('::before', ({ theme }) => ({
    style: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.success },
  }));

// ───────────── ::after como sublinhado decorativo ─────────────
const Heading2 = engine('Box', { alignSelf: 'flex-start' })
  .when('::after', ({ theme }) => ({
    style: { width: 48, height: 4, borderRadius: 2, marginTop: 6, backgroundColor: theme.color.primary },
  }));

// ───────────── ::first-letter: capitular ─────────────
const DropCap = engine('Text', ({ theme }) => ({
  fontSize: 15,
  lineHeight: '1.5',
  color: theme.color.text,
}))
  .when('::first-letter', ({ theme }) => ({
    style: { fontSize: 36, fontWeight: '800', color: theme.color.primary },
  }));

// ───────────── ::placeholder + ::selection + focus com transition ─────────────
const FancyField = engine('Input', ({ theme }) => ({
  backgroundColor: theme.color.background,
  color: theme.color.text,
  borderWidth: 2,
  borderColor: theme.color.border,
  borderRadius: 12,
  paddingBlock: theme.spacing.md,
  paddingInline: theme.spacing.md,
  fontSize: 15,
  transition: 'border-color 250ms ease',
}))
  .when('focus', ({ theme }) => ({ style: { borderColor: theme.color.secondary } }))
  .when('::placeholder', { style: { color: '#f59e0b' } })
  .when('::selection', { style: { backgroundColor: '#fde68a' } });

export function PseudoLab() {
  return (
    <Card testID="pseudo-lab">
      <Heading>Pseudo-elementos</Heading>
      <Body muted>::before, ::after, ::first-letter, ::placeholder e ::selection — mesma declaração nas duas plataformas.</Body>

      <Heading2 testID="pseudo-underline">
        <Body>::after como sublinhado</Body>
      </Heading2>

      <Quote testID="pseudo-quote">aspas geradas por ::before e ::after</Quote>

      <StatusRow testID="pseudo-status">
        <Body>::before vazio vira uma bolinha</Body>
      </StatusRow>

      <DropCap testID="pseudo-dropcap">Capitular criada com ::first-letter, sem separar a letra no JSX.</DropCap>

      <FancyField placeholder="::placeholder laranja (foque: borda transita)" testID="pseudo-field" />
    </Card>
  );
}

// ───────────── transições ─────────────
const Morph = engine<'Box', { on?: boolean }>('Box', ({ theme }) => ({
  height: 56,
  width: 120,
  borderRadius: 12,
  backgroundColor: theme.color.primary,
  opacity: 0.6,
  // opacity e transform rodam no driver nativo; backgroundColor e width, no JS
  transition: 'background-color 500ms ease, width 500ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 500ms, transform 500ms ease-out',
}))
  .when('on', ({ theme }) => ({
    style: { backgroundColor: theme.color.success, width: 260, opacity: 1, transform: 'translateY(-6px) rotate(2deg)' },
  }));

const PressCard = engine('Pressable', ({ theme }) => ({
  paddingBlock: theme.spacing.md,
  paddingInline: theme.spacing.lg,
  borderRadius: 14,
  backgroundColor: theme.color.secondary,
  alignItems: 'center',
  transition: 'transform 160ms ease-out, opacity 160ms',
}))
  .when('pressed', { style: { transform: 'scale(0.94)', opacity: 0.8 } });

export function TransitionLab() {
  const [on, setOn] = useState(false);
  return (
    <Card testID="transition-lab">
      <Heading>Transições</Heading>
      <Body muted>transition anima mudanças de estilo: por prop, por estado (pressed/focus) e por breakpoint.</Body>

      <Row between>
        <Morph on={on} testID="morph" />
        <Button size="sm" onPress={() => setOn((v) => !v)} testID="morph-toggle">
          <ButtonLabel>{on ? 'Voltar' : 'Animar'}</ButtonLabel>
        </Button>
      </Row>

      <PressCard onPress={() => {}} testID="press-card">
        <Body style={{ color: '#fff', fontWeight: '700' }}>Pressione e segure (pressed + transition)</Body>
      </PressCard>
    </Card>
  );
}
