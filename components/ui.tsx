'use client';
import type { Match } from '@/lib/model';

export function StatusPill({ m }: { m: Match }) {
  if (m.status === 'finished') return <span className="pill ok">Finalizado</span>;
  if (m.status === 'live') return <span className="pill live">En juego</span>;
  return <span className="pill">Programado{m.scheduledAt ? ` · ${m.scheduledAt} hs` : ''}</span>;
}
export function scoreLine(m: Match, k: number) {
  const sets = m.state.sets.filter(s => s.start || s.winner !== null || s.g[0] || s.g[1]).map(s => (s.tb && s.tb.super ? s.tb.p[k] : s.g[k]));
  return sets.join(' · ') || '–';
}
export const site = () => (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
export const boardPath = (orgSlug: string, m: Match) => `/${orgSlug}/${m.eventSlug}/${m.courtSlug}/tablero`;
export const matchBoardPath = (m: Match) => `/t/${m.id}`;

export async function copy(text: string, onDone: (msg: string) => void) {
  try { await navigator.clipboard.writeText(text); onDone('Link copiado'); }
  catch { window.prompt('Copiá el link:', text); }
}
