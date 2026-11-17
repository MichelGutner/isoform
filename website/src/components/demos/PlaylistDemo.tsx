import './setup';
import { useState } from 'react';
import { engine, type AudioItem } from '@michelgutner/isoform';
import { asset, Caption, Stack } from './kit';

const Player = engine('Audio', { width: '100%', maxWidth: 560 });

const items: AudioItem[] = [
  { src: asset('tone.mp3'), title: 'First tone', artist: 'Isoform docs', artwork: asset('photo.jpg') },
  { src: asset('tone.mp3'), title: 'Second tone', artist: 'Isoform docs', artwork: asset('poster.jpg') },
];

export default function PlaylistDemo() {
  const [current, setCurrent] = useState(0);
  return (
    <Stack>
      <Player items={items} onItemChange={({ index }) => setCurrent(index)} />
      <Caption>Now on entry {current + 1} of {items.length}. Use the playlist button in the player.</Caption>
    </Stack>
  );
}
