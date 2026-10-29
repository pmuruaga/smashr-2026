'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import PlayerForm from '@/components/PlayerForm';
import { ageFrom, deletePlayer, fetchOrgCategories, searchOrgPlayers, HANDS, PAGE_SIZE, POSITIONS, type OrgPlayer } from '@/lib/players';
import { useDebounced } from '@/lib/hooks';
import { toast, errMsg } from '@/lib/toast';

/* Listado paginado: la búsqueda, el filtro y la paginación los resuelve la base (search_org_players). */
export default function JugadoresPage() {
  const { org } = useOrg();
  const [rows, setRows] = useState<OrgPlayer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [editing, setEditing] = useState<OrgPlayer | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // fuerza recarga de la página actual
  const dq = useDebounced(q, 300);
  const reqId = useRef(0);

  // al cambiar búsqueda o filtro, volver a la primera página
  useEffect(() => { setPage(0); }, [dq, cat]);

  useEffect(() => {
    const my = ++reqId.current;
    setLoading(true);
    searchOrgPlayers(org.id, { q: dq, category: cat, offset: page * PAGE_SIZE })
      .then(r => {
        if (my !== reqId.current) return; // llegó tarde una respuesta vieja
        if (!r.rows.length && page > 0) { setPage(p => p - 1); return; } // ej. se borró el último de la última página
        setRows(r.rows); setTotal(r.total); setLoading(false);
      })
      .catch(e => { if (my === reqId.current) { toast(errMsg(e)); setRows([]); setTotal(0); setLoading(false); } });
  }, [org.id, dq, cat, page, tick]);

  const loadCategories = useCallback(() => { fetchOrgCategories(org.id).then(setCategories).catch(() => {}); }, [org.id]);
  useEffect(() => { loadCategories(); }, [loadCategories]);
  const refresh = () => { setTick(t => t + 1); loadCategories(); };

  async function del(p: OrgPlayer) {
    if (confirmId !== p.id) { setConfirmId(p.id); setTimeout(() => setConfirmId(c => (c === p.id ? null : c)), 4000); return; }
    setConfirmId(null);
    try { await deletePlayer(p.id); toast('Jugador eliminado'); refresh(); } catch (e) { toast(errMsg(e)); }
  }
  const open = (p: OrgPlayer | 'new') => { setEditing(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(dq.trim() || cat);
  const go = (n: number) => { setPage(n); document.getElementById('plist-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const pager = total > PAGE_SIZE && (
    <nav className="pager" aria-label="Páginas">
      <button className="btn sm" type="button" disabled={page === 0 || loading} onClick={() => go(page - 1)}>← Anterior</button>
      <span className="tnum">Página {page + 1} de {pages}</span>
      <button className="btn sm" type="button" disabled={page >= pages - 1 || loading} onClick={() => go(page + 1)}>Siguiente →</button>
    </nav>
  );

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Jugadores</h1><p>Tu base de jugadores. Solo la ve tu organización.</p></div>
        {!editing && <button className="btn primary" type="button" onClick={() => open('new')}>+ Nuevo jugador</button>}
      </div>

      {editing && (
        <PlayerForm key={editing === 'new' ? 'new' : editing.id} orgId={org.id} player={editing === 'new' ? null : editing} categories={categories}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}

      <section className="card">
        <div className="row">
          <label className="field" htmlFor="pq" style={{ flex: '3 1 260px' }}>Buscar<input id="pq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, apellido, DNI o ciudad" /></label>
          <label className="field" htmlFor="pcat">Categoría<select id="pcat" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="section-t" id="plist-top"><h2>Listado</h2><span className="n tnum">{rows === null ? 'Cargando…'
          : total ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length} de ${total.toLocaleString('es-AR')}${filtered ? ' encontrados' : ''}` : ''}</span></div>

        {rows && !loading && !total && !filtered && <div className="drop">Todavía no cargaste jugadores. Agregá el primero con <b>+ Nuevo jugador</b>.</div>}
        {rows && !loading && !total && filtered && <p className="empty">No hay jugadores que coincidan con la búsqueda.</p>}

        {pager}
        <div className={`plist${loading && rows ? ' loading' : ''}`} aria-busy={loading}>
          {(rows || []).map(p => {
            const age = ageFrom(p.birthDate);
            const meta = [p.category, p.ranking && `#${p.ranking}`, p.rankingPoints > 0 && `${p.rankingPoints.toLocaleString('es-AR')} pts`, p.position && POSITIONS[p.position], p.hand && HANDS[p.hand], p.city, age !== null && `${age} años`].filter(Boolean).join(' · ');
            return (
              <div key={p.id} className="prow">
                <div className="pav">{p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : <span>{(p.firstName[0] || '') + (p.lastName[0] || '')}</span>}</div>
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
        {pager}
      </section>
    </main>
  );
}
