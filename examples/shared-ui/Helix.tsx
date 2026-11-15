import { engine, keyframes } from 'omnistyle';

/**
 * Hélice de DNA — a animação "difícil": 12 degraus × (2 esferas + 1 ligação) = 36 `keyframes()`
 * diferentes, cada um com 21 quadros que descrevem uma órbita 3D projetada (seno/cosseno):
 *   · `translateX` + `scale` + `opacity` + `backgroundColor` mudam juntos a cada quadro (profundidade);
 *   · a defasagem de cada degrau está "assada" nos quadros (nada de delay negativo: roda igual no mobile);
 *   · o conjunto flutua e balança (rotate + translateY, `alternate`) e há um halo que respira.
 * Tudo é CSS `@keyframes` na web e `Animated` no mobile, a partir da mesma declaração.
 */

const ROWS = 12;
const STEPS = 20; // quadros por volta
const RADIUS = 56;
const CYCLE = 3600; // ms por volta

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
const mix = (a: string, b: string, t: number) => {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => hex(p(a, i) + (p(b, i) - p(a, i)) * t)).join('')}`;
};

/** Quadros de uma esfera na fase `phase` (rad). `depth` = cos → 1 na frente, -1 atrás. */
function orbitFrames(phase: number, back: string, front: string) {
  const frames: Record<string, Record<string, string | number>> = {};
  for (let k = 0; k <= STEPS; k++) {
    const angle = phase + (2 * Math.PI * k) / STEPS;
    const depth = Math.cos(angle);
    const t = (depth + 1) / 2;
    frames[`${+((k / STEPS) * 100).toFixed(2)}%`] = {
      transform: `translateX(${+(RADIUS * Math.sin(angle)).toFixed(2)}px) scale(${+(0.55 + 0.7 * t).toFixed(3)})`,
      opacity: +(0.35 + 0.65 * t).toFixed(3),
      backgroundColor: mix(back, front, t),
    };
  }
  return frames;
}

/** A ligação entre as duas esferas: encolhe/estica conforme o degrau gira. */
function linkFrames(phase: number) {
  const frames: Record<string, Record<string, string | number>> = {};
  for (let k = 0; k <= STEPS; k++) {
    const angle = phase + (2 * Math.PI * k) / STEPS;
    const width = Math.abs(Math.sin(angle));
    frames[`${+((k / STEPS) * 100).toFixed(2)}%`] = {
      transform: `scaleX(${+Math.max(width, 0.02).toFixed(3)})`,
      opacity: +(0.15 + 0.5 * width).toFixed(3),
    };
  }
  return frames;
}

const rows = Array.from({ length: ROWS }, (_, i) => {
  const phase = (i / ROWS) * 2 * Math.PI * 1.5; // 1,5 volta ao longo da hélice
  return {
    a: keyframes(orbitFrames(phase, '#4338ca', '#22d3ee')),
    b: keyframes(orbitFrames(phase + Math.PI, '#be185d', '#facc15')),
    link: keyframes(linkFrames(phase)),
  };
});

const float = keyframes({
  from: { transform: 'translateY(0px) rotate(-7deg)' },
  '50%': { transform: 'translateY(-10px) rotate(0deg)' },
  to: { transform: 'translateY(0px) rotate(7deg)' },
});

const breathe = keyframes({
  '0%': { transform: 'scale(0.8)', opacity: 0.15 },
  '50%': { transform: 'scale(1.15)', opacity: 0.4 },
  '100%': { transform: 'scale(0.8)', opacity: 0.15 },
});

const Stage = engine('Box', {
  width: 180,
  height: ROWS * 22 + 24,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
});

const Halo = engine('Box', {
  position: 'absolute',
  width: 190,
  height: 190,
  borderRadius: 95,
  backgroundColor: '#6366f1',
  animation: `${breathe} 3s ease-in-out infinite`,
});

const Swing = engine('Box', {
  width: 160,
  animation: `${float} 5s ease-in-out infinite alternate`,
});

const Rung = engine('Box', { width: 160, height: 22 });

const Sphere = engine<'Box', { kf: string }>('Box', ({ props }) => ({
  position: 'absolute',
  left: 73,
  top: 4,
  width: 14,
  height: 14,
  borderRadius: 7,
  animation: `${props.kf} ${CYCLE}ms linear infinite`,
}));

const Link = engine<'Box', { kf: string }>('Box', ({ props }) => ({
  position: 'absolute',
  left: 24,
  top: 10,
  width: 112,
  height: 2,
  borderRadius: 1,
  backgroundColor: '#94a3b8',
  animation: `${props.kf} ${CYCLE}ms linear infinite`,
}));

export function Helix() {
  return (
    <Stage testID="helix">
      <Halo />
      <Swing testID="helix-swing">
        {rows.map((r, i) => (
          <Rung key={i}>
            <Link kf={r.link} testID={`helix-link-${i}`} />
            <Sphere kf={r.a} testID={`helix-a-${i}`} />
            <Sphere kf={r.b} testID={`helix-b-${i}`} />
          </Rung>
        ))}
      </Swing>
    </Stage>
  );
}
