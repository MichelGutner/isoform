import { LRUCache } from './lru';

describe('LRUCache', () => {
  describe('construction', () => {
    it('should create cache with default limit of 300', () => {
      const cache = new LRUCache<string, number>();
      expect(cache).toBeDefined();
    });

    it('should create cache with custom limit', () => {
      const cache = new LRUCache<string, number>(5);
      expect(cache).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      const cache = new LRUCache<string, number>();
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return value for existing key', () => {
      const cache = new LRUCache<string, number>();
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should move key to end when accessed (LRU)', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      // Access key1 to move it to the end
      cache.get('key1');

      // Adding new key should remove key2 (least recently used)
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(1); // Still exists (was accessed)
      expect(cache.get('key2')).toBeUndefined(); // Was removed (LRU)
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });
  });

  describe('set', () => {
    it('should add new key', () => {
      const cache = new LRUCache<string, number>();
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should update value of existing key', () => {
      const cache = new LRUCache<string, number>();
      cache.set('key1', 100);
      cache.set('key1', 200);
      expect(cache.get('key1')).toBe(200);
    });

    it('should move updated key to end', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      // Update key1 to move it to the end
      cache.set('key1', 10);

      // Adding new key should remove key2 (least recently used)
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(10); // Still exists (was updated)
      expect(cache.get('key2')).toBeUndefined(); // Was removed (LRU)
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should remove oldest key when limit is reached', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.set('key4', 4); // Should remove key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });
  });

  describe('clear', () => {
    it('should remove all keys', () => {
      const cache = new LRUCache<string, number>();
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should allow adding keys after clear', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('key1', 1);
      cache.set('key2', 2);

      cache.clear();

      cache.set('key3', 3);
      cache.set('key4', 4);

      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });
  });

  describe('behavior with multiple operations', () => {
    it('should maintain LRU correctly with complex access pattern', () => {
      const cache = new LRUCache<string, number>(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('a'); // a: MRU, b: LRU, c
      cache.get('b'); // a, b: MRU, c: LRU

      cache.set('d', 4); // Should remove c

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
    });

    it('should work with different value types', () => {
      const cache = new LRUCache<string, unknown>(5);

      cache.set('string', 'value');
      cache.set('number', 123);
      cache.set('boolean', true);
      cache.set('object', { key: 'value' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('value');
      expect(cache.get('number')).toBe(123);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ key: 'value' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });
});
