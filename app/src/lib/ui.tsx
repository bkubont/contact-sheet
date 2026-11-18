import { useEffect, useState, type ReactNode } from 'react';

// Tiny global toast.
let setToastText: ((t: string) => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  setToastText?.(text);
  clearTimeout(timer);
  timer = setTimeout(() => setToastText?.(''), 2600);
}
export function ToastHost() {
  const [text, setText] = useState('');
  useEffect(() => { setToastText = setText; return () => { setToastText = null; }; }, []);
  return text ? <div className="toast" role="status">{text}</div> : null;
}

export function Sheet({ title, onClose, children, full, right }: { title: string; onClose: () => void; children: ReactNode; full?: boolean; right?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !full) onClose(); }}>
      <div className={full ? 'sheet full' : 'sheet'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Cancel</button>
          <h3>{title}</h3>
          {right ?? <span />}
        </div>
        {children}
      </div>
    </div>
  );
}

// In-app confirm (browser confirm() is blocked inside app wrappers and embedded previews).
type Ask = { title: string; message: string; ok: string; danger?: boolean; resolve: (v: boolean) => void };
let setAsk: ((a: Ask | null) => void) | null = null;
export function askConfirm(title: string, message: string, ok = 'OK', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setAsk) return resolve(false);
    setAsk({ title, message, ok, danger, resolve });
  });
}
export function ConfirmHost() {
  const [ask, set] = useState<Ask | null>(null);
  useEffect(() => { setAsk = set; return () => { setAsk = null; }; }, []);
  if (!ask) return null;
  const done = (v: boolean) => { ask.resolve(v); set(null); };
  return (
    <Sheet title={ask.title} onClose={() => done(false)}>
      <div className="sheet-body">
        <p style={{ margin: 0 }}>{ask.message}</p>
        <button className={ask.danger ? 'btn wide' : 'btn action wide'} style={ask.danger ? { background: 'var(--danger)', color: '#fff' } : undefined} onClick={() => done(true)}>{ask.ok}</button>
        <button className="btn ghost wide" onClick={() => done(false)}>Cancel</button>
      </div>
    </Sheet>
  );
}
