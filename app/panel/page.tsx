'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import { StatusPill, scoreLine, site, boardPath, matchBoardPath, copy } from '@/components/ui';
import { fetchOrgMatches, watchOrg, deleteMatch } from '@/lib/data';
import { teamName, SCENES, type Match } from '@/lib/model';
import { pointLabels } from '@/lib/scoring/engine';
import { timerLeft, fmtTimer } from '@/lib/stage/scenes';
import { toast, errMsg } from '@/lib/toast';

export default function PartidosPage() {
  const { org } = useOrg();
  const [list, setList] = useState<Match[] | null>(null);
  const [, setNow] = useState(0);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const load = useCallback(() => fetchOrgMatches(org.id).then(setList).catch(e => toast(errMsg(e))), [org.id]);
  useEffect(() => { load(); return watchOrg(org.id, load); }, [org.id, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function del(m: Match) {
    if (confirmDel !== m.id) { setConfirmDel(m.id); setTimeout(() => setConfirmDel(c => (c === m.id ? null : c)), 4000); return; }
    try { await deleteMatch(m.id); toast('Partido eliminado'); load(); } catch (e) { toast(errMsg(e)); }
  }

  const card = (m: Match) => {
    const st = m.state, lab = pointLabels(st), sc = SCENES[m.display.scene] || SCENES.score, left = timerLeft(m.display);
    const row = (k: number) => (
      <>
        <div className="tn">{!st.finished && st.startedAt && st.server === k && <i className="dot-serve" title="Saca" />}{teamName(m, k)}</div>
        <div className={`sets tnum ${st.winner === k ? 'win' : ''}`}>{scoreLine(m, k)}</div>
        {m.status === 'live' && !st.finished ? <div className="pt tnum">{lab[k]}</div> : <div />}
      </>
    );
    return (
      <article className="card mcard" key={m.id}>
        <div className="top"><span className="court">{m.court}</span><StatusPill m={m} /></div>
        <div className="meta">{[m.event, m.round, m.cat].filter(Boolean).join(' · ')}</div>
        <div className="score">{row(0)}{row(1)}</div>
        {m.status !== 'finished' && <div className="onair">En el tablero: <b>{sc.label}</b>{left ? <> · <span className="tnum">{fmtTimer(left)}</span></> : null}</div>}
        <div className="row">
          {m.status !== 'finished' && <Link className="btn primary sm" href={`/panel/partido/${m.id}`}>Controlar</Link>}
          <a className="btn sm" href={matchBoardPath(m)} target="_blank" rel="noopener">Abrir tablero ↗</a>
          <button className="btn sm" type="button" onClick={() => copy(site() + boardPath(org.slug, m), toast)}>Copiar link de la cancha</button>
          {m.status !== 'live' && <button className="btn sm danger" type="button" onClick={() => del(m)}>{confirmDel === m.id ? '¿Seguro? Tocá de nuevo' : 'Eliminar'}</button>}
        </div>
      </article>
    );
  };
  const sec = (title: string, items: Match[], empty: string) => (
    <section className="card">
      <h2 className="section-t">{title} <span className="n">{items.length}</span></h2>
      <div className="mlist">{items.length ? items.map(card) : <p className="empty">{empty}</p>}</div>
    </section>
  );
  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Partidos</h1><p>{org.name} · cada partido tiene su propio tablero y se puede controlar desde cualquier dispositivo.</p></div>
        <div className="row">
          <a className="btn" href={`/${org.slug}/hoy`} target="_blank" rel="noopener">Resumen del día ↗</a>
          <button className="btn" type="button" onClick={() => copy(site() + `/${org.slug}/hoy`, toast)}>Copiar link del resumen</button>
          <Link className="btn primary" href="/panel/nuevo">+ Nuevo partido</Link>
        </div>
      </div>
      {list === null ? <p className="hint">Cargando partidos…</p> : <>
        {sec('En juego', list.filter(m => m.status === 'live'), 'No hay partidos en juego.')}
        {sec('Programados', list.filter(m => m.status === 'scheduled'), 'No hay partidos programados. Creá uno con “Nuevo partido”.')}
        {sec('Finalizados', list.filter(m => m.status === 'finished'), 'Todavía no terminó ningún partido.')}
      </>}
    </main>
  );
}
