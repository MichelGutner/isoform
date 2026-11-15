/**
 * Contrato das primitivas de mídia (`Video`, `Audio`, `Pdf`, `Embed`): o mesmo
 * nas duas plataformas. A web usa o elemento do navegador; o mobile usa uma
 * dependência opcional (veja `adapters/react-native/media`).
 */

export interface MediaTime {
  /** Posição atual, em segundos. */
  currentTime: number;
  /** Duração total, em segundos (0 enquanto desconhecida). */
  duration: number;
}

/** Controle imperativo, obtido pelo `ref` de `Video` e `Audio`. */
export interface MediaHandle {
  play(): void;
  pause(): void;
  /** Vai para a posição indicada, em segundos. */
  seekTo(seconds: number): void;
}

/** Props de reprodução comuns a `Video` e `Audio`. */
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
  /** Metadados prontos (a duração já é conhecida). */
  onLoad?: (info: { duration: number }) => void;
  onError?: (message: string) => void;
}

export interface VideoOwnProps extends PlaybackProps {
  /** Imagem mostrada antes de dar play. */
  poster?: string;
  /** Controles do sistema. Padrão: `true`. */
  controls?: boolean;
}

export interface AudioOwnProps extends PlaybackProps {
  /** Barra de controle mínima. Padrão: `true`. */
  controls?: boolean;
}

export interface PdfOwnProps {
  src: string;
  /** Página inicial (começa em 1). */
  page?: number;
  /** `pages` só é informado no mobile: o visualizador do navegador não expõe isso. */
  onLoad?: (info: { pages?: number }) => void;
  /** Só no mobile (veja `onLoad`). */
  onPageChange?: (page: number, pages: number) => void;
  onError?: (message: string) => void;
}

export interface EmbedOwnProps {
  /** Endereço da página. Use `html` para conteúdo próprio. */
  src?: string;
  /** HTML inline (vence `src`). */
  html?: string;
  /** Rótulo de acessibilidade. */
  title?: string;
  onLoad?: () => void;
  onError?: (message: string) => void;
}
