import { useMemo, useState } from 'react';
import { conflictsFor, jobDates, jobsOn, stageOf, useDb } from '../lib/store';
import { addDays, dayDiff, fmtDay, fmtTime, parseYmd, startOfWeek, today } from '../lib/dates';
import { displayName } from '../lib/util';
import { editJob } from './EditJob';
import type { Db, Job } from '../types';
import { showPdf } from './PdfReady';
import { jobSheets, routeSheet } from '../lib/pdf';

export function JobRow({ job, date, db, onOpenCustomer }: { job: Job; date: string; db: Db; onOpenCustomer?: (id: string) => void }) {
  const c = db.customers.find((x) => x.id === job.customerId);
  const prop = c?.properties.find((p) => p.id === job.propertyId) || c?.properties[0];
  const dayN = dayDiff(job.date, date) + 1;
  const conflicts = conflictsFor(job, db);
  return (
    <div className={`ev ${job.kind}${job.status === 'done' ? ' done' : ''}`}>
      <button className="ev-main" onClick={() => editJob(job)}>
        <span className="ev-time">{job.kind === 'job' && dayN > 1 ? `Day ${dayN}` : fmtTime(job.start).replace(' ', ' ')}</span>
        <span className="grow">
          <b>{job.kind === 'estimate' ? 'Estimate' : 'Job'} · {c ? displayName(c) : 'Unknown'}{job.status === 'done' ? ' ✓' : ''}</b>
          <span className="meta">{[prop?.address, job.kind === 'job' && job.days > 1 ? `${job.days}-day job (day ${dayN} of ${job.days})` : job.kind === 'estimate' ? `${job.minutes} min` : ''].filter(Boolean).join(' · ')}</span>
          {job.work && <span className="ev-work">{job.work}</span>}
          {(job.crew.length > 0 || job.equipment.length > 0) && (
            <span className="ev-tags">
              {job.crew.map((x) => <span key={x}>{x}</span>)}
              {job.equipment.map((x) => <span key={x} className="eq">{x}</span>)}
            </span>
          )}
          {prop?.hazards.length ? <span className="ev-hz">⚠ {prop.hazards.join(' · ')}</span> : null}
          {conflicts.length > 0 && <span className="ev-hz">Double-booked: {[...new Set(conflicts.flatMap((x) => x.reasons))].join(', ')}</span>}
        </span>
      </button>
      {onOpenCustomer && c && <button className="ev-open" onClick={() => onOpenCustomer(c.id)} aria-label={`Open ${displayName(c)}`}>Card ›</button>}
    </div>
  );
}

export default function Calendar({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const db = useDb();
  const [sel, setSel] = useState(today());
  const [view, setView] = useState<'day' | 'week'>('day');
  const week = startOfWeek(sel);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const needsScheduling = useMemo(() => {
    const t = today();
    return db.customers.filter((c) => stageOf(c, db)?.id === 'stage-booked' &&
      !db.jobs.some((j) => j.customerId === c.id && j.kind === 'job' && j.status === 'scheduled' && jobDates(j).some((d) => d >= t)));
  }, [db]);

  const dayList = (d: string) => {
    const list = jobsOn(d, db);
    return list.length
      ? <div className="evs">{list.map((j) => <JobRow key={j.id + d} job={j} date={d} db={db} onOpenCustomer={onOpenCustomer} />)}</div>
      : <p className="muted" style={{ margin: '2px 2px 0' }}>Nothing scheduled.</p>;
  };

  return (
    <>
      <header className="screen-head">
        <div className="head-row">
          <h1 className="title">Calendar</h1>
          <div className="seg small" role="group" aria-label="View">
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Day</button>
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
          </div>
        </div>
        <div className="week-nav">
          <button className="icon-btn" aria-label="Previous week" onClick={() => setSel(addDays(sel, -7))}>‹</button>
          <b>{fmtDay(week, { month: 'long', day: 'numeric' })} – {fmtDay(addDays(week, 6), { month: parseYmd(week).getMonth() === parseYmd(addDays(week, 6)).getMonth() ? undefined : 'short', day: 'numeric' })}</b>
          <button className="icon-btn" aria-label="Next week" onClick={() => setSel(addDays(sel, 7))}>›</button>
          {sel !== today() && <button className="btn sm" onClick={() => setSel(today())}>Today</button>}
        </div>
        <div className="week">
          {days.map((d) => {
            const list = jobsOn(d, db);
            const clash = list.some((j) => conflictsFor(j, db).length);
            return (
              <button key={d} className={[d === sel ? 'on' : '', d === today() ? 'is-today' : '', clash ? 'clash' : ''].join(' ')} onClick={() => setSel(d)}
                aria-label={`${fmtDay(d, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} scheduled`}>
                <span>{fmtDay(d, { weekday: 'narrow' })}</span>
                <b>{parseYmd(d).getDate()}</b>
                <em>{list.slice(0, 3).map((j) => <i key={j.id} className={j.kind} />)}</em>
              </button>
            );
          })}
        </div>
      </header>

      <div className="body">
        {view === 'day' ? (
          <section style={{ display: 'grid', gap: 8 }}>
            <div className="eyebrow">{sel === today() ? 'Today · ' : ''}{fmtDay(sel, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            {dayList(sel)}
            {jobsOn(sel, db).length > 0 && (
              <div className="grid2">
                <button className="btn" onClick={() => showPdf(routeSheet(sel, jobsOn(sel, db), db), `route-${sel}.pdf`)}>Print route</button>
                <button className="btn" onClick={() => showPdf(jobSheets(jobsOn(sel, db), db), `sheets-${sel}.pdf`)}>Print sheets ({jobsOn(sel, db).length})</button>
              </div>
            )}
          </section>
        ) : days.map((d) => (
          <section key={d} style={{ display: 'grid', gap: 8 }}>
            <button className="eyebrow" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: d === today() ? 'var(--action)' : undefined }} onClick={() => { setSel(d); setView('day'); }}>
              {fmtDay(d, { weekday: 'long', month: 'short', day: 'numeric' })}
            </button>
            {dayList(d)}
          </section>
        ))}

        {needsScheduling.length > 0 && (
          <section style={{ display: 'grid', gap: 6 }}>
            <div className="section-head"><span className="eyebrow">Booked · needs a date</span><span className="eyebrow" style={{ color: 'var(--action)' }}>{needsScheduling.length}</span></div>
            <div className="card">
              {needsScheduling.map((c) => (
                <div key={c.id} className="row">
                  <span className="stripe" style={{ background: stageOf(c, db)?.color }} />
                  <span className="grow"><div className="nm">{displayName(c)}</div><div className="meta">{c.properties[0]?.treeNotes || c.properties[0]?.address}</div></span>
                  <button className="btn sm action" onClick={() => editJob({ kind: 'job', customerId: c.id, date: sel, start: '07:30', crew: db.settings.crew.slice(0, 2) })}>Schedule</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
