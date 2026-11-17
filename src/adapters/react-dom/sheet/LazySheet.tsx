import React, { Suspense, forwardRef, lazy, useEffect, useState } from 'react';
import { isModuleEnabled } from '../../../config';
import { warnModuleDisabled } from '../../../core/modules';
import type { BottomSheetHandle } from '../../../core/sheet';
import type { SheetProps } from './SheetElement';

/**
 * Entry point of the web `BottomSheet`. The sheet (drag, CSS) is a separate chunk,
 * downloaded only when the module is on and a sheet opens for the first time.
 */
const Sheet = lazy(() => import('./SheetElement').then((m) => ({ default: m.BottomSheet })));

export const BottomSheet = forwardRef<BottomSheetHandle, SheetProps>((props, ref) => {
  // once opened, the sheet stays rendered: it animates out and unmounts its own content
  const [used, setUsed] = useState<boolean>(Boolean(props.open));
  useEffect(() => {
    if (props.open) setUsed(true);
  }, [props.open]);

  if (!isModuleEnabled('sheet')) {
    warnModuleDisabled('sheet');
    return null;
  }
  if (!used) return null;
  return (
    <Suspense fallback={null}>
      <Sheet ref={ref} {...props} />
    </Suspense>
  );
});
BottomSheet.displayName = 'BottomSheet';
