import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

/** Open sheets and dialogs, newest last, so Escape and focus only affect the top one. */
const layers: symbol[] = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While `active`: Escape calls onEscape (top layer only), Tab stays inside the
 * box, focus moves into it, and goes back to what was focused when it closes.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onEscape: () => void) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const id = Symbol('layer');
    layers.push(id);
    const before = document.activeElement as HTMLElement | null;
    const box = ref.current;
    // Focus the first field (or the box) unless something inside already asked for focus.
    requestAnimationFrame(() => {
      if (box && !box.contains(document.activeElement)) {
        const first = box.querySelector<HTMLElement>('input, select, textarea') ?? box.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? box).focus({ preventScroll: true });
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (layers[layers.length - 1] !== id || !box) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        escRef.current();
      } else if (e.key === 'Tab') {
        const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = layers.indexOf(id);
      if (i >= 0) layers.splice(i, 1);
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

/**
 * Bottom sheet (centered card on wide screens). Header: Cancel on the left,
 * title in the middle, one primary action on the right.
 */
export function Sheet({
  open,
  title,
  onClose,
  right,
  closeLabel = 'Cancel',
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  right?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <button type="button" className="link" onClick={onClose}>
            {closeLabel}
          </button>
          <h2>{title}</h2>
          {right ?? <span className="spacer" style={{ width: 64 }} />}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
