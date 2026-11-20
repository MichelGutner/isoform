import { updateTheme, getTheme, themeStore } from './index';

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset theme before each test by setting to empty object
    // Note: This doesn't actually clear the theme, just merges nothing
    // Tests should not depend on empty initial state
  });

  describe('getSnapshot', () => {
    it('should return current theme', () => {
      updateTheme({ colors: { primary: '#007AFF' } });
      const snapshot = themeStore.getSnapshot();
      expect(snapshot).toEqual({ colors: { primary: '#007AFF' } });
    });
  });

  describe('subscribe', () => {
    it('should add listener', () => {
      const listener = jest.fn();
      const unsubscribe = themeStore.subscribe(listener);
      
      updateTheme({ colors: { primary: '#007AFF' } });
      
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = themeStore.subscribe(listener);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should remove listener when unsubscribe is called', () => {
      const listener = jest.fn();
      const unsubscribe = themeStore.subscribe(listener);
      
      unsubscribe();
      updateTheme({ colors: { primary: '#007AFF' } });
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      themeStore.subscribe(listener1);
      themeStore.subscribe(listener2);
      themeStore.subscribe(listener3);
      
      updateTheme({ colors: { primary: '#007AFF' } });
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe('updateTheme', () => {
    it('should merge partial theme object', () => {
      updateTheme({ colors: { primary: '#007AFF' } });
      updateTheme({ colors: { secondary: '#5856D6' } });

      const theme = getTheme() as any;
      expect(theme.colors?.primary).toBe('#007AFF');
      expect(theme.colors?.secondary).toBe('#5856D6');
    });

    it('should accept function updater', () => {
      updateTheme({ colors: { primary: '#007AFF' } });

      updateTheme((prev) => ({
        colors: { primary: '#FF3B30' }
      }));

      const theme = getTheme() as any;
      expect(theme.colors?.primary).toBe('#FF3B30');
    });

    it('should notify all subscribers on theme change', () => {
      const listener = jest.fn();
      themeStore.subscribe(listener);

      updateTheme({ colors: { primary: '#007AFF' } });

      expect(listener).toHaveBeenCalled();
    });

    it('should return merged theme', () => {
      const result = updateTheme({ colors: { primary: '#007AFF' } });

      const resultAny = result as any;
      expect(resultAny.colors?.primary).toBe('#007AFF');
    });

    it('should deep merge nested objects', () => {
      updateTheme({
        colors: { primary: '#007AFF', secondary: '#5856D6' },
        spacing: { sm: 8, md: 16 }
      });

      updateTheme({
        colors: { primary: '#FF3B30' },
        spacing: { lg: 24 }
      });

      const theme = getTheme() as any;
      expect(theme.colors?.primary).toBe('#FF3B30');
      expect(theme.colors?.secondary).toBe('#5856D6');
      expect(theme.spacing?.sm).toBe(8);
      expect(theme.spacing?.md).toBe(16);
      expect(theme.spacing?.lg).toBe(24);
    });
  });

  describe('getTheme', () => {
    it('should return current theme', () => {
      updateTheme({ colors: { primary: '#007AFF' } });
      const theme = getTheme() as any;
      expect(theme.colors?.primary).toBe('#007AFF');
    });

    it('should not subscribe to changes', () => {
      const listener = jest.fn();
      themeStore.subscribe(listener);

      getTheme();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return latest theme after updates', () => {
      updateTheme({ colors: { primary: '#007AFF' } });
      updateTheme({ colors: { primary: '#FF3B30' } });

      const theme = getTheme() as any;
      expect(theme.colors?.primary).toBe('#FF3B30');
    });
  });

  describe('multiple subscribers', () => {
    it('should handle multiple subscribers correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      const unsubscribe1 = themeStore.subscribe(listener1);
      const unsubscribe2 = themeStore.subscribe(listener2);
      
      updateTheme({ colors: { primary: '#007AFF' } });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      unsubscribe1();
      
      updateTheme({ colors: { primary: '#FF3B30' } });
      
      expect(listener1).toHaveBeenCalledTimes(1); // Not called after unsubscribe
      expect(listener2).toHaveBeenCalledTimes(2); // Still called
      
      unsubscribe2();
    });

    it('should not affect other listeners when one unsubscribes', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      themeStore.subscribe(listener1);
      const unsubscribe2 = themeStore.subscribe(listener2);
      themeStore.subscribe(listener3);
      
      unsubscribe2();
      
      updateTheme({ colors: { primary: '#007AFF' } });
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });
});

describe('theme identity', () => {
  it('returns to the same object when an earlier theme comes back (style caches are keyed by it)', () => {
    updateTheme({ colors: { bg: 'white' } });
    const light = getTheme();
    updateTheme({ colors: { bg: 'black' } });
    const dark = getTheme();
    expect(dark).not.toBe(light);

    updateTheme({ colors: { bg: 'white' } });
    expect(getTheme()).toBe(light);
    updateTheme({ colors: { bg: 'black' } });
    expect(getTheme()).toBe(dark);
  });

  it('keeps the same object for an update that changes nothing', () => {
    updateTheme({ colors: { bg: 'white' } });
    const before = getTheme();
    updateTheme({ colors: { bg: 'white' } });
    expect(getTheme()).toBe(before);
  });

  it('still produces a new theme for a value never seen', () => {
    updateTheme({ colors: { bg: 'white' } });
    const before = getTheme();
    updateTheme({ colors: { bg: 'hotpink' } });
    expect(getTheme()).not.toBe(before);
    expect(getTheme().colors).toMatchObject({ bg: 'hotpink' }); // earlier tests left other keys in the store
  });
});
