/* =====================================================================
   PANTALLA DE SCORE — render de escenas en un lienzo 1920×1080.
   Lo usan: tablero.html (TV) y la vista previa de la Mesa de Control.
   Cada escena es una función pura: (ctx) => HTML.  ctx = {m, org, rot, next}
   En Next.js: components/screens/<Escena>.tsx
   ===================================================================== */
const SIL = '<svg viewBox="0 0 200 220"><circle cx="100" cy="70" r="46" fill="#000"/><path d="M14 220 C20 150 60 124 100 124 C140 124 180 150 186 220 Z" fill="#000"/></svg>';
function photo(p){ return `<div class="ph">${p.photo?`<img src="${p.photo}" alt="">`:`<div class="ini">${esc((p.first||'')[0]||'')+esc((p.last||'')[0]||'')}</div>${SIL}`}</div>`; }
function bgLayers(b){
  return `<div class="bg"></div>${b.bg?`<div class="bg-img" style="background-image:url('${b.bg}')"></div>`:''}
  <div class="bg-dim" style="background:linear-gradient(180deg,rgba(0,0,0,${b.bg?b.dim/100:0}),rgba(0,0,0,${b.bg?Math.min(.95,b.dim/100+.15):0}))"></div>`;
}
const activeSponsors = (org,kind) => org.sponsors.filter(s=>s.active && s[kind]);
const spAt = (org,kind,i) => { const l=activeSponsors(org,kind); return l.length ? l[((i%l.length)+l.length)%l.length].img : null; };
const logoBox = (org,style) => `<div class="abs" style="${style};display:flex;align-items:center"><img class="logo-img" src="${org.brand.logo}" alt="${esc(org.name)}"></div>`;
const matchClock = st => fmtDur(st.startedAt?(st.endedAt||Date.now())-st.startedAt:0);
const timerLeft = d => d.timerEndsAt ? Math.max(0, d.timerEndsAt-Date.now()) : 0;
const fmtTimer = ms => { const s=Math.ceil(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
function frame(src,style){
  return `<div class="frame glass" style="${style}">${src?`<div class="blur" style="background-image:url('${src}')"></div><img class="main fade" src="${src}" alt="Sponsor">`
    :'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;color:#555;letter-spacing:.1em">ESPACIO PUBLICITARIO</div>'}</div>`;
}
function headerBlock(m,org){
  return `${logoBox(org,'left:150px;top:46px;width:360px;height:140px')}
  <div class="abs" style="left:560px;right:560px;top:58px;display:grid;gap:12px;justify-items:center">
    <div class="plate" style="width:100%;font-size:44px;padding:8px 20px;border-radius:4px">${esc(m.event)}</div>
    <div style="font-size:30px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--accent2)">${esc(m.cat)}</div>
  </div>
  <div class="abs" style="right:150px;top:56px;text-align:right">
    <div class="tnum" style="font-size:72px;font-weight:700;line-height:1" data-clock="now"></div>
    <div class="lbl" style="font-size:24px;margin-top:6px">${esc(m.court)}</div>
  </div>`;
}

/* ---------- MARCADOR ---------- */
function sceneScore({m,org,rot}){
  const st=m.state, c=st.cfg, lab=pointLabels(st), n=c.setsToWin*2-1, ci=st.sets.length-1, photos=org.brand.showPhotos;
  const cols=`minmax(0,1fr) repeat(${n},150px) 240px`;
  let h=`<div class="sb-h team lbl">${esc(m.round)}</div>`;
  for(let i=0;i<n;i++) h+=`<div class="sb-h lbl">${c.decider==='supertb' && i===n-1 ? (n===1?'Super TB':'S. TB') : 'Set '+(i+1)}</div>`;
  h+=`<div class="sb-h lbl">Puntos</div>`;
  let rows='';
  [0,1].forEach(k=>{
    const pl=m.teams[k].players;
    rows+=`<div class="sb-cell sb-team ${st.winner===k?'win':''}"><div class="left">
      ${photos?`<div class="pics">${pl.map(p=>`<div class="pic">${photo(p)}</div>`).join('')}</div>`:''}
      <div class="names"><div class="first">${esc(pl[0].first)} · ${esc(pl[1].first)}</div>
      <div class="last" style="${photos?'font-size:50px':''}">${up(pl[0].last)} / ${up(pl[1].last)}</div></div></div>
      ${!st.finished && st.startedAt && st.server===k?'<div class="ball" title="Saca"></div>':''}</div>`;
    for(let i=0;i<n;i++){
      const s=st.sets[i];
      if(!s){ rows+=`<div class="sb-cell"></div>`; continue; }
      const v = s.tb&&s.tb.super ? s.tb.p[k] : s.g[k];
      const lose = s.winner!==null && s.winner!==k;
      const sup = s.winner!==null && s.tb && !s.tb.super && lose ? `<sup>${s.tb.p[k]}</sup>` : '';
      rows+=`<div class="sb-cell tnum ${i===ci&&!st.finished?'cur':''} ${lose?'lose':''}">${v}${sup}</div>`;
    }
    rows+= st.finished ? `<div class="sb-cell pts done">${st.winner===k?'GANA':''}</div>` : `<div class="sb-cell pts tnum">${lab[k]}</div>`;
  });
  const badges=statusBadges(st).map(b=>`<div class="badge ${b.k}">${esc(b.l)}</div>`).join('');
  const status = st.finished
    ? `<div class="winner-ribbon plate">Ganadores · ${up(teamName(m,st.winner))}</div>`
    : `<div class="status">${badges}<div class="fmt">${esc(describeCfg(c))}</div>
       <div class="clock">Tiempo de juego <b class="tnum" data-clock="match"></b></div></div>`;
  const sp=[spAt(org,'banner',rot),spAt(org,'banner',rot+1)];
  return `${bgLayers(org.brand)}${headerBlock(m,org)}
  <div class="sb"><div class="sb-grid" style="grid-template-columns:${cols}">${h}${rows}</div></div>
  ${status}
  <div class="sponsors">${sp.map(s=>s?`<div class="sp fade"><div class="blur" style="background-image:url('${s}')"></div><img src="${s}" alt="Sponsor"><div class="tag">SPONSOR</div></div>`:`<div class="sp empty">ESPACIO PUBLICITARIO</div>`).join('')}</div>`;
}

/* ---------- CALENTAMIENTO ---------- */
function sceneWarmup({m,org,rot}){
  const d=m.display, left=timerLeft(d);
  const tn = k => m.teams[k].players.map(p=>`<div>${up(p.last)}</div>`).join('');
  return `${bgLayers(org.brand)}
  ${frame(spAt(org,'full',rot),'left:60px;top:60px;width:1290px;height:726px')}
  <div class="warm-panel glass">
    <div class="lbl" style="font-size:26px">${esc(m.round)}</div>
    <div class="tn">${tn(0)}</div><div class="vs">VS</div><div class="tn">${tn(1)}</div>
    <div class="lbl" style="font-size:24px;color:var(--accent2)">${esc(m.court)}</div>
  </div>
  <div class="warm-bar glass">
    <div style="display:grid;gap:6px">
      <div class="scene-tag">Calentamiento</div>
      <div style="font-size:34px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#d7d3ca">El partido inicia en</div>
    </div>
    <div class="tnum" data-timer style="font-size:168px;font-weight:800;line-height:1;flex:1"></div>
    <div style="width:340px;height:140px"><img class="logo-img" style="margin-left:auto" src="${org.brand.logo}" alt=""></div>
  </div>`;
}

/* ---------- PAUSA / CAMBIO DE LADO (sponsor + marcador) ---------- */
function sceneBreak({m,org,rot}){
  const st=m.state, lab=pointLabels(st), ci=st.sets.length-1, d=m.display, left=timerLeft(d);
  const setsRow = k => st.sets.map((s,i)=>{ const v=s.tb&&s.tb.super?s.tb.p[k]:s.g[k]; const lose=s.winner!==null&&s.winner!==k; return `<div class="s tnum ${lose?'lose':''} ${i===ci&&!st.finished?'cur':''}">${v}</div>`; }).join('');
  const tl = st.timeline.slice(-8);
  const chips = k => tl.map((x,i)=>`<div class="chip tnum ${i===tl.length-1?'on':''}">${x[k]}</div>`).join('') + (st.finished?'':`<div class="chip on tnum" style="background:#fff">${lab[k]}</div>`);
  const b=statusBadges(st)[0];
  return `${bgLayers(org.brand)}
  ${frame(spAt(org,'full',rot),'left:60px;top:60px;width:1290px;height:726px')}
  <div class="abs glass" style="left:1390px;top:60px;width:470px;height:230px;padding:30px;display:flex;align-items:center;justify-content:center"><img class="logo-img" src="${org.brand.logo}" alt=""></div>
  <div class="abs glass" style="left:1390px;top:316px;width:470px;height:210px;display:grid;place-items:center;text-align:center;padding:16px">
    <div class="scene-tag">Cambio de lado</div>
    <div class="tnum" data-timer style="font-size:110px;font-weight:800;line-height:1"></div>
  </div>
  <div class="abs lbl" style="left:1390px;top:552px;font-size:24px">Presentado por</div>
  ${frame(spAt(org,'banner',rot+1),'left:1390px;top:592px;width:470px;height:194px')}
  <div class="bar glass">
    <div class="teams">${[0,1].map(k=>`<div class="trow"><span class="nm">${up(teamName(m,k))}</span>${!st.finished&&st.server===k?'<span class="ball" style="width:26px;height:26px"></span>':''}${setsRow(k)}</div>`).join('')}</div>
    <div class="line">${[0,1].map(k=>`<div class="chips">${chips(k)}</div>`).join('')}</div>
    <div class="side">${b?`<div class="badge ${b.k}" style="font-size:28px;height:52px">${esc(b.l)}</div>`:''}
      <div class="lbl" style="font-size:20px">Duración <b class="tnum" style="color:#fff;font-size:30px" data-clock="match"></b></div></div>
  </div>`;
}

/* ---------- CARA A CARA ---------- */
function duo(m,k,x){ const pl=m.teams[k].players;
  return `<div class="duo glass gold-edge" style="left:${x}px"><div class="pair">${pl.map(p=>`<div>${photo(p)}</div>`).join('')}</div>
  <div class="cap">${up(pl[0].last)}<br>${up(pl[1].last)}</div></div>`; }
function sceneH2H({m,org}){
  const H=m.h2h||{a:0,b:0,meet:[]};
  const meet=H.meet.length ? H.meet.map(x=>`<div class="meet"><div class="plate">${esc(x.ev)}</div>
    <div class="res tnum">${x.sa.map((v,i)=>v+'-'+x.sb[i]).join('  ')}</div>
    <div class="who">Ganó ${esc(teamName(m,x.w))}</div></div>`).join('')
    : `<div class="plate" style="width:520px;height:58px;display:flex;align-items:center;justify-content:center;font-size:30px;border-radius:4px">Primer enfrentamiento</div>`;
  return `${bgLayers(org.brand)}${duo(m,0,60)}${duo(m,1,1340)}
  <div class="center-col">
    <div style="width:240px;height:90px"><img class="logo-img" style="margin:auto" src="${org.brand.logo}" alt=""></div>
    <div class="ttl">${esc(m.round)}</div><div class="huge">Cara a cara</div>
    <div class="scorebox tnum"><span class="${H.a<H.b?'lose':''}">${H.a}</span><span style="font-size:70px;color:#666">-</span><span class="${H.b<H.a?'lose':''}">${H.b}</span></div>
    ${H.meet.length?'<div class="ttl" style="font-size:24px">Últimos enfrentamientos</div>':''}${meet}
  </div>${m.h2h?'<div class="example">Historial de ejemplo</div>':''}`;
}

/* ---------- RESUMEN DE SET ---------- */
function sceneSummary({m,org,rot}){
  const st=m.state; let idx=-1;
  st.sets.forEach((s,i)=>{ if(s.winner!==null) idx=i; });
  const live = idx<0; if(live) idx=st.sets.length-1;
  const s=st.sets[idx];
  const ord=['Primer','Segundo','Tercer','Cuarto','Quinto'][idx]||('Set '+(idx+1));
  const va = s.tb&&s.tb.super ? s.tb.p : s.g;
  const dur = s.start ? ((s.end||Date.now())-s.start) : 0;
  const row=(a,label,b,hiA,hiB)=>`<div class="stat"><div class="tnum ${hiA?'hi':''}">${a}</div><div class="mid">${label}</div><div class="tnum ${hiB?'hi':''}">${b}</div></div>`;
  const sp=spAt(org,'banner',rot);
  return `${bgLayers(org.brand)}${duo(m,0,60)}${duo(m,1,1340)}
  <div class="center-col">
    <div style="width:240px;height:90px"><img class="logo-img" style="margin:auto" src="${org.brand.logo}" alt=""></div>
    <div class="ttl">${esc(m.round)}</div><div class="huge">Resumen del set</div>
    <div class="lbl" style="font-size:28px">${s.tb&&s.tb.super?'Super tie-break':ord+' set'}${live?' · en juego':''}</div>
    <div class="scorebox glass tnum"><span class="${va[0]<va[1]?'lose':''}">${va[0]}</span><span style="font-size:70px;color:#666">–</span><span class="${va[1]<va[0]?'lose':''}">${va[1]}</span></div>
    <div style="display:flex;align-items:center;gap:22px;font-size:30px;font-weight:600;letter-spacing:.08em">
      ${sp?`<img src="${sp}" alt="" style="height:54px;width:216px;object-fit:cover;border:1px solid #333">`:''}<span class="tnum">⏱ ${Math.floor(dur/60000)} min</span></div>
    <div class="stats">
      ${row(s.pts[0],'Puntos ganados',s.pts[1],s.pts[0]>s.pts[1],s.pts[1]>s.pts[0])}
      ${row(s.bpWon[0]+'/'+s.bpOpp[0],'Break points',s.bpWon[1]+'/'+s.bpOpp[1],s.bpWon[0]>s.bpWon[1],s.bpWon[1]>s.bpWon[0])}
      ${row(s.streak[0],'Racha máxima',s.streak[1],s.streak[0]>s.streak[1],s.streak[1]>s.streak[0])}
      ${row(s.g[0],'Games ganados',s.g[1],s.g[0]>s.g[1],s.g[1]>s.g[0])}
    </div>
  </div>`;
}

/* ---------- FICHA DE JUGADORES ---------- */
function sceneBio({m,org}){
  const k=m.display.bioTeam||0, team=m.teams[k];
  const card=(p,x)=>`<div class="bio glass gold-edge" style="left:${x}px">
    <div class="photo">${photo(p)}</div>
    <div class="who"><div class="flag">${esc(p.country)}</div><div class="nm">${up(p.first)} <b>${up(p.last)}</b></div></div>
    <div class="body"><div class="plate">Ficha del jugador</div>
      <div class="grid">
        <div class="kv"><div class="k lbl">Ranking</div><div class="v tnum">${esc(p.rank)}</div></div>
        <div class="kv"><div class="k lbl">Edad</div><div class="v tnum">${esc(p.age)}</div></div>
        <div class="kv"><div class="k lbl">Posición</div><div class="v">${esc(p.side)}</div></div>
        <div class="kv"><div class="k lbl">Mano</div><div class="v">${esc(p.hand)}</div></div>
        <div class="kv full"><div class="k lbl">Puntos de ranking</div><div class="v tnum">${Number(p.points||0).toLocaleString('es-AR')}</div></div>
      </div></div></div>`;
  return `${bgLayers(org.brand)}${logoBox(org,'left:80px;top:40px;width:280px;height:100px')}
  <div class="abs" style="left:0;right:0;top:48px;text-align:center"><div class="ttl" style="justify-content:center">${esc(m.round)} · ${up(teamName(m,k))}</div></div>
  ${card(team.players[0],360)}${card(team.players[1],1000)}`;
}

/* ---------- PRÓXIMO PARTIDO ---------- */
function sceneNext({m,org,next}){
  const src = next || null;
  const players = src ? [...src.teams[0].players, ...src.teams[1].players] : [];
  const card=(p,x)=>`<div class="vs-card gold-edge" style="left:${x}px">${photo(p)}<div class="vs-name"><small>${esc(p.first)}</small>${up(p.last)}</div></div>`;
  if(!src) return `${bgLayers(org.brand)}<div class="abs huge" style="left:0;right:0;top:470px;text-align:center">Sin próximo partido programado</div>`;
  return `${bgLayers(org.brand)}${logoBox(org,'left:80px;top:50px;width:300px;height:110px')}
  <div class="abs" style="left:0;right:0;top:60px;text-align:center">
    <div class="ttl" style="justify-content:center">${esc(src.court)}${src.scheduledAt?' · '+esc(src.scheduledAt)+' hs':''}</div>
    <div class="huge" style="margin-top:10px">A continuación</div></div>
  ${card(players[0],120)}${card(players[1],480)}${card(players[2],1100)}${card(players[3],1460)}
  <div class="diamond"><span>VS</span></div>
  <div class="abs plate" style="left:660px;right:660px;top:820px;font-size:40px;padding:10px;border-radius:4px">${esc(src.round)}</div>
  <div class="abs" style="left:0;right:0;top:900px;text-align:center;font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent2)">${esc(src.cat)}</div>`;
}

const SCENE_RENDER={score:sceneScore,warmup:sceneWarmup,break:sceneBreak,h2h:sceneH2H,summary:sceneSummary,bio:sceneBio,next:sceneNext};

/* Próximo partido: el siguiente programado del mismo organizador (prioriza misma cancha) */
function findNext(m){
  const list=Store.orgMatches(m.orgId).filter(x=>x.status==='scheduled' && x.id!==m.id);
  return list.find(x=>x.court===m.court) || list[0] || null;
}

/* Monta una Pantalla de Score dentro de un contenedor. Devuelve {render, tick} */
function mountStage(wrap, getCtx, {fitHeight=false}={}){
  wrap.innerHTML='<div class="stage"></div>';
  const stage=wrap.firstChild;
  let lastKey='';
  function applyVars(org){
    const f=FONT_PRESETS[org.brand.font]||FONT_PRESETS.broadcast;
    stage.style.setProperty('--accent',org.brand.accent);
    stage.style.setProperty('--accent2',org.brand.accent2||'#f1eee7');
    stage.style.setProperty('--display',f.display);
    stage.style.setProperty('--ital',f.italic?'italic':'normal');
  }
  function render(force){
    const ctx=getCtx(); if(!ctx||!ctx.m){ stage.innerHTML='<div class="bg"></div><div class="abs huge" style="left:0;right:0;top:480px;text-align:center">Partido no encontrado</div>'; return; }
    applyVars(ctx.org);
    ctx.next = findNext(ctx.m);
    const html=(SCENE_RENDER[ctx.m.display.scene]||sceneScore)(ctx);
    if(force || html!==lastKey){ stage.innerHTML=html; lastKey=html; tick(); }
  }
  function fit(){
    const w=wrap.clientWidth, h=fitHeight?wrap.clientHeight:Infinity, k=Math.min(w/1920,h/1080);
    stage.style.transform=`scale(${k})`;
    stage.style.left=((w-1920*k)/2)+'px';
    stage.style.top=fitHeight?((wrap.clientHeight-1080*k)/2)+'px':'0';
    if(!fitHeight) wrap.style.height=(1080*k)+'px';
  }
  function tick(){
    const ctx=getCtx(); if(!ctx||!ctx.m) return;
    stage.querySelectorAll('[data-clock="match"]').forEach(el=>el.textContent=matchClock(ctx.m.state));
    stage.querySelectorAll('[data-clock="now"]').forEach(el=>el.textContent=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}));
    const left=timerLeft(ctx.m.display);
    stage.querySelectorAll('[data-timer]').forEach(el=>el.textContent= left?fmtTimer(left):(ctx.m.display.scene==='warmup'?'¡A JUGAR!':'00:00'));
  }
  new ResizeObserver(fit).observe(wrap);
  document.addEventListener('fullscreenchange',()=>{ setTimeout(fit,50); });
  setInterval(tick,500);
  return {render, fit, tick, stage};
}
