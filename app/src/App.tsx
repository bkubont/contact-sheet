import { useCallback, useEffect, useState } from 'react';
import type { Customer } from './types';
import { ConfirmHost, ToastHost } from './lib/ui';
import People from './screens/People';
import CustomerView from './screens/CustomerView';
import EditCustomer from './screens/EditCustomer';
import Today from './screens/Today';
import More from './screens/More';
import Calendar from './screens/Calendar';
import { ListView, ListsIndex } from './screens/Lists';
import { JobEditorHost, editJob } from './screens/EditJob';
import { PdfHost } from './screens/PdfReady';

export type Tab = 'today' | 'people' | 'lists' | 'calendar' | 'more';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'people', label: 'People' },
  { id: 'lists', label: 'Lists' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'more', label: 'More' },
];

// Routes live in the URL hash so the phone's back gesture works: #people, #c-<id>
function parse(): { tab: Tab; customerId?: string; listId?: string } {
  const h = location.hash.replace(/^#/, '');
  if (h.startsWith('l-')) return { tab: 'lists', listId: h.slice(2) };
  if (h.startsWith('c-')) return { tab: 'people', customerId: h.slice(2) };
  if (TABS.some((t) => t.id === h)) return { tab: h as Tab };
  return { tab: 'today' };
}

export default function App() {
  const [route, setRoute] = useState(parse);
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined); // undefined = closed, null = new

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = useCallback((hash: string) => { location.hash = hash; }, []);
  const openCustomer = useCallback((id: string) => go(`c-${id}`), [go]);

  let screen;
  if (route.customerId) {
    screen = <CustomerView id={route.customerId} onBack={() => history.length > 1 ? history.back() : go('people')} onEdit={(c) => setEditing(c)} />;
  } else if (route.tab === 'people') {
    screen = <People onOpen={openCustomer} />;
  } else if (route.tab === 'today') {
    screen = <Today onOpen={openCustomer} onGo={go} />;
  } else if (route.tab === 'more') {
    screen = <More />;
  } else if (route.tab === 'calendar') {
    screen = <Calendar onOpenCustomer={openCustomer} />;
  } else if (route.listId) {
    screen = <ListView id={route.listId} onBack={() => go('lists')} onOpen={openCustomer} />;
  } else {
    screen = <ListsIndex onOpenList={(id) => go(`l-${id}`)} />;
  }

  return (
    <div className="app">
      {screen}
      {!route.customerId && !route.listId && route.tab !== 'more' && route.tab !== 'lists' && (
        <button className="fab" aria-label={route.tab === 'calendar' ? 'Schedule' : 'Add customer'} onClick={() => (route.tab === 'calendar' ? editJob({}) : setEditing(null))}>+</button>
      )}
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={route.tab === t.id && !route.customerId && !route.listId ? 'on' : ''} onClick={() => go(t.id)}>{t.label}</button>
        ))}
      </nav>
      {editing !== undefined && (
        <EditCustomer
          customer={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(c, isNew) => { setEditing(undefined); if (isNew) openCustomer(c.id); }}
        />
      )}
      <JobEditorHost />
      <PdfHost />
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
