import { describe, it, expect } from 'vitest';
import { newMatch, addPoint, presetRules, pointLabels, statusBadges, describeCfg, type MatchState } from './engine';

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
});
