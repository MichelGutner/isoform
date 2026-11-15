import { engine, keyframes } from 'omnistyle';

/**
 * Cubos — 3D de verdade nas DUAS plataformas, sem `translateZ` (o React Native não tem).
 * A projeção é calculada em JS e "assada" nos `keyframes()`:
 *   · cada face é um quadrado cuja projeção ortogonal é uma transformação afim 2D; ela é
 *     decomposta em `translate + rotate + skewX + scaleX/scaleY` (o que web e mobile entendem);
 *   · faces viradas para trás somem (`opacity` 0) e as da frente recebem luz por `opacity`
 *     (normal · direção da luz), então os cubos parecem sólidos e sombreados;
 *   · 1 cubo grande girando nos 3 eixos + 6 cubos em órbita inclinada (com profundidade: os de
 *     trás ficam menores e mais apagados), cada um girando no seu ritmo;
 *   · só `transform` e `opacity` → no mobile tudo roda no driver NATIVO (sem JS por quadro);
 *   · ciclo fecha sem salto (voltas inteiras em cada eixo).
 */

const STEPS = 96; // quadros por ciclo
const CYCLE = 16000;
const W = 280; // palco
const TAU = Math.PI * 2;

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Rotação Rz·Ry·Rx de um vetor (y para cima, z para o observador). */
function rotate(v: V3, ax: number, ay: number, az: number): V3 {
  let [x, y, z] = v;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  return [x, y, z];
}

const LIGHT = unit([-0.5, 0.8, 0.6]);
const NORMALS: V3[] = [
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
];
/** Eixo local X de cada face (qualquer vetor perpendicular à normal). */
const faceU = (n: V3): V3 => (Math.abs(n[1]) === 1 ? [1, 0, 0] : [0, 1, 0]);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
function hsl(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(Math.min(((n + h / 30) % 12) - 3, 9 - ((n + h / 30) % 12)), 1));
  return `#${hex(f(0) * 255)}${hex(f(8) * 255)}${hex(f(4) * 255)}`;
}

interface CubeSpec {
  size: number; // meia aresta (px)
  /** centro do cubo em função de t (0..1) */
  center: (t: number) => V3;
  /** ângulos de rotação em função de t (voltas inteiras) */
  angles: (t: number) => V3;
}

/** Quadros de UMA face: translate + rotate + skewX + scale, e a opacidade (visibilidade × luz × profundidade). */
function faceFrames(cube: CubeSpec, faceIndex: number) {
  const n0 = NORMALS[faceIndex];
  const u0 = faceU(n0);
  const w0 = cross(u0, n0); // eixo local Y (para baixo na tela): u × n deixa det > 0 nas faces visíveis
  const frames: Record<string, Record<string, string | number>> = {};

  let prevAngle = 0;
  let held = { tx: 0, ty: 0, rot: 0, skew: 0, sx: 1, sy: 1 };

  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const [ax, ay, az] = cube.angles(t);
    const n = rotate(n0, ax, ay, az);
    const u = rotate(u0, ax, ay, az);
    const w = rotate(w0, ax, ay, az);
    const c = cube.center(t);

    // perspectiva "leve" só no tamanho: mais perto → maior
    const depth = 1 + c[2] / 400;
    const a = u[0] * depth;
    const b = -u[1] * depth; // y da tela é para baixo
    const cc = w[0] * depth;
    const d = -w[1] * depth;
    const det = a * d - b * cc;

    // faces com det > ~0 são visíveis; perto de 0 a decomposição explode → mantém os valores anteriores
    if (det > 0.06) {
      const sx = Math.hypot(a, b);
      const theta = Math.atan2(b, a);
      const cp = cc * Math.cos(theta) + d * Math.sin(theta);
      const dp = -cc * Math.sin(theta) + d * Math.cos(theta);
      // rotação contínua (sem saltos de ±360° entre quadros)
      let delta = theta - (prevAngle % TAU);
      delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
      prevAngle += delta;
      held = {
        tx: c[0] + n[0] * cube.size * depth,
        ty: -(c[1] + n[1] * cube.size * depth),
        rot: (prevAngle * 180) / Math.PI,
        skew: (Math.atan(cp / dp) * 180) / Math.PI,
        sx,
        sy: dp,
      };
    } else {
      held = { ...held, tx: c[0] + n[0] * cube.size * depth, ty: -(c[1] + n[1] * cube.size * depth) };
    }

    const visible = smoothstep(0.06, 0.22, det);
    const light = Math.max(0, dot(n, LIGHT));
    const far = 0.55 + 0.45 * smoothstep(-140, 140, c[2]); // os de trás ficam mais apagados
    frames[`${+((k / STEPS) * 100).toFixed(3)}%`] = {
      transform: `translateX(${+held.tx.toFixed(2)}px) translateY(${+held.ty.toFixed(2)}px) rotate(${+held.rot.toFixed(2)}deg) skewX(${+held.skew.toFixed(2)}deg) scaleX(${+(held.sx * 2 * cube.size).toFixed(3)}) scaleY(${+(held.sy * 2 * cube.size).toFixed(3)})`,
      opacity: +(visible * (0.35 + 0.65 * light) * far).toFixed(3),
    };
  }
  return frames;
}

const ORBIT_TILT = 1.0;
const MINI = 6;

const cubes: Array<{ spec: CubeSpec; hue: number }> = [
  {
    hue: 200,
    spec: {
      size: 1,
      center: () => [0, 0, 0],
      angles: (t) => [TAU * t * 1, TAU * t * 2, TAU * t * 1],
    },
  },
  ...Array.from({ length: MINI }, (_, j) => ({
    hue: 20 + (j * 360) / MINI,
    spec: {
      size: 1,
      center: (t: number): V3 => {
        const phi = TAU * (t + j / MINI);
        // círculo de raio 105 num plano inclinado
        return rotate([105 * Math.cos(phi), 0, 105 * Math.sin(phi)], ORBIT_TILT, 0, 0.35);
      },
      angles: (t: number): V3 => [TAU * t * 3, TAU * t * (2 + (j % 2)), TAU * t * 1],
    } as CubeSpec,
  })),
];

// meia aresta: grande 46px, pequenos 13px. `faceFrames` usa `size` como fator de escala (px por unidade).
const SIZES = [46, ...Array(MINI).fill(13)];

const faces = cubes.map((cube, ci) => {
  const spec = { ...cube.spec, size: SIZES[ci] };
  return NORMALS.map((_, fi) => ({
    kf: keyframes(faceFrames(spec, fi)),
    color: hsl((cube.hue + fi * 14) % 360, 0.85, 0.58),
    half: SIZES[ci],
  }));
});

// estrelas: só opacity (cintilar)
const twinkle = keyframes({ '0%': { opacity: 0.1 }, '50%': { opacity: 0.9 }, '100%': { opacity: 0.1 } });
const stars = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 97) % 100) / 100,
  y: ((i * 53 + 17) % 100) / 100,
  dur: 1800 + (i % 7) * 450,
}));

const Stage = engine('Box', {
  width: W,
  height: W,
  alignSelf: 'center',
  borderRadius: 24,
  overflow: 'hidden',
  backgroundColor: '#070813',
});

const Star = engine<'Box', { dur: number }>('Box', ({ props }) => ({
  position: 'absolute',
  width: 2,
  height: 2,
  borderRadius: 1,
  backgroundColor: '#e0e7ff',
  animation: `${twinkle} ${props.dur}ms ease-in-out infinite`,
}));

const Face = engine<'Box', { kf: string; color: string; half: number }>('Box', ({ props }) => ({
  position: 'absolute',
  // o elemento tem 1×1px e a escala (por quadro) o leva ao tamanho da face; centrado no palco
  left: W / 2 - 0.5,
  top: W / 2 - 0.5,
  width: 1,
  height: 1,
  backgroundColor: props.color,
  animation: `${props.kf} ${CYCLE}ms linear infinite`,
}));

export function Cubes() {
  return (
    <Stage testID="cubes">
      {stars.map((s, i) => (
        <Star key={i} dur={s.dur} style={{ left: s.x * W, top: s.y * W }} />
      ))}
      {faces.map((cubeFaces, ci) =>
        cubeFaces.map((f, fi) => <Face key={`${ci}-${fi}`} kf={f.kf} color={f.color} half={f.half} testID={`cube-${ci}-${fi}`} />),
      )}
    </Stage>
  );
}
