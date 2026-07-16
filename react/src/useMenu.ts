import { useCallback, useEffect, useState } from 'react';
import { getMenu } from './api/client';
import type { MenuItem } from './types';

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMenu()
      .then((m) => setMenu(m))
      .catch((e) => setError(e.message || 'Could not load the menu.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { menu, error, loading, reload: load };
}

export function groupByCategory(menu: MenuItem[]): { category: string; items: MenuItem[] }[] {
  const groups: { category: string; items: MenuItem[] }[] = [];
  const index = new Map<string, MenuItem[]>();
  for (const item of menu) {
    if (!index.has(item.category)) {
      const items: MenuItem[] = [];
      index.set(item.category, items);
      groups.push({ category: item.category, items });
    }
    index.get(item.category)!.push(item);
  }
  return groups;
}
