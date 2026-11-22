import { optimizedHash } from './optimizedHash';
import { beginPropReads, createReads, endPropReads, trackReads } from './trackReads';

/** Runs `fn` with a recording active and returns what it read. */
const recorded = (fn: () => void) => {
  const reads = createReads();
  const previous = beginPropReads(reads);
  try {
    fn();
  } finally {
    endPropReads(previous);
  }
  return reads;
};

const hash = (props: Record<string, unknown>, platform = 'ios', keys: ReadonlySet<string> | null = null) =>
  optimizedHash({ platform, props }, keys);

describe('optimizedHash', () => {
  describe('all props (no keys read yet)', () => {
    it('is stable for the same input', () => {
      expect(hash({ a: 1, b: 'x', c: true })).toBe(hash({ a: 1, b: 'x', c: true }));
    });

    it('changes with the platform', () => {
      expect(hash({ a: 1 }, 'ios')).not.toBe(hash({ a: 1 }, 'android'));
    });

    it('changes with a primitive value', () => {
      expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
      expect(hash({ a: true })).not.toBe(hash({ a: false }));
      expect(hash({ a: 'x' })).not.toBe(hash({ a: 'y' }));
    });

    it('tells apart values of different types that print the same', () => {
      expect(hash({ a: 1 })).not.toBe(hash({ a: '1' }));
      expect(hash({ a: true })).not.toBe(hash({ a: 'true' }));
      expect(hash({ a: 0 })).not.toBe(hash({ a: '' }));
      expect(hash({ a: null })).not.toBe(hash({ a: 'null' }));
    });

    it('cannot confuse two props with one prop whose value contains the separator', () => {
      expect(hash({ a: 'x|b=s1:y' })).not.toBe(hash({ a: 'x', b: 'y' }));
    });

    it('keeps zero, empty string and false (they are values, not absence)', () => {
      expect(hash({ a: 0 })).not.toBe(hash({}));
      expect(hash({ a: '' })).not.toBe(hash({}));
      expect(hash({ a: false })).not.toBe(hash({}));
    });

    it('ignores undefined props', () => {
      expect(hash({ a: undefined })).toBe(hash({}));
    });

    it('ignores children, key, ref and style', () => {
      const base = hash({ a: 1 });
      expect(hash({ a: 1, children: 'x' })).toBe(base);
      expect(hash({ a: 1, key: 'k' })).toBe(base);
      expect(hash({ a: 1, ref: {} })).toBe(base);
      expect(hash({ a: 1, style: { padding: 1 } })).toBe(base);
    });

    it('hashes objects, arrays and functions by identity', () => {
      const obj = { x: 1 };
      const fn = () => 1;
      expect(hash({ a: obj })).toBe(hash({ a: obj }));
      expect(hash({ a: obj })).not.toBe(hash({ a: { x: 1 } }));
      expect(hash({ a: fn })).toBe(hash({ a: fn }));
      expect(hash({ a: fn })).not.toBe(hash({ a: () => 1 }));
      const list = [1, 2];
      expect(hash({ a: list })).toBe(hash({ a: list }));
      expect(hash({ a: list })).not.toBe(hash({ a: [1, 2] }));
    });
  });

  describe('only the keys the style read', () => {
    const keys = new Set(['size']);

    it('ignores props the style never reads', () => {
      expect(hash({ size: 1, testID: 'a', onPress: () => 1 }, 'ios', keys)).toBe(hash({ size: 1, testID: 'b' }, 'ios', keys));
    });

    it('changes when a read prop changes', () => {
      expect(hash({ size: 1 }, 'ios', keys)).not.toBe(hash({ size: 2 }, 'ios', keys));
    });

    it('treats a missing read prop as undefined', () => {
      expect(hash({}, 'ios', keys)).toBe(hash({ size: undefined }, 'ios', keys));
    });

    it('still changes with the platform', () => {
      expect(hash({ size: 1 }, 'ios', keys)).not.toBe(hash({ size: 1 }, 'web', keys));
    });
  });
});

describe('trackReads', () => {
  it('records the props read by name', () => {
    const props = trackReads({ a: 1, b: 2, c: 3 });
    const reads = recorded(() => {
      void props.a;
      void props.c;
    });
    expect([...reads.keys]).toEqual(['a', 'c']);
    expect(reads.all).toBe(false);
  });

  it('records `in` checks and returns the real values', () => {
    const props = trackReads({ a: 1 } as Record<string, number>);
    let value = 0;
    const reads = recorded(() => {
      expect('a' in props).toBe(true);
      value = props.a;
    });
    expect(value).toBe(1);
    expect(reads.keys.has('a')).toBe(true);
  });

  it('marks enumeration as reading everything', () => {
    for (const read of [(p: object) => ({ ...p }), (p: object) => Object.keys(p), (p: object) => Object.entries(p)]) {
      const props = trackReads({ a: 1, b: 2 });
      expect(recorded(() => read(props)).all).toBe(true);
    }
  });

  it('does not record symbols', () => {
    const props = trackReads({});
    expect(recorded(() => void (props as any)[Symbol.iterator]).keys.size).toBe(0);
  });

  it('records nothing outside a recording (a style that keeps props and reads them later)', () => {
    const props = trackReads({ a: 1 });
    const reads = createReads();
    void props.a;
    expect(reads.keys.size).toBe(0);
  });

  it('restores the previous recording when nested', () => {
    const outer = createReads();
    const inner = createReads();
    const props = trackReads({ a: 1, b: 2 });
    const a = beginPropReads(outer);
    const b = beginPropReads(inner);
    void props.a;
    endPropReads(b);
    void props.b;
    endPropReads(a);
    expect([...inner.keys]).toEqual(['a']);
    expect([...outer.keys]).toEqual(['b']);
  });

  it('shares one handler: the Proxy is the only allocation per tracked props object', () => {
    const NativeProxy = Proxy;
    const handlers = new Set<object>();
    (globalThis as any).Proxy = new NativeProxy(NativeProxy, {
      construct(target, args) {
        handlers.add(args[1]);
        return new (target as any)(...args);
      },
    });
    try {
      trackReads({ a: 1 });
      trackReads({ b: 2 });
    } finally {
      (globalThis as any).Proxy = NativeProxy;
    }
    expect(handlers.size).toBe(1);
  });
});
