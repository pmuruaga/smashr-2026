import { describe, it, expect } from 'vitest';
import { newMatch, addPoint, presetRules, pointLabels, statusBadges, describeCfg, chooseServer, currentServer, type MatchState } from './engine';

const game = (m: MatchState, t: number) => { for (let i = 0; i < 4; i++) addPoint(m, t); };
const pts = (m: MatchState, seq: string) => { for (const c of seq) addPoint(m, Number(c)); };

describe('motor de reglas', () => {
  it('star point: tras el tercer iguales el siguiente punto gana el game', () => {
    const m = newMatch(presetRules('pro'));
    pts(m, '000111');
    expect(pointLabels(m)).toEqual(['40', '40']);
    expect(statusBadges(m)[0].l).toBe('Iguales · ventaja 1 de 2');
    pts(m, '0101');
    expect(m.deuces).toBe(3);
    expect(statusBadges(m).map(b => b.l)).toContain('Star point');
    addPoint(m, 1);
    expect(m.sets[0].g).toEqual([0, 1]);
  });

  it('punto de oro: en 40-40 el siguiente punto gana', () => {
    const m = newMatch(presetRules('oro'));
    pts(m, '000111');
    expect(statusBadges(m)[0].l).toBe('Punto de oro');
    addPoint(m, 0);
    expect(m.sets[0].g).toEqual([1, 0]);
  });

  it('ventaja clásica: hacen falta dos puntos de diferencia', () => {
    const m = newMatch(presetRules('ventaja'));
    pts(m, '0001110');
    expect(pointLabels(m)).toEqual(['AD', '40']);
    addPoint(m, 1);
    expect(pointLabels(m)).toEqual(['40', '40']);
    pts(m, '00');
    expect(m.sets[0].g).toEqual([1, 0]);
  });

  it('tie-break a 7 en 6-6 y super TB a 10 en el set decisivo', () => {
    const m = newMatch(presetRules('oro'));
    for (let i = 0; i < 6; i++) { game(m, 0); game(m, 1); }
    expect(m.sets[0].tb?.super).toBe(false);
    for (let i = 0; i < 7; i++) addPoint(m, 0);
    expect(m.sets[0].g).toEqual([7, 6]);
    for (let i = 0; i < 6; i++) game(m, 1);
    expect(m.setsWon).toEqual([1, 1]);
    expect(m.sets[2].tb?.super).toBe(true);
    for (let i = 0; i < 9; i++) { addPoint(m, 0); addPoint(m, 1); }
    expect(m.finished).toBe(false);
    pts(m, '00');
    expect(m.finished).toBe(true);
    expect(m.sets[2].tb?.p).toEqual([11, 9]);
  });

  it('set único a 9 con tie-break en 8-8', () => {
    const m = newMatch(presetRules('set9'));
    for (let i = 0; i < 8; i++) { game(m, 0); game(m, 1); }
    expect(m.sets[0].tb).not.toBeNull();
  });

  it('super TB a 10 con muerte súbita: 9-10 termina el partido', () => {
    const m = newMatch(presetRules('tb10'));
    for (let i = 0; i < 9; i++) { addPoint(m, 0); addPoint(m, 1); }
    addPoint(m, 1);
    expect(m.finished).toBe(true);
    expect(m.winner).toBe(1);
  });

  it('detecta set point y match point', () => {
    const m = newMatch(presetRules('ventaja'));
    for (let i = 0; i < 5; i++) game(m, 0);
    pts(m, '000');
    expect(statusBadges(m).map(b => b.l)).toContain('Set point');
    addPoint(m, 0);
    for (let i = 0; i < 5; i++) game(m, 0);
    pts(m, '000');
    expect(statusBadges(m).map(b => b.l)).toContain('Match point');
  });

  it('describe el formato', () => {
    expect(describeCfg(presetRules('pro'))).toBe('Mejor de 3 · Sets a 6 · TB a 7 en 6-6 · Star point');
  });

  it('orden de saque por jugador: elegidos 3 y 1, después siguen 4 y 2', () => {
    const m = newMatch(presetRules('oro'));
    // jugador 3 = pareja B (1), primer jugador (0); jugador 1 = pareja A (0), primer jugador (0)
    chooseServer(m, 1, 0);
    chooseServer(m, 0, 0);
    const order: string[] = [];
    const who = () => { const s = currentServer(m); return String(s.team * 2 + s.player + 1); };
    for (let g = 0; g < 5; g++) { order.push(who()); game(m, 0); }
    expect(order).toEqual(['3', '1', '4', '2', '3']);
  });

  it('el saque en el tie-break rota cada dos puntos respetando el orden', () => {
    const m = newMatch(presetRules('ventaja'));
    for (let i = 0; i < 6; i++) { game(m, 0); game(m, 1); }
    const s0 = currentServer(m);
    addPoint(m, 0);
    const s1 = currentServer(m);
    expect(s1.team).toBe(1 - s0.team);
    addPoint(m, 0); addPoint(m, 0);
    const s3 = currentServer(m);
    expect(s3.team).toBe(s0.team);
    expect(s3.player).toBe(1 - s0.player);
  });

  it('partidos viejos sin jugador de saque siguen funcionando', () => {
    const m = newMatch(presetRules('oro')); delete m.srvPlayer;
    game(m, 0);
    expect(currentServer(m)).toEqual({ team: 1, player: 0 });
  });
});
