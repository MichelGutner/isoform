import './setup';
import { engine } from 'isoform';

const Button = engine('Pressable', ({ theme }) => ({
  paddingBlock: 10,
  paddingInline: 18,
  borderRadius: 10,
  backgroundColor: theme.color.primary,
  alignSelf: 'flex-start',
}))
  .when('state:hover', { style: { opacity: 0.85 } }) // web only (touch has no hover)
  .when('state:pressed', { style: { transform: 'scale(0.95)' } })
  .when('platform:web', { style: { cursor: 'pointer', transition: 'opacity .15s, transform .1s' } });

const Label = engine('Text', { color: '#fff', fontWeight: '600' });

const Field = engine('Input', ({ theme }) => ({
  paddingBlock: 10,
  paddingInline: 12,
  borderRadius: 10,
  borderWidth: 2,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  color: theme.color.text,
  fontSize: 15,
  maxWidth: 320,
  outline: 'none',
})).when('state:focus', ({ theme }) => ({ style: { borderColor: theme.color.primary } }));

const Stack = engine('Box', { gap: 14 });

export default function StatesDemo() {
  return (
    <Stack>
      <Button onPress={() => {}} aria-label="Press me">
        <Label>Hover and press me</Label>
      </Button>
      <Field placeholder="Focus me" aria-label="Focus me" />
    </Stack>
  );
}
