'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { errMsg } from '@/lib/toast';

const site = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

export default function AuthCard({ mode }: { mode: 'login' | 'registro' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const sb = supabaseBrowser();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message);
        router.replace(params.get('next') || '/panel'); router.refresh();
      } else {
        if (pass.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: site() + '/auth/callback?next=/onboarding' } });
        if (error) throw error;
        if (data.session) { router.replace('/onboarding'); router.refresh(); }
        else setMsg({ t: 'Te enviamos un email para confirmar la cuenta. Abrí el link y seguís desde ahí.', ok: true });
      }
    } catch (e) { setMsg({ t: errMsg(e) }); } finally { setBusy(false); }
  }
  async function magic() {
    if (!email) { setMsg({ t: 'Escribí tu email primero' }); return; }
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: site() + '/auth/callback?next=/panel', shouldCreateUser: false } });
    setBusy(false);
    setMsg(error ? { t: errMsg(error) } : { t: 'Te mandamos un link de ingreso a tu email.', ok: true });
  }

  return (
    <main className="login" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', paddingInline: 16, paddingBlock: 40 }}>
      <form className="card" style={{ width: 'min(440px,100%)' }} onSubmit={submit}>
        <span className="brand" style={{ fontSize: 40, textAlign: 'center', display: 'block' }}>SMASH<span>R</span></span>
        <p className="hint" style={{ textAlign: 'center' }}>{mode === 'login' ? 'Mesa de Control · ingresá con tu cuenta de organizador' : 'Creá tu cuenta de organizador'}</p>
        <label className="field" htmlFor="email">Email<input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field" htmlFor="pass">Contraseña<input id="pass" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={pass} onChange={e => setPass(e.target.value)} /></label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        {mode === 'login' && <button className="btn" type="button" onClick={magic} disabled={busy}>Enviarme un link de ingreso</button>}
        {msg && <p className="hint" style={{ color: msg.ok ? 'var(--ok)' : 'var(--live)' }} role="status">{msg.t}</p>}
        {mode === 'registro' && <p className="hint" style={{ textAlign: 'center' }}>¿Ya tenés cuenta? <a href="/login">Ingresá</a></p>}
      </form>
    </main>
  );
}
