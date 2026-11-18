import { useCallback, useEffect, useState } from 'react';
import type { Customer } from './types';
import { ConfirmHost, ToastHost } from './lib/ui';
import People from './screens/People';
import CustomerView from './screens/CustomerView';
import EditCustomer from './screens/EditCustomer';
import Today from './screens/Today';
import More from './screens/More';
import { Soon } from './screens/Soon';

export type Tab = 'today' | 'people' | 'lists' | 'calendar' | 'more';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'people', label: 'People' },
  { id: 'lists', label: 'Lists' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'more', label: 'More' },
];

// Routes live in the URL hash so the phone's back gesture works: #people, #c-<id>
function parse(): { tab: Tab; customerId?: string } {
  const h = location.hash.replace(/^#/, '');
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
    screen = <Soon title="Calendar" heading="Job calendar is next" text="Estimates and jobs on one calendar with day and week views, crew and equipment, multi-day jobs, double-booking warnings, and drag to schedule. Coming in milestone 2." />;
  } else {
    screen = <Soon title="Lists" heading="Smart lists are coming" text="Saved searches like “Estimates going cold” and “Annual trim due” that keep themselves up to date. Coming in milestone 4. For now, filter by stage on the People tab." />;
  }

  return (
    <div className="app">
      {screen}
      {!route.customerId && route.tab !== 'more' && (
        <button className="fab" aria-label="Add customer" onClick={() => setEditing(null)}>+</button>
      )}
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={route.tab === t.id && !route.customerId ? 'on' : ''} onClick={() => go(t.id)}>{t.label}</button>
        ))}
      </nav>
      {editing !== undefined && (
        <EditCustomer
          customer={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(c, isNew) => { setEditing(undefined); if (isNew) openCustomer(c.id); }}
        />
      )}
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
