import { useRef, useState } from 'react';
import { clearImageCache, engine, prefetchImages, type ImageContentFit, type ImageContentPosition, type ImageHandle } from 'isoform';
import { Body, Button, ButtonLabel, Row } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';

/** The pictures of the page (public, stable URLs). */
const PHOTO = 'https://picsum.photos/id/1015/1600/1067';
const PHOTO_BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
const TALL = 'https://picsum.photos/id/1025/900/1350';
const ANIMATED = 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif';
const ICON = 'https://raw.githubusercontent.com/github/explore/main/topics/react/react.png';
const NEXT_PAGE = [1016, 1018, 1019, 1020].map((id) => `https://picsum.photos/id/${id}/1200/800`);

/** A picture box: rounded, clipped, with the theme's border. */
const Picture = engine('Image', ({ theme }) => ({
  alignSelf: 'stretch',
  maxWidth: 480,
  height: 240,
  borderRadius: theme.borderRadius?.lg ?? 20,
  backgroundColor: theme.color.border,
}));

const Small = engine('Image', ({ theme }) => ({
  width: 96,
  height: 96,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.border,
}));

const FITS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'] as const;

/** Image: the lib's own pipeline (caches, blurhash, crossfade, zoom) on every platform. */
export function ImagePage() {
  const [fit, setFit] = useState<ImageContentFit>('cover');
  const [position, setPosition] = useState<ImageContentPosition>('center');
  const [attempt, setAttempt] = useState(0);
  const [blur, setBlur] = useState(false);
  const [tint, setTint] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [rotatable, setRotatable] = useState(true);
  const [zoom, setZoom] = useState('1.00×');
  const [prefetched, setPrefetched] = useState('');
  const viewer = useRef<ImageHandle>(null);
  const animated = useRef<ImageHandle>(null);
  const { events, log } = useEventLog();

  return (
    <PageShell
      title="Image"
      summary="With the image module on, Image is the lib's own picture: memory and disk caches, blurhash placeholders, crossfade, tint, blur, animated GIF/WebP and a zoomable viewer — the same pipeline design on iOS (URLSession + ImageIO) and Android (OkHttp + ImageDecoder), and <img> on the web."
    >
      <Section title="Loading" hint="A blurhash shows at once; the photo fades in over it. Reload skips the caches.">
        <Picture
          key={attempt}
          src={PHOTO}
          blurhash={PHOTO_BLURHASH}
          alt="Mountain lake"
          contentFit={fit}
          contentPosition={position}
          blurRadius={blur ? 12 : 0}
          transition={400}
          cachePolicy={attempt ? 'none' : 'memory-disk'}
          onLoadStart={() => log('loadStart')}
          onProgress={({ loaded, total }) => total && log(`progress ${Math.round((loaded / total) * 100)}%`)}
          onLoad={({ width, height, cacheType }) => log(`load ${width}×${height} (${cacheType})`)}
          onError={({ message }) => log(`error: ${message}`)}
          testID="image-photo"
        />
        <Choice label="contentFit" value={fit} options={FITS} onChange={setFit} />
        <Choice label="contentPosition" value={position} options={POSITIONS} onChange={setPosition} />
        <Flags>
          <Flag label="blur" on={blur} onChange={setBlur} />
        </Flags>
        <Row wrap>
          <Button size="sm" onPress={() => setAttempt((n) => n + 1)}>
            <ButtonLabel>Reload from network</ButtonLabel>
          </Button>
          <Button size="sm" outlined onPress={() => clearImageCache().then(() => log('caches cleared'))}>
            <ButtonLabel outlined>Clear caches</ButtonLabel>
          </Button>
        </Row>
        <EventLog events={events} />
      </Section>

      <Section title="Viewer" hint="Pinch to zoom, drag while zoomed, double tap to zoom in and out, two fingers to rotate. Ctrl + wheel and double click on the web.">
        <Picture
          ref={viewer}
          src={TALL}
          alt="Forest"
          contentFit="contain"
          zoomable
          rotatable={rotatable}
          maxZoom={5}
          onZoomChange={({ scale, rotation }) => setZoom(`${scale.toFixed(2)}× · ${Math.round(rotation)}°`)}
          testID="image-viewer"
        />
        <Body muted>{zoom}</Body>
        <Flags>
          <Flag label="rotation gesture" on={rotatable} onChange={setRotatable} />
        </Flags>
        <Row wrap>
          <Button size="sm" onPress={() => viewer.current?.zoomTo(2.5)}>
            <ButtonLabel>Zoom 2.5×</ButtonLabel>
          </Button>
          <Button size="sm" onPress={() => viewer.current?.rotateTo(90)}>
            <ButtonLabel>Rotate 90°</ButtonLabel>
          </Button>
          <Button size="sm" outlined onPress={() => viewer.current?.resetZoom()}>
            <ButtonLabel outlined>Reset</ButtonLabel>
          </Button>
        </Row>
      </Section>

      <Section title="Animated and tinted" hint="GIF frames keep their own delays; play and pause through the ref. Tint paints every visible pixel.">
        <Row wrap>
          <Small ref={animated} src={ANIMATED} alt="Rotating earth" contentFit="contain" />
          <Small src={ICON} alt="React logo" contentFit="contain" tintColor={tint ? '#E8590C' : undefined} />
        </Row>
        <Flags>
          <Flag label="tint the icon" on={tint} onChange={setTint} />
        </Flags>
        <Button
          size="sm"
          onPress={() => {
            if (playing) animated.current?.pause();
            else animated.current?.play();
            setPlaying(!playing);
          }}
        >
          <ButtonLabel>{playing ? 'Pause GIF' : 'Play GIF'}</ButtonLabel>
        </Button>
      </Section>

      <Section title="Prefetch" hint="Downloads the next pictures before they are shown.">
        <Button
          size="sm"
          onPress={() => {
            setPrefetched('…');
            prefetchImages(NEXT_PAGE).then((ok) => setPrefetched(ok ? 'all cached' : 'some failed'));
          }}
        >
          <ButtonLabel>Prefetch 4 photos</ButtonLabel>
        </Button>
        {prefetched ? <Body muted>{prefetched}</Body> : null}
      </Section>

      <Section title="In code">
        <Code>{`
// isoform.config.json
{ "modules": { "image": true } }

const Photo = engine('Image', { height: 240, borderRadius: 20 });
const viewer = useRef<ImageHandle>(null);

<Photo src={{ uri: url, headers: { Authorization: token } }}
  blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
  contentFit="cover" contentPosition="top"
  transition={300} cachePolicy="memory-disk" priority="high"
  zoomable maxZoom={5} rotatable ref={viewer}
  onLoad={({ width, height, cacheType }) => {}} />

viewer.current?.zoomTo(2, { focusX: 100, focusY: 80 });
viewer.current?.resetZoom();
await prefetchImages([next1, next2]);
await clearImageCache({ disk: false });
        `}</Code>
      </Section>
    </PageShell>
  );
}
