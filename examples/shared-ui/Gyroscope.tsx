import { engine, keyframes } from 'omnistyle';

/**
 * Giroscópio — a animação "mais difícil ainda". Tudo numa cena só, com `keyframes()`:
 *   · ENTRADA: a cena inteira nasce girando e crescendo (`cubic-bezier`, delay, fill-mode `both`);
 *   · 3D: `perspective` + `rotateX/rotateY/rotateZ` combinados, três anéis em eixos diferentes
 *     e com durações coprimas (o conjunto só se repete depois de ~1 min);
 *   · ANINHADA: o suporte gira em Z e os anéis giram DENTRO dele (animação dentro de animação);
 *   · `alternate-reverse`: um dos anéis vai e volta, em sentido contrário;
 *   · MORFOSE: o núcleo anima `width`, `height`, `borderRadius` e `backgroundColor` juntos (JS no mobile);
 *   · 24 partículas em trajetórias de Lissajous próprias (X e Y com frequências diferentes),
 *     33 quadros cada, com escala/opacidade/cor pela profundidade (z).
 */

const SCENE = 240;
const STEPS = 32;
const PARTICLES = 24;

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
const mix = (a: string, b: string, t: number) => {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => hex(p(a, i) + (p(b, i) - p(a, i)) * t)).join('')}`;
};

// ───────────── entrada ─────────────
const intro = keyframes({
  from: { opacity: 0, transform: 'scale(0.2) rotate(-200deg)' },
  '60%': { opacity: 1 },
  to: { opacity: 1, transform: 'scale(1) rotate(0deg)' },
});

// ───────────── rotações 3D ─────────────
const carrier = keyframes({ to: { transform: 'rotate(360deg)' } });
const spinX = keyframes({
  from: { transform: 'perspective(600px) rotateX(0deg)' },
  to: { transform: 'perspective(600px) rotateX(360deg)' },
});
const spinY = keyframes({
  from: { transform: 'perspective(600px) rotateY(0deg)' },
  to: { transform: 'perspective(600px) rotateY(360deg)' },
});
const tilt = keyframes({
  '0%': { transform: 'perspective(600px) rotateX(68deg) rotateZ(0deg) scale(1)' },
  '50%': { transform: 'perspective(600px) rotateX(68deg) rotateZ(180deg) scale(1.12)' },
  '100%': { transform: 'perspective(600px) rotateX(68deg) rotateZ(360deg) scale(1)' },
});

// ───────────── morfose do núcleo ─────────────
const morph = keyframes({
  '0%': { width: 34, height: 34, borderRadius: 17, backgroundColor: '#22d3ee' },
  '20%': { width: 48, height: 26, borderRadius: 6, backgroundColor: '#818cf8' },
  '40%': { width: 26, height: 48, borderRadius: 13, backgroundColor: '#e879f9' },
  '60%': { width: 44, height: 44, borderRadius: 4, backgroundColor: '#fb7185' },
  '80%': { width: 30, height: 40, borderRadius: 20, backgroundColor: '#facc15' },
  '100%': { width: 34, height: 34, borderRadius: 17, backgroundColor: '#22d3ee' },
});

// ───────────── partículas: Lissajous 3D ─────────────
function particleFrames(i: number) {
  const fx = 1 + (i % 3); // 1, 2 ou 3 oscilações em X por volta
  const fy = 2 + (i % 2); // 2 ou 3 em Y
  const phase = (i / PARTICLES) * 2 * Math.PI;
  const radius = 62 + (i % 4) * 14;
  const frames: Record<string, Record<string, string | number>> = {};
  for (let k = 0; k <= STEPS; k++) {
    const t = (2 * Math.PI * k) / STEPS;
    const z = Math.cos(t + phase); // profundidade
    const depth = (z + 1) / 2;
    frames[`${+((k / STEPS) * 100).toFixed(2)}%`] = {
      transform: `translateX(${+(radius * Math.sin(fx * t + phase)).toFixed(2)}px) translateY(${+(
        radius * 0.8 * Math.sin(fy * t)
      ).toFixed(2)}px) scale(${+(0.4 + 0.9 * depth).toFixed(3)})`,
      opacity: +(0.2 + 0.8 * depth).toFixed(3),
      backgroundColor: mix('#475569', i % 2 ? '#f0abfc' : '#67e8f9', depth),
    };
  }
  return keyframes(frames);
}
const particles = Array.from({ length: PARTICLES }, (_, i) => ({ kf: particleFrames(i), ms: 6000 + (i % 5) * 700 }));

// ───────────── peças ─────────────
const Scene = engine('Box', {
  width: SCENE,
  height: SCENE,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  animation: `${intro} 1400ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms both`,
});

const Layer = engine('Box', {
  position: 'absolute',
  width: SCENE,
  height: SCENE,
  alignItems: 'center',
  justifyContent: 'center',
});

const Carrier = engine('Box', {
  width: SCENE,
  height: SCENE,
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${carrier} 21s linear infinite`,
});

type Axis = 'x' | 'y' | 'tilt';
const Ring = engine<'Box', { axis: Axis; size: number; color: string }>('Box', ({ props }) => ({
  position: 'absolute',
  width: props.size,
  height: props.size,
  borderRadius: props.size / 2,
  borderWidth: 3,
  borderColor: props.color,
  borderTopColor: 'transparent',
  animation:
    props.axis === 'x'
      ? `${spinX} 7s linear infinite`
      : props.axis === 'y'
        ? `${spinY} 11s linear infinite alternate-reverse`
        : `${tilt} 13s ease-in-out infinite`,
}));

const Core = engine('Box', { animation: `${morph} 4200ms ease-in-out infinite` });

const Particle = engine<'Box', { kf: string; ms: number }>('Box', ({ props }) => ({
  position: 'absolute',
  width: 8,
  height: 8,
  borderRadius: 4,
  animation: `${props.kf} ${props.ms}ms linear infinite`,
}));

export function Gyroscope() {
  return (
    <Scene testID="gyro">
      <Layer>
        {particles.map((p, i) => (
          <Particle key={i} kf={p.kf} ms={p.ms} testID={`gyro-p-${i}`} />
        ))}
      </Layer>
      <Carrier testID="gyro-carrier">
        <Ring axis="x" size={210} color="#22d3ee" testID="gyro-ring-x" />
        <Ring axis="y" size={170} color="#e879f9" testID="gyro-ring-y" />
        <Ring axis="tilt" size={130} color="#facc15" testID="gyro-ring-tilt" />
      </Carrier>
      <Layer>
        <Core testID="gyro-core" />
      </Layer>
    </Scene>
  );
}
