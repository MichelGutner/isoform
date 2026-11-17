/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Picture-in-picture na web, com as diferenças entre navegadores escondidas aqui:
 *  · padrão (Chrome, Edge, Safari 13.1+): `requestPictureInPicture`;
 *  · Safari antigo / iPhone: `webkitSetPresentationMode('picture-in-picture')`.
 * O Firefox não expõe API (ele tem o próprio botão sobre o vídeo): lá o botão não aparece.
 */

const PIP = 'picture-in-picture';
const ignore = () => undefined;

const hasStandard = () => typeof document !== 'undefined' && !!(document as any).pictureInPictureEnabled;
const hasWebkit = (v: HTMLVideoElement) => typeof (v as any).webkitSetPresentationMode === 'function';

export const isPictureInPictureSupported = (v: HTMLVideoElement | null): boolean =>
  !!v && !v.disablePictureInPicture && (hasStandard() || hasWebkit(v));

const isActive = (v: HTMLVideoElement) =>
  (document as any).pictureInPictureElement === v || (v as any).webkitPresentationMode === PIP;

function toggleStandard(v: HTMLVideoElement): void {
  const request = isActive(v) ? (document as any).exitPictureInPicture() : (v as any).requestPictureInPicture();
  void request.catch(ignore);
}

const toggleWebkit = (v: HTMLVideoElement) => (v as any).webkitSetPresentationMode(isActive(v) ? 'inline' : PIP);

export function togglePictureInPicture(v: HTMLVideoElement | null): void {
  if (!v) return;
  if (hasStandard()) return toggleStandard(v);
  if (hasWebkit(v)) toggleWebkit(v);
}

/** Avisa quando o vídeo entra ou sai do PiP. Devolve a função que remove os ouvintes. */
export function watchPictureInPicture(v: HTMLVideoElement, onChange: (active: boolean) => void): () => void {
  const update = () => onChange(isActive(v));
  const types = ['enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged'];
  types.forEach((type) => v.addEventListener(type, update));
  return () => types.forEach((type) => v.removeEventListener(type, update));
}
