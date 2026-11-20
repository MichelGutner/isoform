import './setup';
import { engine, updateTheme, useTheme } from 'react-isoform';

const ACCENTS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9'];

const Swatch = engine<'Pressable', { active?: boolean }>('Pressable', {
  width: 32,
  height: 32,
  borderRadius: 16,
  borderWidth: 3,
  borderColor: 'transparent',
})
  .when('props:active', ({ theme }) => ({ style: { borderColor: theme.color.text } }))
  .when('platform:web', { style: { cursor: 'pointer' } });

const Surface = engine('Box', ({ theme }) => ({
  gap: theme.spacing.md,
  padding: theme.spacing.md,
  borderRadius: 16,
  backgroundColor: theme.color.surface,
  borderWidth: 1,
  borderColor: theme.color.border,
}));

const Row = engine('Box', { flexDirection: 'row', gap: 10, alignItems: 'center' });

const Accent = engine('Text', ({ theme }) => ({
  color: theme.color.primary,
  fontWeight: '800',
  fontSize: 18,
  transition: 'color 300ms ease',
}));

export default function ThemeDemo() {
  const theme = useTheme(); // reactive: re-renders when the theme changes
  return (
    <Surface>
      <Row>
        {ACCENTS.map((color) => (
          <Swatch
            key={color}
            aria-label={`Use ${color}`}
            active={theme.color.primary === color}
            style={{ backgroundColor: color }}
            onPress={() => updateTheme({ color: { primary: color } })}
          />
        ))}
      </Row>
      <Accent>Every component follows color.primary = {theme.color.primary}</Accent>
    </Surface>
  );
}
