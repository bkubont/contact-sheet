import { useEffect, useState } from 'react';
import { ContactsScreen } from './screens/ContactsScreen';
import { DirectoriesScreen } from './screens/DirectoriesScreen';
import { MenuSheet } from './components/MenuSheet';
import { Sync, type SyncStatus } from './lib/sync';

type Tab = 'contacts' | 'directories';

export default function App() {
  const [tab, setTab] = useState<Tab>('contacts');
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(Sync.status);

  useEffect(() => {
    const off = Sync.onStatus(setSyncStatus);
    return () => {
      off();
    };
  }, []);

  const showDot = Sync.enabled && !!Sync.user;
  const dotClass =
    syncStatus.state === 'error'
      ? 'error'
      : syncStatus.state === 'syncing' || syncStatus.state === 'offline'
        ? 'syncing'
        : '';

  return (
    <div className="app-shell">
      {tab === 'contacts' ? (
        <ContactsScreen
          onOpenMenu={() => setMenuOpen(true)}
          syncDot={showDot ? dotClass || 'ok' : null}
        />
      ) : (
        <DirectoriesScreen />
      )}

      <nav className="tabbar" aria-label="Main">
        <button
          type="button"
          className={`tab${tab === 'contacts' ? ' on' : ''}`}
          onClick={() => setTab('contacts')}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3.5 19c1.5-3.5 4-5 5.5-5s4 1.5 5.5 5" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M14.5 19c.6-1.8 1.7-2.8 2.5-2.8.8 0 1.9 1 2.5 2.8" />
          </svg>
          Contacts
        </button>
        <button
          type="button"
          className={`tab${tab === 'directories' ? ' on' : ''}`}
          onClick={() => setTab('directories')}
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          Directories
        </button>
      </nav>

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
