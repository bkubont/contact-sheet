/* Contact storage.
 * Contacts always live on this device (localStorage) so the app works offline.
 * Every local change is also recorded in `pending` so js/sync.js can push it to
 * the user's cloud account when they are signed in.
 */
(function () {
  const KEY = 'contactSheet.contacts.v1';
  const META_KEY = 'contactSheet.sync.v1';

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Could not read', key, e);
      return fallback;
    }
  }

  let contacts = read(KEY, []);
  // owner: account id these contacts belong to (null = not signed in)
  // pending: { [id]: changeTimestamp } — local changes not yet uploaded
  // cursor: newest server timestamp already downloaded
  let meta = Object.assign({ owner: null, pending: {}, cursor: null }, read(META_KEY, {}));

  const listeners = new Set();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(contacts));
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch (e) {
      alert('Could not save — this device may be out of storage space.\n\n' + e.message);
      return false;
    }
  }

  // Save after a user edit: remember what changed so it can be synced.
  function commit(changedIds) {
    const now = Date.now();
    for (const id of changedIds) meta.pending[id] = now;
    persist();
    listeners.forEach((fn) => { try { fn(changedIds); } catch (e) { console.error(e); } });
  }

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
      commit([n.id]);
      return n;
    },
    remove(id) {
      contacts = contacts.filter((c) => c.id !== id);
      commit([id]);
    },
    addMany(list, { skipDupes = true, tag = '' } = {}) {
      const seen = new Set(contacts.map(dupeKey));
      const ids = [];
      let skipped = 0;
      for (const raw of list) {
        const c = normalize({ ...raw, id: undefined });
        if (tag && !c.tags.includes(tag)) c.tags.push(tag);
        const k = dupeKey(c);
        if (skipDupes && seen.has(k)) { skipped++; continue; }
        seen.add(k);
        contacts.push(c);
        ids.push(c.id);
      }
      commit(ids);
      return { added: ids.length, skipped };
    },
    replaceAll(list) {
      const before = contacts.map((c) => c.id);
      contacts = list.map((c) => ({ ...normalize(c), created: c.created || Date.now() }));
      commit([...new Set([...before, ...contacts.map((c) => c.id)])]);
    },
    tagCounts() {
      const m = new Map();
      for (const c of contacts) for (const t of c.tags) m.set(t, (m.get(t) || 0) + 1);
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
    },
    renameTag(from, to) {
      to = to.trim();
      const ids = [];
      for (const c of contacts) {
        if (c.tags.includes(from)) {
          c.tags = [...new Set(c.tags.map((t) => (t === from ? to : t)).filter(Boolean))];
          c.updated = Date.now();
          ids.push(c.id);
        }
      }
      commit(ids);
    },
    bulkTag(ids, tag, add) {
      const set = new Set(ids);
      const changed = [];
      for (const c of contacts) {
        if (!set.has(c.id)) continue;
        const had = c.tags.includes(tag);
        if (add && !had) c.tags.push(tag);
        else if (!add && had) c.tags = c.tags.filter((t) => t !== tag);
        else continue;
        c.updated = Date.now();
        changed.push(c.id);
      }
      commit(changed);
    },
    displayName,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // ---- used by sync ----
    get owner() { return meta.owner; },
    get cursor() { return meta.cursor; },
    pendingChanges() {
      // [{ id, stamp, contact|null }]  null contact = deleted
      return Object.entries(meta.pending).map(([id, stamp]) => ({ id, stamp, contact: this.get(id) || null }));
    },
    markUploaded(done) {
      for (const { id, stamp } of done) if (meta.pending[id] === stamp) delete meta.pending[id];
      persist();
    },
    markAllPending() {
      const now = Date.now();
      for (const c of contacts) meta.pending[c.id] = now;
      persist();
    },
    // Apply rows downloaded from the server. Local edits not yet uploaded win.
    applyRemote(rows, cursor) {
      let changed = 0;
      for (const r of rows) {
        if (meta.pending[r.id]) continue;
        const i = contacts.findIndex((c) => c.id === r.id);
        if (r.deleted) {
          if (i >= 0) { contacts.splice(i, 1); changed++; }
        } else {
          const c = { ...normalize({ ...r.data, id: r.id }), created: r.data.created, updated: r.data.updated };
          if (i >= 0) contacts[i] = c; else contacts.push(c);
          changed++;
        }
      }
      if (cursor) meta.cursor = cursor;
      persist();
      return changed;
    },
    // Switch this device to a (different) account, or to signed-out.
    resetForOwner(owner, { keepContacts = false } = {}) {
      if (!keepContacts) contacts = [];
      meta = { owner, pending: {}, cursor: null };
      if (keepContacts) for (const c of contacts) meta.pending[c.id] = Date.now();
      persist();
    },
  };
})();
