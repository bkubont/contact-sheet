/* Contact storage: everything lives in this device's localStorage. */
(function () {
  const KEY = 'contactSheet.contacts.v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalize(c) {
    const clean = (s) => (s == null ? '' : String(s)).trim();
    const list = (arr) => (Array.isArray(arr) ? arr : [])
      .map((x) => ({ label: clean(x.label) || 'other', value: clean(x.value) }))
      .filter((x) => x.value);
    const tags = [...new Set((c.tags || []).map(clean).filter(Boolean))];
    return {
      id: c.id || uid(),
      first: clean(c.first),
      last: clean(c.last),
      company: clean(c.company),
      title: clean(c.title),
      phones: list(c.phones),
      emails: list(c.emails),
      address: clean(c.address),
      birthday: clean(c.birthday),
      notes: clean(c.notes),
      tags,
      created: c.created || Date.now(),
      updated: Date.now(),
    };
  }

  let contacts = [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) contacts = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read saved contacts', e);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(contacts));
      return true;
    } catch (e) {
      alert('Could not save — this device may be out of storage space.\n\n' + e.message);
      return false;
    }
  }

  // Ask the browser not to evict our data.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  function displayName(c) {
    const n = [c.first, c.last].filter(Boolean).join(' ');
    return n || c.company || (c.emails[0] && c.emails[0].value) || (c.phones[0] && c.phones[0].value) || 'No name';
  }

  function dupeKey(c) {
    const name = [c.first, c.last].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    const phone = c.phones[0] ? c.phones[0].value.replace(/\D/g, '').slice(-10) : '';
    const email = c.emails[0] ? c.emails[0].value.toLowerCase() : '';
    return name + '|' + (phone || email || c.company.toLowerCase());
  }

  window.Store = {
    all: () => contacts,
    get: (id) => contacts.find((c) => c.id === id),
    upsert(c) {
      const n = normalize(c);
      const i = contacts.findIndex((x) => x.id === n.id);
      if (i >= 0) { n.created = contacts[i].created; contacts[i] = n; } else contacts.push(n);
      save();
      return n;
    },
    remove(id) {
      contacts = contacts.filter((c) => c.id !== id);
      save();
    },
    addMany(list, { skipDupes = true, tag = '' } = {}) {
      const seen = new Set(contacts.map(dupeKey));
      let added = 0, skipped = 0;
      for (const raw of list) {
        const c = normalize({ ...raw, id: undefined });
        if (tag && !c.tags.includes(tag)) c.tags.push(tag);
        const k = dupeKey(c);
        if (skipDupes && seen.has(k)) { skipped++; continue; }
        seen.add(k);
        contacts.push(c);
        added++;
      }
      save();
      return { added, skipped };
    },
    replaceAll(list) {
      contacts = list.map((c) => ({ ...normalize(c), created: c.created || Date.now() }));
      save();
    },
    tagCounts() {
      const m = new Map();
      for (const c of contacts) for (const t of c.tags) m.set(t, (m.get(t) || 0) + 1);
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
    },
    renameTag(from, to) {
      to = to.trim();
      for (const c of contacts) {
        if (c.tags.includes(from)) {
          c.tags = [...new Set(c.tags.map((t) => (t === from ? to : t)).filter(Boolean))];
        }
      }
      save();
    },
    bulkTag(ids, tag, add) {
      const set = new Set(ids);
      for (const c of contacts) {
        if (!set.has(c.id)) continue;
        if (add && !c.tags.includes(tag)) c.tags.push(tag);
        if (!add) c.tags = c.tags.filter((t) => t !== tag);
        c.updated = Date.now();
      }
      save();
    },
    displayName,
  };
})();
