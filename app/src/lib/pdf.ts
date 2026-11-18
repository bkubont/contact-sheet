// Printable sheets for the truck: crew job sheets, the day's route, and mailing labels.
// jsPDF is loaded only when someone prints, so it doesn't slow down the app.
import type { jsPDF as JsPDF } from 'jspdf';
import type { Customer, Db, Job } from '../types';
import { displayName } from './util';
import { fmtDay, fmtTime, addDays, today } from './dates';

const INK: [number, number, number] = [19, 34, 26];
const MUTED: [number, number, number] = [94, 106, 92];
const BRAND: [number, number, number] = [29, 90, 58];
const ORANGE: [number, number, number] = [232, 90, 12];
const HZ_BG: [number, number, number] = [253, 227, 216];
const LINE: [number, number, number] = [210, 212, 200];

// Built-in PDF fonts only cover Latin-1; swap or drop anything else.
function safe(s: string | undefined): string {
  return String(s || '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/…/g, '...').replace(/ /g, ' ').normalize('NFC').replace(/[^\x00-\xFF]/g, '');
}

async function newDoc(): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ unit: 'pt', format: 'letter' });
}

const W = 612, H = 792, M = 40;

function font(doc: JsPDF, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = INK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function header(doc: JsPDF, db: Db, title: string, sub: string): number {
  const s = db.settings;
  let x = M;
  if (s.logo) {
    try {
      const props = doc.getImageProperties(s.logo);
      const h = 34, w = Math.min(120, (props.width / props.height) * h);
      doc.addImage(s.logo, M, M - 6, w, h);
      x = M + w + 10;
    } catch { /* bad image: skip it */ }
  }
  font(doc, 15, 'bold', BRAND);
  doc.text(safe(s.businessName || 'Canopy Clients'), x, M + 8);
  if (s.businessPhone) { font(doc, 9.5, 'normal', MUTED); doc.text(safe(s.businessPhone), x, M + 22); }
  font(doc, 20, 'bold');
  doc.text(safe(title).toUpperCase(), W - M, M + 8, { align: 'right' });
  font(doc, 10, 'normal', MUTED);
  doc.text(safe(sub), W - M, M + 22, { align: 'right' });
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(3);
  doc.line(M, M + 34, W - M, M + 34);
  return M + 54;
}

function footer(doc: JsPDF, label: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    font(doc, 8, 'normal', MUTED);
    doc.text(safe(label), M, H - 22);
    doc.text(`Page ${i} of ${n}`, W - M, H - 22, { align: 'right' });
  }
}

function jobContext(job: Job, db: Db) {
  const c = db.customers.find((x) => x.id === job.customerId);
  const prop = c?.properties.find((p) => p.id === job.propertyId) || c?.properties[0];
  const tagNames = (c?.tagIds || []).map((id) => db.tagGroups.flatMap((g) => g.tags).find((t) => t.id === id)?.name || '');
  const flagHazards = tagNames.filter((n) => /power line|crane|dog/i.test(n));
  const hazards = [...(prop?.hazards || []), ...flagHazards.filter((f) => !(prop?.hazards || []).some((h) => h.toLowerCase().includes(f.toLowerCase().split(' ')[0])))];
  return { c, prop, hazards, tagNames };
}

// label/value rows; returns new y
function rows(doc: JsPDF, y: number, items: [string, string][], valueX = M + 92, width = W - M - (M + 92)): number {
  for (const [label, value] of items) {
    if (!value) continue;
    font(doc, 8, 'bold', MUTED);
    doc.text(label.toUpperCase(), M, y);
    font(doc, 11);
    const lines = doc.splitTextToSize(safe(value), width);
    doc.text(lines, valueX, y);
    y += Math.max(1, lines.length) * 14 + 6;
  }
  return y;
}

function hazardBar(doc: JsPDF, y: number, hazards: string[]): number {
  if (!hazards.length) return y;
  font(doc, 11, 'bold', [154, 45, 12]);
  const lines = doc.splitTextToSize(safe('HAZARDS: ' + hazards.join('  -  ')), W - 2 * M - 24);
  const h = lines.length * 14 + 14;
  doc.setFillColor(...HZ_BG);
  doc.rect(M, y, W - 2 * M, h, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(M, y, 6, h, 'F');
  doc.text(lines, M + 16, y + 18);
  return y + h + 14;
}

function noteLines(doc: JsPDF, y: number, bottom: number, label = 'Notes') {
  font(doc, 8, 'bold', MUTED);
  doc.text(label.toUpperCase(), M, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  for (let ly = y + 22; ly < bottom; ly += 22) doc.line(M, ly, W - M, ly);
}

// ---------- crew job sheet: one page per job ----------
export async function jobSheets(jobs: Job[], db: Db): Promise<Blob> {
  const doc = await newDoc();
  jobs.forEach((job, i) => {
    if (i > 0) doc.addPage();
    const { c, prop, hazards } = jobContext(job, db);
    const last = addDays(job.date, Math.max(1, job.days) - 1);
    const when = job.kind === 'job' && job.days > 1 ? `${fmtDay(job.date)} - ${fmtDay(last)} (${job.days} days)` : fmtDay(job.date, { weekday: 'long', month: 'long', day: 'numeric' });
    let y = header(doc, db, job.kind === 'estimate' ? 'Estimate visit' : 'Job sheet', `${when}${job.start ? ' - start ' + fmtTime(job.start) : ''}`);

    font(doc, 22, 'bold');
    doc.text(safe(c ? displayName(c) : 'Unknown customer'), M, y + 6);
    y += 28;
    y = hazardBar(doc, y, hazards);
    y = rows(doc, y, [
      ['Phone', (c?.phones || []).map((p) => `${p.value} (${p.label})`).join('   ')],
      ['Address', prop?.address || ''],
      ['Gate code', prop?.gateCode || ''],
      ['Access', prop?.access || ''],
      [job.kind === 'estimate' ? 'Look at' : 'Work', job.work],
      ['Tree notes', prop?.treeNotes && prop.treeNotes !== job.work ? prop.treeNotes : ''],
      ['Crew', job.crew.join(', ')],
      ['Equipment', job.equipment.join(', ')],
      ['Notes', job.notes],
    ]);

    y += 6;
    font(doc, 8, 'bold', MUTED);
    doc.text('CHECKLIST', M, y);
    y += 14;
    const checks = job.kind === 'estimate'
      ? ['Texted customer on the way', 'Photos of the trees', 'Measured / noted access', 'Estimate given or to send']
      : [...(hazards.some((h) => /power/i.test(h)) ? ['Utility lines located / called'] : []), 'Customer texted on arrival', 'Before photos', 'Work area set up safely', 'After photos', 'Debris and chips cleaned up', 'Walkthrough with customer'];
    font(doc, 11);
    checks.forEach((t, k) => {
      const cx = k % 2 === 0 ? M : W / 2;
      const cy = y + Math.floor(k / 2) * 20;
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(1);
      doc.rect(cx, cy - 9, 11, 11);
      doc.text(safe(t), cx + 18, cy);
    });
    y += Math.ceil(checks.length / 2) * 20 + 16;

    if (job.kind === 'job') {
      font(doc, 10, 'normal', MUTED);
      doc.text('Time in: ____________     Time out: ____________     Loads hauled: ______', M, y);
      y += 26;
    }
    noteLines(doc, y, H - 50);
  });
  footer(doc, `${db.settings.businessName} - printed ${fmtDay(today())}`);
  return doc.output('blob');
}

// ---------- day route sheet ----------
export async function routeSheet(date: string, jobs: Job[], db: Db): Promise<Blob> {
  const doc = await newDoc();
  let y = header(doc, db, 'Route', fmtDay(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  const start = y;
  if (!jobs.length) { font(doc, 12, 'italic', MUTED); doc.text('Nothing scheduled.', M, y); }
  jobs.forEach((job, i) => {
    const { c, prop, hazards } = jobContext(job, db);
    const dayN = Math.round((new Date(date + 'T00:00').getTime() - new Date(job.date + 'T00:00').getTime()) / 86400000) + 1;
    const body: string[] = [
      [prop?.address, c?.phones[0]?.value].filter(Boolean).join('   -   '),
      job.work ? (job.kind === 'estimate' ? 'Look at: ' : 'Work: ') + job.work : '',
      [prop?.gateCode ? `Gate ${prop.gateCode}` : '', prop?.access].filter(Boolean).join('. '),
      [job.crew.join(', '), job.equipment.join(', ')].filter(Boolean).join('  |  '),
    ].filter(Boolean);
    font(doc, 10.5);
    const wrapped = body.flatMap((b) => doc.splitTextToSize(safe(b), W - M - (M + 80) - 20) as string[]);
    const blockH = 22 + wrapped.length * 13 + (hazards.length ? 16 : 0) + 30;
    if (y + blockH > H - 50 && y > start) { doc.addPage(); y = header(doc, db, 'Route', fmtDay(date, { weekday: 'long', month: 'long', day: 'numeric' })); }

    // number + time column
    doc.setFillColor(...(job.kind === 'estimate' ? [196, 138, 0] as [number, number, number] : ORANGE));
    doc.circle(M + 9, y + 2, 9, 'F');
    font(doc, 10, 'bold', [255, 255, 255]);
    doc.text(String(i + 1), M + 9, y + 5.5, { align: 'center' });
    font(doc, 11, 'bold');
    doc.text(job.kind === 'job' && dayN > 1 ? `Day ${dayN}` : safe(fmtTime(job.start)), M + 24, y + 6);

    const x = M + 80;
    font(doc, 13, 'bold');
    doc.text(safe(`${job.kind === 'estimate' ? 'Estimate' : 'Job'} - ${c ? displayName(c) : 'Unknown'}`), x, y + 6);
    let yy = y + 22;
    font(doc, 10.5);
    doc.text(wrapped, x, yy);
    yy += wrapped.length * 13;
    if (hazards.length) { font(doc, 10, 'bold', [154, 45, 12]); doc.text(safe('! ' + hazards.join('  -  ')), x, yy + 2); yy += 16; }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(x, yy + 10, W - M, yy + 10);
    font(doc, 8, 'normal', MUTED);
    doc.text('notes', x, yy + 20);
    doc.line(M, yy + 24, W - M, yy + 24);
    y = yy + 40;
  });
  footer(doc, `${db.settings.businessName} - route for ${fmtDay(date)}`);
  return doc.output('blob');
}

// ---------- Avery 5160-style address labels (30 per sheet) ----------
export async function labels(customers: Customer[], db: Db, opts: { resident: boolean }): Promise<{ blob: Blob; count: number; skipped: number }> {
  const doc = await newDoc();
  const COLS = 3, ROWS = 10, LW = 189, LH = 72, LEFT = 13.5, TOP = 36, GAP = 9;
  const entries: string[][] = [];
  let skipped = 0;
  for (const c of customers) {
    const withAddr = c.properties.filter((p) => p.address.trim());
    if (!withAddr.length) { skipped++; continue; }
    for (const p of withAddr) {
      const parts = p.address.split(',').map((x) => x.trim()).filter(Boolean);
      const street = parts.shift() || '';
      const rest = parts.join(', ');
      const name = opts.resident ? 'Current Resident' : (c.company && !(c.first || c.last) ? c.company : displayName(c));
      entries.push([name, street, rest].filter(Boolean));
    }
  }
  entries.forEach((lines, i) => {
    const onPage = i % (COLS * ROWS);
    if (i > 0 && onPage === 0) doc.addPage();
    const col = onPage % COLS, row = Math.floor(onPage / COLS);
    const x = LEFT + col * (LW + GAP) + 12;
    const y0 = TOP + row * LH;
    const lh = 13;
    const top = y0 + (LH - lines.length * lh) / 2 + 10;
    lines.forEach((l, k) => {
      font(doc, k === 0 ? 10.5 : 10, k === 0 ? 'bold' : 'normal');
      doc.text(doc.splitTextToSize(safe(l), LW - 20)[0] as string, x, top + k * lh);
    });
  });
  if (!entries.length) { font(doc, 12, 'italic', MUTED); doc.text('No addresses to print.', M, M + 20); }
  return { blob: doc.output('blob'), count: entries.length, skipped };
}
