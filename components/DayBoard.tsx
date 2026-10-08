'use client';
/* Resumen público del día: todos los partidos en juego, los de hoy terminados y los próximos, con mini tableros en vivo. */
import { useCallback, useEffect, useState } from 'react';
import { fetchOrgBySlug, fetchOrgMatches, watchOrg } from '@/lib/data';
import { pointLabels, currentServer } from '@/lib/scoring/engine';
import { teamName, FONT_PRESETS, type Match, type Org } from '@/lib/model';

const isToday = (ms: number | null | undefined) => {
  if (!ms) return false;
  const d = new Date(ms), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export function Mini({ m }: { m: Match }) {
  const st = m.state, lab = pointLabels(st), live = m.status === 'live' && !st.finished;
  const srv = currentServer(st);
  const n = st.sets.length;
  return (
    <a className={`day-card ${m.status}`} href={`/t/${m.id}`}>
      <div className="day-top">
        <span className="day-court">{m.court}</span>
        {live ? <span className="day-live">En vivo</span> : m.status === 'finished' ? <span className="day-done">Final</span> : <span className="day-sched">{m.scheduledAt ? m.scheduledAt + ' hs' : 'Programado'}</span>}
      </div>
      <div className="day-score" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${n},34px) ${live ? '52px' : '0px'}` }}>
        {[0, 1].map(k => (
          <div className="day-row" key={k} style={{ display: 'contents' }}>
            <div className={`day-tn ${st.winner === k ? 'win' : ''}`}>
              {live && st.startedAt && srv.team === k ? <i className="day-ball" title="Saca" /> : null}
              {teamName(m, k)}
            </div>
            {st.sets.map((s, i) => {
              const v = s.tb && s.tb.super ? s.tb.p[k] : s.g[k];
              const lose = s.winner !== null && s.winner !== k;
              return <div key={i} className={`day-set tnum ${lose ? 'lose' : ''} ${i === n - 1 && live ? 'cur' : ''}`}>{m.status === 'scheduled' ? '' : v}</div>;
            })}
            {live ? <div className="day-pt tnum">{lab[k]}</div> : <div />}
          </div>
        ))}
      </div>
      <div className="day-meta">{[m.round, m.cat].filter(Boolean).join(' · ')}</div>
    </a>
  );
}

export default function DayBoard({ orgSlug }: { orgSlug: string }) {
  const [org, setOrg] = useState<Org | null | undefined>(undefined);
  const [list, setList] = useState<Match[]>([]);
  const load = useCallback(async () => {
    const o = await fetchOrgBySlug(orgSlug); setOrg(o);
    if (o) setList(await fetchOrgMatches(o.id));
  }, [orgSlug]);
  useEffect(() => { load().catch(() => setOrg(null)); }, [load]);
  useEffect(() => { if (!org) return; return watchOrg(org.id, () => { load().catch(() => {}); }); }, [org?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => load().catch(() => {}), 60_000); return () => clearInterval(t); }, [load]);

  if (org === undefined) return <main className="day"><p className="day-empty">Cargando…</p></main>;
  if (org === null) return <main className="day"><p className="day-empty">No encontramos esta organización.</p></main>;

  const live = list.filter(m => m.status === 'live');
  const done = list.filter(m => m.status === 'finished' && isToday(m.state.endedAt));
  const next = list.filter(m => m.status === 'scheduled');
  const f = FONT_PRESETS[org.brand.font] || FONT_PRESETS.broadcast;
  const vars = { ['--accent' as string]: org.brand.accent, ['--display' as string]: f.display, ['--ital' as string]: f.italic ? 'italic' : 'normal' } as React.CSSProperties;
  const sec = (t: string, items: Match[]) => items.length ? (
    <section className="day-sec"><h2>{t} <span>{items.length}</span></h2><div className="day-grid">{items.map(m => <Mini key={m.id} m={m} />)}</div></section>
  ) : null;

  return (
    <main className="day" style={vars}>
      <header className="day-head">
        {org.brand.logo && <img src={org.brand.logo} alt={org.name} />}
        <div><h1>Resumen del día</h1><p>{org.name} · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      </header>
      {sec('En juego', live)}
      {sec('Terminados hoy', done)}
      {sec('Próximos', next)}
      {!live.length && !done.length && !next.length && <p className="day-empty">Todavía no hay partidos hoy.</p>}
      <p className="day-foot">Se actualiza solo · Tocá un partido para ver su tablero</p>
    </main>
  );
}
