/* UI wiring for Contact Sheet. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const SEL_KEY = 'contactSheet.selected.v1';
  const PDF_KEY = 'contactSheet.pdfOptions.v1';
  const UNTAGGED = '\u0000untagged';

  const state = {
    query: '',
    tag: null,
    selected: new Set(loadJSON(SEL_KEY, [])),
    visibleIds: [],
  };

  function loadJSON(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; }
  }
  function saveSel() {
    try { localStorage.setItem(SEL_KEY, JSON.stringify([...state.selected])); } catch {}
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- List ----------

  function sortKey(c) {
    return (c.last || c.first || c.company || Store.displayName(c)).toLowerCase();
  }

  function matches(c, q) {
    if (!q) return true;
    const hay = [c.first, c.last, c.company, c.title, c.address, c.notes, c.birthday, ...c.tags,
      ...c.emails.map((e) => e.value), ...c.phones.map((p) => p.value)].join(' ').toLowerCase();
    const digits = q.replace(/\D/g, '');
    return q.split(/\s+/).every((w) => hay.includes(w)) ||
      (digits.length >= 3 && c.phones.some((p) => p.value.replace(/\D/g, '').includes(digits)));
  }

  function render() {
    const all = Store.all();
    // Drop selections for contacts that no longer exist.
    for (const id of state.selected) if (!Store.get(id)) state.selected.delete(id);

    renderChips();

    const q = state.query.trim().toLowerCase();
    const shown = all
      .filter((c) => (state.tag === null ? true : state.tag === UNTAGGED ? !c.tags.length : c.tags.includes(state.tag)))
      .filter((c) => matches(c, q))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    state.visibleIds = shown.map((c) => c.id);

    $('#countLabel').textContent = all.length ? (shown.length === all.length ? all.length : `${shown.length} of ${all.length}`) : '';
    $('#empty').hidden = all.length > 0;

    const groups = new Map();
    for (const c of shown) {
      let L = sortKey(c).normalize('NFD')[0]?.toUpperCase() || '#';
      if (!/[A-Z]/.test(L)) L = '#';
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(c);
    }

    let html = '';
    if (all.length && !shown.length) html = '<p class="muted" style="text-align:center;padding:40px 0">No matches.</p>';
    for (const [L, list] of groups) {
      html += `<div class="group-head">${L}</div><div class="group">`;
      for (const c of list) {
        const sel = state.selected.has(c.id);
        const name = c.first || c.last
          ? `${esc(c.first)} <span class="last">${esc(c.last)}</span>`
          : `<span class="last">${esc(Store.displayName(c))}</span>`;
        const sub = [c.company && (c.first || c.last) ? c.company : '', c.phones[0]?.value, !c.phones.length ? c.emails[0]?.value : '']
          .filter(Boolean).join(' · ');
        const pills = c.tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('');
        html += `<div class="row${sel ? ' sel' : ''}" data-id="${c.id}">
          <button class="pick" aria-label="Select ${esc(Store.displayName(c))}" aria-pressed="${sel}"><i></i></button>
          <button class="body">
            <div class="name">${name}</div>
            ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
            ${pills ? `<div class="pills">${pills}</div>` : ''}
          </button>
        </div>`;
      }
      html += '</div>';
    }
    $('#list').innerHTML = html;
    renderSelbar();
  }

  function renderChips() {
    const counts = Store.tagCounts();
    if (state.tag && state.tag !== UNTAGGED && !counts.some(([t]) => t === state.tag)) state.tag = null;
    const untagged = Store.all().filter((c) => !c.tags.length).length;
    let html = `<button class="chip${state.tag === null ? ' on' : ''}" data-tag="">All</button>`;
    for (const [t, n] of counts) {
      html += `<button class="chip${state.tag === t ? ' on' : ''}" data-tag="${esc(t)}">${esc(t)}<span class="n">${n}</span></button>`;
    }
    if (counts.length && untagged) {
      html += `<button class="chip${state.tag === UNTAGGED ? ' on' : ''}" data-tag="${UNTAGGED}">Untagged<span class="n">${untagged}</span></button>`;
    }
    $('#tagChips').innerHTML = html;
    $('#tagChips').hidden = Store.all().length === 0;
    $('#allTagsList').innerHTML = counts.map(([t]) => `<option value="${esc(t)}">`).join('');
  }

  function renderSelbar() {
    const n = state.selected.size;
    $('#selbar').hidden = Store.all().length === 0;
    $('#selCount').textContent = n;
    $('#selClear').hidden = n === 0;
    $('#selAll').hidden = state.visibleIds.length === 0 || state.visibleIds.every((id) => state.selected.has(id));
    $('#selAll').textContent = state.visibleIds.length === Store.all().length ? 'Select all' : `Select all ${state.visibleIds.length} shown`;
    $('#selTag').disabled = n === 0;
    $('#selPdf').disabled = n === 0;
  }

  $('#tagChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const t = b.dataset.tag;
    state.tag = t === '' ? null : (state.tag === t ? null : t);
    render();
    window.scrollTo({ top: 0 });
  });

  $('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });

  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.pick')) {
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      saveSel();
      row.classList.toggle('sel', state.selected.has(id));
      row.querySelector('.pick').setAttribute('aria-pressed', state.selected.has(id));
      renderSelbar();
    } else if (e.target.closest('.body')) {
      openEditor(Store.get(id));
    }
  });

  $('#selAll').addEventListener('click', () => {
    state.visibleIds.forEach((id) => state.selected.add(id));
    saveSel(); render();
  });
  $('#selClear').addEventListener('click', () => { state.selected.clear(); saveSel(); render(); });

  // Keep sticky letter headings just under the top bar.
  const topbar = $('.topbar');
  const setHeadH = () => document.documentElement.style.setProperty('--head-h', topbar.offsetHeight + 'px');
  new ResizeObserver(setHeadH).observe(topbar);

  // ---------- Dialog helpers ----------

  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) d.close();
      if (e.target === d && d.classList.contains('small')) d.close(); // tap backdrop
    });
  });

  // ---------- Editor ----------

  const PHONE_LABELS = ['mobile', 'home', 'work', 'main', 'fax', 'other'];
  const EMAIL_LABELS = ['home', 'work', 'other'];
  let editing = null;
  let editTags = [];

  function multiRow(kind, labels, item = { label: labels[0], value: '' }) {
    const opts = [...new Set([...labels, item.label])].map((l) => `<option${l === item.label ? ' selected' : ''}>${esc(l)}</option>`).join('');
    const type = kind === 'phone' ? 'tel' : 'email';
    const div = document.createElement('div');
    div.className = 'mrow';
    div.innerHTML = `<select aria-label="${kind} label">${opts}</select>
      <input type="${type}" value="${esc(item.value)}" placeholder="${kind === 'phone' ? 'Phone number' : 'name@example.com'}" ${type === 'email' ? 'autocapitalize="off"' : ''}>
      <button type="button" class="rm" aria-label="Remove">−</button>`;
    div.querySelector('.rm').onclick = () => div.remove();
    return div;
  }

  function readMulti(container) {
    return $$('.mrow', container).map((r) => ({ label: $('select', r).value, value: $('input', r).value.trim() })).filter((x) => x.value);
  }

  function renderTagEditor() {
    $('#tagPills').innerHTML = editTags.map((t, i) => `<button type="button" class="pill x" data-i="${i}">${esc(t)}</button>`).join('');
    const q = $('#tagInput').value.trim().toLowerCase();
    const sugg = Store.tagCounts().map(([t]) => t).filter((t) => !editTags.includes(t) && (!q || t.toLowerCase().includes(q))).slice(0, 12);
    $('#tagSuggest').innerHTML = sugg.map((t) => `<button type="button" data-t="${esc(t)}">+ ${esc(t)}</button>`).join('');
  }

  function addEditTag(t) {
    t = t.trim().replace(/,$/, '').trim();
    if (t && !editTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      const existing = Store.tagCounts().find(([x]) => x.toLowerCase() === t.toLowerCase());
      editTags.push(existing ? existing[0] : t);
    }
    $('#tagInput').value = '';
    renderTagEditor();
  }

  $('#tagPills').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { editTags.splice(+b.dataset.i, 1); renderTagEditor(); }
  });
  $('#tagSuggest').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) addEditTag(b.dataset.t);
  });
  $('#tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEditTag(e.target.value); }
    if (e.key === 'Backspace' && !e.target.value && editTags.length) { editTags.pop(); renderTagEditor(); }
  });
  $('#tagInput').addEventListener('input', renderTagEditor);
  $('#tagInput').addEventListener('blur', (e) => { if (e.target.value.trim()) addEditTag(e.target.value); });

  $('#addPhone').onclick = () => { const r = multiRow('phone', PHONE_LABELS); $('#phoneRows').append(r); $('input', r).focus(); };
  $('#addEmail').onclick = () => { const r = multiRow('email', EMAIL_LABELS); $('#emailRows').append(r); $('input', r).focus(); };

  function openEditor(c) {
    editing = c || null;
    const f = $('#editForm');
    f.reset();
    $('#editTitle').textContent = c ? 'Edit contact' : 'New contact';
    for (const k of ['first', 'last', 'company', 'title', 'address', 'birthday', 'notes']) f.elements[k].value = c ? c[k] : '';
    $('#phoneRows').innerHTML = '';
    $('#emailRows').innerHTML = '';
    (c && c.phones.length ? c.phones : [undefined]).forEach((p) => $('#phoneRows').append(multiRow('phone', PHONE_LABELS, p)));
    (c && c.emails.length ? c.emails : [undefined]).forEach((p) => $('#emailRows').append(multiRow('email', EMAIL_LABELS, p)));
    editTags = c ? [...c.tags] : (state.tag && state.tag !== UNTAGGED ? [state.tag] : []);
    $('#tagInput').value = '';
    renderTagEditor();
    $('#deleteBtn').hidden = !c;
    $('#editDlg').showModal();
    $('#editDlg .sheet-body').scrollTop = 0;
    if (!c) setTimeout(() => f.elements.first.focus(), 50);
  }

  $('#editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if ($('#tagInput').value.trim()) addEditTag($('#tagInput').value);
    const data = {
      ...(editing || {}),
      first: f.elements.first.value,
      last: f.elements.last.value,
      company: f.elements.company.value,
      title: f.elements.title.value,
      address: f.elements.address.value,
      birthday: f.elements.birthday.value,
      notes: f.elements.notes.value,
      phones: readMulti($('#phoneRows')),
      emails: readMulti($('#emailRows')),
      tags: editTags,
    };
    if (![data.first, data.last, data.company].some((x) => x.trim()) && !data.phones.length && !data.emails.length) {
      toast('Add a name, company, phone or email first.');
      return;
    }
    const saved = Store.upsert(data);
    $('#editDlg').close();
    render();
    toast(editing ? 'Saved' : `Added ${Store.displayName(saved)}`);
  });

  $('#deleteBtn').addEventListener('click', () => {
    if (!editing) return;
    if (!confirm(`Delete ${Store.displayName(editing)}?`)) return;
    Store.remove(editing.id);
    state.selected.delete(editing.id);
    saveSel();
    $('#editDlg').close();
    render();
    toast('Deleted');
  });

  $('#addBtn').onclick = () => openEditor(null);
  $('#emptyAdd').onclick = () => openEditor(null);

  // ---------- Bulk tag ----------

  $('#selTag').onclick = () => {
    $('#bulkTagForm').reset();
    $('#bulkTagInfo').textContent = `Add or remove a tag on ${state.selected.size} selected contact${state.selected.size === 1 ? '' : 's'}.`;
    $('#bulkTagDlg').showModal();
  };
  $('#bulkTagForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let tag = $('#bulkTagInput').value.trim();
    if (!tag) return;
    const existing = Store.tagCounts().find(([x]) => x.toLowerCase() === tag.toLowerCase());
    if (existing) tag = existing[0];
    const add = (e.submitter && e.submitter.value) !== 'remove';
    Store.bulkTag([...state.selected], tag, add);
    $('#bulkTagDlg').close();
    render();
    toast(`${add ? 'Tagged' : 'Removed tag from'} ${state.selected.size} contact${state.selected.size === 1 ? '' : 's'}`);
  });

  // ---------- PDF ----------

  let pdfBlob = null, pdfName = 'contacts.pdf', pdfUrl = null;

  $('#selPdf').onclick = () => {
    const f = $('#pdfForm');
    const saved = loadJSON(PDF_KEY, null);
    if (saved) {
      for (const [k, v] of Object.entries(saved)) {
        const el = f.elements[k];
        if (!el) continue;
        if (el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === v; }
        else if (el.type === 'checkbox') el.checked = !!v;
        else el.value = v;
      }
    }
    const n = state.selected.size;
    $('#pdfSummary').textContent = `${n} contact${n === 1 ? '' : 's'} selected.`;
    $('#pdfDlg').showModal();
  };

  $('#pdfForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const o = {
      title: f.elements.title.value.trim() || 'Contact Sheet',
      layout: f.elements.layout.value,
      sort: f.elements.sort.value,
      paper: f.elements.paper.value,
    };
    for (const el of f.elements) if (el.type === 'checkbox') o[el.name] = el.checked;
    try { localStorage.setItem(PDF_KEY, JSON.stringify(o)); } catch {}

    const chosen = [...state.selected].map(Store.get).filter(Boolean);
    try {
      pdfBlob = PDFMaker.make(chosen, o);
    } catch (err) {
      console.error(err);
      alert('Sorry, the PDF could not be created.\n\n' + err.message);
      return;
    }
    pdfName = (o.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'contacts') + '.pdf';
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(pdfBlob);
    $('#pdfDlg').close();
    $('#pdfReadyInfo').textContent = `${pdfName} · ${chosen.length} contact${chosen.length === 1 ? '' : 's'} · ${Math.max(1, Math.round(pdfBlob.size / 1024))} KB`;
    const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], pdfName, { type: 'application/pdf' })] }));
    $('#pdfShare').hidden = !canShareFile;
    $('#pdfReadyDlg').showModal();
  });

  $('#pdfShare').onclick = async () => {
    try {
      await navigator.share({ files: [new File([pdfBlob], pdfName, { type: 'application/pdf' })], title: pdfName });
    } catch (err) {
      if (err.name !== 'AbortError') toast('Sharing failed — try Open PDF instead.');
    }
  };
  $('#pdfOpen').onclick = () => { window.open(pdfUrl, '_blank'); };
  $('#pdfDownload').onclick = () => downloadBlob(pdfBlob, pdfName);

  // ---------- Files ----------

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  async function saveFile(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    downloadBlob(blob, name);
  }

  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- Menu ----------

  $('#menuBtn').onclick = () => $('#menuDlg').showModal();
  $('#mImport').onclick = () => { $('#menuDlg').close(); $('#fileImport').click(); };
  $('#emptyImport').onclick = () => $('#fileImport').click();

  let pendingImport = [];
  $('#fileImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try { text = await file.text(); } catch (err) { alert('Could not read that file.'); return; }
    pendingImport = Importers.parse(text, file.name);
    if (!pendingImport.length) {
      alert(`No contacts found in ${file.name}.\n\nUse a .vcf (vCard) or .csv export from your phone, Google Contacts or Outlook.`);
      return;
    }
    $('#importForm').reset();
    $('#importInfo').innerHTML = `Found <b>${pendingImport.length}</b> contact${pendingImport.length === 1 ? '' : 's'} in <b>${esc(file.name)}</b>.`;
    $('#importDlg').showModal();
  });

  $('#importForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const { added, skipped } = Store.addMany(pendingImport, { skipDupes: f.elements.skipDupes.checked, tag: f.elements.tag.value.trim() });
    pendingImport = [];
    $('#importDlg').close();
    render();
    toast(`Imported ${added}${skipped ? ` · skipped ${skipped} already here` : ''}`);
  });

  $('#mExportVcf').onclick = () => {
    if (!Store.all().length) return toast('No contacts to export.');
    saveFile(new Blob([Importers.toVCard(Store.all())], { type: 'text/vcard' }), `contacts-${today()}.vcf`);
  };

  $('#mBackup').onclick = () => {
    const data = { app: 'contact-sheet', version: 1, exported: new Date().toISOString(), contacts: Store.all() };
    saveFile(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `contact-sheet-backup-${today()}.json`);
  };

  $('#mRestore').onclick = () => { $('#menuDlg').close(); $('#fileRestore').click(); };
  $('#fileRestore').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.contacts;
      if (!Array.isArray(list)) throw new Error('Not a Contact Sheet backup');
      if (!confirm(`Replace your ${Store.all().length} current contacts with the ${list.length} in this backup?`)) return;
      Store.replaceAll(list);
      state.selected.clear(); saveSel();
      render();
      toast(`Restored ${list.length} contacts`);
    } catch (err) {
      alert('That file is not a valid backup.\n\n' + err.message);
    }
  });

  $('#mWipe').onclick = () => {
    const n = Store.all().length;
    if (!n) return toast('Nothing to delete.');
    const where = Sync.user ? 'from your account on every device' : 'from this app';
    if (!confirm(`Delete all ${n} contacts ${where}? (Your phone's own Contacts app is not affected.)`)) return;
    if (!confirm('Are you sure? Consider making a backup first.')) return;
    Store.replaceAll([]);
    state.selected.clear(); saveSel();
    $('#menuDlg').close();
    render();
  };

  // ---------- Manage tags ----------

  function renderTagsDlg() {
    const counts = Store.tagCounts();
    $('#tagsList').innerHTML = counts.length
      ? counts.map(([t, n]) => `<div class="tagrow" data-t="${esc(t)}">
          <span class="tname">${esc(t)}</span><span class="n">${n}</span>
          <button class="link" data-a="select">Select</button>
          <button class="link" data-a="rename">Rename</button>
          <button class="link" data-a="delete" style="color:var(--danger)">Delete</button>
        </div>`).join('')
      : '<p class="muted">No tags yet. Open a contact and add one, or select several contacts and tap “Tag…”.</p>';
  }
  $('#mTags').onclick = () => { $('#menuDlg').close(); renderTagsDlg(); $('#tagsDlg').showModal(); };
  $('#tagsList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const t = b.closest('.tagrow').dataset.t;
    const ids = Store.all().filter((c) => c.tags.includes(t)).map((c) => c.id);
    if (b.dataset.a === 'select') {
      ids.forEach((id) => state.selected.add(id)); saveSel();
      $('#tagsDlg').close(); render();
      toast(`Selected ${ids.length} tagged “${t}”`);
    } else if (b.dataset.a === 'rename') {
      const to = prompt(`Rename tag “${t}” to:`, t);
      if (to && to.trim() && to.trim() !== t) {
        Store.renameTag(t, to.trim());
        if (state.tag === t) state.tag = to.trim();
        renderTagsDlg(); render();
      }
    } else if (b.dataset.a === 'delete') {
      if (confirm(`Remove tag “${t}” from ${ids.length} contact${ids.length === 1 ? '' : 's'}? The contacts stay.`)) {
        Store.bulkTag(ids, t, false);
        renderTagsDlg(); render();
      }
    }
  });

  // ---------- Account & sync ----------

  window.addEventListener('contacts-synced', () => render());

  function statusText(s) {
    switch (s.state) {
      case 'syncing': return 'Syncing…';
      case 'synced': return `All changes saved · ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      case 'offline': return s.message;
      case 'error': return `Couldn't sync: ${s.message}`;
      default: return '';
    }
  }

  function renderAccount() {
    if (!Sync.enabled) return;
    const u = Sync.user;
    $('#accountBox').hidden = false;
    $('#accountOut').hidden = !!u;
    $('#accountIn').hidden = !u;
    $('#mDeleteAccount').hidden = !u;
    $('#accountEmail').textContent = u ? u.email : '';
    $('#accountStatus').textContent = statusText(Sync.status);
    $('#syncDot').hidden = !u;
    $('#syncDot').className = 'sync-dot ' + Sync.status.state;
    $('#storageNote').textContent = u
      ? 'Your contacts are saved to your account and on this device, so they work offline too.'
      : 'Without an account your contacts are stored only on this device. Sign in to keep them safe and use them anywhere.';
  }
  Sync.onStatus(renderAccount);
  renderAccount();

  let authMode = 'signin';
  function setAuthMode(mode) {
    authMode = mode;
    const up = mode === 'signup';
    $('#authTitle').textContent = up ? 'Create account' : 'Sign in';
    $('#authSubmit').textContent = up ? 'Create account' : 'Sign in';
    $('#authToggle').textContent = up ? 'Have an account? Sign in' : 'New here? Create an account';
    $('#authForgot').hidden = up;
    $('#authForm').elements.password.autocomplete = up ? 'new-password' : 'current-password';
    authMsg('');
  }
  function authMsg(text, ok = false, el = '#authMsg') {
    $(el).hidden = !text;
    $(el).textContent = text;
    $(el).classList.toggle('ok', ok);
  }

  $('#mSignIn').onclick = () => {
    $('#menuDlg').close();
    $('#authForm').reset();
    setAuthMode('signin');
    $('#authDlg').showModal();
  };
  $('#authToggle').onclick = () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin');

  $('#authForgot').onclick = async () => {
    const email = $('#authForm').elements.email.value.trim();
    if (!email) return authMsg('Type your email above first, then tap “Forgot password?” again.');
    const { error } = await Sync.resetPassword(email);
    authMsg(error || 'Check your email for a link to choose a new password.', !error);
  };

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.elements.email.value.trim();
    const password = f.elements.password.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return authMsg('Please enter a valid email address.');
    if (password.length < 6) return authMsg('Password must be at least 6 characters.');
    $('#authSubmit').disabled = true;
    try {
      if (authMode === 'signup') {
        const r = await Sync.signUp(email, password);
        if (r.error) return authMsg(r.error);
        if (r.needsConfirm) {
          setAuthMode('signin');
          f.elements.email.value = email;
          return authMsg('Almost done — check your email and tap the confirmation link, then sign in here.', true);
        }
      } else {
        const r = await Sync.signIn(email, password);
        if (r.error) return authMsg(r.error);
      }
      $('#authDlg').close();
      toast(`Signed in as ${email}`);
    } finally {
      $('#authSubmit').disabled = false;
    }
  });

  window.addEventListener('password-recovery', () => {
    $('#newPwForm').reset();
    authMsg('', false, '#newPwMsg');
    $('#newPwDlg').showModal();
  });
  $('#newPwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = e.target.elements.password.value;
    if (pw.length < 6) return authMsg('Password must be at least 6 characters.', false, '#newPwMsg');
    const { error } = await Sync.setPassword(pw);
    if (error) return authMsg(error, false, '#newPwMsg');
    $('#newPwDlg').close();
    toast('Password updated');
  });

  $('#mSyncNow').onclick = () => Sync.syncNow();
  $('#mSignOut').onclick = async () => {
    if (!confirm('Sign out? Your contacts stay safe in your account and will be removed from this device until you sign in again.')) return;
    await Sync.signOut();
    state.selected.clear(); saveSel();
    $('#menuDlg').close();
    toast('Signed out');
  };
  $('#mDeleteAccount').onclick = async () => {
    const email = Sync.user && Sync.user.email;
    if (!confirm(`Permanently delete the account ${email} and every contact saved in it? This cannot be undone.`)) return;
    const typed = prompt('To confirm, type DELETE');
    if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
    const { error } = await Sync.deleteAccount();
    if (error) return alert('Could not delete the account.\n\n' + error);
    state.selected.clear(); saveSel();
    $('#menuDlg').close();
    toast('Your account has been deleted');
  };

  // ---------- Boot ----------

  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
})();
