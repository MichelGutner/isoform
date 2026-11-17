// The examples' theme shape, declared once, as an app would (see the TypeScript guide).
import type { lightTokens } from './setup';

type Tokens = typeof lightTokens;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface EngineTheme extends Tokens {}
}

export {};
