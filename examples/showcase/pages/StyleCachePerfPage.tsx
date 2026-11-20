import { Profiler, memo, useEffect, useState, type ComponentType, type ProfilerOnRenderCallback } from 'react';
import { engine, getProvider } from 'react-isoform';
import { Code, Flag, PageShell, Section } from '../kit';
import { INLINE } from '../isoform.config';
import { Body, Card } from '../ui';

/**
 * Cost of styled components on a real device, in the situations that matter.
 *
 *  1. ALL MISSES: every run renders 300 cells whose style reads `size` with values never seen before,
 *     so each one compiles from scratch. The worst case.
 *  2. UNRELATED PROPS: the same 300 styles every run, but `testID` and an `onPress` closure are new each
 *     time (what any list row does). The style cache hits: the style does not read them.
 *  3. CONTROL: scenario 2 with the platform's own host component (`View` on mobile) and an inline style,
 *     no library at all. What 2 costs above this is what the library adds to a re-render.
 *
 * Compare with `INLINE` true and false (`isoform.config.ts`), reloading in between. Every run is also
 * logged (`[isoform-perf]`). Needs a development or profiling build: `Profiler` reports nothing in a
 * plain production build.
 */

const CELLS = 300;

interface Stats {
  runs: number;
  lastMs: number;
  bestMs: number;
  totalMs: number;
}

const makeStats = (): Stats => ({ runs: 0, lastMs: 0, bestMs: Infinity, totalMs: 0 });
const resetStats = (stats: Stats) => Object.assign(stats, makeStats());

/** Mutable on purpose: updating state from the Profiler callback would re-render what is measured. */
const misses = makeStats();
const unrelated = makeStats();
const control = makeStats();

/** Log prefix, so the runs can be filtered out of the Metro / browser console. */
const LOG_TAG = '[isoform-perf]';

/** One line per run: `[isoform-perf] scenario=misses inline=on os=android run=3 ms=112.4 best=110.2 mean=115.0`. */
const logRun = (scenario: string, stats: Stats) =>
  console.log(
    `${LOG_TAG} scenario=${scenario} inline=${INLINE ? 'on' : 'off'} os=${getProvider().os()} run=${stats.runs}` +
      ` ms=${stats.lastMs.toFixed(1)} best=${stats.bestMs.toFixed(1)} mean=${(stats.totalMs / stats.runs).toFixed(1)}`,
  );

const recorder =
  (scenario: string, stats: Stats): ProfilerOnRenderCallback =>
  (_id, phase, actualDuration) => {
    if (phase === 'mount') return; // the first mount also pays for the cold module; measure updates
    stats.runs += 1;
    stats.lastMs = actualDuration;
    stats.totalMs += actualDuration;
    stats.bestMs = Math.min(stats.bestMs, actualDuration);
    logRun(scenario, stats);
  };
const onMisses = recorder('misses', misses);
const onUnrelated = recorder('unrelated', unrelated);
const onControl = recorder('control', control);
const resetAll = () => {
  [misses, unrelated, control].forEach(resetStats);
  console.log(`${LOG_TAG} reset inline=${INLINE ? 'on' : 'off'}`);
};

const Cell = engine<'Box', { size: number }>('Box', ({ props }) => ({
  width: 6 + (props.size % 40),
  height: 6,
  borderRadius: 2,
  backgroundColor: '#93c5fd',
}));

const Wrap = engine('Box', { flexDirection: 'row', flexWrap: 'wrap', gap: 2 });

/** Scenario 1: a fresh batch of sizes on every `seed`, so no style repeats. */
const MissGrid = memo(function MissGrid({ seed }: { seed: number }) {
  return (
    <Profiler id="style-cache-misses" onRender={onMisses}>
      <Wrap>
        {Array.from({ length: CELLS }, (_, i) => (
          <Cell key={i} size={seed * CELLS + i} />
        ))}
      </Wrap>
    </Profiler>
  );
});

/** Scenario 2: the same sizes every time; only `testID` and `onPress` are new on each `seed`. */
const UnrelatedGrid = memo(function UnrelatedGrid({ seed }: { seed: number }) {
  return (
    <Profiler id="style-cache-unrelated" onRender={onUnrelated}>
      <Wrap>
        {Array.from({ length: CELLS }, (_, i) => (
          <Cell key={i} size={i} {...({ testID: `cell-${seed}-${i}`, onPress: () => seed + i } as object)} />
        ))}
      </Wrap>
    </Profiler>
  );
});

/** Scenario 3: scenario 2 without the library: the raw host primitive and the same style, inline. */
const ControlGrid = memo(function ControlGrid({ seed }: { seed: number }) {
  const Host = getProvider().primitives.Box as ComponentType<Record<string, unknown>>;
  return (
    <Profiler id="style-cache-control" onRender={onControl}>
      <Wrap>
        {Array.from({ length: CELLS }, (_, i) => (
          <Host
            key={i}
            testID={`cell-${seed}-${i}`}
            onPress={() => seed + i}
            style={{ width: 6 + (i % 40), height: 6, borderRadius: 2, backgroundColor: '#93c5fd' }}
          />
        ))}
      </Wrap>
    </Profiler>
  );
});

function Readout({ title, stats }: { title: string; stats: Stats }) {
  const mean = stats.runs ? stats.totalMs / stats.runs : 0;
  return (
    <Card flat>
      <Body>{title}</Body>
      <Body>Runs: {stats.runs}</Body>
      <Body>Last: {stats.lastMs.toFixed(1)} ms</Body>
      <Body>Best: {Number.isFinite(stats.bestMs) ? stats.bestMs.toFixed(1) : '—'} ms</Body>
      <Body>Mean: {mean.toFixed(1)} ms</Body>
    </Card>
  );
}

/** Re-reads the mutable counters a few times per second. */
function Readouts() {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 300);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <Body>Inline: {INLINE ? 'on' : 'off'}</Body>
      <Readout title="1 · All misses (300 new styles per run)" stats={misses} />
      <Readout title="2 · Unrelated props change (same 300 styles)" stats={unrelated} />
      <Readout title="3 · Control: scenario 2 without the library" stats={control} />
    </>
  );
}

export function StyleCachePerfPage() {
  const [missSeed, setMissSeed] = useState(0);
  const [unrelatedSeed, setUnrelatedSeed] = useState(0);
  const [controlSeed, setControlSeed] = useState(0);
  return (
    <PageShell
      title="Style cache perf"
      summary="Every style new (worst case), only unrelated props changing (a list row), and the same list without the library."
    >
      <Section title="Readout" hint="Tap each button ~8 times (the first run is cold). Compare 2 with 3.">
        <Readouts />
        <Flag label="1 · Render 300 new styles" on={false} onChange={() => setMissSeed((n) => n + 1)} />
        <Flag label="2 · Re-render, new testID/onPress" on={false} onChange={() => setUnrelatedSeed((n) => n + 1)} />
        <Flag label="3 · Same, without the library" on={false} onChange={() => setControlSeed((n) => n + 1)} />
        <Flag
          label="Reset counters"
          on={false}
          onChange={() => {
            resetAll();
            setMissSeed((n) => n);
          }}
        />
      </Section>
      <Section title="Grids">
        <MissGrid seed={missSeed} />
        <UnrelatedGrid seed={unrelatedSeed} />
        <ControlGrid seed={controlSeed} />
      </Section>
      <Section title="Compare">
        <Code>{`
// isoform.config.ts
export const INLINE = true;   // theme-free styled components render as the host directly
export const INLINE = false;  // every styled component keeps its wrapper
        `}</Code>
      </Section>
    </PageShell>
  );
}
