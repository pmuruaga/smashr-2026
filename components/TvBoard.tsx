'use client';
/* Pantalla de Score pública (Smart TV / público). Sin login. Se actualiza sola por Realtime. */
import { useCallback, useEffect, useState } from 'react';
import Stage from './Stage';
import { fetchMatch, fetchOrg, fetchOrgBySlug, fetchOrgMatches, findNext, pickCourtMatch, watchOrg } from '@/lib/data';
import type { Match, Org } from '@/lib/model';

type Props = { matchId: string } | { orgSlug: string; eventSlug: string; courtSlug: string };

export default function TvBoard(props: Props) {
  const [org, setOrg] = useState<Org | null>(null);
  const [all, setAll] = useState<Match[]>([]);
  const [m, setM] = useState<Match | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [hint, setHint] = useState(true);
  const key = 'matchId' in props ? props.matchId : `${props.orgSlug}/${props.eventSlug}/${props.courtSlug}`;

  const load = useCallback(async () => {
    try {
      let o: Org | null;
      if ('matchId' in props) {
        const mm = await fetchMatch(props.matchId); if (!mm) { setState('missing'); return; }
        o = await fetchOrg(mm.orgId);
        const list = await fetchOrgMatches(o.id);
        setAll(list); setM(list.find(x => x.id === mm.id) || mm);
      } else {
        o = await fetchOrgBySlug(props.orgSlug); if (!o) { setState('missing'); return; }
        const list = await fetchOrgMatches(o.id);
        setAll(list);
        setM(pickCourtMatch(list.filter(x => x.eventSlug === props.eventSlug && x.courtSlug === props.courtSlug)));
      }
      setOrg(o); setState('ok');
    } catch { setState(s => (s === 'loading' ? 'missing' : s)); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!org) return; return watchOrg(org.id, () => { load(); }); }, [org?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]); // red de seguridad si se corta el wifi
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4000);
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { clearTimeout(t); lock?.release().catch(() => {}); };
  }, []);

  const full = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
  const empty = state === 'missing' ? 'Tablero no encontrado' : state === 'loading' ? 'Cargando…' : 'Sin partidos en esta cancha';

  return (
    <div className="tv-root" onClick={full} title="Tocá para pantalla completa">
      <Stage m={state === 'ok' ? m : null} org={org} next={m ? findNext(all, m) : null} fitHeight className="tv" emptyText={empty} />
      {hint && <div className="hintfs">Tocá la pantalla para verla completa</div>}
    </div>
  );
}
