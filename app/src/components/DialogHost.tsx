import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Dialogs } from '../lib/dialogs';
import { useFocusTrap } from './Sheet';

/** Shows the in-app confirm / text / notice dialogs from lib/dialogs, one at a time. */
export function DialogHost() {
  const d = useSyncExternalStore(Dialogs.subscribe, Dialogs.current, Dialogs.current);
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const boxRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setText(d?.kind === 'text' ? d.initial ?? '' : '');
    setTyped('');
  }, [d]);

  const cancel = () => {
    if (!d) return;
    if (d.kind === 'confirm') d.resolve(false);
    else if (d.kind === 'text') d.resolve(null);
    else d.resolve();
    Dialogs.finish();
  };

  useFocusTrap(boxRef, !!d, cancel);

  if (!d) return null;

  const blocked = d.kind === 'confirm' && !!d.typeToConfirm && typed.trim().toUpperCase() !== d.typeToConfirm.toUpperCase();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!d || blocked) return;
    if (d.kind === 'confirm') d.resolve(true);
    else if (d.kind === 'text') d.resolve(text.trim() || null);
    else d.resolve();
    Dialogs.finish();
  }

  const confirmLabel =
    d.kind === 'confirm' ? d.confirmLabel ?? 'OK' : d.kind === 'text' ? d.confirmLabel ?? 'Save' : d.okLabel ?? 'OK';

  return (
    <div className="dialog-backdrop" role="presentation" onClick={cancel}>
      <form
        ref={boxRef}
        className="dialog"
        role={d.kind === 'notice' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="dialog-title">{d.title}</h2>
        {d.message && <p className="dialog-message">{d.message}</p>}
        {d.kind === 'text' && (
          <label>
            {d.label && <span>{d.label}</span>}
            <input
              autoFocus
              value={text}
              placeholder={d.placeholder}
              onChange={(e) => setText(e.target.value)}
              enterKeyHint="done"
            />
          </label>
        )}
        {d.kind === 'confirm' && d.typeToConfirm && (
          <label>
            <span>
              Type <b>{d.typeToConfirm}</b> to confirm
            </span>
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </label>
        )}
        <div className="dialog-actions">
          {d.kind !== 'notice' && (
            <button type="button" className="btn" onClick={cancel}>
              {d.kind === 'confirm' ? d.cancelLabel ?? 'Cancel' : 'Cancel'}
            </button>
          )}
          <button
            type="submit"
            className={`btn ${d.kind === 'confirm' && d.danger ? 'danger-solid' : 'primary'}`}
            disabled={blocked || (d.kind === 'text' && !text.trim())}
            autoFocus={d.kind !== 'text' && !(d.kind === 'confirm' && d.typeToConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
