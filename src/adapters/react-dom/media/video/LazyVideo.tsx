/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, forwardRef, lazy } from 'react';
import { isModuleEnabled } from '../../../../config';
import type { VideoHandle } from '../../../../core/media';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * Porta de entrada do `Video` na web. O player (controles, ícones, CSS) fica
 * num chunk separado, baixado só quando o módulo está ligado e um `Video`
 * aparece na tela: com `modules.video` desligado, nada dele é carregado.
 */
const Player = lazy(() => import('./VideoElement').then((m) => ({ default: m.Video })));

/** Espaço do vídeo (mesmo estilo) enquanto o player carrega ou com o módulo desligado. */
const Placeholder = ({ className, style, 'data-testid': testId }: any) => (
  <div className={className} style={style} data-testid={testId} />
);

export const Video = forwardRef<VideoHandle, any>((props, ref) => {
  if (!isModuleEnabled('video')) {
    warnModuleDisabled('video');
    return <Placeholder {...props} />;
  }
  return (
    <Suspense fallback={<Placeholder {...props} />}>
      <Player ref={ref} {...props} />
    </Suspense>
  );
});
Video.displayName = 'Video';
