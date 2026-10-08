'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import Stage from '@/components/Stage';
import { StatusPill, site, boardPath, matchBoardPath, copy } from '@/components/ui';
import { actAddTime, actChooseServer, actPoint, actToss, actScene, actToggleServe, actUndo, fetchMatch, fetchOrgMatches, findNext, watchMatch } from '@/lib/data';
import { pointLabels, statusBadges, describeCfg, currentServer } from '@/lib/scoring/engine';
import { timerLeft, fmtTimer } from '@/lib/stage/scenes';
import { SCENES, teamName, type Match, type SceneKey } from '@/lib/model';
import { toast, errMsg } from '@/lib/toast';

const WARM = [3, 5, 7, 10], BRK = [60, 90, 120];

export default function Puntuacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { org } = useOrg();
  const [m, setM] = useState<Match | null | undefined>(undefined);
  const [all, setAll] = useState<Match[]>([]);
  const [warm, setWarm] = useState(5);
  const [brk, setBrk] = useState(90);
  const [, setNow] = useState(0);
  const mRef = useRef<Match | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  useEffect(() => { mRef.current = m ?? null; }, [m]);
  useEffect(() => {
    fetchMatch(id).then(x => setM(x && x.orgId === org.id ? x : null));
    fetchOrgMatches(org.id).then(setAll).catch(() => {});
    // cambios hechos desde otro dispositivo (otro operador) — se ignoran mientras hay acciones propias en curso
    return watchMatch(id, x => { if (pending.current === 0) setM(x); });
  }, [id, org.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  /* Las acciones se encolan: cada una parte del estado que dejó la anterior (dos toques rápidos no se pisan). */
  const run = useCallback((fn: (cur: Match) => Promise<Match>) => {
    pending.current++;
    queue.current = queue.current.then(async () => {
      const cur = mRef.current; if (!cur) return;
      try { const next = await fn(cur); mRef.current = next; setM(next); }
      catch (e) { toast('No se pudo guardar: ' + errMsg(e)); const fresh = await fetchMatch(cur.id); if (fresh) { mRef.current = fresh; setM(fresh); } }
      finally { pending.current--; }
    });
  }, []);

  const point = useCallback((k: number) => run(c => actPoint(c, k)), [run]);
  const undo = useCallback(() => run(actUndo), [run]);
  const scene = (s: SceneKey, opts: { sec?: number; bioTeam?: number } = {}) => run(c => actScene(c, s, opts));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '');
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.key === '1') point(0); else if (e.key === '2') point(1); else if (e.key === 'z' || e.key === 'Z') undo();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [point, undo]);

  if (m === undefined) return <main className="page"><p className="hint">Cargando partido…</p></main>;
  if (m === null) return <main className="page"><p className="hint">No encontramos ese partido en tu organización. Volvé a <Link href="/panel">Partidos</Link>.</p></main>;

  const st = m.state, lab = pointLabels(st), d = m.display, left = timerLeft(d);
  const srv = currentServer(st), sp = st.srvPlayer || [0, 0];
  const teamBtn = (k: number) => (
    <div className={`teamBtn ${k ? 'b' : ''} ${st.finished ? 'off' : ''}`} role="button" tabIndex={0} aria-label={`Punto para ${teamName(m, k)}`}
      onClick={() => { if (!st.finished) point(k); }}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); if (!st.finished) point(k); } }}>
      <div className="names">{m.teams[k].players.map((p, j) => {
        const now = !st.finished && srv.team === k && srv.player === j;
        const nextOther = !st.finished && srv.team !== k && sp[k] === j;
        return (
          <span key={j} className="pname">
            <button type="button" className={`srvball ${now ? 'now' : nextOther ? 'next' : ''}`}
              title={now ? 'Está sacando' : nextOther ? 'Próximo en sacar de su pareja' : 'Elegir para el saque'}
              aria-label={`Saque: ${p.first} ${p.last}`} aria-pressed={now}
              onClick={e => { e.stopPropagation(); if (!st.finished) run(c => actChooseServer(c, k, j)); }} />
            <small className="fn">{p.first} </small>{p.last}
          </span>
        );
      })}</div>
      <div className="sets">{st.sets.map((s, i) => <b key={i} className="tnum">{s.tb && s.tb.super ? s.tb.p[k] : s.g[k]}</b>)}</div>
      <div className="pts tnum">{st.finished ? (st.winner === k ? '🏆' : '–') : lab[k]}</div>
    </div>
  );
  const sceneBtn = (key: SceneKey, label: string, hint: string, extra?: React.ReactNode, bioTeam?: number) => {
    const on = d.scene === key && (key !== 'bio' || d.bioTeam === bioTeam);
    const go = () => scene(key, { sec: key === 'warmup' ? warm * 60 : key === 'break' ? brk : undefined, bioTeam });
    return (
      <div className={`scene ${on ? 'on' : ''}`} role="button" tabIndex={0} key={key + (bioTeam ?? '')}
        onClick={e => { const tag = (e.target as HTMLElement).tagName; if (tag !== 'SELECT' && tag !== 'BUTTON') go(); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
        <b>{label}</b><small>{hint}</small>{extra}
      </div>
    );
  };
  const link = site() + boardPath(org.slug, m);

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>{m.court} · {m.round}</h1><p className="head-meta">{[m.event, m.cat].filter(Boolean).join(' · ')}</p></div>
        <div className="row"><Link className="btn" href="/panel">← Partidos</Link><a className="btn" href={matchBoardPath(m)} target="_blank" rel="noopener">Abrir tablero ↗</a></div>
      </div>
      <div className="ctl">
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}><h2>Marcador</h2><StatusPill m={m} /></div>
            {teamBtn(0)}
            <div className="statusbar">{statusBadges(st).map(b => <span key={b.l} className={`cbadge ${b.k}`}>{b.l}</span>)}</div>
            {teamBtn(1)}
            <div className="row">
              <button className="btn" type="button" onClick={undo}>↶ Deshacer</button>
              <button className="btn" type="button" onClick={() => run(actToggleServe)}>Cambiar saque</button>
              <span className="hint">{describeCfg(st.cfg)}</span>
            </div>
            <p className="hint">Tocá la pareja que gana el punto. <b>Saque:</b> antes de empezar tocá la pelotita del que saca primero y después la del primero de la otra pareja; el resto del orden sigue solo. Pelotita llena = saca ahora, con borde = próximo de su pareja. Atajos en compu: <b>1</b> / <b>2</b> y <b>Z</b> para deshacer.</p>
          </section>
          <section className="card">
            <h2>Qué muestra el tablero</h2>
            {d.timerEndsAt ? (
              <div className="timerbox"><span>{SCENES[d.scene].label}:</span><span className="t tnum">{left ? fmtTimer(left) : 'Terminado'}</span>
                <button className="btn sm" type="button" onClick={() => run(c => actAddTime(c, 60))}>+1 min</button>
                <button className="btn sm" type="button" onClick={() => scene('score')}>Volver al marcador</button></div>
            ) : null}
            <div className="scenes">
              {sceneBtn('score', 'Marcador', 'Pantalla principal')}
              {sceneBtn('warmup', 'Calentamiento', 'Reloj + publicidad',
                <select aria-label="Duración del calentamiento" value={warm} onChange={e => setWarm(Number(e.target.value))}>{WARM.map(o => <option key={o} value={o}>{o} min</option>)}</select>)}
              {sceneBtn('break', 'Pausa / cambio de lado', 'Sponsor + marcador',
                <select aria-label="Duración de la pausa" value={brk} onChange={e => setBrk(Number(e.target.value))}>{BRK.map(o => <option key={o} value={o}>{o} s</option>)}</select>)}
              {sceneBtn('h2h', 'VS', 'Cara a cara, antes de que entren')}
              {sceneBtn('summary', 'Resumen del set', 'Al cerrar un set')}
              {sceneBtn('bio', 'Ficha pareja A', teamName(m, 0), undefined, 0)}
              {sceneBtn('bio', 'Ficha pareja B', teamName(m, 1), undefined, 1)}
              {sceneBtn('next', 'Próximo partido', 'Entre partidos')}
              {sceneBtn('toss', 'Sorteo', d.toss ? `Salió ${d.toss.result === 'paleta' ? 'PALETA' : 'PELOTA'}` : 'Moneda: paleta o pelota',
                <button className="btn sm primary" type="button" onClick={e => { e.stopPropagation(); run(actToss); }}>Sortear</button>)}
            </div>
          </section>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}><h2>Vista del tablero</h2><span className="hint">en vivo</span></div>
            <Stage m={m} org={org} next={findNext(all, m)} />
          </section>
          <section className="card">
            <h2>Compartir</h2>
            <p className="hint">Link de la cancha para la Smart TV y el público (QR): muestra siempre el partido en juego de esa cancha y pasa solo al siguiente.</p>
            <div className="copy">{link}</div>
            <div className="row">
              <button className="btn sm" type="button" onClick={() => copy(link, toast)}>Copiar link de la cancha</button>
              <button className="btn sm" type="button" onClick={() => copy(site() + matchBoardPath(m), toast)}>Copiar link de este partido</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
