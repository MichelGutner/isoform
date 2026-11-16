/* eslint-disable @typescript-eslint/no-explicit-any */
import { forwardRef } from 'react';
import type { BottomSheetHandle } from '../../../core/sheet';
import { warnModuleDisabled } from '../../../core/modules';

/**
 * `BottomSheet` without the native sheet: `omnistyle/metro` uses this file instead of
 * `BottomSheet.tsx` when the sheet is off in `omnistyle.config.json`, so neither the
 * sheet nor its native spec enter the JS bundle.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, any>((_props, _ref) => {
  warnModuleDisabled('sheet');
  return null;
});
BottomSheet.displayName = 'BottomSheet';
