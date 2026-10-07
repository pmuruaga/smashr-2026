import TvBoard from '@/components/TvBoard';
export const metadata = { title: 'Tablero · Smashr' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TvBoard matchId={id} />;
}
