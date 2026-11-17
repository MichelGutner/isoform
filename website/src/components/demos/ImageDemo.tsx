import './setup';
import { useRef } from 'react';
import { engine, type ImageHandle } from '@michelgutner/isoform';
import { asset, Button, ButtonText, Row, Stack } from './kit';

const Photo = engine('Image', { width: '100%', maxWidth: 480, height: 240, borderRadius: 20 });

export default function ImageDemo() {
  const viewer = useRef<ImageHandle>(null);
  return (
    <Stack>
      <Photo
        ref={viewer}
        src={asset('photo.jpg')}
        alt="A colorful gradient"
        blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
        contentFit="cover"
        transition={300}
        zoomable
        maxZoom={5}
      />
      <Row>
        <Button onPress={() => viewer.current?.zoomTo(2)}>
          <ButtonText>Zoom 2×</ButtonText>
        </Button>
        <Button variant="ghost" onPress={() => viewer.current?.resetZoom()}>
          <ButtonText ghost>Reset</ButtonText>
        </Button>
      </Row>
    </Stack>
  );
}
