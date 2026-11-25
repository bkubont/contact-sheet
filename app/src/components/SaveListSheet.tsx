import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../types';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { askConfirm } from '../lib/dialogs';
import { toast, uid } from '../lib/util';
import { Sheet } from './Sheet';

/** Put the selected people in a saved list: an existing one, or a new one. */
export function SaveListSheet({ open, people, defaultName, onClose }: { open: boolean; people: Contact[]; defaultName: string; onClose: () => void }) {
  const db = useDb();
  const lists = useMemo(() => db.directories.filter((d) => d.mode === 'manual').sort((a, b) => a.name.localeCompare(b.name)), [db]);
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setTarget('');
    setName(defaultName);
  }, [open, defaultName]);

  const ids = people.map((p) => p.id);
  const sameName = !target && name.trim() ? lists.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()) : undefined;

  async function save() {
    if (!ids.length) return;
    const existing = target ? Store.getDirectory(target) : sameName;
    if (existing) {
      let contactIds = [...new Set([...existing.contactIds, ...ids])];
      if (!target) {
        // Typed the name of a list that already exists.
        const add = await askConfirm({
          title: `“${existing.name}” already exists`,
          message: `It has ${existing.contactIds.length} ${existing.contactIds.length === 1 ? 'person' : 'people'}. Add these ${ids.length} to it, or replace everyone in it with these ${ids.length}?`,
          confirmLabel: 'Add to it',
          cancelLabel: 'Replace',
        });
        if (!add) {
          const really = await askConfirm({ title: `Replace everyone in “${existing.name}”?`, confirmLabel: 'Replace', danger: true });
          if (!really) return;
          contactIds = ids;
        }
      }
      Store.upsertDirectory({ ...existing, contactIds });
      toast(`Saved to “${existing.name}”`);
    } else {
      const n = name.trim();
      if (!n) return;
      Store.upsertDirectory({ id: uid(), name: n, notes: '', mode: 'manual', contactIds: ids, tags: [], match: 'any', created: Date.now(), updated: Date.now() });
      toast(`Made the list “${n}”`);
    }
    onClose();
  }

  return (
    <Sheet
      open={open}
      title="Add to a list"
      onClose={onClose}
      right={
        <button type="button" className="link strong" onClick={save} disabled={!ids.length || (!target && !name.trim())}>
          Save
        </button>
      }
    >
      <p className="muted">
        {ids.length} {ids.length === 1 ? 'person' : 'people'} selected.
      </p>
      {!!lists.length && (
        <div className="settings-group">
          {lists.map((d) => (
            <button key={d.id} type="button" className={`settings-row${target === d.id ? ' picked' : ''}`} aria-pressed={target === d.id} onClick={() => setTarget(target === d.id ? '' : d.id)}>
              <span>
                {d.name}
                <small>
                  {d.contactIds.length} {d.contactIds.length === 1 ? 'person' : 'people'}
                </small>
              </span>
              {target === d.id && (
                <svg viewBox="0 0 24 24" className="chev">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
      {!target && (
        <label>
          {lists.length ? 'Or make a new list' : 'New list name'}
          <input value={name} placeholder="e.g. Holiday cards 2026" onChange={(e) => setName(e.target.value)} />
        </label>
      )}
    </Sheet>
  );
}
