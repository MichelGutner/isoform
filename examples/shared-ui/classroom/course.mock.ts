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
        { id: 'a2', title: 'Ciclo cardíaco', kind: 'video', detail: '18 min', src: VIDEOS.bunny },
        { id: 'a3', title: 'Podcast: ausculta cardíaca', kind: 'audio', detail: '6 min', src: AUDIO.song },
        { id: 'a3b', title: 'Resumo: fisiologia cardíaca', kind: 'pdf', detail: '12 páginas' },
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
        { id: 'a8', title: 'Tratamento medicamentoso', kind: 'pdf', detail: '9 páginas' },
      ],
    },
  ],
};
