import { useRef, useState } from 'react';
import { Store } from '../lib/store';
import { parseContacts, toVCard } from '../lib/importers';
import { downloadBlob, toast } from '../lib/util';
import { Sync } from '../lib/sync';
import { useDb } from '../hooks/useStore';
import type { Contact } from '../types';
import { Sheet } from './Sheet';
import { AccountSheet } from './AccountSheet';
import { GroupsSheet } from './GroupsSheet';
import { CanopySheet } from './CanopySheet';

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTag, setImportTag] = useState('');
  const [pendingFile, setPendingFile] = useState<{ text: string; name: string; parsed: ReturnType<typeof parseContacts> } | null>(null);
  const [preview, setPreview] = useState<{ total: number; wouldAdd: number; wouldSkip: number; samples: Contact[] } | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [canopyOpen, setCanopyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [restoreStats, setRestoreStats] = useState<{ contacts: number; directories: number } | null>(null);

  function startImport() {
    fileRef.current?.click();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseContacts(text, file.name);
      const prev = Store.previewImport(parsed, { skipDupes: true });
      setPendingFile({ text, name: file.name, parsed });
      setPreview(prev);
      setImportTag('');
      setImportOpen(true);
    } catch (e) {
      console.error(e);
      toast('Could not read that file');
    }
  }

  function runImport() {
    if (!pendingFile) return;
    try {
      const { added, skipped } = Store.addMany(pendingFile.parsed, { skipDupes: true, tag: importTag.trim() });
      toast(`Imported ${added}${skipped ? ` · skipped ${skipped} dupes` : ''}`);
      setImportOpen(false);
      setPendingFile(null);
      setPreview(null);
      onClose();
    } catch (e) {
      console.error(e);
      toast('Could not import');
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

  async function onRestoreFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: number; contacts?: unknown[]; directories?: unknown[] } | unknown[];
      let contacts = 0;
      let directories = 0;
      if (Array.isArray(parsed)) {
        contacts = parsed.length;
        directories = db.directories.length;
      } else if (parsed?.version === 2 || parsed?.version === 3) {
        contacts = parsed.contacts?.length || 0;
        directories = parsed.directories?.length || 0;
      } else {
        toast('Unrecognized backup format');
        return;
      }
      setRestoreText(text);
      setRestoreStats({ contacts, directories });
      setRestoreOpen(true);
    } catch {
      toast('Could not read backup');
    }
  }

  function confirmRestore() {
    if (!restoreText || !restoreStats) return;
    try {
      Store.importBackup(restoreText);
      toast(`Restored ${restoreStats.contacts} contacts`);
      setRestoreOpen(false);
      setRestoreText('');
      setRestoreStats(null);
      onClose();
    } catch {
      toast('Could not restore backup');
    }
  }

  function wipe() {
    const n = db.contacts.length;
    const d = db.directories.length;
    if (
      !confirm(
        `Delete all data on this device?\n\nThis will remove ${n} contact${n === 1 ? '' : 's'} and ${d} director${d === 1 ? 'y' : 'ies'}. This cannot be undone.`,
      )
    )
      return;
    if (!confirm(`Really wipe everything? Type-confirm: you currently have ${n} contacts.`)) return;
    Store.wipe();
    toast('All data cleared');
    onClose();
  }

  const counts = Store.tagCounts();
  const mainOpen = open && !importOpen && !tagsOpen && !groupsOpen && !accountOpen && !restoreOpen && !canopyOpen;

  return (
    <>
      <Sheet open={mainOpen} title="Menu" onClose={onClose}>
        <div className="menu-list">
          <button type="button" onClick={startImport}>
            Import .vcf / .csv
          </button>
          <button type="button" onClick={() => setGroupsOpen(true)}>
            Categories & tag groups
          </button>
          <button type="button" onClick={() => setTagsOpen(true)}>
            Manage tags
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new Event('cs:show-install'));
            }}
          >
            Add to Home Screen
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
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
          >
            {Sync.enabled ? (Sync.user ? `Account · ${Sync.user.email}` : 'Sign in / account') : 'Account (optional sync)'}
          </button>
          {Sync.enabled && (
            <button type="button" onClick={() => setCanopyOpen(true)}>
              Canopy Estimate (work history)
            </button>
          )}
          <div className="sep" />
          <button type="button" style={{ color: 'var(--danger)' }} onClick={wipe}>
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
          onChange={(e) => onRestoreFile(e.target.files?.[0] || null)}
        />
      </Sheet>

      <Sheet
        open={importOpen}
        title="Import"
        onClose={() => {
          setImportOpen(false);
          setPendingFile(null);
          setPreview(null);
        }}
        right={
          <button type="button" className="link strong" onClick={runImport} disabled={!preview?.wouldAdd && !preview?.total}>
            Import
          </button>
        }
      >
        <p className="muted">
          File: <strong>{pendingFile?.name}</strong>
        </p>
        {preview && (
          <div className="dir-card" style={{ margin: 0, width: '100%' }}>
            <div className="meta">
              {preview.total} in file · will add <b>{preview.wouldAdd}</b>
              {preview.wouldSkip ? ` · skip ${preview.wouldSkip} dupes` : ''}
            </div>
            {preview.samples.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {preview.samples.map((c) => (
                  <li key={c.id}>
                    {[c.first, c.last].filter(Boolean).join(' ') || c.company || 'No name'}
                    {c.tags.length ? ` · ${c.tags.join(', ')}` : ''}
                  </li>
                ))}
                {preview.wouldAdd > preview.samples.length && (
                  <li className="muted">…and {preview.wouldAdd - preview.samples.length} more</li>
                )}
              </ul>
            )}
          </div>
        )}
        <label>
          Optional tag for everyone imported
          <input value={importTag} placeholder="e.g. Imported" onChange={(e) => setImportTag(e.target.value)} />
        </label>
      </Sheet>

      <Sheet
        open={restoreOpen}
        title="Restore backup"
        onClose={() => {
          setRestoreOpen(false);
          setRestoreText('');
          setRestoreStats(null);
        }}
        right={
          <button type="button" className="link strong" onClick={confirmRestore}>
            Replace
          </button>
        }
      >
        <p>
          This will <b>replace everything</b> on this device with the backup.
        </p>
        <p className="muted">
          Now: {db.contacts.length} contacts, {db.directories.length} directories.
          <br />
          Backup: {restoreStats?.contacts ?? 0} contacts, {restoreStats?.directories ?? 0} directories.
        </p>
        <button type="button" className="btn danger wide" onClick={confirmRestore}>
          Replace all data with backup
        </button>
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

      <GroupsSheet open={groupsOpen} onClose={() => setGroupsOpen(false)} />
      <CanopySheet
        open={canopyOpen}
        onClose={() => setCanopyOpen(false)}
        onOpenAccount={() => {
          setCanopyOpen(false);
          setAccountOpen(true);
        }}
      />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
