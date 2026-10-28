'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/components/OrgProvider';
import { createMatch, fetchOrgMatches } from '@/lib/data';
import MatchPlayers, { emptySlots, slotReady, slotToPlayer, usePlayerBase, type Slots } from '@/components/MatchPlayers';
import { PRESETS, presetRules, describeCfg, type MatchRules } from '@/lib/scoring/engine';
import { slugify, type Team } from '@/lib/model';
import { toast, errMsg } from '@/lib/toast';

const ROUNDS = ['Fase de grupos', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final', 'Fecha de liga', 'Amistoso / exhibición'];

export default function NuevoPartido() {
  const { org } = useOrg();
  const router = useRouter();
  const [events, setEvents] = useState<string[]>([]);
  const [courts, setCourts] = useState<string[]>([]);
  const [event, setEvent] = useState('');
  const [court, setCourt] = useState('Cancha 1');
  const [round, setRound] = useState('Final');
  const [cat, setCat] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const base = usePlayerBase(org.id);
  const [preset, setPreset] = useState('oro');
  const [cfg, setCfg] = useState<MatchRules>(presetRules('oro'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchOrgMatches(org.id).then(ms => {
      setEvents([...new Set(ms.map(m => m.event))]); setCourts([...new Set(ms.map(m => m.court))]);
      if (ms[0]) setEvent(e => e || ms[0].event);
    }).catch(() => {});
  }, [org.id]);

  const setRule = <K extends keyof MatchRules>(key: K, v: MatchRules[K]) => {
    setCfg(c => { const n = { ...c, [key]: v }; if (n.tiebreakAt > n.gamesPerSet) n.tiebreakAt = n.gamesPerSet; return n; });
    setPreset('custom');
  };

  async function create(go: boolean) {
    if (!event.trim() || !court.trim()) { toast('Completá evento y cancha'); return; }
    if (!slots.flat().every(slotReady)) { toast('Elegí o creá los 4 jugadores'); return; }
    setBusy(true);
    try {
      const teams = slots.map(t => ({ players: t.map(slotToPlayer) })) as unknown as [Team, Team];
      const m = await createMatch(org.id, { event: event.trim(), court: court.trim(), round, cat: cat.trim(), scheduledAt: time.trim(), teams, presetKey: preset, cfg });
      toast('Partido creado');
      router.push(go ? `/panel/partido/${m.id}` : '/panel');
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Nuevo partido</h1><p>Cargá los datos, elegí el formato y pasás directo a la puntuación.</p></div></div>
      <section className="card">
        <h2>Datos del partido</h2>
        <div className="row">
          <label className="field" htmlFor="event">Evento / torneo / liga<input id="event" list="eventList" value={event} onChange={e => setEvent(e.target.value)} placeholder="Torneo Apertura 2026" /></label>
          <label className="field" htmlFor="court">Cancha<input id="court" list="courtList" value={court} onChange={e => setCourt(e.target.value)} placeholder="Cancha 1" /></label>
        </div>
        <div className="row">
          <label className="field" htmlFor="round">Instancia<select id="round" value={round} onChange={e => setRound(e.target.value)}>{ROUNDS.map(r => <option key={r}>{r}</option>)}</select></label>
          <label className="field" htmlFor="cat">Categoría<input id="cat" value={cat} onChange={e => setCat(e.target.value)} placeholder="Femenino · 6ta" /></label>
          <label className="field" htmlFor="time">Horario (opcional)<input id="time" value={time} onChange={e => setTime(e.target.value)} placeholder="21:30" /></label>
        </div>
        <datalist id="eventList">{events.map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="courtList">{courts.map(v => <option key={v} value={v} />)}</datalist>
        <p className="hint">Tablero de esta cancha: <span className="copy">{(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/^https?:\/\//, '') || 'smashr'}/{org.slug}/{slugify(event) || 'evento'}/{slugify(court) || 'cancha'}/tablero</span></p>
      </section>

      <MatchPlayers orgId={org.id} slots={slots} onChange={setSlots} list={base.list} reload={base.reload} matchCat={cat} />

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
        <button className="btn" type="button" disabled={busy} onClick={() => create(false)}>Guardar como programado</button>
        <button className="btn primary" type="button" disabled={busy} onClick={() => create(true)}>{busy ? 'Creando…' : 'Crear y pasar a puntuación'}</button>
      </div>
    </main>
  );
}
