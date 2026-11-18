import { useMemo, useState } from 'react';
import { stageGroup, stageOf, useDb } from '../lib/store';
import { displayName, sortKey } from '../lib/util';
import type { Customer } from '../types';

function matches(c: Customer, q: string, tagNames: string[]) {
  if (!q) return true;
  const hay = [c.first, c.last, c.company, c.notes, ...c.phones.map((p) => p.value), ...c.emails.map((e) => e.value),
    ...c.properties.flatMap((p) => [p.address, p.treeNotes, p.access]), ...tagNames].join(' ').toLowerCase();
  const digits = q.replace(/\D/g, '');
  return q.split(/\s+/).every((w) => hay.includes(w)) ||
    (digits.length >= 3 && c.phones.some((p) => p.value.replace(/\D/g, '').includes(digits)));
}

export default function People({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDb();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const sg = stageGroup(db);

  const tagName = useMemo(() => {
    const m = new Map<string, string>();
    db.tagGroups.forEach((g) => g.tags.forEach((t) => m.set(t.id, t.name)));
    return m;
  }, [db.tagGroups]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of db.customers) { const s = stageOf(c, db); if (s) m.set(s.id, (m.get(s.id) || 0) + 1); }
    return m;
  }, [db]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return db.customers
      .filter((c) => !stage || c.tagIds.includes(stage))
      .filter((c) => matches(c, query, c.tagIds.map((id) => tagName.get(id) || '')))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }, [db.customers, q, stage, tagName]);

  const groups = useMemo(() => {
    const m = new Map<string, Customer[]>();
    for (const c of shown) {
      let L = sortKey(c).normalize('NFD')[0]?.toUpperCase() || '#';
      if (!/[A-Z]/.test(L)) L = '#';
      if (!m.has(L)) m.set(L, []);
      m.get(L)!.push(c);
    }
    return [...m.entries()];
  }, [shown]);

  return (
    <>
      <header className="screen-head">
        <div className="head-row"><h1 className="title">People<small>{db.customers.length || ''}</small></h1></div>
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Name, street, phone, tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        </label>
        {sg && db.customers.length > 0 && (
          <div className="chips" role="group" aria-label="Filter by stage">
            <button className={stage === null ? 'chip on' : 'chip'} onClick={() => setStage(null)}>All</button>
            {sg.tags.map((t) => (
              <button key={t.id} className={stage === t.id ? 'chip on' : 'chip'} onClick={() => setStage(stage === t.id ? null : t.id)}>
                <i style={{ background: t.color }} />{t.name}<span className="n">{counts.get(t.id) || 0}</span>
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="body">
        {db.customers.length === 0 && (
          <div className="empty">
            <h2>No customers yet</h2>
            <p>Import your contact file from the More tab, or tap + to add your first customer.</p>
          </div>
        )}
        {db.customers.length > 0 && shown.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 32 }}>No matches.</p>}
        {groups.map(([L, list]) => (
          <section key={L} style={{ display: 'grid', gap: 6 }}>
            <div className="letter">{L}</div>
            <div className="card">
              {list.map((c) => {
                const s = stageOf(c, db);
                const addr = c.properties[0]?.address;
                const sub = [c.company && (c.first || c.last) ? c.company : '', addr, !addr ? c.phones[0]?.value : '', s?.name].filter(Boolean).join(' · ');
                return (
                  <button key={c.id} className="row" onClick={() => onOpen(c.id)}>
                    <span className="stripe" style={{ background: s?.color }} />
                    <span className="grow">
                      <div className="nm">{displayName(c)}{c.sample && <span className="sample-badge">Sample</span>}</div>
                      {sub && <div className="meta">{sub}</div>}
                    </span>
                    <span className="muted" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
