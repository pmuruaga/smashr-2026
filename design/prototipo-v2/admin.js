/* Mesa de Control — piezas comunes (menú, sesión, avisos). En Next.js: app/(control)/layout.tsx */
Store.load();

const NAV=[['index.html','Partidos'],['nuevo.html','Nuevo partido'],['sponsors.html','Sponsors'],['personalizacion.html','Personalización']];

function shell(active){
  const org=Store.org();
  const bar=document.createElement('header'); bar.className='topbar';
  bar.innerHTML=`<div class="topbar-in">
    <a class="brand" href="index.html">SMASH<span>R</span></a>
    <nav class="nav" aria-label="Menú">${NAV.map(([h,l])=>`<a href="${h}" ${h===active?'aria-current="page"':''}>${l}</a>`).join('')}</nav>
    <div class="who">${org?`<span>${esc(org.name)}</span><button class="btn sm" type="button" id="logoutBtn">Salir</button>`:''}</div></div>`;
  document.body.prepend(bar);
  const lb=document.getElementById('logoutBtn');
  if(lb) lb.onclick=()=>{ Store.data.session.orgId=null; Store.save(); location.href='index.html'; };
}
function requireOrg(){ const org=Store.org(); if(!org){ location.href='index.html'; throw new Error('sin sesión'); } return org; }

function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),2200);
}
function copyText(text, el){
  const done=()=>toast('Link copiado');
  try{ navigator.clipboard.writeText(text).then(done).catch(()=>selectEl(el)); }catch(e){ selectEl(el); }
}
function selectEl(el){ if(!el) return; const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast('Copiá el link seleccionado'); }

function statusPill(m){
  if(m.status==='finished') return '<span class="pill ok">Finalizado</span>';
  if(m.status==='live') return '<span class="pill live">En juego</span>';
  return `<span class="pill">Programado${m.scheduledAt?' · '+esc(m.scheduledAt)+' hs':''}</span>`;
}
function scoreLine(m,k){
  const st=m.state;
  const sets=st.sets.filter(s=>s.start||s.winner!==null||s.g[0]||s.g[1]).map(s=>s.tb&&s.tb.super?s.tb.p[k]:s.g[k]);
  return sets.join(' · ') || '–';
}
