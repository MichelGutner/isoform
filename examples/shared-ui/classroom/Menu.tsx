import type { ReactNode } from 'react';
import { engine } from 'omnistyle';
import { ProgressBar } from './ProgressBar';

/* ───────────────────────── estilos ───────────────────────── */

/** Cartão do menu: largura fixa no desktop (o contêiner pai é quem recolhe). */
const Card = engine('Box', ({ theme }) => ({
  width: '100%',
  borderRadius: theme.borderRadius?.lg,
  backgroundColor: theme.color.surface,
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(17, 18, 18, 0.1)',
})).when('breakpoints:lg', { style: { width: 320 } });

const Header = engine('Box', ({ theme }) => ({
  padding: theme.spacing.lg,
  gap: theme.spacing.sm,
  backgroundColor: theme.color.primary,
}));

const HeaderTop = engine('Box', { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' });
const HeaderText = engine('Box', { flex: 1, gap: 4 });

const Subtitle = engine('Text', { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, fontWeight: '700' });
const Title = engine('Text', ({ theme }) => ({
  color: '#ffffff',
  fontSize: theme.typography?.fontSize?.lg,
  fontWeight: theme.typography?.fontWeight?.bold,
}));

/** Recolher só faz sentido no desktop: no celular o menu fica embaixo do conteúdo. */
const CollapseButton = engine('Pressable', {
  display: 'none',
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
})
  .when('breakpoints:lg', { style: { display: 'flex' } })
  .when('state:hover', { style: { backgroundColor: 'rgba(255, 255, 255, 0.35)' } })
  .when('platform:web', { style: { cursor: 'pointer' } });

const CollapseIcon = engine('Text', { color: '#ffffff', fontSize: 18 });

const Body = engine('Box', ({ theme }) => ({ padding: theme.spacing.sm }));

/* ───────────────────────── componente ───────────────────────── */

interface MenuProps {
  title: string;
  subtitle: string;
  /** Progresso do curso, de 0 a 1. */
  progress: number;
  onCollapse: () => void;
  children: ReactNode;
}

export function Menu({ title, subtitle, progress, onCollapse, children }: MenuProps) {
  return (
    <Card testID="classroom-menu">
      <Header>
        <HeaderTop>
          <HeaderText>
            <Subtitle>{subtitle}</Subtitle>
            <Title>{title}</Title>
          </HeaderText>
          <CollapseButton onPress={onCollapse} testID="collapse-menu">
            <CollapseIcon>›</CollapseIcon>
          </CollapseButton>
        </HeaderTop>
        <ProgressBar value={progress} />
      </Header>
      <Body>{children}</Body>
    </Card>
  );
}
