/**
 * Contract of the `Video` primitive: the same on every platform.
 * Web: the browser's `<video>` with the lib's controls. Native: the lib's own
 * native player (AVPlayer on iOS, Media3 ExoPlayer on Android), with no external dependencies.
 */

/** Playback position, sent by `onTimeUpdate`. */
export interface MediaTime {
  /** Current position, in seconds. */
  currentTime: number;
  /** Total duration, in seconds (`0` while unknown, and for live streams). */
  duration: number;
}

/** Media metadata, sent by `onLoad` once it is known. */
export interface MediaInfo {
  /** Total duration, in seconds (`0` while unknown, and for live streams). */
  duration: number;
  /** Natural width of the video, in pixels (`0` if not decoded yet). */
  width: number;
  /** Natural height of the video, in pixels (`0` if not decoded yet). */
  height: number;
}

/** Imperative control shared by every media primitive (base for future ones, such as audio). */
export interface MediaHandle {
  /** Starts or resumes playback. */
  play(): void;
  /** Pauses playback, keeping the current position. */
  pause(): void;
  /** Jumps to `seconds` (clamped to the media's duration). Triggers `onSeek`. */
  seekTo(seconds: number): void;
}

/** Imperative control of a `Video`, obtained through its `ref`. */
export interface VideoHandle extends MediaHandle {
  /**
   * Enters (`true`) or leaves (`false`) fullscreen. Triggers `onFullscreenChange`.
   * iOS: presents a fullscreen player sharing the same playback; it cannot close
   * a fullscreen that was opened by the native button.
   */
  setFullscreen(fullscreen: boolean): void;
}

/** Playback props shared by every media primitive (base for future ones, such as audio). */
export interface PlaybackProps {
  /** Media URL: a file (`.mp4`, `.webm`…) or an HLS stream (`.m3u8`). HLS on the web needs Safari. */
  src: string;
  /** Starts playing as soon as the media is ready. Default `false`. Browsers only allow it when `muted`. */
  autoPlay?: boolean;
  /** Restarts from the beginning when the media ends. Default `false`. */
  loop?: boolean;
  /** Starts muted. Default `false`. The user can still unmute through the controls. */
  muted?: boolean;
  /** Playback speed: `1` = normal, `0.5` = half, `2` = double. Default `1`. */
  rate?: number;
  /** Volume, from `0` (silent) to `1` (full). Default `1`. */
  volume?: number;
  /** Called when playback starts or resumes. */
  onPlay?: () => void;
  /** Called when playback pauses (by the user, by `pause()` or by the system). */
  onPause?: () => void;
  /** Called when the media reaches the end (not called while `loop` is on). */
  onEnded?: () => void;
  /** Called with the position about 4 times per second while playing. */
  onTimeUpdate?: (time: MediaTime) => void;
  /** Called once the metadata is ready: duration and natural size. */
  onLoad?: (info: MediaInfo) => void;
  /** Called when the media fails to load or play, with a readable message. */
  onError?: (message: string) => void;
  /** Called when the position jumps (seek bar, ±10 s buttons or `seekTo`), with both positions in seconds. */
  onSeek?: (seek: {
    /** Position before the jump, in seconds. */
    from: number;
    /** Position after the jump, in seconds. */
    to: number;
  }) => void;
  /** Called with `true` when playback stalls waiting for data, and `false` when it can continue. */
  onBuffering?: (buffering: boolean) => void;
  /** Called with how far the media has been downloaded, in seconds (at most every 0.5 s of new data). */
  onBufferedChange?: (buffered: number) => void;
  /** Called when the volume or the mute state changes (by the controls or by the props). */
  onVolumeChange?: (volume: {
    /** New volume, from `0` to `1`. */
    volume: number;
    /** Whether the media is now muted. */
    muted: boolean;
  }) => void;
  /** Called with the new speed when it changes (by the speed menu or by the `rate` prop). */
  onRateChange?: (rate: number) => void;
}

/** Props of the `Video` primitive (on top of {@link PlaybackProps}). */
export interface VideoOwnProps extends PlaybackProps {
  /** Image URL shown before playback starts. */
  poster?: string;
  /** Shows the player controls (play/pause, seek bar, speed, fullscreen…). Default `true`. */
  controls?: boolean;
  /** Called with `true` when entering fullscreen and `false` when leaving it. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /**
   * Called with `true` when entering picture-in-picture and `false` when leaving it.
   * @platform web — picture-in-picture is not implemented on native yet.
   */
  onPictureInPictureChange?: (active: boolean) => void;
}
