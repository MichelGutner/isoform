import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { ModalOwnProps } from '../../../core/modal';

/**
 * Entry point of the web `Modal`. The dialog (CSS, animation, focus handling) is a separate chunk,
 * downloaded the first time a modal opens: an app that never opens one does not pay for it.
 */
const WebModal = lazy(() => import('./Modal').then((m) => ({ default: m.Modal })));

type Props = React.ComponentProps<typeof import('./Modal').Modal>;

const isOpen = (props: ModalOwnProps) => Boolean(props.open ?? props.visible);

export function Modal(props: Props) {
  // once opened it stays rendered: it animates out and unmounts its own content
  const [used, setUsed] = useState<boolean>(isOpen(props));
  const open = isOpen(props);
  useEffect(() => {
    if (open) setUsed(true);
  }, [open]);

  if (!used && !open) return null;
  return (
    <Suspense fallback={null}>
      <WebModal {...props} />
    </Suspense>
  );
}
Modal.displayName = 'Modal';
