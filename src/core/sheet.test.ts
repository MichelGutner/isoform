import { detentHeight, encodeDetents, resolveDetents, settleDetent } from './sheet';

describe('sheet detents', () => {
  it('turns every detent kind into a height', () => {
    expect(detentHeight(300, 800, 0)).toBe(300);
    expect(detentHeight('full', 800, 0)).toBe(800);
    expect(detentHeight('50%', 800, 0)).toBe(400);
    expect(detentHeight('fit', 800, 260)).toBe(260);
    // content not measured yet: half the screen meanwhile
    expect(detentHeight('fit', 800, 0)).toBe(400);
  });

  it('clamps to the screen and sorts ascending, keeping the source index', () => {
    expect(resolveDetents(['full', 200, 'fit'], 700, 2000)).toEqual([
      { height: 200, fit: false, source: 1 },
      { height: 700, fit: false, source: 0 },
      { height: 700, fit: true, source: 2 },
    ]);
  });

  it('defaults to fit', () => {
    expect(resolveDetents(undefined, 800, 320)).toEqual([{ height: 320, fit: true, source: 0 }]);
    expect(encodeDetents(undefined)).toEqual(['fit']);
    expect(encodeDetents([240, '50%', 'full'])).toEqual(['240', '50%', 'full']);
  });

  it('settles on the nearest detent after a slow release', () => {
    expect(settleDetent([300, 600], 420, 0, true)).toBe(0);
    expect(settleDetent([300, 600], 500, 0, true)).toBe(1);
    // closer to 0 than to the first detent: closes
    expect(settleDetent([300, 600], 100, 0, true)).toBe(-1);
    expect(settleDetent([300, 600], 100, 0, false)).toBe(0);
  });

  it('follows a fast fling', () => {
    expect(settleDetent([300, 600], 580, -900, true)).toBe(0);
    expect(settleDetent([300, 600], 290, -900, true)).toBe(-1);
    expect(settleDetent([300, 600], 290, -900, false)).toBe(0);
    expect(settleDetent([300, 600], 310, 900, true)).toBe(1);
    expect(settleDetent([300, 600], 600, 900, true)).toBe(1);
  });
});
