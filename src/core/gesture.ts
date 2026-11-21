/**
 * Gestures declared with `.gesture()`: the public types and the platform-free
 * logic (option defaults, swipe detection, two-finger math, velocity). The
 * adapters do the recognition: native recognizers on iOS/Android, Pointer
 * Events on the web.
 */

/* ───────────────────────── options ───────────────────────── */

/** Axis a pan accepts. `'x'` leaves vertical drags to a parent scroll view, `'y'` leaves horizontal ones. */
export type PanAxis = 'x' | 'y' | 'both';

import { lerpValue } from './lerp';

/** What the element does when the fingers lift: spring back to where it was, or stay where it was left. */
export type GestureRelease = 'reset' | 'stay';

/**
 * What a dragged element does when the finger lifts: `'reset'` springs back, `'stay'` stays where it was left,
 * `'decay'` keeps gliding with the finger's speed and slows down, `'snap'` glides to the nearest `snap` point
 * (the finger's speed counts, so a flick reaches the next one).
 */
export type PanRelease = GestureRelease | 'decay' | 'snap';

/** Resting places of a dragged element: offsets from where it starts, per axis. */
export interface PanSnapPoints {
  /** Horizontal resting places (negative = left). Default `[0]`. */
  x?: readonly number[];
  /** Vertical resting places (negative = up). Default `[0]`. */
  y?: readonly number[];
}

/** Direction of a swipe, in screen terms. */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** How far a dragged element may move from its resting place, in px (points on iOS, dp on Android). */
export interface PanBounds {
  /** Farthest distance to the left. Default: unlimited. */
  left?: number;
  /** Farthest distance to the right. Default: unlimited. */
  right?: number;
  /** Farthest distance up. Default: unlimited. */
  top?: number;
  /** Farthest distance down. Default: unlimited. */
  bottom?: number;
}

/** Options of the `pan` gesture (dragging with one finger). */
export interface PanOptions {
  /** Axis the pan accepts. Default `'both'`. */
  axis?: PanAxis;
  /** Moves the element with the finger (on the UI thread on mobile). Default `true`. */
  follow?: boolean;
  /** What happens when the finger lifts. Default `'snap'` with `snap` points, `'reset'` without. */
  release?: PanRelease;
  /** Limits of the movement while it follows the finger. Default: unlimited. */
  bounds?: PanBounds;
  /** Where a release with `'snap'` may rest. Setting it makes `'snap'` the default release. */
  snap?: PanSnapPoints;
  /**
   * Past `bounds`, the element still follows the finger but resists more the farther it goes, and glides
   * back inside when released (as iOS scroll views do). Without it, the bounds stop it dead. Default `false`.
   */
  rubberBand?: boolean;
}

/** Options of the `swipe` gesture (a quick flick, reported when the finger lifts). */
export interface SwipeOptions {
  /** Directions that count. Default: all four. */
  directions?: readonly SwipeDirection[];
  /** Minimum speed along the swipe, in px per second. Default `500`. */
  minVelocity?: number;
  /** Minimum distance along the swipe, in px. Default `30`. */
  minDistance?: number;
  /**
   * With a `pan` that follows the finger: the element keeps going off screen in the
   * swipe's direction, and `onSwipe` fires when it is out (remove it from the list
   * there). Without it, the element springs back as the pan's `release` says. Default `false`.
   */
  exit?: boolean;
}

/** Options of the `pinch` gesture (two fingers apart or together). */
export interface PinchOptions {
  /** Scales the element with the fingers (on the UI thread on mobile). Default `true`. */
  follow?: boolean;
  /** What happens when the fingers lift. Default `'reset'`. */
  release?: GestureRelease;
  /** Smallest scale while it follows the fingers. Default `0.5`. */
  minScale?: number;
  /** Largest scale while it follows the fingers. Default `4`. */
  maxScale?: number;
}

/** Options of the `rotate` gesture (two fingers turning). */
export interface RotateOptions {
  /** Rotates the element with the fingers (on the UI thread on mobile). Default `true`. */
  follow?: boolean;
  /** What happens when the fingers lift. Default `'reset'`. */
  release?: GestureRelease;
}

/** Options of the `longPress` gesture. */
export interface LongPressOptions {
  /** How long the finger must stay down, in ms. Default `500`. */
  minDuration?: number;
}

/** What drives a {@link GestureInterpolation}: the element's offset, its scale or its rotation (radians). */
export type InterpolationSource = 'x' | 'y' | 'scale' | 'rotation';

/** Style properties a gesture can drive (on the UI thread on mobile). */
export type GestureStyleProp = 'opacity' | 'backgroundColor' | 'borderColor';

/**
 * A style that follows a gesture: at each `input` value of `from`, the property takes the value at the same
 * index of its list; in between it is interpolated (colors too), and past the ends it holds.
 *
 * @example fade a row out as it is dragged sideways
 * { from: 'x', input: [-200, 0, 200], style: { opacity: [0, 1, 0] } }
 */
export interface GestureInterpolation {
  /** What drives the style. */
  from: InterpolationSource;
  /** Increasing values of `from` (at least two). */
  input: readonly number[];
  /** One value per `input` point, per property. */
  style: Partial<Record<GestureStyleProp, readonly (number | string)[]>>;
}

/** Names of the accessibility actions `.gesture()` adds (their labels can be changed with `actionLabels`). */
export type GestureActionName = 'swipeLeft' | 'swipeRight' | 'swipeUp' | 'swipeDown' | 'snapNext' | 'snapPrevious';

/**
 * The gestures an element recognizes, given to `.gesture()`. Each one is off
 * unless set: `true` turns it on with the defaults, an object sets its options.
 */
export interface GestureConfig {
  /** Dragging with one finger. Reported through `onPan`. */
  pan?: boolean | PanOptions;
  /** A quick flick, reported through `onSwipe` when the finger lifts. */
  swipe?: boolean | SwipeOptions;
  /** Two fingers apart or together. Reported through `onPinch`. */
  pinch?: boolean | PinchOptions;
  /** Two fingers turning. Reported through `onRotate`. */
  rotate?: boolean | RotateOptions;
  /** Two quick taps. Reported through `onDoubleTap`. */
  doubleTap?: boolean;
  /** A finger held down. Reported through `onLongPress`. */
  longPress?: boolean | LongPressOptions;
  /** Styles that follow the gesture (opacity, colors), on the UI thread on mobile. */
  interpolate?: readonly GestureInterpolation[];
  /** A light tap of the device on a snap, a swipe, a long press and when a drag reaches its bounds. Default `false`. */
  haptics?: boolean;
  /**
   * A one-finger pan may run together with a pinch or a rotation (move while pinching). `false` makes them
   * exclusive: the first one to start wins until the fingers lift. Pinch and rotation always run together. Default `true`.
   */
  simultaneous?: boolean;
  /**
   * Labels of the accessibility actions added for screen readers (a swipe per direction; next and previous
   * snap point). Defaults in English: `'Swipe left'`, `'Next position'`…
   */
  actionLabels?: Partial<Record<GestureActionName, string>>;
}

/* ───────────────────────── events ───────────────────────── */

/** Moment of a continuous gesture: it started, moved, ended normally or was cancelled (by the system or a scroll). */
export type GesturePhase = 'start' | 'move' | 'end' | 'cancel';

/** A pan update. Distances in px (points on iOS, dp on Android), speeds in px per second. */
export interface PanEvent {
  /** Moment of the gesture. */
  phase: GesturePhase;
  /** Horizontal distance since the gesture started (positive = right). */
  translationX: number;
  /** Vertical distance since the gesture started (positive = down). */
  translationY: number;
  /** Horizontal speed (positive = right). */
  velocityX: number;
  /** Vertical speed (positive = down). */
  velocityY: number;
  /** Finger position inside the element, from its left edge. */
  x: number;
  /** Finger position inside the element, from its top edge. */
  y: number;
}

/** A recognized swipe. */
export interface SwipeEvent {
  /** Direction of the swipe. */
  direction: SwipeDirection;
  /** Horizontal distance of the whole gesture. */
  translationX: number;
  /** Vertical distance of the whole gesture. */
  translationY: number;
  /** Horizontal speed when the finger lifted, in px per second. */
  velocityX: number;
  /** Vertical speed when the finger lifted, in px per second. */
  velocityY: number;
}

/** A pinch update. */
export interface PinchEvent {
  /** Moment of the gesture. */
  phase: GesturePhase;
  /** Scale since the gesture started (`1` = unchanged, `2` = fingers twice as far apart). */
  scale: number;
  /** Scale change per second. */
  velocity: number;
  /** Point between the fingers inside the element, from its left edge. */
  focalX: number;
  /** Point between the fingers inside the element, from its top edge. */
  focalY: number;
}

/** A rotation update. */
export interface RotateEvent {
  /** Moment of the gesture. */
  phase: GesturePhase;
  /** Angle since the gesture started, in radians (positive = clockwise). */
  rotation: number;
  /** Angle change per second, in radians. */
  velocity: number;
}

/** Where a release with `'snap'` sends the element: the chosen point, offset from where it started. */
export interface SnapEvent {
  /** Horizontal resting place. */
  x: number;
  /** Vertical resting place. */
  y: number;
}

/** A double tap or a long press. */
export interface TapEvent {
  /** Finger position inside the element, from its left edge. */
  x: number;
  /** Finger position inside the element, from its top edge. */
  y: number;
}

/** Callback props added by `.gesture()` (each one only fires for a gesture that is on). */
export interface GestureProps {
  /** Every update of the `pan` gesture. */
  onPan?: (event: PanEvent) => void;
  /** A `swipe`, when the finger lifts. */
  onSwipe?: (event: SwipeEvent) => void;
  /** Every update of the `pinch` gesture. */
  onPinch?: (event: PinchEvent) => void;
  /** Every update of the `rotate` gesture. */
  onRotate?: (event: RotateEvent) => void;
  /** A `doubleTap`. */
  onDoubleTap?: (event: TapEvent) => void;
  /** A `longPress`, as soon as the finger has been held long enough. */
  onLongPress?: (event: TapEvent) => void;
  /** A pan released with `'snap'` (or moved by a screen reader's action): where it is going to rest. */
  onSnap?: (event: SnapEvent) => void;
}

/** Names of the props in {@link GestureProps}, which the adapters take out before rendering. */
export const GESTURE_PROPS = ['onPan', 'onSwipe', 'onPinch', 'onRotate', 'onDoubleTap', 'onLongPress', 'onSnap'] as const;

/* ───────────────────────── resolved config ───────────────────────── */

/** {@link PanOptions} with every default applied; bounds as signed limits. */
export interface ResolvedPan {
  /** Accepted axis. */
  axis: PanAxis;
  /** Moves the element with the finger. */
  follow: boolean;
  /** Behavior when the finger lifts. */
  release: PanRelease;
  /** Smallest horizontal offset (`-left`). */
  minX: number;
  /** Largest horizontal offset (`right`). */
  maxX: number;
  /** Smallest vertical offset (`-top`). */
  minY: number;
  /** Largest vertical offset (`bottom`). */
  maxY: number;
  /** Horizontal snap points, sorted (`[0]` when none was given). */
  snapX: number[];
  /** Vertical snap points, sorted (`[0]` when none was given). */
  snapY: number[];
  /** Resists past the bounds instead of stopping. */
  rubberBand: boolean;
}

/** A {@link GestureInterpolation} that passed validation. */
export interface ResolvedInterpolation {
  /** What drives it. */
  from: InterpolationSource;
  /** Increasing input values. */
  input: number[];
  /** Output values per property, as long as `input`. */
  style: Array<[GestureStyleProp, Array<number | string>]>;
}

/** {@link SwipeOptions} with every default applied. */
export interface ResolvedSwipe {
  /** Directions that count. */
  directions: readonly SwipeDirection[];
  /** Minimum speed, px per second. */
  minVelocity: number;
  /** Minimum distance, px. */
  minDistance: number;
  /** The element leaves the screen before `onSwipe`. */
  exit: boolean;
}

/** {@link PinchOptions} with every default applied. */
export interface ResolvedPinch {
  /** Scales the element with the fingers. */
  follow: boolean;
  /** Behavior when the fingers lift. */
  release: GestureRelease;
  /** Smallest scale. */
  minScale: number;
  /** Largest scale. */
  maxScale: number;
}

/** {@link RotateOptions} with every default applied. */
export interface ResolvedRotate {
  /** Rotates the element with the fingers. */
  follow: boolean;
  /** Behavior when the fingers lift. */
  release: GestureRelease;
}

/** What the adapters receive from the core: only the gestures that are on, with defaults applied. */
export interface ResolvedGestures {
  /** Identity: changes when the config changes (hosts rebuild their animated nodes). */
  key: string;
  /** The pan gesture, when on. */
  pan?: ResolvedPan;
  /** The swipe gesture, when on. */
  swipe?: ResolvedSwipe;
  /** The pinch gesture, when on. */
  pinch?: ResolvedPinch;
  /** The rotate gesture, when on. */
  rotate?: ResolvedRotate;
  /** Double tap on. */
  doubleTap: boolean;
  /** The long press, when on. */
  longPress?: { minDuration: number };
  /** Styles that follow the gesture. */
  interpolate: ResolvedInterpolation[];
  /** Device taps on snaps, swipes, long presses and bounds. */
  haptics: boolean;
  /** Pan together with pinch/rotation. */
  simultaneous: boolean;
  /** Labels of the accessibility actions. */
  actionLabels: Record<GestureActionName, string>;
  /**
   * Axis the native one-finger recognizer tracks: the pan's axis, `'both'` for a
   * swipe on its own, `'none'` when neither is on.
   */
  trackAxis: PanAxis | 'none';
}

/** Defaults shared by every platform. */
export const GESTURE_DEFAULTS = {
  swipeMinVelocity: 500,
  swipeMinDistance: 30,
  minScale: 0.5,
  maxScale: 4,
  longPressMs: 500,
  /** Longest gap between the two taps of a double tap. */
  doubleTapMs: 300,
  /** How far a finger may move and still be a tap (or the second tap of a double tap). */
  tapSlop: 10,
  /** How far a finger must move before a pan starts. */
  panSlop: 10,
  /** How long a swipe's exit (`swipe.exit`) takes, in ms. */
  exitMs: 220,
  /** How long a release glide (`reset`, `stay` back inside the bounds, `snap`) takes, in ms. */
  releaseMs: 280,
  /** How long a `decay` glide takes, in ms. */
  decayMs: 900,
  /** How far ahead a `decay` goes: the finger's speed (px/s) times this, in seconds. */
  decayProjection: 0.3,
  /** How far ahead a `snap` looks to pick its point: the finger's speed times this, in seconds. */
  snapProjection: 0.15,
  /** Scale of the rubber band past the bounds: the most the element can go past them, in px. */
  rubberBandLimit: 120,
} as const;

/** Cubic bezier of the release glides (a slight overshoot, like a soft spring). */
export const RELEASE_BEZIER = [0.2, 0.9, 0.3, 1.1] as const;

/** Cubic bezier of a `decay` glide: starts at about the finger's speed and slows down smoothly. */
export const DECAY_BEZIER = [0.15, 0.55, 0.3, 1] as const;

const ACTION_LABELS: Record<GestureActionName, string> = {
  swipeLeft: 'Swipe left',
  swipeRight: 'Swipe right',
  swipeUp: 'Swipe up',
  swipeDown: 'Swipe down',
  snapNext: 'Next position',
  snapPrevious: 'Previous position',
};

/** How far a swipe's exit goes: past the screen edge in the swipe's direction. */
export function exitOffset(direction: SwipeDirection, screen: { width: number; height: number }): { x: number; y: number } {
  const far = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[direction];
  return { x: far.x * screen.width * 1.2, y: far.y * screen.height * 1.2 };
}

const ALL_DIRECTIONS: readonly SwipeDirection[] = ['left', 'right', 'up', 'down'];

/** `true` → `{}`, an object → itself, anything else → `undefined` (the gesture is off). */
const optionsOf = <T extends object>(setting: boolean | T | undefined): T | undefined => {
  if (setting === true) return {} as T;
  return typeof setting === 'object' && setting !== null ? setting : undefined;
};

/** A bound given as a distance (`left: 40`) → its signed limit; unset → unlimited. */
const limit = (distance: number | undefined, sign: 1 | -1): number =>
  typeof distance === 'number' && Number.isFinite(distance) ? sign * Math.abs(distance) : sign * Infinity;

/** Finite snap points, sorted; `[0]` (where it started) when none is given. */
const snapList = (points: readonly number[] | undefined): number[] => {
  const finite = (points ?? []).filter((p) => Number.isFinite(p));
  return finite.length ? [...finite].sort((a, b) => a - b) : [0];
};

function resolvePan(options: PanOptions): ResolvedPan {
  const bounds = options.bounds ?? {};
  return {
    axis: options.axis ?? 'both',
    follow: options.follow ?? true,
    release: options.release ?? (options.snap ? 'snap' : 'reset'),
    minX: limit(bounds.left, -1),
    maxX: limit(bounds.right, 1),
    minY: limit(bounds.top, -1),
    maxY: limit(bounds.bottom, 1),
    snapX: snapList(options.snap?.x),
    snapY: snapList(options.snap?.y),
    rubberBand: options.rubberBand ?? false,
  };
}

const isIncreasing = (values: readonly number[]) => values.every((v, i) => Number.isFinite(v) && (i === 0 || v > values[i - 1]));

/** Keeps the interpolations that can run: increasing input, one output per input point. */
function resolveInterpolations(list: readonly GestureInterpolation[] | undefined): ResolvedInterpolation[] {
  return (list ?? []).flatMap((item) => {
    const input = [...item.input];
    const style = Object.entries(item.style ?? {})
      .filter(([, values]) => Array.isArray(values) && values.length === input.length)
      .map(([prop, values]) => [prop, [...(values as Array<number | string>)]] as [GestureStyleProp, Array<number | string>]);
    return input.length >= 2 && isIncreasing(input) && style.length ? [{ from: item.from, input, style }] : [];
  });
}

function resolveSwipe(options: SwipeOptions): ResolvedSwipe {
  return {
    directions: options.directions?.length ? options.directions : ALL_DIRECTIONS,
    minVelocity: options.minVelocity ?? GESTURE_DEFAULTS.swipeMinVelocity,
    minDistance: options.minDistance ?? GESTURE_DEFAULTS.swipeMinDistance,
    exit: options.exit ?? false,
  };
}

function resolvePinch(options: PinchOptions): ResolvedPinch {
  return {
    follow: options.follow ?? true,
    release: options.release ?? 'reset',
    minScale: options.minScale ?? GESTURE_DEFAULTS.minScale,
    maxScale: options.maxScale ?? GESTURE_DEFAULTS.maxScale,
  };
}

const resolveRotate = (options: RotateOptions): ResolvedRotate => ({
  follow: options.follow ?? true,
  release: options.release ?? 'reset',
});

/** The one-finger recognizer follows the pan's axis; a swipe alone needs both axes. */
function trackAxisOf(pan: ResolvedPan | undefined, swipe: ResolvedSwipe | undefined): ResolvedGestures['trackAxis'] {
  if (pan) return pan.axis;
  return swipe ? 'both' : 'none';
}

/** Merges the configs of several `.gesture()` calls: later ones override earlier ones, gesture by gesture. */
export function mergeGestures(configs: readonly GestureConfig[]): GestureConfig {
  return Object.assign({}, ...configs);
}

/** A `.gesture()` config → what the adapters run, or `undefined` when no gesture is on. */
export function resolveGestures(config: GestureConfig | undefined): ResolvedGestures | undefined {
  if (!config) return undefined;
  const panOptions = optionsOf(config.pan);
  const swipeOptions = optionsOf(config.swipe);
  const pinchOptions = optionsOf(config.pinch);
  const rotateOptions = optionsOf(config.rotate);
  const longPressOptions = optionsOf(config.longPress);

  const pan = panOptions && resolvePan(panOptions);
  const swipe = swipeOptions && resolveSwipe(swipeOptions);
  const resolved: ResolvedGestures = {
    key: '',
    pan,
    swipe,
    pinch: pinchOptions && resolvePinch(pinchOptions),
    rotate: rotateOptions && resolveRotate(rotateOptions),
    doubleTap: config.doubleTap === true,
    longPress: longPressOptions && { minDuration: longPressOptions.minDuration ?? GESTURE_DEFAULTS.longPressMs },
    interpolate: resolveInterpolations(config.interpolate),
    haptics: config.haptics === true,
    simultaneous: config.simultaneous ?? true,
    actionLabels: { ...ACTION_LABELS, ...config.actionLabels },
    trackAxis: trackAxisOf(pan, swipe),
  };
  const isOn = resolved.pan || resolved.swipe || resolved.pinch || resolved.rotate || resolved.doubleTap || resolved.longPress;
  if (!isOn) return undefined;
  resolved.key = JSON.stringify(resolved, (_, value) => (value === Infinity || value === -Infinity ? String(value) : value));
  return resolved;
}

/* ───────────────────────── recognition helpers ───────────────────────── */

/** Native recognizers report the phase as a number (codegen events carry no string enums). */
const PHASES: readonly GesturePhase[] = ['start', 'move', 'end', 'cancel'];

/** `0..3` from the native side → {@link GesturePhase} (unknown codes count as `'cancel'`). */
export const phaseOf = (code: number): GesturePhase => PHASES[code] ?? 'cancel';

/** `true` for the last update of a gesture. */
export const isFinal = (phase: GesturePhase): boolean => phase === 'end' || phase === 'cancel';

/** Keeps `value` inside `[min, max]`. */
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Movement of a pan, as the end of the gesture sees it. */
export interface PanMotion {
  /** Horizontal distance. */
  translationX: number;
  /** Vertical distance. */
  translationY: number;
  /** Horizontal speed, px per second. */
  velocityX: number;
  /** Vertical speed, px per second. */
  velocityY: number;
}

/** Direction along the dominant axis of a movement. */
function dominantDirection(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * The swipe a finished pan makes, or `undefined`: the dominant axis of the
 * speed decides the direction, and both the speed and the distance along it
 * must reach the minimums.
 */
export function detectSwipe(motion: PanMotion, options: ResolvedSwipe): SwipeEvent | undefined {
  const direction = dominantDirection(motion.velocityX, motion.velocityY);
  const horizontal = direction === 'left' || direction === 'right';
  const speed = Math.abs(horizontal ? motion.velocityX : motion.velocityY);
  const distance = Math.abs(horizontal ? motion.translationX : motion.translationY);
  const sameWay = Math.sign(horizontal ? motion.translationX : motion.translationY) === Math.sign(horizontal ? motion.velocityX : motion.velocityY);
  const counts =
    options.directions.includes(direction) && sameWay && speed >= options.minVelocity && distance >= options.minDistance;
  return counts ? { direction, ...motion } : undefined;
}

const ALONG: Record<PanAxis, (dx: number, dy: number) => boolean> = {
  x: (dx, dy) => Math.abs(dx) > Math.abs(dy),
  y: (dx, dy) => Math.abs(dy) > Math.abs(dx),
  both: () => true,
};

/** `true` when a movement is mostly along `axis` (decides whether a pan may start). */
export const movesAlong = (axis: PanAxis, dx: number, dy: number): boolean => ALONG[axis](dx, dy);

/** A point on screen. */
export interface Point {
  /** Horizontal coordinate. */
  x: number;
  /** Vertical coordinate. */
  y: number;
}

/** Distance and angle between two fingers, and the point between them. */
export interface TwoFingers {
  /** Distance between the fingers. */
  distance: number;
  /** Angle of the line from the first finger to the second, in radians. */
  angle: number;
  /** Point between the fingers. */
  center: Point;
}

/** Measures two fingers (used by the web; the native recognizers do this themselves). */
export function twoFingers(a: Point, b: Point): TwoFingers {
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/** Difference between two angles, kept in `(-π, π]` so crossing the ±π line does not jump a full turn. */
export function angleDelta(from: number, to: number): number {
  const delta = to - from;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

/** A position at a moment (ms), for {@link velocityOf}. */
export interface Sample {
  /** Position. */
  value: number;
  /** Time in ms. */
  time: number;
}

/** How far back the speed looks, in ms: the last movement matters, not the whole drag. */
const VELOCITY_WINDOW_MS = 100;

/** Speed (units per second) over the most recent samples. */
export function velocityOf(samples: readonly Sample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.time - s.time <= VELOCITY_WINDOW_MS) ?? samples[0];
  const elapsed = last.time - first.time;
  return elapsed > 0 ? ((last.value - first.value) / elapsed) * 1000 : 0;
}

/* ───────────────────────── release and bounds ───────────────────────── */

/** The pan's axes that move the element. */
export const tracksX = (pan: ResolvedPan): boolean => pan.axis !== 'y';
/** The pan's axes that move the element. */
export const tracksY = (pan: ResolvedPan): boolean => pan.axis !== 'x';

/** The point of a sorted list nearest to `value`. */
function nearest(points: readonly number[], value: number): number {
  return points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), points[0]);
}

/** Where each release sends one axis: the raw position the finger left it at, and its speed. */
const RESTING: Record<PanRelease, (position: number, velocity: number, points: readonly number[]) => number> = {
  reset: () => 0,
  stay: (position) => position,
  decay: (position, velocity) => position + velocity * GESTURE_DEFAULTS.decayProjection,
  snap: (position, velocity, points) => nearest(points, position + velocity * GESTURE_DEFAULTS.snapProjection),
};

/**
 * Where a released pan comes to rest, inside the bounds. `position` is the raw offset from where the element
 * started (committed + translation, before bounds); axes the pan does not move keep `position`.
 */
export function restingPlace(pan: ResolvedPan, position: Point, velocity: Point): Point {
  const rest = RESTING[pan.release];
  return {
    x: tracksX(pan) ? clamp(rest(position.x, velocity.x, pan.snapX), pan.minX, pan.maxX) : position.x,
    y: tracksY(pan) ? clamp(rest(position.y, velocity.y, pan.snapY), pan.minY, pan.maxY) : position.y,
  };
}

/** How far the element shows past a bound for a raw `excess` past it (≥ 0): resists more the farther it goes. */
export function rubberBandExcess(excess: number, limit: number = GESTURE_DEFAULTS.rubberBandLimit): number {
  return (1 - 1 / ((excess * 0.55) / limit + 1)) * limit;
}

/** Where the element shows for a raw offset: clamped to the bounds, or past them with resistance. */
export function boundedOffset(raw: number, min: number, max: number, rubberBand: boolean): number {
  if (!rubberBand) return clamp(raw, min, max);
  if (raw < min) return min - rubberBandExcess(min - raw);
  if (raw > max) return max + rubberBandExcess(raw - max);
  return raw;
}

/** Excess distances sampled for the native rubber band (a piecewise curve close to {@link rubberBandExcess}). */
const RUBBER_SAMPLES = [0, 15, 40, 80, 150, 250, 400, 650, 1000, 1600, 2600, 5000];

/**
 * Input and output ranges that make a native interpolation show a raw offset the way {@link boundedOffset}
 * does (React Native's `interpolate` is piecewise linear, so the curve is sampled). `null` when nothing limits it.
 */
export function boundedRanges(min: number, max: number, rubberBand: boolean, far: number): { input: number[]; output: number[] } | null {
  if (min === -Infinity && max === Infinity) return null;
  if (!rubberBand) {
    const lo = Math.max(min, -far);
    const hi = Math.min(max, far);
    return { input: [lo, hi], output: [lo, hi] };
  }
  const below = Number.isFinite(min) ? [...RUBBER_SAMPLES].reverse().map((e) => min - e) : [-far];
  const above = Number.isFinite(max) ? RUBBER_SAMPLES.map((e) => max + e) : [far];
  // between the bounds the offset is shown as is; the two lists share the bounds themselves
  const input = [...below, ...above.filter((v) => v > below[below.length - 1])];
  return { input, output: input.map((v) => boundedOffset(v, min, max, true)) };
}

/** `true` when a raw offset is past one of the pan's bounds (for the haptic when the drag reaches them). */
export function pastBounds(pan: ResolvedPan, x: number, y: number): boolean {
  return (tracksX(pan) && (x < pan.minX || x > pan.maxX)) || (tracksY(pan) && (y < pan.minY || y > pan.maxY));
}

/** The snap axis the screen-reader actions move along: the vertical one when it has points, else the horizontal one. */
export function snapAxisOf(pan: ResolvedPan): 'x' | 'y' | undefined {
  if (tracksY(pan) && pan.snapY.length > 1) return 'y';
  if (tracksX(pan) && pan.snapX.length > 1) return 'x';
  return undefined;
}

/** The snap point after (`step` 1) or before (`step` -1) the one nearest to `at`, or `undefined` at the end of the list. */
export function stepSnap(points: readonly number[], at: number, step: 1 | -1): number | undefined {
  const index = points.indexOf(nearest(points, at));
  return points[index + step];
}

/** Cubic bezier easing (`x1, y1, x2, y2`) as a function of progress `0..1`, as CSS computes it. */
export function bezier([x1, y1, x2, y2]: readonly number[]): (t: number) => number {
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // find the curve parameter whose x is t (bisection: x(s) is increasing), then its y
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** The value of an interpolation at `value` of its source (piecewise, held past the ends; colors are mixed). */
export function interpolateAt(input: readonly number[], output: readonly (number | string)[], value: number): number | string {
  if (value <= input[0]) return output[0];
  const last = input.length - 1;
  if (value >= input[last]) return output[last];
  const i = input.findIndex((point) => point > value) - 1;
  const t = (value - input[i]) / (input[i + 1] - input[i]);
  return lerpValue(output[i], output[i + 1], t) ?? (t < 0.5 ? output[i] : output[i + 1]);
}

/** The swipe event a screen reader's swipe action reports (no finger: no distance, the minimum speed). */
export function swipeFromAction(direction: SwipeDirection, swipe: ResolvedSwipe): SwipeEvent {
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const horizontal = direction === 'left' || direction === 'right';
  const speed = sign * swipe.minVelocity;
  return { direction, translationX: 0, translationY: 0, velocityX: horizontal ? speed : 0, velocityY: horizontal ? 0 : speed };
}

/** The accessibility actions a gesture config adds, with the swipe direction or snap step each one runs. */
export interface GestureAction {
  /** Action name (as React Native names actions). */
  name: GestureActionName | 'longpress' | 'activate';
  /** Label read by the screen reader (standard actions have none). */
  label?: string;
}

const SWIPE_ACTIONS: Record<SwipeDirection, GestureActionName> = {
  left: 'swipeLeft',
  right: 'swipeRight',
  up: 'swipeUp',
  down: 'swipeDown',
};

/** Direction of a swipe action, by its name. */
export const SWIPE_OF_ACTION: Partial<Record<string, SwipeDirection>> = {
  swipeLeft: 'left',
  swipeRight: 'right',
  swipeUp: 'up',
  swipeDown: 'down',
};

/**
 * Screen-reader alternatives to the gestures: a swipe per direction, next/previous snap point, the long press
 * (`longpress`) and the double tap (`activate`, what a screen reader's double tap does).
 */
export function gestureActions(spec: ResolvedGestures): GestureAction[] {
  const labelled = (name: GestureActionName): GestureAction => ({ name, label: spec.actionLabels[name] });
  const swipes = (spec.swipe?.directions ?? []).map((d) => labelled(SWIPE_ACTIONS[d]));
  const snaps = spec.pan?.release === 'snap' && snapAxisOf(spec.pan) ? [labelled('snapNext'), labelled('snapPrevious')] : [];
  return [
    ...swipes,
    ...snaps,
    ...(spec.longPress ? [{ name: 'longpress' as const }] : []),
    ...(spec.doubleTap ? [{ name: 'activate' as const }] : []),
  ];
}
