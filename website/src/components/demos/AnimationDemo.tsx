import './setup';
import { useState } from 'react';
import { engine, keyframes } from 'react-isoform';
import { Button, ButtonText, Row, Stack } from './kit';

const pulse = keyframes({
  from: { opacity: 1, transform: 'scale(1)' },
  '50%': { opacity: 0.5 },
  to: { opacity: 0.35, transform: 'scale(0.8)' },
});

const Dot = engine('Box', {
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: 'seagreen',
  animation: `${pulse} 900ms ease-in-out infinite alternate`,
});

const Card = engine<'Box', { open?: boolean }>('Box', ({ theme }) => ({
  width: 120,
  height: 48,
  borderRadius: 12,
  backgroundColor: theme.color.primary,
  transition: 'background-color 500ms ease, width 500ms cubic-bezier(0.2, 0.8, 0.2, 1)',
})).when('props:open', { style: { width: 260, backgroundColor: '#16a34a' } });

export default function AnimationDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Stack>
      <Dot />
      <Card open={open} />
      <Row>
        <Button onPress={() => setOpen(!open)}>
          <ButtonText>{open ? 'Close' : 'Open'}</ButtonText>
        </Button>
      </Row>
    </Stack>
  );
}
