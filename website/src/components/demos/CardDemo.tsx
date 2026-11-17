import './setup';
import { engine } from '@michelgutner/isoform';

const Card = engine('Box', ({ theme }) => ({
  padding: theme.spacing.md,
  gap: theme.spacing.sm,
  borderRadius: 16,
  backgroundColor: theme.color.surface,
  boxShadow: '0 2px 10px rgba(0,0,0,.08)',
  maxWidth: 360,
}));

const Title = engine('Text', ({ theme }) => ({
  fontSize: 22,
  fontWeight: '800',
  color: theme.color.text,
}));

const Body = engine('Text', ({ theme }) => ({ color: theme.color.muted, lineHeight: '1.5' }));

export default function CardDemo() {
  return (
    <Card>
      <Title>Hello, web and mobile</Title>
      <Body>The same three components render a View and Text on iOS and Android, and a div and span here.</Body>
    </Card>
  );
}
