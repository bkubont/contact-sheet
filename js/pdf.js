/* Builds a printable PDF from a list of contacts using jsPDF. */
(function () {
  const COLORS = {
    text: [28, 37, 38],
    muted: [107, 119, 120],
    line: [214, 211, 203],
    accent: [31, 94, 99],
    fill: [244, 243, 239],
  };

  // Built-in PDF fonts only cover Latin-1; swap/strip anything else so it doesn't print as garbage.
  function safe(s) {
    return String(s || '')
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...')
      .replace(/[   ]/g, ' ')
      .normalize('NFC')
      .replace(/[^\x00-\xFF]/g, '');
  }

  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  function sortContacts(list, sort) {
    const key = (c) => {
      if (sort === 'first') return [c.first || c.last || c.company, c.last];
      if (sort === 'company') return [c.company || '~', c.last, c.first];
      return [c.last || c.first || c.company, c.first];
    };
    return [...list].sort((a, b) => {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) {
        const r = (ka[i] || '').localeCompare(kb[i] || '', undefined, { sensitivity: 'base' });
        if (r) return r;
      }
      return 0;
    });
  }

  function nameFor(c, sort) {
    if (sort === 'last' && c.last && c.first) return `${c.last}, ${c.first}`;
    return Store.displayName(c);
  }

  // Each contact becomes a list of styled text segments; layouts decide where they go.
  function detailLines(c, o) {
    const lines = [];
    if (o.f_phones) for (const p of c.phones) lines.push({ label: cap(p.label), text: p.value });
    if (o.f_emails) for (const e of c.emails) lines.push({ label: e.label === 'work' ? 'Work email' : 'Email', text: e.value });
    if (o.f_address && c.address) lines.push({ label: 'Address', text: c.address });
    if (o.f_birthday && c.birthday) lines.push({ label: 'Birthday', text: c.birthday });
    if (o.f_tags && c.tags.length) lines.push({ label: 'Tags', text: c.tags.join(', '), muted: true });
    if (o.f_notes && c.notes) lines.push({ label: 'Notes', text: c.notes, muted: true });
    return lines;
  }

  function subLine(c, o) {
    if (!o.f_company) return '';
    return [c.title, c.company].filter(Boolean).join(', ');
  }

  function make(contacts, o) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: o.paper || 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const top = M + 34;
    const bottom = H - M - 10;
    const list = sortContacts(contacts, o.sort);
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const title = safe(o.title || 'Contact Sheet');

    const set = (size, style = 'normal', color = COLORS.text) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };
    const wrap = (text, width) => doc.splitTextToSize(safe(text), width);

    function pageHeader(first) {
      if (first) {
        set(20, 'bold', COLORS.accent);
        doc.text(title, M, M + 6);
        set(9, 'normal', COLORS.muted);
        doc.text(`${list.length} contact${list.length === 1 ? '' : 's'}  ·  ${dateStr}`, M, M + 22);
      } else {
        set(10, 'bold', COLORS.accent);
        doc.text(title, M, M + 6);
      }
      doc.setDrawColor(...COLORS.accent);
      doc.setLineWidth(1);
      doc.line(M, first ? M + 30 : M + 14, W - M, first ? M + 30 : M + 14);
    }
    let y;
    function newPage() {
      doc.addPage();
      pageHeader(false);
      y = M + 28;
    }
    pageHeader(true);
    y = top + 8;

    // ---------- Cards: two columns of boxed entries ----------
    if (o.layout === 'cards') {
      const gap = 12, pad = 9;
      const cw = (W - 2 * M - gap) / 2;
      const inner = cw - 2 * pad;
      const labelW = 54;

      const measure = (c) => {
        const blocks = [];
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

      const drawCard = (m, x, y0, h) => {
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
        if (y + rowH > bottom && y > top + 20) newPage();
        drawCard(a, M, y, rowH);
        if (b) drawCard(b, M + cw + gap, y, rowH);
        y += rowH + gap;
      }
    }

    // ---------- List: name on the left, details on the right, letter headings ----------
    if (o.layout === 'list') {
      const leftW = 165, gap = 14;
      const rightX = M + leftW + gap;
      const rightW = W - M - rightX;
      const labelW = 52;
      let lastLetter = null;

      for (const c of list) {
        const nm = nameFor(c, o.sort);
        const letterSrc = o.sort === 'company' ? (c.company || nm) : nm;
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

        if (y + h + headH > bottom) newPage();
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

    // ---------- Table: compact rows ----------
    if (o.layout === 'table') {
      const cols = [{ key: 'name', title: 'Name', w: 1.3 }];
      if (o.f_phones) cols.push({ key: 'phone', title: 'Phone', w: 1 });
      if (o.f_emails) cols.push({ key: 'email', title: 'Email', w: 1.3 });
      if (o.f_address) cols.push({ key: 'address', title: 'Address', w: 1.4 });
      if (o.f_birthday) cols.push({ key: 'birthday', title: 'Birthday', w: 0.6 });
      if (o.f_tags) cols.push({ key: 'tags', title: 'Tags', w: 0.8 });
      if (o.f_notes) cols.push({ key: 'notes', title: 'Notes', w: 1.2 });
      const total = cols.reduce((s, c) => s + c.w, 0);
      const avail = W - 2 * M;
      let x = M;
      for (const col of cols) { col.x = x; col.width = (col.w / total) * avail; x += col.width; }
      const cp = 4, fs = 8, lh = 10;

      const headerRow = () => {
        doc.setFillColor(...COLORS.accent);
        doc.rect(M, y, avail, 16, 'F');
        set(8, 'bold', [255, 255, 255]);
        for (const col of cols) doc.text(col.title, col.x + cp, y + 11);
        y += 16;
      };
      const cellText = (c, key) => {
        switch (key) {
          case 'name': {
            const sub = subLine(c, o);
            return { main: nameFor(c, o.sort), sub };
          }
          case 'phone': return { main: c.phones.slice(0, 3).map((p) => `${p.value}${c.phones.length > 1 ? ` (${p.label[0]})` : ''}`).join('\n') };
          case 'email': return { main: c.emails.slice(0, 2).map((e) => e.value).join('\n') };
          case 'address': return { main: c.address };
          case 'birthday': return { main: c.birthday };
          case 'tags': return { main: c.tags.join(', ') };
          case 'notes': return { main: c.notes };
        }
        return { main: '' };
      };

      headerRow();
      list.forEach((c, idx) => {
        const cells = cols.map((col) => {
          const t = cellText(c, col.key);
          set(fs, col.key === 'name' ? 'bold' : 'normal');
          const main = t.main ? wrap(t.main, col.width - 2 * cp) : [];
          set(fs - 1, 'italic');
          const sub = t.sub ? wrap(t.sub, col.width - 2 * cp) : [];
          return { col, main, sub };
        });
        const rowH = Math.max(...cells.map((x) => x.main.length * lh + x.sub.length * (lh - 1))) + 2 * cp + 1;
        if (y + rowH > bottom) { newPage(); headerRow(); }
        if (idx % 2 === 1) { doc.setFillColor(...COLORS.fill); doc.rect(M, y, avail, rowH, 'F'); }
        for (const { col, main, sub } of cells) {
          set(fs, col.key === 'name' ? 'bold' : 'normal');
          if (main.length) doc.text(main, col.x + cp, y + cp + 7);
          if (sub.length) {
            set(fs - 1, 'italic', COLORS.muted);
            doc.text(sub, col.x + cp, y + cp + 7 + main.length * lh);
          }
        }
        doc.setDrawColor(...COLORS.line);
        doc.setLineWidth(0.4);
        doc.line(M, y + rowH, W - M, y + rowH);
        y += rowH;
      });
    }

    // Footer with page numbers
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      set(8, 'normal', COLORS.muted);
      doc.text(`Page ${i} of ${pages}`, W - M, H - M + 14, { align: 'right' });
      doc.text(title, M, H - M + 14);
    }

    return doc.output('blob');
  }

  window.PDFMaker = { make, sortContacts };
})();
