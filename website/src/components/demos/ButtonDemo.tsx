import './setup';
import { engine } from 'isoform';

export const Button = engine<'Pressable', { variant?: 'primary' | 'ghost' }>('Pressable', ({ theme }) => ({
  paddingBlock: theme.spacing.sm,
  paddingInline: '1.25rem', // rem works on both platforms
  borderRadius: 12,
  borderWidth: 1,
  borderColor: theme.color.primary,
  backgroundColor: theme.color.primary,
  boxShadow: '0 4px 12px rgba(0,0,0,.12)', // same shadow on both platforms
}))
  .when('props:variant=ghost', { style: { backgroundColor: 'transparent', boxShadow: 'none' } })
  .when('state:pressed', { style: { transform: 'scale(0.97)' } })
  .when('platform:web', { style: { cursor: 'pointer', transition: 'transform .1s' } });

const Label = engine<'Text', { ghost?: boolean }>('Text', { color: '#fff', fontWeight: '700' })
  .when('props:ghost', ({ theme }) => ({ style: { color: theme.color.primary } }));

const Row = engine('Box', { flexDirection: 'row', gap: 12 });

export default function ButtonDemo() {
  return (
    <Row>
      <Button onPress={() => alert('Saved')} aria-label="Save">
        <Label>Save</Label>
      </Button>
      <Button variant="ghost" onPress={() => alert('Cancelled')} aria-label="Cancel">
        <Label ghost>Cancel</Label>
      </Button>
    </Row>
  );
}
