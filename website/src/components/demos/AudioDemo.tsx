import './setup';
import { engine } from 'isoform';
import { asset } from './kit';

const Player = engine('Audio', { width: '100%', maxWidth: 560 });

export default function AudioDemo() {
  return (
    <Player
      src={asset('tone.mp3')}
      title="A 330 Hz tone"
      artist="Isoform docs"
      artwork={asset('photo.jpg')}
    />
  );
}
