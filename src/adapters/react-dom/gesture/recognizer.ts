/**
 * `.gesture()` on the web: Pointer Events on the element (plus the trackpad's
 * pinch: `ctrl` + wheel, and Safari's gesture events). The element follows the
 * fingers through the individual CSS transform properties (`translate`, `scale`,
 * `rotate`), written straight to the element (no React render per move); they
 * compose with any `transform` the style already has.
 */
import {
  DECAY_BEZIER,
  GESTURE_DEFAULTS,
  RELEASE_BEZIER,
  angleDelta,
  boundedOffset,
  clamp,
  detectSwipe,
  exitOffset,
  interpolateAt,
  movesAlong,
  pastBounds,
  restingPlace,
  tracksX,
  tracksY,
  twoFingers,
  velocityOf,
  type GesturePhase,
  type GestureProps,
  type InterpolationSource,
  type PanMotion,
  type Point,
  type ResolvedGestures,
  type ResolvedPan,
  type Sample,
  type SwipeDirection,
  type TwoFingers,
} from '../../../core/gesture';

/** What the recognizer reads on every event (the latest props, without re-attaching listeners). */
export interface GestureSource {
  /** The gestures that are on. */
  spec: ResolvedGestures;
  /** The latest callbacks. */
  callbacks: GestureProps;
}

/** How a change is drawn: at once, or gliding (a release, or a `decay`). */
type Glide = 'none' | 'release' | 'decay';

const cubic = (points: readonly number[]) => `cubic-bezier(${points.join(',')})`;
const GLIDE_TIMING: Record<Exclude<Glide, 'none'>, string> = {
  release: `${GESTURE_DEFAULTS.releaseMs}ms ${cubic(RELEASE_BEZIER)}`,
  decay: `${GESTURE_DEFAULTS.decayMs}ms ${cubic(DECAY_BEZIER)}`,
};

/** Rotation needed before a rotation starts (about 6°), so a pinch does not also rotate by accident. */
const ROTATION_SLOP = 0.1;

/** How long after the last `ctrl` + wheel event a trackpad pinch ends, in ms. */
const WHEEL_END_MS = 150;

/** How much one wheel unit scales a trackpad pinch. */
const WHEEL_SCALE = 0.01;

/**
 * Events an element's recognizer already acted on. Pointer events bubble from the innermost element up, so a
 * parent with `.gesture()` sees the event after its child and leaves it alone: the innermost wins.
 */
const claimedEvents = new WeakSet<Event>();

/** What the browser may still do with a touch on the element (scrolling the other axis, no double-tap zoom). */
function touchActionOf(spec: ResolvedGestures): string {
  if (spec.pinch || spec.rotate) return 'none';
  const byAxis: Record<ResolvedGestures['trackAxis'], string> = { x: 'pan-y', y: 'pan-x', both: 'none', none: 'manipulation' };
  return byAxis[spec.trackAxis];
}

const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

/** Numbers of a computed CSS value (`'12px 4px'` → `[12, 4]`; `'none'` → `[]`). */
const numbersOf = (value: string | undefined): number[] => (value?.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);

/** A computed `rotate` (`'30deg'`, `'0.5rad'`, `'0.1turn'`) in radians. */
function radiansOf(value: string | undefined): number {
  const [amount = 0] = numbersOf(value);
  if (value?.includes('rad')) return amount;
  if (value?.includes('turn')) return amount * 2 * Math.PI;
  return (amount * Math.PI) / 180;
}

/** Safari's trackpad gesture event (not in the DOM typings). */
interface SafariGestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

/** State of one element's gestures. */
class Recognizer {
  private pointers = new Map<number, Point>();
  private primary = -1;
  private start: Point = { x: 0, y: 0 };
  private origin: Point = { x: 0, y: 0 };
  private samplesX: Sample[] = [];
  private samplesY: Sample[] = [];
  private moved = false;
  private panActive = false;
  private past = false;
  private two?: TwoFingers;
  private pinchActive = false;
  private rotateActive = false;
  private scale = 1;
  private rotation = 0;
  private scaleSamples: Sample[] = [];
  private rotationSamples: Sample[] = [];
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private longPressFired = false;
  private lastTap?: { time: number; point: Point };
  private wheelTimer?: ReturnType<typeof setTimeout>;
  private trackpad = false;
  // what the element shows: committed (where it rests) + live (the fingers)
  private committed = { x: 0, y: 0, scale: 1, rotation: 0 };
  private live = { x: 0, y: 0, scale: 1, rotation: 0 };

  constructor(
    private readonly el: HTMLElement,
    private readonly read: () => GestureSource,
  ) {
    // also draws the `interpolate` styles at the resting place
    this.pickUp();
  }

  private get spec() {
    return this.read().spec;
  }

  private get callbacks() {
    return this.read().callbacks;
  }

  /* ── pointer events ── */

  down = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // a pointer that went down again was released where we could not see it: it starts over
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) this.follows(true);
    this.pointers.set(event.pointerId, pointOf(event));
    if (this.pointers.size === 1) this.beginOne(event);
    if (this.pointers.size === 2) this.beginTwo();
  };

  move = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, pointOf(event));
    if (claimedEvents.has(event) && !this.owns()) {
      this.yieldToChild();
      return;
    }
    if (event.pointerId === this.primary) this.moveOne(event);
    if (this.pointers.size >= 2) this.moveTwo();
    if (this.owns()) claimedEvents.add(event);
  };

  up = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    const phase: GesturePhase = event.type === 'pointercancel' ? 'cancel' : 'end';
    this.pointers.set(event.pointerId, pointOf(event));
    if (this.pointers.size === 2) this.endTwo(phase);
    if (event.pointerId === this.primary) this.endOne(event, phase);
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) this.follows(false);
  };

  /**
   * While a pointer is down, its moves and its release are read on the window: a mouse that leaves the element
   * before the drag starts (it is only captured then) would otherwise lift where the element never hears it, and
   * the next press would look like a second finger. Listeners are added in the order the elements got the
   * `pointerdown` (innermost first), so the innermost still sees each event first.
   */
  private following = false;
  private follows(on: boolean): void {
    if (on === this.following || typeof window === 'undefined') return;
    this.following = on;
    const toggle = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
    toggle('pointermove', this.move);
    toggle('pointerup', this.up);
    toggle('pointercancel', this.up);
  }

  /** A gesture of this element is running (it keeps the touch). */
  private owns(): boolean {
    return this.panActive || this.pinchActive || this.rotateActive;
  }

  /** An inner element with `.gesture()` took the touch: nothing starts here until the fingers lift. */
  private yieldToChild(): void {
    this.cancelLongPress();
    this.moved = true;
    this.primary = -1;
    this.two = undefined;
  }

  /**
   * Keeps receiving the moves outside the element. Only once a drag or pinch has really started: capturing on
   * `pointerdown` would redirect the `click` of a child (a Pressable inside) to the element.
   */
  private capture(pointerId: number): void {
    try {
      this.el.setPointerCapture(pointerId);
    } catch {
      // a pointer that already ended cannot be captured: the gesture still works over the element
    }
  }

  /** Starts from where the element is drawn now: a release glide still running stops there. */
  private pickUp(): void {
    const style = this.el.style;
    const computed = typeof getComputedStyle === 'function' ? getComputedStyle(this.el) : undefined;
    const translate = numbersOf(computed?.translate || style.translate);
    const [scale] = numbersOf(computed?.scale || style.scale);
    this.committed = {
      x: translate[0] ?? 0,
      y: translate[1] ?? 0,
      scale: scale ?? 1,
      rotation: radiansOf(computed?.rotate || style.rotate),
    };
    this.live = { x: 0, y: 0, scale: 1, rotation: 0 };
    this.paint();
  }

  /* ── one finger: pan, swipe, taps ── */

  private beginOne(event: PointerEvent): void {
    const spec = this.spec;
    this.primary = event.pointerId;
    this.start = pointOf(event);
    const rect = this.el.getBoundingClientRect();
    this.origin = { x: rect.left, y: rect.top };
    this.samplesX = [{ value: event.clientX, time: event.timeStamp }];
    this.samplesY = [{ value: event.clientY, time: event.timeStamp }];
    this.moved = false;
    this.panActive = false;
    this.past = false;
    this.longPressFired = false;
    if (this.el.style.transition) this.pickUp();
    if (spec.longPress) {
      const at = this.local(event);
      this.longPressTimer = setTimeout(() => {
        this.longPressFired = true;
        this.haptic(1);
        this.callbacks.onLongPress?.(at);
      }, spec.longPress.minDuration);
    }
  }

  private moveOne(event: PointerEvent): void {
    const spec = this.spec;
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    this.samplesX.push({ value: event.clientX, time: event.timeStamp });
    this.samplesY.push({ value: event.clientY, time: event.timeStamp });
    if (!this.moved && Math.hypot(dx, dy) > GESTURE_DEFAULTS.panSlop) {
      this.moved = true;
      this.cancelLongPress();
    }
    if (spec.trackAxis === 'none') return;
    const twoFingersOwnIt = !spec.simultaneous && (this.pinchActive || this.rotateActive);
    if (!this.panActive && (!this.moved || this.pointers.size > 1 || twoFingersOwnIt || !movesAlong(spec.trackAxis, dx, dy))) return;
    const phase: GesturePhase = this.panActive ? 'move' : 'start';
    if (!this.panActive) this.capture(event.pointerId);
    this.panActive = true;
    this.follow(dx, dy);
    this.emitPan(phase, event, dx, dy);
  }

  private endOne(event: PointerEvent, phase: GesturePhase): void {
    this.cancelLongPress();
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    if (this.panActive) this.finishPan(phase, event, dx, dy);
    const isTap = phase === 'end' && !this.moved && !this.longPressFired && !this.panActive;
    if (isTap) this.tap(event);
    this.panActive = false;
    this.primary = -1;
  }

  private emitPan(phase: GesturePhase, event: PointerEvent, translationX: number, translationY: number): PanMotion {
    const { spec, callbacks } = this.read();
    const motion = { translationX, translationY, velocityX: velocityOf(this.samplesX), velocityY: velocityOf(this.samplesY) };
    if (spec.pan) callbacks.onPan?.({ phase, ...motion, ...this.local(event) });
    return motion;
  }

  /** Last pan update, then the swipe (if any) and the release, or the exit off screen with `swipe.exit`. */
  private finishPan(phase: GesturePhase, event: PointerEvent, dx: number, dy: number): void {
    const { spec, callbacks } = this.read();
    const motion = this.emitPan(phase, event, dx, dy);
    const swiped = spec.swipe && phase === 'end' ? detectSwipe(motion, spec.swipe) : undefined;
    if (swiped) this.haptic(1);
    if (swiped && spec.swipe?.exit && spec.pan?.follow) {
      this.exit(swiped.direction, () => callbacks.onSwipe?.(swiped));
      return;
    }
    this.releasePan(dx, dy, { x: motion.velocityX, y: motion.velocityY });
    if (swiped) callbacks.onSwipe?.(swiped);
  }

  /** `swipe.exit`: the element keeps going off screen, then `done` runs. */
  private exit(direction: SwipeDirection, done: () => void): void {
    const target = exitOffset(direction, { width: window.innerWidth, height: window.innerHeight });
    this.live.x = target.x - this.committed.x;
    this.live.y = target.y - this.committed.y;
    this.paint('none', `${GESTURE_DEFAULTS.exitMs}ms ease-in`);
    setTimeout(done, GESTURE_DEFAULTS.exitMs);
  }

  private tap(event: PointerEvent): void {
    if (!this.spec.doubleTap) return;
    const point = pointOf(event);
    const last = this.lastTap;
    const isSecond =
      !!last &&
      event.timeStamp - last.time <= GESTURE_DEFAULTS.doubleTapMs &&
      Math.hypot(point.x - last.point.x, point.y - last.point.y) <= GESTURE_DEFAULTS.tapSlop * 2;
    this.lastTap = isSecond ? undefined : { time: event.timeStamp, point };
    if (isSecond) this.callbacks.onDoubleTap?.(this.local(event));
  }

  private cancelLongPress(): void {
    clearTimeout(this.longPressTimer);
    this.longPressTimer = undefined;
  }

  /* ── two fingers: pinch, rotate ── */

  private fingers(): TwoFingers {
    const [a, b] = [...this.pointers.values()];
    return twoFingers(a, b);
  }

  private captureAll(): void {
    this.pointers.forEach((_, id) => this.capture(id));
  }

  private beginTwo(): void {
    this.cancelLongPress();
    this.moved = true;
    this.two = this.fingers();
    this.resetTwo();
  }

  private resetTwo(): void {
    this.scale = 1;
    this.rotation = 0;
    this.scaleSamples = [];
    this.rotationSamples = [];
  }

  private moveTwo(): void {
    if (!this.two) return;
    const now = this.fingers();
    const time = performance.now();
    this.scale = this.two.distance > 0 ? now.distance / this.two.distance : 1;
    this.rotation = angleDelta(this.two.angle, now.angle);
    this.scaleSamples.push({ value: this.scale, time });
    this.rotationSamples.push({ value: this.rotation, time });
    this.trackTwo(now.center, this.two.distance);
  }

  /** Starts pinch/rotation once past their slop and reports them (fingers or trackpad). */
  private trackTwo(center: Point, startDistance: number): void {
    const spec = this.spec;
    // with `simultaneous` off, a pan already running keeps the touch
    if (!spec.simultaneous && this.panActive) return;
    if (spec.pinch) {
      const starts = !this.pinchActive && Math.abs(this.scale - 1) * startDistance > GESTURE_DEFAULTS.panSlop;
      if (starts && !this.trackpad) this.captureAll();
      this.pinchActive ||= starts;
      if (this.pinchActive) this.emitPinch(starts ? 'start' : 'move', center);
    }
    if (spec.rotate) {
      const starts = !this.rotateActive && Math.abs(this.rotation) > ROTATION_SLOP;
      if (starts && !this.pinchActive && !this.trackpad) this.captureAll();
      this.rotateActive ||= starts;
      if (this.rotateActive) this.emitRotate(starts ? 'start' : 'move');
    }
    this.followTwo();
  }

  private endTwo(phase: GesturePhase, center?: Point): void {
    if (this.pinchActive) this.emitPinch(phase, center ?? this.fingers().center);
    if (this.rotateActive) this.emitRotate(phase);
    this.releaseTwo();
    this.pinchActive = false;
    this.rotateActive = false;
    this.two = undefined;
  }

  private emitPinch(phase: GesturePhase, center: Point): void {
    const focal = { x: center.x - this.origin.x, y: center.y - this.origin.y };
    this.callbacks.onPinch?.({ phase, scale: this.scale, velocity: velocityOf(this.scaleSamples), focalX: focal.x, focalY: focal.y });
  }

  private emitRotate(phase: GesturePhase): void {
    this.callbacks.onRotate?.({ phase, rotation: this.rotation, velocity: velocityOf(this.rotationSamples) });
  }

  /* ── trackpad: ctrl + wheel (Chrome, Firefox, Edge) and Safari's gesture events ── */

  /** Begins a trackpad pinch/rotation (no pointers are down). */
  private beginTrackpad(): void {
    if (this.el.style.transition) this.pickUp();
    const rect = this.el.getBoundingClientRect();
    this.origin = { x: rect.left, y: rect.top };
    this.trackpad = true;
    this.resetTwo();
  }

  private endTrackpad(center: Point): void {
    this.endTwo('end', center);
    this.trackpad = false;
  }

  wheel = (event: WheelEvent): void => {
    if (!event.ctrlKey || !this.spec.pinch || this.pointers.size || claimedEvents.has(event)) return;
    claimedEvents.add(event);
    // the browser would zoom the page
    event.preventDefault();
    if (!this.trackpad) this.beginTrackpad();
    const center = { x: event.clientX, y: event.clientY };
    this.scale *= Math.exp(-event.deltaY * WHEEL_SCALE);
    this.scaleSamples.push({ value: this.scale, time: performance.now() });
    // a trackpad pinch starts at once: the slop is for fingers that may only be resting
    this.trackTwo(center, Infinity);
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.endTrackpad(center), WHEEL_END_MS);
  };

  gesture = (event: Event): void => {
    const e = event as SafariGestureEvent;
    // on a touch screen the pointer events already carry the two fingers
    if (this.pointers.size || (!this.spec.pinch && !this.spec.rotate) || claimedEvents.has(event)) return;
    claimedEvents.add(event);
    event.preventDefault();
    const center = { x: e.clientX, y: e.clientY };
    if (event.type === 'gesturestart') this.beginTrackpad();
    if (!this.trackpad) return;
    if (event.type === 'gestureend') {
      this.endTrackpad(center);
      return;
    }
    const time = performance.now();
    this.scale = e.scale;
    this.rotation = (e.rotation * Math.PI) / 180;
    this.scaleSamples.push({ value: this.scale, time });
    this.rotationSamples.push({ value: this.rotation, time });
    this.trackTwo(center, Infinity);
  };

  /* ── the element follows ── */

  private follow(dx: number, dy: number): void {
    const pan = this.spec.pan;
    if (!pan?.follow) return;
    const raw = this.rawOf(pan, dx, dy);
    this.live.x = tracksX(pan) ? boundedOffset(raw.x, pan.minX, pan.maxX, pan.rubberBand) - this.committed.x : 0;
    this.live.y = tracksY(pan) ? boundedOffset(raw.y, pan.minY, pan.maxY, pan.rubberBand) - this.committed.y : 0;
    const past = pastBounds(pan, raw.x, raw.y);
    if (past && !this.past) this.haptic(0);
    this.past = past;
    this.paint();
  }

  /** The raw offset the finger is at (resting place + translation); an axis the pan does not move stays at rest. */
  private rawOf(pan: ResolvedPan, dx: number, dy: number): Point {
    return { x: this.committed.x + (tracksX(pan) ? dx : 0), y: this.committed.y + (tracksY(pan) ? dy : 0) };
  }

  private followTwo(): void {
    const { pinch, rotate } = this.spec;
    if (pinch?.follow && this.pinchActive) {
      this.live.scale = clamp(this.committed.scale * this.scale, pinch.minScale, pinch.maxScale) / this.committed.scale;
    }
    if (rotate?.follow && this.rotateActive) this.live.rotation = this.rotation;
    this.paint();
  }

  /** Glides to where the release says (reset, stay, decay, snap), inside the bounds. */
  private releasePan(dx: number, dy: number, velocity: Point): void {
    const pan = this.spec.pan;
    if (!pan?.follow) return;
    const to = restingPlace(pan, this.rawOf(pan, dx, dy), velocity);
    const moved = to.x !== this.committed.x || to.y !== this.committed.y;
    // the glide starts where the element is drawn (committed + live) and ends at the new resting place
    this.committed.x = to.x;
    this.committed.y = to.y;
    this.live.x = 0;
    this.live.y = 0;
    this.paint(pan.release === 'decay' ? 'decay' : 'release');
    if (pan.release !== 'snap') return;
    if (moved) this.haptic(0);
    this.callbacks.onSnap?.({ x: to.x, y: to.y });
  }

  private releaseTwo(): void {
    const { pinch, rotate } = this.spec;
    const stays = { scale: pinch?.release === 'stay', rotation: rotate?.release === 'stay' };
    if (stays.scale) this.committed.scale *= this.live.scale;
    if (stays.rotation) this.committed.rotation += this.live.rotation;
    this.live.scale = 1;
    this.live.rotation = 0;
    this.paint(!stays.scale || !stays.rotation ? 'release' : 'none');
  }

  /** Writes the transform and the `interpolate` styles; with a glide, they all transition together. */
  private paint(glide: Glide = 'none', timing: string = glide === 'none' ? '' : GLIDE_TIMING[glide]): void {
    const style = this.el.style as CSSStyleDeclaration & Record<string, string>;
    const shown: Record<InterpolationSource, number> = {
      x: this.committed.x + this.live.x,
      y: this.committed.y + this.live.y,
      scale: this.committed.scale * this.live.scale,
      rotation: this.committed.rotation + this.live.rotation,
    };
    const interpolated = this.spec.interpolate.flatMap((item) =>
      item.style.map(([prop, output]) => [prop, interpolateAt(item.input, output, shown[item.from])] as const),
    );
    const props = ['translate', 'scale', 'rotate', ...interpolated.map(([prop]) => toCss(prop))];
    style.transition = timing ? props.map((p) => `${p} ${timing}`).join(',') : '';
    style.translate = shown.x || shown.y ? `${shown.x}px ${shown.y}px` : '';
    style.scale = shown.scale !== 1 ? String(shown.scale) : '';
    style.rotate = shown.rotation ? `${shown.rotation}rad` : '';
    for (const [prop, value] of interpolated) style[prop] = String(value);
  }

  /** Taps the device (where the browser can: `navigator.vibrate`), when `haptics` is on. */
  private haptic(kind: 0 | 1): void {
    if (!this.spec.haptics || typeof navigator === 'undefined') return;
    navigator.vibrate?.(kind === 0 ? 8 : 15);
  }

  /** Position inside the element, from where it was when the finger came down. */
  private local(event: PointerEvent): Point {
    return { x: event.clientX - this.origin.x, y: event.clientY - this.origin.y };
  }

  dispose(): void {
    this.cancelLongPress();
    clearTimeout(this.wheelTimer);
    this.follows(false);
  }
}

/** `backgroundColor` → `background-color` (for `transition`). */
const toCss = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const SAFARI_GESTURES = ['gesturestart', 'gesturechange', 'gestureend'] as const;

/** A mouse drag must move the element, not select its text or drag its images out. */
const preventNativeDrag = (event: Event): void => event.preventDefault();

/** Starts recognizing on `el`; returns the function that stops it. */
export function attachGestures(el: HTMLElement, read: () => GestureSource): () => void {
  const recognizer = new Recognizer(el, read);
  const spec = read().spec;
  const style = el.style as CSSStyleDeclaration & Record<string, string>;
  const previous = { touchAction: style.touchAction, userSelect: style.userSelect, webkitUserSelect: style.webkitUserSelect };
  style.touchAction = touchActionOf(spec);
  style.userSelect = 'none';
  style.webkitUserSelect = 'none';
  // only the press is heard on the element; moves and the release are read on the window while it is down
  el.addEventListener('pointerdown', recognizer.down);
  el.addEventListener('dragstart', preventNativeDrag);
  const twoFingers = !!(spec.pinch || spec.rotate);
  // not passive: a pinch on the trackpad must not zoom the page
  if (spec.pinch) el.addEventListener('wheel', recognizer.wheel, { passive: false });
  if (twoFingers) SAFARI_GESTURES.forEach((type) => el.addEventListener(type, recognizer.gesture));
  return () => {
    el.removeEventListener('pointerdown', recognizer.down);
    el.removeEventListener('dragstart', preventNativeDrag);
    el.removeEventListener('wheel', recognizer.wheel);
    SAFARI_GESTURES.forEach((type) => el.removeEventListener(type, recognizer.gesture));
    Object.assign(style, previous);
    recognizer.dispose();
  };
}
