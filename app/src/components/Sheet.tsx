import type { ReactNode } from 'react';

export function Sheet({
  open,
  title,
  onClose,
  right,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <button type="button" className="link" onClick={onClose}>
            Cancel
          </button>
          <h2>{title}</h2>
          {right ?? <span className="spacer" style={{ width: 64 }} />}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
