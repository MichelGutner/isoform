import { useEffect, useMemo, useState } from 'react';
import type { Asset, Course, Module } from './types';

/** Tempo simulado para "buscar" o conteúdo ao trocar de aula. */
const LOAD_MS = 600;

/**
 * Estado da sala de aula: qual conteúdo está aberto, o que já foi concluído
 * e como ir para o anterior/próximo. Não sabe nada de interface.
 */
export function useClassroom(course: Course) {
  const assets = useMemo(() => course.modules.flatMap((m) => m.assets), [course]);

  const [currentId, setCurrentId] = useState(assets[0].id);
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const index = assets.findIndex((a) => a.id === currentId);
  const current: Asset = assets[index];
  const currentModule: Module = course.modules.find((m) => m.assets.some((a) => a.id === currentId))!;

  // A cada troca de aula, mostra o skeleton enquanto o conteúdo "carrega".
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), LOAD_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  const toggleCompleted = (id: string) =>
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return {
    current,
    currentModule,
    isLoading,
    completedIds,
    progress: completedIds.size / assets.length,
    select: setCurrentId,
    toggleCompleted,
    // `undefined` quando não há para onde ir: a interface esconde o botão.
    goPrevious: index > 0 ? () => setCurrentId(assets[index - 1].id) : undefined,
    goNext: index < assets.length - 1 ? () => setCurrentId(assets[index + 1].id) : undefined,
  };
}
