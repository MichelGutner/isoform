import { useEffect, useRef, useState } from 'react';
import { engine, type CameraCode, type CameraFacing, type CameraFlash, type CameraHandle } from 'react-isoform';
import { Body, Button, ButtonLabel, Row, themeFade } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';

/** The preview: it fills this box (cropping like `cover`); the controls are its children. */
const Preview = engine('Camera', ({ theme }) => ({
  width: '100%',
  height: 420,
  borderRadius: theme.borderRadius?.lg ?? 20,
}));

/** The bar over the bottom of the preview. */
const Bar = engine('Box', {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  paddingBlock: 16,
  paddingInline: 20,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
});

/** The shutter: white ring, red center while recording. */
const Shutter = engine<'Pressable', { recording?: boolean }>('Pressable', ({ props }) => ({
  transition: 'transform 100ms',
  width: 72,
  height: 72,
  borderRadius: 36,
  borderWidth: 4,
  borderColor: '#ffffff',
  backgroundColor: props.recording ? '#ef4444' : 'rgba(255,255,255,0.35)',
}))
  .attrs({ role: 'button' })
  .when('state:pressed', { style: { transform: 'scale(0.92)' } })
  .when('platform:web', { style: { cursor: 'pointer' } });

/** Round buttons on the preview (flip, zoom). */
const Round = engine<'Pressable', { active?: boolean }>('Pressable', ({ props }) => ({
  transition: themeFade(),
  minWidth: 44,
  height: 44,
  paddingInline: 10,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: props.active ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)',
}))
  .attrs({ role: 'button' })
  .when('platform:web', { style: { cursor: 'pointer' } });

const RoundLabel = engine<'Text', { active?: boolean }>('Text', ({ props }) => ({
  fontSize: 14,
  fontWeight: '700',
  color: props.active ? '#000000' : '#ffffff',
}));

const ZoomRow = engine('Box', {
  position: 'absolute',
  top: 12,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
});

const Badge = engine('Box', {
  position: 'absolute',
  top: 64,
  alignSelf: 'center',
  paddingBlock: 4,
  paddingInline: 10,
  borderRadius: 999,
  backgroundColor: '#ef4444',
});

const BadgeLabel = engine('Text', { color: '#ffffff', fontWeight: '700', fontSize: 13 });

const Thumb = engine('Image', ({ theme }) => ({
  width: 120,
  height: 160,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.border,
}));

const ZOOMS = [0.5, 1, 2] as const;
const FLASHES = ['off', 'auto', 'on'] as const;

/** Seconds as `0:07`. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Camera: a full camera screen drawn with isoform over the native preview. */
export function CameraPage() {
  const camera = useRef<CameraHandle>(null);
  const [active, setActive] = useState(true);
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<CameraFlash>('off');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [scan, setScan] = useState(false);
  const [codes, setCodes] = useState<CameraCode[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { events, log } = useEventLog(8);

  useEffect(() => {
    if (recordingSince === null) return undefined;
    const timer = setInterval(() => setElapsed((Date.now() - recordingSince) / 1000), 250);
    return () => clearInterval(timer);
  }, [recordingSince]);

  const shoot = async () => {
    try {
      if (mode === 'photo') {
        const taken = await camera.current!.takePhoto();
        setPhoto(taken.uri);
        log(`photo ${taken.width}×${taken.height}`);
      } else if (recordingSince === null) {
        await camera.current!.startRecording();
        setElapsed(0);
        setRecordingSince(Date.now());
        log('recording…');
      } else {
        const video = await camera.current!.stopRecording();
        setRecordingSince(null);
        log(`video ${video.duration.toFixed(1)} s → ${video.uri.slice(-28)}`);
      }
    } catch (error) {
      setRecordingSince(null);
      log(`error: ${(error as Error).message}`);
    }
  };

  return (
    <PageShell
      title="Camera"
      summary="The device camera with your own interface on top: CameraX with the Jetpack Compose viewfinder on Android, AVFoundation on iOS, getUserMedia on the web. Pinch to zoom, tap to focus."
    >
      <Section title="Camera screen" hint="Everything over the preview is regular isoform components passed as children.">
        <Preview
          ref={camera}
          active={active}
          facing={facing}
          flash={flash}
          torch={torch}
          zoom={zoom}
          onZoomChange={setZoom}
          video={mode === 'video'}
          onCodeScanned={scan ? setCodes : undefined}
          codeTypes={['qr', 'ean-13', 'code-128']}
          onReady={() => log('ready')}
          onError={(message) => log(`error: ${message}`)}
          onPermissionChange={({ camera: cam, microphone }) => log(`permission camera=${cam} mic=${microphone}`)}
          permissionMessage="The showcase needs the camera to demo photos, video and code scanning."
          testID="camera"
        >
          <ZoomRow>
            {ZOOMS.map((value) => (
              <Round key={value} active={Math.abs(zoom - value) < 0.05} onPress={() => setZoom(value)} aria-label={`Zoom ${value}×`}>
                <RoundLabel active={Math.abs(zoom - value) < 0.05}>{`${value}×`}</RoundLabel>
              </Round>
            ))}
          </ZoomRow>
          {recordingSince !== null ? (
            <Badge>
              <BadgeLabel>{`● ${clock(elapsed)}`}</BadgeLabel>
            </Badge>
          ) : null}
          <Bar>
            <Round onPress={() => setMode(mode === 'photo' ? 'video' : 'photo')} aria-label="Switch photo or video">
              <RoundLabel>{mode === 'photo' ? 'Photo' : 'Video'}</RoundLabel>
            </Round>
            <Shutter recording={recordingSince !== null} onPress={shoot} aria-label={mode === 'photo' ? 'Take photo' : 'Record'} testID="camera-shutter" />
            <Round onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} aria-label="Flip camera">
              <RoundLabel>Flip</RoundLabel>
            </Round>
          </Bar>
        </Preview>
        <Flags>
          <Flag label="active" on={active} onChange={setActive} />
          <Flag label="torch" on={torch} onChange={setTorch} />
          <Flag label="scan codes" on={scan} onChange={setScan} />
        </Flags>
        <Choice label="flash (photos)" value={flash} options={FLASHES} onChange={setFlash} />
      </Section>

      <Section title="Last photo" hint="takePhoto() resolves with a file:// URI on iOS/Android (a blob: URL on the web) and the upright size.">
        <Row wrap>
          {photo ? <Thumb src={photo} alt="Last photo" /> : <Body muted>Take a photo with the shutter.</Body>}
        </Row>
      </Section>

      <Section title="Code scanner" hint="onCodeScanned turns the scanner on; it fires when the codes in sight change. Needs camera.codeScanner in the config.">
        <Body muted={!codes.length}>
          {scan ? (codes.length ? codes.map((code) => `${code.type}: ${code.value}`).join('\n') : 'Point at a QR code…') : 'Turn on "scan codes" above.'}
        </Body>
        {codes.length ? (
          <Button size="sm" variant="secondary" onPress={() => setCodes([])}>
            <ButtonLabel>Clear</ButtonLabel>
          </Button>
        ) : null}
      </Section>

      <Section title="Events">
        <EventLog events={events} />
      </Section>

      <Section title="In code">
        <Code>{`
// isoform.config.json
{ "modules": { "camera": { "enabled": true, "video": true, "codeScanner": true } } }

const Preview = engine('Camera', { width: '100%', height: 420, borderRadius: 20 });
const camera = useRef<CameraHandle>(null);

<Preview ref={camera} facing="back" zoom={zoom} onZoomChange={setZoom}
  permissionMessage="We need the camera to scan your ticket."
  onCodeScanned={(codes) => …}>
  <Shutter onPress={async () => setPhoto(await camera.current!.takePhoto())} />
</Preview>

// video (needs video): await camera.current.startRecording(); … await camera.current.stopRecording()
        `}</Code>
      </Section>
    </PageShell>
  );
}
