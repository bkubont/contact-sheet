import { useEffect, useState } from 'react';
import { Sheet, toast } from '../lib/ui';

// showPdf(makeBlob(), 'file.pdf'): shows "Making PDF…", then Share / Open / Download.
// Sharing needs a fresh tap on iPhone, so the PDF is made first and shared from a button.
type State = { name: string; blob?: Blob; error?: string; note?: string };
let set: ((s: State | null) => void) | null = null;

export function showPdf(make: Promise<Blob | { blob: Blob; note?: string }>, name: string) {
  set?.({ name });
  make.then((r) => {
    const blob = r instanceof Blob ? r : r.blob;
    const note = r instanceof Blob ? undefined : r.note;
    set?.({ name, blob, note });
  }).catch((e) => { console.error(e); set?.({ name, error: 'The PDF could not be made.' }); });
}

export function PdfHost() {
  const [s, setS] = useState<State | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => { set = setS; return () => { set = null; }; }, []);
  useEffect(() => {
    if (!s?.blob) return;
    const u = URL.createObjectURL(s.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [s?.blob]);
  if (!s) return null;

  const file = s.blob ? new File([s.blob], s.name, { type: 'application/pdf' }) : null;
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const share = async () => {
    try { await navigator.share({ files: [file!], title: s.name }); }
    catch (e) { if ((e as Error).name !== 'AbortError') toast('Sharing did not work. Try Open instead.'); }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = url; a.download = s.name; document.body.append(a); a.click(); a.remove();
  };

  return (
    <Sheet title={s.blob ? 'PDF ready' : s.error ? 'Problem' : 'Making PDF…'} onClose={() => setS(null)}>
      <div className="sheet-body">
        {!s.blob && !s.error && <p className="muted" style={{ margin: 0 }}>One moment…</p>}
        {s.error && <p style={{ margin: 0 }}>{s.error}</p>}
        {s.blob && (
          <>
            <p className="muted" style={{ margin: 0 }}>{s.name} · {Math.max(1, Math.round(s.blob.size / 1024))} KB{s.note ? ` · ${s.note}` : ''}</p>
            {canShare && <button className="btn action wide" onClick={share}>Share · Print · Save</button>}
            <a className={canShare ? 'btn wide' : 'btn action wide'} href={url} target="_blank" rel="noopener">Open PDF</a>
            <button className="btn ghost wide" onClick={download}>Download</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
