/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isModuleEnabled } from '../../../config';
import { warnModuleDisabled } from '../../../core/modules';
import { DEFAULT_BACKDROP, DIALOG_MARGIN, DIALOG_MAX_WIDTH, DIALOG_RADIUS, MODAL_DURATION, modalProps, type ModalOwnProps } from '../../../core/modal';
import { sheet } from '../css/sheet';

type Props = Omit<ModalOwnProps, 'children'> &
  Omit<React.HTMLAttributes<HTMLDialogElement>, keyof ModalOwnProps | 'children'> & { children?: ReactNode };

const EASE = 'cubic-bezier(.2,.9,.25,1)';

/**
 * CSS of the web `Modal`, inserted once. The look defaults sit in `:where(...)` (zero
 * specificity), so the component's own style (`backgroundColor`, `borderRadius`, padding…) wins.
 */
const RULES = [
  `.om{margin:auto;padding:0;border:0;box-sizing:border-box;width:calc(100vw - ${2 * DIALOG_MARGIN}px);max-width:${DIALOG_MAX_WIDTH}px;max-height:calc(100dvh - ${2 * DIALOG_MARGIN}px);overflow:auto;overscroll-behavior:contain;outline:none;opacity:1;transform:none;transition:opacity ${MODAL_DURATION}ms ease,transform ${MODAL_DURATION}ms ${EASE}}`,
  '.om[open]{display:flex;flex-direction:column}',
  `:where(.om){background-color:#fff;color:#1c1c1e;border-radius:${DIALOG_RADIUS}px;box-shadow:0 8px 32px rgba(0,0,0,.18);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}`,
  '@media (prefers-color-scheme:dark){:where(.om){background-color:#1c1c1e;color:#fff}}',
  // full screen: the whole viewport, the content inside the safe area
  '.om.om-full{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}',
  ':where(.om.om-full){border-radius:0;box-shadow:none}',
  // hidden states, left by `.om-shown`
  '.om-scale:not(.om-shown){opacity:0;transform:scale(.92)}',
  '.om-fade:not(.om-shown){opacity:0}',
  '.om-slide:not(.om-shown){transform:translateY(100vh)}',
  '.om-none{transition:none}',
  `.om::backdrop{background-color:transparent;transition:background-color ${MODAL_DURATION}ms ease}`,
  `.om.om-shown::backdrop{background-color:var(--om-backdrop,${DEFAULT_BACKDROP})}`,
  '.om.om-full::backdrop{background-color:transparent}',
  '@media (prefers-reduced-motion:reduce){.om,.om::backdrop{transition:none}}',
];

const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Web `Modal`: a native `<dialog>` in the top layer (the page behind is inert, focus moves
 * in and comes back, Escape closes it), with the same layouts and animations as iOS and
 * Android. It stays mounted while it animates out. Needs `modules.modal`.
 */
export function Modal(props: Props) {
  if (!isModuleEnabled('modal')) {
    warnModuleDisabled('modal');
    return null;
  }
  return <WebModal {...props} />;
}
Modal.displayName = 'Modal';

function WebModal(props: Props) {
  RULES.forEach((rule, i) => sheet.rule(`modal:${i}`, rule));
  const { open, onOpenChange, animation } = modalProps(props);
  const {
    presentation = 'dialog',
    dismissible = true,
    backdropColor = DEFAULT_BACKDROP,
    onClosed,
    label,
    className,
    style,
    children,
    // consumed by `modalProps`
    open: _open,
    onOpenChange: _onOpenChange,
    animation: _animation,
    visible: _visible,
    onRequestClose: _onRequestClose,
    animationType: _animationType,
    ...rest
  } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // in: into the top layer, then to the shown state (animated); out: animate, then leave and unmount
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;
    if (open) {
      if (!element.open) element.showModal?.();
      // reading the layout applies the hidden state first, so the change animates
      element.getBoundingClientRect();
      setShown(true);
      return undefined;
    }
    setShown(false);
    const timer = setTimeout(
      () => {
        element.close?.();
        setMounted(false);
        onClosed?.();
      },
      animation === 'none' || prefersReducedMotion() ? 0 : MODAL_DURATION,
    );
    return () => clearTimeout(timer);
  }, [open, mounted]);

  if (!mounted) return null;

  const dismiss = () => dismissible && open && onOpenChange?.(false);

  return (
    <dialog
      {...rest}
      // after `rest`: with React 19 `ref` is a prop and may come in it
      ref={dialog}
      aria-label={label}
      aria-modal="true"
      className={['om', `om-${animation}`, presentation === 'fullScreen' ? 'om-full' : '', shown ? 'om-shown' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{ ...style, ['--om-backdrop' as any]: backdropColor }}
      onCancel={(event) => {
        // Escape: animate out instead of closing at once
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        // a click on the backdrop lands on the dialog itself, outside its box
        const element = dialog.current;
        if (!element || event.target !== element) return;
        const box = element.getBoundingClientRect();
        const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (outside) dismiss();
      }}
    >
      {children}
    </dialog>
  );
}
