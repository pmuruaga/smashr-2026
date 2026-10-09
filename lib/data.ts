'use client';
/* Acceso a datos desde el navegador (Mesa de Control y tableros).
   Las reglas de seguridad viven en la base (RLS): un operador solo puede escribir en su organización. */
import { supabaseBrowser } from './supabase/client';
import { addPoint, chooseServer, clone, newMatch, type MatchRules } from './scoring/engine';
import { rowToMatch, rowToOrg, rowToSponsor, slugify, SCENES, type Match, type Org, type SceneKey, type Team, type Sponsor, type Brand } from './model';

const sb = () => supabaseBrowser();

/* ---------- organización ---------- */
export async function fetchOrg(orgId: string): Promise<Org> {
  const [{ data: o, error }, { data: sp }] = await Promise.all([
    sb().from('organizations').select('*').eq('id', orgId).single(),
    sb().from('sponsors').select('*').eq('org_id', orgId).order('sort_order'),
  ]);
  if (error) throw error;
  return rowToOrg(o, sp || []);
}
export async function fetchOrgBySlug(slug: string): Promise<Org | null> {
  const { data: o } = await sb().from('organizations').select('*').eq('slug', slug).maybeSingle();
  if (!o) return null;
  const { data: sp } = await sb().from('sponsors').select('*').eq('org_id', o.id).order('sort_order');
  return rowToOrg(o, sp || []);
}
export async function saveBrand(org: Org, patch: Partial<Brand>) {
  const stored = { ...org.brand, ...patch };
  if (stored.logo?.startsWith('data:')) stored.logo = null; // el logo por defecto se genera, no se guarda
  const { error } = await sb().from('organizations').update({ brand: stored }).eq('id', org.id);
  if (error) throw error;
}
export async function saveRotSec(orgId: string, sec: number) {
  const { error } = await sb().from('organizations').update({ rot_sec: sec }).eq('id', orgId);
  if (error) throw error;
}

/* ---------- imágenes (Storage: brand-assets/orgs/{org}/{tipo}/...) ---------- */
export async function uploadImage(orgId: string, kind: 'logo' | 'bg' | 'sponsors' | 'players', file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera los 5 MB');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `orgs/${orgId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from('brand-assets').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw error;
  return sb().storage.from('brand-assets').getPublicUrl(path).data.publicUrl;
}

/* ---------- sponsors ---------- */
export async function addSponsor(orgId: string, name: string, imageUrl: string, sortOrder: number): Promise<Sponsor> {
  const { data, error } = await sb().from('sponsors').insert({ org_id: orgId, name, image_url: imageUrl, sort_order: sortOrder }).select().single();
  if (error) throw error;
  return rowToSponsor(data);
}
export async function updateSponsor(id: string, patch: Partial<{ name: string; image_url: string; active: boolean; banner: boolean; full_screen: boolean; sort_order: number }>) {
  const { error } = await sb().from('sponsors').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteSponsor(id: string) {
  const { error } = await sb().from('sponsors').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- partidos ---------- */
export async function fetchOrgMatches(orgId: string): Promise<Match[]> {
  const { data, error } = await sb().from('matches').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToMatch);
}
export async function fetchMatch(id: string): Promise<Match | null> {
  const { data } = await sb().from('matches').select('*').eq('id', id).maybeSingle();
  return data ? rowToMatch(data) : null;
}
export async function createMatch(orgId: string, d: { event: string; court: string; round: string; cat: string; scheduledAt: string; teams: [Team, Team]; presetKey: string; cfg: MatchRules }): Promise<Match> {
  const { data, error } = await sb().from('matches').insert({
    org_id: orgId, event: d.event, event_slug: slugify(d.event), court: d.court, court_slug: slugify(d.court),
    round: d.round, category: d.cat, scheduled_at: d.scheduledAt, teams: d.teams, preset_key: d.presetKey,
    rules: d.cfg, state: newMatch(d.cfg), display: { scene: 'score', timerEndsAt: null, timerSec: null, bioTeam: 0, since: Date.now() },
    status: 'scheduled',
  }).select().single();
  if (error) throw error;
  return rowToMatch(data);
}
/** Edita un partido que todavía no empezó. Si cambia el formato, el marcador se rearma (sigue en 0) conservando quién saca.
    Solo actualiza si sigue en estado 'scheduled' (si alguien lo empezó mientras tanto, no pisa nada). */
export async function updateScheduledMatch(m: Match, d: { event: string; court: string; round: string; cat: string; scheduledAt: string; teams: [Team, Team]; presetKey: string; cfg: MatchRules }) {
  const strip = (c: MatchRules) => { const x = clone(c); delete x.label; return JSON.stringify(x); };
  const rulesChanged = strip(d.cfg) !== strip(m.cfg);
  const state = rulesChanged
    ? { ...newMatch(d.cfg), server: m.state.server, srvPlayer: m.state.srvPlayer, srvChosen: m.state.srvChosen }
    : m.state;
  const { data, error } = await sb().from('matches').update({
    event: d.event, event_slug: slugify(d.event), court: d.court, court_slug: slugify(d.court),
    round: d.round, category: d.cat, scheduled_at: d.scheduledAt, teams: d.teams, preset_key: d.presetKey,
    rules: d.cfg, state,
  }).eq('id', m.id).eq('status', 'scheduled').select('id');
  if (error) throw error;
  if (!data || !data.length) throw new Error('El partido ya empezó, no se puede editar.');
}
export async function deleteMatch(id: string) {
  const { error } = await sb().from('matches').delete().eq('id', id);
  if (error) throw error;
}

/* Acciones de la mesa de control: calculan el nuevo estado con el motor y lo persisten.
   Devuelven el partido actualizado para pintarlo al instante (optimista). */
async function persist(m: Match, cols: Record<string, unknown>) {
  const { error } = await sb().from('matches').update(cols).eq('id', m.id);
  if (error) throw error;
}
export async function actPoint(m: Match, k: number): Promise<Match> {
  if (m.state.finished) return m;
  const before = clone(m.state);
  const next: Match = clone(m);
  addPoint(next.state, k);
  next.status = next.state.finished ? 'finished' : 'live';
  if (next.display.scene !== 'score') next.display = { ...next.display, scene: 'score', timerEndsAt: null, since: Date.now() }; // al anotar, el tablero vuelve solo al marcador
  const { error } = await sb().from('match_events').insert({ match_id: m.id, org_id: m.orgId, kind: 'point', team: k, state_before: before });
  if (error) throw error;
  await persist(next, { state: next.state, status: next.status, display: next.display });
  return next;
}
export async function actUndo(m: Match): Promise<Match> {
  const { data: ev } = await sb().from('match_events').select('id,state_before').eq('match_id', m.id).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!ev) return m;
  const next: Match = { ...clone(m), state: ev.state_before };
  next.status = next.state.finished ? 'finished' : (next.state.startedAt ? 'live' : m.status === 'finished' ? 'live' : m.status);
  await persist(next, { state: next.state, status: next.status });
  await sb().from('match_events').delete().eq('id', ev.id);
  return next;
}
export async function actToggleServe(m: Match): Promise<Match> {
  const next = clone(m); next.state.server = 1 - next.state.server;
  await persist(next, { state: next.state });
  return next;
}
export async function actChooseServer(m: Match, team: number, player: number): Promise<Match> {
  const next = clone(m); chooseServer(next.state, team, player);
  await persist(next, { state: next.state });
  return next;
}
/** Sorteo: elige al azar paleta o pelota y lo muestra en el tablero (la moneda gira en todas las pantallas a la vez). */
export async function actToss(m: Match): Promise<Match> {
  const r = new Uint8Array(1); crypto.getRandomValues(r);
  const next = clone(m);
  next.display = { ...next.display, scene: 'toss', since: Date.now(), timerEndsAt: null, timerSec: null,
    toss: { result: r[0] % 2 === 0 ? 'paleta' : 'pelota', at: Date.now() } };
  await persist(next, { display: next.display });
  return next;
}
export async function actScene(m: Match, scene: SceneKey, opts: { sec?: number; bioTeam?: number } = {}): Promise<Match> {
  const sc = SCENES[scene], next = clone(m);
  const sec = opts.sec || sc.defaultSec || 0;
  next.display = { ...next.display, scene, since: Date.now(),
    timerSec: sc.timer ? sec : null, timerEndsAt: sc.timer ? Date.now() + sec * 1000 : null,
    bioTeam: opts.bioTeam ?? next.display.bioTeam,
    toss: scene === 'toss' ? null : next.display.toss ?? null };
  if (next.status === 'scheduled' && scene === 'warmup') next.status = 'live';
  await persist(next, { display: next.display, status: next.status });
  return next;
}
export async function actAddTime(m: Match, sec: number): Promise<Match> {
  if (!m.display.timerEndsAt) return m;
  const next = clone(m); next.display.timerEndsAt = Math.max(Date.now(), m.display.timerEndsAt) + sec * 1000;
  await persist(next, { display: next.display });
  return next;
}

/* ---------- tiempo real ---------- */
type Unsub = () => void;
export function watchMatch(id: string, onChange: (m: Match) => void): Unsub {
  const ch = sb().channel('match-' + id + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, (p: { new: unknown }) => onChange(rowToMatch(p.new)))
    .subscribe();
  return () => { sb().removeChannel(ch); };
}
export function watchOrg(orgId: string, onAny: () => void): Unsub {
  const ch = sb().channel('org-' + orgId + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `org_id=eq.${orgId}` }, onAny)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors', filter: `org_id=eq.${orgId}` }, onAny)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizations', filter: `id=eq.${orgId}` }, onAny)
    .subscribe();
  return () => { sb().removeChannel(ch); };
}

/* El partido que muestra el tablero de una cancha: en juego > próximo programado > último finalizado */
export function pickCourtMatch(list: Match[]): Match | null {
  const live = list.filter(m => m.status === 'live').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (live[0]) return live[0];
  const done = list.filter(m => m.status === 'finished').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // un partido recién terminado se sigue mostrando 5 minutos (ganadores), después pasa al próximo
  if (done[0] && Date.now() - Date.parse(done[0].updatedAt) < 5 * 60_000) return done[0];
  const sched = list.filter(m => m.status === 'scheduled').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (sched[0]) return sched[0];
  return done[0] || null;
}
/* Próximo partido para la escena "Próximo partido": programado, misma cancha primero */
export function findNext(all: Match[], m: Match): Match | null {
  const list = all.filter(x => x.status === 'scheduled' && x.id !== m.id);
  return list.find(x => x.court === m.court) || list[0] || null;
}
