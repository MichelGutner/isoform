import React, { useState } from 'react';
import { CheckIcon, MusicNoteIcon, PauseIcon, PlayIcon, SkipIcon, VolumeIcon, type VolumeLevel } from '../shared/icons';
import { SPEEDS, formatTime, rateLabel } from '../shared/helpers';
import { Track } from '../shared/Track';

/**
 * Controls of the web `Audio`: a card with cover, title, artist, speed menu,
 * seek bar with elapsed/remaining time, −10 s · play/pause · +10 s, and mute
 * with a volume slider.
 *
 * Keyboard (with the card focused): Space/K play · ←/→ 5 s · J/L 10 s · ↑/↓ volume · M mute.
 */

export interface AudioState {
  playing: boolean;
  buffering: boolean;
  current: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
}

export interface AudioActions {
  togglePlay(): void;
  seekTo(seconds: number): void;
  skip(seconds: number): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  setRate(rate: number): void;
}

/** What the card shows about the track (all optional). */
export interface AudioMeta {
  title?: string;
  artist?: string;
  artwork?: string;
}

const SKIP_SECONDS = 10;

/** Shortcuts, keyed by `KeyboardEvent.key`. */
export const SHORTCUTS: Record<string, (actions: AudioActions, state: AudioState) => void> = {
  ' ': (a) => a.togglePlay(),
  k: (a) => a.togglePlay(),
  ArrowLeft: (a) => a.skip(-5),
  ArrowRight: (a) => a.skip(5),
  j: (a) => a.skip(-SKIP_SECONDS),
  l: (a) => a.skip(SKIP_SECONDS),
  ArrowUp: (a, s) => a.setVolume(Math.min(1, s.volume + 0.1)),
  ArrowDown: (a, s) => a.setVolume(Math.max(0, s.volume - 0.1)),
  m: (a) => a.toggleMute(),
};

function volumeLevel({ volume, muted }: AudioState): VolumeLevel {
  if (muted || volume === 0) return 'muted';
  return volume < 0.5 ? 'low' : 'high';
}

const remaining = (state: AudioState, shown: number) =>
  state.duration > 0 ? `−${formatTime(state.duration - shown)}` : '';

export function AudioControls({ state, actions, meta }: { state: AudioState; actions: AudioActions; meta: AudioMeta }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // position while dragging the bar: the seek only happens on release
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const shown = scrubTime ?? state.current;

  const scrub = (time: number, done: boolean) => {
    setScrubTime(done ? null : time);
    if (done) actions.seekTo(time);
  };

  const selectRate = (rate: number) => {
    actions.setRate(rate);
    setMenuOpen(false);
  };

  return (
    <>
      <div className="oa-head">
        <Artwork src={meta.artwork} />
        <div className="oa-meta">
          <span className="oa-title">{meta.title ?? 'Audio'}</span>
          {meta.artist ? <span className="oa-artist">{meta.artist}</span> : null}
        </div>
        <SpeedMenu rate={state.rate} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} onSelect={selectRate} />
      </div>

      <div>
        <Track
          value={shown}
          max={state.duration}
          buffered={state.buffered}
          step={5}
          label="Progress"
          valueText={`${formatTime(shown)} of ${formatTime(state.duration)}`}
          tooltip={formatTime}
          onChange={scrub}
        />
        <div className="oa-times">
          <span>{formatTime(shown)}</span>
          <span>{remaining(state, shown)}</span>
        </div>
      </div>

      <div className="oa-controls">
        <button type="button" className="ov-btn oa-skip" aria-label="Back 10 seconds" onClick={() => actions.skip(-SKIP_SECONDS)}>
          <SkipIcon />
        </button>
        <button
          type="button"
          className="ov-btn oa-play"
          aria-label={state.playing ? 'Pause' : 'Play'}
          onClick={actions.togglePlay}
        >
          {state.buffering && state.playing ? <span className="oa-wait" role="status" aria-label="Loading" /> : null}
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="ov-btn oa-skip" aria-label="Forward 10 seconds" onClick={() => actions.skip(SKIP_SECONDS)}>
          <SkipIcon forward />
        </button>

        <div className="oa-spacer" />

        <div className="ov-volume">
          <button type="button" className="ov-btn" aria-label={state.muted ? 'Unmute' : 'Mute'} onClick={actions.toggleMute}>
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
      </div>
    </>
  );
}

/** The cover, or a gradient with a music note while there is none (or it fails to load). */
function Artwork({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="oa-art" aria-hidden="true">
      <MusicNoteIcon />
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : null}
    </div>
  );
}

interface SpeedMenuProps {
  rate: number;
  open: boolean;
  onToggle(): void;
  onSelect(rate: number): void;
}

/** "1x" button that opens the list of speeds, with a ✓ on the current one. */
function SpeedMenu({ rate, open, onToggle, onSelect }: SpeedMenuProps) {
  return (
    <div className="ov-menu-anchor">
      <button
        type="button"
        className="ov-btn ov-pill"
        aria-label={`Speed: ${rateLabel(rate)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        {rateLabel(rate)}
      </button>

      {open ? (
        <div className="ov-menu" role="menu" aria-label="Speed">
          <div className="ov-menu-title">Speed</div>
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
