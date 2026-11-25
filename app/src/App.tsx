import { useEffect, useState, type ReactNode } from 'react';
import { ContactsScreen } from './screens/ContactsScreen';
import { ListsScreen } from './screens/ListsScreen';
import { TagsScreen } from './screens/TagsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { InstallBanner } from './components/InstallBanner';
import { DialogHost } from './components/DialogHost';
import { Sync, type SyncStatus } from './lib/sync';

type Tab = 'contacts' | 'lists' | 'tags' | 'settings';

const TAB_KEY = 'contactSheet.tab.v1';
function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t === 'contacts' || t === 'lists' || t === 'tags' || t === 'settings') return t;
  } catch {
    /* private mode */
  }
  return 'contacts';
}

const ICONS: Record<Tab, ReactNode> = {
  contacts: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c1.5-3.5 4-5 5.5-5s4 1.5 5.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 19c.6-1.8 1.7-2.8 2.5-2.8.8 0 1.9 1 2.5 2.8" />
    </>
  ),
  lists: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  tags: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
};
const LABELS: Record<Tab, string> = { contacts: 'Contacts', lists: 'Lists', tags: 'Tags', settings: 'Settings' };

export default function App() {
  const [tab, setTabState] = useState<Tab>(() => (Sync.recoveryPending ? 'settings' : loadTab()));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(Sync.status);
  const [focusTag, setFocusTag] = useState<{ tag: string; at: number } | null>(null);

  useEffect(() => {
    const off = Sync.onStatus(setSyncStatus);
    // A password-reset link: go to Settings, where the account form asks for the new password.
    const onRecovery = () => setTab('settings');
    window.addEventListener('password-recovery', onRecovery);
    return () => {
      off();
      window.removeEventListener('password-recovery', onRecovery);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTab(t: Tab) {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* private mode */
    }
    window.scrollTo({ top: 0 });
  }

  // A sync problem shows as a dot on the Settings tab.
  const dot = Sync.enabled && Sync.user ? (syncStatus.state === 'error' ? 'error' : syncStatus.state === 'syncing' || syncStatus.state === 'offline' ? 'syncing' : '') : '';

  return (
    <div className="app-shell">
      <InstallBanner />
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-brand" aria-hidden="true">
          <span className="logo-tile" />
          Contact Sheet
        </div>
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <button key={t} type="button" className={`tab${tab === t ? ' on' : ''}`} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
            <span className="tab-icon">
              <svg viewBox="0 0 24 24">{ICONS[t]}</svg>
              {t === 'settings' && dot && <i className={`tab-dot ${dot}`} />}
            </span>
            {LABELS[t]}
          </button>
        ))}
      </nav>
      <div className="content">
        {tab === 'contacts' && <ContactsScreen focusTag={focusTag} onOpenSettings={() => setTab('settings')} />}
        {tab === 'lists' && <ListsScreen />}
        {tab === 'tags' && (
          <TagsScreen
            onShowTag={(t) => {
              setFocusTag({ tag: t, at: Date.now() });
              setTab('contacts');
            }}
          />
        )}
        {tab === 'settings' && <SettingsScreen />}
      </div>
      <DialogHost />
    </div>
  );
}
