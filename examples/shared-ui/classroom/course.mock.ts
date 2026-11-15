import type { Course } from './types';

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
        { id: 'a1', title: 'Anatomia do coração', kind: 'video', detail: '14 min' },
        { id: 'a2', title: 'Ciclo cardíaco', kind: 'video', detail: '18 min' },
        { id: 'a3', title: 'Resumo: fisiologia cardíaca', kind: 'pdf', detail: '12 páginas' },
      ],
    },
    {
      id: 'm2',
      title: 'Arritmias',
      assets: [
        { id: 'a4', title: 'Leitura do eletrocardiograma', kind: 'video', detail: '22 min' },
        { id: 'a5', title: 'Fibrilação atrial', kind: 'video', detail: '16 min' },
        { id: 'a6', title: 'Questões de arritmias', kind: 'quiz', detail: '5 questões' },
      ],
    },
    {
      id: 'm3',
      title: 'Insuficiência cardíaca',
      assets: [
        { id: 'a7', title: 'Classificação e diagnóstico', kind: 'video', detail: '20 min' },
        { id: 'a8', title: 'Tratamento medicamentoso', kind: 'pdf', detail: '9 páginas' },
      ],
    },
  ],
};
