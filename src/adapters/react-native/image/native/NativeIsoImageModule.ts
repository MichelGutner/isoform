/**
 * Spec of the image cache module (TurboModule): `prefetchImages` and `clearImageCache`.
 * Implemented by ios/image/IsoImageModule.mm and android/src/image/.../IsoImageModule.kt;
 * with the `image` module off the native side is an empty shell and `get` returns `null`
 * on Android (the iOS shell resolves `false`).
 */
import { TurboModuleRegistry } from 'react-native';
import type { TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Downloads the pictures into the cache.
   * @param urls The pictures.
   * @param headers HTTP headers as `[name, value, name, value…]`.
   * @param memory Decodes them into the memory cache.
   * @param disk Keeps the files in the disk cache.
   * @returns `true` when every picture was cached.
   */
  prefetch(urls: ReadonlyArray<string>, headers: ReadonlyArray<string>, memory: boolean, disk: boolean): Promise<boolean>;
  /** Empties the memory cache, the disk cache or both. */
  clear(memory: boolean, disk: boolean): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('IsoImageModule');
