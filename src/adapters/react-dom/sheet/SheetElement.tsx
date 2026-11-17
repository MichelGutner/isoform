/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_DETENTS,
  SHEET_TOP_GAP,
  resolveDetents,
  settleDetent,
  type BottomSheetHandle,
  type BottomSheetOwnProps,
} from '../../../core/sheet';
import { ensureSheetStyles } from './sheetStyles';

/** The sheet's props plus the DOM ones that reach the `<dialog>` (`id`, `aria-*`, `data-*`…). */
export type SheetProps = Omit<BottomSheetOwnProps, 'children'> &
  Omit<React.HTMLAttributes<HTMLDialogElement>, keyof BottomSheetOwnProps | 'children'> & {
    children?: ReactNode;
    'data-testid'?: string;
  };

/** Duration of the open/close/snap animation (keep in sync with `sheetStyles`). */
const DURATION = 320;

type Props = SheetProps;
/** Movement (px) before a press becomes a drag. */
const SLOP = 6;

/** Height of the visible viewport and how much the on-screen keyboard covers. */
function useViewport() {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const height = vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
    const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    return { height, keyboard };
  };
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setViewport(read());
    (vv ?? window).addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      (vv ?? window).removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);
  return viewport;
}

const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Elements where a press must not start a drag (typing, selecting). */
const NO_DRAG = 'input,textarea,select,[contenteditable="true"],[data-sheet-no-drag]';

/**
 * Web `BottomSheet`: a native `<dialog>` (top layer, inert page, focus moved in and
 * restored, Escape) with the lib's drag and snapping. It stays mounted while it
 * animates out, then unmounts its content.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, Props>((props, ref) => {
  const { open, detent = 0 } = props;
  const [mounted, setMounted] = useState(open);
  const [resting, setResting] = useState(detent);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  useEffect(() => setResting(detent), [detent]);
  // `snapTo` reports the move like a drag does (read through a ref: the handle is created once)
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(
    ref,
    () => ({
      snapTo: (index: number) => {
        setResting(index);
        latest.current.onDetentChange?.({ index });
      },
    }),
    [],
  );

  if (!mounted) return null;
  return (
    <Panel
      {...props}
      resting={resting}
      onRest={setResting}
      onDone={() => {
        setMounted(false);
        props.onClosed?.();
      }}
    />
  );
});
BottomSheet.displayName = 'BottomSheet';

function Panel({
  open,
  onOpenChange,
  detents,
  onDetentChange,
  dismissible = true,
  modal = true,
  grabber = true,
  label,
  className,
  style,
  children,
  resting,
  onRest,
  onDone,
  // consumed by the outer component
  detent: _detent,
  onClosed: _onClosed,
  ...rest
}: Props & { resting: number; onRest(index: number): void; onDone(): void }) {
  ensureSheetStyles();
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
  const [natural, setNatural] = useState(0);
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [scrolls, setScrolls] = useState(false);

  const list = detents?.length ? detents : DEFAULT_DETENTS;
  const fits = list.includes('fit');
  const anchors = resolveDetents(list, viewport.height - SHEET_TOP_GAP, natural);
  const heights = anchors.map((a) => a.height);
  const tallest = heights.at(-1) ?? 0;
  const ready = !fits || natural > 0;
  const restHeight = anchors.find((a) => a.source === resting)?.height ?? heights[0] ?? 0;
  const target = open && ready && !dismissing ? restHeight : 0;

  // open: into the top layer (modal) or over the page (non-modal)
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (modal) element.showModal();
    else element.show();
  }, [modal]);

  useEffect(() => {
    if (open) setDismissing(false);
  }, [open]);

  // natural height of the content (the `fit` detent), and whether it overflows
  useLayoutEffect(() => {
    const element = dialog.current;
    const scroller = body.current;
    if (!element || !scroller) return;
    const measure = () => {
      const chrome = element.offsetHeight - scroller.clientHeight;
      setNatural(Math.ceil(chrome + scroller.scrollHeight));
      setScrolls(scroller.scrollHeight > scroller.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    Array.from(scroller.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  // animate to the target (open, snap, close); after closing, leave the top layer and unmount
  useEffect(() => {
    if (dragging) return;
    // reading the layout applies the current height first, so the change below animates
    // (no requestAnimationFrame: it barely runs in background tabs)
    dialog.current?.getBoundingClientRect();
    setHeight(target);
    if (target === 0 && (!open || dismissing)) {
      const timer = setTimeout(() => {
        dialog.current?.close();
        onDone();
      }, prefersReducedMotion() ? 0 : DURATION);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, dragging]);

  const dismiss = () => {
    if (!dismissible || dismissing) return;
    setDismissing(true);
    onOpenChange?.(false);
  };

  // ── drag ──
  const drag = useRef<{ y: number; start: number; moved: boolean; samples: Array<{ y: number; t: number }> } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    if (event.button !== 0 || (event.target as Element).closest?.(NO_DRAG)) return;
    drag.current = { y: event.clientY, start: height, moved: false, samples: [{ y: event.clientY, t: event.timeStamp }] };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDialogElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.y;
    if (!state.moved) {
      if (Math.abs(dy) < SLOP) return;
      // content that scrolls keeps the gesture: down while scrolled, up when fully open
      const scroller = body.current;
      const inBody = scroller?.contains(event.target as Node);
      if (inBody && scroller && ((dy > 0 && scroller.scrollTop > 0) || (dy < 0 && height >= tallest - 1))) {
        drag.current = null;
        return;
      }
      state.moved = true;
      setDragging(true);
      // keep receiving the moves outside the sheet (it throws for a pointer that already ended)
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // the drag still works while the pointer stays over the sheet
      }
    }
    state.samples = [...state.samples.slice(-4), { y: event.clientY, t: event.timeStamp }];
    // past the tallest detent it resists (rubber band)
    const next = state.start - dy;
    setHeight(next > tallest ? tallest + (next - tallest) * 0.2 : Math.max(0, next));
  };

  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    suppressClick.current = true;
    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const seconds = Math.max((last.t - first.t) / 1000, 0.001);
    const upward = -(last.y - first.y) / seconds;
    const index = settleDetent(heights, height, upward, dismissible);
    setDragging(false);
    if (index < 0) {
      dismiss();
      return;
    }
    const source = anchors[index].source;
    if (source !== resting) {
      onRest(source);
      onDetentChange?.({ index: source });
    }
  };

  return (
    <dialog
      ref={dialog}
      {...rest}
      aria-label={label}
      className={['os', open && height > 0 ? 'os-shown' : '', dragging ? 'os-dragging' : '', className].filter(Boolean).join(' ')}
      style={{
        ...style,
        ['--h' as any]: height,
        ['--kb' as any]: `${viewport.keyboard}px`,
        height: fits ? undefined : tallest,
      }}
      onCancel={(event) => {
        // Escape: animate out instead of closing at once
        event.preventDefault();
        dismiss();
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          event.stopPropagation();
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        // a click on the backdrop lands on the dialog itself, above its box
        if (event.target === dialog.current && event.clientY < dialog.current.getBoundingClientRect().top) dismiss();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {grabber ? <div className="os-grab" aria-hidden="true" /> : null}
      <div
        ref={body}
        className={scrolls ? 'os-body os-scrolls' : 'os-body'}
        // smaller detents: the hidden part of the sheet is not scrolled into
        style={fits ? undefined : { marginBottom: Math.max(0, tallest - restHeight) }}
      >
        {children}
      </div>
    </dialog>
  );
}
