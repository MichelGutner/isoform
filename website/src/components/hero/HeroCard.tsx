import { engine, keyframes } from 'react-isoform';

const blink = keyframes({
  '0%, 100%': { opacity: 0.35, transform: 'scale(0.85)' },
  '50%': { opacity: 1, transform: 'scale(1.15)' },
});

const Card = engine<'Box', { live?: boolean }>('Box', ({ theme }) => ({
  width: '100%',
  gap: theme.spacing.sm + 2,
  padding: theme.spacing.md,
  borderRadius: theme.radius.md,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  boxShadow: '0 12px 32px rgba(0,0,0,.28)', // the same shadow on both platforms
  transition: 'border-color 400ms, box-shadow 400ms',
})).when('props:live', {
  style: { borderColor: '#4ade80', boxShadow: '0 12px 40px rgba(74,222,128,.35)' },
});

const Title = engine('Text', ({ theme }) => ({ color: theme.color.text, fontSize: 15, fontWeight: '700' }));

const Caption = engine('Text', ({ theme }) => ({ color: theme.color.muted, fontSize: 11 }));

const Row = engine('Box', { flexDirection: 'row', flexWrap: 'wrap', gap: 6 });

const Dot = engine<'Box', { on?: boolean; index: number }>('Box', ({ theme, props }) => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.color.primary,
  animation: `${blink} 2.4s ease-in-out ${props.index * 0.4}s infinite`, // blinks in turn
})).when('props:on', { style: { backgroundColor: '#4ade80', animation: 'none' } });

const Chip = engine('Box', ({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  paddingBlock: 3,
  paddingInline: 8,
  borderRadius: 99,
  backgroundColor: theme.color.background,
}));

const Deploy = engine<'Pressable', { live?: boolean }>('Pressable', ({ theme }) => ({
  paddingBlock: 9,
  borderRadius: 10,
  alignItems: 'center',
  backgroundColor: theme.color.primary,
}))
  .when('props:live', { style: { backgroundColor: '#16a34a' } })
  .when('state:pressed', { style: { transform: 'scale(0.96)' } })
  .when('platform:web', { style: { cursor: 'pointer', transition: 'transform .1s, background-color .3s' } });

const Label = engine('Text', { color: '#fff', fontSize: 13, fontWeight: '700' });

/** One component, written once: it is a <div> on the web and a <View> on iOS and Android. */
export function HeroCard({ live, onPress }: { live: boolean; onPress: () => void }) {
  return (
    <Card live={live}>
      <Title>Ship once</Title>
      <Caption>One codebase, every screen.</Caption>
      <Row>
        {['Web', 'iOS', 'Android'].map((name, index) => (
          <Chip key={name}>
            <Dot on={live} index={index} />
            <Caption>{name}</Caption>
          </Chip>
        ))}
      </Row>
      <Deploy live={live} onPress={onPress} aria-label="Deploy">
        <Label>{live ? 'Live on all ✓' : 'Deploy'}</Label>
      </Deploy>
    </Card>
  );
}
