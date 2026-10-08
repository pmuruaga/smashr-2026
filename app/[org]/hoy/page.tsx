import DayBoard from '@/components/DayBoard';
export const metadata = { title: 'Resumen del día · Smashr' };
export default async function Page({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <DayBoard orgSlug={org} />;
}
