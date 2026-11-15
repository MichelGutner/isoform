/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef } from 'react';
import type { PdfOwnProps } from '../../../core/media';

/**
 * `Pdf` na web: o visualizador do próprio navegador, dentro de um `<iframe>`.
 * Ele não expõe número de páginas nem mudança de página, então `onPageChange`
 * não é chamado (e `onLoad` vem sem `pages`). A página inicial vai no `#page=`.
 */
export const Pdf = forwardRef<any, Partial<PdfOwnProps> & { [rest: string]: any }>(
  ({ src, page, onLoad, onPageChange: _onPageChange, onError, ...rest }, ref) =>
    createElement('iframe', {
      title: 'PDF',
      ...rest,
      ref,
      src: src ? `${src}#page=${page ?? 1}` : undefined,
      onLoad: () => onLoad?.({}),
      onError: () => onError?.('Falha ao carregar o PDF.'),
    }),
);
Pdf.displayName = 'Pdf';
