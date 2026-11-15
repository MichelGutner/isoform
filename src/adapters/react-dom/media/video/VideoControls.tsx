import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckIcon,
  FullscreenIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlayIcon,
  SkipIcon,
  VolumeIcon,
  type VolumeLevel,
} from '../shared/icons';
import { SPEEDS, formatTime, rateLabel } from '../shared/helpers';
import { Track } from '../shared/Track';

/**
 * Controles do `Video` na web, no mesmo desenho do Android/iOS da lib:
 * centro com −10s · play/pause · +10s; embaixo, a barra de progresso, mudo +
 * volume, tempo, velocidade, picture-in-picture (onde o navegador permite) e
 * tela cheia. Somem sozinhos durante o play.
 *
 * Teclado (com foco no player): Espaço/K play · ←/→ 5s · J/L 10s · ↑/↓ volume ·
 * M mudo · F tela cheia · I picture-in-picture.
 */

export interface PlayerState {
  playing: boolean;
  buffering: boolean;
  current: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  fullscreen: boolean;
  /** Picture-in-picture ativo / disponível neste navegador. */
  pip: boolean;
  pipSupported: boolean;
}

export interface PlayerActions {
  togglePlay(): void;
  seekTo(seconds: number): void;
  skip(seconds: number): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  setRate(rate: number): void;
  toggleFullscreen(): void;
  togglePictureInPicture(): void;
}

const IDLE_MS = 2500;

function volumeLevel({ volume, muted }: PlayerState): VolumeLevel {
  if (muted || volume === 0) return 'muted';
  return volume < 0.5 ? 'low' : 'high';
}

/** Atalhos de teclado (com o foco no player), os mesmos do YouTube. */
const SHORTCUTS: Record<string, (actions: PlayerActions, state: PlayerState) => void> = {
  ' ': (a) => a.togglePlay(),
  k: (a) => a.togglePlay(),
  ArrowLeft: (a) => a.skip(-5),
  ArrowRight: (a) => a.skip(5),
  j: (a) => a.skip(-10),
  l: (a) => a.skip(10),
  ArrowUp: (a, s) => a.setVolume(Math.min(1, s.volume + 0.1)),
  ArrowDown: (a, s) => a.setVolume(Math.max(0, s.volume - 0.1)),
  m: (a) => a.toggleMute(),
  f: (a) => a.toggleFullscreen(),
  i: (a) => a.togglePictureInPicture(),
};

/** Mostra os controles e agenda o sumiço depois de um tempo parado. */
function useIdle() {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  const sleep = useCallback(() => {
    clearTimeout(timer.current);
    setIdle(true);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { idle, wake, sleep };
}

/**
 * @param extra Extra buttons for the bottom bar, before the speed (e.g. the playlist button).
 */
export function VideoControls({ state, actions, extra }: { state: PlayerState; actions: PlayerActions; extra?: React.ReactNode }) {
  const { idle, wake, sleep } = useIdle();
  const [menuOpen, setMenuOpen] = useState(false);
  // posição enquanto arrasta a barra: o seek só acontece ao soltar
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const loading = state.buffering && state.playing;
  const busy = menuOpen || scrubTime !== null;
  const hidden = idle && state.playing && !busy;
  const shownTime = scrubTime ?? state.current;

  const onTap = (pointerType: string) => {
    wake();
    if (menuOpen) return setMenuOpen(false);
    // no toque, o primeiro tap só revela os controles (como no celular)
    if (pointerType !== 'mouse' && hidden) return;
    actions.togglePlay();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setMenuOpen(false);
    const shortcut = SHORTCUTS[e.key];
    if (!shortcut || e.target !== e.currentTarget) return; // botões tratam Espaço/Enter sozinhos
    e.preventDefault();
    shortcut(actions, state);
    wake();
  };

  const scrub = (time: number, done: boolean) => {
    setScrubTime(done ? null : time);
    if (done) actions.seekTo(time);
  };

  const selectRate = (rate: number) => {
    actions.setRate(rate);
    setMenuOpen(false);
    wake();
  };

  return (
    <div
      className="ov-ui"
      tabIndex={0}
      aria-label="Player de vídeo"
      data-idle={hidden || undefined}
      onPointerMove={wake}
      onPointerLeave={() => state.playing && !busy && sleep()}
      onFocus={wake}
      onKeyDown={onKeyDown}
    >
      <div
        className="ov-hit"
        onPointerUp={(e) => onTap(e.pointerType)}
        onDoubleClick={actions.toggleFullscreen}
      />

      {loading ? <div className="ov-spinner" role="status" aria-label="Carregando" /> : null}

      <div className="ov-layer" data-hidden={hidden || undefined}>
        <div className="ov-scrim" />

        {loading ? null : (
          <div className="ov-center">
            <button type="button" className="ov-btn ov-glass" aria-label="Voltar 10 segundos" onClick={() => actions.skip(-10)}>
              <SkipIcon />
            </button>
            <button type="button" className="ov-btn ov-big" aria-label={state.playing ? 'Pausar' : 'Reproduzir'} onClick={actions.togglePlay}>
              {state.playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="ov-btn ov-glass" aria-label="Avançar 10 segundos" onClick={() => actions.skip(10)}>
              <SkipIcon forward />
            </button>
          </div>
        )}

        <div className="ov-bar">
          <Track
            value={shownTime}
            max={state.duration}
            buffered={state.buffered}
            step={5}
            label="Progresso"
            valueText={`${formatTime(shownTime)} de ${formatTime(state.duration)}`}
            tooltip={formatTime}
            onChange={scrub}
          />

          <div className="ov-row">
            <div className="ov-volume">
              <button type="button" className="ov-btn" aria-label={state.muted ? 'Ativar som' : 'Silenciar'} onClick={actions.toggleMute}>
                <VolumeIcon level={volumeLevel(state)} />
              </button>
              <div className="ov-volume-slot">
                <Track
                  value={state.muted ? 0 : state.volume}
                  max={1}
                  step={0.1}
                  label="Volume"
                  valueText={`${Math.round(state.volume * 100)}%`}
                  onChange={(volume) => actions.setVolume(volume)}
                />
              </div>
            </div>

            <span className="ov-time">
              {formatTime(shownTime)} / {formatTime(state.duration)}
            </span>

            <div className="ov-spacer" />

            {extra}
            <SpeedMenu rate={state.rate} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} onSelect={selectRate} />

            {state.pipSupported ? (
              <button
                type="button"
                className="ov-btn"
                aria-label={state.pip ? 'Sair do picture-in-picture' : 'Picture-in-picture'}
                aria-pressed={state.pip}
                onClick={actions.togglePictureInPicture}
              >
                <PictureInPictureIcon />
              </button>
            ) : null}

            <button
              type="button"
              className="ov-btn"
              aria-label={state.fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              onClick={actions.toggleFullscreen}
            >
              <FullscreenIcon exit={state.fullscreen} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SpeedMenuProps {
  rate: number;
  open: boolean;
  onToggle(): void;
  onSelect(rate: number): void;
}

/** Botão "1x" que abre a lista de velocidades, com ✓ na atual. */
function SpeedMenu({ rate, open, onToggle, onSelect }: SpeedMenuProps) {
  return (
    <div className="ov-menu-anchor">
      <button
        type="button"
        className="ov-btn ov-pill"
        aria-label={`Velocidade: ${rateLabel(rate)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        {rateLabel(rate)}
      </button>

      {open ? (
        <div className="ov-menu" role="menu" aria-label="Velocidade">
          <div className="ov-menu-title">Velocidade</div>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              role="menuitemradio"
              aria-checked={speed === rate}
              className="ov-menu-item"
              onClick={() => onSelect(speed)}
            >
              <span className="ov-check">{speed === rate ? <CheckIcon /> : null}</span>
              {rateLabel(speed)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
