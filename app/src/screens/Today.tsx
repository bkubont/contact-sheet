import { stageOf, useDb } from '../lib/store';
import { displayName, timeAgo } from '../lib/util';
import type { Customer } from '../types';

export default function Today({ onOpen, onGo }: { onOpen: (id: string) => void; onGo: (h: string) => void }) {
  const db = useDb();
  const now = new Date();
  const byStage = (id: string) => db.customers.filter((c) => c.tagIds.includes(id));
  const lastStageChange = (c: Customer) =>
    Math.max(0, ...db.activities.filter((a) => a.customerId === c.id && (a.type === 'stage' || a.type === 'imported' || a.type === 'created')).map((a) => a.at));

  const newLeads = byStage('stage-new');
  const estSet = byStage('stage-est-set');
  const cold = byStage('stage-est-sent').filter((c) => Date.now() - lastStageChange(c) > 7 * 86400000);
  const waiting = byStage('stage-est-sent');

  const Section = ({ title, list, empty, hint }: { title: string; list: Customer[]; empty: string; hint: (c: Customer) => string }) => (
    <section style={{ display: 'grid', gap: 6 }}>
      <div className="section-head"><span className="eyebrow">{title}</span><span className="eyebrow">{list.length}</span></div>
      {list.length ? (
        <div className="card">
          {list.slice(0, 6).map((c) => {
            const s = stageOf(c, db);
            return (
              <button key={c.id} className="row" onClick={() => onOpen(c.id)}>
                <span className="stripe" style={{ background: s?.color }} />
                <span className="grow"><div className="nm">{displayName(c)}</div><div className="meta">{hint(c)}</div></span>
                <span className="muted">›</span>
              </button>
            );
          })}
        </div>
      ) : <p className="muted" style={{ margin: '0 2px' }}>{empty}</p>}
    </section>
  );

  return (
    <>
      <header className="screen-head brand">
        <div className="muted" style={{ fontWeight: 600 }}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="head-row"><h1 className="title">Today</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['New leads', newLeads.length, false], ['Estimates set', estSet.length, false], ['Going cold', cold.length, cold.length > 0]].map(([label, n, hot]) => (
            <div key={label as string} style={{ background: hot ? 'var(--action)' : 'rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ font: '800 30px/1 var(--font-display)' }}>{n as number}</div>
              <div style={{ fontSize: 13, opacity: .85 }}>{label as string}</div>
            </div>
          ))}
        </div>
      </header>
      <div className="body">
        {db.customers.length === 0 && (
          <div className="empty">
            <h2>Welcome to Canopy Clients</h2>
            <p>Start by importing your contact file, or look around with sample customers first.</p>
            <button className="btn action" onClick={() => onGo('more')}>Import contacts</button>
          </div>
        )}
        {db.customers.length > 0 && (
          <>
            <Section title="Estimates going cold" list={cold} empty="Nothing going cold. Estimates sent more than 7 days ago show up here." hint={(c) => `Estimate sent ${timeAgo(lastStageChange(c))}`} />
            <Section title="New leads to call back" list={newLeads} empty="No new leads waiting." hint={(c) => c.properties[0]?.address || c.phones[0]?.value || ''} />
            <Section title="Estimates set" list={estSet} empty="No estimates set." hint={(c) => c.properties[0]?.address || ''} />
            <Section title="Waiting on a yes" list={waiting} empty="No estimates out." hint={(c) => `Sent ${timeAgo(lastStageChange(c))}`} />
            <div className="soon"><h3>Coming to Today</h3><p>Your estimate route and jobs from the calendar (milestone 2), texts owed and new replies from Quo (milestone 3), and pinned smart lists (milestone 4).</p></div>
          </>
        )}
      </div>
    </>
  );
}
