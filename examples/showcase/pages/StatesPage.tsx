import { useState } from 'react';
import { Body, Button, ButtonLabel, Field, PulseDot, Row } from '../ui';
import { PseudoLab, TransitionLab } from '../demos/Pseudo';
import { Code, PageShell, Section } from '../kit';

/** Interaction states and pseudo-elements: CSS pseudo-classes on the web, component state on mobile. */
export function StatesPage() {
  const [clicks, setClicks] = useState(0);
  const [text, setText] = useState('');

  return (
    <PageShell title="States" summary="when('state:hover' | 'pressed' | 'focus') and pseudo-elements (::before, ::after, ::placeholder…) with one declaration.">
      <Section title="Hover, pressed and focus" hint="Hover and press the button; focus the field. On touch screens, pressed and focus apply.">
        <Row wrap>
          <Button onPress={() => setClicks((n) => n + 1)}>
            <ButtonLabel>Pressed {clicks}×</ButtonLabel>
          </Button>
          <PulseDot />
          <Body muted>keyframes() pulse</Body>
        </Row>
        <Field value={text} onChangeText={setText} placeholder="Focus me" />
        <Code>{`
Button.when('state:hover', { style: { opacity: 0.85 } })
      .when('state:pressed', { style: { transform: 'scale(0.97)' } });
Field.when('state:focus', ({ theme }) => ({ style: { borderColor: theme.color.primary } }));
        `}</Code>
      </Section>

      <PseudoLab />
      <TransitionLab />
    </PageShell>
  );
}
