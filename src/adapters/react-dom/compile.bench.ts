/**
 * Cold-start benchmark of the web adapter: the first render of a styled component compiles its
 * style (atomic classes, `@media`/`:hover` variants). This is what build-time extraction would
 * remove, so its cost decides whether extraction is worth building.
 *
 * Every style below is new (unique values), so no class is reused: the worst case, a cold start.
 * Run with: `yarn bench`
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { compare, flushResults, report } from '../../core/testing/benchHarness';
import { reactDomAdapter } from './adapter';

let counter = 0;

/** A typical component style: ~10 declarations. `n` makes every value unique. */
const typical = (n: number) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  padding: n,
  margin: n + 1,
  borderRadius: 8,
  backgroundColor: `#${(n % 0xffffff).toString(16).padStart(6, '0')}`,
  fontSize: 14 + (n % 5),
  opacity: 0.5,
  gap: n % 17,
});

describe('web adapter cold compile', () => {
  afterAll(() => flushResults('compile'));

  it('compile cost of one component style', () => {
    const stats = compare(
      {
        'typical style (10 props)': () => {
          reactDomAdapter.compileStyle(typical(++counter) as any);
        },
        'typical + hover + 2 breakpoints': () => {
          const n = ++counter;
          reactDomAdapter.compileStyle(
            typical(n) as any,
            { hover: { opacity: 1, backgroundColor: `#${(n % 0xffffff).toString(16).padStart(6, '0')}` } } as any,
            [
              { name: 'md', min: 768, order: 2, style: { padding: n + 2 } },
              { name: 'lg', min: 1024, order: 4, style: { padding: n + 3 } },
            ] as any,
          );
        },
      },
      { iterations: 500, samples: 9, warmup: 200 },
    );
    report('web adapter: compile one style from scratch', Object.keys(stats).map((label) => ({ label, stats: stats[label] })), {});
    // a few hundred components at startup stay in the low milliseconds
    const perComponentMs = stats['typical style (10 props)'].median;
    console.log(`[bench]   → 500 components at startup ≈ ${(perComponentMs * 500).toFixed(1)} ms on this machine (V8)`);
    expect(perComponentMs).toBeGreaterThan(0);
  });
});
