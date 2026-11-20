import './setup';
import { useRef, useState } from 'react';
import { engine, type CameraCode, type CameraHandle } from 'react-isoform';
import { Button, ButtonText, Caption, Row, Stack } from './kit';

const Preview = engine('Camera', { width: '100%', maxWidth: 480, height: 320, borderRadius: 20 });
const Thumb = engine('Image', { width: 96, height: 72, borderRadius: 8 });

export default function CameraDemo() {
  const camera = useRef<CameraHandle>(null);
  const [on, setOn] = useState(false); // the browser asks for the camera only after this
  const [photo, setPhoto] = useState<string>();
  const [codes, setCodes] = useState<CameraCode[]>([]);
  return (
    <Stack>
      <Row>
        <Button onPress={() => setOn(!on)}>
          <ButtonText>{on ? 'Stop camera' : 'Start camera'}</ButtonText>
        </Button>
        {on && (
          <Button variant="ghost" onPress={async () => setPhoto((await camera.current!.takePhoto()).uri)}>
            <ButtonText ghost>Take photo</ButtonText>
          </Button>
        )}
        {photo && <Thumb src={photo} alt="Last photo" />}
      </Row>
      {on && (
        <Preview
          ref={camera}
          facing="front"
          permissionMessage="Allow the camera to try the example."
          onCodeScanned={setCodes} // needs camera.codeScanner (Chromium's BarcodeDetector on the web)
        />
      )}
      <Caption>{codes.length ? codes.map((c) => `${c.type}: ${c.value}`).join(', ') : 'Point it at a QR code.'}</Caption>
    </Stack>
  );
}
