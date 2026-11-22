/**
 * The home page's 3D stage, drawn with Isoform itself: an "Iso" cube in the middle, a browser window and a
 * phone around it, each in an exploded view that opens and closes. The card inside both devices is the very
 * same component (`HeroCard`): press Deploy in one and the other follows.
 */
import '../demos/setup';
import { useEffect, useRef, useState } from 'react';
import { engine, keyframes } from 'react-isoform';
import { HeroCard } from './HeroCard';

/** Design size of the scene; the whole stage is scaled to fit the page. */
const W = 1000;
const H = 560;

/* ---------------------------------------------------------------- motion */

const float = keyframes({ from: { transform: 'translateY(0px)' }, to: { transform: 'translateY(-16px)' } });
const sway = keyframes({ from: { transform: 'rotateY(-10deg)' }, to: { transform: 'rotateY(10deg)' } });
const spin = keyframes({
  from: { transform: 'rotateX(-24deg) rotateY(0deg)' },
  to: { transform: 'rotateX(-24deg) rotateY(360deg)' },
});
const orbitA = keyframes({
  from: { transform: 'rotateX(74deg) rotateZ(0deg)' },
  to: { transform: 'rotateX(74deg) rotateZ(360deg)' },
});
const orbitB = keyframes({
  from: { transform: 'rotateY(62deg) rotateX(60deg) rotateZ(360deg)' },
  to: { transform: 'rotateY(62deg) rotateX(60deg) rotateZ(0deg)' },
});
/** Exploded view: the layers drift apart in depth, hold, and come back together. */
const explode = (depth: number) =>
  keyframes({
    '0%, 12%': { transform: 'translateZ(0px)' },
    '42%, 64%': { transform: `translateZ(${depth}px)` },
    '94%, 100%': { transform: 'translateZ(0px)' },
  });
const explodeA = explode(48);
const explodeB = explode(96);
const explodeC = explode(160);
const gridMove = keyframes({ from: { backgroundPosition: '0px 0px' }, to: { backgroundPosition: '0px 64px' } });
const beam = keyframes({ from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-100% 0' } });
const rise = keyframes({
  '0%': { transform: 'translateY(0px)', opacity: 0 },
  '15%': { opacity: 1 },
  '100%': { transform: 'translateY(-210px)', opacity: 0 },
});
const burst = keyframes({ from: { transform: 'scale(0.25)', opacity: 0.95 }, to: { transform: 'scale(6)', opacity: 0 } });
const glow = keyframes({ from: { opacity: 0.4, transform: 'scale(1)' }, to: { opacity: 0.85, transform: 'scale(1.14)' } });
const scan = keyframes({ from: { transform: 'translateY(-10px)' }, to: { transform: 'translateY(240px)' } });

/* ------------------------------------------------------------- primitives */

const Stage = engine('Box', {
  position: 'relative',
  width: '100%',
  overflow: 'hidden',
  touchAction: 'pan-y',
  userSelect: 'none',
  // Fades the scene into the page instead of cutting it with a straight edge (visible on the light theme).
  maskImage: 'radial-gradient(ellipse 80% 84% at 50% 48%, #000 60%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(ellipse 80% 84% at 50% 48%, #000 60%, transparent 100%)',
});

/** The fixed-size design canvas, scaled and centered by the stage. */
const Canvas = engine('Box', {
  position: 'absolute',
  top: 0,
  left: '50%',
  width: W,
  height: H,
  marginLeft: -W / 2,
  transformOrigin: '50% 0%',
  perspective: 1500,
  perspectiveOrigin: '46% 38%',
  // Everything is decoration and ignores the pointer: only the two cards opt back in (the spinning rings
  // would otherwise sit in front of the buttons and swallow the clicks).
  pointerEvents: 'none',
});

/** A positioned layer that keeps its children in 3D. Place it with the `style` prop. */
const Layer = engine('Box', { position: 'absolute', transformStyle: 'preserve-3d' });

const Sway = engine('Box', {
  position: 'absolute',
  inset: 0,
  transformStyle: 'preserve-3d',
  animation: `${sway} 11s ease-in-out infinite alternate`,
});

const Floating = engine<'Box', { delay?: string }>('Box', ({ props }) => ({
  position: 'absolute',
  transformStyle: 'preserve-3d',
  animation: `${float} 5s ease-in-out ${props.delay ?? '0s'} infinite alternate`,
}));

const Glow = engine('Box', {
  position: 'absolute',
  borderRadius: 999,
  animation: `${glow} 5s ease-in-out infinite alternate`,
});

const Badge = engine('Box', {
  position: 'absolute',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingBlock: 5,
  paddingInline: 11,
  borderRadius: 99,
  borderWidth: 1,
  borderColor: 'rgba(165,180,252,.45)',
  backgroundColor: 'rgba(30,27,75,.78)',
  boxShadow: '0 8px 24px rgba(99,102,241,.35)',
});

const BadgeText = engine('Text', { color: '#e0e7ff', fontSize: 11, fontWeight: '700', letterSpacing: '0.04em' });

/* -------------------------------------------------------------------- floor */

const Floor = engine('Box', {
  position: 'absolute',
  left: -330,
  top: 392,
  width: 1660,
  height: 980,
  transformOrigin: '50% 0%',
  transform: 'rotateX(78deg)',
  backgroundImage:
    'linear-gradient(rgba(129,140,248,.55) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(129,140,248,.55) 1.5px, transparent 1.5px)',
  backgroundSize: '64px 64px',
  animation: `${gridMove} 2.6s linear infinite`,
  maskImage: 'radial-gradient(ellipse 50% 46% at 50% 14%, #000 18%, transparent 72%)',
  WebkitMaskImage: 'radial-gradient(ellipse 50% 46% at 50% 14%, #000 18%, transparent 72%)',
});

/* --------------------------------------------------------------------- cube */

const FACES = [
  { label: 'WEB', transform: 'translateZ(36px)' },
  { label: 'iOS', transform: 'rotateY(90deg) translateZ(36px)' },
  { label: 'ISO', transform: 'rotateY(180deg) translateZ(36px)' },
  { label: 'ANDROID', transform: 'rotateY(-90deg) translateZ(36px)' },
  { label: 'DOM', transform: 'rotateX(90deg) translateZ(36px)' },
  { label: 'NATIVE', transform: 'rotateX(-90deg) translateZ(36px)' },
];

const Face = engine('Box', {
  position: 'absolute',
  inset: 0,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: 'rgba(199,210,254,.85)',
  backgroundImage: 'linear-gradient(135deg, rgba(79,70,229,.78), rgba(8,145,178,.5))',
  boxShadow: 'inset 0 0 22px rgba(165,180,252,.55)',
  backfaceVisibility: 'visible',
});

const FaceText = engine('Text', { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: '0.1em' });

const Ring = engine<'Box', { variant: 'a' | 'b' }>('Box', ({ props }) => ({
  position: 'absolute',
  borderRadius: 999,
  borderWidth: 1.5,
  borderColor: props.variant === 'a' ? 'rgba(129,140,248,.8)' : 'rgba(34,211,238,.7)',
  animation: `${props.variant === 'a' ? orbitA : orbitB} ${props.variant === 'a' ? 9 : 13}s linear infinite`,
}));

const Satellite = engine('Box', {
  position: 'absolute',
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: '#fff',
  boxShadow: '0 0 14px 3px rgba(165,180,252,.95)',
});

function IsoCube() {
  return (
    <Floating delay="-1.2s" style={{ left: 503, top: 238, width: 72, height: 72 }}>
      <Layer style={{ inset: 0, animation: `${spin} 16s linear infinite` }}>
        {FACES.map((face) => (
          <Face key={face.label} style={{ transform: face.transform }}>
            <FaceText>{face.label}</FaceText>
          </Face>
        ))}
      </Layer>
      <Ring variant="a" style={{ left: -58, top: -58, width: 188, height: 188 }}>
        <Satellite style={{ left: 89, top: -5 }} />
      </Ring>
      <Ring variant="b" style={{ left: -88, top: -88, width: 248, height: 248 }}>
        <Satellite style={{ left: 119, top: -5, backgroundColor: '#67e8f9' }} />
      </Ring>
    </Floating>
  );
}

/* ---------------------------------------------------------------- particles */

/** A tiny deterministic generator, so the particles are the same on every load. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: 40 + rand(i + 1) * 920,
  top: 250 + rand(i + 40) * 230,
  size: 2 + rand(i + 80) * 3.5,
  duration: 5 + rand(i + 120) * 6,
  delay: -rand(i + 160) * 10,
  z: -120 + rand(i + 200) * 360,
}));

const Particle = engine('Box', { position: 'absolute', borderRadius: 99, backgroundColor: '#c7d2fe' });

/* ------------------------------------------------------------------ devices */

const Body = engine('Box', {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  backgroundColor: '#0d1020',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,.14)',
  boxShadow: '0 30px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(99,102,241,.25)',
});

const Skeleton = engine('Box', { height: 8, borderRadius: 4, backgroundColor: 'rgba(148,163,184,.22)' });

const Dot = engine('Box', { width: 9, height: 9, borderRadius: 5 });

const Scanline = engine('Box', {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: 'rgba(129,140,248,.55)',
  boxShadow: '0 0 18px 4px rgba(129,140,248,.6)',
  animation: `${scan} 4.5s ease-in-out infinite alternate`,
});

type DeviceProps = { live: boolean; onPress: () => void };

function BrowserWindow({ live, onPress }: DeviceProps) {
  return (
    <Floating className="iso-float" delay="-2.2s" style={{ left: 66, top: 142, width: 400, height: 262 }}>
      <Layer style={{ inset: 0, transform: 'rotateY(27deg) rotateX(5deg)' }}>
        <Glow style={{ left: -40, top: -30, width: 480, height: 330, backgroundImage: 'radial-gradient(closest-side, rgba(99,102,241,.5), transparent)', transform: 'translateZ(-60px)' }} />
        <Body style={{ borderRadius: 14 }}>
          <Layer style={{ left: 0, right: 0, top: 0, height: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingInline: 12, backgroundColor: 'rgba(255,255,255,.05)' }}>
            <Dot style={{ backgroundColor: '#fb7185' }} />
            <Dot style={{ backgroundColor: '#fbbf24' }} />
            <Dot style={{ backgroundColor: '#4ade80' }} />
            <Layer style={{ position: 'relative', marginLeft: 14, flex: 1, maxWidth: 190, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.08)', justifyContent: 'center', paddingInline: 9 }}>
              <BadgeText style={{ fontWeight: '500', letterSpacing: 0 }}>example.com/app</BadgeText>
            </Layer>
          </Layer>
          <Scanline style={{ top: 30 }} />
        </Body>
        <Layer style={{ left: 0, right: 0, top: 30, bottom: 0, pointerEvents: 'auto', animation: `${explodeA} 9s ease-in-out infinite` }}>
          <Layer style={{ left: 16, top: 22, width: 78, gap: 10 }}>
            <Skeleton style={{ width: '90%' }} />
            <Skeleton style={{ width: '70%' }} />
            <Skeleton style={{ width: '82%' }} />
            <Skeleton style={{ width: '58%' }} />
          </Layer>
          <Layer style={{ left: 120, right: 22, top: 26, bottom: 16, justifyContent: 'center' }}>
            <HeroCard live={live} onPress={onPress} />
          </Layer>
        </Layer>
        <Badge style={{ right: -26, top: -16, animation: `${explodeC} 9s ease-in-out infinite` }}>
          <BadgeText>DOM · ATOMIC CSS</BadgeText>
        </Badge>
        <Badge style={{ left: -22, bottom: -14, animation: `${explodeB} 9s ease-in-out infinite` }}>
          <BadgeText>React DOM</BadgeText>
        </Badge>
      </Layer>
    </Floating>
  );
}

function Phone({ live, onPress }: DeviceProps) {
  return (
    <Floating className="iso-float" delay="-0.4s" style={{ left: 622, top: 104, width: 196, height: 372 }}>
      <Layer style={{ inset: 0, transform: 'rotateY(-27deg) rotateX(5deg)' }}>
        <Glow style={{ left: -50, top: -30, width: 296, height: 432, backgroundImage: 'radial-gradient(closest-side, rgba(34,211,238,.42), transparent)', transform: 'translateZ(-60px)' }} />
        <Body style={{ borderRadius: 36, borderWidth: 6, borderColor: '#262b3d' }}>
          <Layer style={{ left: '50%', top: 7, width: 64, height: 16, marginLeft: -32, borderRadius: 9, backgroundColor: '#05060b' }} />
          <Scanline style={{ top: 30 }} />
        </Body>
        <Layer style={{ left: 7, right: 7, top: 7, bottom: 7, borderRadius: 30, pointerEvents: 'auto', animation: `${explodeA} 9s ease-in-out infinite` }}>
          <Layer style={{ left: 18, right: 18, top: 38, gap: 9 }}>
            <Skeleton style={{ width: '46%', height: 11 }} />
            <Skeleton style={{ width: '72%' }} />
          </Layer>
          <Layer style={{ left: 10, right: 10, top: 108, justifyContent: 'center' }}>
            <HeroCard live={live} onPress={onPress} />
          </Layer>
          <Layer style={{ left: '50%', bottom: 8, width: 64, height: 4, marginLeft: -32, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.4)' }} />
        </Layer>
        <Badge style={{ left: -64, bottom: 6, animation: `${explodeC} 9s ease-in-out infinite` }}>
          <BadgeText>UIKit · COMPOSE</BadgeText>
        </Badge>
        <Badge style={{ right: -34, top: 30, animation: `${explodeB} 9s ease-in-out infinite` }}>
          <BadgeText>React Native</BadgeText>
        </Badge>
      </Layer>
    </Floating>
  );
}

/** Light running from the cube to each device. */
const Beam = engine('Box', {
  position: 'absolute',
  height: 3,
  borderRadius: 2,
  backgroundImage: 'linear-gradient(90deg, transparent 0%, #a5b4fc 40%, #fff 50%, #67e8f9 60%, transparent 100%)',
  backgroundSize: '300% 100%',
  filter: 'drop-shadow(0 0 6px rgba(165,180,252,.9))',
  animation: `${beam} 1.6s linear infinite`,
});

/* -------------------------------------------------------------------- stage */

export default function Hero3D() {
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [live, setLive] = useState(false);
  const [bursts, setBursts] = useState(0);

  const onPress = () => {
    setLive((value) => !value);
    setBursts((count) => count + 1); // a new key restarts the shock wave
  };

  // Fit the fixed-size canvas to the page width.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    // On narrow screens the empty margins of the canvas are cropped, so the devices stay readable.
    const fit = () => setScale(Math.min(1.12, node.clientWidth / (node.clientWidth < 640 ? 840 : W)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The stage is decoration: keep its buttons out of the tab order (the code button below is the real control).
  useEffect(() => {
    stage.current?.querySelectorAll<HTMLElement>('[tabindex], button, [role="button"]').forEach((el) => {
      el.tabIndex = -1;
    });
  });

  // Pointer parallax: the whole rig leans toward the pointer, eased every frame.
  useEffect(() => {
    const node = stage.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    const tick = () => {
      current.x += (target.x - current.x) * 0.07;
      current.y += (target.y - current.y) * 0.07;
      if (rig.current) rig.current.style.transform = `rotateX(${(-current.y * 9).toFixed(2)}deg) rotateY(${(current.x * 16).toFixed(2)}deg)`;
      frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      target.x = ((event.clientX - box.left) / box.width - 0.5) * 2;
      target.y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    };
    const leave = () => {
      target.x = 0;
      target.y = 0;
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <Stage ref={stage as never} className="iso-hero" style={{ height: H * scale }} aria-hidden="true">
      {/* The artwork sits a little left of the canvas center: shift it back. */}
      <Canvas style={{ transform: `translateX(${58 * scale}px) scale(${scale})` }}>
        <Glow style={{ left: 250, top: 70, width: 500, height: 400, backgroundImage: 'radial-gradient(closest-side, rgba(99,102,241,.38), transparent)', filter: 'blur(20px)' }} />
        <Layer ref={rig as never} style={{ inset: 0, willChange: 'transform' }}>
          <Sway className="iso-sway">
            <Floor />
            {PARTICLES.map((particle, index) => (
              <Particle
                key={index}
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  transform: `translateZ(${particle.z}px)`,
                  animation: `${rise} ${particle.duration}s linear ${particle.delay}s infinite`,
                }}
              />
            ))}
            <Beam style={{ left: 458, top: 273, width: 50 }} />
            <Beam style={{ left: 582, top: 273, width: 46, animationDirection: 'reverse' }} />
            <IsoCube />
            {bursts > 0 && (
              <Layer
                key={bursts}
                style={{ left: 521, top: 256, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#a5b4fc', animation: `${burst} 1.1s ease-out forwards` }}
              />
            )}
            <BrowserWindow live={live} onPress={onPress} />
            <Phone live={live} onPress={onPress} />
          </Sway>
        </Layer>
      </Canvas>
    </Stage>
  );
}
