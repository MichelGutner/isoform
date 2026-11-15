import { engine } from 'omnistyle';

const Trail = engine('Box', ({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing.sm,
}));

const Crumb = engine<'Text', { current?: boolean }>('Text', ({ theme, props }) => ({
  fontSize: theme.typography?.fontSize?.sm,
  fontWeight: props.current ? theme.typography?.fontWeight?.bold : theme.typography?.fontWeight?.normal,
  color: props.current ? theme.color.text : theme.color.muted,
}));

export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <Trail>
      {items.map((label, i) => {
        const isLast = i === items.length - 1;
        return (
          <Trail key={label}>
            <Crumb current={isLast}>{label}</Crumb>
            {isLast ? null : <Crumb>›</Crumb>}
          </Trail>
        );
      })}
    </Trail>
  );
}
