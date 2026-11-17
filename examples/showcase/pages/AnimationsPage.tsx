import { AnimationLab } from '../demos/Animations';
import { Code, PageShell, Section } from '../kit';

/** `keyframes()` + `animation`: @keyframes on the web, Animated on mobile. */
export function AnimationsPage() {
  return (
    <PageShell title="Animations" summary="Declare keyframes once; the web gets CSS @keyframes and mobile gets Animated (native driver when possible).">
      <AnimationLab />
      <Section title="In code">
        <Code>{`
const spin = keyframes({ to: { transform: 'rotate(360deg)' } });

const Ring = engine('Box', {
  width: 44, height: 44,
  animation: \`\${spin} 1800ms linear infinite\`,
});
        `}</Code>
      </Section>
    </PageShell>
  );
}
