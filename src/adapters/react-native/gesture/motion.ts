/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The animated side of `.gesture()` on mobile: the `Animated.Value`s the native
 * recognizer drives (native driver), the transform and styles built from them,
 * and what happens in JS at the start and end of a gesture (callbacks, release
 * glides, haptics, screen-reader actions).
 */
import { Animated, Dimensions, Easing } from 'react-native';
import {
  DECAY_BEZIER,
  GESTURE_DEFAULTS,
  RELEASE_BEZIER,
  SWIPE_OF_ACTION,
  bezier,
  boundedOffset,
  boundedRanges,
  clamp,
  detectSwipe,
  exitOffset,
  gestureActions,
  isFinal,
  pastBounds,
  phaseOf,
  restingPlace,
  snapAxisOf,
  stepSnap,
  swipeFromAction,
  tracksX,
  tracksY,
  type GesturePhase,
  type GestureProps,
  type GestureRelease,
  type InterpolationSource,
  type Point,
  type ResolvedGestures,
  type ResolvedPan,
  type ResolvedPinch,
  type SwipeEvent,
} from '../../../core/gesture';

/** A release glide still running on the UI thread, known in JS so a new drag can pick it up where it is. */
interface Glide {
  /** Distance from the resting place when it started (the value goes from this to 0). */
  delta: number;
  /** `Date.now()` when it started. */
  startedAt: number;
  /** Length in ms. */
  duration: number;
  /** Progress → eased progress (the same curve the native driver runs). */
  ease: (t: number) => number;
}

/** Values the element follows, plus what JS knows about where it rests. */
export interface Motion {
  /** Horizontal drag: offset = resting place, value = the live translation (or a release glide). */
  panX: Animated.Value;
  /** Vertical drag, like `panX`. */
  panY: Animated.Value;
  /** Horizontal resting place (the offset of `panX`). */
  restX: number;
  /** Vertical resting place (the offset of `panY`). */
  restY: number;
  /** Horizontal release glide, while it runs. */
  glideX?: Glide;
  /** Vertical release glide, while it runs. */
  glideY?: Glide;
  /** The drag is past its bounds (to tap the device once when it gets there). */
  past: boolean;
  /** Live pinch scale (1 at the start of each pinch). */
  liveScale: Animated.Value;
  /** Scale committed by earlier pinches. */
  baseScale: Animated.Value;
  /** Same as `baseScale`, known in JS. */
  committedScale: number;
  /** Live rotation in radians (0 at the start of each rotation). */
  liveRotation: Animated.Value;
  /** Rotation committed by earlier gestures. */
  baseRotation: Animated.Value;
  /** Same as `baseRotation`, known in JS. */
  committedRotation: number;
}

export function createMotion(): Motion {
  return {
    panX: new Animated.Value(0),
    panY: new Animated.Value(0),
    restX: 0,
    restY: 0,
    past: false,
    liveScale: new Animated.Value(1),
    baseScale: new Animated.Value(1),
    committedScale: 1,
    liveRotation: new Animated.Value(0),
    baseRotation: new Animated.Value(0),
    committedRotation: 0,
  };
}

/** Device taps the native view plays: 0 light (snap, bounds), 1 medium (swipe, long press). */
export type HapticKind = 0 | 1;

/** What the handlers need besides the motion: the latest callbacks and a way to tap the device. */
export interface GestureEnv {
  /** The element's latest gesture callbacks. */
  callbacks: GestureProps;
  /** Plays a device tap (no-op when `haptics` is off). */
  haptic: (kind: HapticKind) => void;
}

/* ───────────────────────── nodes ───────────────────────── */

/** `Animated.interpolate` needs finite ranges: an unlimited side becomes "far enough". */
const FAR = 1e6;

/** A raw offset node → the offset shown: clamped to the bounds or past them with resistance (no-op without bounds). */
function boundNode(node: Animated.Value, min: number, max: number, rubberBand: boolean): any {
  const ranges = boundedRanges(min, max, rubberBand, FAR);
  if (!ranges) return node;
  return node.interpolate({ inputRange: ranges.input, outputRange: ranges.output, extrapolate: 'clamp' });
}

/** Keeps a node inside `[min, max]` on the native side. */
const clampNode = (node: any, min: number, max: number): any =>
  node.interpolate({ inputRange: [min, max], outputRange: [min, max], extrapolate: 'clamp' });

/** The animated sources a gesture config shows: offsets, scale and rotation (what transforms and interpolations read). */
interface Sources {
  x?: any;
  y?: any;
  scale?: any;
  rotation?: any;
}

function sourcesOf(spec: ResolvedGestures, motion: Motion): Sources {
  const { pan, pinch, rotate } = spec;
  const panFollows = !!pan?.follow;
  return {
    x: panFollows && tracksX(pan) ? boundNode(motion.panX, pan.minX, pan.maxX, pan.rubberBand) : undefined,
    y: panFollows && tracksY(pan) ? boundNode(motion.panY, pan.minY, pan.maxY, pan.rubberBand) : undefined,
    scale: pinch?.follow ? clampNode(Animated.multiply(motion.baseScale, motion.liveScale), pinch.minScale, pinch.maxScale) : undefined,
    rotation: rotate?.follow ? Animated.add(motion.baseRotation, motion.liveRotation) : undefined,
  };
}

/** A source that does not move the element still drives interpolations, from its resting value. */
const RESTING_SOURCE: Record<InterpolationSource, number> = { x: 0, y: 0, scale: 1, rotation: 0 };

/**
 * The part of the style the fingers drive: the transform (move, scale, rotate, in this order) and the
 * `interpolate` styles (opacity, colors), all on the native driver.
 */
export function motionStyle(spec: ResolvedGestures, motion: Motion): { transform: Array<Record<string, unknown>>; props: Record<string, unknown> } {
  const sources = sourcesOf(spec, motion);
  const transform = [
    ...(sources.x ? [{ translateX: sources.x }] : []),
    ...(sources.y ? [{ translateY: sources.y }] : []),
    ...(sources.scale ? [{ scale: sources.scale }] : []),
    // radians → the `'1rad'` string the transform takes (extended past the range, not clamped)
    ...(sources.rotation ? [{ rotate: sources.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0rad', '1rad'] }) }] : []),
  ];
  const props: Record<string, unknown> = {};
  for (const item of spec.interpolate) {
    const source = sources[item.from] ?? new Animated.Value(RESTING_SOURCE[item.from]);
    for (const [prop, output] of item.style) {
      props[prop] = source.interpolate({ inputRange: item.input, outputRange: output, extrapolate: 'clamp' });
    }
  }
  return { transform, props };
}

/* ───────────────────────── pan release ───────────────────────── */

const RELEASE_EASE = bezier(RELEASE_BEZIER);
const DECAY_EASE = bezier(DECAY_BEZIER);

/** The glides' curves: in JS (`ease`, to know where a glide is) and for the native driver (`easing`, built on first use). */
const GLIDES: Record<'release' | 'decay', { duration: number; ease: (t: number) => number; bezier: readonly number[] }> = {
  release: { duration: GESTURE_DEFAULTS.releaseMs, ease: RELEASE_EASE, bezier: RELEASE_BEZIER },
  decay: { duration: GESTURE_DEFAULTS.decayMs, ease: DECAY_EASE, bezier: DECAY_BEZIER },
};
const easings = new Map<readonly number[], (t: number) => number>();
const easingOf = (points: readonly number[]) => {
  if (!easings.has(points)) easings.set(points, Easing.bezier(points[0], points[1], points[2], points[3]));
  return easings.get(points)!;
};

/** Where a running glide is now, as a distance from its resting place (0 when it ended or never ran). */
function residual(glide: Glide | undefined, now: number): number {
  if (!glide) return 0;
  const t = clamp((now - glide.startedAt) / glide.duration, 0, 1);
  return glide.delta * (1 - glide.ease(t));
}

type Axis = 'x' | 'y';
const AXIS = {
  x: { value: (m: Motion) => m.panX, rest: 'restX', glide: 'glideX' },
  y: { value: (m: Motion) => m.panY, rest: 'restY', glide: 'glideY' },
} as const;

/**
 * A new drag starts where the element is drawn: a release glide still running stops, and its remaining
 * distance becomes part of the resting place (the finger's translation starts at 0 again).
 */
function pickUp(motion: Motion, axis: Axis): void {
  const keys = AXIS[axis];
  const value = keys.value(motion);
  value.stopAnimation();
  motion[keys.rest] += residual(motion[keys.glide], Date.now());
  motion[keys.glide] = undefined;
  value.setOffset(motion[keys.rest]);
}

/** Glides one axis from where it is shown (`from`, raw) to a new resting place `to`. */
function glideAxis(motion: Motion, axis: Axis, from: number, to: number, kind: 'release' | 'decay'): void {
  const keys = AXIS[axis];
  const value = keys.value(motion);
  const glide = GLIDES[kind];
  motion[keys.rest] = to;
  value.setOffset(to);
  value.setValue(from - to);
  motion[keys.glide] = undefined;
  if (from === to) return;
  motion[keys.glide] = { delta: from - to, startedAt: Date.now(), duration: glide.duration, ease: glide.ease };
  Animated.timing(value, { toValue: 0, duration: glide.duration, easing: easingOf(glide.bezier), useNativeDriver: true, isInteraction: false }).start(
    ({ finished }) => {
      if (finished) motion[keys.glide] = undefined;
    },
  );
}

/** The raw offset the finger left the element at (resting place + translation); an axis the pan does not move stays at rest. */
const rawOf = (pan: ResolvedPan, motion: Motion, translation: Point): Point => ({
  x: motion.restX + (tracksX(pan) ? translation.x : 0),
  y: motion.restY + (tracksY(pan) ? translation.y : 0),
});

/** Where the glide starts: without the rubber band the element is drawn at the bounds, not past them. */
const shownFrom = (pan: ResolvedPan, raw: number, min: number, max: number) => (pan.rubberBand ? raw : boundedOffset(raw, min, max, false));

/** Glides the pan to a resting place (from a release or a screen-reader action), reporting a snap. */
function settle(spec: ResolvedGestures, pan: ResolvedPan, motion: Motion, env: GestureEnv, raw: Point, to: Point): void {
  const kind = pan.release === 'decay' ? 'decay' : 'release';
  const moved = to.x !== motion.restX || to.y !== motion.restY;
  if (tracksX(pan)) glideAxis(motion, 'x', shownFrom(pan, raw.x, pan.minX, pan.maxX), to.x, kind);
  if (tracksY(pan)) glideAxis(motion, 'y', shownFrom(pan, raw.y, pan.minY, pan.maxY), to.y, kind);
  if (pan.release !== 'snap') return;
  if (moved) env.haptic(0);
  env.callbacks.onSnap?.({ x: to.x, y: to.y });
}

/* ───────────────────────── pinch and rotation release ───────────────────────── */

const SPRING = { useNativeDriver: true, bounciness: 6, speed: 14 } as const;
const springTo = (value: Animated.Value, toValue: number) => Animated.spring(value, { ...SPRING, toValue }).start();

const PINCH_RELEASE: Record<GestureRelease, (motion: Motion, pinch: ResolvedPinch, scale: number) => void> = {
  reset: (motion) => springTo(motion.liveScale, 1),
  stay: (motion, pinch, scale) => {
    motion.committedScale = clamp(motion.committedScale * scale, pinch.minScale, pinch.maxScale);
    motion.baseScale.setValue(motion.committedScale);
    motion.liveScale.setValue(1);
  },
};

const ROTATE_RELEASE: Record<GestureRelease, (motion: Motion, rotation: number) => void> = {
  reset: (motion) => springTo(motion.liveRotation, 0),
  stay: (motion, rotation) => {
    motion.committedRotation += rotation;
    motion.baseRotation.setValue(motion.committedRotation);
    motion.liveRotation.setValue(0);
  },
};

/* ───────────────────────── events ───────────────────────── */

type NativeEvent<T> = { nativeEvent: T };

interface NativePan {
  state: number;
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
}
interface NativePinch {
  state: number;
  scale: number;
  velocity: number;
  focalX: number;
  focalY: number;
}
interface NativeRotate {
  state: number;
  rotation: number;
  velocity: number;
}
interface NativeTap {
  kind: number;
  x: number;
  y: number;
}

/** A spring-back still running when the fingers come down again stops where it is. */
const stopOnStart = (phase: GesturePhase, values: Animated.Value[]) => {
  if (phase === 'start') values.forEach((value) => value.stopAnimation());
};

/** `swipe.exit`: the element keeps going off screen (native driver), then `done` runs. */
function exitThen(motion: Motion, swiped: SwipeEvent, done: () => void): void {
  const target = exitOffset(swiped.direction, Dimensions.get('window'));
  const leave = (value: Animated.Value, rest: number, to: number) =>
    Animated.timing(value, { toValue: to - rest, duration: GESTURE_DEFAULTS.exitMs, useNativeDriver: true, isInteraction: false });
  motion.glideX = undefined;
  motion.glideY = undefined;
  Animated.parallel([leave(motion.panX, motion.restX, target.x), leave(motion.panY, motion.restY, target.y)]).start(done);
}

/** Taps the device once when the drag first goes past its bounds. */
function feelBounds(pan: ResolvedPan, motion: Motion, env: GestureEnv, raw: Point): void {
  const past = pastBounds(pan, raw.x, raw.y);
  if (past && !motion.past) env.haptic(0);
  motion.past = past;
}

/** The pan's follow-the-finger part: picks up a running glide at the start, glides to rest at the end. */
function followPan(spec: ResolvedGestures, pan: ResolvedPan, motion: Motion, env: GestureEnv, phase: GesturePhase, n: NativePan, exits: boolean) {
  if (phase === 'start') {
    if (tracksX(pan)) pickUp(motion, 'x');
    if (tracksY(pan)) pickUp(motion, 'y');
    motion.past = false;
  }
  const raw = rawOf(pan, motion, { x: n.translationX, y: n.translationY });
  if (!isFinal(phase)) {
    feelBounds(pan, motion, env, raw);
    return;
  }
  if (exits) return;
  settle(spec, pan, motion, env, raw, restingPlace(pan, raw, { x: n.velocityX, y: n.velocityY }));
}

function onPan(spec: ResolvedGestures, motion: Motion, env: GestureEnv) {
  return ({ nativeEvent: n }: NativeEvent<NativePan>) => {
    const phase = phaseOf(n.state);
    const { pan, swipe } = spec;
    const swiped = swipe && phase === 'end' ? detectSwipe(n, swipe) : undefined;
    const exits = !!swiped && !!swipe?.exit && !!pan?.follow;
    if (pan?.follow) followPan(spec, pan, motion, env, phase, n, exits);
    if (pan) {
      env.callbacks.onPan?.({
        phase,
        translationX: n.translationX,
        translationY: n.translationY,
        velocityX: n.velocityX,
        velocityY: n.velocityY,
        x: n.x,
        y: n.y,
      });
    }
    if (swiped) env.haptic(1);
    if (swiped && exits) exitThen(motion, swiped, () => env.callbacks.onSwipe?.(swiped));
    else if (swiped) env.callbacks.onSwipe?.(swiped);
  };
}

function onPinch(spec: ResolvedGestures, motion: Motion, env: GestureEnv) {
  return ({ nativeEvent: n }: NativeEvent<NativePinch>) => {
    const phase = phaseOf(n.state);
    const { pinch } = spec;
    if (pinch?.follow) {
      stopOnStart(phase, [motion.liveScale]);
      if (isFinal(phase)) PINCH_RELEASE[pinch.release](motion, pinch, n.scale);
    }
    env.callbacks.onPinch?.({ phase, scale: n.scale, velocity: n.velocity, focalX: n.focalX, focalY: n.focalY });
  };
}

function onRotate(spec: ResolvedGestures, motion: Motion, env: GestureEnv) {
  return ({ nativeEvent: n }: NativeEvent<NativeRotate>) => {
    const phase = phaseOf(n.state);
    const { rotate } = spec;
    if (rotate?.follow) {
      stopOnStart(phase, [motion.liveRotation]);
      if (isFinal(phase)) ROTATE_RELEASE[rotate.release](motion, n.rotation);
    }
    env.callbacks.onRotate?.({ phase, rotation: n.rotation, velocity: n.velocity });
  };
}

/** `kind` from the native side → what it does: double tap, or long press (with a device tap). */
const TAPS: ReadonlyArray<(env: GestureEnv, at: { x: number; y: number }) => void> = [
  (env, at) => env.callbacks.onDoubleTap?.(at),
  (env, at) => {
    env.haptic(1);
    env.callbacks.onLongPress?.(at);
  },
];

const onTap = (env: GestureEnv) => ({ nativeEvent: n }: NativeEvent<NativeTap>) => TAPS[n.kind]?.(env, { x: n.x, y: n.y });

/**
 * With `follow`, the event drives `Animated.Value`s on the UI thread (native
 * driver) and JS gets it as the `listener`; without it, a plain JS handler.
 */
function drive(mapping: Record<string, Animated.Value> | undefined, listener: (event: any) => void): any {
  if (!mapping) return listener;
  return Animated.event([{ nativeEvent: mapping }], { useNativeDriver: true, listener });
}

function panMapping(pan: ResolvedPan | undefined, motion: Motion): Record<string, Animated.Value> | undefined {
  if (!pan?.follow) return undefined;
  return {
    ...(tracksX(pan) ? { translationX: motion.panX } : null),
    ...(tracksY(pan) ? { translationY: motion.panY } : null),
  };
}

/** The native view's event props for a gesture config (stable while the config does not change). */
export function bindGestures(spec: ResolvedGestures, motion: Motion, env: GestureEnv): Record<string, unknown> {
  const handlers: Record<string, unknown> = {};
  if (spec.trackAxis !== 'none') handlers.onIsoPan = drive(panMapping(spec.pan, motion), onPan(spec, motion, env));
  if (spec.pinch) {
    const mapping = spec.pinch.follow ? { scale: motion.liveScale } : undefined;
    handlers.onIsoPinch = drive(mapping, onPinch(spec, motion, env));
  }
  if (spec.rotate) {
    const mapping = spec.rotate.follow ? { rotation: motion.liveRotation } : undefined;
    handlers.onIsoRotate = drive(mapping, onRotate(spec, motion, env));
  }
  if (spec.doubleTap || spec.longPress) handlers.onIsoTap = onTap(env);
  return handlers;
}

/* ───────────────────────── screen-reader actions ───────────────────────── */

/** Where the pan is drawn now (its resting place plus what is left of a running glide). */
const shownNow = (motion: Motion): Point => {
  const now = Date.now();
  return { x: motion.restX + residual(motion.glideX, now), y: motion.restY + residual(motion.glideY, now) };
};

/** A swipe from a screen reader: the same as a real one (exit animation included), without a finger. */
function swipeAction(spec: ResolvedGestures, motion: Motion, env: GestureEnv, name: string): boolean {
  const direction = SWIPE_OF_ACTION[name];
  if (!direction || !spec.swipe) return false;
  const swiped = swipeFromAction(direction, spec.swipe);
  if (spec.swipe.exit && spec.pan?.follow) exitThen(motion, swiped, () => env.callbacks.onSwipe?.(swiped));
  else env.callbacks.onSwipe?.(swiped);
  return true;
}

/** Next/previous snap point from a screen reader. */
function snapAction(spec: ResolvedGestures, motion: Motion, env: GestureEnv, name: string): boolean {
  const pan = spec.pan;
  const axis = pan && snapAxisOf(pan);
  if (!pan || !axis || (name !== 'snapNext' && name !== 'snapPrevious')) return false;
  const from = shownNow(motion);
  const points = axis === 'x' ? pan.snapX : pan.snapY;
  const target = stepSnap(points, from[axis], name === 'snapNext' ? 1 : -1);
  if (target === undefined) return true;
  ['x', 'y'].forEach((a) => AXIS[a as Axis].value(motion).stopAnimation());
  settle(spec, pan, motion, env, from, { ...from, [axis]: target });
  return true;
}

const STANDARD_ACTIONS: Record<string, (env: GestureEnv) => void> = {
  longpress: (env) => env.callbacks.onLongPress?.({ x: 0, y: 0 }),
  activate: (env) => env.callbacks.onDoubleTap?.({ x: 0, y: 0 }),
};

/**
 * Accessibility props for the gestures: the actions (merged with the element's own) and the handler that runs
 * them, passing every other action on to the element's own `onAccessibilityAction`.
 */
export function accessibilityOf(spec: ResolvedGestures, motion: Motion, env: GestureEnv, props: Record<string, any>): Record<string, unknown> {
  const actions = gestureActions(spec);
  if (!actions.length) return {};
  const own: Array<{ name: string }> = props.accessibilityActions ?? [];
  const ownNames = new Set(own.map((a) => a.name));
  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const name = event.nativeEvent.actionName;
    const handled = !ownNames.has(name) && (swipeAction(spec, motion, env, name) || snapAction(spec, motion, env, name) || runStandard(env, name));
    if (!handled) props.onAccessibilityAction?.(event);
  };
  return {
    // the actions are only reachable on an accessible element; `accessible={false}` on the element still wins
    accessible: props.accessible ?? true,
    accessibilityActions: [...own, ...actions.filter((a) => !ownNames.has(a.name))],
    onAccessibilityAction,
  };
}

function runStandard(env: GestureEnv, name: string): boolean {
  const run = STANDARD_ACTIONS[name];
  run?.(env);
  return !!run;
}
