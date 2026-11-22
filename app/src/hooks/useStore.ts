import { useSyncExternalStore } from 'react';
import { Store } from '../lib/store';
import type { Db } from '../types';

export function useDb(): Db {
  return useSyncExternalStore(Store.subscribe, Store.getSnapshot, Store.getSnapshot);
}
