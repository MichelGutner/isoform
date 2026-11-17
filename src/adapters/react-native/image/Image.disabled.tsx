/**
 * `Image` without the lib's pipeline: `@michelgutner/isoform/metro` uses this file instead of
 * `Image.tsx` when the image module is off in `isoform.config.json`, so neither the
 * pipeline's JS nor its native spec enter the bundle. It is React Native's `Image`.
 */
export { PlainImage as Image } from './PlainImage';
