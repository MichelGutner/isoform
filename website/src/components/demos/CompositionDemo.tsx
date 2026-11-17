import './setup';
import { engine } from '@michelgutner/isoform';

const Tag = engine('Box', ({ theme }) => ({
  paddingBlock: 4,
  paddingInline: 10,
  borderRadius: 999,
  backgroundColor: theme.color.border,
  alignSelf: 'flex-start',
}));

// extend(): a copy of Tag's rules plus new ones; Tag itself is unchanged
const DangerTag = Tag.extend().style(({ theme }) => ({ backgroundColor: theme.color.error }));

// engine(OtherEngineComponent, style): inherits the rules and custom props
const BigTag = engine(Tag, { paddingBlock: 8, paddingInline: 16 });

// attrs(): fixed props on every render
const StatusTag = engine('Box').attrs({ role: 'status', 'aria-live': 'polite' });

const Label = engine('Text', { fontSize: 13, fontWeight: '600', color: '#12141c' });
const Row = engine('Box', { flexDirection: 'row', gap: 8, flexWrap: 'wrap' });

export default function CompositionDemo() {
  return (
    <Row>
      <Tag><Label>Tag</Label></Tag>
      <DangerTag><Label>DangerTag</Label></DangerTag>
      <BigTag><Label>BigTag</Label></BigTag>
      <StatusTag><Tag><Label>inside a role="status"</Label></Tag></StatusTag>
    </Row>
  );
}
