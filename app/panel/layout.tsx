import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { rowToOrg } from '@/lib/model';
import { OrgProvider } from '@/components/OrgProvider';
import AdminShell from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: mem } = await sb.from('memberships').select('org_id, organizations(*)').eq('user_id', user.id).order('created_at').limit(1);
  const row = mem?.[0]?.organizations as unknown as Record<string, unknown> | undefined;
  if (!row) redirect('/onboarding');
  const { data: sp } = await sb.from('sponsors').select('*').eq('org_id', row.id as string).order('sort_order');
  const org = rowToOrg(row, sp || []);
  return <OrgProvider initial={org}><AdminShell>{children}</AdminShell></OrgProvider>;
}
