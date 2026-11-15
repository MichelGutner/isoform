import { engine, keyframes } from 'omnistyle';

/**
 * @platform web — Prisma: cena 3D que SÓ existe na web (o React Native não tem `translateZ`,
 * `preserve-3d`, `backface-visibility`, `conic-gradient`, `backdrop-filter`, `mix-blend-mode`,
 * `clip-path` nem `filter` animado). Por isso `PrismScene` só é renderizada na web
 * (`getProvider().os() === 'web'` no Showcase) e todo estilo 3D fica em `.when('web')`.
 *
 *   · cubo grande + cubo interno girando ao contrário (preserve-3d aninhado);
 *   · 6 faces por cubo com `conic-gradient`, `backdrop-filter` e `mix-blend-mode: screen`;
 *   · `hue-rotate` animado em cada face, com defasagem;
 *   · anel de 10 satélites em órbita (`rotateY` + `translateZ`), cada um com `clip-path` que
 *     morfa de triângulo para hexágono;
 *   · sombra no chão (`blur`) que respira com a altura do cubo.
 */

const spin = keyframes({
  '0%': { transform: 'rotateX(-20deg) rotateY(0deg) rotateZ(0deg)' },
  '33%': { transform: 'rotateX(160deg) rotateY(120deg) rotateZ(40deg)' },
  '66%': { transform: 'rotateX(300deg) rotateY(240deg) rotateZ(-30deg)' },
  '100%': { transform: 'rotateX(340deg) rotateY(360deg) rotateZ(0deg)' },
});
const spinBack = keyframes({
  from: { transform: 'rotateX(0deg) rotateY(360deg) rotateZ(0deg)' },
  to: { transform: 'rotateX(-360deg) rotateY(0deg) rotateZ(180deg)' },
});
const orbit = keyframes({
  from: { transform: 'rotateX(68deg) rotateZ(0deg)' },
  to: { transform: 'rotateX(68deg) rotateZ(360deg)' },
});
const hue = keyframes({
  from: { filter: 'hue-rotate(0deg) brightness(1)' },
  '50%': { filter: 'hue-rotate(180deg) brightness(1.4)' },
  to: { filter: 'hue-rotate(360deg) brightness(1)' },
});
const morphClip = keyframes({
  '0%': { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%, 50% 100%, 50% 100%, 50% 100%)' },
  '50%': { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  '100%': { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%, 50% 100%, 50% 100%, 50% 100%)' },
});
const bob = keyframes({
  '0%': { transform: 'translateY(0px)' },
  '50%': { transform: 'translateY(-14px)' },
  '100%': { transform: 'translateY(0px)' },
});
const shadow = keyframes({
  '0%': { transform: 'translateY(96px) rotateX(75deg) scale(1)', opacity: 0.55 },
  '50%': { transform: 'translateY(96px) rotateX(75deg) scale(0.7)', opacity: 0.25 },
  '100%': { transform: 'translateY(96px) rotateX(75deg) scale(1)', opacity: 0.55 },
});

const Panel = engine('Box', {
  alignSelf: 'stretch',
  height: 360,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 16,
  overflow: 'hidden',
  backgroundColor: '#05060f',
}).when('web', {
  style: { backgroundImage: 'radial-gradient(circle at 50% 40%, #1e1b4b 0%, #05060f 70%)', perspective: '900px' },
});

const Bob = engine('Box', { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }).when('web', {
  style: { transformStyle: 'preserve-3d', animation: `${bob} 4s ease-in-out infinite` },
});

const Ground = engine('Box', { position: 'absolute', width: 150, height: 150, borderRadius: 75 }).when('web', {
  style: { backgroundColor: '#000', filter: 'blur(14px)', animation: `${shadow} 4s ease-in-out infinite` },
});

const Cube = engine<'Box', { size: number; dur: number; back?: boolean }>('Box', ({ props }) => ({
  position: 'absolute',
  width: props.size,
  height: props.size,
})).when('web', ({ props }) => ({
  style: {
    transformStyle: 'preserve-3d',
    animation: `${props.back ? spinBack : spin} ${props.dur}ms linear infinite`,
  },
}));

const TRANSFORMS = ['rotateY(0deg)', 'rotateY(90deg)', 'rotateY(180deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];

const Face = engine<'Box', { size: number; i: number }>('Box', ({ props }) => ({
  position: 'absolute',
  width: props.size,
  height: props.size,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.55)',
})).when('web', ({ props }) => ({
  style: {
    transform: `${TRANSFORMS[props.i]} translateZ(${props.size / 2}px)`,
    backgroundImage: `conic-gradient(from ${props.i * 60}deg at 50% 50%, #22d3ee, #e879f9, #facc15, #22d3ee)`,
    backdropFilter: 'blur(2px) saturate(1.8)',
    mixBlendMode: 'screen',
    opacity: 0.8,
    boxShadow: 'inset 0 0 24px rgba(255,255,255,0.45), 0 0 18px rgba(99,102,241,0.6)',
    backfaceVisibility: 'visible',
    animation: `${hue} 6s linear ${props.i * -1}s infinite`,
  },
}));

const Ring = engine('Box', { position: 'absolute', width: 0, height: 0 }).when('web', {
  style: { transformStyle: 'preserve-3d', animation: `${orbit} 18s linear infinite` },
});

const Satellite = engine<'Box', { i: number }>('Box', { position: 'absolute', width: 34, height: 34, left: -17, top: -17 }).when(
  'web',
  ({ props }) => ({
    style: {
      transform: `rotateZ(${props.i * 36}deg) translateX(165px) rotateZ(${-props.i * 36}deg)`,
      backgroundImage: 'conic-gradient(#22d3ee, #e879f9, #22d3ee)',
      mixBlendMode: 'screen',
      boxShadow: '0 0 14px #22d3ee',
      animation: `${morphClip} 3s ease-in-out ${props.i * -0.3}s infinite, ${hue} 5s linear ${props.i * -0.5}s infinite`,
    },
  }),
);

export function PrismScene() {
  return (
    <Panel testID="prism">
      <Ground />
      <Bob>
        <Cube size={140} dur={14000} testID="prism-outer">
          {TRANSFORMS.map((_, i) => (
            <Face key={i} size={140} i={i} testID={`prism-face-${i}`} />
          ))}
        </Cube>
        <Cube size={70} dur={9000} back testID="prism-inner">
          {TRANSFORMS.map((_, i) => (
            <Face key={i} size={70} i={i} />
          ))}
        </Cube>
        <Ring testID="prism-ring">
          {Array.from({ length: 10 }, (_, i) => (
            <Satellite key={i} i={i} testID={`prism-sat-${i}`} />
          ))}
        </Ring>
      </Bob>
    </Panel>
  );
}
