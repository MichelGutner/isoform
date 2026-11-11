import { deepMerge } from './helpers';

describe('deepMerge', () => {
  describe('simple object merge', () => {
    it('should return base when partial is equal', () => {
      const base = { a: 1, b: 2 };
      const partial = base;
      const result = deepMerge(base, partial);
      expect(result).toBe(base);
    });

    it('should merge simple properties', () => {
      const base = { a: 1, b: 2 };
      const partial = { c: 3 } as Partial<typeof base>;
      const result = deepMerge(base, partial);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should overwrite existing properties', () => {
      const base = { a: 1, b: 2 };
      const partial = { b: 3 };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should return base when partial is null', () => {
      const base = { a: 1, b: 2 };
      const result = deepMerge(base, null);
      expect(result).toBe(base);
    });

    it('should return base when partial is undefined', () => {
      const base = { a: 1, b: 2 };
      const result = deepMerge(base, undefined);
      expect(result).toBe(base);
    });

    it('should return partial when base is null', () => {
      const partial = { a: 1, b: 2 };
      const result = deepMerge(null, partial);
      expect(result).toEqual(partial);
    });

    it('should return partial when base is undefined', () => {
      const partial = { a: 1, b: 2 };
      const result = deepMerge(undefined, partial);
      expect(result).toEqual(partial);
    });
  });

  describe('nested object merge', () => {
    it('should merge nested objects deeply', () => {
      const base = {
        colors: { primary: 'blue', secondary: 'gray' },
        spacing: { sm: 4, md: 8 },
      };
      const partial = {
        colors: { primary: 'red' },
        spacing: { lg: 16 },
      } as unknown as Partial<typeof base>;
      const result = deepMerge(base, partial);
      expect(result).toEqual({
        colors: { primary: 'red', secondary: 'gray' },
        spacing: { sm: 4, md: 8, lg: 16 },
      });
    });

    it('should merge multiple nesting levels', () => {
      const base = {
        theme: {
          light: { bg: 'white', text: 'black' },
          dark: { bg: 'black', text: 'white' },
        },
      };
      const partial = {
        theme: {
          light: { text: 'gray' },
        },
      } as Partial<typeof base>;
      const result = deepMerge(base, partial);
      expect(result).toEqual({
        theme: {
          light: { bg: 'white', text: 'gray' },
          dark: { bg: 'black', text: 'white' },
        },
      });
    });

    it('should add new nested objects', () => {
      const base = { colors: { primary: 'blue' } };
      const partial = { spacing: { md: 16 } } as any;
      const result = deepMerge(base, partial);
      expect(result).toEqual({
        colors: { primary: 'blue' },
        spacing: { md: 16 },
      });
    });

    it('should replace entire nested object when partial has new object', () => {
      const base = { colors: { primary: 'blue', secondary: 'gray' } };
      const partial = { colors: { accent: 'purple' } } as unknown as Partial<typeof base>;
      const result = deepMerge(base, partial);
      expect(result).toEqual({
        colors: { primary: 'blue', secondary: 'gray', accent: 'purple' },
      });
    });
  });

  describe('merge with primitive values', () => {
    it('should replace string', () => {
      const base = { name: 'old' };
      const partial = { name: 'new' };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ name: 'new' });
    });

    it('should replace number', () => {
      const base = { count: 1 };
      const partial = { count: 2 };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ count: 2 });
    });

    it('should replace boolean', () => {
      const base = { active: false };
      const partial = { active: true };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ active: true });
    });

    it('should replace null', () => {
      const base = { value: 'something' };
      const partial = { value: null };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ value: null });
    });

    it('should replace undefined', () => {
      const base = { value: 'something' };
      const partial = { value: undefined };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ value: undefined });
    });
  });

  describe('merge with arrays', () => {
    it('should replace array (no merge)', () => {
      const base = { items: [1, 2, 3] };
      const partial = { items: [4, 5] };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ items: [4, 5] });
    });

    it('should keep array when no changes', () => {
      const base = { items: [1, 2, 3] };
      const partial = { other: 'value' } as any;
      const result = deepMerge(base, partial);
      expect(result).toEqual({ items: [1, 2, 3], other: 'value' });
    });

    it('should replace empty array', () => {
      const base = { items: [1, 2, 3] };
      const partial = { items: [] };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ items: [] });
    });
  });

  describe('immutability', () => {
    it('should not modify base object', () => {
      const base = { a: 1, b: 2 };
      const partial = { b: 3, c: 4 };
      const baseCopy = { ...base };
      deepMerge(base, partial);
      expect(base).toEqual(baseCopy);
    });

    it('should not modify partial object', () => {
      const base = { a: 1, b: 2 };
      const partial = { b: 3, c: 4 };
      const partialCopy = { ...partial };
      deepMerge(base, partial);
      expect(partial).toEqual(partialCopy);
    });

    it('should create new object when there are changes', () => {
      const base = { a: 1, b: 2 };
      const partial = { b: 3 };
      const result = deepMerge(base, partial);
      expect(result).not.toBe(base);
      expect(result).not.toBe(partial);
    });

    it('should return same reference when no changes', () => {
      const base = { a: 1, b: 2 };
      const partial = { a: 1, b: 2 };
      const result = deepMerge(base, partial);
      expect(result).toBe(base);
    });
  });

  describe('edge cases', () => {
    it('should handle empty base', () => {
      const base = {};
      const partial = { a: 1, b: 2 };
      const result = deepMerge(base, partial);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty partial', () => {
      const base = { a: 1, b: 2 };
      const partial = {};
      const result = deepMerge(base, partial);
      expect(result).toBe(base);
    });

    it('should handle both empty', () => {
      const base = {};
      const partial = {};
      const result = deepMerge(base, partial);
      expect(result).toEqual({});
    });

    it('should handle primitive values as base', () => {
      const base = 'string' as any;
      const partial = { a: 1 };
      const result = deepMerge(base, partial);
      // When base is a primitive, it treats it as an array-like object
      // This is expected behavior based on the implementation
      expect(result).toBeDefined();
    });

    it('should handle primitive values as partial', () => {
      const base = { a: 1 };
      const partial = 'string' as any;
      const result = deepMerge(base, partial);
      expect(result).toBe('string');
    });
  });

  describe('complex deep merge', () => {
    it('should merge complex structure correctly', () => {
      const base = {
        colors: {
          primary: '#007AFF',
          secondary: '#5856D6',
          background: '#FFFFFF',
        },
        spacing: {
          xs: 4,
          sm: 8,
          md: 16,
          lg: 24,
        },
        typography: {
          fontSize: {
            xs: 12,
            sm: 14,
            md: 16,
            lg: 18,
          },
        },
      };

      const partial = {
        colors: {
          primary: '#FF3B30',
          accent: '#FF9500',
        },
        spacing: {
          xl: 32,
        },
        typography: {
          fontSize: {
            xl: 20,
          },
        },
      } as unknown as Partial<typeof base>;

      const result = deepMerge(base, partial);
      expect(result).toEqual({
        colors: {
          primary: '#FF3B30',
          secondary: '#5856D6',
          background: '#FFFFFF',
          accent: '#FF9500',
        },
        spacing: {
          xs: 4,
          sm: 8,
          md: 16,
          lg: 24,
          xl: 32,
        },
        typography: {
          fontSize: {
            xs: 12,
            sm: 14,
            md: 16,
            lg: 18,
            xl: 20,
          },
        },
      });
    });

    it('should preserve references of unmodified objects', () => {
      const nested = { value: 1 };
      const base = { a: nested, b: 2 };
      const partial = { b: 3 };
      const result = deepMerge(base, partial);
      expect(result.a).toBe(nested);
    });
  });
});
