'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/components/OrgProvider';
import { fetchMatch, fetchOrgMatches, updateScheduledMatch } from '@/lib/data';
import MatchPlayers, { emptySlots, slotFromMatch, slotReady, slotToPlayer, type Slots } from '@/components/MatchPlayers';
import { fetchOrgPlayersByIds } from '@/lib/players';
import { PRESETS, presetRules, describeCfg, type MatchRules } from '@/lib/scoring/engine';
import { slugify, type Match, type Team } from '@/lib/model';
import { toast, errMsg } from '@/lib/toast';

const ROUNDS = ['Fase de grupos', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final', 'Fecha de liga', 'Amistoso / exhibición'];
/* Editar un partido que todavía no empezó (estado Programado). Misma carga que Nuevo partido. */
export default function EditarPartido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { org } = useOrg();
  const [orig, setOrig] = useState<Match | null | undefined>(undefined);
  const router = useRouter();
  const [events, setEvents] = useState<string[]>([]);
  const [courts, setCourts] = useState<string[]>([]);
  const [event, setEvent] = useState('');
  const [court, setCourt] = useState('Cancha 1');
  const [round, setRound] = useState('Final');
  const [cat, setCat] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [slotsReady, setSlotsReady] = useState(false);
  const [preset, setPreset] = useState('oro');
  const [cfg, setCfg] = useState<MatchRules>(presetRules('oro'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchOrgMatches(org.id).then(ms => {
      setEvents([...new Set(ms.map(m => m.event))]); setCourts([...new Set(ms.map(m => m.court))]);
    }).catch(() => {});
    fetchMatch(id).then(m => {
      if (!m || m.orgId !== org.id) { setOrig(null); return; }
      setOrig(m);
      setEvent(m.event); setCourt(m.court); setRound(m.round); setCat(m.cat); setTime(m.scheduledAt);
      setPreset(m.presetKey in PRESETS ? m.presetKey : 'custom'); setCfg(m.cfg);
    }).catch(() => setOrig(null));
  }, [org.id, id]);

  // armar los 4 lugares: trae de la base solo los jugadores vinculados a este partido
  useEffect(() => {
    if (slotsReady || !orig) return;
    const ids = orig.teams.flatMap(t => t.players.map(p => p.playerId)).filter(Boolean) as string[];
    fetchOrgPlayersByIds(org.id, ids).catch(() => []).then(list => {
      setSlots(orig.teams.map(t => t.players.map(p => slotFromMatch(p, list))));
      setSlotsReady(true);
    });
  }, [orig, org.id, slotsReady]);
  const setRule = <K extends keyof MatchRules>(key: K, v: MatchRules[K]) => {
    setCfg(c => { const n = { ...c, [key]: v }; if (n.tiebreakAt > n.gamesPerSet) n.tiebreakAt = n.gamesPerSet; return n; });
    setPreset('custom');
  };

  async function save() {
    if (!orig) return;
    if (!event.trim() || !court.trim()) { toast('Completá evento y cancha'); return; }
    if (!slots.flat().every(slotReady)) { toast('Elegí o creá los 4 jugadores'); return; }
    setBusy(true);
    try {
      const teams = slots.map(t => ({ players: t.map(slotToPlayer) })) as unknown as [Team, Team];
      await updateScheduledMatch(orig, { event: event.trim(), court: court.trim(), round, cat: cat.trim(), scheduledAt: time.trim(), teams, presetKey: preset, cfg });
      toast('Partido actualizado');
      router.push('/panel');
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  }

  if (orig === undefined) return <main className="page"><p className="hint">Cargando partido…</p></main>;
  if (orig === null) return <main className="page"><p className="hint">No encontramos ese partido en tu organización. Volvé a <Link href="/panel">Partidos</Link>.</p></main>;
  if (orig.status !== 'scheduled') return <main className="page"><p className="hint">Este partido ya empezó, por eso no se puede editar. Volvé a <Link href="/panel">Partidos</Link>.</p></main>;

  return (
    <main className="page">
      <div className="page-head"><div><h1>Editar partido</h1><p>Solo se pueden editar partidos que todavía no empezaron. El link del tablero de la cancha se actualiza si cambiás evento o cancha.</p></div></div>
      <section className="card">
        <h2>Datos del partido</h2>
        <div className="row">
          <label className="field" htmlFor="event">Evento / torneo / liga<input id="event" list="eventList" value={event} onChange={e => setEvent(e.target.value)} placeholder="Torneo Apertura 2026" /></label>
          <label className="field" htmlFor="court">Cancha<input id="court" list="courtList" value={court} onChange={e => setCourt(e.target.value)} placeholder="Cancha 1" /></label>
        </div>
        <div className="row">
          <label className="field" htmlFor="round">Instancia<select id="round" value={round} onChange={e => setRound(e.target.value)}>{(ROUNDS.includes(round) ? ROUNDS : [round, ...ROUNDS]).map(r => <option key={r}>{r}</option>)}</select></label>
          <label className="field" htmlFor="cat">Categoría<input id="cat" value={cat} onChange={e => setCat(e.target.value)} placeholder="Femenino · 6ta" /></label>
          <label className="field" htmlFor="time">Horario (opcional)<input id="time" value={time} onChange={e => setTime(e.target.value)} placeholder="21:30" /></label>
        </div>
        <datalist id="eventList">{events.map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="courtList">{courts.map(v => <option key={v} value={v} />)}</datalist>
        <p className="hint">Tablero de esta cancha: <span className="copy">{(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/^https?:\/\//, '') || 'smashr'}/{org.slug}/{slugify(event) || 'evento'}/{slugify(court) || 'cancha'}/tablero</span></p>
      </section>

      {slotsReady ? <MatchPlayers orgId={org.id} slots={slots} onChange={setSlots} matchCat={cat} />
        : <p className="hint">Cargando jugadores…</p>}

      <section className="card">
        <h2>Formato del partido</h2>
        <label className="field" htmlFor="preset">Plantilla
          <select id="preset" value={preset} onChange={e => { const k = e.target.value; setPreset(k); if (k !== 'custom') setCfg(presetRules(k)); }}>
            {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </label>
        <div className="fmt-desc">{describeCfg(cfg)}</div>
        <details open={preset === 'custom' || undefined}>
          <summary>Personalizar reglas</summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div className="row">
              <label className="field" htmlFor="cSets">Sets a ganar<select id="cSets" value={cfg.setsToWin} onChange={e => setRule('setsToWin', Number(e.target.value))}><option value={1}>1 (set único)</option><option value={2}>2 (mejor de 3)</option><option value={3}>3 (mejor de 5)</option></select></label>
              <label className="field" htmlFor="cGames">Games por set<input id="cGames" type="number" min={2} max={12} value={cfg.gamesPerSet} onChange={e => setRule('gamesPerSet', Number(e.target.value))} /></label>
              <label className="field" htmlFor="cDeuce">En 40-40<select id="cDeuce" value={cfg.deuce} onChange={e => setRule('deuce', e.target.value as MatchRules['deuce'])}><option value="advantage">Ventaja clásica</option><option value="golden">Punto de oro</option><option value="star">Star point (2 ventajas + punto decisivo)</option></select></label>
            </div>
            <div className="row">
              <label className="field" htmlFor="cTb">Tie-break<select id="cTb" value={cfg.tiebreak ? '1' : '0'} onChange={e => setRule('tiebreak', e.target.value === '1')}><option value="1">Sí</option><option value="0">No (diferencia de 2)</option></select></label>
              <label className="field" htmlFor="cTbAt">Tie-break en iguales a<input id="cTbAt" type="number" min={2} max={12} value={cfg.tiebreakAt} onChange={e => setRule('tiebreakAt', Number(e.target.value))} /></label>
              <label className="field" htmlFor="cTbPts">Tie-break a<input id="cTbPts" type="number" min={5} max={21} value={cfg.tbPoints} onChange={e => setRule('tbPoints', Number(e.target.value))} /></label>
              <label className="field" htmlFor="cWin2">Cierre del tie-break<select id="cWin2" value={cfg.tbWinBy2 ? '1' : '0'} onChange={e => setRule('tbWinBy2', e.target.value === '1')}><option value="1">Diferencia de 2</option><option value="0">Muere en el número</option></select></label>
            </div>
            <div className="row">
              <label className="field" htmlFor="cDec">Set decisivo<select id="cDec" value={cfg.decider} onChange={e => setRule('decider', e.target.value as MatchRules['decider'])}><option value="set">Set completo</option><option value="supertb">Super tie-break</option></select></label>
              <label className="field" htmlFor="cStb">Super TB a<input id="cStb" type="number" min={5} max={21} value={cfg.superTbPoints} onChange={e => setRule('superTbPoints', Number(e.target.value))} /></label>
            </div>
          </div>
        </details>
      </section>

      <div className="actions">
        <Link className="btn" href="/panel">Cancelar</Link>
        <button className="btn primary" type="button" disabled={busy || !slotsReady} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </main>
  );
}
