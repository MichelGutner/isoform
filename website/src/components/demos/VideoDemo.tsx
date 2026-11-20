import './setup';
import { useRef, useState } from 'react';
import { engine, type VideoHandle } from 'react-isoform';
import { asset, Button, ButtonText, Caption, Row, Stack } from './kit';

const Player = engine('Video', { width: '100%', maxWidth: 560, aspectRatio: 16 / 9, borderRadius: 16 });

export default function VideoDemo() {
  const player = useRef<VideoHandle>(null);
  const [time, setTime] = useState(0);
  return (
    <Stack>
      <Player
        ref={player}
        src={asset('clip.mp4')}
        poster={asset('poster.jpg')}
        muted
        onTimeUpdate={({ currentTime }) => setTime(currentTime)}
      />
      <Row>
        <Button onPress={() => player.current?.play()}>
          <ButtonText>Play</ButtonText>
        </Button>
        <Button variant="ghost" onPress={() => player.current?.seekTo(0)}>
          <ButtonText ghost>Back to start</ButtonText>
        </Button>
        <Caption>{time.toFixed(1)} s</Caption>
      </Row>
    </Stack>
  );
}
