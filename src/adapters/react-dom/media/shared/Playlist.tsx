/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ITEM_PROPS, usePlaylist, useRestartOnSameSource, type PlaylistItem } from '../../../../core/playlist';
import { sheet } from '../../css/sheet';
import { ChevronIcon, CloseIcon, MusicNoteIcon, OutlineIcon, PlayIcon } from './icons';

/**
 * Lists on the web: `Video`, `Audio` and `Pdf` with `items` get a "playlist" button
 * in their controls (video bar, audio card, PDF toolbar). It opens the carousel in a dark glass panel over the player
 * (center-focused cards with cover and title); picking a card switches the entry
 * and closes the panel. The player itself is unchanged: the list only swaps the
 * entry it shows, and the component's style still goes to the player.
 */

type Kind = 'Video' | 'Audio' | 'Pdf';

const LIST_PROPS = ['items', 'initialIndex', 'carousel', 'autoAdvance', 'onItemChange'] as const;

/** Props without the list ones (what the plain player receives). */
const withoutList = (props: Record<string, any>) => {
  const rest = { ...props };
  LIST_PROPS.forEach((key) => delete rest[key]);
  return rest;
};

const NO_LIST = { next: () => undefined, previous: () => undefined, goTo: () => undefined };

/** A `ref` that has the list methods and forwards everything else to the player. */
const handleOf = (inner: React.RefObject<any>, list: Record<string, (...args: any[]) => void>) =>
  new Proxy(list, {
    get: (target, key: string) => target[key] ?? ((...args: any[]) => inner.current?.[key]?.(...args)),
  });

const RULES = [
  // layer inside the player: only the button and the panel take clicks
  '.opl-layer{position:absolute;inset:0;z-index:6;pointer-events:none;border-radius:inherit;overflow:hidden}',
  '.opl-open{pointer-events:auto;position:absolute;appearance:none;border:0;margin:0;display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px 0 9px;border-radius:999px;font:600 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-variant-numeric:tabular-nums;color:#fff;background:rgba(20,20,22,.55);-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:pointer;transition:transform .15s ease,background-color .15s ease}',
  '.opl-open:active{transform:scale(.94)}',
  '@media (hover:hover){.opl-open:hover{background:rgba(20,20,22,.72)}}',
  '.opl-open:focus-visible{outline:2px solid #fff;outline-offset:2px}',
  '.opl-open svg{width:16px;height:16px}',
  '.opl-layer[data-kind=Video] .opl-open{top:10px;left:50%;transform:translateX(-50%)}',
  '.opl-layer[data-kind=Video] .opl-open:active{transform:translateX(-50%) scale(.94)}',
  // audio: a badge on the corner of the cover (the card has no free corner)
  '.opl-layer[data-kind=Audio] .opl-open{top:46px;left:18px;height:24px;padding:0 7px 0 6px;font-size:11px}',
  // PDF: top right of the pages, below the toolbar (the bottom is for the thumbnails)
  '.opl-layer[data-kind=Pdf] .opl-open{top:60px;right:12px}',
  // the panel: dark glass over the lower part of the player (the whole card for audio)
  '.opl-panel{pointer-events:auto;position:absolute;left:0;right:0;bottom:0;max-height:100%;display:flex;flex-direction:column;padding:10px 0 6px;color:#fff;background:rgba(16,16,18,.8);-webkit-backdrop-filter:blur(20px) saturate(170%);backdrop-filter:blur(20px) saturate(170%);box-shadow:0 -10px 30px rgba(0,0,0,.25);animation:opl-up .22s cubic-bezier(.2,.8,.2,1)}',
  '.opl-layer[data-kind=Audio] .opl-panel{top:0}',
  '@keyframes opl-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}',
  '.opl-panel .opl-strip{--opl-fg:#fff;--opl-muted:rgba(235,235,245,.62);--opl-card:rgba(255,255,255,.12);--opl-ring:#fff;--opl-glow:rgba(0,0,0,.55);color:#fff}',
  '.opl-panel .opl-head{padding:0 8px 0 14px}',
  '.opl-panel .opl-cards{padding-top:10px;padding-bottom:4px}',
  '.opl-panel .opl-cards[data-kind=Video]{--opl-w:150px}',
  '.opl-panel .opl-cards[data-kind=Audio]{--opl-w:78px}',
  '.opl-panel .opl-cards[data-kind=Pdf]{--opl-w:84px}',
  '.opl-layer[data-kind=Audio] .opl-title{-webkit-line-clamp:1}',
  '.opl-close{appearance:none;border:0;margin:0 0 0 auto;padding:0;width:30px;height:30px;flex:0 0 auto;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.14);cursor:pointer}',
  '.opl-close svg{width:16px;height:16px}',
  '@media (prefers-reduced-motion:reduce){.opl-panel{animation:none}}',

  // the strip: follows the light/dark scheme
  '.opl-strip{--opl-fg:#1c1c1e;--opl-muted:#6e6e73;--opl-card:rgba(120,120,128,.14);--opl-ring:#1c1c1e;--opl-glow:rgba(0,0,0,.22);flex:0 0 auto;position:relative;display:flex;flex-direction:column;gap:6px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--opl-fg);user-select:none;-webkit-user-select:none}',
  '@media (prefers-color-scheme:dark){.opl-strip{--opl-fg:#fff;--opl-muted:#98989f;--opl-card:rgba(118,118,128,.26);--opl-ring:#fff;--opl-glow:rgba(0,0,0,.6)}}',
  '.opl-head{display:flex;align-items:baseline;gap:6px;padding:0 4px;font-size:13px;min-height:20px}',
  '.opl-head strong{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
  '.opl-head span{color:var(--opl-muted);font-variant-numeric:tabular-nums;white-space:nowrap}',

  // the carousel: the card at the center is the focused one; the others shrink and fade with their distance
  '.opl-viewport{position:relative}',
  '.opl-cards{--opl-w:160px;display:flex;align-items:flex-start;gap:14px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:none;padding:14px calc(50% - var(--opl-w) / 2) 10px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}',
  '.opl-cards::-webkit-scrollbar{display:none}',
  '.opl-cards[data-kind=Video]{--opl-w:220px}',
  '.opl-cards[data-kind=Audio]{--opl-w:132px}',
  '.opl-cards[data-kind=Pdf]{--opl-w:118px}',
  '.opl-card{--d:1;appearance:none;border:0;margin:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:center;flex:0 0 var(--opl-w);width:var(--opl-w);display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;scroll-snap-align:center;transform:scale(calc(1 - var(--d) * .16));opacity:calc(1 - var(--d) * .5);transform-origin:50% 40%;will-change:transform,opacity}',
  '.opl-thumb{position:relative;width:100%;overflow:hidden;border-radius:14px;background-color:var(--opl-card);display:flex;align-items:center;justify-content:center;color:var(--opl-muted);box-shadow:0 2px 6px rgba(0,0,0,.08);transition:box-shadow .25s ease}',
  '.opl-cards[data-kind=Video] .opl-thumb{aspect-ratio:16/9}',
  '.opl-cards[data-kind=Audio] .opl-thumb{aspect-ratio:1}',
  '.opl-cards[data-kind=Pdf] .opl-thumb{aspect-ratio:3/4;border-radius:8px}',
  '.opl-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
  '.opl-thumb svg{width:30px;height:30px}',
  '.opl-thumb::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2.5px var(--opl-ring);opacity:0;transition:opacity .2s ease}',
  '.opl-card[data-focus] .opl-thumb{box-shadow:0 14px 34px var(--opl-glow),0 3px 8px rgba(0,0,0,.12)}',
  '.opl-card[data-focus] .opl-thumb::after{opacity:1}',
  '.opl-card:focus-visible .opl-thumb::after{opacity:1;box-shadow:inset 0 0 0 3px rgba(10,132,255,.9)}',
  '.opl-title{max-width:100%;font-size:12.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--opl-muted);transition:color .2s ease}',
  '.opl-card[data-focus] .opl-title{color:var(--opl-fg);font-weight:600}',
  // "now playing" badge on the current entry (animated bars while playing)
  '.opl-now{position:absolute;left:8px;bottom:8px;display:flex;align-items:flex-end;gap:2px;height:14px;padding:4px 6px;border-radius:999px;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
  '.opl-now i{display:block;width:3px;height:100%;border-radius:2px;background:#fff;transform-origin:bottom;transform:scaleY(.45)}',
  '.opl-now[data-playing] i{animation:opl-eq .9s ease-in-out infinite}',
  '.opl-now i:nth-child(2){animation-delay:-.3s}',
  '.opl-now i:nth-child(3){animation-delay:-.6s}',
  '@keyframes opl-eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}',
  // arrows on the sides
  '.opl-nav{position:absolute;top:calc(50% - 30px);z-index:1;appearance:none;border:0;margin:0;padding:0;width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:var(--opl-fg);background:color-mix(in srgb,var(--opl-card) 60%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 2px 10px rgba(0,0,0,.12);cursor:pointer;transition:opacity .2s ease,transform .15s ease}',
  '.opl-nav:active{transform:scale(.92)}',
  '.opl-nav:disabled{opacity:0;pointer-events:none}',
  '.opl-nav[data-side=prev]{left:4px}',
  '.opl-nav[data-side=next]{right:4px}',
  '.opl-nav svg{width:20px;height:20px;transform:rotate(90deg)}',
  '.opl-nav[data-side=next] svg{transform:rotate(-90deg)}',
  '@media (hover:none){.opl-nav{display:none}}',
  '.opl-doc{width:46%;display:flex;flex-direction:column;gap:5px}',
  '.opl-doc i{display:block;height:3px;border-radius:2px;background-color:currentColor;opacity:.55}',
  '.opl-doc i:last-child{width:60%}',
  '@media (prefers-reduced-motion:reduce){.opl-now[data-playing] i{animation:none}}',
];

const ensureStyles = () => RULES.forEach((rule, i) => sheet.rule(`playlist:${i}`, rule));

/** Placeholder art when the entry has no image: play arrow, music note or a page with lines. */
const FALLBACK: Record<Kind, React.ReactNode> = {
  Video: <PlayIcon />,
  Audio: <MusicNoteIcon />,
  Pdf: (
    <span className="opl-doc" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  ),
};

const imageOf = (kind: Kind, item: any): string | undefined => ({ Video: item.poster, Audio: item.artwork, Pdf: item.thumbnail })[kind];

/** Wait after the last scroll event before the centered card becomes the selected entry. */
const SETTLE = 140;

/**
 * Center-focused carousel. While scrolling, every card is scaled and faded by its
 * distance to the center (`--d`, 0 = centered), and the centered one is highlighted
 * live. When the scroll stops, the centered card becomes the selected entry.
 * When the entry changes from outside (next/previous, end of a video), it glides there.
 */
interface StripProps {
  kind: Kind;
  items: PlaylistItem[];
  index: number;
  playing: boolean;
  /** Arrows, keyboard and the card the scroll stops on. */
  onSelect(index: number): void;
  /** A tapped card. */
  onPick(index: number): void;
  /** The close button of the panel. */
  onClose(): void;
}

function Strip({ kind, items, index, playing, onSelect, onPick, onClose }: StripProps) {
  const track = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = React.useState(index);
  // set while the strip itself scrolls to the selected card, so that scroll does not "select" again
  const gliding = useRef(false);

  /** Updates every card's distance to the center and returns the centered card. */
  const measure = React.useCallback((): number => {
    const element = track.current;
    if (!element) return 0;
    const center = element.scrollLeft + element.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(element.children).forEach((child, i) => {
      const card = child as HTMLElement;
      const offset = card.offsetLeft + card.offsetWidth / 2 - center;
      const distance = Math.min(1, Math.abs(offset) / (card.offsetWidth + 14));
      card.style.setProperty('--d', distance.toFixed(3));
      if (Math.abs(offset) < best) {
        best = Math.abs(offset);
        nearest = i;
      }
    });
    return nearest;
  }, []);

  /** Brings card `i` to the center. */
  const glide = React.useCallback((i: number, smooth: boolean) => {
    const element = track.current;
    const card = element?.children[i] as HTMLElement | undefined;
    if (!element || !card) return;
    const left = card.offsetLeft + card.offsetWidth / 2 - element.clientWidth / 2;
    // no scroll event comes when it is already there: only then mark the scroll as ours
    if (Math.abs(left - element.scrollLeft) < 1) return;
    gliding.current = true;
    element.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // live highlight while scrolling; selection once it stops
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setFocus(measure()));
      clearTimeout(timer);
      timer = setTimeout(() => {
        const centered = measure();
        const own = gliding.current;
        gliding.current = false;
        if (!own) onSelectRef.current(centered);
      }, SETTLE);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(() => glide(indexRef.current, false));
    resize.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener('scroll', onScroll);
      resize.disconnect();
    };
  }, [measure, glide]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const indexRef = useRef(index);
  indexRef.current = index;

  // the selected entry (from anywhere) glides to the center
  const first = useRef(true);
  useEffect(() => {
    setFocus(index);
    glide(index, !first.current);
    first.current = false;
    measure();
  }, [index, items.length, glide, measure]);

  const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') return onClose();
    const step = keys[event.key];
    if (!step) return;
    event.preventDefault();
    onSelect(Math.min(items.length - 1, Math.max(0, index + step)));
  };

  return (
    <div className="opl-strip" role="group" aria-label="Playlist">
      <div className="opl-head" aria-live="polite">
        <strong>{items[focus]?.title ?? `Item ${focus + 1}`}</strong>
        <span>
          {focus + 1} / {items.length}
        </span>
        <button type="button" className="opl-close" aria-label="Close playlist" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="opl-viewport">
        <button type="button" className="opl-nav" data-side="prev" aria-label="Previous" disabled={index === 0} onClick={() => onSelect(index - 1)}>
          <ChevronIcon />
        </button>
        <div ref={track} className="opl-cards" data-kind={kind} role="listbox" aria-label="Items" tabIndex={0} onKeyDown={onKeyDown}>
          {items.map((item, i) => {
            const image = imageOf(kind, item);
            return (
              <button
                key={`${i}:${item.src}`}
                type="button"
                role="option"
                tabIndex={-1}
                className="opl-card"
                aria-selected={i === index}
                aria-label={item.title ?? `Item ${i + 1}`}
                data-focus={i === focus || undefined}
                onClick={() => onPick(i)}
              >
                <div className="opl-thumb">
                  {FALLBACK[kind]}
                  {image ? <img src={image} alt="" loading="lazy" draggable={false} /> : null}
                  {i === index && kind !== 'Pdf' ? (
                    <span className="opl-now" data-playing={playing || undefined} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                </div>
                {item.title ? <span className="opl-title">{item.title}</span> : null}
              </button>
            );
          })}
        </div>
        <button type="button" className="opl-nav" data-side="next" aria-label="Next" disabled={index === items.length - 1} onClick={() => onSelect(index + 1)}>
          <ChevronIcon />
        </button>
      </div>
    </div>
  );
}

/** Keeps clicks, taps and keys inside the playlist from reaching the player (play/pause, fullscreen…). */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/** The button inside the player and, when open, the carousel panel over it. */
interface OverlayProps {
  kind: Kind;
  items: PlaylistItem[];
  index: number;
  playing: boolean;
  onSelect(index: number): void;
  /** Whether the panel is open. */
  open: boolean;
  setOpen(open: boolean): void;
  /** Whether the floating button is drawn here (the video has it in its control bar instead). */
  floatingButton: boolean;
}

/** The playlist button that sits in the player's controls (same look as their other buttons). */
function BarButton({ index, total, open, onOpen }: { index: number; total: number; open: boolean; onOpen(): void }) {
  return (
    <button type="button" className="ov-btn" aria-label={`Playlist, item ${index + 1} of ${total}`} aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
      <OutlineIcon />
    </button>
  );
}

function PlaylistOverlay({ kind, items, index, playing, onSelect, open, setOpen, floatingButton }: OverlayProps) {
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  return (
    <div className="opl-layer" data-kind={kind} onClick={stop} onDoubleClick={stop} onPointerDown={stop} onKeyDown={stop}>
      {open ? (
        <div className="opl-panel" role="dialog" aria-label="Playlist">
          <Strip
            kind={kind}
            items={items}
            index={index}
            playing={playing}
            onSelect={onSelect}
            onPick={(i) => {
              onSelect(i);
              close();
            }}
            onClose={close}
          />
        </div>
      ) : floatingButton ? (
        <button ref={button} type="button" className="opl-open" aria-label={`Playlist, item ${index + 1} of ${items.length}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <OutlineIcon />
          {index + 1}/{items.length}
        </button>
      ) : null}
    </div>
  );
}

/** The player with its list: current entry, carousel and auto-advance. */
function ListPlayer({ kind, Player, props, handle }: { kind: Kind; Player: React.ComponentType<any>; props: Record<string, any>; handle: React.Ref<any> }) {
  ensureStyles();
  const { items, initialIndex, carousel = true, autoAdvance = true, onItemChange, ...rest } = props;
  const list = usePlaylist(items as PlaylistItem[], initialIndex, onItemChange);
  const inner = useRef<any>(null);
  const playing = useRef(false);
  useRestartOnSameSource(items, list.index, list.autoPlay, inner);
  const [isPlaying, setPlaying] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  // the button goes in the player's own controls (video bar, audio card, PDF toolbar);
  // it only floats when the controls are hidden (`controls={false}`)
  const inBar = rest.controls !== false;

  useImperativeHandle(
    handle,
    () => handleOf(inner, { next: () => list.next(playing.current), previous: () => list.previous(playing.current), goTo: (i: number) => list.goTo(i, playing.current) }),
    [list],
  );

  const media = {
    autoPlay: list.autoPlay || rest.autoPlay,
    onPlay: () => {
      playing.current = true;
      setPlaying(true);
      rest.onPlay?.();
    },
    onPause: () => {
      playing.current = false;
      setPlaying(false);
      rest.onPause?.();
    },
    onEnded: () => {
      playing.current = false;
      setPlaying(false);
      rest.onEnded?.();
      if (autoAdvance && list.index < items.length - 1) list.next(true);
    },
  };

  return (
    <Player
      ref={inner}
      {...rest}
      {...(kind === 'Pdf' ? {} : media)}
      {...ITEM_PROPS[kind](list.item)}
      controlsExtra={carousel && inBar ? <BarButton index={list.index} total={items.length} open={open} onOpen={() => setOpen(true)} /> : undefined}
      overlay={
        carousel ? (
          <PlaylistOverlay
            kind={kind}
            items={items}
            index={list.index}
            playing={isPlaying}
            onSelect={(i) => list.goTo(i, playing.current)}
            open={open}
            setOpen={setOpen}
            floatingButton={!inBar}
          />
        ) : null
      }
    />
  );
}

/**
 * Adds `items` support to a web player. Without a list it renders the player as
 * before (the `ref` still has `next`/`previous`/`goTo`, as no-ops).
 */
export function withPlaylist(kind: Kind, Player: React.ComponentType<any>) {
  const Listed = forwardRef<any, any>((props, ref) => {
    const inner = useRef<any>(null);
    const hasList = Array.isArray(props.items) && props.items.length > 0;
    useImperativeHandle(hasList ? null : ref, () => handleOf(inner, NO_LIST), []);
    if (hasList) return <ListPlayer kind={kind} Player={Player} props={props} handle={ref} />;
    return <Player ref={inner} {...withoutList(props)} />;
  });
  Listed.displayName = kind;
  return Listed;
}
