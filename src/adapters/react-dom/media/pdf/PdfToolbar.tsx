import React, { useEffect, useRef, useState } from 'react';
import type { PdfDirection, PdfFit } from '../../../../core/pdf';
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  DownloadIcon,
  FitIcon,
  FullscreenIcon,
  MoonIcon,
  MoreIcon,
  OutlineIcon,
  PagesIcon,
  PrintIcon,
  SearchIcon,
  StopIcon,
  VolumeIcon,
  ZoomIcon,
} from '../shared/icons';
import type { OutlineEntry } from './pdfDocument';

/**
 * Toolbar of the web `Pdf`. Normal mode: thumbnails, page field, zoom, read aloud,
 * search, fullscreen, table of contents and a "more" menu (night mode, fit, download, print).
 * Search mode: the search field with the match count and previous/next.
 */

/** What the toolbar shows. */
export interface PdfToolbarState {
  /** Page on screen, from `1`. */
  page: number;
  /** Number of pages. */
  pageCount: number;
  /** Zoom, where `1` is the fit size. */
  zoom: number;
  /** Whether night mode is on. */
  nightMode: boolean;
  /** Current fit. */
  fit: PdfFit;
  /** Pages one under the other (`'vertical'`) or side by side (`'horizontal'`). */
  direction: PdfDirection;
  /** Whether the thumbnails panel is open. */
  thumbnails: boolean;
  /** Whether the search field is open. */
  searchOpen: boolean;
  /** Text in the search field. */
  query: string;
  /** Number of matches. */
  total: number;
  /** Selected match, from `1` (`0` = none). */
  current: number;
  /** Whether the search is still going through the pages. */
  searching: boolean;
  /** The table of contents (empty = no button). */
  outline: OutlineEntry[];
  /** Small viewer: the zoom buttons are hidden (pinch still works). */
  narrow: boolean;
  /** Whether the browser can read aloud (otherwise the button is hidden). */
  canRead: boolean;
  /** Whether the document is being read aloud. */
  reading: boolean;
  /** Whether the viewer is in fullscreen. */
  fullscreen: boolean;
  /** Voices of the read-aloud language, most natural first. */
  voices: Array<{ name: string; label: string }>;
  /** The chosen voice name (`undefined` = automatic, the most natural one). */
  voice: string | undefined;
}

/** What the toolbar can do. */
export interface PdfToolbarActions {
  toggleThumbnails(): void;
  goToPage(page: number): void;
  zoomIn(): void;
  zoomOut(): void;
  openSearch(): void;
  closeSearch(): void;
  setQuery(query: string): void;
  next(): void;
  previous(): void;
  toggleNight(): void;
  setFit(fit: PdfFit): void;
  toggleDirection(): void;
  download(): void;
  print(): void;
  openOutline(entry: OutlineEntry): void;
  toggleReadAloud(): void;
  toggleFullscreen(): void;
  selectVoice(name: string | undefined): void;
}

type MenuName = 'more' | 'outline' | null;

/** Closes the open menu on a click outside it or on Escape. */
function useDismiss(anchor: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !anchor.current?.contains(event.target as Node) && close();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, open, close]);
}

/** Page field: shows the current page; typing a number and pressing Enter goes there. */
function PageField({ page, pageCount, onGo }: { page: number; pageCount: number; onGo(page: number): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const target = Number.parseInt(draft ?? '', 10);
    if (Number.isFinite(target)) onGo(target);
    setDraft(null);
  };
  return (
    <>
      <input
        className="op-page-input"
        inputMode="numeric"
        aria-label={`Page ${page} of ${pageCount}`}
        value={draft ?? String(page)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
      <span className="op-total">/ {pageCount}</span>
    </>
  );
}

const MenuItem = ({ icon, label, checked, onSelect }: { icon: React.ReactNode; label: string; checked?: boolean; onSelect(): void }) => (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked={checked}
    className="ov-menu-item"
    onClick={onSelect}
  >
    {icon}
    <span style={{ flex: 1 }}>{label}</span>
    {checked ? <span className="ov-check"><CheckIcon /></span> : null}
  </button>
);

/** The voices of the read-aloud language; "Automatic" uses the most natural one. */
function VoiceMenu({ state, actions, close }: { state: PdfToolbarState; actions: PdfToolbarActions; close(): void }) {
  const pick = (name: string | undefined) => () => {
    actions.selectVoice(name);
    close();
  };
  return (
    <div className="ov-menu" role="menu" aria-label="Voice">
      <div className="ov-menu-title">Voice</div>
      <MenuItem icon={<VolumeIcon level="high" />} label="Automatic (most natural)" checked={!state.voice} onSelect={pick(undefined)} />
      {state.voices.map((voice) => (
        <MenuItem key={voice.name} icon={<VolumeIcon level="low" />} label={voice.label} checked={state.voice === voice.name} onSelect={pick(voice.name)} />
      ))}
    </div>
  );
}

function MoreMenu({ state, actions, close }: { state: PdfToolbarState; actions: PdfToolbarActions; close(): void }) {
  const [voices, setVoices] = useState(false);
  const run = (action: () => void) => () => {
    action();
    close();
  };
  if (voices) return <VoiceMenu state={state} actions={actions} close={close} />;
  return (
    <div className="ov-menu" role="menu" aria-label="More">
      {state.canRead && state.voices.length ? (
        <>
          <MenuItem icon={<VolumeIcon level="high" />} label="Voice" onSelect={() => setVoices(true)} />
          <div className="op-menu-divider" />
        </>
      ) : null}
      <MenuItem icon={<MoonIcon />} label="Night mode" checked={state.nightMode} onSelect={run(actions.toggleNight)} />
      <div className="op-menu-divider" />
      <MenuItem icon={<PagesIcon />} label="Horizontal pages" checked={state.direction === 'horizontal'} onSelect={run(actions.toggleDirection)} />
      <div className="op-menu-divider" />
      <MenuItem icon={<FitIcon />} label="Fit width" checked={state.fit === 'width'} onSelect={run(() => actions.setFit('width'))} />
      <MenuItem icon={<FitIcon page />} label="Fit page" checked={state.fit === 'page'} onSelect={run(() => actions.setFit('page'))} />
      <div className="op-menu-divider" />
      <MenuItem icon={<DownloadIcon />} label="Download" onSelect={run(actions.download)} />
      <MenuItem icon={<PrintIcon />} label="Print" onSelect={run(actions.print)} />
    </div>
  );
}

function OutlineMenu({ entries, onSelect }: { entries: OutlineEntry[]; onSelect(entry: OutlineEntry): void }) {
  return (
    <div className="ov-menu op-outline" role="menu" aria-label="Contents">
      <div className="ov-menu-title">Contents</div>
      {entries.map((entry, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          className="ov-menu-item"
          style={{ paddingLeft: 10 + entry.depth * 14, fontWeight: entry.depth === 0 ? 600 : 400 }}
          onClick={() => onSelect(entry)}
        >
          <span style={{ flex: 1 }}>{entry.title}</span>
          {entry.page !== null ? <span className="op-count">{entry.page + 1}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The match counter: "3 of 17", "No results" or "…" while searching. */
const countLabel = ({ query, total, current, searching }: PdfToolbarState): string => {
  if (!query.trim()) return '';
  if (total > 0) return `${current} of ${total}${searching ? '…' : ''}`;
  return searching ? '…' : 'No results';
};

function SearchBar({ state, actions }: { state: PdfToolbarState; actions: PdfToolbarActions }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      Enter: () => (event.shiftKey ? actions.previous() : actions.next()),
      Escape: actions.closeSearch,
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  return (
    <div className="op-bar" role="search">
      <label className="op-field">
        <SearchIcon />
        <input
          ref={input}
          type="search"
          aria-label="Search in document"
          placeholder="Search"
          value={state.query}
          onChange={(event) => actions.setQuery(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <span className="op-count" aria-live="polite">{countLabel(state)}</span>
      </label>
      <button type="button" className="ov-btn" aria-label="Previous match" disabled={!state.total} onClick={actions.previous}>
        <ChevronIcon up />
      </button>
      <button type="button" className="ov-btn" aria-label="Next match" disabled={!state.total} onClick={actions.next}>
        <ChevronIcon />
      </button>
      <button type="button" className="ov-btn" aria-label="Close search" onClick={actions.closeSearch}>
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * @param extra Extra buttons, before fullscreen (e.g. the playlist button).
 */
export function PdfToolbar({ state, actions, extra }: { state: PdfToolbarState; actions: PdfToolbarActions; extra?: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuName>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const close = () => setMenu(null);
  useDismiss(anchor, menu !== null, close);
  const toggle = (name: MenuName) => () => setMenu(menu === name ? null : name);

  if (state.searchOpen) return <SearchBar state={state} actions={actions} />;

  return (
    <div className="op-bar" role="toolbar" aria-label="Document">
      <button type="button" className="ov-btn" aria-label="Pages" aria-pressed={state.thumbnails} onClick={actions.toggleThumbnails}>
        <PagesIcon />
      </button>
      <PageField page={state.page} pageCount={state.pageCount} onGo={actions.goToPage} />
      <div className="op-spacer" />
      {state.narrow ? null : (
        <>
          <button type="button" className="ov-btn" aria-label="Zoom out" onClick={actions.zoomOut}>
            <ZoomIcon out />
          </button>
          <span className="op-zoom" aria-live="polite">{Math.round(state.zoom * 100)}%</span>
          <button type="button" className="ov-btn" aria-label="Zoom in" onClick={actions.zoomIn}>
            <ZoomIcon />
          </button>
        </>
      )}
      {state.canRead ? (
        <button type="button" className="ov-btn" aria-label={state.reading ? 'Stop reading' : 'Read aloud'} aria-pressed={state.reading} onClick={actions.toggleReadAloud}>
          {state.reading ? <StopIcon /> : <VolumeIcon level="high" />}
        </button>
      ) : null}
      <button type="button" className="ov-btn" aria-label="Search" onClick={actions.openSearch}>
        <SearchIcon />
      </button>
      {extra}
      <button type="button" className="ov-btn" aria-label={state.fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={actions.toggleFullscreen}>
        <FullscreenIcon exit={state.fullscreen} />
      </button>
      <div ref={anchor} className="ov-menu-anchor">
        {state.outline.length ? (
          <button type="button" className="ov-btn" aria-label="Contents" aria-haspopup="menu" aria-expanded={menu === 'outline'} onClick={toggle('outline')}>
            <OutlineIcon />
          </button>
        ) : null}
        <button type="button" className="ov-btn" aria-label="More" aria-haspopup="menu" aria-expanded={menu === 'more'} onClick={toggle('more')}>
          <MoreIcon />
        </button>
        {menu === 'more' ? <MoreMenu state={state} actions={actions} close={close} /> : null}
        {menu === 'outline' ? (
          <OutlineMenu
            entries={state.outline}
            onSelect={(entry) => {
              actions.openOutline(entry);
              close();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
