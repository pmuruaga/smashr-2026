import { describe, expect, it } from 'vitest';
import { slotFor, slotFromMatch, slotReady, slotToPlayer } from './slots';
import type { OrgPlayer } from './players';
import type { Player } from './model';

const op = (o: Partial<OrgPlayer> = {}): OrgPlayer => ({
  id: 'p1', ownerOrgId: 'o1', isOwner: true, firstName: 'Ana', lastName: 'Gómez', dni: null, city: '', gender: 'F',
  hand: 'izquierda', birthDate: null, photoUrl: null, category: '6ta', position: 'reves', ranking: 12, rankingPoints: 1250, ...o,
});
const legacy: Player = { first: 'Juan', last: 'Pérez', country: 'ARG', rank: 3, age: 30, side: 'Drive', hand: 'Derecha', points: 0, photo: 'x.png' };

describe('jugadores en el partido', () => {
  it('al elegir de la base, la ficha toma los datos del club y guarda playerId', () => {
    const p = slotToPlayer(slotFor(op()));
    expect(p).toMatchObject({ first: 'Ana', last: 'Gómez', side: 'Revés', hand: 'Zurda', rank: '12', points: 1250, playerId: 'p1', country: 'ARG', age: '-' });
  });
  it('ajustar la ficha cambia solo el partido', () => {
    const s = { ...slotFor(op()), side: 'Drive', rank: '' };
    expect(slotToPlayer(s)).toMatchObject({ side: 'Drive', rank: '-' });
  });
  it('partido viejo cargado a mano se conserva igual', () => {
    const s = slotFromMatch(legacy, [op()]);
    expect(s.player).toBeNull(); expect(slotReady(s)).toBe(true);
    expect(slotToPlayer(s)).toEqual({ ...legacy, rank: '3' });
  });
  it('partido con playerId se re-vincula y conserva su ficha', () => {
    const mp: Player = { ...legacy, first: 'Ana', last: 'Gómez', side: 'Drive', playerId: 'p1' };
    const s = slotFromMatch(mp, [op()]);
    expect(s.player?.id).toBe('p1');
    expect(slotToPlayer(s)).toMatchObject({ side: 'Drive', playerId: 'p1', photo: 'x.png' });
  });
  it('vincular un jugador viejo a la base conserva país y foto si el jugador no tiene', () => {
    expect(slotToPlayer(slotFor(op(), legacy))).toMatchObject({ playerId: 'p1', country: 'ARG', photo: 'x.png', age: 30 });
  });
  it('lugar vacío no está listo', () => {
    expect(slotReady({ player: null, legacy: null, base: null, side: '', hand: '', rank: '', points: '' })).toBe(false);
  });
});
