import { useRef, useState } from 'react';
import { engine, getTheme, keyframes, updateTheme } from 'react-isoform';

/**
 * Troca de tema em "bolha": um círculo com a cor do novo tema cresce a partir do ponto
 * do toque, ATRÁS do conteúdo (a página fica transparente). O tema troca no início e as cores dos
 * componentes transitam junto (550ms, mesma curva), então tudo termina junto com a bolha.
 * Só usa `keyframes` + primitivas neutras: mesma animação na web e no mobile.
 */

const SIZE = 5000; // cobre qualquer tela, mesmo clicando num canto

const grow = keyframes({
  from: { transform: 'scale(0)' },
  to: { transform: 'scale(1)' },
});

/** Camada de fundo (atrás de tudo): cor do tema atual + a bolha. Sem transition: a troca é instantânea. */
const Layer = engine('Box', ({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  backgroundColor: theme.color.background,
})).when('platform:web', { style: { position: 'fixed', zIndex: 0 } });

const Bubble = engine('Box', {
  position: 'absolute',
  width: SIZE,
  height: SIZE,
  borderRadius: SIZE / 2,
  pointerEvents: 'none',
  animation: `${grow} 550ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
});

interface Burst {
  x: number;
  y: number;
  color: string;
  /** Fundo do tema antigo: a camada o mantém até a bolha cobrir tudo. */
  base: string;
}

/** Posição do toque: `clientX/Y` (web) ou `nativeEvent.pageX/Y` (mobile). */
function pointOf(event: any): { x: number; y: number } {
  const e = event?.nativeEvent ?? event ?? {};
  return { x: e.pageX ?? e.clientX ?? 40, y: e.pageY ?? e.clientY ?? 40 };
}

export function useThemeBubble() {
  const [burst, setBurst] = useState<Burst | null>(null);
  const busy = useRef(false);

  /** Troca para `tokens` com a bolha saindo do ponto do evento. */
  const switchTheme = (event: any, tokens: Parameters<typeof updateTheme>[0], color: string) => {
    if (busy.current) return;
    busy.current = true;
    const { x, y } = pointOf(event);
    setBurst({ x, y, color, base: getTheme().color.background });
    // o tema troca JÁ: as cores dos componentes transitam (themeFade) na mesma duração/curva da bolha
    updateTheme(tokens);
    setTimeout(() => {
      setBurst(null); // a bolha já é a cor do novo fundo: a camada assume o tema sem salto
      busy.current = false;
    }, 600);
  };

  /** Renderize ANTES do conteúdo (fica atrás) e deixe a página com fundo transparente. */
  const backdrop = (
    <Layer testID="theme-backdrop" style={burst ? { backgroundColor: burst.base } : undefined}>
      {burst ? (
        <Bubble
          testID="theme-bubble"
          style={{ left: burst.x - SIZE / 2, top: burst.y - SIZE / 2, backgroundColor: burst.color }}
        />
      ) : null}
    </Layer>
  );

  return { switchTheme, backdrop };
}
