import { describe, it, expect } from 'vitest';
import { renderScene } from './scenes';
import { newMatch, addPoint, presetRules } from '@/lib/scoring/engine';
import { rowToOrg, SCENES, type Match, type SceneKey } from '@/lib/model';

const P = (first: string, last: string) => ({ first, last, country: 'ARG', rank: 1, age: 30, side: 'Revés', hand: 'Derecha', points: 100, photo: null });
function match(scene: SceneKey): Match {
  const st = newMatch(presetRules('pro'));
  for (let i = 0; i < 30; i++) addPoint(st, i % 3 ? 0 : 1);
  return { id: 'm1', orgId: 'o1', event: 'Torneo <script>', eventSlug: 't', court: 'Cancha 1', courtSlug: 'c1', round: 'Final', cat: 'Libre', scheduledAt: '',
    teams: [{ players: [P('Ana', 'Paz'), P('Eva', 'Sol')] }, { players: [P('Ine', 'Luz'), P('Uma', 'Mar')] }], presetKey: 'pro', cfg: st.cfg, state: st,
    display: { scene, timerEndsAt: Date.now() + 60000, timerSec: 60, bioTeam: 1, since: 0 }, h2h: null, status: 'live', updatedAt: '' };
}
const org = rowToOrg({ id: 'o1', name: 'Club', slug: 'club', brand: {}, rot_sec: 8 }, [{ id: 's', name: 'S', image_url: 'https://x/y.png', active: true, banner: true, full_screen: true, sort_order: 0 }]);

describe('escenas de la Pantalla de Score', () => {
  for (const k of Object.keys(SCENES) as SceneKey[]) {
    it(`renderiza ${k} sin errores y escapando texto`, () => {
      const m = match(k);
      const html = renderScene({ m, org, rot: 0, next: match('score') });
      expect(html.length).toBeGreaterThan(200);
      expect(html).not.toContain('<script>');
    });
  }
});
