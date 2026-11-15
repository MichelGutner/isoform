import { engine, keyframes } from 'omnistyle';
import type { Asset } from './types';
import { AssetPreview } from './AssetPreview';
import { NavigationButtons } from './NavigationButtons';
import { Button, ButtonLabel, Title } from '../ui';

/* ───────────────────────── estilos ───────────────────────── */

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0px)' },
});

/** Remontar com `key` diferente reinicia a animação de entrada. */
const Fade = engine('Box', ({ theme }) => ({
  gap: theme.spacing.lg,
  animation: `${fadeIn} 300ms ease-out both`,
}));

/** Título e botões: empilhados no celular, lado a lado a partir de `md`. */
const Header = engine('Box', ({ theme }) => ({ gap: theme.spacing.md }))
  .when('breakpoints:md', { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });

const TitleBlock = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs, flexShrink: 1 }));

const Subtitle = engine('Text', ({ theme }) => ({
  color: theme.color.muted,
  fontSize: theme.typography?.fontSize?.sm,
  fontWeight: theme.typography?.fontWeight?.bold,
}));

const Footer = engine('Box', ({ theme }) => ({ flexDirection: 'row', gap: theme.spacing.sm }));

/* ───────────────────────── skeleton ───────────────────────── */

const pulse = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } });

const SkeletonBlock = engine<'Box', { height?: number; width?: number | string }>('Box', ({ theme, props }) => ({
  height: props.height,
  width: props.width ?? '100%',
  borderRadius: theme.borderRadius?.md,
  backgroundColor: theme.color.border,
  animation: `${pulse} 800ms ease-in-out infinite alternate`,
}));

const SkeletonSpacing = engine('Box', ({ theme }) => ({ gap: theme.spacing.lg }));

function ContentSkeleton() {
  return (
    <SkeletonSpacing testID="content-skeleton">
      <SkeletonBlock height={40} width="60%" />
      <SkeletonBlock height={260} />
    </SkeletonSpacing>
  );
}

/* ───────────────────────── componente ───────────────────────── */

interface ContentViewerProps {
  asset: Asset;
  /** Nome do módulo, mostrado abaixo do título. */
  moduleTitle: string;
  isLoading: boolean;
  isCompleted: boolean;
  onToggleCompleted: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function ContentViewer({
  asset,
  moduleTitle,
  isLoading,
  isCompleted,
  onToggleCompleted,
  onPrevious,
  onNext,
}: ContentViewerProps) {
  if (isLoading) return <ContentSkeleton />;

  return (
    <Fade key={asset.id}>
      <Header>
        <TitleBlock>
          <Title>{asset.title}</Title>
          <Subtitle>{moduleTitle}</Subtitle>
        </TitleBlock>
        <NavigationButtons onPrevious={onPrevious} onNext={onNext} />
      </Header>

      <AssetPreview asset={asset} />

      <Footer>
        <Button
          size="sm"
          variant={isCompleted ? 'success' : 'primary'}
          outlined={!isCompleted}
          onPress={onToggleCompleted}
          testID="toggle-completed"
        >
          <ButtonLabel outlined={!isCompleted} variant={isCompleted ? 'success' : 'primary'}>
            {isCompleted ? '✓ Concluída' : 'Marcar como concluída'}
          </ButtonLabel>
        </Button>
      </Footer>
    </Fade>
  );
}
