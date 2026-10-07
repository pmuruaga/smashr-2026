import TvBoard from '@/components/TvBoard';
export const metadata = { title: 'Tablero · Smashr' };
export default async function Page({ params }: { params: Promise<{ org: string; evento: string; cancha: string }> }) {
  const { org, evento, cancha } = await params;
  return <TvBoard orgSlug={org} eventSlug={evento} courtSlug={cancha} />;
}
