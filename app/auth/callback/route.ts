import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/* Vuelta desde el email de confirmación / link mágico de Supabase */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/panel';
  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/panel', url.origin));
}
