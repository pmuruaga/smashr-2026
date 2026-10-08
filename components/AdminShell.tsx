'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useOrg } from './OrgProvider';

const NAV = [['/panel', 'Partidos'], ['/panel/nuevo', 'Nuevo partido'], ['/panel/sponsors', 'Sponsors'], ['/panel/personalizacion', 'Personalización']];

export default function AdminShell({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const { org } = useOrg();
  async function logout() { await supabaseBrowser().auth.signOut(); router.replace('/login'); router.refresh(); }
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link className="brand" href="/panel">SMASH<span>R</span></Link>
          <nav className="nav" aria-label="Menú">
            {[...NAV, ...(isAdmin ? [['/panel/usuarios', 'Usuarios']] : [])].map(([h, l]) => <Link key={h} href={h} aria-current={path === h ? 'page' : undefined}>{l}</Link>)}
          </nav>
          <div className="who"><span>{org.name}</span><button className="btn sm" type="button" onClick={logout}>Salir</button></div>
        </div>
      </header>
      {children}
    </>
  );
}
