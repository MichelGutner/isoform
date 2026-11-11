import { optimizedHash } from './optimizedHash';
import { BaseStyleContext } from '../core/types';

describe('optimizedHash', () => {
  describe('hash with empty context', () => {
    it('should generate hash with default platform when not specified', () => {
      const ctx: BaseStyleContext<{}> = {
        theme: {},
        props: {},
      };
      const hash = optimizedHash(ctx);
      expect(hash).toBe('default');
    });

    it('should generate hash with specified platform', () => {
      const ctx: BaseStyleContext<{}> = {
        theme: {},
        props: {},
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toBe('ios');
    });
  });

  describe('hash with simple props', () => {
    it('should include string props in hash', () => {
      const ctx: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'primary' },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('variant:primary');
    });

    it('should include number props in hash', () => {
      const ctx: BaseStyleContext<{ size: number }> = {
        theme: {},
        props: { size: 16 },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('size:16');
    });

    it('should include boolean props in hash', () => {
      const ctx: BaseStyleContext<{ disabled: boolean }> = {
        theme: {},
        props: { disabled: true },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('disabled:true');
    });

    it('should include multiple props in hash', () => {
      const ctx: BaseStyleContext<{ variant: string; size: number; disabled: boolean }> = {
        theme: {},
        props: { variant: 'primary', size: 16, disabled: true },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('variant:primary');
      expect(hash).toContain('size:16');
      expect(hash).toContain('disabled:true');
    });
  });

  describe('exclusion of special props', () => {
    it('should exclude children prop from hash', () => {
      const ctx: BaseStyleContext<{ children: string }> = {
        theme: {},
        props: { children: 'Hello World' },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('children');
    });

    it('should exclude key prop from hash', () => {
      const ctx: BaseStyleContext<{ key: string }> = {
        theme: {},
        props: { key: 'unique-key' },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('key');
    });

    it('should exclude ref prop from hash', () => {
      const ctx: BaseStyleContext<{ ref: any }> = {
        theme: {},
        props: { ref: {} },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('ref');
    });

    it('should include other props even with children, key, ref present', () => {
      const ctx: BaseStyleContext<{ children: string; key: string; ref: any; variant: string }> = {
        theme: {},
        props: { children: 'text', key: 'key', ref: {}, variant: 'primary' },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('children');
      expect(hash).not.toContain('key');
      expect(hash).not.toContain('ref');
      expect(hash).toContain('variant:primary');
    });
  });

  describe('hash with different platform', () => {
    it('should generate different hash for different platforms', () => {
      const ctxIos: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'primary' },
        platform: 'ios',
      };

      const ctxAndroid: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'primary' },
        platform: 'android',
      };

      const ctxWeb: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'primary' },
        platform: 'web',
      };

      const hashIos = optimizedHash(ctxIos);
      const hashAndroid = optimizedHash(ctxAndroid);
      const hashWeb = optimizedHash(ctxWeb);

      expect(hashIos).toContain('ios');
      expect(hashAndroid).toContain('android');
      expect(hashWeb).toContain('web');
      expect(hashIos).not.toBe(hashAndroid);
      expect(hashIos).not.toBe(hashWeb);
      expect(hashAndroid).not.toBe(hashWeb);
    });
  });

  describe('hash with undefined/null props', () => {
    it('should ignore undefined props', () => {
      const ctx: BaseStyleContext<{ variant: string | undefined }> = {
        theme: {},
        props: { variant: undefined },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('variant');
    });

    it('should ignore null props', () => {
      const ctx: BaseStyleContext<{ variant: string | null }> = {
        theme: {},
        props: { variant: null },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).not.toContain('variant');
    });

    it('should include props with zero value', () => {
      const ctx: BaseStyleContext<{ size: number }> = {
        theme: {},
        props: { size: 0 },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('size:0');
    });

    it('should include props with empty string', () => {
      const ctx: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: '' },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('variant:');
    });

    it('should include props with false', () => {
      const ctx: BaseStyleContext<{ disabled: boolean }> = {
        theme: {},
        props: { disabled: false },
        platform: 'ios',
      };
      const hash = optimizedHash(ctx);
      expect(hash).toContain('disabled:false');
    });
  });

  describe('hash consistency', () => {
    it('should generate same hash for same input', () => {
      const ctx: BaseStyleContext<{ variant: string; size: number }> = {
        theme: {},
        props: { variant: 'primary', size: 16 },
        platform: 'ios',
      };

      const hash1 = optimizedHash(ctx);
      const hash2 = optimizedHash(ctx);
      const hash3 = optimizedHash(ctx);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should generate different hashes for different inputs', () => {
      const ctx1: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'primary' },
        platform: 'ios',
      };

      const ctx2: BaseStyleContext<{ variant: string }> = {
        theme: {},
        props: { variant: 'secondary' },
        platform: 'ios',
      };

      const hash1 = optimizedHash(ctx1);
      const hash2 = optimizedHash(ctx2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hash with multiple complex props', () => {
    it('should generate consistent hash with many props', () => {
      const ctx: BaseStyleContext<{
        variant: string;
        size: number;
        disabled: boolean;
        active: boolean;
        color: string;
      }> = {
        theme: {},
        props: {
          variant: 'primary',
          size: 16,
          disabled: false,
          active: true,
          color: '#007AFF',
        },
        platform: 'ios',
      };

      const hash = optimizedHash(ctx);
      expect(hash).toContain('ios');
      expect(hash).toContain('variant:primary');
      expect(hash).toContain('size:16');
      expect(hash).toContain('disabled:false');
      expect(hash).toContain('active:true');
      expect(hash).toContain('color:#007AFF');
    });

    it('should generate different hash when props order is different', () => {
      const ctx1: BaseStyleContext<{ a: string; b: string; c: string }> = {
        theme: {},
        props: { a: '1', b: '2', c: '3' },
        platform: 'ios',
      };

      const ctx2: BaseStyleContext<{ c: string; b: string; a: string }> = {
        theme: {},
        props: { c: '3', b: '2', a: '1' },
        platform: 'ios',
      };

      const hash1 = optimizedHash(ctx1);
      const hash2 = optimizedHash(ctx2);

      // The order of props in the object affects the hash
      // because we iterate over object keys with for...in
      expect(hash1).not.toBe(hash2);
    });
  });
});
