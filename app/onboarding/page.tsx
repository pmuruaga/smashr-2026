import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import OnboardingForm from './form';

export const metadata = { title: 'Tu organización · Smashr' };

export default async function Page() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: mem } = await sb.from('memberships').select('org_id').eq('user_id', user.id).limit(1);
  if (mem && mem.length) redirect('/panel');
  return <OnboardingForm email={user.email || ''} />;
}
