/**
 * `Modal` without the lib's modal: `isoform/metro` uses this file instead of
 * `Modal.tsx` when the modal module is off in `isoform.config.json`, so neither the
 * modal's JS nor its native spec enter the bundle. It is React Native's `Modal`.
 */
export { PlainModal as Modal } from './PlainModal';
