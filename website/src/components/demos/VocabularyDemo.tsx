import './setup';
import { engine } from '@michelgutner/isoform';

const Panel = engine('Box', ({ theme }) => ({
  paddingBlock: '1rem', // CSS string: rem on both platforms
  paddingInline: 24, // number = px (dp on mobile)
  borderRadius: 16,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  boxShadow: '0 4px 10px rgba(0,0,0,.1)',
  gap: 8,
  width: '100%',
  maxWidth: 420,
}));

const Heading = engine('Text', ({ theme }) => ({
  fontSize: '1.25rem',
  lineHeight: '1.4', // unitless line height, as in CSS
  fontWeight: 700,
  color: theme.color.text,
}));

const Tilted = engine('Box', ({ theme }) => ({
  alignSelf: 'flex-start',
  padding: '4px 10px', // multi-value shorthand
  borderRadius: 999,
  backgroundColor: theme.color.primary,
  transform: 'rotate(-2deg)', // CSS transform string
}));

const Badge = engine('Text', { color: '#fff', fontSize: 12, fontWeight: '600' });

// web-only CSS: kept on the web, dropped on mobile with one dev warning
const Glass = engine('Box', {
  height: 8,
  borderRadius: 4,
  width: 'calc(100% - 32px)',
  backgroundImage: 'linear-gradient(90deg, #6366f1, #ec4899)',
});

export default function VocabularyDemo() {
  return (
    <Panel>
      <Tilted>
        <Badge>NEW</Badge>
      </Tilted>
      <Heading>Standard CSS names and values</Heading>
      <Glass />
    </Panel>
  );
}
