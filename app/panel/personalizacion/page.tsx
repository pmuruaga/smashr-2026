'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import Stage from '@/components/Stage';
import { fetchOrgMatches, saveBrand, uploadImage } from '@/lib/data';
import { newMatch, presetRules } from '@/lib/scoring/engine';
import { FONT_PRESETS, SCENES, type Brand, type FontKey, type Match, type SceneKey } from '@/lib/model';
import { toast, errMsg } from '@/lib/toast';

/* Partido de muestra para la vista previa cuando la organización todavía no cargó ninguno */
function sampleMatch(orgId: string): Match {
  const P = (first: string, last: string) => ({ first, last, country: 'ARG', rank: 5, age: 27, side: 'Revés', hand: 'Derecha', points: 1500, photo: null });
  const st = newMatch(presetRules('oro'));
  return { id: 'muestra', orgId, event: 'Torneo de ejemplo', eventSlug: 'ejemplo', court: 'Cancha 1', courtSlug: 'cancha-1', round: 'Final', cat: 'Categoría libre', scheduledAt: '',
    teams: [{ players: [P('Lucía', 'Ferreyra'), P('Camila', 'Juárez')] }, { players: [P('Sofía', 'Ledesma'), P('Valentina', 'Ríos')] }],
    presetKey: 'oro', cfg: st.cfg, state: st, display: { scene: 'score', timerEndsAt: null, timerSec: null, bioTeam: 0, since: 0 }, h2h: null, status: 'live', updatedAt: '' };
}

export default function Personalizacion() {
  const { org, reload } = useOrg();
  const [draft, setDraft] = useState<Brand>(org.brand);
  const [scene, setScene] = useState<SceneKey>('score');
  const [sample, setSample] = useState<Match>(() => sampleMatch(org.id));
  const [busy, setBusy] = useState('');
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(org.brand); }, [org.brand]);
  useEffect(() => { fetchOrgMatches(org.id).then(ms => { const m = ms.find(x => x.status === 'live') || ms[0]; if (m) setSample(m); }).catch(() => {}); }, [org.id]);

  const preview = useMemo(() => ({ ...org, brand: draft }), [org, draft]);
  const previewMatch = useMemo<Match>(() => {
    const sc = SCENES[scene];
    return { ...sample, display: { ...sample.display, scene, timerEndsAt: sc.timer ? Date.now() + (sc.defaultSec || 0) * 1000 : null } };
  }, [sample, scene]);

  function set(patch: Partial<Brand>, immediate = false) {
    const next = { ...draft, ...patch }; setDraft(next);
    if (saveT.current) clearTimeout(saveT.current);
    const doSave = () => saveBrand(org, next).then(reload).catch(e => toast(errMsg(e)));
    if (immediate) doSave(); else saveT.current = setTimeout(doSave, 500);
  }
  async function upload(kind: 'logo' | 'bg', f: File | undefined) {
    if (!f) return; setBusy(kind);
    try { const url = await uploadImage(org.id, kind, f); set({ [kind]: url } as Partial<Brand>, true); toast(kind === 'logo' ? 'Logo actualizado' : 'Fondo actualizado'); }
    catch (e) { toast(errMsg(e)); } finally { setBusy(''); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Personalización</h1><p>Cómo se ven tus tableros. Los cambios se aplican al instante en todas las canchas.</p></div></div>
      <div className="cust">
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="card">
            <h2>Logo</h2>
            <div className="logo-prev">{draft.logo && <img src={draft.logo} alt="Logo actual" />}</div>
            <span className="btn file">{busy === 'logo' ? 'Subiendo…' : 'Subir logo (PNG con fondo transparente)'}<input type="file" accept="image/*" aria-label="Subir logo" onChange={e => { upload('logo', e.target.files?.[0]); e.target.value = ''; }} /></span>
          </section>
          <section className="card">
            <h2>Fondo del tablero</h2>
            <div className="row">
              <span className="btn file">{busy === 'bg' ? 'Subiendo…' : 'Subir fondo'}<input type="file" accept="image/*" aria-label="Subir fondo" onChange={e => { upload('bg', e.target.files?.[0]); e.target.value = ''; }} /></span>
              <button className="btn" type="button" onClick={() => set({ bg: null }, true)}>Usar fondo Smashr</button>
            </div>
            <div className="row"><label className="hint" htmlFor="dim">Oscurecer fondo</label><input type="range" id="dim" min={0} max={90} step={5} value={draft.dim} onChange={e => set({ dim: Number(e.target.value) })} /></div>
            <p className="hint">Ideal 1920×1080, máximo 5 MB. El oscurecido asegura que el marcador se lea con cualquier imagen.</p>
          </section>
          <section className="card">
            <h2>Colores y tipografía</h2>
            <div className="row"><input type="color" id="accent" value={draft.accent} onChange={e => set({ accent: e.target.value })} /><label htmlFor="accent">Color principal <span className="hint">· placas, puntos, bordes</span></label></div>
            <div className="row"><input type="color" id="accent2" value={draft.accent2} onChange={e => set({ accent2: e.target.value })} /><label htmlFor="accent2">Color secundario <span className="hint">· categoría, textos de apoyo</span></label></div>
            <label className="field" htmlFor="font">Tipografía del tablero
              <select id="font" value={draft.font} onChange={e => set({ font: e.target.value as FontKey }, true)}>
                {Object.entries(FONT_PRESETS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </select></label>
          </section>
          <section className="card">
            <h2>Jugadores</h2>
            <label className="switch"><input type="checkbox" checked={draft.showPhotos} onChange={e => set({ showPhotos: e.target.checked }, true)} />Mostrar fotos de los jugadores en el marcador</label>
            <p className="hint">Si un jugador no tiene foto, se muestran sus iniciales.</p>
          </section>
        </div>
        <section className="card" style={{ position: 'sticky', top: 80 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>Vista previa</h2>
            <div className="tabs">{(Object.keys(SCENES) as SceneKey[]).map(k => <button key={k} type="button" aria-pressed={k === scene} onClick={() => setScene(k)}>{SCENES[k].label}</button>)}</div></div>
          <Stage m={previewMatch} org={preview} />
          <p className="hint">{sample.id === 'muestra' ? 'Partido de muestra: creá uno para verlo con tus datos.' : `Mostrando el partido de ${sample.court}.`}</p>
        </section>
      </div>
    </main>
  );
}
