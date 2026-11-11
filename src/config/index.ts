import type { PlatformAdapter } from '../core/adapter';
import { warnOnce } from '../core/dev';
import { updateTheme } from '../theme/store';

export type ProviderName = 'react-native' | 'react';

export interface ConfigureOptions {
  /**
   * Qual plataforma usar.
   * - `'auto'` (padrão): a que o bundler incluiu (RN no Metro, DOM no Vite/Next/webpack)
   * - `'react-native'` | `'react'`: explícito — falha com erro claro se não bater com o bundle
   * - um `PlatformAdapter`: plataforma customizada
   */
  provider?: 'auto' | ProviderName | PlatformAdapter;
  /** Atalho para `updateTheme(theme)`. */
  theme?: Partial<EngineTheme>;
  /**
   * Larguras mínimas (px) usadas por `when('md')` etc. Mobile-first: a regra
   * vale quando a largura é >= ao valor. Padrão: `{ sm: 480, md: 768, lg: 1024, xl: 1280 }`.
   */
  breakpoints?: Record<string, number>;
  /** Ajustes da conversão CSS → mobile. */
  native?: {
    /** Base de `rem`/`em` no mobile (padrão 16). */
    remBase?: number;
  };
}

/** Adapter que o bundler escolheu (via `providers/index(.native).ts`). */
let bundled: PlatformAdapter | null = null;
/** Adapter explicitamente escolhido por `configure`. */
let active: PlatformAdapter | null = null;
let used = false;
let remBase = 16;

export const DEFAULT_BREAKPOINTS: Readonly<Record<string, number>> = { sm: 480, md: 768, lg: 1024, xl: 1280 };
let breakpoints: Record<string, number> = { ...DEFAULT_BREAKPOINTS };

/** Nomes que já têm outro significado em `when()`. */
const RESERVED = new Set(['ios', 'android', 'web', 'native', 'hover', 'focus', 'focus-visible', 'pressed']);

/** Chamado pelos módulos `providers/*` no import. Não é API pública. */
export function registerBundledProvider(adapter: PlatformAdapter): void {
  bundled = adapter;
}

/** Só para testes. */
export function resetProvider(): void {
  bundled = null;
  active = null;
  used = false;
  remBase = 16;
  breakpoints = { ...DEFAULT_BREAKPOINTS };
}

export function getProvider(): PlatformAdapter {
  const provider = peekProvider();
  used = true;
  return provider;
}

/** Como `getProvider`, mas sem marcar o provedor como "em uso" (definições em tempo de import). */
export function peekProvider(): PlatformAdapter {
  const provider = active ?? bundled;
  if (!provider) {
    throw new Error(
      '[omnistyle] nenhum provedor disponível. Importe `omnistyle` (o bundler escolhe o provedor) ' +
        'ou chame configure({ provider: <adapter> }).',
    );
  }
  return provider;
}

export function getConfig(): { native: { remBase: number } } {
  return { native: { remBase } };
}

/** Breakpoints ativos (nome → largura mínima em px). */
export function getBreakpoints(): Readonly<Record<string, number>> {
  return breakpoints;
}

export function configure(options: ConfigureOptions = {}): void {
  const { provider = 'auto', theme, native, breakpoints: bps } = options;

  let next: PlatformAdapter;
  if (typeof provider === 'object') {
    next = provider;
  } else if (provider === 'auto') {
    if (!bundled) {
      throw new Error('[omnistyle] provider "auto" sem provedor no bundle. Passe um adapter.');
    }
    next = bundled;
  } else {
    if (!bundled || bundled.name !== provider) {
      const available = bundled ? `"${bundled.name}"` : 'nenhum';
      throw new Error(
        `[omnistyle] provider "${provider}" não está disponível neste bundle (disponível: ${available}). ` +
          `Use "auto" ou o provider que a plataforma atual carrega.`,
      );
    }
    next = bundled;
  }

  if (used && next !== (active ?? bundled)) {
    warnOnce(
      'configure-after-render',
      'configure() trocou o provedor depois do primeiro render. Chame configure() uma vez, no boot do app.',
    );
  }
  active = next;

  if (bps) {
    for (const [name, min] of Object.entries(bps)) {
      if (!/^[A-Za-z_][\w-]*$/.test(name)) {
        throw new Error(`[omnistyle] nome de breakpoint inválido: "${name}" (use letras, números, _ ou -).`);
      }
      if (RESERVED.has(name)) {
        throw new Error(`[omnistyle] "${name}" não pode ser nome de breakpoint (já é uma condição de when()).`);
      }
      if (typeof min !== 'number' || !Number.isFinite(min) || min < 0) {
        throw new Error(`[omnistyle] breakpoint "${name}" precisa de uma largura mínima em px (número >= 0).`);
      }
    }
    breakpoints = { ...bps };
  }

  if (native?.remBase !== undefined) remBase = native.remBase;
  if (theme) updateTheme(theme);
}
