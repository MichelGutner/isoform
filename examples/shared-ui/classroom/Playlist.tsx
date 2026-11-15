import { useEffect, useState } from 'react';
import { engine } from 'omnistyle';
import type { Asset, AssetKind, Module } from './types';

/* ───────────────────────── item (conteúdo) ───────────────────────── */

const KIND_ICON: Record<AssetKind, string> = { video: '▶', pdf: '📄', quiz: '✎' };

const Row = engine<'Pressable', { active?: boolean }>('Pressable', ({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing.md,
  padding: theme.spacing.sm,
  borderRadius: theme.borderRadius?.md,
  backgroundColor: 'transparent',
  transition: 'background-color 150ms',
}))
  .when('state:hover', ({ theme }) => ({ style: { backgroundColor: theme.color.brandSurface } }))
  .when('props:active', ({ theme }) => ({ style: { backgroundColor: theme.color.brandSurface } }))
  .when('platform:web', { style: { cursor: 'pointer' } });

const KindIcon = engine('Box', ({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.color.border,
}));

const KindGlyph = engine('Text', { fontSize: 13 });

const AssetText = engine('Box', { flex: 1, gap: 2 });

const AssetTitle = engine<'Text', { active?: boolean }>('Text', ({ theme, props }) => ({
  fontSize: theme.typography?.fontSize?.sm,
  fontWeight: theme.typography?.fontWeight?.medium,
  color: props.active ? theme.color.primary : theme.color.text,
}));

const AssetDetail = engine('Text', ({ theme }) => ({ fontSize: 12, color: theme.color.muted }));

/** Bolinha de status: vazia enquanto pendente, verde com ✓ quando concluída. */
const Status = engine<'Box', { done?: boolean }>('Box', ({ theme, props }) => ({
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 1.5,
  alignItems: 'center',
  justifyContent: 'center',
  borderColor: props.done ? theme.color.success : theme.color.border,
  backgroundColor: props.done ? theme.color.success : 'transparent',
  transition: 'background-color 200ms, border-color 200ms',
}));

const StatusMark = engine('Text', { color: '#ffffff', fontSize: 12, fontWeight: '700' });

interface AssetRowProps {
  asset: Asset;
  isActive: boolean;
  isCompleted: boolean;
  onSelect: () => void;
}

function AssetRow({ asset, isActive, isCompleted, onSelect }: AssetRowProps) {
  return (
    <Row active={isActive} onPress={onSelect} testID={`asset-${asset.id}`}>
      <KindIcon>
        <KindGlyph>{KIND_ICON[asset.kind]}</KindGlyph>
      </KindIcon>
      <AssetText>
        <AssetTitle active={isActive}>{asset.title}</AssetTitle>
        <AssetDetail>{asset.detail}</AssetDetail>
      </AssetText>
      <Status done={isCompleted}>{isCompleted ? <StatusMark>✓</StatusMark> : null}</Status>
    </Row>
  );
}

/* ───────────────────────── módulo (acordeão) ───────────────────────── */

const ModuleButton = engine('Pressable', ({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing.sm,
  paddingBlock: theme.spacing.md,
}))
  .when('platform:web', { style: { cursor: 'pointer' } });

const ModuleTitle = engine('Text', ({ theme }) => ({
  flex: 1,
  fontSize: theme.typography?.fontSize?.md,
  fontWeight: theme.typography?.fontWeight?.bold,
  color: theme.color.text,
}));

const ModuleCount = engine('Text', ({ theme }) => ({ fontSize: 12, color: theme.color.muted, marginRight: theme.spacing.sm }));

const Chevron = engine<'Text', { open?: boolean }>('Text', ({ theme, props }) => ({
  fontSize: 18,
  color: theme.color.muted,
  transform: props.open ? 'rotate(90deg)' : 'rotate(0deg)',
  transition: 'transform 200ms',
}));

const ModuleBox = engine('Box', ({ theme }) => ({
  borderBottomWidth: 1,
  borderColor: theme.color.border,
}));

const ModuleAssets = engine('Box', ({ theme }) => ({ paddingBottom: theme.spacing.sm, gap: 2 }));

interface ModuleSectionProps {
  module: Module;
  isOpen: boolean;
  currentId: string;
  completedIds: ReadonlySet<string>;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

function ModuleSection({ module, isOpen, currentId, completedIds, onToggle, onSelect }: ModuleSectionProps) {
  const done = module.assets.filter((a) => completedIds.has(a.id)).length;
  return (
    <ModuleBox>
      <ModuleButton onPress={onToggle} testID={`module-${module.id}`}>
        <ModuleTitle>{module.title}</ModuleTitle>
        <ModuleCount>
          {done}/{module.assets.length}
        </ModuleCount>
        <Chevron open={isOpen}>›</Chevron>
      </ModuleButton>
      {isOpen ? (
        <ModuleAssets>
          {module.assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              isActive={asset.id === currentId}
              isCompleted={completedIds.has(asset.id)}
              onSelect={() => onSelect(asset.id)}
            />
          ))}
        </ModuleAssets>
      ) : null}
    </ModuleBox>
  );
}

/* ───────────────────────── playlist ───────────────────────── */

interface PlaylistProps {
  modules: Module[];
  currentId: string;
  /** Módulo do conteúdo aberto: é mantido aberto para o aluno ver onde está. */
  currentModuleId: string;
  completedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

export function Playlist({ modules, currentId, currentModuleId, completedIds, onSelect }: PlaylistProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set([currentModuleId]));

  // Ao avançar para outro módulo ("Próxima"), abre o acordeão dele.
  useEffect(() => {
    setOpenIds((prev) => new Set(prev).add(currentModuleId));
  }, [currentModuleId]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {modules.map((module) => (
        <ModuleSection
          key={module.id}
          module={module}
          isOpen={openIds.has(module.id)}
          currentId={currentId}
          completedIds={completedIds}
          onToggle={() => toggle(module.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
