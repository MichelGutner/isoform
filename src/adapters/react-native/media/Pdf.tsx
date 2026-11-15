/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef } from 'react';
import type { PdfOwnProps } from '../../../core/media';
import { MissingModule } from './MissingModule';

declare const require: (id: string) => any;

/** `require` dentro de `try/catch`: dependência OPCIONAL para o Metro (veja `Video.tsx`). */
let cached: any;
function reactNativePdf(): any {
  if (cached === undefined) {
    try {
      const mod = require('react-native-pdf');
      cached = mod.default ?? mod;
    } catch {
      cached = null;
    }
  }
  return cached;
}

/** `react-native-pdf` usa código nativo: precisa de dev build (não roda no Expo Go). */
export const Pdf = forwardRef<any, Partial<PdfOwnProps> & { style?: any; testID?: string }>(
  ({ src, page, onLoad, onPageChange, onError, style, testID }, ref) => {
    const NativePdf = reactNativePdf();
    if (!NativePdf) return <MissingModule primitive="Pdf" pkg="react-native-pdf" style={style} />;
    return (
      <NativePdf
        ref={ref}
        testID={testID}
        source={{ uri: src, cache: true }}
        page={page ?? 1}
        style={[{ flexGrow: 1, minHeight: 320 }, style]}
        onLoadComplete={(pages: number) => onLoad?.({ pages })}
        onPageChanged={(current: number, pages: number) => onPageChange?.(current, pages)}
        onError={(error: any) => onError?.(String(error?.message ?? error))}
      />
    );
  },
);
Pdf.displayName = 'Pdf';
