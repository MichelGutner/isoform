import { Profiler, memo, useEffect, useState, type ProfilerOnRenderCallback } from 'react';
import { engine } from 'react-isoform';
import { Code, Flag, PageShell, Section } from '../kit';
import { Body, Card } from '../ui';

/**
 * Profile of window-width changes on a real device.
 *
 * 200 components with breakpoints sit inside a React `Profiler`. Rotate the device (or resize the
 * browser): the counters show how many times React committed the grid and how long it took.
 *
 *  - Dragging the width inside one breakpoint (say 400 → 700, both below `md`) must NOT add commits.
 *  - Crossing a breakpoint (`md` is 768, `lg` is 1024) adds exactly one commit that re-composes every cell.
 *
 * Needs a development or profiling build: `Profiler` reports nothing in a plain production build.
 */

const CELLS = 200;

interface Stats {
  commits: number;
  totalMs: number;
  lastMs: number;
}

/** Mutable on purpose: updating state from the Profiler callback would re-render what is being measured. */
const stats: Stats = { commits: 0, totalMs: 0, lastMs: 0 };

const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
  stats.commits += 1;
  stats.totalMs += actualDuration;
  stats.lastMs = actualDuration;
};

const Cell = engine('Box', ({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: 3,
  backgroundColor: theme.color.border,
}))
  .when('breakpoints:md', { style: { backgroundColor: '#a7f3d0' } })
  .when('breakpoints:lg', { style: { backgroundColor: '#bfdbfe' } });

const Wrap = engine('Box', { flexDirection: 'row', flexWrap: 'wrap', gap: 4 });

/** Memoized, so the counters updating next to it never re-render the cells. */
const Grid = memo(function Grid() {
  return (
    <Profiler id="breakpoint-grid" onRender={onRender}>
      <Wrap>
        {Array.from({ length: CELLS }, (_, i) => (
          <Cell key={i} />
        ))}
      </Wrap>
    </Profiler>
  );
});

/** Reads the mutable counters a few times per second. */
function Readout() {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card flat>
      <Body>Grid commits: {stats.commits}</Body>
      <Body>Last commit: {stats.lastMs.toFixed(2)} ms</Body>
      <Body>Total render time: {stats.totalMs.toFixed(1)} ms</Body>
    </Card>
  );
}

export function BreakpointPerfPage() {
  const [, reset] = useState(0);
  return (
    <PageShell
      title="Breakpoint perf"
      summary="200 responsive cells under a React Profiler. Rotate the device or resize the window and watch the commits."
    >
      <Section title="Readout" hint="Stays put while the width moves inside one breakpoint; +1 commit when a breakpoint is crossed.">
        <Readout />
        <Flag
          label="Reset counters"
          on={false}
          onChange={() => {
            stats.commits = 0;
            stats.totalMs = 0;
            stats.lastMs = 0;
            reset((n) => n + 1);
          }}
        />
      </Section>
      <Section title="Grid">
        <Grid />
      </Section>
      <Section title="How to read it">
        <Code>{`
// before: every width change re-rendered all 200 cells (useWindowDimensions per component)
// now:    one shared listener; a cell re-renders only when its active breakpoint changes
// compare: rotate the device a few times and note "Grid commits" and "Total render time"
        `}</Code>
      </Section>
    </PageShell>
  );
}
