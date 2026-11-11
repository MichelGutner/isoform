import fs from 'fs';
import path from 'path';

/**
 * Garante a fronteira que faz a lib funcionar nas duas plataformas:
 * só os adapters (e o provider nativo) podem importar `react-native`, e só o
 * adapter DOM pode importar `react-dom`. O bundler web nunca pode "ver"
 * `react-native` partindo do entry.
 */
const SRC = __dirname;

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|bench)\./.test(entry.name) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');
const imports = (file: string, pkg: string) =>
  new RegExp(`(from|require\\()\\s*['"]${pkg}(/[^'"]*)?['"]`).test(fs.readFileSync(file, 'utf8'));

describe('import boundaries', () => {
  const files = sources(SRC);

  it('only adapters/react-native imports react-native', () => {
    const offenders = files.filter((f) => imports(f, 'react-native')).map(rel);
    expect(offenders.every((f) => f.startsWith('adapters/react-native/'))).toBe(true);
    expect(offenders.length).toBeGreaterThan(0);
  });

  it('only adapters/react-dom may import react-dom', () => {
    const offenders = files.filter((f) => imports(f, 'react-dom')).map(rel);
    expect(offenders.every((f) => f.startsWith('adapters/react-dom/'))).toBe(true);
  });

  it('the web provider never reaches react-native, and the native provider never reaches the DOM adapter', () => {
    const web = fs.readFileSync(path.join(SRC, 'providers/index.ts'), 'utf8');
    const native = fs.readFileSync(path.join(SRC, 'providers/index.native.ts'), 'utf8');
    expect(web).toContain('adapters/react-dom');
    expect(web).not.toContain('react-native');
    expect(native).toContain('adapters/react-native');
    expect(native).not.toContain('react-dom');
  });

  it('core, config, theme, cache and hash stay platform-agnostic', () => {
    const agnostic = files.filter((f) => /^(core|config|theme|cache|hash)\//.test(rel(f)));
    expect(agnostic.length).toBeGreaterThan(10);
    for (const f of agnostic) {
      expect([rel(f), imports(f, 'react-native')]).toEqual([rel(f), false]);
      expect([rel(f), imports(f, 'react-dom')]).toEqual([rel(f), false]);
    }
  });
});
