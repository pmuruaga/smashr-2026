'use client';
/* Jugadores de la organización.
   - players: identidad compartida (la edita solo la org dueña).
   - org_players: vínculo con cada org + categoría y posición propias de esa org.
   La seguridad vive en la base (RLS, migración 0004). */
import { supabaseBrowser } from './supabase/client';

const sb = () => supabaseBrowser();

export type Gender = 'M' | 'F' | 'X';
export type Hand = 'derecha' | 'izquierda';
export type Position = 'drive' | 'reves' | 'ambas';

export const GENDERS: Record<Gender, string> = { M: 'Masculino', F: 'Femenino', X: 'Otro' };
export const HANDS: Record<Hand, string> = { derecha: 'Derecha', izquierda: 'Zurda' };
export const POSITIONS: Record<Position, string> = { drive: 'Drive', reves: 'Revés', ambas: 'Ambas' };

/** Datos de identidad (tabla players) */
export interface PlayerIdentity {
  firstName: string; lastName: string; dni: string | null; city: string;
  gender: Gender | null; hand: Hand | null; birthDate: string | null; photoUrl: string | null;
}
/** Datos propios de la org (tabla org_players) */
export interface PlayerOrgData { category: string; position: Position | null; ranking: number | null; rankingPoints: number }
export interface OrgPlayer extends PlayerIdentity, PlayerOrgData { id: string; ownerOrgId: string | null; isOwner: boolean }

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToOrgPlayer(r: any, orgId: string): OrgPlayer {
  const p = r.players;
  return {
    id: p.id, ownerOrgId: p.owner_org_id, isOwner: p.owner_org_id === orgId,
    firstName: p.first_name, lastName: p.last_name, dni: p.dni, city: p.city || '',
    gender: p.gender, hand: p.hand, birthDate: p.birth_date, photoUrl: p.photo_url,
    category: r.category || '', position: r.position, ranking: r.ranking ?? null, rankingPoints: r.ranking_points ?? 0,
  };
}
const identityCols = (d: PlayerIdentity) => ({
  first_name: d.firstName.trim(), last_name: d.lastName.trim(), dni: d.dni?.trim() || null, city: d.city.trim(),
  gender: d.gender || null, hand: d.hand || null, birth_date: d.birthDate || null, photo_url: d.photoUrl || null,
});

export async function fetchOrgPlayers(orgId: string): Promise<OrgPlayer[]> {
  const { data, error } = await sb().from('org_players').select('category, position, ranking, ranking_points, players(*)').eq('org_id', orgId);
  if (error) throw error;
  return (data || []).filter((r: any) => r.players).map((r: any) => rowToOrgPlayer(r, orgId))
    .sort((a: OrgPlayer, b: OrgPlayer) => a.lastName.localeCompare(b.lastName, 'es') || a.firstName.localeCompare(b.firstName, 'es'));
}

/** Alta: crea el jugador (la base lo vincula sola a la org) y guarda categoría/posición de la org. */
export async function createPlayer(orgId: string, d: PlayerIdentity, o: PlayerOrgData): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await sb().from('players').insert({ id, owner_org_id: orgId, ...identityCols(d) });
  if (error) throw friendly(error);
  await updateOrgPlayer(orgId, id, o);
  return id;
}
/** Solo la org dueña puede cambiar la identidad. */
export async function updatePlayerIdentity(id: string, d: PlayerIdentity) {
  const { error } = await sb().from('players').update(identityCols(d)).eq('id', id);
  if (error) throw friendly(error);
}
/** Cada org cambia su propia categoría, posición y ranking. */
export async function updateOrgPlayer(orgId: string, playerId: string, o: PlayerOrgData) {
  const { error } = await sb().from('org_players').update({ category: o.category.trim(), position: o.position || null, ranking: o.ranking || null, ranking_points: Math.max(0, o.rankingPoints || 0) })
    .eq('org_id', orgId).eq('player_id', playerId);
  if (error) throw friendly(error);
}
/** Solo la org dueña puede borrar (lo quita de todas las orgs con las que estaba compartido). */
export async function deletePlayer(id: string) {
  const { error } = await sb().from('players').delete().eq('id', id);
  if (error) throw friendly(error);
}

function friendly(e: { message?: string; code?: string }) {
  if (e.code === '23505' && String(e.message).includes('dni')) return new Error('Ya tenés un jugador cargado con ese DNI');
  if (e.code === '23514' && String(e.message).includes('dni')) return new Error('El DNI tiene que tener entre 6 y 9 números, sin puntos');
  return new Error(e.message || 'Error inesperado');
}

/* ---------- utilidades ---------- */
export const fullName = (p: Pick<PlayerIdentity, 'firstName' | 'lastName'>) => `${p.lastName}, ${p.firstName}`;
export function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00:00'), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
/** Normaliza para buscar sin tildes ni mayúsculas */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function matchesQuery(p: OrgPlayer, q: string) {
  const t = norm(q.trim()); if (!t) return true;
  const hay = norm(`${p.firstName} ${p.lastName} ${p.lastName} ${p.firstName} ${p.dni || ''} ${p.city} ${p.category}`);
  return t.split(/\s+/).every(w => hay.includes(w));
}
