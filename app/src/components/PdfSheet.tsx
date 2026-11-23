import { useEffect, useState } from 'react';
import type { Contact, PdfOptions, PdfTheme } from '../types';
import { DEFAULT_PDF, PDF_THEMES } from '../types';
import { makePdf, shareOrDownloadPdf } from '../lib/pdf';
import { toast } from '../lib/util';
import { Sheet } from './Sheet';

const PDF_KEY = 'contactSheet.pdfOptions.v2';

function loadOpts(): PdfOptions {
  try {
    const raw = localStorage.getItem(PDF_KEY);
    if (raw) return { ...DEFAULT_PDF, ...JSON.parse(raw) };
    const legacy = localStorage.getItem('contactSheet.pdfOptions.v1');
    if (legacy) return { ...DEFAULT_PDF, ...JSON.parse(legacy) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PDF };
}

const THEME_BG: Record<PdfTheme, string> = {
  royal: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
  gold: 'linear-gradient(135deg,#b45309,#f59e0b)',
  navy: 'linear-gradient(135deg,#0f172a,#334155)',
  charcoal: 'linear-gradient(135deg,#334155,#64748b)',
};

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
      <label>
        Header line (optional)
        <input
          value={opts.headerText}
          placeholder="e.g. Brittany’s directory"
          onChange={(e) => set('headerText', e.target.value)}
        />
      </label>
      <label>
        Footer text
        <input
          value={opts.footerText}
          placeholder="Personal directory"
          onChange={(e) => set('footerText', e.target.value)}
        />
      </label>

      <fieldset>
        <legend>Color theme</legend>
        <div className="grid2">
          {(Object.keys(PDF_THEMES) as PdfTheme[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`swatch${opts.theme === key ? ' on' : ''}`}
              style={{ background: THEME_BG[key] }}
              onClick={() => set('theme', key)}
            >
              {PDF_THEMES[key].label}
            </button>
          ))}
        </div>
      </fieldset>

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

      {opts.layout === 'cards' && (
        <fieldset>
          <legend>Card columns</legend>
          <div className="seg">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={opts.columns === n ? 'on' : ''}
                onClick={() => set('columns', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="check">
        <input type="checkbox" checked={opts.cover} onChange={(e) => set('cover', e.target.checked)} />
        Cover page with title & letter index
      </label>

      <fieldset>
        <legend>Include</legend>
        {(
          [
            ['f_company', 'Company / title'],
            ['f_category', 'Category'],
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
            <option value="category">Category</option>
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

      <fieldset>
        <legend>Orientation</legend>
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            className={opts.orientation === 'portrait' ? 'on' : ''}
            onClick={() => set('orientation', 'portrait')}
          >
            Portrait
          </button>
          <button
            type="button"
            className={opts.orientation === 'landscape' ? 'on' : ''}
            onClick={() => set('orientation', 'landscape')}
          >
            Landscape
          </button>
        </div>
      </fieldset>

      <button type="button" className="btn wide" disabled={busy || !contacts.length} onClick={preview}>
        Preview in new tab
      </button>
      <button type="button" className="btn primary wide" disabled={busy || !contacts.length} onClick={generate}>
        {busy ? 'Creating…' : 'Create PDF'}
      </button>
    </Sheet>
  );
}
