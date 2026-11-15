/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, forwardRef, lazy } from 'react';
import { isModuleEnabled } from '../../../../config';
import type { PdfHandle } from '../../../../core/pdf';
import { warnModuleDisabled } from '../../../../core/modules';

/**
 * Entry point of the web `Pdf`. The viewer and pdf.js live in separate chunks,
 * downloaded only when the module is on and a `Pdf` shows up: with
 * `modules.pdf` off, none of it is loaded.
 */
const Viewer = lazy(() => import('./PdfElement').then((m) => ({ default: m.Pdf })));

/** Same-style box while the viewer loads or when the module is off. */
const Placeholder = ({ className, style, 'data-testid': testId }: any) => (
  <div className={className} style={style} data-testid={testId} />
);

export const Pdf = forwardRef<PdfHandle, any>((props, ref) => {
  if (!isModuleEnabled('pdf')) {
    warnModuleDisabled('pdf');
    return <Placeholder {...props} />;
  }
  return (
    <Suspense fallback={<Placeholder {...props} />}>
      <Viewer ref={ref} {...props} />
    </Suspense>
  );
});
Pdf.displayName = 'Pdf';
