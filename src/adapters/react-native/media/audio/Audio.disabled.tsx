/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import type { AudioHandle } from '../../../../core/media';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * `Audio` without a player: `omnistyle/metro` uses this file instead of
 * `Audio.tsx` when audio is off in `omnistyle.config.json`, so neither the
 * player nor the native spec enter the JS bundle.
 */
export const Audio = forwardRef<AudioHandle, any>(({ style, testID }, _ref) => {
  warnModuleDisabled('audio');
  return <View style={style} testID={testID} />;
});
Audio.displayName = 'Audio';
