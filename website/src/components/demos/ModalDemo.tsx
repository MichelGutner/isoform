import './setup';
import { useState } from 'react';
import { engine } from 'isoform';
import { Button, ButtonText, Row } from './kit';

const Dialog = engine('Modal', ({ theme }) => ({
  backgroundColor: theme.color.surface, // goes to the card
  borderRadius: 20,
  padding: 24, // goes to the content
  gap: 16,
}));

const Title = engine('Text', ({ theme }) => ({ fontSize: 20, fontWeight: '800', color: theme.color.text }));
const Body = engine('Text', ({ theme }) => ({ color: theme.color.muted }));

export default function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState<'dialog' | 'fullScreen'>('dialog');
  const show = (mode: 'dialog' | 'fullScreen') => {
    setPresentation(mode);
    setOpen(true);
  };
  return (
    <Row>
      <Button onPress={() => show('dialog')}>
        <ButtonText>Open dialog</ButtonText>
      </Button>
      <Button variant="ghost" onPress={() => show('fullScreen')}>
        <ButtonText ghost>Open full screen</ButtonText>
      </Button>
      <Dialog open={open} onOpenChange={setOpen} presentation={presentation} label="Example modal">
        <Title>Hello from the modal module</Title>
        <Body>Escape, a tap on the backdrop or the button closes it.</Body>
        <Button onPress={() => setOpen(false)}>
          <ButtonText>Close</ButtonText>
        </Button>
      </Dialog>
    </Row>
  );
}
