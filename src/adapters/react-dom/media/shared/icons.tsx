import React from 'react';

/** Ícones dos controles do `Video` (SVG 24×24, cor = `currentColor`). */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const PlayIcon = () => (
  <Svg>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z" />
  </Svg>
);

export const PauseIcon = () => (
  <Svg>
    <rect x="6" y="5" width="4.2" height="14" rx="1.3" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.3" />
  </Svg>
);

/** Seta circular com "10" no meio; `forward` espelha só a seta. */
export const SkipIcon = ({ forward = false }: { forward?: boolean }) => (
  <Svg>
    <g transform={forward ? 'matrix(-1 0 0 1 24 0)' : undefined}>
      <path d="M12 4.5a7.5 7.5 0 1 1-7.5 7.5" {...stroke} strokeWidth={1.8} />
      <path d="M12 1.6v5.8L8.4 4.5z" />
    </g>
    <text x="12" y="15.2" textAnchor="middle" fontSize="7.4" fontWeight="700" fontFamily="system-ui, sans-serif">
      10
    </text>
  </Svg>
);

const Speaker = () => <path d="M3.5 9.6v4.8a1 1 0 0 0 1 1h3l4.2 3.5a.7.7 0 0 0 1.15-.54V5.64a.7.7 0 0 0-1.15-.54L7.5 8.6h-3a1 1 0 0 0-1 1z" />;

export type VolumeLevel = 'muted' | 'low' | 'high';

const NEAR_WAVE = <path d="M16 9.2a4 4 0 0 1 0 5.6" {...stroke} />;

/** O que vai ao lado do alto-falante em cada nível. */
const WAVES: Record<VolumeLevel, React.ReactNode> = {
  muted: <path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke} />,
  low: NEAR_WAVE,
  high: (
    <>
      {NEAR_WAVE}
      <path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" {...stroke} />
    </>
  ),
};

export const VolumeIcon = ({ level }: { level: VolumeLevel }) => (
  <Svg>
    <Speaker />
    {WAVES[level]}
  </Svg>
);

const CORNERS = {
  enter: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  exit: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
};

export const FullscreenIcon = ({ exit = false }: { exit?: boolean }) => (
  <Svg>
    <path d={CORNERS[exit ? 'exit' : 'enter']} {...stroke} />
  </Svg>
);

/** Tela com uma janelinha no canto (picture-in-picture). */
export const PictureInPictureIcon = () => (
  <Svg>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" {...stroke} strokeWidth={1.8} />
    <rect x="12" y="11.5" width="7" height="5.5" rx="1.2" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={2.4} />
  </Svg>
);

/** Music note, the placeholder shown when an `Audio` has no `artwork`. */
export const MusicNoteIcon = () => (
  <Svg>
    <path d="M9 4.6v10.9A3.6 3.6 0 1 0 11 18.7V8.3l7-1.6v6.8a3.6 3.6 0 1 0 2 3.2V3.4a.9.9 0 0 0-1.1-.9L9.9 3.7a.9.9 0 0 0-.9.9z" />
  </Svg>
);

/* ── document viewer (`Pdf`) ── */

/** Magnifying glass. */
export const SearchIcon = () => (
  <Svg>
    <circle cx="10.5" cy="10.5" r="6.5" {...stroke} />
    <path d="M15.5 15.5L20 20" {...stroke} />
  </Svg>
);

/** Chevron pointing up (`up`) or down. */
export const ChevronIcon = ({ up = false }: { up?: boolean }) => (
  <Svg>
    <path d={up ? 'M6 14.5l6-6 6 6' : 'M6 9.5l6 6 6-6'} {...stroke} />
  </Svg>
);

export const CloseIcon = () => (
  <Svg>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />
  </Svg>
);

/** Two pages side by side (the thumbnails panel). */
export const PagesIcon = () => (
  <Svg>
    <rect x="3.5" y="4.5" width="7" height="15" rx="1.5" {...stroke} strokeWidth={1.8} />
    <rect x="13.5" y="4.5" width="7" height="15" rx="1.5" {...stroke} strokeWidth={1.8} />
  </Svg>
);

/** Three dots (more options). */
export const MoreIcon = () => (
  <Svg>
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </Svg>
);

/** Plus (`zoom in`) or minus (`zoom out`). */
export const ZoomIcon = ({ out = false }: { out?: boolean }) => (
  <Svg>
    <path d={out ? 'M5.5 12h13' : 'M5.5 12h13M12 5.5v13'} {...stroke} />
  </Svg>
);

/** Crescent moon (night mode). */
export const MoonIcon = () => (
  <Svg>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" {...stroke} strokeWidth={1.8} />
  </Svg>
);

/** Bulleted list (table of contents). */
export const OutlineIcon = () => (
  <Svg>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" {...stroke} strokeWidth={1.8} />
    <circle cx="4.8" cy="6.5" r="1.2" />
    <circle cx="4.8" cy="12" r="1.2" />
    <circle cx="4.8" cy="17.5" r="1.2" />
  </Svg>
);

/** Arrow into a tray (download). */
export const DownloadIcon = () => (
  <Svg>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...stroke} />
  </Svg>
);

export const PrintIcon = () => (
  <Svg>
    <path d="M7 9V4.5h10V9M7 16.5H5a1.5 1.5 0 0 1-1.5-1.5v-4.5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5h-2" {...stroke} strokeWidth={1.8} />
    <rect x="7" y="13.5" width="10" height="6.5" rx="1" {...stroke} strokeWidth={1.8} />
  </Svg>
);

/** Two arrows apart (fit the whole page) or a horizontal span (fit the width). */
export const FitIcon = ({ page = false }: { page?: boolean }) => (
  <Svg>
    <path d={page ? 'M8 4.5H4.5V8M16 4.5h3.5V8M8 19.5H4.5V16M16 19.5h3.5V16' : 'M4 12h16M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5'} {...stroke} />
  </Svg>
);

export const LockIcon = () => (
  <Svg>
    <rect x="5" y="10.5" width="14" height="10" rx="2" {...stroke} strokeWidth={1.8} />
    <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" {...stroke} strokeWidth={1.8} />
  </Svg>
);

/** Rounded square (stop reading aloud). */
export const StopIcon = () => (
  <Svg>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </Svg>
);
