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
