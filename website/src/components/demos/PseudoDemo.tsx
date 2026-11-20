import './setup';
import { engine } from 'react-isoform';

const Quote = engine('Text', ({ theme }) => ({ fontSize: 18, color: theme.color.text }))
  .when('::before', { style: { content: '“', color: 'tomato', fontSize: 24 } })
  .when('::after', { style: { content: '”', color: 'tomato', fontSize: 24 } });

const Status = engine('Box', { flexDirection: 'row', alignItems: 'center', gap: 8 })
  // no content → an empty box: a dot
  .when('::before', { style: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'seagreen' } });

const StatusText = engine('Text', ({ theme }) => ({ color: theme.color.text }));

const Field = engine('Input', ({ theme }) => ({
  padding: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: theme.color.border,
  color: theme.color.text,
  backgroundColor: theme.color.surface,
  maxWidth: 320,
}))
  .when('::placeholder', { style: { color: '#f59e0b' } })
  .when('::selection', { style: { backgroundColor: '#fde68a' } });

const DropCap = engine('Text', ({ theme }) => ({ color: theme.color.text, maxWidth: 420 }))
  .when('::first-letter', ({ theme }) => ({ style: { fontSize: 36, fontWeight: '800', color: theme.color.primary } }));

const Stack = engine('Box', { gap: 16 });

export default function PseudoDemo() {
  return (
    <Stack>
      <Quote>Write it once.</Quote>
      <Status>
        <StatusText>Online</StatusText>
      </Status>
      <Field placeholder="An amber placeholder" aria-label="Pseudo-element demo" />
      <DropCap>Once upon a time, a style was written once and ran on every platform.</DropCap>
    </Stack>
  );
}
