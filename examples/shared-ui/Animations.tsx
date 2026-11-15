import { useState } from 'react';
import { engine, keyframes } from 'omnistyle';
import { Body, Button, ButtonLabel, Card, Heading, Row, themeFade } from './ui';

/**
 * Laboratório de animações: tudo declarado com `keyframes()` + `animation` e
 * renderizado igual na web (@keyframes) e no mobile (Animated).
 * Cada bloco exercita uma parte diferente da feature.
 */

// ───────────── 1 · rotação infinita linear (transform, native driver) ─────────────
const spin = keyframes({ to: { transform: 'rotate(360deg)' } });
const pulse = keyframes({
  '0%, 100%': { transform: 'scale(1)', opacity: 1 },
  '50%': { transform: 'scale(1.4)', opacity: 0.4 },
});
 
const Ring = engine('Box', ({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  borderWidth: 4,
  borderColor: theme.color.border,
  borderTopColor: theme.color.primary,
  animation: `${spin} 1800ms linear infinite`,
  // animation: `${pulse} 1.9s infinite`
  // animation: `${spin} 2s linear infinite`,
}));

// ───────────── 2 · órbita: rotação lenta + núcleo que pulsa e troca de cor ─────────────
const orbit = keyframes({ to: { transform: 'rotate(360deg)' } });
const core = keyframes({
  '0%': { transform: 'scale(1)', backgroundColor: '#6366f1' },
  '50%': { transform: 'scale(1.5)', backgroundColor: '#f43f5e' },
  '100%': { transform: 'scale(1)', backgroundColor: '#6366f1' },
});

const OrbitBox = engine('Box', { width: 72, height: 72, animation: `${orbit} 2.4s linear infinite` });

/** Três satélites a 0°, 120° e 240° de um círculo de raio 29. */
const SATELLITES = [
  { x: 29, y: 0, tone: 'primary' },
  { x: 54, y: 43, tone: 'secondary' },
  { x: 4, y: 43, tone: 'warning' },
] as const;

const Satellite = engine<'Box', { n: 0 | 1 | 2 }>('Box', ({ theme, props }) => ({
  position: 'absolute',
  left: SATELLITES[props.n].x,
  top: SATELLITES[props.n].y,
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: theme.color[SATELLITES[props.n].tone],
}));

const Core = engine('Box', {
  position: 'absolute',
  left: 26,
  top: 26,
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#6366f1',
  animation: `${core} 1.2s ease-in-out infinite`, // backgroundColor → driver JS no mobile
});

// ───────────── 3 · equalizador: delays e durações escalonados por item ─────────────
const eq = keyframes({
  '0%': { transform: 'scaleY(0.3)' },
  '50%': { transform: 'scaleY(1)' },
  '100%': { transform: 'scaleY(0.4)' },
});

const Bar = engine<'Box', { i: number }>('Box', ({ theme, props }) => ({
  width: 6,
  height: 40,
  borderRadius: 3,
  backgroundColor: theme.color.primary,
  animation: `${eq} ${700 + props.i * 90}ms ease-in-out ${props.i * 110}ms infinite alternate`,
}));

// ───────────── 4 · "digitando…": vários quadros no mesmo seletor ─────────────
const bounce = keyframes({
  '0%, 80%, 100%': { transform: 'translateY(0px)', opacity: 0.4 },
  '40%': { transform: 'translateY(-10px)', opacity: 1 },
});

const Dot = engine<'Box', { i: number }>('Box', ({ theme, props }) => ({
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: theme.color.muted,
  animation: `${bounce} 1s ease-in-out ${props.i * 160}ms infinite`,
}));

// ───────────── 5 · skeleton com shimmer ─────────────
const shimmer = keyframes({
  from: { transform: 'translateX(-160px)' },
  to: { transform: 'translateX(320px)' },
});

const SkeletonTrack = engine('Box', ({ theme }) => ({
  transition: themeFade(),
  height: 14,
  width: '100%',
  borderRadius: 7,
  overflow: 'hidden',
  backgroundColor: theme.color.border,
}));

const Glow = engine('Box', {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 120,
  height: 14,
  backgroundColor: 'rgba(255, 255, 255, 0.55)',
  animation: `${shimmer} 1.4s ease-in-out infinite`,
});

// ───────────── 6 · entrada em cascata: cubic-bezier + delay + fill-mode both ─────────────
const fadeUp = keyframes({
  from: { opacity: 0, transform: 'translateY(24px) scale(0.96)' },
  to: { opacity: 1, transform: 'translateY(0px) scale(1)' },
});

const Reveal = engine<'Box', { i: number }>('Box', ({ theme, props }) => ({
  paddingBlock: theme.spacing.sm,
  paddingInline: theme.spacing.md,
  borderRadius: 12,
  backgroundColor: theme.color.background,
  borderWidth: 1,
  borderColor: theme.color.border,
  // `both`: invisível durante o delay e mantém o último quadro ao terminar
  animation: `${fadeUp} 600ms cubic-bezier(0.2, 0.8, 0.2, 1) ${props.i * 120}ms both`,
}));

const Stage = engine('Box', { alignItems: 'center', justifyContent: 'center', width: 72, height: 72 });
const Cell = engine('Box', ({ theme }) => ({ gap: theme.spacing.sm }));

export function AnimationLab() {
  const [run, setRun] = useState(0);

  return (
    <Card testID="animation-lab">
      <Heading>Laboratório de animações</Heading>
      <Body muted>keyframes() + animation: o mesmo código vira @keyframes na web e Animated no mobile.</Body>

      <Row wrap>
        <Cell>
          <Body muted>rotação</Body>
          <Stage>
            <Ring testID="anim-ring" />
          </Stage>
        </Cell>

        <Cell>
          <Body muted>órbita + núcleo</Body>
          <Stage>
            <OrbitBox testID="anim-orbit">
              {SATELLITES.map((_, n) => (
                <Satellite key={n} n={n as 0 | 1 | 2} />
              ))}
            </OrbitBox>
            <Core testID="anim-core" />
          </Stage>
        </Cell>

        <Cell>
          <Body muted>equalizador</Body>
          <Row>
            {[0, 1, 2, 3, 4].map((i) => (
              <Bar key={i} i={i} testID={`anim-bar-${i}`} />
            ))}
          </Row>
        </Cell>

        <Cell>
          <Body muted>digitando…</Body>
          <Row>
            {[0, 1, 2].map((i) => (
              <Dot key={i} i={i} />
            ))}
          </Row>
        </Cell>
      </Row>

      <Body muted>shimmer (skeleton)</Body>
      <SkeletonTrack>
        <Glow testID="anim-glow" />
      </SkeletonTrack>

      <Row between>
        {/* flex: 1 deixa o texto quebrar de linha em vez de empurrar o botão para fora da tela */}
        <Body muted style={{ flex: 1 }}>
          entrada em cascata (delay + cubic-bezier + fill both)
        </Body>
        <Button size="sm" variant="secondary" onPress={() => setRun((r) => r + 1)} testID="replay">
          <ButtonLabel>↻ Replay</ButtonLabel>
        </Button>
      </Row>
      {/* trocar a `key` remonta os itens e a animação de entrada roda de novo */}
      <Cell key={run}>
        {['Design tokens', 'Componentes universais', 'Uma só config'].map((label, i) => (
          <Reveal key={label} i={i} testID={`anim-reveal-${i}`}>
            <Body>{label}</Body>
          </Reveal>
        ))}
      </Cell>
    </Card>
  );
}
