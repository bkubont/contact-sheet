import { useRef, useState } from 'react';
import { Store } from '../lib/store';
import { parseContacts, toVCard } from '../lib/importers';
import { downloadBlob, toast } from '../lib/util';
import { Sheet } from './Sheet';
import { useDb } from '../hooks/useStore';

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTag, setImportTag] = useState('');
  const [pendingFile, setPendingFile] = useState<{ text: string; name: string } | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);

  function startImport() {
    fileRef.current?.click();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setPendingFile({ text, name: file.name });
    setImportTag('');
    setImportOpen(true);
  }

  function runImport() {
    if (!pendingFile) return;
    try {
      const list = parseContacts(pendingFile.text, pendingFile.name);
      const { added, skipped } = Store.addMany(list, { skipDupes: true, tag: importTag.trim() });
      toast(`Imported ${added}${skipped ? ` · skipped ${skipped} dupes` : ''}`);
      setImportOpen(false);
      setPendingFile(null);
      onClose();
    } catch (e) {
      console.error(e);
      toast('Could not read that file');
    }
  }

  function exportVcf() {
    const blob = new Blob([toVCard(db.contacts)], { type: 'text/vcard' });
    downloadBlob(blob, 'contacts.vcf');
    toast('Exported .vcf');
  }

  function backup() {
    const blob = new Blob([Store.exportBackup()], { type: 'application/json' });
    downloadBlob(blob, `contact-sheet-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup saved');
  }

  async function restore(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      Store.importBackup(text);
      toast('Backup restored');
      onClose();
    } catch {
      toast('Could not restore backup');
    }
  }

  function wipe() {
    if (!confirm('Delete all contacts and directories on this device? This cannot be undone.')) return;
    Store.wipe();
    toast('All data cleared');
    onClose();
  }

  const counts = Store.tagCounts();

  return (
    <>
      <Sheet open={open && !importOpen && !tagsOpen} title="Menu" onClose={onClose}>
        <div className="menu-list">
          <button type="button" onClick={startImport}>
            Import .vcf / .csv
          </button>
          <button type="button" onClick={() => setTagsOpen(true)}>
            Manage tags
          </button>
          <button type="button" onClick={exportVcf} disabled={!db.contacts.length}>
            Export all as .vcf
          </button>
          <button type="button" onClick={backup}>
            Back up (.json)
          </button>
          <button type="button" onClick={() => restoreRef.current?.click()}>
            Restore backup
          </button>
          <div className="sep" />
          <button type="button" className="danger" style={{ color: 'var(--danger)' }} onClick={wipe}>
            Delete all data
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,.vcard,.csv,text/vcard,text/csv"
          hidden
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
        <input
          ref={restoreRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => restore(e.target.files?.[0] || null)}
        />
      </Sheet>

      <Sheet
        open={importOpen}
        title="Import"
        onClose={() => {
          setImportOpen(false);
          setPendingFile(null);
        }}
        right={
          <button type="button" className="link strong" onClick={runImport}>
            Import
          </button>
        }
      >
        <p className="muted">
          File: <strong>{pendingFile?.name}</strong>. Duplicates are skipped.
        </p>
        <label>
          Optional tag for everyone imported
          <input value={importTag} placeholder="e.g. Imported" onChange={(e) => setImportTag(e.target.value)} />
        </label>
      </Sheet>

      <Sheet open={tagsOpen} title="Manage tags" onClose={() => setTagsOpen(false)}>
        {!counts.length ? (
          <p className="muted">No tags yet. Add tags on contacts or when importing.</p>
        ) : (
          counts.map(([t, n]) => (
            <div key={t} className="row" style={{ gridTemplateColumns: '1fr auto auto', margin: '0 0 8px' }}>
              <div>
                <div className="row-name">{t}</div>
                <div className="row-meta">
                  {n} contact{n === 1 ? '' : 's'}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const next = prompt('Rename tag', t);
                  if (next && next.trim() && next.trim() !== t) {
                    Store.renameTag(t, next.trim());
                    toast('Tag renamed');
                  }
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (confirm(`Remove tag “${t}” from everyone?`)) {
                    Store.deleteTag(t);
                    toast('Tag removed');
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </Sheet>
    </>
  );
}
