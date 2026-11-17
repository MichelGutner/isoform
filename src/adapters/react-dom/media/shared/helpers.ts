import { useRef } from 'react';

/**
 * Helpers shared by the web `Video` and `Audio` players: media-element
 * actions, time formatting and the list of speeds.
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const ignore = () => undefined;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
/** `duration` is `NaN` while unknown and `Infinity` on live streams. */
export const finite = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : 0);

export const playSafely = (v: HTMLMediaElement) => void v.play().catch(ignore);
export const togglePlayback = (v: HTMLMediaElement) => (v.paused ? playSafely(v) : v.pause());
export const seek = (v: HTMLMediaElement, seconds: number) => {
  v.currentTime = clamp(seconds, 0, finite(v.duration) || seconds);
};
export const changeVolume = (v: HTMLMediaElement, volume: number) => {
  v.volume = volume;
  v.muted = volume === 0;
};

/** End of the downloaded range that contains the current position (or the last range). */
export function bufferedEnd(v: HTMLMediaElement): number {
  const ranges = v.buffered;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= v.currentTime && v.currentTime <= ranges.end(i)) return ranges.end(i);
  }
  return ranges.length ? ranges.end(ranges.length - 1) : 0;
}

export const classNames = (...names: Array<string | undefined>) => names.filter(Boolean).join(' ');

/** Always the latest version of a callback, without re-running effects. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 75 → "1:15"; 3725 → "1:02:05". */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = pad(total % 60);
  return h ? `${h}:${pad(m)}:${s}` : `${m}:${s}`;
}

export const rateLabel = (rate: number) => `${rate}x`;
