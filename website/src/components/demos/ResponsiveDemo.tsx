import './setup';
import { engine } from 'react-isoform';

const Grid = engine('Box', { flexDirection: 'column', gap: 8 })
  .when('breakpoints:md', { style: { flexDirection: 'row' } }) // ≥ 768px
  .when('breakpoints:lg', { style: { gap: 24 } }); // ≥ 1024px

const Cell = engine('Box', ({ theme }) => ({
  flex: 1,
  padding: 16,
  borderRadius: 12,
  backgroundColor: theme.color.primary,
}))
  .when('breakpoints:<md', { style: { backgroundColor: '#f59e0b' } }) // below md
  .when('breakpoints:md..lg', { style: { backgroundColor: '#10b981' } }); // md up to lg

const Label = engine('Text', { color: '#fff', fontWeight: '700' });

export default function ResponsiveDemo() {
  return (
    <Grid>
      {['One', 'Two', 'Three'].map((name) => (
        <Cell key={name}>
          <Label>{name}</Label>
        </Cell>
      ))}
    </Grid>
  );
}
