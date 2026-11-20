import * as fs from 'fs';
import * as path from 'path';

/** Statistics for one variant, in milliseconds per call of the measured function. */
export interface Stats {
  /** Median of the samples. The number to compare: robust to GC pauses and JIT noise. */
  median: number;
  /** Fastest sample: the lower bound once the noise is gone. */
  min: number;
  /** 90th percentile: how bad the slow samples get. */
  p90: number;
}

export interface CompareOptions {
  /** Calls of each variant inside one timed sample. */
  iterations: number;
  /** Number of timed samples per variant. Default 15. */
  samples?: number;
  /** Untimed calls per variant before sampling (lets the JIT settle). Default `iterations`. */
  warmup?: number;
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/**
 * Times several variants against each other.
 *
 * The variants run **round-robin, starting at a different one each round**, so JIT warm-up,
 * GC and CPU throttling hit all of them equally instead of penalising whichever ran first.
 * That was the flaw of the previous benchmark: a plain component (no builder at all) swung
 * between 40 ms and 82 ms purely by run order, which hid any real difference.
 */
export function compare(variants: Record<string, () => void>, options: CompareOptions): Record<string, Stats> {
  const { iterations, samples = 15, warmup = iterations } = options;
  const names = Object.keys(variants);
  const timings: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));

  for (const name of names) for (let i = 0; i < warmup; i++) variants[name]();

  for (let s = 0; s < samples; s++) {
    for (let k = 0; k < names.length; k++) {
      const name = names[(s + k) % names.length];
      const fn = variants[name];
      const start = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) fn();
      timings[name].push(Number(process.hrtime.bigint() - start) / 1e6 / iterations);
    }
  }

  const out: Record<string, Stats> = {};
  for (const name of names) {
    const sorted = [...timings[name]].sort((a, b) => a - b);
    out[name] = { median: percentile(sorted, 0.5), min: sorted[0], p90: percentile(sorted, 0.9) };
  }
  return out;
}

export interface Row {
  label: string;
  stats: Stats;
  /** Extra deterministic counters (compiles, renders…), printed beside the timing. */
  counters?: Record<string, number>;
}

const results: Record<string, unknown> = {};

/** Prints a table. `control` is subtracted so the numbers show the cost the library adds. */
export function report(
  title: string,
  rows: Row[],
  options: { control?: string; controls?: Record<string, string>; per?: number; unit?: string } = {},
): void {
  const { control, controls = {}, per = 1, unit = 'ms' } = options;
  const medianOf = (label?: string) => (label ? rows.find((r) => r.label === label)?.stats.median ?? 0 : 0);
  /** A row is compared with its own control when it has one (same props, no library), else the shared one. */
  const controlOf = (label: string) => controls[label] ?? control;
  console.log(`\n[bench] ${title}`);
  for (const row of rows) {
    const base = medianOf(controlOf(row.label));
    const own = row.stats.median - base;
    const scale = unit === 'µs' ? 1000 : 1;
    const parts = [
      `${(row.stats.median).toFixed(3)} ms/iter (min ${row.stats.min.toFixed(3)}, p90 ${row.stats.p90.toFixed(3)})`,
    ];
    const isControl = row.label === control || Object.values(controls).includes(row.label);
    if (controlOf(row.label) && !isControl) parts.push(`+${((own * scale) / per).toFixed(2)} ${unit}/item over control`);
    if (row.counters) parts.push(Object.entries(row.counters).map(([k, v]) => `${k}=${v}`).join(' '));
    console.log(`[bench]   ${row.label.padEnd(34)} ${parts.join(' | ')}`);
  }
  results[title] = rows.map((r) => ({
    label: r.label,
    medianMs: r.stats.median,
    minMs: r.stats.min,
    p90Ms: r.stats.p90,
    overControlMs: controlOf(r.label) && !(r.label === control || Object.values(controls).includes(r.label)) ? r.stats.median - medianOf(controlOf(r.label)) : undefined,
    counters: r.counters,
  }));
}

/** Writes everything reported so far to `$BENCH_OUT/<name>.json` (a CI artifact), when `BENCH_OUT` is set. */
export function flushResults(name: string): void {
  const dir = process.env.BENCH_OUT;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(results, null, 2));
}
