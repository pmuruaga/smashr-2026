'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { toast, errMsg } from '@/lib/toast';
import { site } from '@/components/ui';

interface U { id: string; email: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; active: boolean; orgs: string; is_admin: boolean }
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function UsuariosPage() {
  const [list, setList] = useState<U[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser().rpc('admin_list_users');
    if (error) { setDenied(true); return; }
    setList(data as U[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setActive(u: U, active: boolean) {
    if (!active && confirmId !== u.id) { setConfirmId(u.id); setTimeout(() => setConfirmId(c => (c === u.id ? null : c)), 4000); return; }
    setConfirmId(null); setBusy(u.id);
    const { error } = await supabaseBrowser().rpc('admin_set_user_active', { p_user: u.id, p_active: active });
    setBusy(null);
    if (error) { toast(errMsg(error)); return; }
    toast(active ? 'Usuario activado' : 'Usuario desactivado'); load();
  }

  if (denied) return <main className="page"><p className="hint">Esta sección es solo para superusuarios.</p></main>;
  const regLink = site() + '/registro';
  return (
    <main className="page">
      <div className="page-head"><div><h1>Usuarios</h1><p>Organizadores registrados en Smashr. Un usuario desactivado no puede ingresar; sus tableros públicos siguen visibles.</p></div></div>
      <section className="card">
        <h2>Link de registro</h2>
        <p className="hint">No aparece en la pantalla de ingreso. Pasáselo a mano a quien quieras dar de alta.</p>
        <div className="row"><span className="copy">{regLink}</span>
          <button className="btn sm" type="button" onClick={() => navigator.clipboard.writeText(regLink).then(() => toast('Link copiado')).catch(() => window.prompt('Copiá el link:', regLink))}>Copiar</button></div>
      </section>
      <section className="card">
        <h2 className="section-t">Registrados <span className="n">{list?.length ?? ''}</span></h2>
        {list === null ? <p className="hint">Cargando…</p> : (
          <div className="utable-wrap">
            <table className="utable">
              <thead><tr><th>Email</th><th>Organización</th><th>Alta</th><th>Último ingreso</th><th>Estado</th><th /></tr></thead>
              <tbody>{list.map(u => (
                <tr key={u.id} className={u.active ? '' : 'off'}>
                  <td><b>{u.email}</b>{u.is_admin && <span className="pill" style={{ marginLeft: 8 }}>Superusuario</span>}{!u.confirmed && <span className="pill" style={{ marginLeft: 8 }}>Email sin confirmar</span>}</td>
                  <td>{u.orgs || <span className="hint">Sin organización</span>}</td>
                  <td className="tnum">{fmt(u.created_at)}</td>
                  <td className="tnum">{fmt(u.last_sign_in_at)}</td>
                  <td>{u.active ? <span className="pill ok">Activo</span> : <span className="pill live">Desactivado</span>}</td>
                  <td>{!u.is_admin && (u.active
                    ? <button className="btn sm danger" type="button" disabled={busy === u.id} onClick={() => setActive(u, false)}>{confirmId === u.id ? '¿Seguro? Tocá de nuevo' : 'Desactivar'}</button>
                    : <button className="btn sm" type="button" disabled={busy === u.id} onClick={() => setActive(u, true)}>Activar</button>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
