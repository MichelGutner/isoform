import './setup';
import { useState } from 'react';
import { engine } from '@michelgutner/isoform';
import { Button, ButtonText, Caption } from './kit';

const Sheet = engine('BottomSheet', ({ theme }) => ({
  backgroundColor: theme.color.surface,
  padding: theme.spacing.lg,
  gap: theme.spacing.sm,
}));

const Title = engine('Text', ({ theme }) => ({ fontSize: 18, fontWeight: '700', color: theme.color.text }));

export default function SheetDemo() {
  const [open, setOpen] = useState(false);
  const [detent, setDetent] = useState(0);
  return (
    <>
      <Button onPress={() => setOpen(true)}>
        <ButtonText>Open the sheet</ButtonText>
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        detents={['40%', 'full']}
        onDetentChange={({ index }) => setDetent(index)}
        label="Example sheet"
      >
        <Title>A bottom sheet</Title>
        <Caption>Drag the handle between 40% and full height, or drag it down to close.</Caption>
        <Caption>Resting at detent {detent}.</Caption>
        <Button variant="ghost" onPress={() => setOpen(false)}>
          <ButtonText ghost>Close</ButtonText>
        </Button>
      </Sheet>
    </>
  );
}
