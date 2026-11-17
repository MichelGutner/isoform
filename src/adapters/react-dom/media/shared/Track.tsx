import React, { useRef, useState } from 'react';

/**
 * Trilho arrastável (barra de progresso e volume). Funciona com mouse, toque
 * e teclado (setas, Home/End), e se anuncia como `role="slider"`.
 */
interface TrackProps {
  value: number;
  max: number;
  /** Trecho já baixado (só na barra de progresso). */
  buffered?: number;
  step: number;
  label: string;
  valueText: string;
  /** `done = false` enquanto arrasta; `true` ao soltar (ou a cada tecla). */
  onChange: (value: number, done: boolean) => void;
  /** Texto do balão sobre o trilho (ex.: o tempo naquele ponto). */
  tooltip?: (value: number) => string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const percent = (value: number, max: number) => `${max > 0 ? clamp(value / max, 0, 1) * 100 : 0}%`;

/** Tecla → novo valor. */
const KEYS: Record<string, (value: number, step: number, max: number) => number> = {
  ArrowLeft: (v, step) => v - step,
  ArrowDown: (v, step) => v - step,
  ArrowRight: (v, step) => v + step,
  ArrowUp: (v, step) => v + step,
  Home: () => 0,
  End: (_v, _step, max) => max,
};

export function Track({ value, max, buffered, step, label, valueText, onChange, tooltip }: TrackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const valueAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * max;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = KEYS[e.key];
    if (!next) return;
    e.preventDefault();
    e.stopPropagation(); // o player também usa as setas
    onChange(clamp(next(value, step, max), 0, max), true);
  };

  const tipValue = hovered ?? (dragging ? value : null);

  return (
    <div
      ref={ref}
      className="ov-track"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      data-active={dragging || undefined}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        onChange(valueAt(e.clientX), false);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') setHovered(valueAt(e.clientX));
        if (dragging) onChange(valueAt(e.clientX), false);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        onChange(valueAt(e.clientX), true);
      }}
      onPointerCancel={() => setDragging(false)}
      onPointerLeave={() => setHovered(null)}
      onKeyDown={onKeyDown}
    >
      <div className="ov-rail">
        {buffered !== undefined ? <div className="ov-buffer" style={{ width: percent(buffered, max) }} /> : null}
        <div className="ov-fill" style={{ width: percent(value, max) }} />
      </div>
      <div className="ov-thumb" style={{ left: percent(value, max) }} />
      {tooltip && tipValue !== null ? (
        <div className="ov-tip" style={{ left: percent(tipValue, max) }}>
          {tooltip(tipValue)}
        </div>
      ) : null}
    </div>
  );
}
