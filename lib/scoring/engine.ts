/* =====================================================================
   MOTOR DE REGLAS — puro, sin DOM. Portado 1:1 del prototipo v2 (core.js).
   No cambiar la lógica sin agregar tests en engine.test.ts.
   ===================================================================== */

export type Deuce = 'advantage' | 'golden' | 'star';
export type Decider = 'set' | 'supertb';

export interface MatchRules {
  setsToWin: number;      // 1 = set único, 2 = mejor de 3, 3 = mejor de 5
  gamesPerSet: number;
  tiebreak: boolean;
  tiebreakAt: number;     // empate en el que arranca el TB
  tbPoints: number;
  tbWinBy2: boolean;      // false = "muere en" el número
  deuce: Deuce;
  decider: Decider;
  superTbPoints: number;
  label?: string;
}

export interface TiebreakState { p: [number, number]; target: number; super: boolean; first: number }
export interface SetState {
  g: [number, number];
  tb: TiebreakState | null;
  winner: number | null;
  start: number | null;
  end: number | null;
  pts: [number, number];
  bpOpp: [number, number];
  bpWon: [number, number];
  streak: [number, number];
}
export interface MatchState {
  cfg: MatchRules;
  sets: SetState[];
  setsWon: [number, number];
  pts: [number, number];
  deuces: number;
  server: number;            // pareja que saca (0/1)
  srvPlayer?: [number, number]; // jugador (0/1) de cada pareja que saca la próxima vez que le toque a esa pareja
  srvChosen?: boolean;       // el operador ya eligió quién arranca sacando
  finished: boolean;
  winner: number | null;
  timeline: [string, string][];
  startedAt: number | null;
  endedAt: number | null;
  run: { team: number | null; n: number };
  _bp: number | null;
}
export type PointResult = 'point' | 'game' | 'set' | 'match' | null;
export interface Badge { l: string; k: 'mode' | 'hot' | 'end' }

export const PRESETS: Record<string, MatchRules | { label: string }> = {
  pro:     { label: 'Profesional · Star point', setsToWin: 2, gamesPerSet: 6, tiebreak: true, tiebreakAt: 6, tbPoints: 7, tbWinBy2: true, deuce: 'star', decider: 'set', superTbPoints: 10 },
  oro:     { label: 'Amateur · Punto de oro + Super TB a 10', setsToWin: 2, gamesPerSet: 6, tiebreak: true, tiebreakAt: 6, tbPoints: 7, tbWinBy2: true, deuce: 'golden', decider: 'supertb', superTbPoints: 10 },
  ventaja: { label: 'Clásico · Ventaja + tie-break a 7', setsToWin: 2, gamesPerSet: 6, tiebreak: true, tiebreakAt: 6, tbPoints: 7, tbWinBy2: true, deuce: 'advantage', decider: 'set', superTbPoints: 10 },
  stb12:   { label: 'Mejor de 3 · Super TB a 12', setsToWin: 2, gamesPerSet: 6, tiebreak: true, tiebreakAt: 6, tbPoints: 7, tbWinBy2: true, deuce: 'golden', decider: 'supertb', superTbPoints: 12 },
  set9:    { label: 'Set único a 9 games', setsToWin: 1, gamesPerSet: 9, tiebreak: true, tiebreakAt: 8, tbPoints: 7, tbWinBy2: true, deuce: 'golden', decider: 'set', superTbPoints: 10 },
  tb10:    { label: 'Partido a un super tie-break a 10 (muerte súbita)', setsToWin: 1, gamesPerSet: 6, tiebreak: true, tiebreakAt: 6, tbPoints: 7, tbWinBy2: false, deuce: 'golden', decider: 'supertb', superTbPoints: 10 },
  custom:  { label: 'Personalizado' },
};
export const presetRules = (k: string): MatchRules => {
  const p = PRESETS[k] as MatchRules;
  const { label: _l, ...rules } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
  return clone(rules as MatchRules);
};

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const cur = (m: MatchState): SetState => m.sets[m.sets.length - 1];

/* El saque pasa a la otra pareja; en la pareja que terminó de sacar, la próxima vez saca el compañero.
   Así se cumple el orden 1-A, 1-B, 2-A, 2-B que eligió el operador. */
function passServe(m: MatchState) {
  const sp: [number, number] = m.srvPlayer ? [...m.srvPlayer] as [number, number] : [0, 0];
  sp[m.server] = 1 - sp[m.server];
  m.srvPlayer = sp;
  m.server = 1 - m.server;
}
/** Quién saca ahora: pareja y jugador. */
export function currentServer(m: MatchState): { team: number; player: number } {
  return { team: m.server, player: (m.srvPlayer || [0, 0])[m.server] };
}
/** Elección del operador tocando la pelotita de un jugador.
    - Primera elección antes de empezar: ese jugador arranca sacando (cambia la pareja que saca).
    - Jugador de la pareja que está sacando: pasa a sacar él.
    - Jugador de la otra pareja: será el próximo en sacar de su pareja. */
export function chooseServer(m: MatchState, team: number, player: number) {
  const sp: [number, number] = m.srvPlayer ? [...m.srvPlayer] as [number, number] : [0, 0];
  if (!m.srvChosen && !m.startedAt) m.server = team;
  sp[team] = player;
  m.srvPlayer = sp;
  m.srvChosen = true;
}

export function newSet(m: MatchState): SetState {
  const c = m.cfg, dec = m.setsWon[0] === c.setsToWin - 1 && m.setsWon[1] === c.setsToWin - 1;
  const sup = c.decider === 'supertb' && dec;
  return { g: [0, 0], tb: sup ? { p: [0, 0], target: c.superTbPoints, super: true, first: m.server } : null, winner: null,
    start: null, end: null, pts: [0, 0], bpOpp: [0, 0], bpWon: [0, 0], streak: [0, 0] };
}
export function newMatch(cfg: MatchRules): MatchState {
  const c = clone(cfg); delete c.label;
  const m: MatchState = { cfg: c, sets: [], setsWon: [0, 0], pts: [0, 0], deuces: 0, server: 0, srvPlayer: [0, 0], finished: false, winner: null,
    timeline: [], startedAt: null, endedAt: null, run: { team: null, n: 0 }, _bp: null };
  m.sets.push(newSet(m)); return m;
}
export function pointLabels(m: MatchState): [string, string] {
  const s = cur(m); if (s.tb) return [String(s.tb.p[0]), String(s.tb.p[1])];
  const p = m.pts, N = ['0', '15', '30', '40'];
  if (p[0] >= 3 && p[1] >= 3) { if (p[0] === p[1]) return ['40', '40']; return p[0] > p[1] ? ['AD', '40'] : ['40', 'AD']; }
  return [N[Math.min(p[0], 3)], N[Math.min(p[1], 3)]];
}
/** Suma un punto al equipo t (0/1). Muta m. sim=true no registra estadísticas (para simular). */
export function addPoint(m: MatchState, t: number, sim = false, now = Date.now()): PointResult {
  if (m.finished) return null;
  const c = m.cfg, s = cur(m), o = 1 - t;
  if (!sim) {
    if (!m.startedAt) m.startedAt = now; if (!s.start) s.start = now;
    let bpFor: number | null = null;
    if (!s.tb) { const r = 1 - m.server; if (addPoint(clone(m), r, true) !== 'point') bpFor = r; }
    if (bpFor !== null) s.bpOpp[bpFor]++;
    m._bp = bpFor;
    s.pts[t]++;
    m.run = m.run.team === t ? { team: t, n: m.run.n + 1 } : { team: t, n: 1 };
    if (m.run.n > s.streak[t]) s.streak[t] = m.run.n;
  }
  if (s.tb) {
    const p = s.tb.p; p[t]++;
    if (!sim) m.timeline.push([String(p[0]), String(p[1])]);
    if (p[t] >= s.tb.target && (c.tbWinBy2 === false || p[t] - p[o] >= 2)) { if (!s.tb.super) s.g[t]++; return winSet(m, t, now); }
    if ((p[0] + p[1]) % 2 === 1) passServe(m);
    return 'point';
  }
  const p = m.pts;
  const starLive = c.deuce === 'star' && p[0] === p[1] && p[0] >= 3 && m.deuces >= 3;
  p[t]++;
  let won: boolean;
  if (c.deuce === 'golden') won = p[t] >= 4;
  else if (c.deuce === 'star') won = p[t] >= 4 && (p[t] - p[o] >= 2 || starLive);
  else won = p[t] >= 4 && p[t] - p[o] >= 2;
  if (!won && p[0] === p[1] && p[0] >= 3) m.deuces++;
  if (!sim) m.timeline.push(pointLabels(m));
  if (won) { if (!sim && m._bp === t) s.bpWon[t]++; return winGame(m, t, now); }
  return 'point';
}
function winGame(m: MatchState, t: number, now: number): PointResult {
  const c = m.cfg, s = cur(m), o = 1 - t;
  s.g[t]++; m.pts = [0, 0]; m.deuces = 0; m.timeline = []; passServe(m);
  if (s.g[t] >= c.gamesPerSet && s.g[t] - s.g[o] >= 2) return winSet(m, t, now);
  if (c.tiebreak && s.g[0] === c.tiebreakAt && s.g[1] === c.tiebreakAt) s.tb = { p: [0, 0], target: c.tbPoints, super: false, first: m.server };
  return 'game';
}
function winSet(m: MatchState, t: number, now: number): PointResult {
  const s = cur(m); s.winner = t; s.end = now; m.setsWon[t]++;
  m.pts = [0, 0]; m.deuces = 0; m.timeline = [];
  if (s.tb) m.server = 1 - s.tb.first;
  if (m.setsWon[t] >= m.cfg.setsToWin) { m.finished = true; m.winner = t; m.endedAt = now; return 'match'; }
  m.sets.push(newSet(m)); return 'set';
}
export function statusBadges(m: MatchState): Badge[] {
  if (m.finished) return [{ l: 'Partido finalizado', k: 'end' }];
  const out: Badge[] = [], s = cur(m), c = m.cfg, p = m.pts;
  if (s.tb) out.push({ l: s.tb.super ? 'Super tie-break' : 'Tie-break', k: 'mode' });
  else if (c.deuce === 'golden' && p[0] === 3 && p[1] === 3) out.push({ l: 'Punto de oro', k: 'hot' });
  else if (c.deuce === 'star' && p[0] === p[1] && p[0] >= 3) out.push(m.deuces >= 3 ? { l: 'Star point', k: 'hot' } : { l: 'Iguales · ventaja ' + m.deuces + ' de 2', k: 'mode' });
  const r = [0, 1].map(t => addPoint(clone(m), t, true));
  if (r.includes('match')) out.push({ l: 'Match point', k: 'hot' });
  else if (r.includes('set')) out.push({ l: 'Set point', k: 'hot' });
  else if (!s.tb && r[1 - m.server] === 'game') out.push({ l: 'Break point', k: 'hot' });
  return out;
}
export function describeCfg(c: MatchRules): string {
  const bo = c.setsToWin === 1 ? 'Set único' : 'Mejor de ' + (c.setsToWin * 2 - 1);
  const parts: string[] = [];
  if (c.setsToWin === 1 && c.decider === 'supertb') {
    parts.push('Super tie-break a ' + c.superTbPoints + (c.tbWinBy2 === false ? ' (muere en ' + c.superTbPoints + ')' : ' (dif. 2)'));
  } else {
    parts.push(bo, 'Sets a ' + c.gamesPerSet);
    parts.push(c.tiebreak ? 'TB a ' + c.tbPoints + ' en ' + c.tiebreakAt + '-' + c.tiebreakAt : 'Sin tie-break');
    parts.push({ advantage: 'Ventaja', golden: 'Punto de oro', star: 'Star point' }[c.deuce]);
    if (c.decider === 'supertb' && c.setsToWin > 1) parts.push('Decisivo: super TB a ' + c.superTbPoints);
  }
  return parts.join(' · ');
}
export const fmtDur = (ms: number): string => {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(mi).padStart(2, '0') + ':' + String(se).padStart(2, '0');
};
