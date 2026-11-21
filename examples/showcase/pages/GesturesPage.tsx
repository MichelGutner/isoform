import { useMemo, useState } from 'react';
import { engine, type PanEvent, type PinchEvent, type RotateEvent, type SnapEvent, type SwipeEvent } from 'react-isoform';
import { Body, Heading, Row } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';

/**
 * `.gesture()` turns a `Box` into something the fingers can move. On mobile the recognizers are
 * native and the element follows them on the UI thread (the native driver), so a busy JS thread
 * does not make the drag stutter. On the web they are Pointer Events.
 */
const Pad = engine('Box', ({ theme }) => ({
  width: 120,
  height: 120,
  borderRadius: 24,
  backgroundColor: theme.color.primary,
  alignItems: 'center',
  justifyContent: 'center',
}));

const Stage = engine('Box', ({ theme }) => ({
  height: 240,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}));

const AXES = ['both', 'x', 'y'] as const;
const RELEASES = ['reset', 'stay', 'decay'] as const;

/** Drag, swipe, pinch, rotate, double tap and long press on one element. */
export function GesturesPage() {
  const [axis, setAxis] = useState<(typeof AXES)[number]>('both');
  const [release, setRelease] = useState<(typeof RELEASES)[number]>('reset');
  const [pinch, setPinch] = useState(true);
  const [rotate, setRotate] = useState(true);
  const [rubberBand, setRubberBand] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const { events, log } = useEventLog();

  // `.gesture()` adds a rule to the component it is called on, like `.style()`: branch with `.extend()` and
  // build it again only when the options change (a new component type per render would remount the tree)
  const Movable = useMemo(
    () =>
      Pad.extend().gesture({
        pan: { axis, release, rubberBand, bounds: { left: 140, right: 140, top: 80, bottom: 80 } },
        swipe: { directions: ['left', 'right'] },
        // pinch and rotate only keep 'reset' or 'stay'
        pinch: pinch && { release: release === 'reset' ? 'reset' : 'stay', minScale: 0.5, maxScale: 3 },
        rotate: rotate && { release: release === 'reset' ? 'reset' : 'stay' },
        doubleTap: true,
        longPress: true,
        haptics,
      }),
    [axis, release, pinch, rotate, rubberBand, haptics],
  );

  return (
    <PageShell
      title="Gestures"
      summary="With the gestures module on, .gesture() adds pan, swipe, pinch, rotate, double tap and long press to a Box. iOS: UIKit recognizers. Android: the lib's own recognizer. Web: Pointer Events. On mobile the element follows the fingers on the UI thread."
    >
      <Section title="Try it" hint="Drag, flick sideways, pinch or turn with two fingers, double-tap, or hold. Events are logged below.">
        <Choice label="pan axis" value={axis} options={AXES} onChange={setAxis} />
        <Choice label="release" value={release} options={RELEASES} onChange={setRelease} />
        <Flags>
          <Flag label="pinch" on={pinch} onChange={setPinch} />
          <Flag label="rotate" on={rotate} onChange={setRotate} />
          <Flag label="rubber band" on={rubberBand} onChange={setRubberBand} />
          <Flag label="haptics" on={haptics} onChange={setHaptics} />
        </Flags>
        <Stage>
          <Movable
            testID="gesture-pad"
            onPan={(e: PanEvent) => e.phase !== 'move' && log(`pan ${e.phase} (${Math.round(e.translationX)}, ${Math.round(e.translationY)})`)}
            onSwipe={(e: SwipeEvent) => log(`swipe ${e.direction}`)}
            onPinch={(e: PinchEvent) => e.phase !== 'move' && log(`pinch ${e.phase} ×${e.scale.toFixed(2)}`)}
            onRotate={(e: RotateEvent) => e.phase !== 'move' && log(`rotate ${e.phase} ${Math.round((e.rotation * 180) / Math.PI)}°`)}
            onDoubleTap={() => log('double tap')}
            onLongPress={() => log('long press')}
          >
            <Heading>Drag me</Heading>
          </Movable>
        </Stage>
        <EventLog events={events} />
      </Section>

      <Section title="Snap points" hint="Drag the knob sideways: it rests on the nearest point, and a flick reaches the next one. Past the ends it resists (rubber band).">
        <SnapDemo />
      </Section>

      <Section
        title="Swipe to dismiss"
        hint="The row follows the finger sideways and fades as it goes (interpolate); a quick flick sends it off screen (swipe.exit), then onSwipe removes it. Screen readers get a swipe action instead."
      >
        <SwipeRow />
      </Section>

      <Section title="In code">
        <Code>{`
// isoform.config.json
{ "modules": { "gestures": true } }

const Card = engine('Box', { width: 120, height: 120 }).gesture({
  pan: { axis: 'x', snap: { x: [-100, 0, 100] }, rubberBand: true, bounds: { left: 100, right: 100 } },
  swipe: { directions: ['left', 'right'] },
  pinch: { minScale: 0.5, maxScale: 3 },
  rotate: true,
  doubleTap: true,
  longPress: { minDuration: 400 },
  interpolate: [{ from: 'x', input: [-100, 0, 100], style: { opacity: [0.4, 1, 0.4] } }],
  haptics: true,
});

<Card
  onPan={(e) => {}}        // phase, translationX/Y, velocityX/Y, x, y
  onSwipe={(e) => {}}      // direction, velocityX/Y
  onPinch={(e) => {}}      // phase, scale, velocity, focalX/Y
  onRotate={(e) => {}}     // phase, rotation (radians)
  onDoubleTap={(e) => {}}  // x, y
  onLongPress={(e) => {}}
  onSnap={(e) => {}}       // x, y of the chosen point
/>
        `}</Code>
      </Section>
    </PageShell>
  );
}

const SwipeItem = engine('Box', ({ theme }) => ({
  padding: theme.spacing.md,
  borderRadius: 12,
  backgroundColor: theme.color.surface,
  borderWidth: 1,
  borderColor: theme.color.border,
})).gesture({
  // the row follows the finger sideways (vertical drags still scroll the page) and flies off on a swipe
  pan: { axis: 'x' },
  swipe: { directions: ['left', 'right'], minVelocity: 400, exit: true },
  // fades as it moves away, on the UI thread
  interpolate: [{ from: 'x', input: [-240, 0, 240], style: { opacity: [0.2, 1, 0.2] } }],
  haptics: true,
  actionLabels: { swipeLeft: 'Dismiss', swipeRight: 'Dismiss' },
});

/** Rows that fly off sideways when swiped. */
function SwipeRow() {
  const [rows, setRows] = useState(['Inbox zero', 'Pay the rent', 'Call mom']);
  return (
    <Row>
      {rows.map((label) => (
        <SwipeItem key={label} onSwipe={() => setRows((current) => current.filter((r) => r !== label))}>
          <Body>{label}</Body>
        </SwipeItem>
      ))}
      {rows.length === 0 ? <Body muted>All gone. Reload the page to bring them back.</Body> : null}
    </Row>
  );
}

const Track = engine('Box', ({ theme }) => ({
  height: 80,
  borderRadius: 40,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  alignItems: 'center',
  justifyContent: 'center',
}));

const SNAPS = [-120, 0, 120];

const Knob = engine('Box', ({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: theme.color.primary,
})).gesture({
  pan: { axis: 'x', snap: { x: SNAPS }, bounds: { left: 120, right: 120 }, rubberBand: true },
  // the knob grows clearer the closer it is to the middle
  interpolate: [{ from: 'x', input: SNAPS, style: { opacity: [0.6, 1, 0.6] } }],
  haptics: true,
});

const SNAP_NAMES: Record<number, string> = { [-120]: 'left', 0: 'middle', 120: 'right' };

/** A knob that rests on three points. */
function SnapDemo() {
  const [at, setAt] = useState('middle');
  return (
    <>
      <Track>
        <Knob accessibilityLabel="Position" onSnap={(e: SnapEvent) => setAt(SNAP_NAMES[e.x] ?? String(e.x))} />
      </Track>
      <Body muted>Resting on: {at}</Body>
    </>
  );
}
