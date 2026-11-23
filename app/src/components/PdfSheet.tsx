import { useEffect, useState } from 'react';
import type { Contact, PdfOptions } from '../types';
import { DEFAULT_PDF } from '../types';
import { makePdf, shareOrDownloadPdf } from '../lib/pdf';
import { toast } from '../lib/util';
import { Sheet } from './Sheet';

const PDF_KEY = 'contactSheet.pdfOptions.v1';

function loadOpts(): PdfOptions {
  try {
    const raw = localStorage.getItem(PDF_KEY);
    if (raw) return { ...DEFAULT_PDF, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PDF };
}

export function PdfSheet({
  open,
  contacts,
  defaultTitle,
  onClose,
}: {
  open: boolean;
  contacts: Contact[];
  defaultTitle?: string;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<PdfOptions>(() => loadOpts());
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = loadOpts();
    setOpts({
      ...base,
      title: defaultTitle || base.title || 'Contact Sheet',
      subtitle: defaultTitle ? base.subtitle : base.subtitle,
    });
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, defaultTitle]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function set<K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) {
    setOpts((o) => ({ ...o, [key]: value }));
  }

  async function buildBlob() {
    localStorage.setItem(PDF_KEY, JSON.stringify(opts));
    return makePdf(contacts, opts);
  }

  async function preview() {
    if (!contacts.length || busy) return;
    setBusy(true);
    try {
      const blob = await buildBlob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      window.open(url, '_blank', 'noopener');
      toast('Preview opened');
    } catch (e) {
      console.error(e);
      toast('Could not preview PDF');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!contacts.length || busy) return;
    setBusy(true);
    try {
      const blob = await buildBlob();
      const safeName = (opts.title || 'Contact Sheet').replace(/[^\w\- ]+/g, '').trim() || 'Contact Sheet';
      await shareOrDownloadPdf(blob, `${safeName}.pdf`);
      toast('PDF ready');
      onClose();
    } catch (e) {
      console.error(e);
      toast('Could not make PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      title="Make PDF"
      onClose={onClose}
      right={
        <button type="button" className="link strong" disabled={busy || !contacts.length} onClick={generate}>
          {busy ? '…' : 'Create'}
        </button>
      }
    >
      <p className="muted">
        {contacts.length} contact{contacts.length === 1 ? '' : 's'} will be included.
      </p>
      <label>
        Title
        <input value={opts.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label>
        Subtitle (optional)
        <input
          value={opts.subtitle}
          placeholder="e.g. Family · Spring 2026"
          onChange={(e) => set('subtitle', e.target.value)}
        />
      </label>

      <fieldset>
        <legend>Layout</legend>
        <div className="seg">
          {(['list', 'cards', 'table'] as const).map((l) => (
            <button key={l} type="button" className={opts.layout === l ? 'on' : ''} onClick={() => set('layout', l)}>
              {l[0].toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={opts.cover} onChange={(e) => set('cover', e.target.checked)} />
        Cover page with title & letter index
      </label>

      <fieldset>
        <legend>Include</legend>
        {(
          [
            ['f_company', 'Company / title'],
            ['f_phones', 'Phones'],
            ['f_emails', 'Emails'],
            ['f_address', 'Address'],
            ['f_birthday', 'Birthday'],
            ['f_tags', 'Tags'],
            ['f_notes', 'Notes'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="check">
            <input type="checkbox" checked={opts[key]} onChange={(e) => set(key, e.target.checked)} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="grid2">
        <label>
          Sort by
          <select value={opts.sort} onChange={(e) => set('sort', e.target.value as PdfOptions['sort'])}>
            <option value="last">Last name</option>
            <option value="first">First name</option>
            <option value="company">Company</option>
          </select>
        </label>
        <label>
          Paper
          <select value={opts.paper} onChange={(e) => set('paper', e.target.value as PdfOptions['paper'])}>
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
      </div>

      <button type="button" className="btn wide" disabled={busy || !contacts.length} onClick={preview}>
        Preview in new tab
      </button>
    </Sheet>
  );
}
