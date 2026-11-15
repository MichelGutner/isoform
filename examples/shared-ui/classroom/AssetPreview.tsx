import { useState } from 'react';
import { engine, keyframes } from 'omnistyle';
import type { Asset } from './types';

/**
 * Pré-visualização do conteúdo por tipo. No app real, cada tipo vira o
 * componente de verdade (VideoPlayer, PdfViewer, Quiz); aqui são só placeholders.
 */

/* ───────────────────────── vídeo ───────────────────────── */

const Player = engine('Box', ({ theme }) => ({
  aspectRatio: 16 / 9,
  width: '100%',
  borderRadius: theme.borderRadius?.lg,
  backgroundColor: theme.color.brandDark,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}));

const PlayButton = engine('Pressable', {
  width: 64,
  height: 64,
  borderRadius: 32,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  transition: 'transform 150ms',
})
  .when('hover', { style: { transform: 'scale(1.08)' } })
  .when('pressed', { style: { transform: 'scale(0.95)' } })
  .when('web', { style: { cursor: 'pointer' } });

const PlayIcon = engine('Text', { color: '#ffffff', fontSize: 24 });

/** A barra de progresso do vídeo desliza da esquerda enquanto "toca". */
const slideIn = keyframes({
  from: { transform: 'translateX(-1200px)' },
  to: { transform: 'translateX(0px)' },
});

const VideoTrack = engine('Box', {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 4,
  overflow: 'hidden',
  backgroundColor: 'rgba(255, 255, 255, 0.25)',
});

const VideoFill = engine('Box', ({ theme }) => ({
  height: 4,
  backgroundColor: theme.color.primary,
  animation: `${slideIn} 20s linear both`,
}));

function VideoPreview() {
  const [playing, setPlaying] = useState(false);
  return (
    <Player>
      <PlayButton onPress={() => setPlaying(!playing)} testID="play">
        <PlayIcon>{playing ? '❚❚' : '▶'}</PlayIcon>
      </PlayButton>
      {playing ? (
        <VideoTrack>
          <VideoFill />
        </VideoTrack>
      ) : null}
    </Player>
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
  .when('hover', ({ theme }) => ({ style: { backgroundColor: theme.color.brandSurface } }))
  .when('selected', ({ theme }) => ({
    style: { borderColor: theme.color.primary, backgroundColor: theme.color.brandSurface },
  }))
  .when('web', { style: { cursor: 'pointer' } });

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
      return <VideoPreview />;
    case 'pdf':
      return <PdfPreview detail={asset.detail} />;
    case 'quiz':
      return <QuizPreview />;
  }
}
