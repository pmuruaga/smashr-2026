/* Modelo de la app: tipos, mapeo de filas de Supabase y utilidades compartidas. */
import type { MatchRules, MatchState } from './scoring/engine';

export interface Player { first: string; last: string; country: string; rank: string | number; age: string | number; side: string; hand: string; points: number; photo: string | null }
export interface Team { players: [Player, Player] }
export type TossFace = 'paleta' | 'pelota';
export interface Display { scene: SceneKey; timerEndsAt: number | null; timerSec: number | null; bioTeam: number; since: number; toss?: { result: TossFace; at: number } | null }
export interface H2H { a: number; b: number; meet: { ev: string; sa: number[]; sb: number[]; w: number }[] }
export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match {
  id: string; orgId: string;
  event: string; eventSlug: string; court: string; courtSlug: string;
  round: string; cat: string; scheduledAt: string;
  teams: [Team, Team]; presetKey: string; cfg: MatchRules;
  state: MatchState; display: Display; h2h: H2H | null; status: MatchStatus;
  updatedAt: string;
}
export interface Brand { logo: string | null; bg: string | null; dim: number; accent: string; accent2: string; font: FontKey; showPhotos: boolean }
export interface Sponsor { id: string; name: string; img: string; active: boolean; banner: boolean; full: boolean; sortOrder: number }
export interface Org { id: string; name: string; slug: string; brand: Brand; rotSec: number; sponsors: Sponsor[] }

export type FontKey = 'broadcast' | 'deportiva' | 'tecnica';
export const FONT_PRESETS: Record<FontKey, { label: string; display: string; italic: boolean }> = {
  broadcast: { label: 'Transmisión (condensada itálica)', display: "'Barlow Condensed','Arial Narrow',Arial,sans-serif", italic: true },
  deportiva: { label: 'Deportiva (Oswald)', display: "'Oswald','Arial Narrow',Arial,sans-serif", italic: false },
  tecnica: { label: 'Técnica (Rajdhani)', display: "'Rajdhani','Arial Narrow',Arial,sans-serif", italic: false },
};

export type SceneKey = 'score' | 'warmup' | 'break' | 'h2h' | 'summary' | 'bio' | 'next' | 'toss';
export const SCENES: Record<SceneKey, { label: string; hint: string; timer?: boolean; defaultSec?: number }> = {
  score: { label: 'Marcador', hint: 'Pantalla principal' },
  warmup: { label: 'Calentamiento', hint: 'Reloj + publicidad', timer: true, defaultSec: 300 },
  break: { label: 'Pausa / cambio de lado', hint: 'Sponsor + marcador', timer: true, defaultSec: 90 },
  h2h: { label: 'VS', hint: 'Cara a cara, antes del partido' },
  summary: { label: 'Resumen del set', hint: 'Al terminar un set' },
  bio: { label: 'Ficha de jugadores', hint: 'Presentación de pareja' },
  next: { label: 'Próximo partido', hint: 'Entre partidos' },
  toss: { label: 'Sorteo', hint: 'Moneda: paleta o pelota' },
};

/* ---------- utilidades ---------- */
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const up = (s: unknown) => esc(String(s ?? '').toUpperCase());
export const slugify = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const teamName = (m: Pick<Match, 'teams'>, i: number) => m.teams[i].players.map(p => p.last).join(' / ');
const svgUri = (s: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

export function defaultLogo(name: string, color: string) {
  const word = esc(name.toUpperCase().slice(0, 14));
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200">
  <circle cx="80" cy="100" r="56" fill="${color}"/><path d="M38 78 Q80 100 38 122 M122 78 Q80 100 122 122" stroke="#111" stroke-width="7" fill="none"/>
  <text x="156" y="118" font-family="Arial Black,Arial,sans-serif" font-style="italic" font-weight="900" font-size="54" fill="#fff">${word}</text></svg>`);
}

export const DEFAULT_BRAND: Brand = { logo: null, bg: null, dim: 55, accent: '#c9a15c', accent2: '#f1eee7', font: 'broadcast', showPhotos: false };

/* ---------- mapeo de filas ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToOrg(row: any, sponsorRows: any[] = []): Org {
  const brand: Brand = { ...DEFAULT_BRAND, ...(row.brand || {}) };
  if (!brand.logo) brand.logo = defaultLogo(row.name, brand.accent);
  return {
    id: row.id, name: row.name, slug: row.slug, brand, rotSec: row.rot_sec ?? 8,
    sponsors: sponsorRows.map(rowToSponsor).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
export function rowToSponsor(r: any): Sponsor {
  return { id: r.id, name: r.name, img: r.image_url, active: r.active, banner: r.banner, full: r.full_screen, sortOrder: r.sort_order };
}
export function rowToMatch(r: any): Match {
  return {
    id: r.id, orgId: r.org_id, event: r.event, eventSlug: r.event_slug, court: r.court, courtSlug: r.court_slug,
    round: r.round, cat: r.category, scheduledAt: r.scheduled_at, teams: r.teams, presetKey: r.preset_key, cfg: r.rules,
    state: r.state, display: { scene: 'score', timerEndsAt: null, timerSec: null, bioTeam: 0, since: 0, ...(r.display || {}) },
    h2h: r.h2h, status: r.status, updatedAt: r.updated_at,
  };
}
