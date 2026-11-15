/** Modelo de dados da sala de aula. */

export type AssetKind = 'video' | 'audio' | 'pdf' | 'quiz';

/** Um conteúdo da aula (o que aparece na playlist e no player). */
export interface Asset {
  id: string;
  title: string;
  kind: AssetKind;
  /** Texto curto de apoio, como "12 min" ou "5 questões". */
  detail: string;
  /** Endereço do vídeo (MP4 ou HLS) ou do áudio (MP3), só para `kind: 'video'` e `'audio'`. */
  src?: string;
  /** Endereço da capa, só para `kind: 'audio'`. */
  cover?: string;
}

/** Um módulo agrupa conteúdos (é o "acordeão" da playlist). */
export interface Module {
  id: string;
  title: string;
  assets: Asset[];
}

export interface Course {
  title: string;
  subtitle: string;
  /** Trilha do breadcrumb, da raiz até a aula atual. */
  breadcrumb: string[];
  modules: Module[];
}
