/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { flatHeaders, type ImageCacheApi } from '../../../core/image';

declare const require: (id: string) => any;

type ModuleSpec = typeof import('./native/NativeIsoImageModule');

/** The TurboModule, looked up on first use (`null` when the app was built without the image module). */
const nativeModule = (): ModuleSpec['default'] => {
  try {
    return (require('./native/NativeIsoImageModule') as ModuleSpec).default;
  } catch {
    return null;
  }
};

/** `prefetchImages` and `clearImageCache` on iOS and Android. */
export const nativeImageCache: ImageCacheApi = {
  prefetch: (urls, { cachePolicy = 'disk', headers }) =>
    nativeModule()?.prefetch(urls, flatHeaders(headers), cachePolicy !== 'disk', cachePolicy !== 'memory') ?? Promise.resolve(false),
  clear: (options) => nativeModule()?.clear(options.memory, options.disk) ?? Promise.resolve(),
};
