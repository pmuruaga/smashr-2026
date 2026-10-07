
/* =====================================================================
   MOTOR DE REGLAS — puro, sin DOM. Llevarlo tal cual a lib/scoring/engine.ts
   ===================================================================== */
const PRESETS = {
  pro:     {label:'Profesional · Star point', setsToWin:2,gamesPerSet:6,tiebreak:true,tiebreakAt:6,tbPoints:7,tbWinBy2:true,deuce:'star',decider:'set',superTbPoints:10},
  oro:     {label:'Amateur · Punto de oro + Super TB a 10', setsToWin:2,gamesPerSet:6,tiebreak:true,tiebreakAt:6,tbPoints:7,tbWinBy2:true,deuce:'golden',decider:'supertb',superTbPoints:10},
  ventaja: {label:'Clásico · Ventaja + tie-break a 7', setsToWin:2,gamesPerSet:6,tiebreak:true,tiebreakAt:6,tbPoints:7,tbWinBy2:true,deuce:'advantage',decider:'set',superTbPoints:10},
  stb12:   {label:'Mejor de 3 · Super TB a 12', setsToWin:2,gamesPerSet:6,tiebreak:true,tiebreakAt:6,tbPoints:7,tbWinBy2:true,deuce:'golden',decider:'supertb',superTbPoints:12},
  set9:    {label:'Set único a 9 games', setsToWin:1,gamesPerSet:9,tiebreak:true,tiebreakAt:8,tbPoints:7,tbWinBy2:true,deuce:'golden',decider:'set',superTbPoints:10},
  tb10:    {label:'Partido a un super tie-break a 10 (muerte súbita)', setsToWin:1,gamesPerSet:6,tiebreak:true,tiebreakAt:6,tbPoints:7,tbWinBy2:false,deuce:'golden',decider:'supertb',superTbPoints:10},
  custom:  {label:'Personalizado'}
};
const clone = o => JSON.parse(JSON.stringify(o));
const cur = m => m.sets[m.sets.length-1];

function newSet(m){
  const c=m.cfg, dec = m.setsWon[0]===c.setsToWin-1 && m.setsWon[1]===c.setsToWin-1;
  const sup = c.decider==='supertb' && dec;
  return {g:[0,0], tb: sup?{p:[0,0],target:c.superTbPoints,super:true,first:m.server}:null, winner:null,
          start:null, end:null, pts:[0,0], bpOpp:[0,0], bpWon:[0,0], streak:[0,0]};
}
function newMatch(cfg){
  const m={cfg:clone(cfg), sets:[], setsWon:[0,0], pts:[0,0], deuces:0, server:0, finished:false, winner:null,
           timeline:[], startedAt:null, endedAt:null, run:{team:null,n:0}, _bp:null};
  m.sets.push(newSet(m)); return m;
}
function pointLabels(m){
  const s=cur(m); if(s.tb) return [String(s.tb.p[0]),String(s.tb.p[1])];
  const p=m.pts, N=['0','15','30','40'];
  if(p[0]>=3 && p[1]>=3){ if(p[0]===p[1]) return ['40','40']; return p[0]>p[1]?['AD','40']:['40','AD']; }
  return [N[Math.min(p[0],3)], N[Math.min(p[1],3)]];
}
/* devuelve 'point' | 'game' | 'set' | 'match' */
function addPoint(m,t,sim){
  if(m.finished) return null;
  const c=m.cfg, s=cur(m), o=1-t, now=Date.now();
  if(!sim){
    if(!m.startedAt) m.startedAt=now; if(!s.start) s.start=now;
    let bpFor=null;
    if(!s.tb){ const r=1-m.server; if(addPoint(clone(m),r,true)!=='point') bpFor=r; }
    if(bpFor!==null) s.bpOpp[bpFor]++;
    m._bp=bpFor;
    s.pts[t]++;
    m.run = m.run.team===t ? {team:t,n:m.run.n+1} : {team:t,n:1};
    if(m.run.n>s.streak[t]) s.streak[t]=m.run.n;
  }
  if(s.tb){
    const p=s.tb.p; p[t]++;
    if(!sim) m.timeline.push([String(p[0]),String(p[1])]);
    if(p[t]>=s.tb.target && (c.tbWinBy2===false || p[t]-p[o]>=2)){ if(!s.tb.super) s.g[t]++; return winSet(m,t,sim); }
    if((p[0]+p[1])%2===1) m.server=1-m.server;
    return 'point';
  }
  const p=m.pts;
  const starLive = c.deuce==='star' && p[0]===p[1] && p[0]>=3 && m.deuces>=3;
  p[t]++;
  let won;
  if(c.deuce==='golden') won = p[t]>=4;
  else if(c.deuce==='star') won = p[t]>=4 && (p[t]-p[o]>=2 || starLive);
  else won = p[t]>=4 && p[t]-p[o]>=2;
  if(!won && p[0]===p[1] && p[0]>=3) m.deuces++;
  if(!sim) m.timeline.push(pointLabels(m));
  if(won){ if(!sim && m._bp===t) s.bpWon[t]++; return winGame(m,t,sim); }
  return 'point';
}
function winGame(m,t,sim){
  const c=m.cfg, s=cur(m), o=1-t;
  s.g[t]++; m.pts=[0,0]; m.deuces=0; m.timeline=[]; m.server=1-m.server;
  if(s.g[t]>=c.gamesPerSet && s.g[t]-s.g[o]>=2) return winSet(m,t,sim);
  if(c.tiebreak && s.g[0]===c.tiebreakAt && s.g[1]===c.tiebreakAt) s.tb={p:[0,0],target:c.tbPoints,super:false,first:m.server};
  return 'game';
}
function winSet(m,t,sim){
  const s=cur(m); s.winner=t; s.end=Date.now(); m.setsWon[t]++;
  m.pts=[0,0]; m.deuces=0; m.timeline=[];
  if(s.tb) m.server=1-s.tb.first;
  if(m.setsWon[t]>=m.cfg.setsToWin){ m.finished=true; m.winner=t; m.endedAt=Date.now(); return 'match'; }
  m.sets.push(newSet(m)); return 'set';
}
function statusBadges(m){
  if(m.finished) return [{l:'Partido finalizado',k:'end'}];
  const out=[], s=cur(m), c=m.cfg, p=m.pts;
  if(s.tb) out.push({l:s.tb.super?'Super tie-break':'Tie-break',k:'mode'});
  else if(c.deuce==='golden' && p[0]===3 && p[1]===3) out.push({l:'Punto de oro',k:'hot'});
  else if(c.deuce==='star' && p[0]===p[1] && p[0]>=3) out.push(m.deuces>=3?{l:'Star point',k:'hot'}:{l:'Iguales · ventaja '+m.deuces+' de 2',k:'mode'});
  const r=[0,1].map(t=>addPoint(clone(m),t,true));
  if(r.includes('match')) out.push({l:'Match point',k:'hot'});
  else if(r.includes('set')) out.push({l:'Set point',k:'hot'});
  else if(!s.tb && r[1-m.server]==='game') out.push({l:'Break point',k:'hot'});
  return out;
}
function describeCfg(c){
  const bo = c.setsToWin===1 ? 'Set único' : 'Mejor de '+(c.setsToWin*2-1);
  const parts=[];
  if(c.setsToWin===1 && c.decider==='supertb'){ parts.push('Super tie-break a '+c.superTbPoints+(c.tbWinBy2===false?' (muere en '+c.superTbPoints+')':' (dif. 2)')); }
  else {
    parts.push(bo, 'Sets a '+c.gamesPerSet);
    parts.push(c.tiebreak ? 'TB a '+c.tbPoints+' en '+c.tiebreakAt+'-'+c.tiebreakAt : 'Sin tie-break');
    parts.push({advantage:'Ventaja',golden:'Punto de oro',star:'Star point'}[c.deuce]);
    if(c.decider==='supertb' && c.setsToWin>1) parts.push('Decisivo: super TB a '+c.superTbPoints);
  }
  return parts.join(' · ');
}
const fmtDur = ms => { if(!ms||ms<0) ms=0; const s=Math.floor(ms/1000), h=Math.floor(s/3600), mi=Math.floor(s%3600/60), se=s%60;
  return (h?String(h).padStart(2,'0')+':':'')+String(mi).padStart(2,'0')+':'+String(se).padStart(2,'0'); };


/* =====================================================================
   UTILIDADES
   ===================================================================== */
const esc = s => String(s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const up = s => esc(String(s??'').toUpperCase());
const uid = p => p+'-'+Math.random().toString(36).slice(2,8);
const slugify = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const readFile = f => new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(f); });
const teamName = (m,i) => m.teams[i].players.map(p=>p.last).join(' / ');
const svgUri = s => 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);

function sponsorArt(name, tag, c1, c2, ink){
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="1200" height="300" fill="url(#g)"/>
  <circle cx="1080" cy="40" r="200" fill="${ink}" opacity=".08"/><circle cx="1150" cy="300" r="140" fill="${ink}" opacity=".08"/>
  <text x="70" y="168" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="104" fill="${ink}" letter-spacing="2">${name}</text>
  <text x="74" y="230" font-family="Arial,sans-serif" font-weight="700" font-size="38" fill="${ink}" opacity=".8" letter-spacing="6">${tag}</text></svg>`);
}
function logoArt(word, sub, color){
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200">
  <circle cx="80" cy="100" r="56" fill="${color}"/><path d="M38 78 Q80 100 38 122 M122 78 Q80 100 122 122" stroke="#111" stroke-width="7" fill="none"/>
  <text x="156" y="112" font-family="Arial Black,Arial,sans-serif" font-style="italic" font-weight="900" font-size="64" fill="#fff">${word}</text>
  <text x="160" y="152" font-family="Arial,sans-serif" font-weight="700" font-size="22" fill="${color}" letter-spacing="7">${sub}</text></svg>`);
}

const FONT_PRESETS = {
  broadcast:{label:'Transmisión (condensada itálica)', display:"'Barlow Condensed','Arial Narrow',Arial,sans-serif", italic:true},
  deportiva:{label:'Deportiva (Oswald)', display:"'Oswald','Arial Narrow',Arial,sans-serif", italic:false},
  tecnica:{label:'Técnica (Rajdhani)', display:"'Rajdhani','Arial Narrow',Arial,sans-serif", italic:false}
};

/* Escenas que la Mesa de Control puede mandar a la Pantalla de Score */
const SCENES = {
  score:   {label:'Marcador', hint:'Pantalla principal'},
  warmup:  {label:'Calentamiento', hint:'Reloj + publicidad', timer:true, defaultSec:300},
  break:   {label:'Pausa / cambio de lado', hint:'Sponsor + marcador', timer:true, defaultSec:90},
  h2h:     {label:'Cara a cara', hint:'Antes del partido'},
  summary: {label:'Resumen del set', hint:'Al terminar un set'},
  bio:     {label:'Ficha de jugadores', hint:'Presentación de pareja'},
  next:    {label:'Próximo partido', hint:'Entre partidos'}
};

/* =====================================================================
   DATOS DE EJEMPLO (en producción: tablas de Supabase filtradas por org_id)
   ===================================================================== */
const P = (first,last,country,rank,age,side,hand,points) => ({first,last,country,rank,age,side,hand,points,photo:null});

function makeMatch(orgId, d){
  const m = {
    id: d.id || uid('m'), orgId,
    event: d.event, eventSlug: slugify(d.event), court: d.court, courtSlug: slugify(d.court),
    round: d.round||'', cat: d.cat||'', scheduledAt: d.scheduledAt||'',
    teams: d.teams, presetKey: d.presetKey||'custom', cfg: clone(d.cfg),
    state: newMatch(d.cfg), history: [],
    display: {scene:'score', timerEndsAt:null, timerSec:null, bioTeam:0, since:Date.now()},
    h2h: d.h2h || null, next: d.next || null,
    status: 'scheduled', createdAt: Date.now()
  };
  return m;
}
function playGames(m, games, tail){
  for(const ch of games){ const w=Number(ch), o=1-w; for(const x of [w,o,w,o,w,w]) addPoint(m.state,x); }
  for(const x of (tail||[])) addPoint(m.state,x);
  m.status = m.state.finished ? 'finished' : 'live';
}

function seedStore(){
  const now = Date.now();
  const orgs = {
    demo:{id:'demo', email:'demo@smashr.com.ar', name:'Smashr Demo', slug:'smashr-demo',
      brand:{logo:logoArt('SMASHR','PADEL SCORE','#c9a15c'), bg:null, dim:55, accent:'#c9a15c', accent2:'#f1eee7', font:'broadcast', showPhotos:true},
      rotSec:8,
      sponsors:[
        {id:'s1',name:'Aguas Andes',img:sponsorArt('AGUAS ANDES','HIDRATACIÓN OFICIAL','#0f4c81','#1d8fd1','#ffffff'),active:true,banner:true,full:true},
        {id:'s2',name:'Ruta 9',img:sponsorArt('RUTA 9','NEUMÁTICOS · SERVICE','#1b1b1b','#3a3a3a','#f5c400'),active:true,banner:true,full:true},
        {id:'s3',name:'La Finca',img:sponsorArt('LA FINCA','CAFÉ DE ESPECIALIDAD','#5b3a29','#a0703f','#fff3e0'),active:true,banner:true,full:true},
        {id:'s4',name:'Zonda',img:sponsorArt('ZONDA','INDUMENTARIA DEPORTIVA','#e9e3d5','#ffffff','#1a1a1a'),active:true,banner:true,full:false}]},
    norte:{id:'norte', email:'liga@example.com', name:'Liga del Norte', slug:'liga-del-norte',
      brand:{logo:logoArt('LIGA NORTE','PÁDEL AMATEUR','#38b2c4'), bg:null, dim:60, accent:'#38b2c4', accent2:'#ffffff', font:'deportiva', showPhotos:false},
      rotSec:10,
      sponsors:[
        {id:'s5',name:'El Molino',img:sponsorArt('EL MOLINO','PANADERÍA · DESDE 1987','#7a1f1f','#c0392b','#fff'),active:true,banner:true,full:true},
        {id:'s6',name:'Norte Fit',img:sponsorArt('NORTE FIT','GIMNASIO 24 HS','#0d0d0d','#2a2a2a','#38b2c4'),active:true,banner:true,full:true}]}
  };
  const H2H = {a:2,b:4,meet:[{ev:'Clausura 2025 · Final',sa:[4,2],sb:[6,6],w:1},{ev:'Apertura 2025 · Semifinal',sa:[5,7,7],sb:[7,6,6],w:0}]};
  const ev='Torneo Apertura 2026';
  const m1 = makeMatch('demo',{id:'m-final', event:ev, court:'Cancha Central', round:'Final', cat:'Femenino · 6ta',
    teams:[{players:[P('Lucía','Ferreyra','ARG',3,27,'Revés','Derecha',1840),P('Camila','Juárez','ARG',5,24,'Drive','Derecha',1610)]},
           {players:[P('Sofía','Ledesma','ARG',2,29,'Revés','Zurda',1925),P('Valentina','Ríos','ARG',7,22,'Drive','Derecha',1380)]}],
    presetKey:'pro', cfg:PRESETS.pro, h2h:H2H,
    next:{a:['Godoy','Luna'],b:['Sosa','Herrera'],round:'Final masculina',time:'21:30'}});
  playGames(m1,'0100101001'+'01101',[0,1,0]);
  m1.state.startedAt=now-42*60000; m1.state.sets.forEach((s,i)=>{ s.start=m1.state.startedAt+i*35*60000; if(s.end) s.end=s.start+35*60000; });

  const m2 = makeMatch('demo',{id:'m-c2', event:ev, court:'Cancha 2', round:'Semifinal', cat:'Masculino · 5ta',
    teams:[{players:[P('Martín','Godoy','ARG',4,31,'Revés','Derecha',1500),P('Iván','Luna','ARG',6,28,'Drive','Derecha',1420)]},
           {players:[P('Nicolás','Sosa','ARG',1,26,'Revés','Zurda',2010),P('Tomás','Herrera','ARG',8,25,'Drive','Derecha',1300)]}],
    presetKey:'oro', cfg:PRESETS.oro});
  m2.status='live'; m2.display={scene:'warmup', timerEndsAt:now+4*60000+22000, timerSec:300, bioTeam:0, since:now};

  const m3 = makeMatch('demo',{id:'m-c3', event:ev, court:'Cancha 3', round:'Cuartos de final', cat:'Mixto · Suma 13', scheduledAt:'20:00',
    teams:[{players:[P('Agustina','Paz','ARG',10,23,'Drive','Derecha',900),P('Ramiro','Vega','ARG',12,35,'Revés','Derecha',860)]},
           {players:[P('Julieta','Medina','ARG',9,30,'Revés','Derecha',950),P('Pedro','Salas','ARG',15,33,'Drive','Zurda',720)]}],
    presetKey:'set9', cfg:PRESETS.set9});

  const m4 = makeMatch('demo',{id:'m-qf1', event:ev, court:'Cancha 1', round:'Cuartos de final', cat:'Femenino · 6ta',
    teams:[{players:[P('Lucía','Ferreyra','ARG',3,27,'Revés','Derecha',1840),P('Camila','Juárez','ARG',5,24,'Drive','Derecha',1610)]},
           {players:[P('Paula','Molina','ARG',12,26,'Revés','Derecha',800),P('Inés','Paz','ARG',14,21,'Drive','Derecha',760)]}],
    presetKey:'pro', cfg:PRESETS.pro});
  playGames(m4,'0010000'+'00110000',[]);

  const n1 = makeMatch('norte',{id:'m-norte', event:'Liga del Norte · Fecha 4', court:'Cancha 1', round:'Semifinal', cat:'Suma 14 · Libre',
    teams:[{players:[P('Diego','Correa','ARG',11,34,'Revés','Derecha',820),P('Hernán','Ruiz','ARG',14,31,'Drive','Derecha',760)]},
           {players:[P('Federico','Gómez','ARG',9,28,'Revés','Zurda',905),P('Lautaro','Rivas','ARG',16,26,'Drive','Derecha',700)]}],
    presetKey:'oro', cfg:PRESETS.oro});
  playGames(n1,'110101101'+'0101',[0,1,0,1,0,1]);

  const matches={}; [m1,m2,m3,m4,n1].forEach(m=>matches[m.id]=m);
  return {v:2, orgs, matches, session:{orgId:null}};
}

/* =====================================================================
   STORE — simula la base + Realtime: localStorage y evento "storage"
   (todas las pestañas del mismo navegador se sincronizan al instante)
   En producción: Supabase (tablas + canal Realtime por partido)
   ===================================================================== */
const STORE_KEY='smashr-v2-proto';
const Store = {
  data:null, listeners:[],
  load(){
    try{ const raw=localStorage.getItem(STORE_KEY); if(raw){ const d=JSON.parse(raw); if(d&&d.v===2){ this.data=d; return d; } } }catch(e){}
    this.data=seedStore(); this.save(); return this.data;
  },
  save(){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); return true; }
    catch(e){ console.warn('No se pudo guardar (¿imágenes muy pesadas?)', e); return false; }
  },
  reset(){ try{ localStorage.removeItem(STORE_KEY); }catch(e){} this.data=seedStore(); this.save(); },
  onChange(cb){ this.listeners.push(cb); },
  org(){ const id=this.data.session.orgId; return id ? this.data.orgs[id] : null; },
  match(id){ return this.data.matches[id]||null; },
  orgMatches(orgId){ return Object.values(this.data.matches).filter(m=>m.orgId===orgId); }
};
window.addEventListener('storage', e=>{
  if(e.key!==STORE_KEY || !e.newValue) return;
  try{ Store.data=JSON.parse(e.newValue); Store.listeners.forEach(cb=>cb()); }catch(err){}
});

/* Acciones sobre un partido (en producción: server actions que insertan en match_events) */
const Actions = {
  point(m,k){ if(m.state.finished) return; m.history.push(JSON.stringify(m.state)); if(m.history.length>80) m.history.shift();
    addPoint(m.state,k); m.status = m.state.finished?'finished':'live';
    if(m.display.scene!=='score') m.display={...m.display, scene:'score', timerEndsAt:null, since:Date.now()}; /* al anotar, el tablero vuelve solo al marcador */
    Store.save(); },
  undo(m){ if(!m.history.length) return; m.state=JSON.parse(m.history.pop()); m.status = m.state.finished?'finished':(m.state.startedAt?'live':m.status); Store.save(); },
  toggleServe(m){ m.state.server=1-m.state.server; Store.save(); },
  scene(m,scene,opts={}){
    const sc=SCENES[scene];
    m.display={...m.display, scene, since:Date.now(),
      timerSec: sc.timer ? (opts.sec||sc.defaultSec) : null,
      timerEndsAt: sc.timer ? Date.now()+(opts.sec||sc.defaultSec)*1000 : null,
      bioTeam: opts.bioTeam ?? m.display.bioTeam};
    if(m.status==='scheduled' && scene==='warmup') m.status='live';
    Store.save();
  },
  addTime(m,sec){ if(m.display.timerEndsAt){ m.display.timerEndsAt=Math.max(Date.now(),m.display.timerEndsAt)+sec*1000; Store.save(); } }
};

/* Rutas del prototipo → rutas reales */
const Routes = {
  tablero: m => `tablero.html#${m.id}`,
  control: m => `control.html#${m.id}`,
  realTablero: (org,m) => `smashr.com.ar/${org.slug}/${m.eventSlug}/${m.courtSlug}/tablero`
};
