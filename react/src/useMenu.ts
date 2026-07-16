import { useCallback, useEffect, useRef, useState } from 'react';
import { getMenu } from './api/client';
import type { MenuItem } from './types';

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bumped on every load() call and never reset, so it is strictly
  // monotonic: a settled request only writes state if its captured
  // generation still matches, so a stale response (one superseded by
  // a later reload) can never clobber fresher state. Because the value is
  // never rewound (no sentinel reset on unmount), no generation number is
  // ever reused — including across React 18 StrictMode's dev-only
  // mount -> cleanup -> remount cycle, which reuses the same ref instance.
  const generationRef = useRef(0);
  // Tracks actual mount state, separately from the generation counter, so
  // a request settling after a real unmount is a no-op without having to
  // overload the counter (and without risking generation reuse).
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    getMenu()
      .then((m) => { if (mountedRef.current && generationRef.current === generation) setMenu(m); })
      .catch((e) => { if (mountedRef.current && generationRef.current === generation) setError(e.message || 'Could not load the menu.'); })
      .finally(() => { if (mountedRef.current && generationRef.current === generation) setLoading(false); });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
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
