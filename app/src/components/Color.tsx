import type { ReactNode } from 'react';
import { PALETTE, PALETTE_KEYS, type ColorKey } from '../lib/palette';

/** A small colored dot. */
export function Dot({ color, title }: { color: ColorKey; title?: string }) {
  return <i className="dot" data-color={color} title={title} aria-hidden={title ? undefined : true} />;
}

/** A tinted chip label (tag or category). */
export function ColorPill({ color, children, onClick, title }: { color: ColorKey; children: ReactNode; onClick?: () => void; title?: string }) {
  return onClick ? (
    <button type="button" className="pill" data-color={color} onClick={onClick} title={title}>
      {children}
    </button>
  ) : (
    <span className="pill" data-color={color} title={title}>
      {children}
    </span>
  );
}

/** Pick one of the ten colors. */
export function SwatchPicker({ value, onChange, label }: { value: ColorKey; onChange: (c: ColorKey) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {PALETTE_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          aria-label={PALETTE[k].label}
          title={PALETTE[k].label}
          className={`swatch-dot${value === k ? ' on' : ''}`}
          data-color={k}
          onClick={() => onChange(k)}
        />
      ))}
    </div>
  );
}
