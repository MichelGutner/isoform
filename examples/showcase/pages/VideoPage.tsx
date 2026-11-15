import { useState } from 'react';
import { engine } from 'omnistyle';
import { Body, Button, ButtonLabel, Row } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';
import { LISTS, VIDEOS, picture } from '../media';

/** `engine('Video')`: a <video> on the web, AVPlayer on iOS and Media3 on Android. */
const Player = engine('Video', ({ theme }) => ({
  width: '100%',
  aspectRatio: 16 / 9,
  borderRadius: theme.borderRadius?.lg,
  backgroundColor: '#000000',
}));

const RATES = ['0.5', '1', '1.5', '2'] as const;

/** Video: custom controls, fullscreen, picture-in-picture, speed and a playlist carousel. */
export function VideoPage() {
  const [source, setSource] = useState<'single' | 'playlist'>('single');
  const [controls, setControls] = useState(true);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>('1');
  const { events, log } = useEventLog();
  const seconds = (value: number) => `${value.toFixed(1)}s`;

  return (
    <PageShell title="Video" summary="One component, native players. Custom controls with fullscreen, picture-in-picture, speed and a playlist.">
      <Section title="Player" hint="Pass src for one video or items for a playlist: the controls get a list button that opens a carousel.">
        <Player
          src={source === 'single' ? VIDEOS.bunny : undefined}
          items={source === 'playlist' ? LISTS.videos : undefined}
          poster={source === 'single' ? picture('omni-v1', 640, 360) : undefined}
          controls={controls}
          loop={loop}
          muted={muted}
          rate={Number(rate)}
          onItemChange={({ index, item }) => log(`item ${index + 1}: ${item.title ?? item.src}`)}
          onLoad={({ duration, width, height }) => log(`load ${seconds(duration)} ${width}×${height}`)}
          onPlay={() => log('play')}
          onPause={() => log('pause')}
          onEnded={() => log('ended')}
          onSeek={({ from, to }) => log(`seek ${seconds(from)} → ${seconds(to)}`)}
          onRateChange={(value) => log(`rate ${value}x`)}
          onVolumeChange={({ volume, muted: isMuted }) => log(`volume ${volume.toFixed(2)}${isMuted ? ' (muted)' : ''}`)}
          onFullscreenChange={(fullscreen) => log(fullscreen ? 'fullscreen on' : 'fullscreen off')}
          onPictureInPictureChange={(active) => log(active ? 'pip on' : 'pip off')}
          onError={(message) => log(`error ${message}`)}
        />
        <Choice label="Source" value={source} options={['single', 'playlist'] as const} onChange={setSource} />
        <Choice label="Speed" value={rate} options={RATES} onChange={setRate} />
        <Flags>
          <Flag label="controls" on={controls} onChange={setControls} />
          <Flag label="loop" on={loop} onChange={setLoop} />
          <Flag label="muted" on={muted} onChange={setMuted} />
        </Flags>
      </Section>

      <Section title="Events" hint="What reaches your callbacks.">
        <EventLog events={events} />
      </Section>

      <Section title="In code">
        <Code>{`
const Player = engine('Video', { width: '100%', aspectRatio: 16 / 9 });

<Player src="https://…/video.mp4" poster={cover} onEnded={next} />

<Player
  items={[{ src, title, poster }, …]}
  carousel            // the list button + carousel (default)
  autoAdvance         // play the next one when it ends
  onItemChange={({ index, item }) => …}
/>
        `}</Code>
      </Section>
    </PageShell>
  );
}
