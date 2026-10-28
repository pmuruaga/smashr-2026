'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import PlayerForm from '@/components/PlayerForm';
import { ageFrom, deletePlayer, fetchOrgPlayers, matchesQuery, HANDS, POSITIONS, type OrgPlayer } from '@/lib/players';
import { toast, errMsg } from '@/lib/toast';

export default function JugadoresPage() {
  const { org } = useOrg();
  const [list, setList] = useState<OrgPlayer[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<OrgPlayer | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList(await fetchOrgPlayers(org.id)); } catch (e) { toast(errMsg(e)); setList([]); }
  }, [org.id]);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set((list || []).map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [list]);
  const shown = useMemo(() => (list || []).filter(p => matchesQuery(p, q) && (!cat || p.category === cat)), [list, q, cat]);

  async function del(p: OrgPlayer) {
    if (confirmId !== p.id) { setConfirmId(p.id); setTimeout(() => setConfirmId(c => (c === p.id ? null : c)), 4000); return; }
    setConfirmId(null);
    try { await deletePlayer(p.id); toast('Jugador eliminado'); await load(); } catch (e) { toast(errMsg(e)); }
  }
  const open = (p: OrgPlayer | 'new') => { setEditing(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Jugadores</h1><p>Tu base de jugadores. Solo la ve tu organización.</p></div>
        {!editing && <button className="btn primary" type="button" onClick={() => open('new')}>+ Nuevo jugador</button>}
      </div>

      {editing && (
        <PlayerForm key={editing === 'new' ? 'new' : editing.id} orgId={org.id} player={editing === 'new' ? null : editing} categories={categories}
          onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      )}

      <section className="card">
        <div className="row">
          <label className="field" htmlFor="pq" style={{ flex: '3 1 260px' }}>Buscar<input id="pq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, apellido, DNI o ciudad" /></label>
          <label className="field" htmlFor="pcat">Categoría<select id="pcat" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="section-t"><h2>Listado</h2><span className="n tnum">{list ? `${shown.length} de ${list.length}` : 'Cargando…'}</span></div>

        {list && !list.length && <div className="drop">Todavía no cargaste jugadores. Agregá el primero con <b>+ Nuevo jugador</b>.</div>}
        {list && !!list.length && !shown.length && <p className="empty">No hay jugadores que coincidan con la búsqueda.</p>}

        <div className="plist">
          {shown.map(p => {
            const age = ageFrom(p.birthDate);
            const meta = [p.category, p.ranking && `#${p.ranking}`, p.rankingPoints > 0 && `${p.rankingPoints.toLocaleString('es-AR')} pts`, p.position && POSITIONS[p.position], p.hand && HANDS[p.hand], p.city, age !== null && `${age} años`].filter(Boolean).join(' · ');
            return (
              <div key={p.id} className="prow">
                <div className="pav">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : <span>{(p.firstName[0] || '') + (p.lastName[0] || '')}</span>}</div>
                <div className="pinfo">
                  <b>{p.lastName}, {p.firstName}</b>
                  <small>{meta || 'Sin datos de ficha'}{p.dni ? ` · DNI ${p.dni}` : ''}</small>
                </div>
                <div className="pact">
                  {!p.isOwner && <span className="pill">Compartido</span>}
                  <button className="btn sm" type="button" onClick={() => open(p)}>Editar</button>
                  {p.isOwner && <button className="btn sm danger" type="button" onClick={() => del(p)}>{confirmId === p.id ? '¿Seguro? Tocá de nuevo' : 'Eliminar'}</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
