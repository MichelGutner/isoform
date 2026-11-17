import { reactDomAdapter } from '../adapters/react-dom/adapter';
import { registerBundledProvider } from '../config';

// Vite, webpack e Next resolvem este arquivo. O Metro prefere `./index.native.ts`.
registerBundledProvider(reactDomAdapter);
