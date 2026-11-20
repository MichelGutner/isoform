/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import type { PdfHandle } from '../../../../core/pdf';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * `Pdf` without a viewer: `react-isoform/metro` uses this file instead of
 * `Pdf.tsx` when pdf is off in `isoform.config.json`, so neither the
 * viewer nor the native spec enter the JS bundle.
 */
export const Pdf = forwardRef<PdfHandle, any>(({ style, testID }, _ref) => {
  warnModuleDisabled('pdf');
  return <View style={style} testID={testID} />;
});
Pdf.displayName = 'Pdf';
