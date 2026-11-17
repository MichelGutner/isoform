/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo, useEffect, useRef } from 'react';
import type { PdfDocument } from './pdfDocument';

/**
 * Thumbnails panel of the web `Pdf`: every page, small, drawn only when it
 * scrolls into the panel. The current page is outlined; clicking goes to it.
 */

/** Width of a thumbnail, in CSS pixels (must match `.op-thumb-frame` in `pdfStyles.ts`). */
const THUMB_WIDTH = 96;

interface ThumbProps {
  /** The open document. */
  doc: PdfDocument;
  /** Page index, from `0`. */
  index: number;
  /** Whether it is the page on screen. */
  current: boolean;
  /** The panel (scroll root that decides when a thumbnail is drawn). */
  root: React.RefObject<HTMLDivElement | null>;
  /** Called with the page index when clicked. */
  onSelect(index: number): void;
}

/** Draws the thumbnail the first time it becomes visible inside the panel. */
function useThumbnail(frame: React.RefObject<HTMLDivElement | null>, root: React.RefObject<HTMLDivElement | null>, doc: PdfDocument, index: number) {
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    let task: any = null;
    const draw = async () => {
      const page = await doc.page(index);
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (THUMB_WIDTH * ratio) / doc.sizes[index].width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      task = page.render({ canvas, viewport });
      await task.promise;
      element.replaceChildren(canvas);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        draw().catch(() => undefined);
      },
      { root: root.current, rootMargin: '200px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      task?.cancel();
    };
  }, [frame, root, doc, index]);
}

const Thumb = memo(function Thumb({ doc, index, current, root, onSelect }: ThumbProps) {
  const frame = useRef<HTMLDivElement>(null);
  useThumbnail(frame, root, doc, index);
  const { width, height } = doc.sizes[index];
  useEffect(() => {
    if (current) frame.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  return (
    <button
      type="button"
      className="op-thumb"
      aria-current={current ? 'page' : undefined}
      aria-label={`Page ${index + 1}`}
      onClick={() => onSelect(index)}
    >
      <div ref={frame} className="op-thumb-frame" style={{ height: (THUMB_WIDTH * height) / width }} />
      <span>{index + 1}</span>
    </button>
  );
});

export interface PdfThumbnailsProps {
  /** The open document. */
  doc: PdfDocument;
  /** Page on screen, from `0`. */
  page: number;
  /** Called with the page index of the clicked thumbnail. */
  onSelect(index: number): void;
}

export function PdfThumbnails({ doc, page, onSelect }: PdfThumbnailsProps) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root} className="op-thumbs" role="navigation" aria-label="Pages">
      {doc.sizes.map((_, index) => (
        <Thumb key={index} doc={doc} index={index} current={index === page} root={root} onSelect={onSelect} />
      ))}
    </div>
  );
}
