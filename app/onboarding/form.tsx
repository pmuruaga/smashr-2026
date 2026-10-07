'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { slugify } from '@/lib/model';
import { errMsg } from '@/lib/toast';

export default function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = touched ? slug : slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabaseBrowser().rpc('create_organization', { p_name: name, p_slug: s });
    setBusy(false);
    if (error) { setErr(error.code === '23505' ? 'Esa dirección ya está en uso, probá con otra.' : errMsg(error)); return; }
    router.replace('/panel'); router.refresh();
  }
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', paddingInline: 16, paddingBlock: 40 }}>
      <form className="card" style={{ width: 'min(480px,100%)' }} onSubmit={submit}>
        <h1>Tu club, liga u organización</h1>
        <p className="hint">Hola {email}. Este nombre aparece en tus tableros y define tu dirección pública.</p>
        <label className="field" htmlFor="oname">Nombre<input id="oname" required value={name} onChange={e => setName(e.target.value)} placeholder="Club de Pádel San Miguel" /></label>
        <label className="field" htmlFor="oslug">Dirección pública
          <input id="oslug" required pattern="[a-z0-9-]+" value={s} onChange={e => { setTouched(true); setSlug(slugify(e.target.value)); }} />
        </label>
        <p className="hint">Tus tableros van a quedar en <span className="copy">smashr.com.ar/{s || 'tu-club'}/…/tablero</span></p>
        {err && <p className="hint" style={{ color: 'var(--live)' }}>{err}</p>}
        <button className="btn primary" disabled={busy || !name || !s}>{busy ? 'Creando…' : 'Crear y empezar'}</button>
      </form>
    </main>
  );
}
