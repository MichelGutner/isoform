/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tela cheia na web, com as diferenças entre navegadores escondidas aqui:
 *  · padrão: `requestFullscreen` no container (os nossos controles vão junto);
 *  · Safari no iPhone: só o próprio `<video>` entra em tela cheia (`webkitEnterFullscreen`),
 *    e aí o iOS mostra os controles dele.
 */

const ignore = () => undefined;

const canUseStandard = (el: Element | null): el is HTMLElement => !!el && typeof (el as any).requestFullscreen === 'function';

export function enterFullscreen(root: HTMLElement | null, video: HTMLVideoElement | null): void {
  if (canUseStandard(root)) {
    void root.requestFullscreen().catch(ignore);
    return;
  }
  (video as any)?.webkitEnterFullscreen?.();
}

export function exitFullscreen(video: HTMLVideoElement | null): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(ignore);
    return;
  }
  (video as any)?.webkitExitFullscreen?.();
}

/** Entra ou sai da tela cheia (ação do botão e do `ref.setFullscreen`). */
export const setFullscreen = (on: boolean, root: HTMLElement | null, video: HTMLVideoElement | null): void =>
  on ? enterFullscreen(root, video) : exitFullscreen(video);

export const isFullscreen =(root: HTMLElement | null): boolean => !!root && document.fullscreenElement === root;

/**
 * Avisa quando o player entra ou sai da tela cheia (pelo nosso botão, pelo Esc
 * ou pelo iOS). Devolve a função que remove os ouvintes.
 */
export function watchFullscreen(
  root: HTMLElement,
  video: HTMLVideoElement,
  onChange: (fullscreen: boolean) => void,
): () => void {
  const standard = () => onChange(isFullscreen(root));
  const enter = () => onChange(true);
  const exit = () => onChange(false);
  const listeners: Array<[EventTarget, string, () => void]> = [
    [document, 'fullscreenchange', standard],
    [video, 'webkitbeginfullscreen', enter],
    [video, 'webkitendfullscreen', exit],
  ];
  listeners.forEach(([target, type, fn]) => target.addEventListener(type, fn));
  return () => listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn));
}
