/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo, useEffect, useRef, useState } from 'react';
import type { LocatedMatch, PageBox, PageLink, PageSize, PdfDocument } from './pdfDocument';
import type { Pdfjs } from './pdfjs';

/**
 * One page of the web `Pdf`: a canvas, pdf.js's invisible text layer (selection
 * and copy), the search highlights and the link areas. The canvas is only drawn
 * while the page is near the screen (`active`); far pages keep just their size.
 */

/** Largest canvas, in pixels (browsers refuse or slow down above ~16 MP). */
const MAX_CANVAS_PIXELS = 16_777_216;
/** Wait after a zoom change before drawing again at the new size (the canvas is stretched meanwhile). */
const REDRAW_DELAY = 150;

export interface PdfPageProps {
  /** pdf.js, already loaded. */
  pdfjs: Pdfjs;
  /** The open document. */
  doc: PdfDocument;
  /** Page index, from `0`. */
  index: number;
  /** Page size at scale 1. */
  size: PageSize;
  /** CSS pixels per PDF point. */
  scale: number;
  /** Position inside the pages container, in CSS pixels. */
  top: number;
  /** Position inside the pages container, in CSS pixels. */
  left: number;
  /** Whether the page is on or near the screen (drawn), or far (just a blank box). */
  active: boolean;
  /** Search matches of this page. */
  matches: LocatedMatch[];
  /** The selected match, if it is on this page. */
  current: LocatedMatch | null;
  /** The word being read aloud, if it is on this page. */
  reading: LocatedMatch | null;
  /** Called when a link of the page is clicked. */
  onLink(link: PageLink): void;
}

/** Device pixels per CSS pixel, limited so the canvas stays under {@link MAX_CANVAS_PIXELS}. */
function outputScale(size: PageSize, scale: number): number {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const pixels = size.width * size.height * scale * scale * ratio * ratio;
  return pixels > MAX_CANVAS_PIXELS ? Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height * scale * scale)) : ratio;
}

/** Draws the page into a new canvas (kept off-screen until done, so zooming never flashes white). */
function useCanvas(host: React.RefObject<HTMLDivElement | null>, doc: PdfDocument, index: number, size: PageSize, scale: number, active: boolean) {
  useEffect(() => {
    if (!active) {
      host.current?.querySelector('canvas')?.remove();
      return;
    }
    let task: any = null;
    let stopped = false;
    const draw = async () => {
      const page = await doc.page(index);
      if (stopped) return;
      const viewport = page.getViewport({ scale: scale * outputScale(size, scale) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
      if (stopped || !host.current) return;
      host.current.querySelector('canvas')?.remove();
      host.current.prepend(canvas);
    };
    // the first drawing is immediate; a zoom change waits for the gesture to settle
    const hasCanvas = !!host.current?.querySelector('canvas');
    const timer = setTimeout(() => draw().catch(() => undefined), hasCanvas ? REDRAW_DELAY : 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [host, doc, index, size, scale, active]);
}

/** The text layer of an active page; returns its spans (to locate highlights) once rendered. */
function useTextLayer(layer: React.RefObject<HTMLDivElement | null>, pdfjs: Pdfjs, doc: PdfDocument, index: number, active: boolean) {
  const [spans, setSpans] = useState<HTMLElement[] | null>(null);
  useEffect(() => {
    const container = layer.current;
    if (!active || !container) return;
    let textLayer: any = null;
    let stopped = false;
    (async () => {
      const [page, text] = await Promise.all([doc.page(index), doc.text(index)]);
      if (stopped) return;
      textLayer = new pdfjs.TextLayer({ textContentSource: text.content, container, viewport: page.getViewport({ scale: 1 }) });
      await textLayer.render();
      if (!stopped) setSpans(textLayer.textDivs);
    })().catch(() => undefined);
    return () => {
      stopped = true;
      textLayer?.cancel();
      container.replaceChildren();
      setSpans(null);
    };
  }, [layer, pdfjs, doc, index, active]);
  return spans;
}

/** Rectangles (in % of the page) covered by a match, measured on the rendered spans. */
function matchBoxes(match: LocatedMatch, spans: HTMLElement[], page: DOMRect): PageBox[] {
  return match.parts.flatMap(({ item, start, end }) => {
    const node = spans[item]?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return [];
    const length = (node as Text).length;
    const range = document.createRange();
    range.setStart(node, Math.min(start, length));
    range.setEnd(node, Math.min(end, length));
    return Array.from(range.getClientRects()).map((rect) => ({
      left: ((rect.left - page.left) / page.width) * 100,
      top: ((rect.top - page.top) / page.height) * 100,
      width: (rect.width / page.width) * 100,
      height: (rect.height / page.height) * 100,
    }));
  });
}

interface Highlight {
  /** Where it is drawn. */
  box: PageBox;
  /** Whether it belongs to the selected match. */
  current: boolean;
  /** Whether it is the word being read aloud. */
  reading: boolean;
}

/** Highlights of this page's matches and of the word being read, measured once the text layer is on screen. */
function useHighlights(
  host: React.RefObject<HTMLDivElement | null>,
  spans: HTMLElement[] | null,
  matches: LocatedMatch[],
  current: LocatedMatch | null,
  reading: LocatedMatch | null,
) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  useEffect(() => {
    const marked = reading ? [...matches, reading] : matches;
    if (!spans || !host.current || !marked.length) {
      setHighlights([]);
      return;
    }
    const page = host.current.getBoundingClientRect();
    setHighlights(
      marked.flatMap((match) => matchBoxes(match, spans, page).map((box) => ({ box, current: match === current, reading: match === reading }))),
    );
  }, [host, spans, matches, current, reading]);
  return highlights;
}

const boxStyle = (box: PageBox): React.CSSProperties => ({
  left: `${box.left}%`,
  top: `${box.top}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
});

/** Link areas of an active page. */
function useLinks(doc: PdfDocument, index: number, active: boolean): PageLink[] {
  const [links, setLinks] = useState<PageLink[]>([]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    doc
      .links(index)
      .then((found) => !stopped && setLinks(found))
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [doc, index, active]);
  return links;
}

export const PdfPage = memo(function PdfPage({ pdfjs, doc, index, size, scale, top, left, active, matches, current, reading, onLink }: PdfPageProps) {
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useCanvas(host, doc, index, size, scale, active);
  const spans = useTextLayer(layer, pdfjs, doc, index, active);
  const highlights = useHighlights(host, spans, matches, current, reading);
  const links = useLinks(doc, index, active);

  const style = {
    top,
    left,
    width: size.width * scale,
    height: size.height * scale,
    '--scale-factor': scale,
  } as React.CSSProperties;

  return (
    <div ref={host} className="op-page" style={style} data-page={index + 1} aria-label={`Page ${index + 1}`} role="region">
      <div ref={layer} className="textLayer" />
      {highlights.map((h, i) => (
        <div key={i} className="op-hl" style={boxStyle(h.box)} data-current={h.current || undefined} data-reading={h.reading || undefined} />
      ))}
      {links.map((link, i) => (
        <a
          key={i}
          className="op-link"
          style={boxStyle(link.box)}
          href={link.url ?? `#page=${(link.page ?? 0) + 1}`}
          target={link.url ? '_blank' : undefined}
          rel={link.url ? 'noopener noreferrer' : undefined}
          aria-label={link.url ?? `Go to page ${(link.page ?? 0) + 1}`}
          onClick={(event) => {
            event.preventDefault();
            onLink(link);
          }}
        />
      ))}
    </div>
  );
});
