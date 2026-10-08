'use client';
/* Monta una Pantalla de Score (lienzo 1920×1080 escalado). Usado por el tablero público y las vistas previas. */
import { useEffect, useRef } from 'react';
import { renderScene, matchClock, timerLeft, fmtTimer } from '@/lib/stage/scenes';
import { FONT_PRESETS, type Match, type Org } from '@/lib/model';

interface Props { m: Match | null; org: Org | null; next?: Match | null; fitHeight?: boolean; className?: string; emptyText?: string }

export default function Stage({ m, org, next = null, fitHeight = false, className = 'preview', emptyText = 'Partido no encontrado' }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const props = useRef({ m, org, next, emptyText });
  props.current = { m, org, next, emptyText };

  const tick = () => {
    const el = stage.current, { m } = props.current; if (!el || !m) return;
    el.querySelectorAll('[data-clock="match"]').forEach(e => { e.textContent = matchClock(m.state); });
    el.querySelectorAll('[data-clock="now"]').forEach(e => { e.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); });
    const left = timerLeft(m.display);
    el.querySelectorAll('[data-timer]').forEach(e => { e.textContent = left ? fmtTimer(left) : (m.display.scene === 'warmup' ? '¡A JUGAR!' : '00:00'); });
    el.querySelectorAll<HTMLElement>('[data-toss-at]:not([data-synced])').forEach(e => {
      const elapsed = Date.now() - Number(e.dataset.tossAt), delay = Number(e.dataset.tossDelay || 0);
      e.style.animationDelay = `${(delay - elapsed) / 1000}s`; e.dataset.synced = '1';
    });
  };
  const render = () => {
    const el = stage.current, { m, org, next, emptyText } = props.current; if (!el) return;
    let html: string;
    if (!m || !org) html = `<div class="bg"></div><div class="abs huge" style="left:0;right:0;top:480px;text-align:center">${emptyText}</div>`;
    else {
      const f = FONT_PRESETS[org.brand.font] || FONT_PRESETS.broadcast;
      el.style.setProperty('--accent', org.brand.accent);
      el.style.setProperty('--accent2', org.brand.accent2 || '#f1eee7');
      el.style.setProperty('--display', f.display);
      el.style.setProperty('--ital', f.italic ? 'italic' : 'normal');
      const rot = Math.floor(Date.now() / ((org.rotSec || 8) * 1000));
      html = renderScene({ m, org, rot, next });
    }
    if (html !== last.current) { el.innerHTML = html; last.current = html; }
    tick();
  };
  const fit = () => {
    const w = wrap.current, s = stage.current; if (!w || !s) return;
    const width = w.clientWidth, height = fitHeight ? w.clientHeight : Infinity, k = Math.min(width / 1920, height / 1080);
    s.style.transform = `scale(${k})`;
    s.style.left = (width - 1920 * k) / 2 + 'px';
    s.style.top = fitHeight ? (w.clientHeight - 1080 * k) / 2 + 'px' : '0';
    if (!fitHeight) w.style.height = 1080 * k + 'px';
  };

  useEffect(() => { render(); }); // en cada cambio de props
  useEffect(() => {
    const ro = new ResizeObserver(fit); if (wrap.current) ro.observe(wrap.current);
    const onFs = () => setTimeout(fit, 50); document.addEventListener('fullscreenchange', onFs);
    const t1 = setInterval(tick, 500), t2 = setInterval(render, 1000);
    fit();
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', onFs); clearInterval(t1); clearInterval(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={wrap} className={className}><div ref={stage} className="stage" /></div>;
}
