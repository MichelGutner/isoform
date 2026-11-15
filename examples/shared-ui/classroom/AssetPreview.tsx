import { useState } from 'react';
import { engine } from 'omnistyle';
import type { Asset } from './types';

/**
 * Conteúdo da aula por tipo. O vídeo usa o player real da lib (`engine('Video')`);
 * PDF e quiz ainda são placeholders.
 */

/* ───────────────────────── vídeo ───────────────────────── */

/**
 * O player de verdade: `engine('Video')` vira `<video>` na web e o componente
 * nativo da lib no mobile (AVPlayer no iOS, Media3 no Android).
 */
const Player = engine('Video', ({ theme }) => ({
  width: '100%',
  aspectRatio: 16 / 9,
  borderRadius: theme.borderRadius?.lg,
  backgroundColor: theme.color.brandDark,
}));

const VideoBox = engine('Box', ({ theme }) => ({ width: '100%', gap: theme.spacing.sm }));

const VideoStatus = engine<'Text', { error?: boolean }>('Text', ({ theme, props }) => ({
  fontSize: 13,
  color: props.error ? theme.color.error : theme.color.muted,
}));

const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const EventLog = engine('Box', ({ theme }) => ({
  gap: 2,
  padding: theme.spacing.sm,
  borderRadius: theme.borderRadius?.md,
  backgroundColor: theme.color.brandSurface,
}));

const EventLine = engine('Text', ({ theme }) => ({ fontSize: 12, color: theme.color.text, fontFamily: 'monospace' }));

/** Quantos eventos o registro mostra (os mais recentes primeiro). */
const LOG_SIZE = 6;

function VideoPreview({ src }: { src: string }) {
  const [time, setTime] = useState({ currentTime: 0, duration: 0 });
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  // Registro das ações do player, para testar de ponta a ponta o que chega ao JS.
  const log = (text: string) => setEvents((prev) => [text, ...prev].slice(0, LOG_SIZE));
  const s = (seconds: number) => `${seconds.toFixed(1)}s`;

  return (
    <VideoBox>
      <Player
        src={src}
        testID="video-player"
        onLoad={({ duration, width, height }) => {
          setTime({ currentTime: 0, duration });
          log(`load ${s(duration)} ${width}×${height}`);
        }}
        onTimeUpdate={setTime}
        onError={(message) => {
          setError(message);
          log(`error ${message}`);
        }}
        onPlay={() => log('play')}
        onPause={() => log('pause')}
        onEnded={() => log('ended')}
        onSeek={({ from, to }) => log(`seek ${s(from)} → ${s(to)}`)}
        onBuffering={(buffering) => log(buffering ? 'buffering…' : 'buffering ok')}
        onBufferedChange={(buffered) => log(`buffered ${s(buffered)}`)}
        onVolumeChange={({ volume, muted }) => log(`volume ${volume.toFixed(2)}${muted ? ' (mudo)' : ''}`)}
        onRateChange={(rate) => log(`rate ${rate}x`)}
        onFullscreenChange={(fullscreen) => log(fullscreen ? 'fullscreen on' : 'fullscreen off')}
        onPictureInPictureChange={(active) => log(active ? 'pip on' : 'pip off')}
      />
      {error ? (
        <VideoStatus error>Não foi possível tocar este vídeo: {error}</VideoStatus>
      ) : (
        <VideoStatus>
          {clock(time.currentTime)} / {clock(time.duration)}
        </VideoStatus>
      )}
      {events.length ? (
        <EventLog testID="video-events">
          {events.map((text, i) => (
            <EventLine key={`${i}-${text}`}>{text}</EventLine>
          ))}
        </EventLog>
      ) : null}
    </VideoBox>
  );
}

/* ───────────────────────── PDF ───────────────────────── */

const Paper = engine('Box', ({ theme }) => ({
  width: '100%',
  padding: theme.spacing.lg,
  gap: theme.spacing.sm,
  borderRadius: theme.borderRadius?.lg,
  backgroundColor: theme.color.brandSurface,
}));

const PaperLine = engine<'Box', { short?: boolean }>('Box', ({ theme, props }) => ({
  height: 10,
  width: props.short ? '55%' : '100%',
  borderRadius: 5,
  backgroundColor: theme.color.border,
}));

const PaperCaption = engine('Text', ({ theme }) => ({ color: theme.color.muted, fontSize: 13 }));

function PdfPreview({ detail }: { detail: string }) {
  return (
    <Paper>
      <PaperCaption>PDF · {detail}</PaperCaption>
      <PaperLine />
      <PaperLine />
      <PaperLine />
      <PaperLine short />
    </Paper>
  );
}

/* ───────────────────────── quiz ───────────────────────── */

const QUESTION = 'Qual é o principal achado do ECG na fibrilação atrial?';
const CHOICES = ['Ondas P bem definidas', 'Ausência de onda P e ritmo irregular', 'Intervalo PR prolongado'];

const Question = engine('Text', ({ theme }) => ({
  fontSize: theme.typography?.fontSize?.lg,
  fontWeight: theme.typography?.fontWeight?.bold,
  color: theme.color.text,
}));

const Choice = engine<'Pressable', { selected?: boolean }>('Pressable', ({ theme }) => ({
  padding: theme.spacing.md,
  borderRadius: theme.borderRadius?.md,
  borderWidth: 1.5,
  borderColor: theme.color.border,
  transition: 'background-color 150ms, border-color 150ms',
}))
  .when('state:hover', ({ theme }) => ({ style: { backgroundColor: theme.color.brandSurface } }))
  .when('props:selected', ({ theme }) => ({
    style: { borderColor: theme.color.primary, backgroundColor: theme.color.brandSurface },
  }))
  .when('platform:web', { style: { cursor: 'pointer' } });

const ChoiceText = engine('Text', ({ theme }) => ({ color: theme.color.text, fontSize: theme.typography?.fontSize?.md }));
const QuizBox = engine('Box', ({ theme }) => ({ width: '100%', gap: theme.spacing.sm }));

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <QuizBox>
      <Question>{QUESTION}</Question>
      {CHOICES.map((text, i) => (
        <Choice key={text} selected={selected === i} onPress={() => setSelected(i)}>
          <ChoiceText>{text}</ChoiceText>
        </Choice>
      ))}
    </QuizBox>
  );
}

/* ───────────────────────── entrada ───────────────────────── */

export function AssetPreview({ asset }: { asset: Asset }) {
  switch (asset.kind) {
    case 'video':
      return asset.src ? <VideoPreview src={asset.src} /> : null;
    case 'pdf':
      return <PdfPreview detail={asset.detail} />;
    case 'quiz':
      return <QuizPreview />;
  }
}
