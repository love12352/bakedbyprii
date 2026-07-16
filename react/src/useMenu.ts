import { useCallback, useEffect, useRef, useState } from 'react';
import { getMenu } from './api/client';
import type { MenuItem } from './types';

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bumped on every load() call; a settled request only writes state if its
  // captured generation still matches, so a stale response (one superseded by
  // a later reload) can never clobber fresher state. Also doubles as the
  // unmount guard: set to -1 (a value no in-flight request captured) on cleanup.
  const generationRef = useRef(0);

  const load = useCallback(() => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    getMenu()
      .then((m) => { if (generationRef.current === generation) setMenu(m); })
      .catch((e) => { if (generationRef.current === generation) setError(e.message || 'Could not load the menu.'); })
      .finally(() => { if (generationRef.current === generation) setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    return () => { generationRef.current = -1; };
  }, [load]);

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
