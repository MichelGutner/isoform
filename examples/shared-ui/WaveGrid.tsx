import { useState } from 'react';
import { engine, keyframes } from 'omnistyle';
import { Button, ButtonLabel, Row } from './ui';

/**
 * Grade de ondas — coreografia de uma linha do tempo só (14s), 49 células com 3 camadas cada:
 *   1. ONDA: um anel de escala/rotação viaja do centro para fora (a defasagem por distância está
 *      "assada" nos quadros);
 *   2. TORÇÃO: a grade gira e entorta (`rotate` + `skew`), mais forte nas bordas;
 *   3. COLAPSO: todas as células são sugadas para o centro e voltam (`translate` por vetor);
 *   4. a cor não é animada: duas camadas (ciano/magenta) trocam de `opacity` em oposição, então
 *      a mistura de cor roda inteira no driver NATIVO (só transform + opacity, nenhum JS).
 * `animationPlayState` liga/desliga tudo pelo botão.
 */

const N = 7;
const CELL = 22;
const GAP = 6;
const STEPS = 56; // quadros na linha do tempo
const CYCLE = 14000;
const C = (N - 1) / 2;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Janela suave: 0 fora de [a, d], 1 em [b, c]. */
const bump = (a: number, b: number, c: number, d: number, x: number) => smooth(a, b, x) * (1 - smooth(c, d, x));
const pct = (k: number) => `${+((k / STEPS) * 100).toFixed(2)}%`;

function cellFrames(row: number, col: number) {
  const dx = col - C;
  const dy = row - C;
  const dist = Math.hypot(dx, dy) / Math.hypot(C, C); // 0 centro → 1 canto
  const frames: Record<string, Record<string, string | number>> = {};
  const mixA: Record<string, Record<string, string | number>> = {};
  const mixB: Record<string, Record<string, string | number>> = {};

  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    // 1 · onda que sai do centro (2 anéis por volta)
    const wave = Math.sin(2 * Math.PI * (t * 2 - dist * 1.4)) * bump(0, 0.08, 0.3, 0.38, t);
    // 2 · torção: gira mais nas bordas
    const twist = bump(0.36, 0.46, 0.6, 0.7, t);
    // 3 · colapso até o centro e volta
    const pull = bump(0.68, 0.78, 0.86, 0.96, t);

    const scale = 1 + 0.55 * wave + 0.25 * twist - 0.45 * pull;
    const rotate = 180 * twist * (0.4 + dist) + 90 * wave;
    const skew = 22 * twist * dist;
    const tx = -dx * (CELL + GAP) * pull;
    const ty = -dy * (CELL + GAP) * pull;

    frames[pct(k)] = {
      transform: `translateX(${+tx.toFixed(2)}px) translateY(${+ty.toFixed(2)}px) rotate(${+rotate.toFixed(2)}deg) skewX(${+skew.toFixed(2)}deg) scale(${+Math.max(scale, 0.05).toFixed(3)})`,
    };
    const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 3 - dist));
    mixA[pct(k)] = { opacity: +a.toFixed(3) };
    mixB[pct(k)] = { opacity: +(1 - a).toFixed(3) };
  }
  return { move: keyframes(frames), a: keyframes(mixA), b: keyframes(mixB) };
}

const cells = Array.from({ length: N * N }, (_, i) => cellFrames(Math.floor(i / N), i % N));

const Board = engine('Box', {
  width: N * CELL + (N - 1) * GAP,
  height: N * CELL + (N - 1) * GAP,
  alignSelf: 'center',
  marginBlock: 28,
});

const Cell = engine<'Box', { kf: string; paused: boolean; x: number; y: number }>('Box', ({ props }) => ({
  position: 'absolute',
  left: props.x * (CELL + GAP),
  top: props.y * (CELL + GAP),
  width: CELL,
  height: CELL,
  animation: `${props.kf} ${CYCLE}ms ease-in-out infinite`,
  animationPlayState: props.paused ? 'paused' : 'running',
}));

const Tint = engine<'Box', { kf: string; paused: boolean; color: string }>('Box', ({ props }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: CELL,
  height: CELL,
  borderRadius: 6,
  backgroundColor: props.color,
  animation: `${props.kf} ${CYCLE}ms linear infinite`,
  animationPlayState: props.paused ? 'paused' : 'running',
}));

export function WaveGrid() {
  const [paused, setPaused] = useState(false);
  return (
    <>
      <Board testID="wave-grid">
        {cells.map((c, i) => (
          <Cell key={i} kf={c.move} paused={paused} x={i % N} y={Math.floor(i / N)} testID={`wave-cell-${i}`}>
            <Tint kf={c.a} paused={paused} color="#22d3ee" testID={`wave-a-${i}`} />
            <Tint kf={c.b} paused={paused} color="#e879f9" testID={`wave-b-${i}`} />
          </Cell>
        ))}
      </Board>
      <Row>
        <Button size="sm" onPress={() => setPaused((p) => !p)} testID="wave-toggle">
          <ButtonLabel>{paused ? '▶ Continuar' : '⏸ Pausar'}</ButtonLabel>
        </Button>
      </Row>
    </>
  );
}
