/* eslint-disable */
// vCard + CSV contact-file parsers (ported from the prototype, where they were tested).
import type { Customer } from '../types';
import { uid } from './util';

type Raw = { first: string; last: string; company: string; title?: string; phones: { label: string; value: string }[]; emails: { label: string; value: string }[]; address: string; birthday?: string; notes: string; tags: string[] };

// ---------- vCard ----------

function decodeQP(str: string, charset?: string) {
  const bytes: number[] = [];
  const s = str.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) {
      bytes.push(parseInt(s.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(new Uint8Array(bytes));
  } catch (e) {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
}

function unescapeV(s: string) {
  return s.replace(/\\([nN,;\\])/g, (m, ch) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

function splitUnescaped(s: string, sep: string) {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) { cur += s[i] + s[i + 1]; i++; continue; }
    if (s[i] === sep) { out.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

function cleanLabel(l: string) {
  if (!l) return '';
  l = l.replace(/^_\$!<(.*)>!\$_$/, '$1').trim().toLowerCase();
  return l;
}

function telLabel(types: string[]) {
  const t = types.map((x) => x.toLowerCase());
  if (t.includes('cell') || t.includes('iphone') || t.includes('mobile')) return 'mobile';
  if (t.includes('fax')) return 'fax';
  if (t.includes('pager')) return 'pager';
  if (t.includes('work')) return 'work';
  if (t.includes('home')) return 'home';
  if (t.includes('main')) return 'main';
  return 'other';
}

function emailLabel(types: string[]) {
  const t = types.map((x) => x.toLowerCase());
  if (t.includes('work')) return 'work';
  if (t.includes('home')) return 'home';
  return 'other';
}

function parseLine(line: string): any {
  // [group.]NAME[;PARAMS]:VALUE   — find first ':' outside quotes
  let inQ = false, idx = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQ = !inQ;
    else if (line[i] === ':' && !inQ) { idx = i; break; }
  }
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  let value = line.slice(idx + 1);
  const parts = head.split(';');
  let name = parts.shift() || '';
  let group = '';
  if (name.includes('.')) { [group, name] = [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.') + 1)]; }
  name = name.toUpperCase();
  const params: any = { types: [] };
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) { params.types.push(p); continue; }
    const k = p.slice(0, eq).toUpperCase();
    const v = p.slice(eq + 1).replace(/^"|"$/g, '');
    if (k === 'TYPE') params.types.push(...v.split(','));
    else params[k] = v;
  }
  if ((params.ENCODING || '').toUpperCase() === 'QUOTED-PRINTABLE') value = decodeQP(value, params.CHARSET);
  return { group, name, params, value };
}

function formatAdr(value: string) {
  const [pobox, ext, street, city, region, postal, country] = splitUnescaped(value, ';').map((x) => unescapeV(x).trim());
  const line1 = [pobox, ext, street].filter(Boolean).join(', ');
  const line2 = [city, [region, postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, line2, country].filter(Boolean).join('\n');
}

function parseVCard(text: string): Raw[] {
  // Unfold: continuation lines start with space or tab. Also join QP soft breaks.
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];
  for (const l of rawLines) {
    if ((l.startsWith(' ') || l.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += l.slice(1);
    } else if (lines.length && /ENCODING=QUOTED-PRINTABLE/i.test(lines[lines.length - 1]) && lines[lines.length - 1].endsWith('=')) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + l;
    } else {
      lines.push(l);
    }
  }

  const out: Raw[] = [];
  let cur: any = null, groupLabels: Record<string, string> = {}, pending: any[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN' && p.value.toUpperCase().trim() === 'VCARD') {
      cur = { first: '', last: '', fn: '', company: '', title: '', phones: [], emails: [], address: '', birthday: '', notes: '', tags: [] };
      groupLabels = {}; pending = [];
      continue;
    }
    if (!cur) continue;
    if (p.name === 'END') {
      for (const item of pending) {
        if (item.group && groupLabels[item.group]) item.entry.label = groupLabels[item.group];
      }
      if (!cur.first && !cur.last && cur.fn) {
        const bits = cur.fn.split(/\s+/);
        cur.last = bits.length > 1 ? bits.pop() : '';
        cur.first = bits.join(' ');
      }
      delete cur.fn;
      out.push(cur);
      cur = null;
      continue;
    }
    const v = p.value;
    switch (p.name) {
      case 'N': {
        const [last, first, middle] = splitUnescaped(v, ';').map((x) => unescapeV(x).trim());
        cur.last = last || '';
        cur.first = [first, middle].filter(Boolean).join(' ');
        break;
      }
      case 'FN': cur.fn = unescapeV(v).trim(); break;
      case 'ORG': {
        const [org, dept] = splitUnescaped(v, ';').map((x) => unescapeV(x).trim());
        cur.company = [org, dept].filter(Boolean).join(' – ');
        break;
      }
      case 'TITLE': cur.title = unescapeV(v).trim(); break;
      case 'TEL': {
        const entry = { label: telLabel(p.params.types), value: unescapeV(v).replace(/^tel:/i, '').trim() };
        cur.phones.push(entry); pending.push({ group: p.group, entry });
        break;
      }
      case 'EMAIL': {
        const entry = { label: emailLabel(p.params.types), value: unescapeV(v).replace(/^mailto:/i, '').trim() };
        cur.emails.push(entry); pending.push({ group: p.group, entry });
        break;
      }
      case 'ADR': if (!cur.address) cur.address = formatAdr(v); break;
      case 'BDAY': cur.birthday = v.trim(); break;
      case 'NOTE': cur.notes = unescapeV(v).trim(); break;
      case 'CATEGORIES': cur.tags.push(...splitUnescaped(v, ',').map((x) => unescapeV(x).trim()).filter(Boolean)); break;
      case 'X-ABLABEL': if (p.group) groupLabels[p.group] = cleanLabel(unescapeV(v)); break;
    }
  }
  return out;
}

// ---------- CSV ----------

function parseCSVRows(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function splitMulti(v: string) {
  return v.split(/\s*:::\s*/).map((x) => x.trim()).filter(Boolean);
}

function labelFromHeader(h: string) {
  if (/mobile|cell/.test(h)) return 'mobile';
  if (/business|work|company/.test(h)) return 'work';
  if (/home|personal/.test(h)) return 'home';
  if (/fax/.test(h)) return 'fax';
  if (/main|primary/.test(h)) return 'main';
  return 'other';
}

function parseCSV(text: string): Raw[] {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const out: Raw[] = [];
  for (const r of rows.slice(1)) {
    const c: Raw = { first: '', last: '', company: '', title: '', phones: [], emails: [], address: '', birthday: '', notes: '', tags: [] };
    let full = '', middle = '';
    const adrParts: Record<string, any> = {};
    headers.forEach((h, i) => {
      const v = (r[i] || '').trim();
      if (!v) return;
      let m: RegExpMatchArray | null;
      if (/^(first name|given name|first|firstname)$/.test(h)) c.first = v;
      else if (/^(middle name|additional name)$/.test(h)) middle = v;
      else if (/^(last name|family name|surname|last|lastname)$/.test(h)) c.last = v;
      else if (/^(name|full name|display name|contact name)$/.test(h)) full = v;
      else if (/^(organization name|organization 1 - name|company|organization|business|company name)$/.test(h)) c.company = v;
      else if (/^(organization title|organization 1 - title|job title|title|position)$/.test(h)) c.title = v;
      else if ((m = h.match(/^phone (\d+) - value$/))) {
        const label = (r[headers.indexOf(`phone ${m[1]} - label`)] || r[headers.indexOf(`phone ${m[1]} - type`)] || '').trim();
        for (const val of splitMulti(v)) c.phones.push({ label: labelFromHeader(label.toLowerCase()) , value: val });
      } else if ((m = h.match(/^e-?mail (\d+) - value$/))) {
        const label = (r[headers.indexOf(`e-mail ${m[1]} - label`)] || r[headers.indexOf(`e-mail ${m[1]} - type`)] || '').trim();
        for (const val of splitMulti(v)) c.emails.push({ label: labelFromHeader(label.toLowerCase()), value: val });
      } else if (/(phone|mobile|tel)/.test(h) && !/(label|type)/.test(h)) {
        for (const val of splitMulti(v)) c.phones.push({ label: labelFromHeader(h), value: val });
      } else if (/e-?mail/.test(h) && !/(label|type|display|name)/.test(h)) {
        for (const val of splitMulti(v)) c.emails.push({ label: labelFromHeader(h), value: val });
      } else if (/^address \d+ - formatted$/.test(h) || /^(address|full address|mailing address)$/.test(h)) {
        if (!c.address) c.address = v;
      } else if ((m = h.match(/^(home|business|other) (street|city|state|postal code|country\/region|country)$/))) {
        (adrParts[m[1]] = adrParts[m[1]] || {})[m[2].split(/[ /]/)[0]] = v;
      } else if (/^(labels|categories|group membership|tags|groups)$/.test(h)) {
        c.tags.push(...v.split(/\s*(?::::|;|,)\s*/).map((x) => x.trim()).filter((x) => x && !x.startsWith('*')));
      } else if (/^notes?$/.test(h)) c.notes = v;
      else if (/^(birthday|birth date|date of birth)$/.test(h)) c.birthday = v;
    });
    if (middle) c.first = [c.first, middle].filter(Boolean).join(' ');
    if (!c.first && !c.last && full) {
      const bits = full.split(/\s+/);
      c.last = bits.length > 1 ? bits.pop() || '' : '';
      c.first = bits.join(' ');
    }
    if (!c.address) {
      const a = adrParts.home || adrParts.business || adrParts.other;
      if (a) {
        c.address = [a.street, [a.city, [a.state, a.postal].filter(Boolean).join(' ')].filter(Boolean).join(', '), a.country]
          .filter(Boolean).join('\n');
      }
    }
    if (c.first || c.last || c.company || c.phones.length || c.emails.length) out.push(c);
  }
  return out;
}


function toCustomer(r: Raw): Customer {
  const now = Date.now();
  const notes = [r.title ? `Title: ${r.title}` : '', r.birthday ? `Birthday: ${r.birthday}` : '', r.notes, r.tags.length ? `Groups: ${r.tags.join(', ')}` : '']
    .filter(Boolean).join('\n');
  return {
    id: uid(), first: r.first, last: r.last, company: r.company,
    phones: r.phones, emails: r.emails,
    properties: r.address ? [{ id: uid(), address: r.address.replace(/\n/g, ', '), gateCode: '', access: '', hazards: [], treeNotes: '' }] : [],
    tagIds: [], notes, createdAt: now, updatedAt: now,
  };
}

export function parseContactFile(text: string, filename: string): Customer[] {
  const isV = /\.(vcf|vcard)$/i.test(filename) || /BEGIN:VCARD/i.test(text.slice(0, 2000));
  return (isV ? parseVCard(text) : parseCSV(text)).map(toCustomer);
}
