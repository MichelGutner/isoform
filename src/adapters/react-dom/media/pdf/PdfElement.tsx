/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { WithoutPlaylist } from '../../../../core/playlist';
import type { PdfDirection, PdfFit, PdfHandle, PdfOwnProps } from '../../../../core/pdf';
import { LockIcon } from '../shared/icons';
import { classNames, clamp, useLatest } from '../shared/helpers';
import { PdfDocument, readOutline, type LocatedMatch, type OutlineEntry, type PageLink } from './pdfDocument';
import { PdfPage } from './PdfPage';
import { PdfThumbnails } from './PdfThumbnails';
import { PdfToolbar, type PdfToolbarActions, type PdfToolbarState } from './PdfToolbar';
import { loadPdfjs, type Pdfjs } from './pdfjs';
import { canReadAloud, languageVoices, readAloud } from './readAloud';
import { ensurePdfStyles } from './pdfStyles';

/**
 * `Pdf` on the web: Mozilla pdf.js renders the pages; the lib draws the viewer
 * (toolbar, thumbnails, search with highlights, zoom, links, password prompt,
 * night mode, read aloud, fullscreen, download and print) in the same colorless
 * style as the players.
 *
 * Keyboard (viewer focused): Ctrl/⌘ F search · Enter / Shift+Enter next/previous
 * match · Esc close search · Ctrl/⌘ +/− zoom. Ctrl/⌘ + wheel and pinch zoom too.
 */

interface PdfElementProps extends Partial<PdfOwnProps> {
  className?: string;
  style?: React.CSSProperties;
  [rest: string]: any;
}

/** Space around and between the pages, in CSS pixels. */
const PAD = 16;
const GAP = 14;
/** Smallest zoom (a quarter of the fit size). */
const MIN_ZOOM = 0.25;
/** Each zoom button press multiplies or divides by this. */
const ZOOM_STEP = 1.25;
/** Below this width the zoom buttons are hidden (pinch zoom still works). */
const NARROW = 460;
/** Pages drawn above and below the visible ones. */
const OVERSCAN = 1;
/** Wait after typing before searching. */
const SEARCH_DELAY = 250;

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PdfDocument }
  | { kind: 'locked'; wrong: boolean; submit(password: string): void }
  | { kind: 'error'; message: string };

/** Readable message of a pdf.js error. */
const errorMessage = (error: any): string => (error?.name === 'InvalidPDFException' ? 'This file is not a valid PDF.' : String(error?.message ?? error));

/** Downloads and opens the document; asks for the password through `status` when needed. */
function useDocument(src: string | undefined, password: string | undefined, events: { onPasswordRequired?(): void; onError?(message: string): void }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [pdfjs, setPdfjs] = useState<Pdfjs | null>(null);
  const latest = useLatest(events);

  useEffect(() => {
    if (!src) return;
    let task: any = null;
    let stopped = false;
    let triedProp = false;
    setStatus({ kind: 'loading' });
    (async () => {
      const lib = await loadPdfjs();
      if (stopped) return;
      setPdfjs(lib);
      task = lib.getDocument({ url: src });
      // the `password` prop is tried first; after that (or a wrong one) the viewer asks
      task.onPassword = (update: (password: string) => void, reason: number) => {
        if (password && !triedProp) {
          triedProp = true;
          return update(password);
        }
        latest.current.onPasswordRequired?.();
        setStatus({ kind: 'locked', wrong: reason === lib.PasswordResponses.INCORRECT_PASSWORD, submit: update });
      };
      const doc = await PdfDocument.open(await task.promise);
      if (!stopped) setStatus({ kind: 'ready', doc });
    })().catch((error) => {
      if (stopped) return;
      const message = errorMessage(error);
      latest.current.onError?.(message);
      setStatus({ kind: 'error', message });
    });
    return () => {
      stopped = true;
      task?.destroy();
    };
  }, [src, password, latest]);

  return { status, pdfjs };
}

/** Width and height of the reading area (follows resizes). */
function useAreaSize(area: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [area]);
  return size;
}

/**
 * Page positions for a scale. Vertical: pages one under the other. Horizontal: pages
 * side by side, each fitting the screen (one page per screen at zoom 1).
 * `starts` are the positions along the scroll direction (to find the page at a scroll offset).
 */
function useLayout(doc: PdfDocument | null, area: { width: number; height: number }, fit: PdfFit, zoom: number, direction: PdfDirection) {
  return useMemo(() => {
    const sizes = doc?.sizes ?? [];
    const widest = Math.max(1, ...sizes.map((s) => s.width));
    const tallest = Math.max(1, ...sizes.map((s) => s.height));
    const byWidth = Math.max(0.1, (area.width - PAD * 2) / widest);
    const byPage = Math.min(byWidth, Math.max(0.1, (area.height - PAD * 2) / tallest));
    const horizontal = direction === 'horizontal';
    // side by side, a page must fit the screen whole
    const scale = (horizontal || fit === 'page' ? byPage : byWidth) * zoom;
    return horizontal ? rowLayout(sizes, scale, tallest, area.width) : columnLayout(sizes, scale, widest);
  }, [doc, area.width, area.height, fit, zoom, direction]);
}

type Size = { width: number; height: number };

function columnLayout(sizes: Size[], scale: number, widest: number) {
  const tops: number[] = [];
  let y = PAD;
  sizes.forEach((s) => {
    tops.push(y);
    y += s.height * scale + GAP;
  });
  return { scale, tops, lefts: sizes.map((s) => PAD + ((widest - s.width) * scale) / 2), starts: tops, width: widest * scale, height: y - GAP + PAD };
}

/** Side by side; each page gets at least a screen of room, so the scroll snaps one page at a time. */
function rowLayout(sizes: Size[], scale: number, tallest: number, screen: number) {
  const lefts: number[] = [];
  let x = PAD;
  sizes.forEach((s) => {
    const room = Math.max(s.width * scale, screen - PAD * 2);
    lefts.push(x + (room - s.width * scale) / 2);
    x += room + PAD * 2;
  });
  const starts = lefts.map((left, i) => left - ((Math.max(sizes[i].width * scale, screen - PAD * 2) - sizes[i].width * scale) / 2));
  return { scale, tops: sizes.map((s) => PAD + ((tallest - s.height) * scale) / 2), lefts, starts, width: x - PAD * 3, height: tallest * scale + PAD * 2 };
}

/** Index of the last page whose top is above `y` (binary search over the sorted tops). */
function pageAt(tops: number[], y: number): number {
  let low = 0;
  let high = tops.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (tops[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return Math.max(0, low);
}

/** Scroll position of the reading area (both axes), updated once per frame while scrolling. */
function useScroll(area: React.RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPosition({ top: element.scrollTop, left: element.scrollLeft }));
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', onScroll);
    };
  }, [area]);
  return position;
}

interface SearchState {
  /** Text in the search field. */
  query: string;
  /** Matches found so far. */
  matches: LocatedMatch[];
  /** Selected match, from `0`. */
  current: number;
  /** Whether pages are still being searched. */
  searching: boolean;
}

const NO_SEARCH: SearchState = { query: '', matches: [], current: 0, searching: false };

/** Runs the search (debounced) whenever the query changes. */
function useSearch(doc: PdfDocument | null, query: string, onDone: (matches: LocatedMatch[]) => void) {
  const [state, setState] = useState<SearchState>(NO_SEARCH);
  const done = useLatest(onDone);
  useEffect(() => {
    if (!doc || !query.trim()) {
      setState({ ...NO_SEARCH, query });
      return;
    }
    let stopped = false;
    setState((s) => ({ ...s, query, matches: [], current: 0, searching: true }));
    const timer = setTimeout(() => {
      doc
        .search(query, (matches) => !stopped && setState((s) => ({ ...s, matches })), () => stopped)
        .then((matches) => {
          if (stopped) return;
          setState((s) => ({ ...s, matches, searching: false }));
          done.current(matches);
        })
        .catch(() => undefined);
    }, SEARCH_DELAY);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [doc, query, done]);
  return [state, setState] as const;
}

/** Saves the document's bytes as a file. */
async function saveFile(doc: PdfDocument, src: string) {
  const data = await doc.pdf.getData();
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/pdf' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: src.split(/[?#]/)[0].split('/').pop() || 'document.pdf' });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Prints the document through a hidden frame (the browser's own PDF printing). */
async function printFile(doc: PdfDocument) {
  const data = await doc.pdf.getData();
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/pdf' }));
  const frame = Object.assign(document.createElement('iframe'), { src: url });
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.append(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** Two-finger pinch on touch screens: calls `onZoom(ratio, focal)` while the fingers move. */
function usePinch(area: React.RefObject<HTMLDivElement | null>, onZoom: (ratio: number, focal: { x: number; y: number }) => void) {
  const latest = useLatest(onZoom);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const points = new Map<number, { x: number; y: number }>();
    let distance = 0;
    const spread = () => {
      const [a, b] = Array.from(points.values());
      return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) distance = spread().d;
    };
    const move = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size !== 2 || !distance) return;
      const { d, x, y } = spread();
      const box = element.getBoundingClientRect();
      latest.current(d / distance, { x: x - box.left, y: y - box.top });
      distance = d;
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      distance = 0;
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }, [area, latest]);
}

/** Ctrl/⌘ + wheel (and trackpad pinch, which browsers send the same way) zooms around the pointer. */
function useWheelZoom(area: React.RefObject<HTMLDivElement | null>, onZoom: (ratio: number, focal: { x: number; y: number }) => void) {
  const latest = useLatest(onZoom);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = element.getBoundingClientRect();
      latest.current(Math.exp(-e.deltaY / 300), { x: e.clientX - box.left, y: e.clientY - box.top });
    };
    // not passive: the page itself must not zoom
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [area, latest]);
}

/** Readable name of a voice: its name, marked when it is a natural (neural) one. */
const voiceLabel = (voice: SpeechSynthesisVoice) => voice.name.replace(/^(Microsoft|Google)\s+/, '');

/** Voices of the read-aloud language (the list fills in when the browser loads it). */
function useVoices(language: string | undefined) {
  const [voices, setVoices] = useState<Array<{ name: string; label: string }>>([]);
  useEffect(() => {
    if (!canReadAloud()) return;
    const read = () => setVoices(languageVoices(language).map((v) => ({ name: v.name, label: voiceLabel(v) })));
    read();
    window.speechSynthesis.addEventListener('voiceschanged', read);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read);
  }, [language]);
  return voices;
}

/**
 * Fullscreen of the whole viewer. Browsers with the Fullscreen API use it; iPhone
 * Safari (which only allows it for videos) gets a fixed layer over the page instead.
 */
function useFullscreen(root: React.RefObject<HTMLDivElement | null>, onChange: (fullscreen: boolean) => void) {
  const [native, setNative] = useState(false);
  const [layer, setLayer] = useState(false);
  const latest = useLatest(onChange);
  useEffect(() => {
    const sync = () => setNative(!!root.current && document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [root]);
  const fullscreen = native || layer;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current(fullscreen);
  }, [fullscreen, latest]);
  // Esc also leaves the fixed layer
  useEffect(() => {
    if (!layer) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setLayer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [layer]);

  const set = useCallback(
    (on: boolean) => {
      const element = root.current;
      const supported = !!element && typeof element.requestFullscreen === 'function' && document.fullscreenEnabled;
      const modes: Record<string, () => void> = {
        'native:on': () => void element?.requestFullscreen().catch(() => setLayer(true)),
        'native:off': () => (document.fullscreenElement ? void document.exitFullscreen().catch(() => undefined) : setLayer(false)),
        'layer:on': () => setLayer(true),
        'layer:off': () => setLayer(false),
      };
      modes[`${supported ? 'native' : 'layer'}:${on ? 'on' : 'off'}`]();
    },
    [root],
  );
  return { fullscreen, layer, setFullscreen: set };
}

function LockedPrompt({ wrong, onSubmit }: { wrong: boolean; onSubmit(password: string): void }) {
  const [value, setValue] = useState('');
  return (
    <div className="op-status" role="dialog" aria-label="Password required">
      <LockIcon />
      <div>{wrong ? <span className="op-error">Wrong password. Try again.</span> : 'This document is protected.'}</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
      >
        <input type="password" autoFocus aria-label="Password" placeholder="Password" value={value} onChange={(e) => setValue(e.currentTarget.value)} />
        <button type="submit">Open</button>
      </form>
    </div>
  );
}

const StatusView = ({ status }: { status: Status }) => {
  const views: Record<Status['kind'], React.ReactNode> = {
    loading: (
      <div className="op-status" role="status" aria-label="Loading">
        <div className="op-spinner" />
      </div>
    ),
    error: (
      <div className="op-status" role="alert">
        <span className="op-error">{status.kind === 'error' ? status.message : ''}</span>
      </div>
    ),
    locked: status.kind === 'locked' ? <LockedPrompt wrong={status.wrong} onSubmit={status.submit} /> : null,
    ready: null,
  };
  return <>{views[status.kind]}</>;
};

export const Pdf = forwardRef<WithoutPlaylist<PdfHandle>, PdfElementProps>(
  (
    {
      src,
      password,
      initialPage = 1,
      controls = true,
      nightMode: initialNight = false,
      fit: initialFit = 'width',
      direction: initialDirection = 'vertical',
      maxZoom = 5,
      onLoad,
      onPageChange,
      onSearch,
      onError,
      onPasswordRequired,
      onLinkPress,
      onFullscreenChange,
      onReadAloudChange,
      speechLanguage,
      speechVoice,
      overlay,
      controlsExtra,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    ensurePdfStyles();
    const root = useRef<HTMLDivElement>(null);
    const area = useRef<HTMLDivElement>(null);
    const { status, pdfjs } = useDocument(src, password, { onPasswordRequired, onError });
    const doc = status.kind === 'ready' ? status.doc : null;

    const [zoom, setZoomState] = useState(1);
    const [fit, setFit] = useState<PdfFit>(initialFit);
    const [direction, setDirection] = useState<PdfDirection>(initialDirection);
    useEffect(() => setDirection(initialDirection), [initialDirection]);
    const [night, setNight] = useState<boolean>(initialNight);
    const [thumbnails, setThumbnails] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [outline, setOutline] = useState<OutlineEntry[]>([]);

    useEffect(() => setNight(initialNight), [initialNight]);
    useEffect(() => setFit(initialFit), [initialFit]);

    const areaSize = useAreaSize(area);
    const horizontal = direction === 'horizontal';
    const layout = useLayout(doc, areaSize, fit, zoom, direction);
    const scroll = useScroll(area);
    // offset and size along the scroll direction
    const offset = horizontal ? scroll.left : scroll.top;
    const span = horizontal ? areaSize.width : areaSize.height;
    const pageCount = doc?.pageCount ?? 0;
    const page = doc ? pageAt(layout.starts, offset + span * (horizontal ? 0.5 : 0.4)) : 0;
    const firstVisible = Math.max(0, pageAt(layout.starts, offset) - OVERSCAN);
    const lastVisible = Math.min(pageCount - 1, pageAt(layout.starts, offset + span) + OVERSCAN);

    const events = useLatest({ onLoad, onPageChange, onSearch, onLinkPress, onReadAloudChange });
    const { fullscreen, layer, setFullscreen } = useFullscreen(root, (on) => onFullscreenChange?.(on));

    // ── navigation ──
    const scrollToPage = useCallback(
      (index: number, offsetPercent = 0) => {
        const element = area.current;
        if (!element || !doc) return;
        const target = clamp(index, 0, doc.pageCount - 1);
        const y = layout.tops[target] + (doc.sizes[target].height * layout.scale * offsetPercent) / 100;
        const top = Math.max(0, y - (offsetPercent ? element.clientHeight / 3 : PAD));
        if (!horizontal) return element.scrollTo({ top });
        // side by side: the page centered, and (zoomed in) the place inside it
        const left = layout.lefts[target] + (doc.sizes[target].width * layout.scale) / 2 - element.clientWidth / 2;
        element.scrollTo({ left: Math.max(0, left), top: offsetPercent ? top : 0 });
      },
      [doc, layout, horizontal],
    );

    // opens at `initialPage`, and reports the document
    const scrollToPageRef = useLatest(scrollToPage);
    const opened = useRef<PdfDocument | null>(null);
    useLayoutEffect(() => {
      if (!doc || opened.current === doc || !areaSize.width) return;
      opened.current = doc;
      scrollToPage(initialPage - 1);
      events.current.onLoad?.({ pageCount: doc.pageCount });
      readOutline(doc).then(setOutline).catch(() => setOutline([]));
    }, [doc, areaSize.width, initialPage, scrollToPage, events]);

    useEffect(() => {
      if (doc) events.current.onPageChange?.({ page: page + 1, pageCount: doc.pageCount });
    }, [doc, page, events]);

    // ── zoom, kept around a focal point ──
    const anchor = useRef<{ ratio: number; x: number; y: number } | null>(null);
    const zoomRef = useLatest(zoom);
    const zoomTo = useCallback(
      (next: number, focal?: { x: number; y: number }) => {
        const element = area.current;
        const current = zoomRef.current;
        const value = clamp(next, MIN_ZOOM, maxZoom);
        if (!element || value === current) return;
        // several zooms before the next layout (a pinch) add up into one scroll correction
        const previous = anchor.current;
        anchor.current = {
          ratio: (previous?.ratio ?? 1) * (value / current),
          x: focal?.x ?? element.clientWidth / 2,
          y: focal?.y ?? element.clientHeight / 2,
        };
        zoomRef.current = value;
        setZoomState(value);
      },
      [maxZoom, zoomRef],
    );
    useLayoutEffect(() => {
      const element = area.current;
      const pending = anchor.current;
      if (!element || !pending) return;
      anchor.current = null;
      element.scrollLeft = (element.scrollLeft + pending.x) * pending.ratio - pending.x;
      element.scrollTop = (element.scrollTop + pending.y) * pending.ratio - pending.y;
    }, [layout.scale]);
    const zoomBy = useCallback((ratio: number, focal?: { x: number; y: number }) => zoomTo(zoomRef.current * ratio, focal), [zoomTo, zoomRef]);
    usePinch(area, zoomBy);
    useWheelZoom(area, zoomBy);

    // ── search ──
    const [search, setSearch] = useSearch(doc, query, (matches) => {
      events.current.onSearch?.({ query, total: matches.length, current: matches.length ? 1 : 0 });
      if (matches.length) scrollToPage(matches[0].page, matches[0].top);
    });
    const searchRef = useLatest(search);
    const select = useCallback(
      (step: number) => {
        const { matches, query: text, current } = searchRef.current;
        if (!matches.length) return;
        const next = (current + step + matches.length) % matches.length;
        scrollToPage(matches[next].page, matches[next].top);
        setSearch((s) => ({ ...s, current: next }));
        events.current.onSearch?.({ query: text, total: matches.length, current: next + 1 });
      },
      [searchRef, setSearch, scrollToPage, events],
    );
    const closeSearch = useCallback(() => {
      setSearchOpen(false);
      setQuery('');
      events.current.onSearch?.({ query: '', total: 0, current: 0 });
    }, [events]);
    const matchesByPage = useMemo(() => {
      const byPage = new Map<number, LocatedMatch[]>();
      search.matches.forEach((m) => byPage.set(m.page, [...(byPage.get(m.page) ?? []), m]));
      return byPage;
    }, [search.matches]);
    const currentMatch = search.matches[search.current] ?? null;

    // ── links ──
    const openLink = useCallback(
      (link: PageLink) => {
        if (link.url) {
          events.current.onLinkPress?.(link.url);
          window.open(link.url, '_blank', 'noopener,noreferrer');
          return;
        }
        if (link.page !== undefined) scrollToPage(link.page);
      },
      [events, scrollToPage],
    );

    // ── read aloud: the word being spoken is highlighted and followed ──
    const voices = useVoices(speechLanguage);
    const [voice, setVoice] = useState<string | undefined>(speechVoice);
    useEffect(() => setVoice(speechVoice), [speechVoice]);
    const [reading, setReading] = useState<LocatedMatch | null>(null);
    const pageRef = useLatest(page);
    const [speaking, setSpeaking] = useState(false);
    const stopReading = useRef<(() => void) | null>(null);
    const followWord = useCallback(
      (word: LocatedMatch) => {
        setReading(word);
        const element = area.current;
        if (!element || !doc) return;
        const y = layout.tops[word.page] + (doc.sizes[word.page].height * layout.scale * word.top) / 100;
        const onScreen = y > element.scrollTop + 24 && y < element.scrollTop + element.clientHeight - 48;
        // side by side, a word on another page means turning the page
        const sameSpread = !horizontal || word.page === pageRef.current;
        if (!onScreen || !sameSpread) scrollToPage(word.page, word.top);
      },
      [doc, layout, scrollToPage, horizontal],
    );
    const followRef = useLatest(followWord);
    const stopReadAloud = useCallback(() => stopReading.current?.(), []);
    const startReadAloud = useCallback(() => {
      if (!doc || !canReadAloud()) return;
      stopReading.current?.();
      setSpeaking(true);
      events.current.onReadAloudChange?.(true);
      stopReading.current = readAloud(doc, page, speechLanguage, voice, {
        onPage: (index) => scrollToPage(index),
        onWord: (word) => followRef.current(word),
        onEnd: () => {
          stopReading.current = null;
          setSpeaking(false);
          setReading(null);
          events.current.onReadAloudChange?.(false);
        },
      });
    }, [doc, page, speechLanguage, voice, scrollToPage, followRef, events]);
    // a voice picked while reading is heard right away (reading restarts on the page on screen)
    const startRef = useLatest(startReadAloud);
    const speakingRef = useLatest(speaking);
    useEffect(() => {
      if (speakingRef.current) startRef.current();
    }, [voice, startRef, speakingRef]);
    // a new document (or leaving the screen) stops the voice
    useEffect(() => () => stopReading.current?.(), [doc]);

    useImperativeHandle(
      ref,
      () => ({
        goToPage: (target) => scrollToPage(Math.round(target) - 1),
        search: (text) => {
          setSearchOpen(true);
          setQuery(text);
        },
        searchNext: () => select(1),
        searchPrevious: () => select(-1),
        clearSearch: closeSearch,
        setZoom: (scale) => zoomTo(scale),
        setFullscreen,
        startReadAloud,
        stopReadAloud,
      }),
      [scrollToPage, select, closeSearch, zoomTo, setFullscreen, startReadAloud, stopReadAloud],
    );

    // ── keyboard ──
    const onKeyDown = (event: React.KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const shortcuts: Record<string, () => void> = {
        f: () => setSearchOpen(true),
        '=': () => zoomTo(zoom * ZOOM_STEP),
        '+': () => zoomTo(zoom * ZOOM_STEP),
        '-': () => zoomTo(zoom / ZOOM_STEP),
        '0': () => zoomTo(1),
      };
      // side by side, ← → turn the pages (when not typing in a field)
      const typing = (event.target as HTMLElement).tagName === 'INPUT';
      const turns: Record<string, () => void> = { ArrowLeft: () => scrollToPage(page - 1), ArrowRight: () => scrollToPage(page + 1) };
      const action = mod ? shortcuts[event.key.toLowerCase()] : horizontal && !typing ? turns[event.key] : undefined;
      if (!action) return;
      event.preventDefault();
      action();
    };

    const toolbarState: PdfToolbarState = {
      page: page + 1,
      pageCount,
      zoom,
      nightMode: night,
      fit,
      direction,
      thumbnails,
      searchOpen,
      query,
      total: search.matches.length,
      current: search.matches.length ? search.current + 1 : 0,
      searching: search.searching,
      outline,
      narrow: areaSize.width < NARROW,
      canRead: canReadAloud(),
      reading: speaking,
      fullscreen,
      voices,
      voice,
    };
    const actions: PdfToolbarActions = {
      toggleThumbnails: () => setThumbnails((open) => !open),
      goToPage: (target) => scrollToPage(target - 1),
      zoomIn: () => zoomTo(zoom * ZOOM_STEP),
      zoomOut: () => zoomTo(zoom / ZOOM_STEP),
      openSearch: () => setSearchOpen(true),
      closeSearch,
      setQuery,
      next: () => select(1),
      previous: () => select(-1),
      toggleNight: () => setNight((on) => !on),
      setFit: (value) => {
        setFit(value);
        setZoomState(1);
      },
      toggleDirection: () => {
        const keep = page;
        setDirection((d) => (d === 'horizontal' ? 'vertical' : 'horizontal'));
        setZoomState(1);
        // stay on the same page after the switch
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToPageRef.current(keep)));
      },
      download: () => doc && src && saveFile(doc, src).catch(() => undefined),
      print: () => doc && printFile(doc).catch(() => undefined),
      toggleReadAloud: () => (speaking ? stopReadAloud() : startReadAloud()),
      toggleFullscreen: () => setFullscreen(!fullscreen),
      selectVoice: setVoice,
      openOutline: (entry) => (entry.url ? openLink({ url: entry.url, box: { left: 0, top: 0, width: 0, height: 0 } }) : scrollToPage(entry.page ?? 0)),
    };

    const visible = doc ? doc.sizes.slice(firstVisible, lastVisible + 1).map((_, i) => firstVisible + i) : [];

    return (
      <div
        {...rest}
        ref={root}
        className={classNames('op', className)}
        style={style}
        tabIndex={0}
        data-night={night || undefined}
        data-direction={direction}
        data-zoomed={zoom > 1.01 || undefined}
        data-fullscreen={layer || undefined}
        onKeyDown={onKeyDown}
      >
        {controls && doc ? <PdfToolbar state={toolbarState} actions={actions} extra={controlsExtra} /> : null}
        <div className="op-body">
          {thumbnails && doc ? (
            <PdfThumbnails
              doc={doc}
              page={page}
              onSelect={(index) => {
                scrollToPage(index);
                if (areaSize.width < NARROW) setThumbnails(false);
              }}
            />
          ) : null}
          <div
            ref={area}
            className="op-scroll"
            onDoubleClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              zoomTo(zoom > 1 ? 1 : 2, { x: event.clientX - box.left, y: event.clientY - box.top });
            }}
          >
            {doc && pdfjs ? (
              <div className="op-pages" style={{ width: layout.width, height: layout.height - PAD * 2 }}>
                {visible.map((index) => (
                  <PdfPage
                    key={index}
                    pdfjs={pdfjs}
                    doc={doc}
                    index={index}
                    size={doc.sizes[index]}
                    scale={layout.scale}
                    top={layout.tops[index] - PAD}
                    left={layout.lefts[index] - PAD}
                    active
                    matches={matchesByPage.get(index) ?? []}
                    current={currentMatch?.page === index ? currentMatch : null}
                    reading={reading?.page === index ? reading : null}
                    onLink={openLink}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <StatusView status={status} />
        </div>
        {overlay}
      </div>
    );
  },
);
Pdf.displayName = 'Pdf';
