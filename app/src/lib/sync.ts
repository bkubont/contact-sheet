import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { APP_CONFIG, syncConfigured } from './config';
import { DIRS_SYNC_ID, Store } from './store';

const TABLE = 'contacts';
const PAGE = 1000;
const OVERLAP_MS = 60 * 1000;

export type SyncStatus = {
  state: 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';
  message: string;
  at?: number;
};

type StatusListener = (s: SyncStatus) => void;

const listeners = new Set<StatusListener>();
let client: SupabaseClient | null = null;
let session: Session | null = null;
let status: SyncStatus = { state: syncConfigured ? 'signed-out' : 'disabled', message: '' };
let syncing = false;
let again = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let started = false;

function setStatus(state: SyncStatus['state'], message = '') {
  status = { state, message, at: Date.now() };
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {
      console.error(e);
    }
  });
}

const appUrl = () => location.origin + location.pathname;

async function push() {
  if (!client || !session) return 0;
  const changes = Store.pendingChanges();
  for (let i = 0; i < changes.length; i += 500) {
    const chunk = changes.slice(i, i + 500);
    const rows = chunk.map(({ id, contact, directories }) => {
      if (id === DIRS_SYNC_ID) {
        return {
          user_id: session!.user.id,
          id,
          data: { directories: directories || [] },
          deleted: false,
        };
      }
      return {
        user_id: session!.user.id,
        id,
        data: contact || {},
        deleted: !contact,
      };
    });
    const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
    Store.markUploaded(chunk);
  }
  return changes.length;
}

async function pull() {
  if (!client) return 0;
  const since = Store.cursor
    ? new Date(new Date(Store.cursor).getTime() - OVERLAP_MS).toISOString()
    : '1970-01-01T00:00:00Z';
  let from = 0;
  let changed = 0;
  let newest = Store.cursor;
  for (;;) {
    const { data, error } = await client
      .from(TABLE)
      .select('id,data,deleted,updated_at')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data) break;
    if (data.length) {
      const last = data[data.length - 1].updated_at as string;
      newest = last > (newest || '') ? last : newest;
    }
    changed += Store.applyRemote(data, newest);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return changed;
}

async function syncNow() {
  if (!syncConfigured || !session) return;
  if (syncing) {
    again = true;
    return;
  }
  if (!navigator.onLine) {
    setStatus('offline', 'Offline — changes will sync when you reconnect');
    return;
  }
  syncing = true;
  setStatus('syncing');
  try {
    do {
      again = false;
      await push();
      await pull();
    } while (again);
    setStatus('synced');
  } catch (err) {
    console.error('Sync failed', err);
    setStatus('error', (err as Error).message || String(err));
  } finally {
    syncing = false;
  }
}

function scheduleSync(delay = 1200) {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    void syncNow();
  }, delay);
}

async function adoptSession(s: Session | null) {
  const prevUser = session?.user.id;
  session = s;
  if (!s) {
    setStatus('signed-out');
    return;
  }
  if (prevUser === s.user.id && Store.owner === s.user.id) return;

  if (Store.owner !== s.user.id) {
    const localCount = Store.all().length + Store.directories().length;
    if (Store.owner === null && localCount > 0) {
      const keep = confirm(
        `Add the data on this device (${Store.all().length} contact${Store.all().length === 1 ? '' : 's'}, ${Store.directories().length} director${Store.directories().length === 1 ? 'y' : 'ies'}) to your account (${s.user.email})?\n\nChoose Cancel to remove it from this device and only use what’s saved in your account.`,
      );
      Store.resetForOwner(s.user.id, { keepContacts: keep });
    } else {
      Store.resetForOwner(s.user.id);
    }
  }
  await syncNow();
}

function friendly(error: { message?: string } | null | undefined) {
  if (!error) return '';
  const m = error.message || String(error);
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox for the link.';
  if (/already registered/i.test(m)) return 'There is already an account with that email. Try signing in.';
  if (/password should be at least/i.test(m)) return 'Password must be at least 6 characters.';
  if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
  return m;
}

export function startSync() {
  if (started || !syncConfigured) return;
  started = true;
  client = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  client.auth.onAuthStateChange((event, s) => {
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') window.dispatchEvent(new CustomEvent('password-recovery'));
      if (event === 'SIGNED_OUT') {
        session = null;
        setStatus('signed-out');
        return;
      }
      void adoptSession(s);
    }, 0);
  });

  Store.subscribe(() => scheduleSync());
  window.addEventListener('online', () => scheduleSync(200));
  window.addEventListener('offline', () => {
    if (session) setStatus('offline', 'Offline — changes will sync when you reconnect');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(200);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 60 * 1000);
}

export const Sync = {
  enabled: syncConfigured,
  get user(): User | null {
    return session?.user ?? null;
  },
  get status() {
    return status;
  },
  onStatus(fn: StatusListener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  syncNow,
  startSync,

  async signIn(email: string, password: string) {
    if (!client) return { error: 'Accounts are not configured.' };
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: friendly(error) };
  },
  async signUp(email: string, password: string) {
    if (!client) return { error: 'Accounts are not configured.' };
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: appUrl() },
    });
    if (error) return { error: friendly(error) };
    return { needsConfirm: !data.session };
  },
  async resetPassword(email: string) {
    if (!client) return { error: 'Accounts are not configured.' };
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    return { error: friendly(error) };
  },
  async setPassword(password: string) {
    if (!client) return { error: 'Accounts are not configured.' };
    const { error } = await client.auth.updateUser({ password });
    return { error: friendly(error) };
  },
  async signOut() {
    if (!client) return;
    await syncNow();
    await client.auth.signOut();
    session = null;
    Store.resetForOwner(null);
    setStatus('signed-out');
  },
  async deleteAccount() {
    if (!client) return { error: 'Accounts are not configured.' };
    const { error } = await client.rpc('delete_my_account');
    if (error) return { error: friendly(error) };
    await client.auth.signOut().catch(() => {});
    session = null;
    Store.resetForOwner(null);
    setStatus('signed-out');
    return {};
  },
};
