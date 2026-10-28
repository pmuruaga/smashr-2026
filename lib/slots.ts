/* Lugares de jugador de un partido (Nuevo/Editar partido): lógica pura, sin UI.
   El partido guarda una copia de los datos + playerId, así los partidos jugados no cambian si después se edita el jugador. */
import { ageFrom, HANDS, POSITIONS, type OrgPlayer } from './players';
import type { Player } from './model';

export interface Slot {
  player: OrgPlayer | null;   // vinculado a la base de jugadores
  legacy: Player | null;      // partido viejo cargado a mano (sin playerId)
  base: Player | null;        // cómo estaba guardado en el partido (al editar)
  side: string; hand: string; rank: string; points: string; // ficha de ESTE partido
}
export type Slots = Slot[][];
export const emptySlots = (): Slots => [[emptySlot(), emptySlot()], [emptySlot(), emptySlot()]];
export const emptySlot = (): Slot => ({ player: null, legacy: null, base: null, side: 'Drive', hand: 'Derecha', rank: '', points: '' });
export const SIDES = ['Drive', 'Revés', 'Ambas'];
export const HAND_LABELS = ['Derecha', 'Zurda'];

/** Elegir un jugador de la base: la ficha arranca con sus datos del club */
export function slotFor(p: OrgPlayer, base: Player | null = null): Slot {
  return {
    player: p, legacy: null, base,
    side: p.position ? POSITIONS[p.position] : 'Drive', hand: p.hand ? HANDS[p.hand] : 'Derecha',
    rank: p.ranking ? String(p.ranking) : '', points: p.rankingPoints ? String(p.rankingPoints) : '',
  };
}
/** Al editar un partido: conserva la ficha guardada en el partido */
export function slotFromMatch(mp: Player, list: OrgPlayer[]): Slot {
  const ficha = {
    side: mp.side || 'Drive', hand: mp.hand || 'Derecha',
    rank: mp.rank === '-' || mp.rank == null ? '' : String(mp.rank), points: mp.points ? String(mp.points) : '',
  };
  const p = mp.playerId ? list.find(x => x.id === mp.playerId) : undefined;
  return p ? { player: p, legacy: null, base: mp, ...ficha } : { player: null, legacy: mp, base: mp, ...ficha };
}
export const slotReady = (s: Slot) => !!(s.player || s.legacy);
/** Lo que se guarda en matches.teams */
export function slotToPlayer(s: Slot): Player {
  const ficha = { rank: s.rank.trim() || '-', side: s.side, hand: s.hand, points: Number(s.points) || 0 };
  if (s.player) {
    const p = s.player, age = ageFrom(p.birthDate);
    return {
      ...(s.base || {}), first: p.firstName, last: p.lastName, country: s.base?.country || 'ARG',
      age: age ?? (s.base?.age ?? '-'), photo: p.photoUrl ?? s.base?.photo ?? null, playerId: p.id, ...ficha,
    };
  }
  return { ...(s.legacy as Player), ...ficha };
}

