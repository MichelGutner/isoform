import './setup';
import { useState } from 'react';
import { engine } from 'react-isoform';
import { Caption, Stack } from './kit';

const Pad = engine('Box', ({ theme }) => ({
  width: 96,
  height: 96,
  borderRadius: 20,
  backgroundColor: theme.color.primary,
  alignItems: 'center',
  justifyContent: 'center',
})).gesture({
  pan: { release: 'decay', rubberBand: true, bounds: { left: 120, right: 120, top: 40, bottom: 40 } },
  pinch: { release: 'stay', minScale: 0.6, maxScale: 2.5 },
  rotate: { release: 'stay' },
  doubleTap: true,
  longPress: true,
  // fainter the farther it is dragged sideways
  interpolate: [{ from: 'x', input: [-120, 0, 120], style: { opacity: [0.5, 1, 0.5] } }],
});

const Stage = engine('Box', ({ theme }) => ({
  height: 160,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: theme.color.border,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}));

export default function GesturesDemo() {
  const [last, setLast] = useState('Nothing yet');
  return (
    <Stack>
      <Stage>
        <Pad
          onPan={(e) => e.phase === 'end' && setLast(`dragged to ${Math.round(e.translationX)}, ${Math.round(e.translationY)}`)}
          onPinch={(e) => e.phase === 'end' && setLast(`pinched ×${e.scale.toFixed(2)}`)}
          onRotate={(e) => e.phase === 'end' && setLast(`rotated ${Math.round((e.rotation * 180) / Math.PI)}°`)}
          onDoubleTap={() => setLast('double tap')}
          onLongPress={() => setLast('long press')}
        />
      </Stage>
      <Caption>Last event: {last}</Caption>
    </Stack>
  );
}
