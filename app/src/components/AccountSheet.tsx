import { useEffect, useState, type FormEvent } from 'react';
import { Sync, type SyncStatus } from '../lib/sync';
import { toast } from '../lib/util';
import { askConfirm, notify } from '../lib/dialogs';
import { Sheet } from './Sheet';

function statusText(s: SyncStatus) {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Up to date';
    case 'offline':
      return s.message || 'Offline';
    case 'error':
      return s.message || 'Sync error';
    case 'signed-out':
      return 'Signed out';
    default:
      return '';
  }
}

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState(Sync.status);
  const [, bump] = useState(0);
  const [mode, setMode] = useState<'signin' | 'signup' | 'recovery'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const off = Sync.onStatus((s) => setStatus(s));
    return () => {
      off();
    };
  }, []);
  useEffect(() => {
    const onRecovery = () => {
      setMode('recovery');
      setAuthOpen(true);
      setMsg('Choose a new password.');
      setOk(true);
    };
    // The link may have opened before this screen was shown.
    if (Sync.takeRecovery()) onRecovery();
    const onEvent = () => {
      Sync.takeRecovery();
      onRecovery();
    };
    window.addEventListener('password-recovery', onEvent);
    return () => window.removeEventListener('password-recovery', onEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    bump((n) => n + 1);
  }, [open]);

  if (!Sync.enabled) {
    return (
      <Sheet open={open} title="Account" onClose={onClose}>
        <p className="muted">
          Accounts are optional. To turn them on, create a free Supabase project, run{' '}
          <code>supabase/schema.sql</code>, and set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> when building the app.
        </p>
      </Sheet>
    );
  }

  const user = Sync.user;

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(false);
    if (!email.trim() && mode !== 'recovery') {
      setMsg('Enter your email.');
      return;
    }
    if (password.length < 6 && mode !== 'signin') {
      /* sign-in also needs length but server validates */
    }
    if (password.length < 6) {
      setMsg('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'recovery') {
        const r = await Sync.setPassword(password);
        if (r.error) setMsg(r.error);
        else {
          toast('Password updated');
          setAuthOpen(false);
          onClose();
        }
        return;
      }
      if (mode === 'signup') {
        const r = await Sync.signUp(email.trim(), password);
        if (r.error) setMsg(r.error);
        else if (r.needsConfirm) {
          setMsg('Check your email for a confirmation link, then sign in.');
          setOk(true);
        } else {
          toast('Account created');
          setAuthOpen(false);
          onClose();
        }
        return;
      }
      const r = await Sync.signIn(email.trim(), password);
      if (r.error) setMsg(r.error);
      else {
        toast('Signed in');
        setAuthOpen(false);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setMsg('Type your email above first, then tap Forgot password.');
      return;
    }
    setBusy(true);
    const r = await Sync.resetPassword(email.trim());
    setBusy(false);
    if (r.error) setMsg(r.error);
    else {
      setMsg('Check your email for a link to choose a new password.');
      setOk(true);
    }
  }

  return (
    <>
      <Sheet open={open && !authOpen} title="Account" onClose={onClose}>
        {!user ? (
          <>
            <p>
              <b>Use your contacts on any device.</b>
              <br />
              <span className="muted">
                Sign in and your contacts and directories sync to your account — they still work offline on this
                device.
              </span>
            </p>
            <button
              type="button"
              className="btn primary wide"
              onClick={() => {
                setMode('signin');
                setMsg('');
                setAuthOpen(true);
              }}
            >
              Sign in or create account
            </button>
          </>
        ) : (
          <>
            <p>
              Signed in as <b>{user.email}</b>
              <br />
              <span className="muted">{statusText(status)}</span>
            </p>
            <div className="grid2">
              <button type="button" className="btn" onClick={() => Sync.syncNow()}>
                Sync now
              </button>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const ok = await askConfirm({
                    title: 'Sign out?',
                    message: 'Your contacts stay safe in your account. They’re removed from this device until you sign in again.',
                    confirmLabel: 'Sign out',
                  });
                  if (!ok) return;
                  const r = await Sync.signOut();
                  if (r.error) {
                    await notify({ title: 'Couldn’t sign out', message: r.error });
                    return;
                  }
                  toast('Signed out');
                  onClose();
                }}
              >
                Sign out
              </button>
            </div>
            <button
              type="button"
              className="btn danger wide"
              onClick={async () => {
                const ok = await askConfirm({
                  title: 'Delete your Contact Sheet data?',
                  message: `Every contact and list saved for ${user.email} in the cloud is erased, on all your devices, and you’re signed out. Your login stays, because it’s shared with Canopy Estimate. This can’t be undone.`,
                  confirmLabel: 'Delete my data',
                  danger: true,
                  typeToConfirm: 'DELETE',
                });
                if (!ok) return;
                const r = await Sync.deleteCloudData();
                if (r.error) await notify({ title: 'Couldn’t delete your data', message: r.error });
                else {
                  toast('Your Contact Sheet data has been deleted');
                  onClose();
                }
              }}
            >
              Delete my Contact Sheet data
            </button>
          </>
        )}
      </Sheet>

      <Sheet
        open={authOpen}
        title={mode === 'signup' ? 'Create account' : mode === 'recovery' ? 'New password' : 'Sign in'}
        onClose={() => setAuthOpen(false)}
      >
        <form onSubmit={submitAuth} className="sheet-body" style={{ padding: 0, display: 'grid', gap: 12 }}>
          {mode !== 'recovery' && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signup' || mode === 'recovery' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {msg && <p className={ok ? 'muted' : ''} style={{ color: ok ? 'var(--accent)' : 'var(--danger)', margin: 0 }}>{msg}</p>}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {mode === 'signup' ? 'Create account' : mode === 'recovery' ? 'Save password' : 'Sign in'}
          </button>
          {mode !== 'recovery' && (
            <div style={{ display: 'grid', gap: 4 }}>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setMsg('');
                }}
              >
                {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create an account'}
              </button>
              {mode === 'signin' && (
                <button type="button" className="link" onClick={forgot} disabled={busy}>
                  Forgot password?
                </button>
              )}
            </div>
          )}
        </form>
      </Sheet>
    </>
  );
}
