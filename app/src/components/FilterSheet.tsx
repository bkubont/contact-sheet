import { useEffect, useState } from 'react';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { NO_FILTERS, UNCAT, UNTAGGED, toggle, type Filters } from '../lib/filters';
import { Sheet } from './Sheet';

/** Pick categories and tags to narrow the contact list. Changes apply when you tap Show. */
export function FilterSheet({
  open,
  value,
  onApply,
  onClose,
  countFor,
}: {
  open: boolean;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
  /** How many contacts a filter would show, for the button label. */
  countFor: (f: Filters) => number;
}) {
  const db = useDb();
  const [f, setF] = useState<Filters>(value);
  useEffect(() => {
    if (open) setF(value);
  }, [open, value]);

  const tagCounts = Store.tagCounts();
  const catCounts = Store.categoryCounts();
  const untagged = db.contacts.filter((c) => !c.tags.length).length;
  const uncat = db.contacts.filter((c) => !c.category).length;
  const grouped = new Set(db.tagGroups.flatMap((g) => g.tags));
  const used = new Set(tagCounts.map(([t]) => t));
  const n = (t: string) => tagCounts.find(([x]) => x === t)?.[1] ?? 0;
  const realTags = f.tags.filter((t) => t !== UNTAGGED).length;
  const shown = countFor(f);

  const chip = (key: string, label: string, color: string | undefined, on: boolean, count: number, onClick: () => void) => (
    <button key={key} type="button" aria-pressed={on} data-color={color} className={on ? 'on' : undefined} onClick={onClick}>
      {label}
      <span className="n">{count}</span>
    </button>
  );

  return (
    <Sheet
      open={open}
      title="Filter"
      onClose={onClose}
      right={
        <button type="button" className="link strong" onClick={() => setF(NO_FILTERS)} disabled={!f.cats.length && !f.tags.length}>
          Clear
        </button>
      }
    >
      <fieldset>
        <legend>Category</legend>
        <div className="choice-chips">
          {db.categories.map((c) =>
            chip(c.id, c.name, c.color, f.cats.includes(c.id), catCounts.find(([id]) => id === c.id)?.[1] ?? 0, () => setF({ ...f, cats: toggle(f.cats, c.id) })),
          )}
          {!!uncat && chip(UNCAT, 'No category', undefined, f.cats.includes(UNCAT), uncat, () => setF({ ...f, cats: toggle(f.cats, UNCAT) }))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Tags</legend>
        {realTags > 1 && (
          <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }} role="radiogroup" aria-label="Match">
            <button type="button" role="radio" aria-checked={f.match === 'any'} className={f.match === 'any' ? 'on' : ''} onClick={() => setF({ ...f, match: 'any' })}>
              Any of these
            </button>
            <button type="button" role="radio" aria-checked={f.match === 'all'} className={f.match === 'all' ? 'on' : ''} onClick={() => setF({ ...f, match: 'all' })}>
              All of these
            </button>
          </div>
        )}
        {db.tagGroups
          .filter((g) => g.tags.some((t) => used.has(t)))
          .map((g) => (
            <div key={g.id} className="tag-group-block">
              <h4>{g.name}</h4>
              <div className="choice-chips">
                {g.tags.filter((t) => used.has(t)).map((t) => chip(t, t, g.color, f.tags.includes(t), n(t), () => setF({ ...f, tags: toggle(f.tags, t) })))}
              </div>
            </div>
          ))}
        <div className="tag-group-block">
          {db.tagGroups.length > 0 && <h4>Other tags</h4>}
          <div className="choice-chips">
            {tagCounts
              .filter(([t]) => !grouped.has(t))
              .map(([t, count]) => chip(t, t, Store.tagColor(t), f.tags.includes(t), count, () => setF({ ...f, tags: toggle(f.tags, t) })))}
            {!!untagged && chip(UNTAGGED, 'No tags', undefined, f.tags.includes(UNTAGGED), untagged, () => setF({ ...f, tags: toggle(f.tags, UNTAGGED) }))}
          </div>
        </div>
      </fieldset>

      <button
        type="button"
        className="btn primary wide"
        onClick={() => {
          onApply(f);
          onClose();
        }}
      >
        Show {shown} contact{shown === 1 ? '' : 's'}
      </button>
    </Sheet>
  );
}
