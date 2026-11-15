/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef } from 'react';
import type { EmbedOwnProps } from '../../../core/media';

/** `Embed` na web: um `<iframe>`. `html` vira `srcDoc` e vence `src`. */
export const Embed = forwardRef<any, EmbedOwnProps & { [rest: string]: any }>(
  ({ src, html, title, onLoad, onError, ...rest }, ref) =>
    createElement('iframe', {
      ...rest,
      ref,
      title: title ?? 'Conteúdo incorporado',
      ...(html !== undefined ? { srcDoc: html } : { src }),
      onLoad: () => onLoad?.(),
      onError: () => onError?.('Falha ao carregar o conteúdo.'),
    }),
);
Embed.displayName = 'Embed';
