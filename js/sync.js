/* Accounts + cloud sync (Supabase).
 * If js/config.js has no Supabase project filled in, this stays switched off and the
 * app works purely on-device, exactly as before.
 */
(function () {
  const cfg = window.APP_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const TABLE = 'contacts';
  const PAGE = 1000;
  const OVERLAP_MS = 60 * 1000; // re-read the last minute each pull so no row is missed

  const listeners = new Set();
  let client = null;
  let session = null;
  let status = { state: enabled ? 'signed-out' : 'disabled', message: '' };
  let syncing = false, again = false, debounce = null, timer = null;

  function setStatus(state, message = '') {
    status = { state, message, at: Date.now() };
    listeners.forEach((fn) => { try { fn(status); } catch (e) { console.error(e); } });
  }

  const appUrl = () => location.origin + location.pathname;

  async function push() {
    const changes = Store.pendingChanges();
    for (let i = 0; i < changes.length; i += 500) {
      const chunk = changes.slice(i, i + 500);
      const rows = chunk.map(({ id, contact }) => ({
        user_id: session.user.id,
        id,
        data: contact || {},
        deleted: !contact,
      }));
      const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      Store.markUploaded(chunk);
    }
    return changes.length;
  }

  async function pull() {
    const since = Store.cursor ? new Date(new Date(Store.cursor).getTime() - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z';
    let from = 0, changed = 0, newest = Store.cursor;
    for (;;) {
      const { data, error } = await client.from(TABLE)
        .select('id,data,deleted,updated_at')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (data.length) newest = data[data.length - 1].updated_at > (newest || '') ? data[data.length - 1].updated_at : newest;
      changed += Store.applyRemote(data, newest);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return changed;
  }

  async function syncNow() {
    if (!enabled || !session) return;
    if (syncing) { again = true; return; }
    if (!navigator.onLine) { setStatus('offline', 'Offline — changes will sync when you reconnect'); return; }
    syncing = true;
    setStatus('syncing');
    try {
      do {
        again = false;
        await push();
        const changed = await pull();
        if (changed) window.dispatchEvent(new CustomEvent('contacts-synced'));
      } while (again);
      setStatus('synced');
    } catch (err) {
      console.error('Sync failed', err);
      setStatus('error', err.message || String(err));
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(delay = 1200) {
    clearTimeout(debounce);
    debounce = setTimeout(syncNow, delay);
  }

  // Called whenever we learn who (if anyone) is signed in.
  async function adoptSession(s) {
    const prevUser = session && session.user.id;
    session = s;
    if (!s) {
      setStatus('signed-out');
      return;
    }
    if (prevUser === s.user.id && Store.owner === s.user.id) return; // token refresh etc.

    if (Store.owner !== s.user.id) {
      const localCount = Store.all().length;
      if (Store.owner === null && localCount > 0) {
        // Contacts were added on this device before signing in.
        const keep = confirm(`Add the ${localCount} contact${localCount === 1 ? '' : 's'} on this device to your account (${s.user.email})?\n\nChoose Cancel to remove them from this device and only use the contacts saved in your account.`);
        Store.resetForOwner(s.user.id, { keepContacts: keep });
      } else {
        // Different account than last time (or first sign-in): start clean.
        Store.resetForOwner(s.user.id);
      }
      window.dispatchEvent(new CustomEvent('contacts-synced'));
    }
    await syncNow();
  }

  if (enabled) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    client.auth.onAuthStateChange((event, s) => {
      // Defer: supabase-js recommends not awaiting other calls inside this callback.
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') window.dispatchEvent(new CustomEvent('password-recovery'));
        if (event === 'SIGNED_OUT') { session = null; setStatus('signed-out'); return; }
        adoptSession(s);
      }, 0);
    });

    Store.onChange(() => scheduleSync());
    window.addEventListener('online', () => scheduleSync(200));
    window.addEventListener('offline', () => session && setStatus('offline', 'Offline — changes will sync when you reconnect'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(200); });
    timer = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60 * 1000);
  }

  function friendly(error) {
    if (!error) return '';
    const m = error.message || String(error);
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox for the link.';
    if (/already registered/i.test(m)) return 'There is already an account with that email. Try signing in.';
    if (/password should be at least/i.test(m)) return 'Password must be at least 6 characters.';
    if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
    return m;
  }

  window.Sync = {
    enabled,
    get user() { return session ? session.user : null; },
    get status() { return status; },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    syncNow,

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: friendly(error) };
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
      if (error) return { error: friendly(error) };
      // If email confirmation is on, there is no session until they click the link.
      return { needsConfirm: !data.session };
    },
    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
      return { error: friendly(error) };
    },
    async setPassword(password) {
      const { error } = await client.auth.updateUser({ password });
      return { error: friendly(error) };
    },
    async signOut() {
      await syncNow(); // don't lose last-second edits
      await client.auth.signOut();
      session = null;
      Store.resetForOwner(null); // leave nothing behind on a shared device
      setStatus('signed-out');
      window.dispatchEvent(new CustomEvent('contacts-synced'));
    },
    async deleteAccount() {
      const { error } = await client.rpc('delete_my_account');
      if (error) return { error: friendly(error) };
      await client.auth.signOut().catch(() => {});
      session = null;
      Store.resetForOwner(null);
      setStatus('signed-out');
      window.dispatchEvent(new CustomEvent('contacts-synced'));
      return {};
    },
  };
})();
