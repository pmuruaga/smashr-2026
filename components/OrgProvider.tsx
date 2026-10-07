'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchOrg, watchOrg } from '@/lib/data';
import type { Org } from '@/lib/model';

const Ctx = createContext<{ org: Org; reload: () => Promise<void> } | null>(null);

export function OrgProvider({ initial, children }: { initial: Org; children: React.ReactNode }) {
  const [org, setOrg] = useState(initial);
  const reload = useCallback(async () => { setOrg(await fetchOrg(initial.id)); }, [initial.id]);
  useEffect(() => watchOrg(initial.id, () => { reload().catch(() => {}); }), [initial.id, reload]);
  return <Ctx.Provider value={{ org, reload }}>{children}</Ctx.Provider>;
}
export function useOrg() {
  const v = useContext(Ctx); if (!v) throw new Error('useOrg fuera de OrgProvider'); return v;
}
