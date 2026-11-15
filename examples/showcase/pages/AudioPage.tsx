import { useState } from 'react';
import { engine } from 'omnistyle';
import { Body } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';
import { LISTS, picture, song } from '../media';

/** `engine('Audio')`: a compact player card (cover, title, progress, speed, mute). */
const Player = engine('Audio', { width: '100%' });

/** Audio: a player card, background playback with system controls, and a playlist. */
export function AudioPage() {
  const [source, setSource] = useState<'single' | 'playlist'>('single');
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const { events, log } = useEventLog();

  return (
    <PageShell title="Audio" summary="A compact card on every platform. On iOS and Android it keeps playing in the background with lock-screen and notification controls.">
      <Section title="Player" hint="Single track or a playlist (the list button opens a carousel with the covers).">
        <Player
          src={source === 'single' ? song(1) : undefined}
          title="Song 1"
          artist="SoundHelix"
          artwork={picture('omni-a1', 600, 600)}
          items={source === 'playlist' ? LISTS.audios : undefined}
          loop={loop}
          muted={muted}
          onItemChange={({ index, item }) => log(`item ${index + 1}: ${item.title ?? item.src}`)}
          onPlay={() => log('play')}
          onPause={() => log('pause')}
          onEnded={() => log('ended')}
          onRateChange={(rate) => log(`rate ${rate}x`)}
          onError={(message) => log(`error ${message}`)}
        />
        <Choice label="Source" value={source} options={['single', 'playlist'] as const} onChange={setSource} />
        <Flags>
          <Flag label="loop" on={loop} onChange={setLoop} />
          <Flag label="muted" on={muted} onChange={setMuted} />
        </Flags>
        <Body muted>Background playback needs audio.mediaSession in omnistyle.config.json (this app has it on).</Body>
      </Section>

      <Section title="Events">
        <EventLog events={events} />
      </Section>

      <Section title="In code">
        <Code>{`
const Player = engine('Audio', { width: '100%' });

<Player src={url} title="Song" artist="Band" artwork={cover} />

<Player items={[{ src, title, artist, artwork }, …]} autoAdvance />
        `}</Code>
      </Section>
    </PageShell>
  );
}
