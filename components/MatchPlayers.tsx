'use client';
/* Parejas de un partido: cada lugar busca un jugador de la base de la org o crea uno nuevo (queda guardado).
   La búsqueda la resuelve la base (search_org_players): trae como máximo 8 resultados, no la lista entera.
   El partido guarda una copia de los datos + playerId, así los partidos jugados no cambian si después se edita el jugador. */
import { useEffect, useRef, useState } from 'react';
import PlayerForm, { type PlayerDraft } from './PlayerForm';
import { fetchOrgCategories, fetchOrgPlayersByIds, searchOrgPlayers, HANDS, POSITIONS, type OrgPlayer } from '@/lib/players';
import { slotFor, slotReady, HAND_LABELS, SIDES, type Slot, type Slots } from '@/lib/slots';
import { useDebounced } from '@/lib/hooks';
export { emptySlots, slotFromMatch, slotReady, slotToPlayer, type Slots } from '@/lib/slots';
import { toast, errMsg } from '@/lib/toast';

const MAX_RESULTS = 8;

export default function MatchPlayers({ orgId, slots, onChange, matchCat }: {
  orgId: string; slots: Slots; onChange: (s: Slots) => void; matchCat: string;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => { fetchOrgCategories(orgId).then(setCategories).catch(() => {}); }, [orgId]);
  const set = (k: number, j: number, s: Slot) => onChange(slots.map((t, ti) => t.map((x, pj) => (ti === k && pj === j ? s : x))));
  const taken = (k: number, j: number) => slots.flatMap((t, ti) => t.map((x, pj) => (ti === k && pj === j ? null : x.player?.id))).filter(Boolean) as string[];
  const slot = (k: number, j: number) => (
    <PlayerSlot key={`${k}${j}`} id={`s${k}${j}`} label={`Jugador ${j + 1}`} orgId={orgId} slot={slots[k][j]} onChange={s => set(k, j, s)}
      taken={taken(k, j)} matchCat={matchCat} categories={categories} />
  );
  return (
    <div className="grid2">
      <section className="card team-card"><h2>Pareja A</h2><div style={{ display: 'grid', gap: 10 }}>{slot(0, 0)}{slot(0, 1)}</div></section>
      <section className="card team-card b"><h2>Pareja B</h2><div style={{ display: 'grid', gap: 10 }}>{slot(1, 0)}{slot(1, 1)}</div></section>
    </div>
  );
}

function PlayerSlot({ id, label, orgId, slot, onChange, taken, matchCat, categories }: {
  id: string; label: string; orgId: string; slot: Slot; onChange: (s: Slot) => void;
  taken: string[]; matchCat: string; categories: string[];
}) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [creating, setCreating] = useState<PlayerDraft | null>(null);
  const [results, setResults] = useState<OrgPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const showSearch = !slot.player && (!slot.legacy || searching);
  const dq = useDebounced(q, 250);
  const takenKey = taken.join(',');

  // consulta la base solo con el desplegable abierto
  useEffect(() => {
    if (!open || !showSearch) return;
    const my = ++reqId.current;
    setLoading(true);
    searchOrgPlayers(orgId, { q: dq, limit: MAX_RESULTS, preferCat: matchCat, exclude: takenKey ? takenKey.split(',') : [] })
      .then(r => { if (my === reqId.current) { setResults(r.rows); setHi(0); setLoading(false); } })
      .catch(e => { if (my === reqId.current) { toast(errMsg(e)); setResults([]); setLoading(false); } });
  }, [open, showSearch, orgId, dq, matchCat, takenKey]);

  const shown = results || [];
  const options = [...shown.map(p => ({ kind: 'p' as const, p })), { kind: 'new' as const }];

  function pick(p: OrgPlayer) { onChange(slotFor(p, slot.base)); setQ(''); setOpen(false); setSearching(false); }
  function startCreate() {
    const w = q.trim().split(/\s+/).filter(Boolean);
    setCreating(w.length > 1 ? { firstName: w[0], lastName: w.slice(1).join(' '), category: '' } : { lastName: w[0] || '' });
    setOpen(false);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[hi]; if (o) { if (o.kind === 'p') pick(o.p); else startCreate(); } }
    else if (e.key === 'Escape') setOpen(false);
  }
  const meta = (p: OrgPlayer) => [p.category, p.position && POSITIONS[p.position], p.hand && HANDS[p.hand], p.ranking && `#${p.ranking}`, p.dni && `DNI ${p.dni}`].filter(Boolean).join(' · ');

  if (creating) {
    return (
      <div className="pl"><b>{label}</b>
        <PlayerForm quick orgId={orgId} player={null} initial={creating} categories={categories}
          onCancel={() => setCreating(null)}
          onSaved={async newId => { const [p] = await fetchOrgPlayersByIds(orgId, [newId]).catch(() => []); setCreating(null); if (p) pick(p); }} />
      </div>
    );
  }

  return (
    <div className="pl"><b>{label}</b>
      {slot.player && <Chosen name={`${slot.player.lastName}, ${slot.player.firstName}`} photo={slot.player.photoUrl} meta={meta(slot.player)}
        onChangeClick={() => { onChange({ ...slot, player: null }); setSearching(true); setTimeout(() => inputRef.current?.focus(), 0); }} />}
      {!slot.player && slot.legacy && !searching && (
        <Chosen name={`${slot.legacy.last}, ${slot.legacy.first}`} photo={slot.legacy.photo} meta="Cargado a mano en este partido, sin vincular a la base" legacy
          onChangeClick={() => { setSearching(true); setQ(slot.legacy?.last || ''); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }} />
      )}

      {showSearch && (
        <div className="pick">
          <label className="field" htmlFor={id + 'q'}>Buscar jugador
            <input id={id + 'q'} ref={inputRef} type="search" role="combobox" aria-expanded={open} aria-controls={id + 'list'} autoComplete="off"
              value={q} placeholder="Nombre, apellido o DNI"
              onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={key} />
          </label>
          {open && (
            <ul className="pick-list" id={id + 'list'} role="listbox">
              {shown.map((p, i) => (
                <li key={p.id} role="option" aria-selected={hi === i} className={hi === i ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => pick(p)}>
                  <b>{p.lastName}, {p.firstName}</b><small>{meta(p) || 'Sin datos de ficha'}</small>
                </li>
              ))}
              {results === null || (loading && !shown.length) ? <li className="none">Buscando…</li>
                : !shown.length && <li className="none">{dq.trim() ? 'No hay jugadores que coincidan' : 'No hay jugadores en tu base para elegir'}</li>}
              <li role="option" aria-selected={hi === shown.length} className={`new${hi === shown.length ? ' on' : ''}`} onMouseDown={e => e.preventDefault()} onClick={startCreate}>
                ＋ Crear jugador nuevo{q.trim() ? ` “${q.trim()}”` : ''}
              </li>
            </ul>
          )}
          {slot.legacy && <button className="btn sm" type="button" onClick={() => { setSearching(false); setQ(''); }}>Dejar como estaba</button>}
        </div>
      )}

      {slotReady(slot) && (
        <details><summary>Ajustar ficha para este partido</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="field" htmlFor={id + 's'}>Posición<select id={id + 's'} value={slot.side} onChange={e => onChange({ ...slot, side: e.target.value })}>
              {(SIDES.includes(slot.side) ? SIDES : [slot.side, ...SIDES]).map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="field" htmlFor={id + 'h'}>Mano<select id={id + 'h'} value={slot.hand} onChange={e => onChange({ ...slot, hand: e.target.value })}>
              {(HAND_LABELS.includes(slot.hand) ? HAND_LABELS : [slot.hand, ...HAND_LABELS]).map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="field" htmlFor={id + 'r'}>Ranking<input id={id + 'r'} type="number" min={1} value={slot.rank} onChange={e => onChange({ ...slot, rank: e.target.value })} /></label>
            <label className="field" htmlFor={id + 'pt'}>Puntos<input id={id + 'pt'} type="number" min={0} value={slot.points} onChange={e => onChange({ ...slot, points: e.target.value })} /></label>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>Solo cambia lo que muestra el tablero en este partido; no modifica al jugador en tu base.</p>
        </details>
      )}
    </div>
  );
}

function Chosen({ name, photo, meta, legacy = false, onChangeClick }: { name: string; photo: string | null; meta: string; legacy?: boolean; onChangeClick: () => void }) {
  const initials = name.split(', ').reverse().map(w => w[0] || '').join('');
  return (
    <div className={`pick-sel${legacy ? ' legacy' : ''}`}>
      <div className="pav">{photo ? <img src={photo} alt="" /> : <span>{initials}</span>}</div>
      <div className="pinfo"><b>{name}</b><small>{meta || 'Sin datos de ficha'}</small></div>
      <button className="btn sm" type="button" onClick={onChangeClick}>{legacy ? 'Vincular a la base' : 'Cambiar'}</button>
    </div>
  );
}
