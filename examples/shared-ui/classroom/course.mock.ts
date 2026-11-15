import type { Course } from './types';

/** Vídeos públicos para testar de ponta a ponta (web, iOS e Android). */
const VIDEOS = {
  /** MDN, licença CC0. MP4 (H.264). */
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  /** Big Buck Bunny (Blender Foundation), trecho de 10s em 720p. MP4 (H.264). */
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  /** Stream de teste da Apple. HLS: toca no iOS, no Android e no Safari (o Chrome pode não tocar). */
  hls: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
};

/** Áudio público para testar o player de áudio (MP3). */
const AUDIO = {
  /** SoundHelix, música de teste livre. */
  song: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  /** Capa de teste (Picsum, a mesma imagem para a mesma "semente"). Aparece no cartão e nos controles do sistema. */
  cover: 'https://picsum.photos/seed/omnistyle-audio/600/600',
};

/** PDFs públicos para testar o leitor (servidos com CORS, então abrem também na web). */
const PDF = {
  /** Artigo do pdf.js (Mozilla): 14 páginas de texto, com links e sumário. */
  paper: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf',
};

/** Imagem de teste do Picsum (a mesma para a mesma "semente"). */
const picture = (seed: string, width: number, height: number) => `https://picsum.photos/seed/${seed}/${width}/${height}`;

/** Listas de exemplo: cada aula mostra um carrossel abaixo do player. */
const LISTS = {
  videos: [
    { src: VIDEOS.bunny, title: 'Ciclo cardíaco: sístole', poster: picture('omni-v1', 640, 360) },
    { src: VIDEOS.flower, title: 'Ciclo cardíaco: diástole', poster: picture('omni-v2', 640, 360) },
    { src: VIDEOS.hls, title: 'Bulhas e sopros (HLS)', poster: picture('omni-v3', 640, 360) },
    { src: VIDEOS.bunny, title: 'Revisão rápida', poster: picture('omni-v4', 640, 360) },
  ],
  audios: [1, 2, 3, 8].map((n, i) => ({
    src: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`,
    title: ['Ausculta: foco mitral', 'Ausculta: foco aórtico', 'Ausculta: foco tricúspide', 'Ausculta: foco pulmonar'][i],
    artist: 'Cardiologia clínica',
    artwork: picture(`omni-a${n}`, 600, 600),
  })),
  pdfs: [
    { src: PDF.paper, title: 'Resumo: fisiologia cardíaca', thumbnail: picture('omni-p1', 300, 400) },
    { src: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/test/pdfs/TAMReview.pdf', title: 'Artigo de revisão', thumbnail: picture('omni-p2', 300, 400) },
    { src: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', title: 'Folha de exercícios' },
    {
      src: "https://sanar-directus-prod.s3.amazonaws.com/8f3d535d-fe4a-4b45-a428-654f513cdc29.pdf?AWSAccessKeyId=AKIAWKT5HDXLSYTKHY4O&Expires=1794856274&Signature=HRxpygkf5Oto19D9s2kPFQ4jGGQ%3D",
      title: 'Acidente Vascular Cerebral Isquêmico'
    }
  ],
};

/** Curso de exemplo (no app real viria da API). */
export const course: Course = {
  title: 'Cardiologia clínica',
  subtitle: 'Residência médica',
  breadcrumb: ['Início', 'Residência', 'Cardiologia clínica'],
  modules: [
    {
      id: 'm1',
      title: 'Fundamentos',
      assets: [
        { id: 'a1', title: 'Anatomia do coração', kind: 'video', detail: '14 min', src: VIDEOS.flower },
        { id: 'a2', title: 'Ciclo cardíaco', kind: 'video', detail: '4 vídeos', items: LISTS.videos },
        { id: 'a3', title: 'Podcast: ausculta cardíaca', kind: 'audio', detail: '4 episódios', items: LISTS.audios },
        { id: 'a3b', title: 'Material de apoio', kind: 'pdf', detail: '3 PDFs', items: LISTS.pdfs },
      ],
    },
    {
      id: 'm2',
      title: 'Arritmias',
      assets: [
        { id: 'a4', title: 'Leitura do eletrocardiograma', kind: 'video', detail: 'HLS · 22 min', src: VIDEOS.hls },
        { id: 'a5', title: 'Fibrilação atrial', kind: 'video', detail: '16 min', src: VIDEOS.flower },
        { id: 'a6', title: 'Questões de arritmias', kind: 'quiz', detail: '5 questões' },
      ],
    },
    {
      id: 'm3',
      title: 'Insuficiência cardíaca',
      assets: [
        { id: 'a7', title: 'Classificação e diagnóstico', kind: 'video', detail: '20 min', src: VIDEOS.bunny },
        { id: 'a8', title: 'Tratamento medicamentoso', kind: 'pdf', detail: '14 páginas', src: PDF.paper },
      ],
    },
  ],
};
