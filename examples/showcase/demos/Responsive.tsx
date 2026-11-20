import { engine } from 'react-isoform';
import { Body, Card, Heading, themeFade } from '../ui';

/**
 * Layout responsivo mobile-first: `when('breakpoints:md')` vale de 768px para cima,
 * `when('breakpoints:lg')` de 1024px — `@media (min-width)` na web e a largura da janela no mobile
 * (gire o aparelho ou redimensione o navegador).
 */

/** Coluna no celular, linha a partir de `md`. */
const Grid = engine('Box', ({ theme }) => ({
  flexDirection: 'column',
  gap: theme.spacing.sm,
}))
  .when('breakpoints:md', { style: { flexDirection: 'row' } });

const Tile = engine('Box', ({ theme }) => ({
  transition: themeFade(),
  flex: 1,
  padding: theme.spacing.md,
  borderRadius: 12,
  backgroundColor: theme.color.background,
  borderWidth: 1,
  borderColor: theme.color.border,
}))
  .when('breakpoints:lg', { style: { padding: 28 } });

/** O fundo e o texto mudam a cada faixa: base → sm → md → lg → xl (o maior que valer, vence). */
const Meter = engine('Box', ({ theme }) => ({
  paddingBlock: theme.spacing.sm,
  paddingInline: theme.spacing.md,
  borderRadius: 12,
  alignItems: 'center',
  backgroundColor: '#e5e7eb',
}))
  .when('breakpoints:sm', { style: { backgroundColor: '#fde68a' } })
  .when('breakpoints:md', { style: { backgroundColor: '#a7f3d0' } })
  .when('breakpoints:lg', { style: { backgroundColor: '#bfdbfe' } })
  .when('breakpoints:xl', { style: { backgroundColor: '#ddd6fe' } });

/** Só um rótulo aparece por vez: cada um se esconde fora da sua faixa. */
const Label = engine<'Text', { from: 'base' | 'sm' | 'md' | 'lg' | 'xl' }>('Text', ({ theme, props }) => ({
  transition: themeFade(),
  color: theme.color.text,
  fontWeight: '800',
  fontSize: 14,
  display: props.from === 'base' ? 'flex' : 'none',
}))
  // mobile-first: cada faixa mostra o seu rótulo e esconde o da faixa anterior
  .when('breakpoints:sm', ({ props }) => ({ style: { display: props.from === 'sm' ? 'flex' : 'none' } }))
  .when('breakpoints:md', ({ props }) => ({ style: { display: props.from === 'md' ? 'flex' : 'none' } }))
  .when('breakpoints:lg', ({ props }) => ({ style: { display: props.from === 'lg' ? 'flex' : 'none' } }))
  .when('breakpoints:xl', ({ props }) => ({ style: { display: props.from === 'xl' ? 'flex' : 'none' } }));

/** `'<md'` e `'sm..lg'`: faixas (max-width / intervalo), além do mobile-first `'md'`. */
const OnlyBelowMd = engine('Box', { display: 'none', paddingBlock: 6, paddingInline: 12, borderRadius: 8, backgroundColor: '#fecaca' })
  .when('breakpoints:<md', { style: { display: 'flex' } });

const OnlyTablet = engine('Box', { display: 'none', paddingBlock: 6, paddingInline: 12, borderRadius: 8, backgroundColor: '#fed7aa' })
  .when('breakpoints:md..lg', { style: { display: 'flex' } });

export function ResponsiveDemo() {
  return (
    <Card testID="responsive-demo">
      <Heading>Breakpoints</Heading>
      <Body muted>when('breakpoints:sm' | 'md' | 'lg' | 'xl') — mobile-first. Resize the browser or rotate the device.</Body>

      <Meter testID="bp-meter">
        <Label from="base" testID="bp-base">below 480px · base</Label>
        <Label from="sm" testID="bp-sm">≥ 480px · sm</Label>
        <Label from="md" testID="bp-md">≥ 768px · md (3 colunas)</Label>
        <Label from="lg" testID="bp-lg">≥ 1024px · lg</Label>
        <Label from="xl" testID="bp-xl">≥ 1280px · xl</Label>
      </Meter>

      <Body muted>Ranges: <Body style={{ fontWeight: '700' }}>{'<md'}</Body> and <Body style={{ fontWeight: '700' }}>md..lg</Body></Body>
      <OnlyBelowMd testID="bp-below-md">
        <Body>{"only below 768px · when('breakpoints:<md')"}</Body>
      </OnlyBelowMd>
      <OnlyTablet testID="bp-tablet">
        <Body>only between 768px and 1024px · when('breakpoints:md..lg')</Body>
      </OnlyTablet>

      <Grid testID="bp-grid">
        {['Tokens', 'Components', 'Config'].map((t) => (
          <Tile key={t}>
            <Body>{t}</Body>
          </Tile>
        ))}
      </Grid>
    </Card>
  );
}
