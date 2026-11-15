/**
 * Contrato da primitiva `Video`: o mesmo nas duas plataformas.
 * Web: `<video>` do navegador. Mobile: componente nativo da própria lib
 * (AVPlayer no iOS, Media3 ExoPlayer no Android), sem dependências externas.
 */

export interface MediaTime {
  /** Posição atual, em segundos. */
  currentTime: number;
  /** Duração total, em segundos (0 enquanto desconhecida). */
  duration: number;
}

/** Metadados prontos: duração e tamanho natural do vídeo (0 enquanto desconhecido). */
export interface MediaInfo {
  duration: number;
  width: number;
  height: number;
}

/** Controle imperativo de qualquer mídia (base para futuras mídias, como áudio). */
export interface MediaHandle {
  play(): void;
  pause(): void;
  /** Vai para a posição indicada, em segundos. */
  seekTo(seconds: number): void;
}

/** Controle imperativo do `Video`, obtido pelo `ref`. */
export interface VideoHandle extends MediaHandle {
  /** Entra ou sai da tela cheia. */
  setFullscreen(fullscreen: boolean): void;
}

/** Props de reprodução (base para futuras mídias, como áudio). */
export interface PlaybackProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Velocidade: 1 = normal, 2 = dobro. */
  rate?: number;
  /** 0 a 1. */
  volume?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: MediaTime) => void;
  /** Metadados prontos: duração e tamanho natural. */
  onLoad?: (info: MediaInfo) => void;
  onError?: (message: string) => void;
  /** Pulou de posição (barra, ±10 s ou `seekTo`), em segundos. */
  onSeek?: (seek: { from: number; to: number }) => void;
  /** Começou (`true`) ou terminou (`false`) de esperar dados para continuar. */
  onBuffering?: (buffering: boolean) => void;
  /** Até onde o conteúdo já foi baixado, em segundos. */
  onBufferedChange?: (buffered: number) => void;
  /** Volume ou mudo mudaram (pelos controles ou pelas props). */
  onVolumeChange?: (volume: { volume: number; muted: boolean }) => void;
  /** A velocidade mudou (pelos controles ou pela prop `rate`). */
  onRateChange?: (rate: number) => void;
}

export interface VideoOwnProps extends PlaybackProps {
  /** Imagem mostrada antes de dar play. */
  poster?: string;
  /** Controles do sistema. Padrão: `true`. */
  controls?: boolean;
  /** Entrou (`true`) ou saiu (`false`) da tela cheia. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /**
   * Entrou (`true`) ou saiu (`false`) do picture-in-picture.
   * @platform web — no mobile o PiP ainda não foi implementado.
   */
  onPictureInPictureChange?: (active: boolean) => void;
}
