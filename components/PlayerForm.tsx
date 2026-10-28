'use client';
/* Alta / edición de un jugador. Se usa en /panel/jugadores (y después en el alta rápida de Nuevo partido). */
import { useState } from 'react';
import { uploadImage } from '@/lib/data';
import { createPlayer, updateOrgPlayer, updatePlayerIdentity, GENDERS, HANDS, POSITIONS,
  type Gender, type Hand, type OrgPlayer, type Position } from '@/lib/players';
import { toast, errMsg } from '@/lib/toast';

type Draft = {
  firstName: string; lastName: string; dni: string; city: string; gender: Gender | ''; hand: Hand | '';
  birthDate: string; photoUrl: string | null; category: string; position: Position | '';
};
const toDraft = (p: OrgPlayer | null): Draft => ({
  firstName: p?.firstName || '', lastName: p?.lastName || '', dni: p?.dni || '', city: p?.city || '',
  gender: p?.gender || '', hand: p?.hand || '', birthDate: p?.birthDate || '', photoUrl: p?.photoUrl || null,
  category: p?.category || '', position: p?.position || '',
});

export default function PlayerForm({ orgId, player, categories = [], onSaved, onCancel }: {
  orgId: string; player: OrgPlayer | null; categories?: string[];
  onSaved: (id: string) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(player));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(player?.photoUrl || null);
  const [busy, setBusy] = useState(false);
  const canIdentity = !player || player.isOwner; // un jugador compartido por otra org: solo categoría y posición
  const set = (patch: Partial<Draft>) => setD(x => ({ ...x, ...patch }));
  const pid = player?.id || 'new';

  async function save() {
    if (!d.firstName.trim() || !d.lastName.trim()) { toast('Completá nombre y apellido'); return; }
    const dni = d.dni.replace(/\D/g, '');
    if (d.dni.trim() && !/^\d{6,9}$/.test(dni)) { toast('El DNI tiene que tener entre 6 y 9 números'); return; }
    setBusy(true);
    try {
      const identity = {
        firstName: d.firstName, lastName: d.lastName, dni: dni || null, city: d.city,
        gender: (d.gender || null) as Gender | null, hand: (d.hand || null) as Hand | null,
        birthDate: d.birthDate || null, photoUrl: file ? await uploadImage(orgId, 'players', file) : d.photoUrl,
      };
      const orgData = { category: d.category, position: (d.position || null) as Position | null };
      let id = player?.id;
      if (!id) id = await createPlayer(orgId, identity, orgData);
      else {
        if (canIdentity) await updatePlayerIdentity(id, identity);
        await updateOrgPlayer(orgId, id, orgData);
      }
      toast(player ? 'Jugador actualizado' : 'Jugador creado');
      onSaved(id);
    } catch (e) { toast(errMsg(e)); setBusy(false); }
  }

  return (
    <section className="card player-form">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{player ? 'Editar jugador' : 'Nuevo jugador'}</h2>
        {!canIdentity && <span className="pill">Compartido por otra organización</span>}
      </div>
      {!canIdentity && <p className="hint">Este jugador lo cargó otra organización: podés cambiar su <b>categoría</b> y <b>posición</b> para tu club. Los datos personales los edita la organización que lo cargó.</p>}

      <fieldset className="pf-group" disabled={!canIdentity || busy}>
        <legend>Datos personales</legend>
        <div className="row">
          <label className="field" htmlFor={pid + 'fn'}>Nombre *<input id={pid + 'fn'} value={d.firstName} onChange={e => set({ firstName: e.target.value })} autoComplete="off" /></label>
          <label className="field" htmlFor={pid + 'ln'}>Apellido *<input id={pid + 'ln'} value={d.lastName} onChange={e => set({ lastName: e.target.value })} autoComplete="off" /></label>
          <label className="field" htmlFor={pid + 'dni'}>DNI (opcional)<input id={pid + 'dni'} inputMode="numeric" value={d.dni} onChange={e => set({ dni: e.target.value })} placeholder="Sin puntos" /></label>
        </div>
        <div className="row">
          <label className="field" htmlFor={pid + 'city'}>Ciudad<input id={pid + 'city'} value={d.city} onChange={e => set({ city: e.target.value })} /></label>
          <label className="field" htmlFor={pid + 'g'}>Género<select id={pid + 'g'} value={d.gender} onChange={e => set({ gender: e.target.value as Gender | '' })}>
            <option value="">—</option>{Object.entries(GENDERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field" htmlFor={pid + 'h'}>Mano hábil<select id={pid + 'h'} value={d.hand} onChange={e => set({ hand: e.target.value as Hand | '' })}>
            <option value="">—</option>{Object.entries(HANDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field" htmlFor={pid + 'b'}>Fecha de nacimiento<input id={pid + 'b'} type="date" value={d.birthDate} onChange={e => set({ birthDate: e.target.value })} /></label>
        </div>
        <div className="pl-photo">
          <span className="btn sm file">{preview ? 'Cambiar foto' : 'Foto (opcional)'}<input type="file" accept="image/*" aria-label="Foto del jugador"
            onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; setFile(f); setPreview(f ? URL.createObjectURL(f) : d.photoUrl); }} /></span>
          {preview && <img src={preview} alt="" />}
          {preview && <button className="btn sm" type="button" onClick={() => { setFile(null); set({ photoUrl: null }); setPreview(null); }}>Quitar foto</button>}
        </div>
      </fieldset>

      <fieldset className="pf-group" disabled={busy}>
        <legend>En tu club</legend>
        <div className="row">
          <label className="field" htmlFor={pid + 'cat'}>Categoría<input id={pid + 'cat'} list={pid + 'catList'} value={d.category} onChange={e => set({ category: e.target.value })} placeholder="Ej. 6ta" /></label>
          <label className="field" htmlFor={pid + 'pos'}>Posición<select id={pid + 'pos'} value={d.position} onChange={e => set({ position: e.target.value as Position | '' })}>
            <option value="">—</option>{Object.entries(POSITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <datalist id={pid + 'catList'}>{categories.map(c => <option key={c} value={c} />)}</datalist>
      </fieldset>

      <div className="actions">
        <button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button className="btn primary" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </section>
  );
}
