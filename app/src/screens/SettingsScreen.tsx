import { useEffect, useRef, useState } from 'react';
import { Store } from '../lib/store';
import { parseContacts, toVCard } from '../lib/importers';
import { downloadBlob, toast } from '../lib/util';
import { Sync, type SyncStatus } from '../lib/sync';
import { useDb } from '../hooks/useStore';
import { askConfirm } from '../lib/dialogs';
import { APPEARANCE_LABEL, getAppearance, setAppearance, type Appearance } from '../lib/theme';
import type { Contact } from '../types';
import { Sheet } from '../components/Sheet';
import { AccountSheet } from '../components/AccountSheet';
import { CanopySheet } from '../components/CanopySheet';

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="chev" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function syncLine(s: SyncStatus) {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Up to date';
    case 'offline':
      return 'Offline — will sync when back online';
    case 'error':
      return 'Sync problem — tap for details';
    default:
      return '';
  }
}

/**
 * Settings tab: replaces the old menu. Grouped by what you're doing; the one
 * destructive action sits on its own at the bottom.
 */
export function SettingsScreen() {
  const db = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<SyncStatus>(Sync.status);
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance);
  const [accountOpen, setAccountOpen] = useState(false);
  const [canopyOpen, setCanopyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTag, setImportTag] = useState('');
  const [pending, setPending] = useState<{ name: string; parsed: ReturnType<typeof parseContacts> } | null>(null);
  const [preview, setPreview] = useState<{ total: number; wouldAdd: number; wouldSkip: number; samples: Contact[] } | null>(null);

  useEffect(() => {
    const off = Sync.onStatus(setStatus);
    return () => {
      off();
    };
  }, []);

  async function onFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = parseContacts(await file.text(), file.name);
      setPreview(Store.previewImport(parsed, { skipDupes: true }));
      setPending({ name: file.name, parsed });
      setImportTag('');
      setImportOpen(true);
    } catch (e) {
      console.error(e);
      toast('Could not read that file');
    }
  }

  function closeImport() {
    setImportOpen(false);
    setPending(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function runImport() {
    if (!pending) return;
    try {
      const { added, skipped } = Store.addMany(pending.parsed, { skipDupes: true, tag: importTag.trim() });
      toast(`Imported ${added}${skipped ? ` · skipped ${skipped} already here` : ''}`);
      closeImport();
    } catch (e) {
      console.error(e);
      toast('Could not import');
    }
  }

  function exportVcf() {
    downloadBlob(new Blob([toVCard(db.contacts)], { type: 'text/vcard' }), 'contacts.vcf');
    toast('Exported .vcf');
  }

  function backup() {
    downloadBlob(new Blob([Store.exportBackup()], { type: 'application/json' }), `contact-sheet-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup saved');
  }

  async function onRestoreFile(file: File | null) {
    if (restoreRef.current) restoreRef.current.value = '';
    if (!file) return;
    let text = '';
    let contacts = 0;
    let lists = 0;
    try {
      text = await file.text();
      const parsed = JSON.parse(text) as { version?: number; contacts?: unknown[]; directories?: unknown[] } | unknown[];
      if (Array.isArray(parsed)) {
        contacts = parsed.length;
        lists = db.directories.length;
      } else if (parsed?.version === 2 || parsed?.version === 3) {
        contacts = parsed.contacts?.length || 0;
        lists = parsed.directories?.length || 0;
      } else {
        toast('That isn’t a Contact Sheet backup');
        return;
      }
    } catch {
      toast('Could not read that backup');
      return;
    }
    const ok = await askConfirm({
      title: 'Replace everything with this backup?',
      message: `Now: ${db.contacts.length} contacts, ${db.directories.length} lists.\nBackup: ${contacts} contacts, ${lists} lists.\n\nEverything on this device is replaced by the backup.`,
      confirmLabel: 'Replace',
      danger: true,
    });
    if (!ok) return;
    try {
      Store.importBackup(text);
      toast(`Restored ${contacts} contacts`);
    } catch {
      toast('Could not restore that backup');
    }
  }

  async function wipe() {
    const n = db.contacts.length;
    const d = db.directories.length;
    const ok = await askConfirm({
      title: 'Delete everything on this device?',
      message: `${n} contact${n === 1 ? '' : 's'}, ${d} list${d === 1 ? '' : 's'}, your categories and tag groups are removed from this device. Make a backup first if you might want them. This can’t be undone.`,
      confirmLabel: 'Delete everything',
      danger: true,
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    Store.wipe();
    toast('Everything on this device was deleted');
  }

  function cycleAppearance(a: Appearance) {
    setAppearance(a);
    setAppearanceState(a);
  }

  const signedIn = Sync.enabled && !!Sync.user;
  const linked = db.contacts.filter((c) => c.canopy).length;

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <span className="logo-tile" aria-hidden="true" />
          <h1 className="brand">Settings</h1>
        </div>
      </header>

      <main className="page">
        <h2 className="settings-title">Your data</h2>
        <div className="settings-group">
          <button type="button" className="settings-row" onClick={() => fileRef.current?.click()}>
            <span>
              Import contacts
              <small>From a .vcf or .csv file</small>
            </span>
            <Chevron />
          </button>
          <button type="button" className="settings-row" onClick={exportVcf} disabled={!db.contacts.length}>
            <span>
              Export all as .vcf
              <small>{db.contacts.length} contacts</small>
            </span>
            <Chevron />
          </button>
          <button type="button" className="settings-row" onClick={backup}>
            <span>
              Back up
              <small>Everything, as one .json file</small>
            </span>
            <Chevron />
          </button>
          <button type="button" className="settings-row" onClick={() => restoreRef.current?.click()}>
            <span>
              Restore from a backup
              <small>Replaces what’s on this device</small>
            </span>
            <Chevron />
          </button>
        </div>

        {Sync.enabled && (
          <>
            <h2 className="settings-title">Account</h2>
            <div className="settings-group">
              <button type="button" className="settings-row" onClick={() => setAccountOpen(true)}>
                <span>
                  {signedIn ? Sync.user!.email : 'Sign in'}
                  <small>{signedIn ? syncLine(status) : 'Keep your contacts in sync across devices'}</small>
                </span>
                {signedIn && <i className={`status-dot ${status.state}`} aria-hidden="true" />}
                <Chevron />
              </button>
              <button type="button" className="settings-row" onClick={() => setCanopyOpen(true)}>
                <span>
                  Canopy Estimate
                  <small>{linked ? `${linked} contact${linked === 1 ? '' : 's'} linked` : 'See customers’ jobs, estimates and invoices'}</small>
                </span>
                <Chevron />
              </button>
            </div>
          </>
        )}

        <h2 className="settings-title">App</h2>
        <div className="settings-group">
          <div className="settings-row static">
            <span>Appearance</span>
            <div className="seg compact" role="radiogroup" aria-label="Appearance">
              {(['system', 'light', 'dark'] as Appearance[]).map((a) => (
                <button key={a} type="button" role="radio" aria-checked={appearance === a} className={appearance === a ? 'on' : ''} onClick={() => cycleAppearance(a)}>
                  {APPEARANCE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="settings-row" onClick={() => window.dispatchEvent(new Event('cs:show-install'))}>
            <span>
              Add to Home Screen
              <small>Opens full-screen and works offline</small>
            </span>
            <Chevron />
          </button>
          <a className="settings-row" href="privacy.html" target="_blank" rel="noopener">
            <span>Privacy</span>
            <Chevron />
          </a>
        </div>

        <h2 className="settings-title danger">Danger zone</h2>
        <div className="settings-group danger">
          <button type="button" className="settings-row danger" onClick={wipe}>
            <span>
              Delete everything on this device
              <small>Contacts, lists, categories and tag groups</small>
            </span>
          </button>
        </div>
      </main>

      <input ref={fileRef} type="file" accept=".vcf,.vcard,.csv,text/vcard,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />
      <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={(e) => onRestoreFile(e.target.files?.[0] || null)} />

      <Sheet
        open={importOpen}
        title="Import"
        onClose={closeImport}
        right={
          <button type="button" className="link strong" onClick={runImport} disabled={!preview?.wouldAdd}>
            Import
          </button>
        }
      >
        <p className="muted">
          File: <strong>{pending?.name}</strong>
        </p>
        {preview && (
          <div className="card">
            <div>
              {preview.total} in the file · <b>{preview.wouldAdd}</b> new
              {preview.wouldSkip ? ` · ${preview.wouldSkip} already here (skipped)` : ''}
            </div>
            {preview.samples.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {preview.samples.map((c) => (
                  <li key={c.id}>
                    {[c.first, c.last].filter(Boolean).join(' ') || c.company || 'No name'}
                    {c.tags.length ? ` · ${c.tags.join(', ')}` : ''}
                  </li>
                ))}
                {preview.wouldAdd > preview.samples.length && <li className="muted">…and {preview.wouldAdd - preview.samples.length} more</li>}
              </ul>
            )}
          </div>
        )}
        <label>
          Tag everyone imported (optional)
          <input value={importTag} placeholder="e.g. Imported" onChange={(e) => setImportTag(e.target.value)} />
        </label>
      </Sheet>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
      <CanopySheet
        open={canopyOpen}
        onClose={() => setCanopyOpen(false)}
        onOpenAccount={() => {
          setCanopyOpen(false);
          setAccountOpen(true);
        }}
      />
    </>
  );
}
