import { reactNativeAdapter } from '../adapters/react-native/adapter';
import { registerBundledProvider } from '../config';

// O Metro (iOS/Android) resolve este arquivo no lugar de `./index.ts`.
registerBundledProvider(reactNativeAdapter);
