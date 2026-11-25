import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../types';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { nextTagState, tagChanges, tagStates, type TagState } from '../lib/filters';
import { toast } from '../lib/util';
import { Sheet } from './Sheet';

function Mark({ s }: { s: TagState }) {
  return (
    <span className={`tri ${s}`} aria-hidden="true">
      {s === 'all' ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : s === 'some' ? (
        <svg viewBox="0 0 24 24">
          <path d="M6 12h12" />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Tags for several people at once. Each tag shows whether all, some or none of
 * them have it; tap to give it to everyone or take it from everyone.
 */
export function BulkTagSheet({ open, people, onClose }: { open: boolean; people: Contact[]; onClose: () => void }) {
  const db = useDb();
  const allTags = useMemo(
    () => [...new Set([...Store.tagCounts().map(([t]) => t), ...db.tagGroups.flatMap((g) => g.tags)])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, open],
  );
  const [before, setBefore] = useState<Record<string, TagState>>({});
  const [after, setAfter] = useState<Record<string, TagState>>({});
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = tagStates(people, allTags);
    setBefore(s);
    setAfter(s);
    setNewTag('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tap = (t: string) => setAfter((a) => ({ ...a, [t]: nextTagState(a[t] ?? 'none') }));

  function addNew() {
    let t = newTag.trim();
    if (!t) return;
    const existing = Object.keys(after).find((x) => x.toLowerCase() === t.toLowerCase());
    if (existing) t = existing;
    setAfter((a) => ({ ...a, [t]: 'all' }));
    setNewTag('');
  }

  const { add, remove } = tagChanges(before, after);

  function apply() {
    const ids = people.map((p) => p.id);
    for (const t of add) Store.bulkTag(ids, t, true);
    for (const t of remove) Store.bulkTag(ids, t, false);
    const parts = [add.length && `added ${add.length} tag${add.length === 1 ? '' : 's'}`, remove.length && `removed ${remove.length}`].filter(Boolean);
    if (parts.length) toast(`${parts.join(', ')} for ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`.replace(/^./, (c) => c.toUpperCase()));
    onClose();
  }

  const grouped = new Set(db.tagGroups.flatMap((g) => g.tags));
  const others = Object.keys(after)
    .filter((t) => !grouped.has(t))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const row = (t: string) => {
    const s = after[t] ?? 'none';
    return (
      <button key={t} type="button" className="check-row" role="checkbox" aria-checked={s === 'all' ? true : s === 'some' ? 'mixed' : false} data-color={Store.tagColor(t)} onClick={() => tap(t)}>
        <Mark s={s} />
        <i className="dot" />
        <span>{t}</span>
        {s === 'some' && <small className="muted">some of them</small>}
      </button>
    );
  };

  return (
    <Sheet
      open={open}
      title={`Tag ${people.length} ${people.length === 1 ? 'person' : 'people'}`}
      onClose={onClose}
      right={
        <button type="button" className="link strong" onClick={apply} disabled={!add.length && !remove.length}>
          Apply
        </button>
      }
    >
      {db.tagGroups
        .filter((g) => g.tags.length)
        .map((g) => (
          <div key={g.id} className="check-group">
            <h4>{g.name}</h4>
            {g.tags.map(row)}
          </div>
        ))}
      {!!others.length && (
        <div className="check-group">
          {db.tagGroups.length > 0 && <h4>Other tags</h4>}
          {others.map(row)}
        </div>
      )}
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          addNew();
        }}
      >
        <input value={newTag} placeholder="New tag" onChange={(e) => setNewTag(e.target.value)} enterKeyHint="done" aria-label="New tag" />
        <button type="submit" className="btn" disabled={!newTag.trim()}>
          Add
        </button>
      </form>
    </Sheet>
  );
}
