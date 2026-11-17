import './setup';
import { useState } from 'react';
import { engine } from '@michelgutner/isoform';

const Icon = engine<'Svg', { done?: boolean }>('Svg', ({ theme }) => ({
  width: 48,
  height: 48,
  color: theme.color.muted,
})).when('props:done', ({ theme }) => ({ style: { color: theme.color.success } }));

const Ring = engine('Circle', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 });
const Check = engine('Path', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' });

const Logo = engine('Svg', { width: 120, height: 48 });
const Defs = engine('Defs');
const Gradient = engine('SvgLinearGradient');
const Stop = engine('Stop');
const Bar = engine('Rect', { fill: 'url(#iso-gradient)' });

const Row = engine('Box', { flexDirection: 'row', gap: 24, alignItems: 'center' });

export default function SvgDemo() {
  const [done, setDone] = useState(false);
  return (
    <Row>
      <Icon viewBox="0 0 24 24" done={done} onPress={() => setDone(!done)} aria-label="Toggle">
        <Ring cx={12} cy={12} r={10} />
        <Check d="M7 12.5l3.5 3.5L17 9" />
      </Icon>
      <Logo viewBox="0 0 120 48">
        <Defs>
          <Gradient id="iso-gradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" style={{ stopColor: '#6366f1' }} />
            <Stop offset="1" style={{ stopColor: '#ec4899' }} />
          </Gradient>
        </Defs>
        <Bar x={0} y={16} width={120} height={16} rx={8} />
      </Logo>
    </Row>
  );
}
