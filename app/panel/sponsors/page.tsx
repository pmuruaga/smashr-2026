'use client';
import { useState } from 'react';
import { useOrg } from '@/components/OrgProvider';
import { addSponsor, deleteSponsor, saveRotSec, updateSponsor, uploadImage } from '@/lib/data';
import { toast, errMsg } from '@/lib/toast';
import type { Sponsor } from '@/lib/model';

export default function SponsorsPage() {
  const { org, reload } = useOrg();
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const list = org.sponsors;

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await reload(); if (ok) toast(ok); } catch (e) { toast(errMsg(e)); }
  };
  async function add(files: FileList | null) {
    if (!files?.length) return; setBusy(true);
    await act(async () => {
      let order = list.length ? Math.max(...list.map(s => s.sortOrder)) + 1 : 0;
      for (const f of Array.from(files)) { const url = await uploadImage(org.id, 'sponsors', f); await addSponsor(org.id, f.name.replace(/\.[^.]+$/, ''), url, order++); }
    }, 'Sponsor agregado');
    setBusy(false);
  }
  async function move(i: number, dir: number) {
    const a = list[i], b = list[i + dir]; if (!a || !b) return;
    await act(() => Promise.all([updateSponsor(a.id, { sort_order: b.sortOrder }), updateSponsor(b.id, { sort_order: a.sortOrder === b.sortOrder ? b.sortOrder + dir : a.sortOrder })]));
  }
  async function del(s: Sponsor) {
    if (confirmId !== s.id) { setConfirmId(s.id); setTimeout(() => setConfirmId(c => (c === s.id ? null : c)), 4000); return; }
    setConfirmId(null); await act(() => deleteSponsor(s.id), 'Sponsor quitado');
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Sponsors</h1><p>Lo que cargues acá rota en todos los tableros de tu organización.</p></div></div>
      <section className="card">
        <h2>Rotación</h2>
        <div className="row">
          <label className="field" htmlFor="rot" style={{ maxWidth: 220 }}>Segundos por sponsor
            <input id="rot" type="number" min={3} max={60} defaultValue={org.rotSec}
              onBlur={e => { const v = Math.min(60, Math.max(3, Number(e.target.value) || 8)); act(() => saveRotSec(org.id, v), 'Rotación actualizada'); }} /></label>
          <p className="hint" style={{ flex: '2 1 300px' }}><b>Banner del marcador</b>: los dos espacios de abajo del marcador (ideal 4:1, ej. 1200×300). <b>Pantalla completa</b>: calentamiento y pausa/cambio de lado (ideal 16:9, ej. 1920×1080). Cualquier otra proporción se muestra completa, sin recortes. Máximo 5 MB por imagen.</p>
        </div>
      </section>
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><h2>Tus sponsors</h2>
          <span className="btn primary file">{busy ? 'Subiendo…' : '+ Agregar sponsor'}<input type="file" accept="image/*" multiple aria-label="Agregar sponsor" disabled={busy} onChange={e => { add(e.target.files); e.target.value = ''; }} /></span></div>
        <div className="splist">
          {list.length ? list.map((s, i) => (
            <div key={s.id} className={`sp-row card ${s.active ? '' : 'off'}`}>
              <div className="sp-img"><img src={s.img} alt={s.name} /></div>
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="field" htmlFor={'n' + s.id}>Nombre<input id={'n' + s.id} defaultValue={s.name} onBlur={e => e.target.value !== s.name && act(() => updateSponsor(s.id, { name: e.target.value }))} /></label>
                <div className="checks">
                  <label className="switch"><input type="checkbox" checked={s.active} onChange={e => act(() => updateSponsor(s.id, { active: e.target.checked }))} />Activo</label>
                  <label className="switch"><input type="checkbox" checked={s.banner} onChange={e => act(() => updateSponsor(s.id, { banner: e.target.checked }))} />Banner del marcador</label>
                  <label className="switch"><input type="checkbox" checked={s.full} onChange={e => act(() => updateSponsor(s.id, { full_screen: e.target.checked }))} />Pantalla completa</label>
                </div>
              </div>
              <div className="ord">
                <button className="btn sm" type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                <button className="btn sm" type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
                <span className="btn sm file">Cambiar imagen<input type="file" accept="image/*" aria-label="Cambiar imagen"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) act(async () => updateSponsor(s.id, { image_url: await uploadImage(org.id, 'sponsors', f) }), 'Imagen actualizada'); }} /></span>
                <button className="btn sm danger" type="button" onClick={() => del(s)}>{confirmId === s.id ? '¿Seguro? Tocá de nuevo' : 'Quitar'}</button>
              </div>
            </div>
          )) : <div className="drop">Todavía no cargaste sponsors. Agregá el primero con el botón de arriba.</div>}
        </div>
      </section>
    </main>
  );
}
