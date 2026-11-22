import type { Contact, PdfOptions } from '../types';
import { displayName } from './store';

const COLORS = {
  text: [28, 37, 38] as [number, number, number],
  muted: [107, 119, 120] as [number, number, number],
  line: [214, 211, 203] as [number, number, number],
  accent: [15, 76, 81] as [number, number, number],
  accentSoft: [220, 235, 235] as [number, number, number],
  fill: [244, 243, 239] as [number, number, number],
};

function safe(s: string) {
  return String(s || '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .normalize('NFC')
    .replace(/[^\x00-\xFF]/g, '');
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function sortContacts(list: Contact[], sort: PdfOptions['sort']) {
  const key = (c: Contact) => {
    if (sort === 'first') return [c.first || c.last || c.company, c.last];
    if (sort === 'company') return [c.company || '~', c.last, c.first];
    return [c.last || c.first || c.company, c.first];
  };
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      const r = (ka[i] || '').localeCompare(kb[i] || '', undefined, { sensitivity: 'base' });
      if (r) return r;
    }
    return 0;
  });
}

function nameFor(c: Contact, sort: PdfOptions['sort']) {
  if (sort === 'last' && c.last && c.first) return `${c.last}, ${c.first}`;
  return displayName(c);
}

function detailLines(c: Contact, o: PdfOptions) {
  const lines: { label: string; text: string; muted?: boolean }[] = [];
  if (o.f_phones) for (const p of c.phones) lines.push({ label: cap(p.label), text: p.value });
  if (o.f_emails)
    for (const e of c.emails)
      lines.push({ label: e.label === 'work' ? 'Work email' : 'Email', text: e.value });
  if (o.f_address && c.address) lines.push({ label: 'Address', text: c.address });
  if (o.f_birthday && c.birthday) lines.push({ label: 'Birthday', text: c.birthday });
  if (o.f_tags && c.tags.length) lines.push({ label: 'Tags', text: c.tags.join(', '), muted: true });
  if (o.f_notes && c.notes) lines.push({ label: 'Notes', text: c.notes, muted: true });
  return lines;
}

function subLine(c: Contact, o: PdfOptions) {
  if (!o.f_company) return '';
  return [c.title, c.company].filter(Boolean).join(', ');
}

export async function makePdf(contacts: Contact[], o: PdfOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: o.paper || 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const list = sortContacts(contacts, o.sort);
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const title = safe(o.title || 'Contact Sheet');
  const subtitle = safe(o.subtitle || '');

  const set = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = COLORS.text) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (text: string, width: number) => doc.splitTextToSize(safe(text), width);

  let y = M;

  function pageHeader(firstContentPage: boolean) {
    if (firstContentPage) {
      set(18, 'bold', COLORS.accent);
      doc.text(title, M, M + 6);
      set(9, 'normal', COLORS.muted);
      doc.text(`${list.length} contact${list.length === 1 ? '' : 's'}  ·  ${dateStr}`, M, M + 22);
    } else {
      set(10, 'bold', COLORS.accent);
      doc.text(title, M, M + 6);
    }
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(1);
    doc.line(M, firstContentPage ? M + 30 : M + 14, W - M, firstContentPage ? M + 30 : M + 14);
  }

  function newPage(withHeader = true) {
    doc.addPage();
    if (withHeader) {
      pageHeader(false);
      y = M + 28;
    } else {
      y = M;
    }
  }

  // ----- Cover page -----
  if (o.cover) {
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 0, W, H * 0.38, 'F');
    set(11, 'normal', [255, 255, 255]);
    doc.text('CONTACT SHEET', M, H * 0.14);
    set(32, 'bold', [255, 255, 255]);
    const titleLines = wrap(title, W - 2 * M);
    doc.text(titleLines, M, H * 0.2);
    let cy = H * 0.2 + titleLines.length * 34;
    if (subtitle) {
      set(14, 'normal', COLORS.accentSoft);
      const subLines = wrap(subtitle, W - 2 * M);
      doc.text(subLines, M, cy);
      cy += subLines.length * 18 + 8;
    }
    set(12, 'normal', [255, 255, 255]);
    doc.text(`${list.length} contact${list.length === 1 ? '' : 's'}`, M, cy + 8);
    doc.text(dateStr, M, cy + 26);

    // Mini index by first letter
    const letters = new Map<string, number>();
    for (const c of list) {
      const nm = nameFor(c, o.sort);
      const src = o.sort === 'company' ? c.company || nm : nm;
      const letter = (safe(src).trim()[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      letters.set(key, (letters.get(key) || 0) + 1);
    }
    set(10, 'bold', COLORS.accent);
    doc.text('At a glance', M, H * 0.48);
    set(9, 'normal', COLORS.muted);
    let ix = M;
    let iy = H * 0.52;
    const sortedLetters = [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [letter, n] of sortedLetters) {
      set(11, 'bold', COLORS.text);
      doc.text(letter, ix, iy);
      set(9, 'normal', COLORS.muted);
      doc.text(String(n), ix + 14, iy);
      ix += 42;
      if (ix > W - M - 30) {
        ix = M;
        iy += 22;
      }
    }
    set(9, 'normal', COLORS.muted);
    doc.text('Personal directory · Not for redistribution', M, H - M);
    newPage(true);
  } else {
    pageHeader(true);
    y = M + 42;
  }

  const top = o.cover ? M + 28 : M + 42;
  const bottom = H - M - 10;

  // ----- Cards -----
  if (o.layout === 'cards') {
    const gap = 12;
    const pad = 9;
    const cw = (W - 2 * M - gap) / 2;
    const inner = cw - 2 * pad;
    const labelW = 54;

    type Block =
      | { kind: 'name'; lines: string[]; h: number }
      | { kind: 'sub'; lines: string[]; h: number }
      | { kind: 'detail'; d: { label: string; text: string; muted?: boolean }; lines: string[]; h: number };

    const measure = (c: Contact) => {
      const blocks: Block[] = [];
      set(11, 'bold');
      const nameL = wrap(nameFor(c, o.sort), inner);
      blocks.push({ kind: 'name', lines: nameL, h: nameL.length * 13 });
      const sub = subLine(c, o);
      if (sub) {
        set(8.5, 'italic');
        const l = wrap(sub, inner);
        blocks.push({ kind: 'sub', lines: l, h: l.length * 10.5 });
      }
      set(8.5, 'normal');
      for (const d of detailLines(c, o)) {
        const l = wrap(d.text, inner - labelW);
        blocks.push({ kind: 'detail', d, lines: l, h: l.length * 10.5 + 1.5 });
      }
      const h = pad * 2 + blocks.reduce((s, b) => s + b.h, 0) + (blocks.length > 1 ? 3 : 0);
      return { blocks, h };
    };

    const drawCard = (m: ReturnType<typeof measure>, x: number, y0: number, h: number) => {
      doc.setDrawColor(...COLORS.line);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.75);
      doc.roundedRect(x, y0, cw, h, 5, 5, 'S');
      doc.setFillColor(...COLORS.accent);
      doc.rect(x, y0 + 6, 2.5, h - 12, 'F');
      let yy = y0 + pad + 9;
      m.blocks.forEach((b, i) => {
        if (b.kind === 'name') {
          set(11, 'bold');
          doc.text(b.lines, x + pad, yy);
        } else if (b.kind === 'sub') {
          set(8.5, 'italic', COLORS.muted);
          doc.text(b.lines, x + pad, yy - 1);
        } else {
          if (i > 0 && m.blocks[i - 1].kind !== 'detail') yy += 3;
          set(7, 'bold', COLORS.muted);
          doc.text(safe(b.d.label).toUpperCase(), x + pad, yy - 0.5);
          set(8.5, 'normal', b.d.muted ? COLORS.muted : COLORS.text);
          doc.text(b.lines, x + pad + labelW, yy);
        }
        yy += b.h;
      });
    };

    for (let i = 0; i < list.length; i += 2) {
      const a = measure(list[i]);
      const b = list[i + 1] ? measure(list[i + 1]) : null;
      const rowH = Math.max(a.h, b ? b.h : 0);
      if (y + rowH > bottom && y > top + 20) newPage(true);
      drawCard(a, M, y, rowH);
      if (b) drawCard(b, M + cw + gap, y, rowH);
      y += rowH + gap;
    }
  }

  // ----- List -----
  if (o.layout === 'list') {
    const leftW = 165;
    const gap = 14;
    const rightX = M + leftW + gap;
    const rightW = W - M - rightX;
    const labelW = 52;
    let lastLetter: string | null = null;

    for (const c of list) {
      const nm = nameFor(c, o.sort);
      const letterSrc = o.sort === 'company' ? c.company || nm : nm;
      const letter = (safe(letterSrc).trim()[0] || '#').toUpperCase();

      set(10.5, 'bold');
      const nameL = wrap(nm, leftW);
      set(8.5, 'italic');
      const subL = subLine(c, o) ? wrap(subLine(c, o), leftW) : [];
      set(9, 'normal');
      const details = detailLines(c, o).map((d) => ({ d, lines: wrap(d.text, rightW - labelW) }));
      const leftH = nameL.length * 13 + subL.length * 11;
      const rightH = details.reduce((s, x) => s + x.lines.length * 11.5 + 2, 0);
      const h = Math.max(leftH, rightH) + 10;
      const headH = letter !== lastLetter && o.sort !== 'company' ? 22 : 0;

      if (y + h + headH > bottom) newPage(true);
      if (headH) {
        set(12, 'bold', COLORS.accent);
        doc.text(/[A-Z]/.test(letter) ? letter : '#', M, y + 12);
        y += headH;
        lastLetter = letter;
      }

      set(10.5, 'bold');
      doc.text(nameL, M, y + 9);
      if (subL.length) {
        set(8.5, 'italic', COLORS.muted);
        doc.text(subL, M, y + 9 + nameL.length * 13);
      }
      let yy = y + 9;
      for (const { d, lines } of details) {
        set(7, 'bold', COLORS.muted);
        doc.text(safe(d.label).toUpperCase(), rightX, yy - 0.5);
        set(9, 'normal', d.muted ? COLORS.muted : COLORS.text);
        doc.text(lines, rightX + labelW, yy);
        yy += lines.length * 11.5 + 2;
      }
      y += h;
      doc.setDrawColor(...COLORS.line);
      doc.setLineWidth(0.5);
      doc.line(M, y - 4, W - M, y - 4);
      y += 4;
    }
  }

  // ----- Table -----
  if (o.layout === 'table') {
    type Col = { key: string; title: string; w: number; x?: number; width?: number };
    const cols: Col[] = [{ key: 'name', title: 'Name', w: 1.3 }];
    if (o.f_phones) cols.push({ key: 'phone', title: 'Phone', w: 1 });
    if (o.f_emails) cols.push({ key: 'email', title: 'Email', w: 1.3 });
    if (o.f_address) cols.push({ key: 'address', title: 'Address', w: 1.4 });
    if (o.f_birthday) cols.push({ key: 'birthday', title: 'Birthday', w: 0.6 });
    if (o.f_tags) cols.push({ key: 'tags', title: 'Tags', w: 0.8 });
    if (o.f_notes) cols.push({ key: 'notes', title: 'Notes', w: 1.2 });
    const total = cols.reduce((s, c) => s + c.w, 0);
    const avail = W - 2 * M;
    let x = M;
    for (const col of cols) {
      col.x = x;
      col.width = (col.w / total) * avail;
      x += col.width;
    }
    const cp = 4;
    const fs = 8;
    const lh = 10;

    const headerRow = () => {
      doc.setFillColor(...COLORS.accent);
      doc.rect(M, y, avail, 16, 'F');
      set(8, 'bold', [255, 255, 255]);
      for (const col of cols) doc.text(col.title, (col.x || 0) + cp, y + 11);
      y += 16;
    };

    const cellText = (c: Contact, key: string) => {
      switch (key) {
        case 'name':
          return { main: nameFor(c, o.sort), sub: subLine(c, o) };
        case 'phone':
          return {
            main: c.phones
              .slice(0, 3)
              .map((p) => `${p.value}${c.phones.length > 1 ? ` (${p.label[0]})` : ''}`)
              .join('\n'),
          };
        case 'email':
          return { main: c.emails.slice(0, 2).map((e) => e.value).join('\n') };
        case 'address':
          return { main: c.address };
        case 'birthday':
          return { main: c.birthday };
        case 'tags':
          return { main: c.tags.join(', ') };
        case 'notes':
          return { main: c.notes };
      }
      return { main: '' };
    };

    headerRow();
    list.forEach((c, idx) => {
      const cells = cols.map((col) => {
        const t = cellText(c, col.key);
        set(fs, col.key === 'name' ? 'bold' : 'normal');
        const main = t.main ? wrap(t.main, (col.width || 0) - 2 * cp) : [];
        set(fs - 1, 'italic');
        const sub = 'sub' in t && t.sub ? wrap(t.sub, (col.width || 0) - 2 * cp) : [];
        return { col, main, sub };
      });
      const rowH = Math.max(...cells.map((x) => x.main.length * lh + x.sub.length * (lh - 1))) + 2 * cp + 1;
      if (y + rowH > bottom) {
        newPage(true);
        headerRow();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(...COLORS.fill);
        doc.rect(M, y, avail, rowH, 'F');
      }
      for (const { col, main, sub } of cells) {
        set(fs, col.key === 'name' ? 'bold' : 'normal');
        if (main.length) doc.text(main, (col.x || 0) + cp, y + cp + 7);
        if (sub.length) {
          set(fs - 1, 'italic', COLORS.muted);
          doc.text(sub, (col.x || 0) + cp, y + cp + 7 + main.length * lh);
        }
      }
      doc.setDrawColor(...COLORS.line);
      doc.setLineWidth(0.4);
      doc.line(M, y + rowH, W - M, y + rowH);
      y += rowH;
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (o.cover && i === 1) continue;
    set(8, 'normal', COLORS.muted);
    doc.text(`Page ${i} of ${pages}`, W - M, H - M + 14, { align: 'right' });
    doc.text(title, M, H - M + 14);
  }

  return doc.output('blob');
}

export async function shareOrDownloadPdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch {
      /* user cancelled or share failed — fall through */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
