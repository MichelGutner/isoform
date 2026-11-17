/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import type { VideoHandle } from '../../../../core/media';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * `Video` sem player: o `@michelgutner/isoform/metro` usa este arquivo no lugar de
 * `Video.tsx` quando o vídeo está desligado no `isoform.config.json`.
 * Assim nem o player nem a spec nativa entram no bundle JS.
 */
export const Video = forwardRef<VideoHandle, any>(({ style, testID }, _ref) => {
  warnModuleDisabled('video');
  return <View style={[{ backgroundColor: '#000' }, style]} testID={testID} />;
});
Video.displayName = 'Video';
