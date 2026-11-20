export class LRUCache<K, V> {
  private map = new Map<K, V>();

  /** How many entries were dropped to make room. A cache that keeps evicting is not caching (see the builder's warning). */
  evictions = 0;

  constructor(private readonly limit = 300) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey!);
      this.evictions++;
    }
    this.map.set(key, value);
  }

  clear() {
    this.map.clear();
  }
}
