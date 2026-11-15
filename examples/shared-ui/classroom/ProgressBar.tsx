import { engine } from 'omnistyle';

const Track = engine('Box', {
  height: 6,
  borderRadius: 3,
  overflow: 'hidden',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
});

/** `value` vai de 0 a 1. A largura anima sozinha quando o valor muda. */
const Fill = engine<'Box', { value: number }>('Box', ({ props }) => ({
  height: 6,
  borderRadius: 3,
  backgroundColor: '#ffffff',
  width: `${Math.round(props.value * 100)}%`,
  transition: 'width 400ms ease-out',
}));

export function ProgressBar({ value }: { value: number }) {
  return (
    <Track>
      <Fill value={value} />
    </Track>
  );
}
