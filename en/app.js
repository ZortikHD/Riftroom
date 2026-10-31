import BUNDLED_CATALOG from './catalog.js';
// Champion-Bilder liegen als kleine Einzeldateien neben der Seite (img/sq, img/ld) und laden erst, wenn sie gebraucht werden.
const imgPath=dir=>new Proxy({},{get:(_,id)=>typeof id==='string'&&/^[A-Za-z0-9]+$/.test(id)?`img/${dir}/${id}.webp`:undefined});
const SQUARE=imgPath('sq'),LOADING=imgPath('ld');
import {ROLES,ROLE_NAMES,OPP_REGIONS,emptyOppPlayers,profileOf,learnRoles,useCatalog,initialState,composition,recommend,metaStatus,validateMeta,validateState,shortPatch} from './engine.js';
import {poolCheck,banPlan,biggestChanges,draftTurn} from './insights.js';
import {renderMini,mountMini,handleMiniClick,handleMiniInput,handleMiniSubmit} from './minigame.js';
import {renderPuzzle,handlePuzzleClick,afterPuzzle,miniStats,setMatchups,getMatchups} from './puzzles.js';
import {renderLobby,afterLobby,handleLobbyClick,handleLobbyInput,openLobbyLink,lobbyInfo} from './lobby.js';
import {setSupabase} from './live.js';
import {initRiot,riotLoad,riotState,riotSummary,comfortFromGames,validRiotId} from './riot.js';
import {BIS} from './bis.js';
import {strengthsWeaknesses,timeline,benchmarks,OBJECTIVES,PLAN_ROLES,PLAN_ROLE_NAMES,roleTimeline} from './gameplan.js';
import {guide,initGuide,startTour,tourRunning} from './guide.js';
import {phaseCurve,curveSummary,PHASES,PHASE_TIME,learnTip,aiBan,aiPick,roleInfo,banValue,banRole} from './features.js';

const $=s=>document.querySelector(s),app=$('#app'),storageKey='riftroom.v1',uiKey='riftroom.ui';
// Eigenständige Version (GitHub Pages): ohne Claude-Datenbank und ohne KI-Funktionen.
const STANDALONE=document.documentElement.dataset.standalone==='1';
// Installierbare App: Der Browser bietet die Installation an, wir zeigen dafür oben einen Knopf.
let installEvt=null;
if(STANDALONE){
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(catalog)render();});
 addEventListener('appinstalled',()=>{installEvt=null;if(catalog)render();toast('Riftroom is installed. You\'ll now find it with your apps.');});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={check:'M5 12.5l4.5 4.5L19 7.5',swap:'M7 4 3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',close:'m6 6 12 12 M6 18 18 6',plus:'M12 5v14 M5 12h14',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',upload:'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',chevrondown:'m6 9 6 6 6-6',trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15',map:'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',timer:'M12 8v5l3 2 M9 2h6 M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0',copy:'M8 8h12v12H8z M16 8V4H4v12h4',play:'M7 4v16l13-8z',book:'M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z M8 20a4 4 0 0 1 0-8h10',back:'M15 18l-6-6 6-6',refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M18 17a7 7 0 0 1-12 2l-2-3'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;

let state=initialState(),catalog,page='draft',metaTab='pool',refreshMessage='',toastTimer,pickerTarget=null,pickerRole='ALL',pickerSearch='',metaRole='ALL',metaSearch='',metaSort='adjusted',confirmAction=null,prevMeta=null,backupTimer,selectedOpponent='',analysisText='',analysisBusy=false,analysisCtrl=null,templatesOpen=false,logResult=null;
// Animationen nur für Änderungen: Vergleich mit dem zuletzt gezeigten Draft (auch bei Picks von Teammitgliedern).
let lastBoard=null,lastComp=null;
function clearDraftView(){analysisText='';lastBoard=null;csKey=null;}
// Übungs-Draft: läuft nur in diesem Browser. Der echte Draft wird vorher gesichert und danach zurückgeholt.
let practice=null,pendingRemote=null,prSide='blue',prTimer=true,prFearless=false;
// KI-Spielplan je Draft (nur im Speicher dieser Sitzung).
const planNotes=new Map();
const isNew=(type,i)=>!!(lastBoard&&state[type][i]&&lastBoard[type][i]!==state[type][i]);
// Minispiele: Auswahl als Kacheln mit Champion-Bild. Der zuletzt gewählte Reiter bleibt gemerkt.
const MINI_GAMES=[['lobby','With friends','Teemo','1 vs 1 up to 4 players'],['counter','Counter puzzle','Yasuo','Find the best counter'],['daily','Daily puzzle','Ahri','Same for everyone, with leaderboard'],['whowins','Who wins?','Jinx','Two drafts, one favorite'],['ban','Ban puzzle','Zed','Which ban hurts the most?'],['macro','Macro quiz','Nautilus','The best play on the map'],['timer','Timer quiz','Zilean','Respawns and flash in your head'],['guess','Guess the champion','Neeko','Letter by letter']];
let miniTab='counter';try{const t=localStorage.getItem('riftroom.minitab');if(MINI_GAMES.some(g=>g[0]===t))miniTab=t;}catch{}
// Rangliste fürs tägliche Puzzle: in Claude über die gemeinsame Datenbank, in der GitHub-Version über Supabase.
const dailyBoard={
 async list(date){
  if(db){const snap=await db.collection('daily/'+date+'/scores').get();return snap.docs.map(d=>d.data()).filter(e=>e&&typeof e.nick==='string'&&isFinite(e.score));}
  if(STANDALONE){const sb=await loadSb();const {data,error}=await sb.rpc('get_daily',{p_day:date,p_pid:dailyPid()});if(error)throw error;return(data||[]).map(e=>({...e,pid:e.me?dailyPid():''}));}
  throw Error('offline');
 },
 async submit(date,e){
  const entry={pid:e.pid,nick:String(e.nick).slice(0,24),score:Math.max(0,Math.min(10,e.score|0)),ms:Math.max(0,e.ms|0)};
  if(db){await db.collection('daily/'+date+'/scores').doc(entry.pid).set(entry);return;}
  if(STANDALONE){const sb=await loadSb();const {error}=await sb.rpc('submit_daily',{p_day:date,p_pid:entry.pid,p_nick:entry.nick,p_score:entry.score,p_ms:entry.ms});if(error)throw error;return;}
  throw Error('offline');
 }
};
const dailyPid=()=>{try{return localStorage.getItem('riftroom.pid')||'';}catch{return'';}};
const pzCtx={friendsBtn:g=>`<button class="btn pz-friends" data-lobby-new="${g}">${icon('users')}Play with friends</button>`,catalog:()=>catalog,meta:()=>state.meta,esc:v=>esc(v),cname:id=>cname(id),SQUARE,LOADING,toast:(m,e)=>toast(m,e),burst:(h,n)=>burst(h,n),board:dailyBoard,rerender:()=>{if(page==='mini')render();}};
function renderMiniPage(){
 const st=miniStats();
 const tiles=`<div class="game-hub" role="tablist" aria-label="Minispiele">${MINI_GAMES.map(([k,l,art,sub],i)=>`<button class="game-tile ${miniTab===k?'on':''} ${k==='lobby'?'mp':''}" role="tab" aria-selected="${miniTab===k}" data-minitab="${k}" style="--i:${i}"><img src="${LOADING[art]}" alt=""><span class="gt-text"><b>${l}</b><small>${k==='lobby'&&lobbyInfo()?'Lobby '+esc(lobbyInfo()):st[k]?esc(st[k]):sub}</small></span>${k==='daily'&&st.daily!=='Done'?'<i class="gt-new">New</i>':''}</button>`).join('')}</div>`;
 return tiles+(miniTab==='guess'?renderMini(miniCtx):miniTab==='lobby'?renderLobby(lbCtx):renderPuzzle(miniTab,pzCtx));
}
const miniCtx={catalog:()=>catalog,esc:v=>esc(v),portrait:id=>portrait(id,'av'),toast:(m,e)=>toast(m,e),rerender:()=>{if(page==='mini')render();}};
const setMiniTab=t=>{miniTab=t;try{localStorage.setItem('riftroom.minitab',t);}catch{}if(page==='mini'){render();window.scrollTo({top:0,behavior:'instant'});}};
const lbCtx={esc:v=>esc(v),LOADING,SQUARE,icon:n=>icon(n),toast:(m,e)=>toast(m,e),burst:(h,n)=>burst(h,n),standalone:STANDALONE,rerender:()=>{if(page==='mini')render();},setTab:setMiniTab,tab:()=>miniTab,page:()=>page,pz:pzCtx,mg:miniCtx};
if(STANDALONE)setSupabase(()=>loadSb());
const MAIN_PAGES={draft:'Draft',team:'Team',opponents:'Opponents',meta:'Meta',mini:'Mini games'};
const MORE_PAGES={games:'Results',settings:'Data & Backup'};
const PAGES={...MAIN_PAGES,...MORE_PAGES};
const META_TABS=[['pool','Your Pool'],['bans','Bans'],['trends','Trends'],['all','All Champions']];

const champ=id=>catalog?.champions.find(c=>c.id===id);
const cname=id=>id==='none'?'No ban':champ(id)?.name||id;
// Suche: ohne Akzente, Leerzeichen und Apostrophe, plus gängige Kürzel aus der Community.
const ALIAS={MissFortune:'mf',TwistedFate:'tf',JarvanIV:'j4 jarvan',AurelionSol:'asol',KogMaw:'kog',XinZhao:'xin',Warwick:'ww',Leblanc:'lb',Gangplank:'gp',TahmKench:'tk tahm',RekSai:'rek',MasterYi:'yi',DrMundo:'mundo',Heimerdinger:'heimer donger',Kassadin:'kassa',Katarina:'kat',Lissandra:'liss',Malzahar:'malz',Nocturne:'noc',Sejuani:'sej',Tristana:'trist',Vladimir:'vlad',Volibear:'voli',Ezreal:'ez',Caitlyn:'cait',LeeSin:'lee',Cassiopeia:'cass cassio',Morgana:'morg',Blitzcrank:'blitz',Fiddlesticks:'fid fiddle',MonkeyKing:'wukong wu',Chogath:'cho',Khazix:'kha',Velkoz:'vel',Kaisa:'kai',Belveth:'bel',Renata:'glasc',Seraphine:'sera',Orianna:'ori',Hecarim:'hec',Mordekaiser:'morde',Pantheon:'panth',Tryndamere:'trynd',Aphelios:'aph',Malphite:'malph',Nautilus:'naut',Soraka:'raka',Renekton:'renek croc',Evelynn:'eve',Alistar:'ali',Nidalee:'nid',Maokai:'mao',Yasuo:'yas',Zilean:'zil',Taliyah:'tali',Viktor:'vik',Gragas:'grag'};
const normQ=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function champMatch(c,q){const n=normQ(q);if(!n)return 0;const nm=normQ(c.name),id=normQ(c.id);
 if(nm.startsWith(n)||id.startsWith(n))return 3;if((ALIAS[c.id]||'').split(' ').some(a=>a.startsWith(n)))return 3;
 if(c.name.split(/[\s.']+/).some(w=>normQ(w).startsWith(n)))return 2;if(nm.includes(n)||id.includes(n))return 1;return 0;}
const searchChamps=(list,q)=>list.map(c=>[c,champMatch(c,q)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]||a[0].name.localeCompare(b[0].name,'de')).map(x=>x[0]);
const portrait=(id,cls='av')=>`<img class="${cls}" src="${SQUARE[id]||'icon.svg'}" alt="" loading="lazy">`;
const date=v=>v?new Date(v).toLocaleString('en-US',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'never';
const pct=v=>v.toFixed(1)+'%';
const int=n=>Number(n).toLocaleString('en-US');
const deltaTag=d=>d==null?'<span></span>':`<span class="tag ${d<=-1?'warn':d>=1?'good':''}">${d>0?'+':''}${d.toFixed(1)}</span>`;
const head=(title,sub='',actions='')=>`<div class="page-head"><div><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div>${actions?`<div class="head-actions">${actions}</div>`:''}</div>`;

function toast(message,error=false){const t=$('#toast');clearTimeout(toastTimer);t.textContent=message;t.className=`show ${error?'error':''}`;toastTimer=setTimeout(()=>t.className='',error?8000:4000);}
function save(){if(room?.role==='viewer')return;if(practice){queueMicrotask(practiceCheck);return;}queueRoomPush();clearTimeout(backupTimer);backupTimer=setTimeout(pushBackup,3000);try{localStorage.setItem(storageKey,JSON.stringify({...state,catalog:null}));}catch{toast('Browser storage is full or blocked. Back up your team under “Data”.',true);}}
function saveUi(){try{localStorage.setItem(uiKey,JSON.stringify({page,metaTab}));}catch{}}
// Beispiel-Team aus initialState(): Namen "Spieler 01" bis "Spieler 05" (beim Laden geleerte Namen werden zu "Spieler 1" usw.).
const isExampleTeam=()=>state.players.every((p,i)=>new RegExp('^(Spieler|Player) 0?'+(i+1)+'$').test(p.name));
// Engine kennt Katalog und Winrates (für automatisch erkannte Rollen und geschätzte Profile).
function syncEngine(){useCatalog(catalog);learnRoles(state.meta);}
// Eigene Bilanz eines Champions auf einer Position (aus der Spielhistorie).
const recTxt=({w,l})=>`${w}–${l}`;
function currentPatch(){return state.targetPatch||catalog.version;}
function status(){return metaStatus(state.meta,currentPatch());}
const activeOpp=()=>state.opponents.find(o=>o.id===state.opponentId)||null;
// Alle bekannten Champions eines Gegners: Mains der einzelnen Spieler plus Team-Favoriten.
const oppAll=o=>o?[...new Set([...o.players.flatMap(p=>p.champs),...o.favorites])]:[];
const favSet=()=>new Set(oppAll(activeOpp()));
const opggMulti=o=>{const ids=o.players.map(p=>p.riotId).filter(r=>r.includes('#'));return ids.length?`https://op.gg/lol/multisearch/${o.region}?summoners=${ids.map(encodeURIComponent).join(',')}`:'';};
const opggProfile=(o,riotId)=>{const i=riotId.lastIndexOf('#');return`https://op.gg/lol/summoners/${o.region}/${encodeURIComponent(riotId.slice(0,i).trim())}-${encodeURIComponent(riotId.slice(i+1).trim())}`;};
const metaFor=(id,role)=>state.meta?.entries.find(e=>e.champion===id&&e.role===role);
// Empfehlungen mit Lane-Duell: Matchup-Winrates kommen aus denselben Daten wie das Counter-Puzzle.
const muLoaded=()=>{if(page==='draft'||page==='plan'||page==='meta')render();};
const rec=st=>recommend(st,catalog,Date.now(),getMatchups(muLoaded));
// Riot-Daten der Gegner (falls geladen): pro Rolle die Champions, die der Spieler dort wirklich spielt.
function oppPersonal(opp){
 if(!opp||!STANDALONE)return[];
 return opp.players.map((p,i)=>{const st=validRiotId(p.riotId)?riotState(opp.region||'euw',p.riotId):null;if(!st?.data)return null;const s=riotSummary(st.data,ROLES[i],catalog);return{map:new Map(s.inRole.map(c=>[c.id,{n:c.n,w:c.w}])),games:s.roleGames};});
}
// Konter gegen eure Comfort-Picks (Sicherheit 4–5) oder den schon gepickten Champion, aus den Matchup-Winrates.
function poolCounters(tk){
 const m=getMatchups(muLoaded);if(!m?.roles)return[];
 const out=[];
 state.players.forEach((p,i)=>{
  // Hat ein Spieler mehrere Comfort-Picks, lohnt ein Konter-Ban weniger (er weicht einfach aus). Pro Champion höchstens zwei Konter.
  const r=ROLES[i],mine=state.allies[i]?[{id:state.allies[i],comfort:5}]:[...p.pool].filter(v=>v.comfort>=4&&!tk.has(v.id)).sort((a,b)=>b.comfort-a.comfort).slice(0,3);
  for(const v of mine){
   const rows=(m.roles[r]?.[v.id]||[]).filter(x=>x[2]>=400).map(([o,w,n])=>({id:o,wr:(w*n+50*200)/(n+200)})).filter(x=>x.wr>=52.5).sort((a,b)=>b.wr-a.wr).slice(0,2);
   for(const x of rows)out.push({id:x.id,vs:v.id,wr:x.wr,role:r,weight:v.comfort/5/mine.length*(state.allies[i]?1:0.6)});
  }
 });
 return out;
}
function banList(n=5,forDraft=true){
 const st=status(),meta=st.ok?state.meta:null,opp=activeOpp(),tk=forDraft?taken():new Set(),info=forDraft?roleInfo(state.enemies):null;
 return banPlan(state,meta,new Map(catalog.champions.map(x=>[x.id,x])),{opp,personal:oppPersonal(opp),counters:forDraft?poolCounters(tk):[],info,relevance:(id,role)=>info?banValue(id,info,state.meta):1,taken:tk,n});
}
function banWhy(x){
 if(x.kind==='main')return x.n?`${ROLE_NAMES[x.role]} main · ${x.n} ${x.n===1?'game':'games'}, ${Math.round(x.pw)}%`:`${ROLE_NAMES[x.role]} main${x.wr!=null?' · '+pct(x.wr):''}`;
 if(x.kind==='fav')return`Team favorite${x.wr!=null?' · '+pct(x.wr):''}`;
 if(x.kind==='counter')return`Counter to ${cname(x.vs)} (${pct(x.wr)})`;
 return`Strong in the meta · ${pct(x.wr)}`;
}
// Ist ein Champion schon als Main begründet, ist „stark im Meta“ doppelt: dann weglassen.
const banNote=b=>{const own=b.notes.some(x=>x.kind==='main'||x.kind==='fav');return[...new Set(b.notes.filter(x=>!(own&&x.kind==='meta')).slice(0,2).map(banWhy))].join(' · ');};
// „Kein Ban nötig“: Gegner-Mains, die gerade schwach sind oder vom Spieler selbst kaum gewonnen werden.
const skipWhy=x=>x.n>=5?`${x.n} games, only ${Math.round(x.pw)}% wins`:x.offmeta?(x.role?`barely played as ${ROLE_NAMES[x.role]}`:'barely played'):`weak right now, ${pct(x.wr)}`;
const skipHtml=sk=>sk.length?`<p class="fine ban-skip">No ban needed: ${sk.slice(0,3).map(x=>`<b>${esc(cname(x.id))}</b> (${skipWhy(x)})`).join(', ')}.</p>`:'';
const selOpp=()=>state.opponents.find(o=>o.id===selectedOpponent)||state.opponents[0]||null;
const taken=()=>new Set([...state.allies,...state.enemies,...state.bans,...(state.fearless?.used||[])].filter(Boolean));

let lastPageRendered=null,bannerClosed=false,lastInk=null;
// Grüne Linie unter dem aktiven Tab: gleitet beim Seitenwechsel vom alten zum neuen Tab.
function placeTabInk(){
 const nav=document.querySelector('.tabs'),on=nav?.querySelector('.tab.on');if(!nav||!on)return;
 const ink=document.createElement('span');ink.className='tab-ink';nav.appendChild(ink);
 const nr=nav.getBoundingClientRect(),r=on.getBoundingClientRect(),left=Math.round(r.left-nr.left+nav.scrollLeft+12),width=Math.max(12,Math.round(r.width-24));
 Object.assign(ink.style,{left:left+'px',width:width+'px'});
 if(lastInk&&lastInk.page!==page&&(lastInk.left!==left||lastInk.width!==width)&&!calm())
  ink.animate([{left:lastInk.left+'px',width:lastInk.width+'px'},{left:left+'px',width:width+'px'}],{duration:320,easing:'cubic-bezier(.3,.7,.2,1)'});
 lastInk={left,width,page};
}
// Leere Karten bekommen einen kleinen Champion-Fächer, bevorzugt aus euren Pools.
function decorateEmpty(){
 const cards=document.querySelectorAll('.card.empty:not(.decorated)');if(!cards.length)return;
 const ids=[...new Set(state.players.flatMap(p=>p.pool.map(v=>v.id)))].filter(id=>SQUARE[id]);
 const pick=ids.length>=5?ids:['Ahri','Thresh','LeeSin','Jinx','Garen'];
 cards.forEach((card,k)=>{card.classList.add('decorated');const set=[0,1,2,3,4].map(i=>pick[(i+k*2)%pick.length]);
  card.insertAdjacentHTML('afterbegin',`<div class="empty-art" aria-hidden="true">${set.map((id,i)=>`<img src="${SQUARE[id]}" alt="" style="--i:${i-2}">`).join('')}</div>`);});
}
// Offline-Hinweis nur beim ersten Besuch groß zeigen, danach reicht der Status oben rechts.
const offlineSeenBefore=(()=>{try{return localStorage.getItem('riftroom.offlineSeen')==='1';}catch{return false;}})();
function bannerHtml(){
 if(!refreshMessage||bannerClosed)return'';
 const offline=refreshMessage.startsWith('Offline');
 if(offline&&offlineSeenBefore)return'';
 if(offline){try{localStorage.setItem('riftroom.offlineSeen','1');}catch{}}
 return`<div class="banner closable"><span>${esc(refreshMessage)}</span><button class="icon-btn" data-action="close-banner" aria-label="Close notice">${icon('close')}</button></div>`;
}
function render(){
 syncEngine();
 const st=status(),m=state.meta;
 const newPatch=m&&catalog&&state.seenPatch!==shortPatch(catalog.version);
 const inMore=page in MORE_PAGES;
 const navOn=k=>page===k||(k==='draft'&&page==='plan');
 const nav=Object.entries(MAIN_PAGES).map(([k,l])=>`<button class="tab ${navOn(k)?'on':''}" data-page="${k}" ${navOn(k)?'aria-current="page"':''}>${k==='mini'?`<span class="tab-full">${l}</span><span class="tab-short">Games</span>`:l}${k==='meta'&&newPatch?'<span class="new-dot" title="Neuer Patch"></span>':''}</button>`).join('')
  +`<details class="more"><summary class="tab ${inMore?'on':''}">${inMore?`<span class="more-full">${MORE_PAGES[page]}</span><span class="more-short">More</span>`:'More'}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></summary><div class="more-menu">${Object.entries(MORE_PAGES).map(([k,l])=>`<button class="more-item ${page===k?'on':''}" data-page="${k}" ${page===k?'aria-current="page"':''}>${l}</button>`).join('')}</div></details>`;
 const chip=st.ok?`<span class="chip ok" title="Win rates from ${esc(m.source)}, as of ${date(m.updatedAt)}"><span class="dot"></span>Patch ${esc(shortPatch(currentPatch()))}${st.fallback?` · Winrates ${esc(shortPatch(m.patch))}`:''}</span>`:`<span class="chip" title="${refreshMessage.startsWith('Offline')?esc(refreshMessage):''}"><span class="dot"></span>${m?esc(st.label):refreshMessage.startsWith('Offline')?'Offline':'No win rates'}</span>`;
 const views={plan:renderPlan,draft:renderDraft,meta:renderMeta,opponents:renderOpponents,team:renderTeam,games:renderGames,mini:renderMiniPage,settings:renderSettings};
 app.innerHTML=`<header class="top"><div class="top-in"><button class="brand" data-page="draft"><img src="icon.svg" alt="">Riftroom</button><nav class="tabs" aria-label="Main navigation">${nav}</nav><div class="top-right">${chip}${installEvt?`<button class="install-btn" data-action="install" title="Install Riftroom as an app">${icon('download')}<span>App</span></button>`:''}<button class="lang-btn" data-action="lang" title="Auf Deutsch umstellen" aria-label="Language: English. Switch to German">DE</button><button class="help-btn" data-action="tour" title="Show introduction" aria-label="Show introduction">?</button></div></div></header>
 <main class="page ${page!==lastPageRendered?'enter':''}">${bannerHtml()}${roomBarHtml()}<div class="page-body ${room?.role==='viewer'?'viewer':''}" ${viewerLocked()?'inert':''}>${views[page]()}</div></main>
 <footer class="foot"><div class="foot-in">Fan project. Riot Games does not endorse or sponsor this project. <button class="link" data-page="settings">Data sources and legal</button></div></footer>`;
 placeTabInk();decorateEmpty();fitCurves();
 if($('#confirm-dialog').open&&$('#confirm-dialog [data-riot-res]'))riotRepaint();
 lastPageRendered=page;
 if(page==='mini'&&miniTab==='guess')mountMini(miniCtx);
 if(page==='mini'&&miniTab!=='guess'&&miniTab!=='lobby')afterPuzzle(miniTab);
 if(page==='mini'&&miniTab==='lobby')afterLobby();
 setTimeout(autoTour,350);
}

/* ---------- Draft (Champ Select) ---------- */
// Ablauf wie im League-Champ-Select: Turnier-Reihenfolge, immer genau ein aktiver Schritt.
let lastPhaseKey=null,lastPhaseWho=null,csPoolOnly=false,pickRole=null,csKey=null,hoverId=null,csSearch='',csRole='ALL',enemyRole=null,undoStack=[];
const sideOf=who=>(who==='us')===(state.side!=='red')?'blue':'red';
function stepTarget(c){
 if(!c)return null;
 if(c.type==='ban'){const base=c.who==='us'?0:5;return{type:'bans',index:[0,1,2,3,4].map(k=>base+k).find(k=>!state.bans[k])};}
 if(c.who==='us'){let i=state.selectedRole;if(state.allies[i])i=state.allies.findIndex(x=>!x);return{type:'allies',index:i};}
 let i=enemyRole;if(i==null||state.enemies[i])i=state.enemies.findIndex(x=>!x);return{type:'enemies',index:i};
}
const draftStarted=()=>!!(practice||state.draftActive||[...state.allies,...state.enemies,...state.bans].some(Boolean));
function renderDraft(){
 if(!draftStarted()){lastPhaseKey=null;return renderDraftStart();}
 const t=draftTurn(state),c=t.current,tgt=stepTarget(c),ours=sideOf('us'),theirs=sideOf('them');
 const key=t.finished?'done':`${c.i}|${tgt.index}`;
 if(key!==csKey){csKey=key;hoverId=null;pickRole=null;csSearch='';csRole=tgt&&tgt.type!=='bans'?ROLES[tgt.index]:'ALL';}
 const opp=activeOpp(),aiTurn=practice&&c&&c.who==='them';
 // Kopf
 const sub=`${state.side==='red'?'Red':'Blue'} side · vs ${esc(opp?.name||(practice?'the computer':'Opponent'))}${practice?' · Practice':''}${state.fearless?` · Fearless game ${state.fearless.game}`:''}`;
 const actions=(t.finished?`<button class="btn small" data-action="copy-discord">${icon('copy')}For Discord</button>${practice?'':'<button class="btn small primary" data-action="log-game">Log game</button>'}`:'')
  +(!practice&&undoStack.length&&!t.finished?`<button class="btn small" data-action="undo">${icon('back')}Undo</button>`:'')
  +`<button class="btn ghost small" data-action="draft-end">${t.finished?'New draft':practice?'End practice':'Cancel'}</button>`;
 // Phase
 const verb=t.finished?'Draft complete':c.who==='us'?(c.type==='ban'?'You ban':'You pick'):(c.type==='ban'?'Opponent bans':'Opponent picks');
 const hint=t.finished?'All picks are locked. Time for the game plan.':aiTurn?'The computer is thinking …':c.who==='them'&&!practice?`${c.type==='ban'?'Ban':'Pick'} ${c.n} of 5 · enter what the opponent chooses`:`${c.type==='ban'?'Ban':'Pick'} ${c.n} of 5`;
 const stepSpan=s=>`<span class="step ${s.side==='B'?'b':'r'} ${s.done?'done':''} ${c&&c.i===s.i?'now':''}" title="${s.who==='us'?'You':'Opponent'} · ${s.type==='ban'?'Ban':'Pick'} ${s.n}">${s.n}</span>`;
 // Schritte nach Phasen gruppiert (Bans 1 · Picks 1 · Bans 2 · Picks 2), damit man sieht, wo man im Ablauf steht.
 const groups=[];for(const s of t.steps){const g=groups[groups.length-1];if(g&&g.type===s.type)g.items.push(s);else groups.push({type:s.type,items:[s]});}
 const steps=groups.map((g,k)=>`<span class="step-group ${g.items.some(s=>c&&c.i===s.i)?'cur':''}"><span class="step-label">${g.type==='ban'?'Bans':'Picks'} ${groups.slice(0,k+1).filter(x=>x.type===g.type).length}</span><span class="step-pips">${g.items.map(stepSpan).join('')}</span></span>`).join('');
 const left=practice?.deadline?Math.max(0,practice.deadline-Date.now()):null;
 const timer=left!=null?`<div class="cs-timer"><span id="practice-time" class="num">${Math.ceil(left/1000)}</span><div class="timer-bar"><i id="practice-bar" style="width:${left/300}%"></i></div></div>`:'';
 const pk=t.finished?'done':String(c.i),changed=lastPhaseKey!==null&&pk!==lastPhaseKey,prevWho=lastPhaseWho;
 const fx=changed?(t.finished?'swap':c.who==='us'&&prevWho==='them'?'swap yourturn':'swap'):'';
 if(changed&&t.finished)setTimeout(()=>burst(document.querySelector('.cs-done-in'),46),60);
 lastPhaseKey=pk;lastPhaseWho=c?.who||null;
 const phase=`<section class="cs-phase side-${t.finished?ours:sideOf(c.who)} ${t.finished?'done':''} ${fx}">${fx.includes('yourturn')?'<span class="yt-tag">Your turn</span>':''}<div class="cs-phase-main"><strong>${verb}</strong><span>${hint}</span>${!t.finished&&!aiTurn?`<span class="cs-focus">${icon('spark')}${esc(focusTip(c))}</span>`:''}</div>${timer}<div class="steps">${steps}</div><div class="steps-compact"><span>${t.finished?'Done':`Step ${c.i+1} of ${t.steps.length}`}</span><div class="steps-bar"><i style="width:${(t.finished?t.steps.length:c.i)/t.steps.length*100}%"></i></div></div></section>`;
 // Bans
 const ban=i=>{const id=state.bans[i],act=tgt?.type==='bans'&&tgt.index===i;return`<span class="cs-ban ${id?'filled':''} ${id==='none'?'none':''} ${act?'active':''} ${isNew('bans',i)?'just':''}" title="${id?esc(cname(id)):act?'Ban in progress':'Ban '+(i%5+1)}">${id==='none'?'<span class="no-ban">–</span>':id?portrait(id,''):act&&hoverId?`<img class="ghost" src="${SQUARE[hoverId]||'icon.svg'}" alt="">`:''}</span>`;};
 const banA=`<div class="cs-ban-row side-${ours}" aria-label="Bans">${[0,1,2,3,4].map(ban).join('')}</div>`,banB=`<div class="cs-ban-row side-${theirs} rev" aria-label="Bans">${[5,6,7,8,9].map(ban).join('')}</div>`;
 const html=head('Draft','',actions).replace('class="head-actions"',t.finished?'class="head-actions m-dock"':'class="head-actions"')+draftTabs('draft',sub)+phase+flUsedHtml()+`<div class="cs-grid-wrap">${teamColumn('allies',ours,tgt,t,banA)}${renderCenter(t,c,tgt,aiTurn)}${teamColumn('enemies',theirs,tgt,t,banB)}</div>`+renderDraftExtras();
 lastBoard={allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]};lastComp=composition(state.allies);
 return html;
}
// Welche Pool-Champions eines Spielers noch frei sind. Ab höchstens einem freien kommt eine Warnung.
function poolStatus(i){
 const pool=state.players[i].pool;if(!pool.length)return'';
 const tk=taken(),free=pool.filter(v=>!tk.has(v.id)).length,warn=free<=1;
 const imgs=pool.slice(0,5).map(v=>`<img src="${SQUARE[v.id]}" alt="" class="${tk.has(v.id)?'gone':''}" title="${esc(cname(v.id))}${tk.has(v.id)?' (weg)':''}">`).join('');
 return`<span class="cs-pool ${warn?'warn':''}" title="${free} of ${pool.length} pool champions available"><span class="cs-pool-imgs">${imgs}</span><span class="cs-pool-n">${warn?'! ':''}${free}/${pool.length}</span></span>`;
}
function teamColumn(type,side,tgt,t,bansHtml=''){
 const list=state[type],us=type==='allies',enemyInfo=us?null:roleInfo(state.enemies);
 const rows=list.map((id,i)=>{
  const pv=t.current?.type==='pick'&&tgt?.type===type&&pickRole!=null&&!list[pickRole]?pickRole:tgt?.index;
  const act=tgt?.type===type&&pv===i,canTarget=!t.finished&&!id&&t.current?.type==='pick'&&t.current.who===(us?'us':'them')&&!(practice&&!us);
  const prev=act&&hoverId?hoverId:null,img=id||prev;
  const mu=!us&&id&&state.matchups[id];
  const name=id?esc(cname(id)):prev?esc(cname(prev)):act?'choosing …':'';
  const who=us?esc(state.players[i].name):ROLE_NAMES[ROLES[i]];
  const fx=!us&&id?enemyInfo.flex.get(i):null;
  const ps=us&&!id&&!t.finished?poolStatus(i):'';
  const attrs=canTarget?`data-cs-target="${type}|${i}"`:t.finished&&!practice?`data-picker="${type}" data-index="${i}"`:'';
  return`<div data-slot="${type}|${i}" class="cs-row ${id?'filled':''} ${act?'active':''} ${isNew(type,i)?'just':''}">${attrs?`<button class="cs-row-btn" ${attrs} aria-label="${us?'Your':'Opponent'} ${ROLE_NAMES[ROLES[i]]}${id?': '+esc(cname(id)):''}"></button>`:''}${img?`<img class="cs-splash ${prev&&!id?'ghost':''}" src="${LOADING[img]||SQUARE[img]||'icon.svg'}" alt="">`:''}<div class="cs-row-text"><span class="role-label">${ROLE_NAMES[ROLES[i]]}${fx?'?':''}</span><strong>${name||'<span class="muted">—</span>'}</strong>${us?`<span class="fine">${who}</span>`:''}${us?wishChip(i):''}${fx?`<span class="flex-note" title="Can play several roles. Only later will you know which."><i class="flex-tag">Flex</i>${fx.map(r=>ROLE_NAMES[r]).join(' / ')}</span>`:''}${ps}</div>${id?`<button class="cs-swap" data-swap="${type}|${i}" title="Swap role or change pick" aria-label="${esc(cname(id))}: swap role or change pick">${icon('swap')}</button>`:''}${!us&&id?`<button class="cs-mu ${mu?'has':''}" data-mu-edit="${id}" title="${mu?esc(mu):'Matchup note on '+esc(cname(id))}" aria-label="Matchup note on ${esc(cname(id))}">${icon('book')}</button>`:''}</div>`;}).join('');
 return`<section class="cs-team side-${side} ${us?'ours':'theirs'}"><div class="cs-team-head"><span class="side-tag ${side}">${esc(us?state.teamName:(activeOpp()?.name||'Opponent'))}</span>${!us&&STANDALONE&&room?.role!=='viewer'&&!practice?scoutBtn():''}</div>${bansHtml}${rows}</section>`;
}
// Vorschläge für den aktuellen Schritt.
// Kurze Begründung für Pick-Vorschläge, z. B. „passt zum Pool (4/5) · ergänzt Engage“.
const WHY=new Map([['Frontline','adds frontline'],['Engage','adds engage'],['Magic damage','you lack magic damage'],['Physical damage','you lack physical damage'],['Protects carries','protects your carries'],['Peel vs engage','peel against their engage'],['Scaling vs frontline','scales against their frontline'],['Alternative','solid alternative']]);
const why=(x,r)=>{const m=/(\d)\/5$/.exec(x);if(m)return`fits the pool (${m[1]}/5)`;if(x==='Matchup+'&&r?.matchup)return`wins the lane vs ${cname(r.matchup.foe)} (${pct(r.matchup.wr)})`;if(x==='Matchup-'&&r?.matchup)return`tough vs ${cname(r.matchup.foe)} (${pct(r.matchup.wr)})`;if(x==='Off-Meta')return'barely played in this role';if(x==='Nische')return'rarely played in this role';return WHY.get(x)||x;};
function stepSuggestions(c,tgt){
 const tk=taken(),byId=new Map(catalog.champions.map(x=>[x.id,x])),st=status(),meta=st.ok?state.meta:null,opp=activeOpp();
 if(c.type==='ban'&&c.who==='us'){
  // Nur Rollen bannen, die der Gegner noch nicht sicher besetzt hat. Schwache Mains werden als „kein Ban nötig“ erklärt.
  const info=roleInfo(state.enemies),plan=banList(5);
  const filled=ROLES.filter(r=>info.certain.has(r));
  return{title:filled.length?`Ban suggestions for open roles`:'Ban suggestions',items:plan.items.map(x=>({id:x.id,note:banNote(x)})),after:skipHtml(plan.skipped)+(STANDALONE&&room?.role!=='viewer'&&!practice&&!(activeOpp()?.players.some(p=>validRiotId(p.riotId)))?`<button class="link scout-link" data-action="scout-open">${icon('users')}Enter the opponents’ Riot IDs for more precise bans</button>`:'')};
 }
 const ri=c.type==='pick'&&pickRole!=null?pickRole:tgt.index;
 if(c.who==='us'){const recs=rec({...state,selectedRole:ri,poolOnly:false}).slice(0,5);return{title:`Recommended for ${ROLE_NAMES[ROLES[ri]]}`,items:recs.map((r,k)=>({id:r.id,score:r.score,top:k<3,note:r.reasons.slice(0,k<3?2:1).map(x=>why(x,r)).join(' · ')}))};}
 const mains=c.type==='pick'?(opp?.players[ri]?.champs||[]):oppAll(opp);
 const items=mains.filter(id=>!tk.has(id)).map(id=>({id,note:'Main'}));
 return{title:opp?`Typical for ${esc(opp.name)}`:'',items:items.slice(0,5)};
}
// Welche Rolle sollten wir als Nächstes picken? Punkte je offene Rolle mit kurzer Begründung.
// + Konter: Gegner hat diese Rolle schon sicher gepickt. + Pool in Gefahr: kaum noch freie Pool-Champions.
// + Sicherer Blind-Pick früh (Jungle, Support, Bot). − Mid und Top früh blind (leicht zu kontern). + starker Pick verfügbar.
function roleAdvice(){
 const open=state.allies.map((x,i)=>x?null:i).filter(i=>i!=null);if(open.length<2)return[];
 const enemy=roleInfo(state.enemies),tk=taken(),picksDone=state.allies.filter(Boolean).length,BLIND={JUNGLE:2,UTILITY:1.5,BOTTOM:1,TOP:0,MIDDLE:0};
 return open.map(i=>{
  const r=ROLES[i],reasons=[];let score=0;
  const foe=enemy.certain.has(r)?state.enemies.find((id,j)=>id&&j===i)||state.enemies.find(id=>id&&(profileOf(id)?.roles||[]).length===1&&profileOf(id).roles[0]===r):null;
  if(enemy.certain.has(r)){score+=3;reasons.push(foe?`Counter possible vs ${cname(foe)}`:'Counter possible: enemy role is locked');}
  const pool=state.players[i].pool,free=pool.filter(v=>!tk.has(v.id)).length;
  if(pool.length&&free<=1){score+=3;reasons.push(free?'Pool almost empty: only 1 left':'Pool empty: secure it now');}
  else if(pool.length&&free===2){score+=1;reasons.push('Pool getting thin: 2 left');}
  const blindLate=!enemy.certain.has(r)&&picksDone<3&&BLIND[r]<1;
  if(!enemy.certain.has(r)&&picksDone<3){score+=BLIND[r];if(BLIND[r]>=1)reasons.push('Safe blind pick');}
  const best=rec({...state,selectedRole:i,poolOnly:false})[0];
  if(best&&best.score>=75){score+=1;reasons.push(`Strong pick available: ${cname(best.id)}`);}
  if(!reasons.length)reasons.push(blindLate?'Better later, easy to counter now':'Open');
  return{i,score,reasons};
 }).sort((a,b)=>b.score-a.score||a.i-b.i);
}
function renderCenter(t,c,tgt,aiTurn){
 // Nach dem Draft: Fazit direkt in der Mitte (Zusammenstellung und Stärkekurve), darunter der Weg zum Spielplan.
 if(t.finished)return`<section class="card cs-center cs-summary"><div class="cs-done-in cs-sum-head">${icon('check','big')}<h2>Summary</h2></div><div class="cs-sum-grid"><div class="cs-sum-part">${compCardHtml()}</div><div class="cs-sum-part">${renderCurve(true)}</div></div><div class="cs-sum-actions"><button class="btn primary" data-page="plan">${icon('map')}Open game plan</button>${state.fearless&&room?.role!=='viewer'?flNextHtml():''}${practice?'<button class="btn ghost small" data-action="practice-again">Practice again</button>':''}</div></section>`;
 if(room?.role==='viewer'&&c.who!=='us')return`<section class="card cs-center cs-wait"><div class="cs-done-in"><div class="spinner"></div><p>${c.who==='us'?`${esc(state.teamName)} ${c.type==='ban'?'bans':'picks'} …`:`${esc(state.teamName)} is entering ${c.type==='ban'?'the enemy ban':'the enemy pick'} …`}</p><p class="fine">You're watching live. Every ban and pick appears instantly.</p></div></section>`;
 if(aiTurn)return`<section class="card cs-center cs-wait"><div class="cs-done-in"><div class="spinner"></div><p>The computer ${c.type==='ban'?'bans':'picks'} …</p></div></section>`;
 const sug=stepSuggestions(c,tgt);
 const adv=c.who==='us'&&c.type==='pick'?roleAdvice():[],curRole=pickRole!=null?pickRole:tgt?.index;
 const advHtml=adv.length?`<div class="role-adv"><span class="label">Pick now:</span><div class="role-adv-row">${adv.map((x,k)=>`<button class="ra ${k===0?'best':''} ${x.i===curRole?'on':''}" data-ra="${x.i}" aria-pressed="${x.i===curRole}">${k===0?'<i class="ra-star" aria-hidden="true">★</i>':''}<b>${ROLE_NAMES[ROLES[x.i]]}</b><small>${esc(x.reasons[0])}</small></button>`).join('')}</div></div>`:'';
 const sugHtml=`<div id="team-wish">${teamWishHtml(c)}</div>`+advHtml+(sug.title&&sug.items.length?`<div class="cs-sug"><span class="label">${sug.title}</span><div class="cs-sug-row">${sug.items.map(x=>`<button class="cs-sug-item ${hoverId===x.id?'on':''}" data-hover="${x.id}" title="${esc(x.note)}">${portrait(x.id,'av sm')}<span><b>${esc(cname(x.id))}${c.type==='pick'&&(profileOf(x.id)?.roles.length||0)>1?'<i class="flex-tag" title="Can play several roles">Flex</i>':''}</b><small class="${x.top?'why':''}">${esc(x.note)}</small></span>${x.score!=null?`<span class="mini-score">${x.score}</span>`:''}</button>`).join('')}</div>${sug.after||''}</div>`:'');
 const roles=['ALL',...ROLES];
 return`<section class="card cs-center">${sugHtml}<div class="cs-filter"><div class="search">${icon('search')}<input class="field" id="cs-search" placeholder="Search champion" value="${esc(csSearch)}" autocomplete="off" aria-label="Search champion"></div><button class="pool-toggle" data-cs-pool aria-pressed="${csPoolOnly}" title="Only show champions from your pools">Pools only</button><div class="seg cs-roles" role="group" aria-label="Role">${roles.map(r=>`<button data-cs-role="${r}" aria-pressed="${csRole===r}">${r==='ALL'?'All':ROLE_NAMES[r]}</button>`).join('')}</div></div><div class="cs-champs" id="cs-grid">${csGrid()}</div><div class="cs-lock" id="cs-lock">${lockBar()}</div></section>`;
}
function csGrid(){
 const tk=taken(),q=csSearch.trim().toLowerCase();
 const pools=csPoolOnly?new Set(state.players.flatMap(p=>p.pool.map(v=>v.id))):null;
 const base=[...catalog.champions].filter(c=>!pools||pools.has(c.id));
 const list=q?searchChamps(base,q):base.filter(c=>csRole==='ALL'||profileOf(c.id)?.roles.includes(csRole)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 const fl=new Set(state.fearless?.used||[]);
 return list.map(c=>`<button class="champ-btn ${hoverId===c.id?'on':''} ${fl.has(c.id)?'fl':''}" data-hover="${c.id}" ${tk.has(c.id)?'disabled':''} aria-label="${esc(c.name)}${tk.has(c.id)?' (vergeben)':''}">${portrait(c.id,'')}<span>${esc(c.name)}</span></button>`).join('')||'<div class="no-results">No champion found.</div>';
}
function lockBar(){
 const t=draftTurn(state),c=t.current;if(!c)return'';
 if(room?.role==='viewer')return viewerLockBar(c);
 const verb=c.type==='ban'?(c.who==='us'?'Ban':'Enter opponent ban'):(c.who==='us'?'Pick':'Enter opponent pick');
 const noBan=c.type==='ban'&&!(practice&&c.who!=='us')?`<button class="btn ghost small" data-action="no-ban" title="If no champion was banned">No ban</button>`:'';
 if(!hoverId)return`<span class="fine">Choose a champion. Double-click confirms right away.</span><span class="lock-actions">${noBan}<button class="btn primary" disabled>${verb}</button></span>`;
 const tgL=stepTarget(c),isPick=c.type==='pick',type=c.who==='us'?'allies':'enemies',pr=isPick?(pickRole??tgL.index):null;
 const roleSel=isPick?`<div class="pick-roles"><span class="fine">${c.who==='us'?'Which role?':'Which role?'}</span><div class="seg" role="group" aria-label="Role for this pick">${openSlots(type).map(i=>`<button data-pick-role="${i}" aria-pressed="${pr===i}">${ROLE_NAMES[ROLES[i]]}</button>`).join('')}</div></div>`:'';
 let info='';
 const pf=profileOf(hoverId),flex=pf&&pf.roles.length>1?`Flex: ${pf.roles.map(r=>ROLE_NAMES[r]).join('/')}`:'';
 if(c.who==='us'&&c.type==='pick'){const pa=previewAllies(),a0=composition(state.allies),a1=pa?composition(pa):a0,gains=[['front','Frontline'],['engage','Engage'],['peel','Peel']].filter(([k])=>a1[k]>a0[k]).map(([k,l])=>`${l} +${a1[k]-a0[k]}`),r=rec({...state,selectedRole:pr,poolOnly:false}).find(x=>x.id===hoverId);info=[r?`Fit ${r.score}`:'',r?.stat?`${pct(r.stat.wins/r.stat.games*100)} WR`:'',r?.matchup?`${pct(r.matchup.wr)} vs ${cname(r.matchup.foe)}`:'',...gains,flex].filter(Boolean).join(' · ');}
 else if(state.meta){const e=state.meta.entries.filter(x=>x.champion===hoverId).sort((a,b)=>b.games-a.games)[0];if(e)info=`${pct(e.wins/e.games*100)} WR · ${ROLE_NAMES[e.role]}${e.banRate!=null?` · Ban rate ${pct(e.banRate)}`:''}`;}
 if(!info&&flex)info=flex;
 const v2=isPick?`${verb} as ${ROLE_NAMES[ROLES[pr]]}`:verb;
 return`<div class="cs-lock-champ">${portrait(hoverId,'av')}<div><strong>${esc(cname(hoverId))}</strong><span class="fine">${info}</span></div></div>${roleSel}<button class="btn primary lock-btn" data-action="lock-in">${v2}</button>`;
}
// Rollenwahl beim Picken: Nicht immer pickt zuerst die Rolle, die oben steht (z. B. Support als Erster).
function openSlots(type){return state[type].map((x,i)=>x?null:i).filter(i=>i!=null);}
function suggestRole(id,c,tgt){
 const type=c.who==='us'?'allies':'enemies',open=openSlots(type),roles=profileOf(id)?.roles||[];
 if(open.includes(tgt.index)&&roles.includes(ROLES[tgt.index]))return tgt.index;
 const m=open.find(i=>roles.includes(ROLES[i]));return m!=null?m:(open.includes(tgt.index)?tgt.index:open[0]);
}
function selectHover(id,forced=null){
 if(taken().has(id))return;
 hoverId=id;
 {const t=draftTurn(state),c=t.current;if(c&&c.type==='pick'&&!(practice&&c.who!=='us')){const r=forced!=null&&openSlots(c.who==='us'?'allies':'enemies').includes(forced)?forced:suggestRole(id,c,stepTarget(c));if(r!==pickRole){pickRole=r;render();return;}}}
 document.querySelectorAll('[data-hover]').forEach(b=>b.classList.toggle('on',b.dataset.hover===id));
 const lb=$('#cs-lock');if(lb)lb.innerHTML=lockBar();
 const cc=$('#comp-card');if(cc)cc.innerHTML=compCardHtml();
 // Vorschau im aktiven Slot
 const act=document.querySelector('.cs-row.active');if(act&&!act.classList.contains('filled')){let img=act.querySelector('.cs-splash');if(!img){img=document.createElement('img');img.className='cs-splash ghost';img.alt='';act.prepend(img);}img.src=LOADING[id]||SQUARE[id]||'icon.svg';const n=act.querySelector('strong');if(n)n.textContent=cname(id);}
 const ab=document.querySelector('.cs-ban.active');if(ab)ab.innerHTML=`<img class="ghost" src="${SQUARE[id]||'icon.svg'}" alt="">`;
}
// Kurzer Auftritt des Champions nach einem Pick, wie im Champ Select. Bei "Bewegung reduzieren" nichts.
function lockSplash(id,who,roleIndex){
 if(!id||id==='none'||calm())return;
 const host=document.querySelector('.cs-center');if(!host)return;
 const side=sideOf(who),el=document.createElement('div');
 // Hohe, schmale Karte (Handy): Bild als 16:9-Band oben statt stark vergrößert über die ganze Höhe.
 const band=host.offsetHeight>host.offsetWidth*0.9;
 el.className=`lock-splash ${side} ${who==='us'?'from-left':'from-right'}${band?' band':''}`;
 if(band)el.style.setProperty('--bt',Math.max(0,Math.round((host.offsetHeight-host.offsetWidth*0.5625)/2-50))+'px');
 el.innerHTML=`<img src="${LOADING[id]||SQUARE[id]}" alt=""><div class="ls-text"><span class="role-label">${ROLE_NAMES[ROLES[roleIndex]]||''}</span><strong>${esc(cname(id))}</strong></div>`;
 host.appendChild(el);setTimeout(()=>el.remove(),1300);
}
function lockIn(){
 if(room?.role==='viewer'){viewerSend();return;}
 const t=draftTurn(state),c=t.current;if(!c||!hoverId)return;
 if(practice&&c.who!=='us')return;
 let tgt=stepTarget(c);if(!tgt||tgt.index==null||tgt.index<0)return;
 if(c.type==='pick'&&pickRole!=null&&!state[tgt.type][pickRole])tgt={type:tgt.type,index:pickRole};
 pickRole=null;
 if(taken().has(hoverId)){toast('This champion is already taken.',true);return;}
 const id=hoverId;state[tgt.type][tgt.index]=id;if(!practice)undoStack.push(tgt);
 if(tgt.type==='allies'){const next=state.allies.findIndex(x=>!x);if(next>=0)state.selectedRole=next;}
 if(tgt.type==='enemies')enemyRole=null;
 hoverId=null;save();render();
 if(tgt.type!=='bans')lockSplash(id,tgt.type==='allies'?'us':'them',tgt.index);
}
// Vorschau: Allies mit dem angetippten Champion in der gewählten Rolle (nur bei eigenem Pick).
// Kleiner Konfetti-Effekt in Blau, Rot und Akzent. Bei "Bewegung reduzieren" nichts.
function burst(host,count=36){
 if(!host||calm())return;
 host.style.position=host.style.position||'relative';
 const cols=['var(--blue)','var(--red)','var(--accent)','var(--warn)'];
 for(let i=0;i<count;i++){const p=document.createElement('i');p.className='fx-conf';p.style.cssText=`--x:${(Math.random()*2-1)*240}px;--y:${-(60+Math.random()*200)}px;--r:${Math.random()*720-360}deg;--c:${cols[i%cols.length]};--t:${(.8+Math.random()*.6).toFixed(2)}s`;host.appendChild(p);setTimeout(()=>p.remove(),1600);}
}
function previewAllies(){
 const c=draftTurn(state).current;if(!hoverId||!c||c.who!=='us'||c.type!=='pick')return null;
 const tg=stepTarget(c);const i=pickRole!=null&&!state.allies[pickRole]?pickRole:tg?.index;if(i==null||i<0)return null;
 const a=[...state.allies];a[i]=hoverId;return a;
}
function compCardHtml(){
 const comp=composition(state.allies),prev=lastComp,pa=previewAllies(),pv=pa?composition(pa):null;
 const meter=(label,v,key)=>{const p=prev?Math.min(prev[key],5):5,nv=pv?Math.min(pv[key],5):Math.min(v,5),cur=Math.min(v,5);
  const status=x=>x===0?'missing':x<5?'present':'strong';
  const diff=pv?pv[key]-v:0;
  return`<div class="meter"><div class="meter-top"><span>${label}</span><span class="muted">${diff>0?`<b class="gain">+${diff}</b> `:''}${status(pv?pv[key]:v)}</span></div><div class="pips">${[0,1,2,3,4].map(k=>`<i class="${k<cur?'on':k<nv?'next':''}${k<cur&&k>=p&&!pv?' pop':''}" style="--d:${(k-p)*70}ms"></i>`).join('')}</div></div>`;};
 const dmg=[['physical','phys','Physical'],['magic','magic','Magic'],['mixed','mixed','Mixed']],d=pv||comp;
 return`<div class="card-head"><h2>Composition</h2><span class="muted">${pv?`<span class="tag good">Preview</span>`:`${comp.count} / 5`}</span></div><div class="comp">${meter('Frontline',comp.front,'front')}${meter('Engage',comp.engage,'engage')}${meter('Peel',comp.peel,'peel')}<div class="dmg"><div class="dmg-legend">${dmg.map(([k,c,l])=>`<span><i class="${c}"></i>${l} ${d[k]}</span>`).join('')}</div><div class="dmg-bar">${d.known?dmg.filter(([k])=>d[k]).map(([k,c])=>`<span class="${c}" style="flex:${d[k]}"></span>`).join(''):''}</div></div></div>`;
}
function renderDraftExtras(){
 const fin=draftTurn(state).finished;
 const compCard=fin?'':`<section class="card" id="comp-card">${compCardHtml()}</section>`;
 const curve=!fin&&state.allies.some(Boolean)&&state.enemies.some(Boolean)?`<section class="card"><div class="card-head"><h2>Power curve</h2><span class="tag">Estimate</span></div>${renderCurve(true)}</section>`:'';
 const analysis=STANDALONE?'':`<section class="card"><div class="card-head"><h2>Draft analysis</h2><button class="btn small ${analysisBusy?'':'primary'}" data-action="${analysisBusy?'stop-analysis':'analyze'}">${analysisBusy?'Stop':icon('spark')+'Analyze'}</button></div><div id="analysis-text" class="analysis">${analysisText?esc(analysisText):'<span class="muted">Claude sums up in a few sentences what is missing and what works.</span>'}</div></section>`;
 return`<div class="cs-extras">${compCard}${curve}${analysis}</div>`;
}
// Draft-Start: links und rechts ziehen ganz langsam zufällige Champion-Bilder vorbei, blau und rot getönt.
// Einmal pro Besuch gemischt, damit beim Neuzeichnen nichts springt.
let dsPicks=null;
function dsSide(side){
 if(!dsPicks){const ids=catalog.champions.map(c=>c.id).filter(id=>SQUARE[id]);for(let i=ids.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[ids[i],ids[j]]=[ids[j],ids[i]];}dsPicks=ids;}
 const n=dsPicks.length||1,base=side==='blue'?0:24;
 const cols=[0,1,2,3].map(c=>[0,1,2,3,4,5].map(k=>dsPicks[(base+c*6+k)%n]).filter(Boolean));
 // Startpunkt aus der Uhrzeit: neu zeichnen setzt die Spalten nicht zurück, die Bewegung läuft einfach weiter.
 const now=Date.now()/1000;
 return`<div class="ds-mosaic ${side}" aria-hidden="true">${cols.map((ids,c)=>`<div class="ds-col"><div class="ds-strip" style="animation-duration:${130+c*20}s;animation-delay:-${(now%(130+c*20)).toFixed(2)}s">${[...ids,...ids].map(id=>`<img src="${SQUARE[id]}" alt="" decoding="async">`).join('')}</div></div>`).join('')}</div>`;
}
function renderDraftStart(){
 if(room?.role==='viewer')return`<section class="card empty room-wait"><h2>Waiting for the draft</h2><p>As soon as ${esc(state.teamName)} starts the draft, you'll see every ban and pick here live.</p></section>`;
 const intro=renderChecklist();
 return`<section class="ds-hero">${dsSide('blue')}${dsSide('red')}<div class="ds-side blue"><span>Blue</span></div><div class="ds-mid"><span class="ds-eyebrow">Champ Select · Tournament order</span><h1>Ready to draft?</h1><p>Ban and pick in turns, step by step, with suggestions for every role.</p><button class="btn primary big" data-action="draft-open">${icon('play')}Start draft</button>${STANDALONE&&!room?`<button class="btn ds-room" data-action="room-open">${icon('users')}Live room for your team</button>`:''}</div><div class="ds-side red"><span>Red</span></div></section>`+intro+renderTemplates();
}
// Startliste: was ein neues Team der Reihe nach erledigen sollte. Der erste offene Punkt ist hervorgehoben.
const EX_POOLS=initialState().players.map(p=>p.pool.map(v=>v.id).join());
function checklistItems(){
 const team=!isExampleTeam();
 const pools=state.players.every(p=>p.pool.length>=2)&&state.players.filter((p,i)=>p.pool.map(v=>v.id).join()!==EX_POOLS[i]).length>=3;
 return[
  {done:team,title:'Add your players',text:'Team name and the five player names.',btn:`<button class="btn small" data-action="tour" data-tour-name="team">Show me</button>`},
  {done:pools,title:'Fill champion pools',text:'Three to five safe champions per player.',btn:`<button class="btn small" data-action="tour" data-tour-name="team" data-tour-step="pool">Show me</button>`},
  {done:state.opponents.length>0,optional:true,title:'Add an opponent',text:'Optional, gives better ban suggestions.',btn:`<button class="btn small" data-page="opponents">Open</button>`},
  {done:guide.get().drafted||state.history.length>0,title:'Do your first draft',text:'Best start with a practice draft against the computer.',btn:`<button class="btn small" data-action="draft-open">Start</button>`},
 ];
}
let lastChecklist=null;
function renderChecklist(){
 const items=checklistItems(),done=items.filter(x=>x.done).length,prev=lastChecklist;lastChecklist=items.map(x=>x.done);
 if(prev&&done===items.length&&prev.some(x=>!x))setTimeout(()=>toast('Checklist complete. You are ready to draft!'),100);
 if(done===items.length||guide.get().hidden)return'';
 const next=items.findIndex(x=>!x.done);
 return`<section class="card checklist"><div class="card-head"><div><h2>Checklist</h2><p class="fine">${done} of ${items.length} done</p></div><button class="btn ghost small" data-action="hide-checklist">Hide</button></div>
 <div class="cl-bar"><i style="width:${done/items.length*100}%"></i></div>
 <ol class="cl-list">${items.map((x,i)=>`<li class="${x.done?'done':''} ${i===next?'next':''} ${x.done&&prev&&!prev[i]?'just-done':''}"><span class="cl-mark">${x.done?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>':i+1}</span><div class="cl-text"><strong>${x.title}${x.optional?' <span class="tag">optional</span>':''}</strong><span class="fine">${x.text}</span></div>${x.done?'':x.btn}</li>`).join('')}</ol></section>`;
}
// Worauf ihr im aktuellen Draft-Schritt achten solltet.
function focusTip(c){
 if(!c)return'';
 if(c.who==='them')return c.type==='ban'?'Enter the opponent ban. Who are they taking away from you?':'Enter the opponent pick. Which of your open roles can counter it?';
 if(c.type==='ban'){
  const info=roleInfo(state.enemies),filled=ROLES.filter(r=>info.certain.has(r)).map(r=>ROLE_NAMES[r]),open=info.open.map(r=>ROLE_NAMES[r]);
  const flex=[...info.flex.entries()].map(([i,rs])=>`${cname(state.enemies[i])} (${rs.map(r=>ROLE_NAMES[r]).join('/')})`);
  if(filled.length||flex.length)return`${filled.length?`Opponent already has ${filled.join(', ')}. `:''}Ban for ${open.join(', ')}.${flex.length?` Flex still unclear: ${flex.join(', ')}.`:''}`;
  return activeOpp()?.favorites?.length||activeOpp()?.players?.some(p=>p.champs.length)?'Ban what the opponent likes to play most.':'Ban strong meta champions that threaten your picks.';
 }
 const comp=composition(state.allies);
 {const adv=roleAdvice();if(adv.length&&adv[0].score>=2)return`Recommendation: pick ${ROLE_NAMES[ROLES[adv[0].i]]} now. ${adv[0].reasons.join(', ')}.`;}
 if(comp.count<2)return'Secure strong, flexible champions from your pools first. Flex picks give nothing away early.';
 if(comp.count>=3&&ROLES.some((r,i)=>!state.allies[i]&&state.enemies[i]))return`Counter: ${ROLES.map((r,i)=>!state.allies[i]&&state.enemies[i]?`${ROLE_NAMES[r]} vs ${cname(state.enemies[i])}`:null).filter(Boolean).join(', ')} is already locked. Pick accordingly.`;
 if(comp.front<3)return'You still lack frontline. Look at tanks and fighters.';
 if(comp.engage<3)return'You still lack engage to start fights.';
 if(comp.physical>=3&&comp.magic===0)return'Only physical damage so far. A magic pick makes you harder to itemize against.';
 if(comp.magic>=3&&comp.physical===0)return'Only magic damage so far. A physical pick makes you harder to itemize against.';
 return'Your composition looks good. Now it is about what your players are comfortable on.';
}
function autoTour(){
 if(document.getElementById('splash')){setTimeout(autoTour,500);return;}
 if(tourRunning()||document.querySelector('dialog[open]')||room)return;
 if(page==='draft'&&draftStarted()){if(!guide.seen('draft')&&document.querySelector('.cs-phase')&&!(practice&&draftTurn(state).current?.who==='them'))startTour('draft');return;}
 if(page==='draft'&&!guide.seen('welcome')){startTour('welcome');return;}
 if(page==='team'&&!guide.seen('team')&&guide.seen('welcome'))startTour('team');
}
function helpTour(){
 if(page==='draft'&&draftStarted()&&document.querySelector('.cs-phase'))return startTour('draft');
 if(page==='team')return startTour('team');
 if(guide.get().hidden){guide.hide(false);}
 if(page!=='draft'){page='draft';saveUi();render();}
 startTour('welcome');
}
let prMode='real';
try{const d=JSON.parse(localStorage.getItem('riftroom.draftopts')||'{}');if(d.side==='red')prSide='red';if(d.mode==='ai')prMode='ai';if(d.timer===false)prTimer=false;if(d.fearless===true)prFearless=true;}catch{}
const saveDraftOpts=()=>{try{localStorage.setItem('riftroom.draftopts',JSON.stringify({side:prSide,mode:prMode,timer:prTimer,fearless:prFearless}));}catch{}};
// Rolle eines Picks ändern (tauscht mit dem anderen Slot) oder den Pick korrigieren.
function openSwapDialog(type,i){
 const id=state[type][i];if(!id)return;confirmAction=null;
 const fix=!practice;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">${esc(cname(id))}</h2><p class="fine" style="margin-top:4px">${type==='allies'?'Is someone else actually playing this champion? Swap the role.':'Is the opponent playing it in another role? Swap it here.'}</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <div><span class="field-label">Role</span><div class="seg wide five" role="group" aria-label="Role">${ROLES.map((r,j)=>`<button data-swap-to="${type}|${i}|${j}" aria-pressed="${i===j}">${ROLE_NAMES[r]}${state[type][j]&&j!==i?`<small>${esc(cname(state[type][j]))}</small>`:''}</button>`).join('')}</div><p class="fine" style="margin-top:6px">If a champion is already there, both swap roles.</p></div>
 <div class="dlg-actions">${fix?`<button class="btn ghost" data-swap-clear="${type}|${i}">Remove pick</button><button class="btn" data-swap-change="${type}|${i}">Other champion</button>`:''}<button class="btn primary" data-action="cancel-confirm">Done</button></div>`;
 $('#confirm-dialog').showModal();
}
// Gegner scouten direkt im Draft: Riot-IDs eintragen und laden. Die meistgespielten Champions fließen sofort in die Ban-Vorschläge.
const scoutBtn=()=>{const o=activeOpp(),n=o?o.players.filter(p=>validRiotId(p.riotId)).length:0;const full=n?`Riot IDs (${n}/5)`:'Enter Riot IDs';return`<button class="btn small cs-scout" data-action="scout-open" title="${full}" aria-label="${full}">${icon('users')}${n?`<span>${n}/5</span>`:''}</button>`;};
function openScout(){
 if(!activeOpp()){const o={id:Date.now().toString(36),name:'Opponent',notes:'',favorites:[],region:state.riotRegion||'euw',players:emptyOppPlayers()};state.opponents.push(o);state.opponentId=o.id;save();}
 const o=activeOpp();selectedOpponent=o.id;confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">Scout the opponent</h2><p class="fine" style="margin-top:4px">Enter Riot IDs and Riftroom loads their recent games. What they really play goes straight into the ban suggestions.</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <div class="scout-top"><input class="field grow" id="opp-name" maxlength="40" value="${esc(o.name)}" aria-label="Team name"><select class="field" id="opp-region" aria-label="Region">${OPP_REGIONS.map(r=>`<option value="${r}" ${o.region===r?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select><button class="btn small" data-riot-all="opp">${icon('refresh')}Load all</button></div>
 <div class="scout-list">${o.players.map((p,i)=>`<div class="opp-player"><span class="role-label">${ROLE_NAMES[ROLES[i]]}</span><input class="field" data-opp-riot="${i}" value="${esc(p.riotId)}" placeholder="Name#EUW" maxlength="40" aria-label="Riot ID ${ROLE_NAMES[ROLES[i]]}" autocomplete="off" spellcheck="false"><button class="icon-btn" data-riot-load="opp|${i}" aria-label="Load" title="Load">${icon('refresh')}</button>${riotBox('opp',i)}</div>`).join('')}</div>
 <div class="dlg-actions"><button class="btn primary" data-action="cancel-confirm">Done</button></div>`;
 $('#confirm-dialog').showModal();
 $('#confirm-dialog').addEventListener('close',()=>{if(page==='draft')render();},{once:true});
}
function openDraftDialog(){
 confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">Start draft</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <div class="log-form">
  <div><span class="field-label">Your side</span><div class="seg wide side-pick" role="group" aria-label="Your side"><button data-pr-side="blue" aria-pressed="${prSide==='blue'}">Blue</button><button data-pr-side="red" aria-pressed="${prSide==='red'}">Red</button></div></div>
  <div><span class="field-label">Opponent</span><div class="seg wide" role="group" aria-label="Opponent"><button data-pr-mode="real" aria-pressed="${prMode==='real'}">Real game</button><button data-pr-mode="ai" aria-pressed="${prMode==='ai'}">Vs computer</button></div><p class="fine" id="pr-mode-hint" style="margin-top:6px">${prMode==='ai'?'Practice against the computer. Only in this browser.':'You enter the opponent picks. The team sees the draft live.'}</p></div>
  <div><span class="field-label">Mode</span><div class="seg wide" role="group" aria-label="Mode"><button data-pr-fearless="off" aria-pressed="${!prFearless}">Single game</button><button data-pr-fearless="on" aria-pressed="${prFearless}">Fearless series</button></div><p class="fine" id="pr-fl-hint" style="margin-top:6px">${prFearless?FL_HINT:'A normal draft.'}</p></div>
  <div id="pr-timer-row" ${prMode==='ai'?'':'hidden'}><span class="field-label">Timer per step</span><div class="seg wide" role="group" aria-label="Timer"><button data-pr-timer="on" aria-pressed="${prTimer}">30 seconds</button><button data-pr-timer="off" aria-pressed="${!prTimer}">No timer</button></div></div>
  ${state.opponents.length?`<div><label class="field-label" for="pr-opp">Opponent team (optional)</label><select class="field" id="pr-opp" style="width:100%"><option value="">None</option>${state.opponents.map(o=>`<option value="${esc(o.id)}" ${o.id===state.opponentId?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>`:''}
 </div>
 <div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Cancel</button><button class="btn primary" data-action="draft-start">Let's go</button></div>`;
 $('#confirm-dialog').showModal();
}
// Fearless-Serie: Wer in einem Spiel der Serie gepickt wurde, ist danach für beide Teams gesperrt (Bans zählen nicht).
const FL_HINT='Anything picked in a game is locked for both teams for the rest of the series. The pro leagues have played this way since 2025.';
function flUsedHtml(){
 const f=state.fearless;if(!f)return'';
 return`<div class="fl-used"><span class="fl-tag">Fearless</span><span class="fine">Game ${f.game}${f.used.length?` · ${f.used.length} locked`:' · nothing locked yet'}</span>${f.used.length?`<div class="fl-row">${f.used.map(id=>`<img src="${SQUARE[id]}" alt="${esc(cname(id))}" title="${esc(cname(id))}">`).join('')}</div>`:''}</div>`;
}
function flNextHtml(){return`<div class="fl-next"><span class="fine">Next game of the series, your side:</span><div class="row"><button class="btn" data-fl-next="blue">Blue</button><button class="btn" data-fl-next="red">Red</button></div></div>`;}
function fearlessNext(side){
 const f=state.fearless;if(!f)return;
 const next={game:f.game+1,used:[...new Set([...f.used,...state.allies,...state.enemies].filter(Boolean))]};
 if(practice)startPractice({timer:practice.timer,side,opponentId:state.opponentId,fearless:next});else startRealDraft(side,state.opponentId,next);
 toast(`Game ${next.game} of the Fearless series: ${next.used.length} champions are locked.`);
}
function startRealDraft(side,opponentId,fearless=prFearless?{game:1,used:[]}:null){
 guide.markDrafted();resetTeamWishes();
 Object.assign(state,{allies:Array(5).fill(null),enemies:Array(5).fill(null),bans:Array(10).fill(null),draftMode:'tournament',side,opponentId,selectedRole:0,draftActive:true,fearless});
 undoStack=[];clearDraftView();page='draft';save();render();window.scrollTo({top:0,behavior:'instant'});
}
function endDraft(){
 resetTeamWishes();
 Object.assign(state,{allies:Array(5).fill(null),enemies:Array(5).fill(null),bans:Array(10).fill(null),draftActive:false,selectedRole:0,fearless:null});
 undoStack=[];clearDraftView();save();render();
}
function renderTemplates(){
 const list=state.templates.map(t=>`<li class="tpl"><div class="tpl-info"><strong>${esc(t.name)}</strong><div class="fine">${t.allies.filter(Boolean).length} Picks · ${t.enemies.filter(Boolean).length} opponent · ${t.bans.filter(Boolean).length} Bans</div></div><button class="btn small" data-template-load="${esc(t.id)}">Load</button><button class="icon-btn" data-template-delete="${esc(t.id)}" aria-label="Delete template ${esc(t.name)}">${icon('close')}</button></li>`).join('');
 return`<details class="card fold" id="fold-templates" ${templatesOpen?'open':''}><summary>Saved drafts <span class="tag">${state.templates.length}</span>${icon('chevrondown')}</summary><div class="fold-body"><div class="row wrap"><input class="field grow" id="template-name" maxlength="40" placeholder="Name, e.g. Plan A vs engage" aria-label="Template name"><button class="btn" data-action="save-template">${icon('plus')}Save current draft</button></div>${list?`<ul class="tpl-list">${list}</ul>`:'<p class="fine">No template saved yet.</p>'}</div></details>`;
}

/* ---------- Matchup-Notizen ---------- */
function showMatchupDialog(id){
 confirmAction=null;const n=state.matchups[id]||'';
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div class="row">${portrait(id,'av sm')}<h2 id="confirm-title">Against ${esc(cname(id))}</h2></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <label class="field-label" for="mu-text">What do you need to know against ${esc(cname(id))}? Applies to all games and is visible to the whole team.</label>
 <textarea class="field" id="mu-text" rows="5" maxlength="500" placeholder="e.g. don’t trade levels 1–3, watch for Ghost, go in after a missed Q.">${esc(n)}</textarea>
 <div class="dlg-actions">${n?`<button class="btn ghost" data-mu-delete="${id}">Delete</button>`:''}<button class="btn" data-action="cancel-confirm">Cancel</button><button class="btn primary" data-mu-save="${id}">Save</button></div>`;
 $('#confirm-dialog').showModal();$('#mu-text').focus();
}

/* ---------- Stärkekurve ---------- */
// Die Kurve wird in genau der Breite gezeichnet, die sie auf dem Bildschirm hat (fitCurves), damit die Schrift nicht mitwächst.
function curveSvg(compact,W){
 const a=phaseCurve(state.allies),b=phaseCurve(state.enemies);
 const ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue',theirs=ours==='red'?'blue':'red';
 const nameA=esc(state.teamName).slice(0,14),nameB=esc(activeOpp()?.name||'Opponent').slice(0,14);
 // Wertebereich eng um die Daten, damit Unterschiede sichtbar werden (Linien, keine Flächen).
 const H=compact?150:190,L=24,R=26+Math.max(nameA.length,nameB.length)*7,T=12,B=26,lo=Math.max(0,Math.min(...a,...b)-1.5),hi=Math.max(...a,...b,1)+1.5;
 const x=i=>L+i*(W-L-R)/2,y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
 const line=(v,cls)=>`<polyline class="cv-line ${cls}" pathLength="100" points="${v.map((p,i)=>`${x(i)},${y(p)}`).join(' ')}"/>`+v.map((p,i)=>`<circle class="cv-dot ${cls}" cx="${x(i)}" cy="${y(p)}" r="4"/>`).join('');
 let ya=y(a[2]),yb=y(b[2]);if(Math.abs(ya-yb)<13){const mid=(ya+yb)/2;ya=mid+(ya<=yb?-7:7);yb=mid+(ya<=yb?7:-7);}
 const hits=PHASES.map((p,i)=>`<rect class="cv-hit" x="${x(i)-26}" y="${T}" width="52" height="${H-T-B}"><title>${p} (${PHASE_TIME[i]}): ${nameA} ${String(a[i])} · ${nameB} ${String(b[i])}</title></rect>`).join('');
 const svg=`<svg class="curve" data-compact="${compact?1:0}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated strength of both teams in the early, mid and late game">
  ${[0,.5,1].map(f=>`<line class="cv-grid" x1="${L}" x2="${W-R+6}" y1="${T+f*(H-T-B)}" y2="${T+f*(H-T-B)}"/>`).join('')}
  ${PHASES.map((p,i)=>`<text class="cv-x" x="${x(i)}" y="${H-8}" text-anchor="middle">${p}</text>`).join('')}
  ${line(b,'c-'+theirs)}${line(a,'c-'+ours)}
  <text class="cv-lab" x="${x(2)+10}" y="${ya+4}">${nameA}</text><text class="cv-lab" x="${x(2)+10}" y="${yb+4}">${nameB}</text>
  ${hits}</svg>`;
 return svg;
}
function fitCurves(){
 for(const el of document.querySelectorAll('svg.curve[data-compact]')){
  const w=Math.round(el.parentElement.clientWidth),vb=+el.viewBox.baseVal.width;
  if(w>=240&&Math.abs(w-vb)>8)el.outerHTML=curveSvg(el.dataset.compact==='1',w);
 }
}
let fitTimer=null;addEventListener('resize',()=>{clearTimeout(fitTimer);fitTimer=setTimeout(fitCurves,150);});
function renderCurve(compact){
 const a=phaseCurve(state.allies),b=phaseCurve(state.enemies);
 const ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue',theirs=ours==='red'?'blue':'red';
 const nameA=esc(state.teamName).slice(0,14),nameB=esc(activeOpp()?.name||'Opponent').slice(0,14);
 const svg=curveSvg(compact,compact?320:520);
 const legend=`<div class="cv-legend"><span><i class="c-${ours}"></i>${nameA}</span><span><i class="c-${theirs}"></i>${nameB}</span></div>`;
 const table=compact?'':`<details class="rec-more"><summary>Values as table</summary><table class="cv-table"><thead><tr><th>Phase</th><th class="r">${nameA}</th><th class="r">${nameB}</th></tr></thead><tbody>${PHASES.map((p,i)=>`<tr><td>${p} <span class="muted">${PHASE_TIME[i]}</span></td><td class="r">${String(a[i])}</td><td class="r">${String(b[i])}</td></tr>`).join('')}</tbody></table></details>`;
 return`<p class="cv-sum">${curveSummary(a,b)}</p>${legend}${svg}<p class="fine">Rough estimate from the champion profiles (scaling and engage), not measured values.</p>${table}`;
}

/* ---------- Spielplan nach dem Draft ---------- */
const draftKey=()=>JSON.stringify([state.allies,state.enemies,state.bans,state.side,state.opponentId]);
const POS=[[10,32],[25,62],[42,58],[73,90],[53,90]];
function mapSvg(ours){
 const theirs=ours==='blue'?'red':'blue';
 const pos=(side,i)=>side==='blue'?POS[i]:[POS[i][1],POS[i][0]];
 const tok=(id,side,i,k,mine)=>{const [x,y]=pos(side,i);return`<g transform="translate(${x} ${y})"><g class="token ${mine?'mine':''}" style="--k:${k}"><circle r="5.7" class="tok-ring ${side}"/><clipPath id="tc${k}"><circle r="4.8"/></clipPath><image href="${SQUARE[id]||'icon.svg'}" x="-4.8" y="-4.8" width="9.6" height="9.6" clip-path="url(#tc${k})" preserveAspectRatio="xMidYMid slice"/><text y="9.6" class="tok-name">${esc(cname(id))}</text><title>${mine?'Your':'Opponent'} ${ROLE_NAMES[ROLES[i]]}: ${esc(cname(id))}</title></g></g>`;};
 return`<svg class="rift" viewBox="-2 -2 104 106" role="img" aria-label="Map sketch with the positions of both teams">
  <rect x="0" y="0" width="100" height="100" rx="6" class="m-ground"/>
  <g class="m-jungle"><ellipse cx="27" cy="52" rx="9" ry="15" transform="rotate(45 27 52)"/><ellipse cx="48" cy="73" rx="9" ry="15" transform="rotate(45 48 73)"/><ellipse cx="52" cy="27" rx="9" ry="15" transform="rotate(45 52 27)"/><ellipse cx="73" cy="48" rx="9" ry="15" transform="rotate(45 73 48)"/></g>
  <path d="M7 7 L93 93" class="m-river"/>
  <g class="m-lanes"><path d="M10 86 V10 H86"/><path d="M14 90 H90 V14"/><path d="M15 85 L85 15"/></g>
  <circle cx="10" cy="90" r="8" class="m-base blue"/><circle cx="90" cy="10" r="8" class="m-base red"/>
  <circle cx="30" cy="30" r="2.8" class="m-pit"/><circle cx="70" cy="70" r="2.8" class="m-pit"/>
  <text x="30" y="25.4" class="m-label" text-anchor="middle">Baron</text><text x="70" y="77.2" class="m-label" text-anchor="middle">Dragon</text>
  ${state.enemies.map((id,i)=>tok(id,theirs,i,i+5,false)).join('')}${state.allies.map((id,i)=>tok(id,ours,i,i,true)).join('')}
 </svg>`;
}
// Draft und Spielplan gehören zusammen: zwei Reiter direkt unter dem Seitenkopf.
const draftTabs=(on,sub='')=>`<div class="draft-tabs-row"><div class="subtabs draft-tabs" role="tablist"><button role="tab" data-page="draft" aria-selected="${on==='draft'}">Champ Select</button><button role="tab" data-page="plan" aria-selected="${on==='plan'}">Game plan</button></div>${sub?`<span class="draft-sub">${sub}</span>`:''}</div>`;
function renderPlan(){
 const back='';
 if(!(state.allies.every(Boolean)&&state.enemies.every(Boolean)))return head('Game plan','The game plan appears once all ten champions are set.',back)+draftTabs('plan')+`<section class="card empty"><p>Set all picks for both teams first.</p><button class="btn primary" data-page="draft">To the draft</button></section>`;
 const key=draftKey();let n=planNotes.get(key);
 if(!n){if(STANDALONE)n={status:'off'};else{n={status:'loading',pending:true};setTimeout(()=>generatePlan(key),0);}planNotes.set(key,n);}
 const ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue',opp=activeOpp();
 const actions=`${back}<button class="btn small" data-action="copy-discord">${icon('copy')}For Discord</button>${n.status!=='loading'&&n.status!=='off'?`<button class="btn small" data-action="plan-regen">${icon('refresh')}New notes</button>`:''}${practice||room?.role==='viewer'?'':`<button class="btn small primary" data-action="log-game">Log game</button>`}`;
 const note=n.status==='loading'?`<div class="banner ai-wait">${icon('spark')}Claude is writing notes for every position<span>.</span><span>.</span><span>.</span></div>`
  :n.status==='unavailable'?'<div class="banner">AI notes are only available when the page is opened signed in to Claude. You still see the map, power curve and your matchup notes.</div>'
  :n.status==='error'?`<div class="banner warn">${n.code==='not_granted'?'AI notes were not allowed. You can change this in the page’s permission menu.':n.code==='rate_limited'?'Too many requests right now. Try again in a minute.':'The notes could not be created.'} <button class="link" data-action="plan-regen">Try again</button></div>`:'';
 const win=n.status==='done'&&n.data.win?`<section class="card win-cond"><span class="role-label">How you win</span><p>${esc(n.data.win)}</p></section>`:'';
 const list=(t,arr)=>arr?.length?`<h4>${t}</h4><ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
 const cards=ROLES.map((r,i)=>{const a=state.allies[i],e=state.enemies[i],mu=state.matchups[e],ai=n.status==='done'?n.data.roles[r]:null;
  const body=ai?list('Key info',ai.wichtig)+list('Plan',ai.plan):n.status==='loading'?'<div class="sk"></div><div class="sk short"></div><div class="sk"></div>':'';
  const bm=benchmarks(i,a,state.allies);
  const when=(ai?.wann||[]).map(x=>{const m=x.match(/^\s*(ca\.\s*)?(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)\s*[–:-]?\s*(.*)$/);return m?[m[2].replace(/\s+/g,''),m[3]]:['',x];});
  const bmHtml=`<div class="bench"><h4>Your benchmarks</h4><ul class="bench-list">${[...bm.items,...when].map(([t,txt])=>`<li>${t?`<span class="bench-t">${esc(t)}</span>`:''}<span>${esc(txt)}</span></li>`).join('')}</ul><p class="bench-note"><b>Power-Spike:</b> ${esc(bm.spike)}</p><p class="bench-note"><b>Roaming:</b> ${esc(bm.roam)}</p></div>`;
  return`<section class="card role-card side-${ours}" id="rc-${r}" style="--k:${i}"><div class="rc-head"><span class="role-label">${ROLE_NAMES[r]}</span><span class="fine">${esc(state.players[i].name)}</span></div><div class="rc-vs">${portrait(a)}<span class="vs">vs</span>${portrait(e)}</div><p class="rc-names"><strong>${esc(cname(a))}</strong> vs <strong>${esc(cname(e))}</strong></p>${mu?`<p class="rc-mu">${icon('book')}<span>${esc(mu)}</span></p>`:''}${body}${bmHtml}</section>`;}).join('');
 return head('Game plan','',actions).replace('class="head-actions"','class="head-actions m-dock"')+draftTabs('plan',`${esc(state.teamName)} vs ${esc(opp?.name||'Opponent')} · Patch ${esc(shortPatch(currentPatch()))}${practice?' · Practice':''}`)+renderMyPlan()+`<div class="plan-grid"><section class="card map-card">${mapSvg(ours)}</section><div class="plan-side">${win}<section class="card"><div class="card-head"><h2>Power curve</h2><span class="tag">Estimate</span></div>${renderCurve(false)}</section></div></div>${renderSW()}${renderTimeline()}${note}<h2 class="plan-sec">Per player</h2><div class="role-grid">${cards}</div>`;
}
// Persönlicher Fahrplan: optional, Auswahl wird pro Gerät gemerkt. Bot-Lane = ADC + Support.
let myRole=null;try{const v=localStorage.getItem('riftroom.myrole');if(PLAN_ROLES.includes(v))myRole=v;}catch{}
function renderMyPlan(){
 const idx=k=>k==='BOTLANE'?[3,4]:[ROLES.indexOf(k)];
 const chips=PLAN_ROLES.map(k=>`<button data-myrole="${k}" aria-pressed="${myRole===k}">${idx(k).map(i=>portrait(state.allies[i],'av xs')).join('')}${PLAN_ROLE_NAMES[k]}</button>`).join('');
 let body='';
 if(myRole){
  const tl=roleTimeline(myRole,state.allies,state.enemies),label={go:'Your window',careful:'Careful',even:''};
  const who=idx(myRole).map(i=>esc(cname(state.allies[i]))).join(' + '),vs=tl.vs.filter(Boolean).map(id=>esc(cname(id))).join(' + ');
  body=`<section class="card tl my-plan"><div class="card-head"><div><h2>Your roadmap · ${PLAN_ROLE_NAMES[myRole]}</h2><p class="fine">${who}${vs?` vs ${vs}`:''}${tl.spikes.length?' · '+tl.spikes.map(x=>`${esc(cname(x.id))}: ${x.txt}`).join(', '):''}</p></div><button class="btn small" data-jump="rc-${myRole==='BOTLANE'?'BOTTOM':myRole}">Benchmarks</button></div><ol class="tl-list">${tl.items.map((x,i)=>`<li class="tl-${x.tone}" style="--k:${i}"><span class="tl-time">${esc(x.t)}</span><span class="tl-dot"></span><div class="tl-body"><strong>${esc(x.title)}${label[x.tone]&&(i===0||tl.items[i-1].tone!==x.tone)?` <span class="tl-tag">${label[x.tone]}</span>`:''}</strong><span>${esc(x.text)}</span></div></li>`).join('')}</ol></section>`;
 }
 return`<nav class="plan-jump my-role" aria-label="Choose your role"><span class="fine">${myRole?'Your role:':'Choose your role (optional):'}</span>${chips}</nav>${body}`;
}
function renderSW(){
 const {S,W,A}=strengthsWeaknesses(state.allies,state.enemies);
 const col=(cls,title,arr,ic)=>`<div class="sw-col ${cls}"><h3>${ic}${title}</h3>${arr.length?`<ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="fine">Nothing notable.</p>'}</div>`;
 return`<section class="card sw"><div class="card-head"><h2>Strengths and weaknesses</h2><span class="tag">from your composition</span></div><div class="sw-grid">${col('s','Strengths',S,'<span class="sw-dot"></span>')}${col('w','Weaknesses',W,'<span class="sw-dot"></span>')}${col('a','Watch out for',A,'<span class="sw-dot"></span>')}</div></section>`;
}
function renderTimeline(){
 const items=timeline(state.allies,state.enemies);
 const label={go:'Your window',careful:'Careful',even:''};
 return`<section class="card tl"><div class="card-head"><h2>What when</h2><span class="tag">Timers season 2026</span></div><ol class="tl-list">${items.map((x,i)=>`<li class="tl-${x.tone}" style="--k:${i}"><span class="tl-time">${x.t}</span><span class="tl-dot"></span><div class="tl-body"><strong>${esc(x.title)}${label[x.tone]?` <span class="tl-tag">${label[x.tone]}</span>`:''}</strong><span>${esc(x.text)}</span></div></li>`).join('')}</ol><p class="fine tl-legend"><span class="lg go"></span>you are stronger <span class="lg careful"></span>opponent is stronger</p></section>`;
}
function buildPlanPrompt(){
 const name=cname,ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue';
 const prof=id=>{const p=profileOf(id);return p?`${p.damage==='magic'?'magic':p.damage==='physical'?'physical':'mixed'}, Frontline ${p.front}, Engage ${p.engage}, Peel ${p.peel}, Scaling ${p.scaling}`:'';};
 const wrTxt=(id,role)=>{const e=metaFor(id,role);return e?`, Winrate ${(e.wins/e.games*100).toFixed(1)} %`:'';};
 const a=phaseCurve(state.allies),b=phaseCurve(state.enemies),L=[];
 L.push('You are an experienced League of Legends coach for an amateur team (Prime League / Clash). Write short notes for each of our five players for exactly this game.');
 L.push('Reply ONLY with valid JSON, without Markdown and without any text before or after, exactly in this format:');
 L.push('{"winCondition":"one sentence","roles":[{"role":"TOP","wichtig":["…","…"],"plan":["…","…"],"wann":["6:00 – …","14:00 – …"]},{"role":"JUNGLE","wichtig":[],"plan":[]},{"role":"MIDDLE","wichtig":[],"plan":[]},{"role":"BOTTOM","wichtig":[],"plan":[]},{"role":"UTILITY","wichtig":[],"plan":[]}]}');
 L.push('Rules: write in English. Keep the JSON keys exactly as shown. Per role exactly 2 points under "wichtig" (key info) and exactly 2 under "plan", each point at most 9 words, telegram style without filler. "wichtig" = what the player must know about the matchup and the enemy champions (power spikes, dangerous abilities, level advantages). "plan" = what he should actually do (waves, trades, roams, objectives, role in teamfights). For the jungle it is about pathing, gank targets and objectives. "wann" = exactly 2 moments in the format "mm:ss – task" (at most 8 words), when this player should do something specific with THIS champion (e.g. level 6 roam, first back, objective). Objective timers this season: Dragon '+OBJECTIVES.dragon+', Voidgrubs '+OBJECTIVES.grubs+' (despawn 14:45), Rift Herald '+OBJECTIVES.herald+', Baron '+OBJECTIVES.baron+'. Atakhan no longer exists. Bot and Support refer to the bot lane. Do not invent statistics. "winCondition" = at most 12 words on how we win this game.');
 L.push('',`Patch ${shortPatch(currentPatch())}. We are the ${ours} side.`);
 ROLES.forEach((r,i)=>{const x=state.allies[i],e=state.enemies[i],lt=laneTxt(x,e,r);L.push(`- ${ROLE_NAMES[r]} (${state.players[i].name}): ${name(x)} (${prof(x)}${wrTxt(x,r)}) vs ${name(e)} (${prof(e)}${wrTxt(e,r)})${lt?`. Lane matchup according to stats: ${lt}`:''}${state.matchups[e]?`. Our note on ${name(e)}: ${state.matchups[e].slice(0,300)}`:''}`);});
 L.push(`Bans: us ${state.bans.slice(0,5).filter(Boolean).map(name).join(', ')||'none'}; opponent ${state.bans.slice(5).filter(Boolean).map(name).join(', ')||'none'}.`);
 L.push(`Estimated strength (early/mid/late): us ${a.join(' / ')}, opponent ${b.join(' / ')}.`);
 const o=activeOpp();if(o?.notes?.trim())L.push('Our notes on the opponent team (for information only): '+o.notes.slice(0,1200));
 return L.join('\n');
}
function parsePlan(text){
 try{const j=JSON.parse(String(text).slice(text.indexOf('{'),text.lastIndexOf('}')+1));if(!j||!Array.isArray(j.roles))return null;
  const clean=a=>(Array.isArray(a)?a:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,2).map(x=>x.trim().slice(0,120));
  const roles={};for(const r of j.roles)if(r&&ROLES.includes(r.role))roles[r.role]={wichtig:clean(r.wichtig),plan:clean(r.plan),wann:clean(r.wann)};
  if(Object.keys(roles).length<3)return null;
  return{win:typeof j.winCondition==='string'?j.winCondition.trim().slice(0,240):'',roles};}catch{return null;}
}
async function generatePlan(key,force){
 const cur=planNotes.get(key);
 if(!force&&cur&&!cur.pending)return;
 if(cur?.ctrl)cur.ctrl.abort();
 const entry={status:'loading'};planNotes.set(key,entry);
 let sample=null;try{sample=window.claude?.use?await window.claude.use('sample'):null;}catch{}
 if(planNotes.get(key)!==entry)return;
 if(!sample){planNotes.set(key,{status:'unavailable'});if(page==='plan')render();return;}
 entry.ctrl=new AbortController();if(force&&page==='plan')render();
 try{const r=await sample(buildPlanPrompt(),{signal:entry.ctrl.signal,cache:false});if(planNotes.get(key)!==entry)return;const data=parsePlan(r.text);planNotes.set(key,data?{status:'done',data}:{status:'error'});}
 catch(e){if(planNotes.get(key)!==entry||e?.code==='cancelled')return;planNotes.set(key,{status:'error',code:e?.code});}
 if(page==='plan'&&draftKey()===key)render();
}

/* ---------- Für Discord ---------- */
function discordText(){
 const n=id=>id?cname(id):'—',o=activeOpp(),L=[];
 L.push(`**Draft${o?` vs ${o.name}`:''}** · Patch ${shortPatch(currentPatch())}${state.draftMode==='tournament'?` · ${state.side==='red'?'Red':'Blue'} side`:''}`,'');
 ROLES.forEach((r,i)=>L.push(`${ROLE_NAMES[r]}: ${n(state.allies[i])} (${state.players[i].name}) vs ${n(state.enemies[i])}`));
 L.push('',`Bans – us: ${state.bans.slice(0,5).filter(Boolean).map(n).join(', ')||'none'} | opponent: ${state.bans.slice(5).filter(Boolean).map(n).join(', ')||'none'}`);
 if(state.allies.some(Boolean)&&state.enemies.some(Boolean))L.push(`Power curve (estimate): ${curveSummary(phaseCurve(state.allies),phaseCurve(state.enemies))}`);
 const mus=state.enemies.map((id,i)=>id&&state.matchups[id]?`${ROLE_NAMES[ROLES[i]]} vs ${n(id)}: ${state.matchups[id]}`:null).filter(Boolean);
 if(mus.length)L.push('','**Matchup notes**',...mus);
 const p=planNotes.get(draftKey());
 if(p?.status==='done'){L.push('','**Game plan**');if(p.data.win)L.push(p.data.win);ROLES.forEach(r=>{const x=p.data.roles[r];if(x)L.push(`${ROLE_NAMES[r]}: ${[...x.wichtig,...x.plan].join(' · ')}`);});}
 else if(analysisText&&!analysisBusy)L.push('','**Analysis**',analysisText);
 return L.join('\n');
}
function showTextDialog(title,text,hint){
 confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">${esc(title)}</h2><p class="fine" style="margin-top:4px">${esc(hint)}</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div><textarea id="export-text" class="field code" rows="12" readonly aria-label="${esc(title)}">${esc(text)}</textarea><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Close</button><button class="btn primary" data-action="copy-export">Copy</button></div>`;
 $('#confirm-dialog').showModal();
}
function copyText(text,title){
 const fallback=()=>showTextDialog(title,text,'Copying was not possible here. Select the text or tap “Copy”.');
 try{navigator.clipboard.writeText(text).then(()=>toast('Copied. Now paste it into Discord.'),fallback);}catch{fallback();}
}

/* ---------- Übungs-Draft gegen den Computer ---------- */
function startPractice(opts){guide.markDrafted();
 if(!practice)practice={snapshot:{draftActive:state.draftActive,allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans],draftMode:state.draftMode,side:state.side,opponentId:state.opponentId,selectedRole:state.selectedRole,fearless:state.fearless}};
 clearTimeout(practice.ai);clearInterval(practice.tick);
 Object.assign(practice,{timer:opts.timer,stepKey:null,deadline:null});
 Object.assign(state,{allies:Array(5).fill(null),enemies:Array(5).fill(null),bans:Array(10).fill(null),draftMode:'tournament',side:opts.side,opponentId:opts.opponentId,selectedRole:0,fearless:opts.fearless||null});
 clearDraftView();page='draft';
 practiceCheck();render();window.scrollTo({top:0,behavior:'instant'});
}
// Wird nach jeder Änderung im Übungs-Draft aufgerufen (aus save()), vor dem Rendern.
function practiceCheck(){
 if(!practice)return;
 const t=draftTurn(state),key=t.finished?'done':t.current.i;
 if(key===practice.stepKey)return;
 practice.stepKey=key;clearTimeout(practice.ai);clearInterval(practice.tick);practice.deadline=null;
 if(t.finished){toast('Draft complete. Check out the game plan.');return;}
 const c=t.current;
 if(c.who==='them'){practice.ai=setTimeout(()=>aiMove(c),900+Math.random()*1200);return;}
 if(c.type==='pick'&&state.allies[state.selectedRole]){const next=state.allies.findIndex(x=>!x);if(next>=0)state.selectedRole=next;}
 if(practice.timer){practice.deadline=Date.now()+30000;practice.tick=setInterval(tickTimer,200);}
}
const randomFree=tk=>{const free=catalog.champions.filter(c=>!tk.has(c.id));return free[Math.floor(Math.random()*free.length)]?.id;};
function aiMove(c){
 if(!practice)return;
 const tk=taken(),aiPrev=[...state.enemies];
 if(c.type==='ban'){const id=aiBan(state,state.meta,tk)||randomFree(tk);const i=[5,6,7,8,9].find(k=>!state.bans[k]);if(i!=null)state.bans[i]=id;}
 else{const r=aiPick(state,state.meta,tk,activeOpp(),catalog);if(r)state.enemies[r.i]=r.id;else{const i=state.enemies.findIndex(x=>!x);if(i>=0)state.enemies[i]=randomFree(tk);}}
 save();render();
 if(c.type==='pick'){const i=state.enemies.findIndex((x,k)=>x&&!aiPrev[k]);if(i>=0)lockSplash(state.enemies[i],'them',i);}
}
function tickTimer(){
 if(!practice?.deadline)return;
 if(tourRunning()){practice.deadline+=200;return;} // Timer pausiert während der Einführung
 const left=practice.deadline-Date.now(),bar=$('#practice-bar'),tx=$('#practice-time');
 if(bar){bar.style.width=Math.max(0,left/300)+'%';bar.classList.toggle('low',left<=5000);}$('.cs-timer')?.classList.toggle('low',left<=10000);if(tx)tx.textContent=Math.max(0,Math.ceil(left/1000));
 if(left>0)return;
 clearInterval(practice.tick);practice.deadline=null;
 const c=draftTurn(state).current;if(!c||c.who!=='us')return;
 if($('#picker').open)$('#picker').close();
 const tk=taken();
 if(c.type==='ban'){const id=banList(15).items.map(b=>b.id).find(x=>!tk.has(x))||randomFree(tk);const i=[0,1,2,3,4].find(k=>!state.bans[k]);state.bans[i]=id;toast(`Time is up: ${cname(id)} banned automatically.`,true);}
 else{const i=state.allies[state.selectedRole]?state.allies.findIndex(x=>!x):state.selectedRole;const id=rec({...state,selectedRole:i,poolOnly:false})[0]?.id||randomFree(tk);state.allies[i]=id;toast(`Time is up: ${cname(id)} picked automatically.`,true);}
 save();render();
}
function endPractice(){
 if(!practice)return;clearTimeout(practice.ai);clearInterval(practice.tick);
 const s=practice.snapshot;practice=null;
 Object.assign(state,{draftActive:s.draftActive,allies:s.allies,enemies:s.enemies,bans:s.bans,draftMode:s.draftMode,side:s.side,opponentId:s.opponentId,selectedRole:s.selectedRole,fearless:s.fearless||null});
 lastBoard=null;page='draft';analysisText='';
 if(pendingRemote){const snap=pendingRemote;pendingRemote=null;lastSharedJson='';applyRemoteTeam(snap);}
 save();render();toast('Practice ended. Your draft is back.');
}
// Im Übungs-Draft nur erlaubte Schritte zulassen.
function practiceBlocks(type,index){
 if(!practice)return false;
 const c=draftTurn(state).current;
 if(!c){toast('The practice draft is finished.',true);return true;}
 if(type==='enemies'||(type==='bans'&&index>=5)){toast('The computer chooses for the opponent.',true);return true;}
 if(c.who!=='us'){toast('Wait a moment, it is the opponent’s turn.',true);return true;}
 if(type==='bans'&&c.type!=='ban'){toast('It is a pick now, not a ban.',true);return true;}
 if(type==='allies'&&c.type!=='pick'){toast('It is a ban now.',true);return true;}
 if(state[type][index]){toast('This slot is already filled.',true);return true;}
 return false;
}

/* ---------- Analyse (Claude) ---------- */
// Lane-Duell laut Statistik als Text, z. B. „Garen gewinnt 52,1 % gegen Darius (4.123 Spiele)“.
function laneTxt(x,e,r){const row=x&&e?getMatchups()?.roles?.[r]?.[e]?.find(z=>z[0]===x):null;if(!row||row[2]<300)return'';const a=(row[1]*row[2]+50*200)/(row[2]+200);return`${cname(x)} wins ${pct(a)} vs ${cname(e)} (${int(row[2])} games)`;}
function buildAnalysisPrompt(){
 const name=cname;
 const wrTxt=(id,role)=>{const e=metaFor(id,role);return e?` (win rate ${(e.wins/e.games*100).toFixed(1)} % in ${e.games} games)`:'';};
 const comp=composition(state.allies),L=[];
 L.push('You are an experienced League of Legends draft coach for an amateur team (Prime League / Clash). Answer in English, short and concrete, at most 170 words, without headings and without Markdown. Use three short paragraphs: 1) strengths and gaps of our composition, 2) a concrete suggestion for the next pick or ban, ideally from the champion pool of the player concerned, 3) what we must watch out for against the enemy composition. Do not invent statistics, only use the numbers given.');
 L.push('',`Patch: ${shortPatch(catalog.version)}. Stats source: ${state.meta?state.meta.source+', '+state.meta.rank+', '+state.meta.queue:'none'}.`);
 if(state.draftMode==='tournament'){const t=draftTurn(state);L.push(`Draft mode: tournament order, we are the ${state.side==='red'?'red':'blue'} side. ${t.finished?'The draft is complete.':'Next '+(t.current.who==='us'?'it is us':'it is the opponent')+' with '+(t.current.type==='ban'?'Ban':'Pick')+' '+t.current.n+'.'}`);}
 L.push('','Our team:');
 ROLES.forEach((r,i)=>{const p=state.players[i],id=state.allies[i];L.push(`- ${ROLE_NAMES[r]} (${p.name}): ${id?name(id)+wrTxt(id,r):'still open'}; Pool: ${p.pool.map(x=>name(x.id)+' '+x.comfort+'/5').join(', ')||'empty'}`);});
 L.push('','Opponent picks: '+(state.enemies.map((id,i)=>id?ROLE_NAMES[ROLES[i]]+': '+name(id)+wrTxt(id,ROLES[i]):null).filter(Boolean).join(', ')||'none yet'));
 L.push('Our bans: '+(state.bans.slice(0,5).filter(Boolean).map(name).join(', ')||'none'));
 L.push('Opponent bans: '+(state.bans.slice(5).filter(Boolean).map(name).join(', ')||'none'));
 L.push(`Composition (rough profiles): frontline ${comp.front}, Engage ${comp.engage}, Peel ${comp.peel}, Scaling ${comp.scaling}; damage physical ${comp.physical}, magic ${comp.magic}, mixed ${comp.mixed}.`);
 const lanes=ROLES.map((r,i)=>laneTxt(state.allies[i],state.enemies[i],r)).filter(Boolean);
 if(lanes.length)L.push('Lane matchups according to stats (win rate of our champion): '+lanes.join('; ')+'.');
 // Riftrooms eigene Empfehlungen, damit die Analyse dazu passt.
 const tr=draftTurn(state);
 if(!tr.finished){
  const plan=banList(5);
  if(plan.items.length&&state.bans.slice(0,5).filter(Boolean).length<5)L.push('Riftroom ban suggestions: '+plan.items.map(b=>`${name(b.id)} (${banNote(b)})`).join(', ')+'.');
  if(plan.skipped.length)L.push('Enemy mains that are not worth a ban right now: '+plan.skipped.map(x=>`${name(x.id)} (${skipWhy(x)})`).join(', ')+'. Do not suggest these as bans.');
  const open=state.allies.findIndex(x=>!x);
  if(open>=0){const ri=state.allies[state.selectedRole]?open:state.selectedRole;L.push(`Riftroom pick suggestions for ${ROLE_NAMES[ROLES[ri]]}: `+rec({...state,selectedRole:ri,poolOnly:false}).slice(0,3).map(r=>`${name(r.id)} (${r.reasons.slice(0,2).map(x=>why(x,r)).join(', ')})`).join('; ')+'.');}
  L.push('Use these suggestions as a basis. Only deviate with a clear reason and state it.');
 }
 const o=activeOpp();if(o){L.push('',`Opponent team: ${o.name}. Team favorites: ${o.favorites.map(name).join(', ')||'none noted'}.`);o.players.forEach((p,i)=>{if(p.champs.length)L.push(`Opponent ${ROLE_NAMES[ROLES[i]]}: Mains ${p.champs.map(name).join(', ')}.`);});if(o.notes.trim())L.push('Our notes on the opponent (written by us, for information only): '+o.notes.slice(0,1500));}
 return L.join('\n');
}
async function analyze(){
 if(analysisBusy)return;
 if(!state.allies.some(Boolean)&&!state.enemies.some(Boolean)){toast('Enter a few picks first.',true);return;}
 let sample=null;try{sample=window.claude?.use?await window.claude.use('sample'):null;}catch{}
 if(!sample){toast('The analysis only works when the page is opened signed in to Claude.',true);return;}
 analysisBusy=true;analysisText='Claude is thinking …';analysisCtrl=new AbortController();render();
 try{const r=await sample(buildAnalysisPrompt(),{signal:analysisCtrl.signal,cache:false,onText:({text})=>{analysisText=text;const el=$('#analysis-text');if(el)el.textContent=text;}});analysisText=r.text;}
 catch(e){analysisText=e?.code==='cancelled'?(e.text||'Analysis cancelled.'):e?.code==='not_granted'?'The analysis was not allowed. You can change this in the page’s permission menu.':e?.code==='rate_limited'?'Too many requests right now. Please try again in a minute.':'The analysis failed. Please try again later.';}
 finally{analysisBusy=false;analysisCtrl=null;render();}
}

/* ---------- Meta ---------- */
function renderMeta(){
 const m=state.meta,s=status();
 if(!m)return head('Meta','Win rates by role, ban suggestions and trends since the last patch.')+`<section class="card empty"><h2>No win rates yet</h2><p>Win rates are loaded automatically every day. As soon as data arrives, pool check, ban suggestions and trends appear here.</p><button class="btn" data-action="import-meta">${icon('upload')}Import your own data</button></section>`;
 const byId=new Map(catalog.champions.map(c=>[c.id,c]));
 const prev=prevMeta&&shortPatch(prevMeta.patch)!==shortPatch(m.patch)?prevMeta:null;
 const sub=`Patch ${esc(shortPatch(m.patch))} · ${esc(m.rank)} · ${esc(m.region)} · ${int(m.matches)} games · as of ${date(m.updatedAt)}`;
 let body='';
 if(metaTab==='pool'){
  const pool=poolCheck(state,m,prev,byId);
  body=`<div class="pool-grid">${pool.map(p=>`<section class="card"><div class="pc-head"><span class="role-label">${ROLE_NAMES[p.role]}</span><strong>${esc(p.name)}</strong></div><ul class="pc-list">${p.items.map(x=>`<li>${portrait(x.id,'av sm')}<span class="pc-name">${esc(cname(x.id))}</span>${x.flag==='nodata'?'<span class="tag warn span2">rarely played</span>':`<span class="num">${pct(x.wr)}</span>${deltaTag(x.delta)}`}</li>`).join('')||'<li class="fine">No pool entered.</li>'}</ul>${p.needsAlternatives&&p.alternatives.length?`<p class="pc-alt">Strong in this role: ${p.alternatives.map(a=>`${esc(cname(a.id))} <span class="num">${pct(a.wr)}</span>`).join(', ')}</p>`:''}</section>`).join('')}</div><p class="fine">${prev?`On the right: change since patch ${esc(shortPatch(prev.patch))} in percentage points. Marked from −1.0.`:'Data from the previous patch is missing for the change.'}</p>`;
 }else if(metaTab==='bans'){
  const plan=banList(8,false);
  const row=b=>{const e=b.role?metaFor(b.id,b.role):null;return`<tr><td><div class="tc">${portrait(b.id,'av sm')}<span class="ban-cell">${esc(cname(b.id))}<small class="ban-why">${esc(banNote(b))}</small></span></div></td><td>${b.role?ROLE_NAMES[b.role]:'—'}</td><td class="r">${e?pct(e.wins/e.games*100):'—'}</td><td class="r">${e?.pickRate==null?'—':pct(e.pickRate)}</td><td class="r">${e?.banRate==null?'—':pct(e.banRate)}</td></tr>`;};
  body=`<section class="card flush"><div class="table-wrap"><table><thead><tr><th>Champion</th><th>Role</th><th class="r">Win rate</th><th class="r">Pick rate</th><th class="r">Ban rate</th></tr></thead><tbody>${plan.items.map(row).join('')||'<tr><td colspan="5">Not enough data.</td></tr>'}</tbody></table></div></section>${skipHtml(plan.skipped)}<p class="fine">Sorted by how much win chance a champion costs you and how likely it is to be played. Enemy mains only count if they are strong right now or the player demonstrably plays them well (Riot data). Champions from your pool are excluded.</p>`;
 }else if(metaTab==='trends'){
  const ch=biggestChanges(m,prev,6);
  const list=(rows,empty)=>rows.length?`<ul class="pc-list">${rows.map(r=>`<li>${portrait(r.id,'av sm')}<span class="pc-name">${esc(cname(r.id))} <span class="muted">${ROLE_NAMES[r.role]}</span></span><span class="num">${pct(r.wr)}</span>${deltaTag(r.delta)}</li>`).join('')}</ul>`:`<p class="fine">${empty}</p>`;
  body=prev?`<div class="two"><section class="card"><h3 class="card-title">Risers</h3>${list(ch.risers,'No data.')}</section><section class="card"><h3 class="card-title">Fallers</h3>${list(ch.fallers,'No fallers.')}</section></div><p class="fine">Since patch ${esc(shortPatch(prev.patch))}, only champions with at least 5,000 games in both patches.</p>`:'<section class="card empty"><p>Trends need data from the previous patch.</p></section>';
 }else{
  body=`<section class="card flush"><div class="filters"><div class="search">${icon('search')}<input class="field" id="meta-search" placeholder="Search champion" value="${esc(metaSearch)}" aria-label="Search champion"></div><select class="field" id="meta-role" aria-label="Filter by role"><option value="ALL">All roles</option>${ROLES.map(r=>`<option value="${r}" ${metaRole===r?'selected':''}>${ROLE_NAMES[r]}</option>`).join('')}</select><select class="field" id="meta-sort" aria-label="Sort"><option value="adjusted" ${metaSort==='adjusted'?'selected':''}>Smoothed win rate</option><option value="wins" ${metaSort==='wins'?'selected':''}>Win rate</option><option value="games" ${metaSort==='games'?'selected':''}>Games</option></select></div><div id="meta-table">${metaTable()}</div></section><p class="fine">Smoothed = (wins + 100) / (games + 200). This pulls small samples towards 50%.</p>`;
 }
 const note=!s.ok?`<div class="banner warn">These win rates are currently not used in recommendations: ${esc(s.label)}.</div>`:s.fallback?`<div class="banner">Patch ${esc(shortPatch(currentPatch()))} is new and has too few games yet. Until there is enough data, we show and use the win rates from patch ${esc(shortPatch(m.patch))}.</div>`:'';
 return head('Meta',sub)+note+`<div class="subtabs" role="tablist">${META_TABS.map(([k,l])=>`<button role="tab" data-meta-tab="${k}" aria-selected="${metaTab===k}">${l}</button>`).join('')}</div>`+body;
}
function metaTable(){
 if(!state.meta)return'';
 const entries=state.meta.entries.filter(e=>(metaRole==='ALL'||e.role===metaRole)&&(!metaSearch.trim()||(champ(e.champion)&&champMatch(champ(e.champion),metaSearch)>0)));
 entries.sort((a,b)=>metaSort==='games'?b.games-a.games:metaSort==='wins'?b.wins/b.games-a.wins/a.games:(b.wins+100)/(b.games+200)-(a.wins+100)/(a.games+200));
 return`<div class="table-wrap"><table><thead><tr><th>Champion</th><th>Role</th><th class="r">Win rate</th><th class="r">Smoothed</th><th class="r">Games</th><th class="r">Pick rate</th><th class="r">Ban rate</th></tr></thead><tbody>${entries.map(e=>`<tr><td><div class="tc">${portrait(e.champion,'av sm')}${esc(cname(e.champion))}</div></td><td>${ROLE_NAMES[e.role]}</td><td class="r ${e.wins/e.games>=.5?'pos':''}">${pct(e.wins/e.games*100)}</td><td class="r">${pct((e.wins+100)/(e.games+200)*100)}</td><td class="r">${int(e.games)}</td><td class="r">${e.pickRate==null?'—':pct(e.pickRate)}</td><td class="r">${e.banRate==null?'—':pct(e.banRate)}</td></tr>`).join('')||'<tr><td colspan="7">No matching champions found.</td></tr>'}</tbody></table></div>`;
}

/* ---------- Gegner ---------- */
function renderOpponents(){
 const sel=selOpp();
 const list=state.opponents.map(o=>`<button class="opp-item ${sel&&o.id===sel.id?'on':''}" data-select-opponent="${esc(o.id)}"><span>${esc(o.name)}</span>${o.id===state.opponentId?'<span class="tag good">in draft</span>':''}</button>`).join('');
 const left=`<section class="card"><h2 class="card-title">Opponent teams</h2><div class="row"><input class="field grow" id="new-opponent" maxlength="40" placeholder="Team name" aria-label="Opponent team name"><button class="btn" data-action="add-opponent">${icon('plus')}Add</button></div>${list?`<div class="opp-list">${list}</div>`:'<p class="fine" style="margin-top:12px">No opponent added yet.</p>'}</section>`;
 const right=!sel?`<section class="card empty"><h2>No opponent yet</h2><p>Add a team on the left, for example your next Prime League opponent.</p></section>`:`<section class="card opp-detail">
  <div class="row wrap"><input class="field grow name-field" id="opp-name" maxlength="40" value="${esc(sel.name)}" aria-label="Team name"><button class="btn ${sel.id===state.opponentId?'':'primary'}" data-action="toggle-active-opponent">${sel.id===state.opponentId?'Remove from draft':'Use in draft'}</button><button class="icon-btn" data-action="delete-opponent" aria-label="Delete opponent team" title="Delete">${icon('trash')}</button></div>
  <div><div class="label-row"><h3>Players</h3><div class="row"><select class="field" id="opp-region" aria-label="Region for op.gg">${OPP_REGIONS.map(r=>`<option value="${r}" ${sel.region===r?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select>${opggMulti(sel)?`<a class="btn small primary" href="${esc(opggMulti(sel))}" target="_blank" rel="noopener noreferrer">All on op.gg ↗</a>`:''}${STANDALONE&&sel.players.some(p=>validRiotId(p.riotId))?`<button class="btn small" data-riot-all="opp">${icon('refresh')}Load all</button>`:''}</div></div>
  <div class="opp-players">${sel.players.map((p,i)=>`<div class="opp-player"><span class="role-label">${ROLE_NAMES[ROLES[i]]}</span><input class="field" data-opp-riot="${i}" value="${esc(p.riotId)}" placeholder="Name#EUW" maxlength="40" aria-label="Riot ID ${ROLE_NAMES[ROLES[i]]}" autocomplete="off" spellcheck="false">${p.riotId.includes('#')?`<a class="icon-btn ext" href="${esc(opggProfile(sel,p.riotId))}" target="_blank" rel="noopener noreferrer" aria-label="Profile of ${esc(p.riotId)} on op.gg" title="Profile on op.gg">↗</a>`:'<span></span>'}${STANDALONE?(validRiotId(p.riotId)?`<button class="icon-btn" data-riot-load="opp|${i}" aria-label="Load games of ${esc(p.riotId)}" title="Load games">${icon('refresh')}</button>`:'<span></span>'):''}<div class="opp-mains">${p.champs.map(id=>`<span class="fav">${portrait(id,'')}${esc(cname(id))}<button class="icon-btn" data-remove-main="${i}|${id}" aria-label="${esc(cname(id))} entfernen">${icon('close')}</button></span>`).join('')}${p.champs.length<5?`<button class="btn ghost small" data-picker="opp" data-index="${i}">${icon('plus')}Main</button>`:''}</div>${riotBox('opp',i)}</div>`).join('')}</div>
  <p class="fine" style="margin-top:10px">Enter the Riot ID with tag, e.g. Name#EUW. The link opens the profiles on op.gg with recent games. Then add up to five mains per player: they appear first in the ban suggestions.</p></div>
  <div><div class="label-row"><h3>Team favorites</h3><span class="fine">${sel.favorites.length} / 15</span></div><div class="favs">${sel.favorites.map(id=>`<span class="fav">${portrait(id,'')}${esc(cname(id))}<button class="icon-btn" data-remove-fav="${id}" aria-label="${esc(cname(id))} entfernen">${icon('close')}</button></span>`).join('')||'<span class="fine">None added yet.</span>'}</div>
  <div class="row" style="margin-top:10px"><input class="field grow" id="fav-input" list="champ-list" placeholder="Type a champion, e.g. Ahri" aria-label="Add favorite champion"><button class="btn" data-action="add-fav">${icon('plus')}Add</button></div><datalist id="champ-list">${catalog.champions.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}</datalist></div>
  <div><label class="label-row" for="opp-notes"><h3>Notes</h3><span class="fine">saved automatically</span></label><textarea class="field" id="opp-notes" rows="8" maxlength="4000" placeholder="Play style, who carries, how they draft, what worked last time …">${esc(sel.notes)}</textarea></div>
 </section>`;
 const mus=Object.entries(state.matchups).sort((a,b)=>cname(a[0]).localeCompare(cname(b[0]),'de'));
 const muCard=`<section class="card"><div class="card-head" style="margin-bottom:8px"><h2>Matchup notes</h2><span class="tag">${mus.length}</span></div><p class="fine">What you need to know against individual champions. Shows up in the draft and the game plan as soon as the opponent picks it.</p><div class="mu-all">${mus.map(([id,t])=>`<button class="mu has" data-mu-edit="${id}"><img class="mini" src="${SQUARE[id]||'icon.svg'}" alt=""><span class="mu-text"><b>${esc(cname(id))}</b>${esc(t)}</span></button>`).join('')}</div><button class="btn ghost small" data-picker="mu" data-index="0" style="margin-top:8px;margin-left:-12px">${icon('plus')}Champion</button></section>`;
 return head('Opponent','Players, mains and notes on your opponents. A team active in the draft feeds into ban suggestions and analysis.')+`<div class="opp-grid"><div class="opp-left">${left}${muCard}</div>${right}</div>`;
}


/* ---------- Riot-Abfrage (nur GitHub-Version) ---------- */
// Riot-ID eintragen, „Laden“ drücken: Rang, Mastery und die meistgespielten Champions der letzten 20 Spiele.
// Der Riot-Key bleibt in der Supabase-Funktion, hier kommt nur das Ergebnis an.
const TIER={IRON:'Iron',BRONZE:'Bronze',SILVER:'Silver',GOLD:'Gold',PLATINUM:'Platinum',EMERALD:'Emerald',DIAMOND:'Diamond',MASTER:'Master',GRANDMASTER:'Grandmaster',CHALLENGER:'Challenger'};
const RIOT_ERR={bad:'Please enter it as Name#TAG, e.g. Faker#KR1.',not_found:'This Riot ID does not exist in this region. Check name, tag and region.',key:'The Riot key has expired or is missing. Enter a new one in Supabase.',busy:'Riot is busy right now. Try again in a moment.',net:'No connection. Check your internet.',upstream:'Riot is not responding right now. Try again in a moment.',origin:'The Riot lookup only works on the Riftroom site.'};
const agoTxt=t=>{const m=Math.round((Date.now()-t)/60000);return m<1?'just now':m<60?` ${m} min ago`:` ${Math.round(m/60)} h ago`;};
const kdaTxt=c=>((c.k+c.a)/Math.max(1,c.d)).toFixed(1);
function rankHtml(r){
 const s=r?.solo||r?.flex;if(!s)return'<span class="riot-rank none">Unranked</span>';
 const apex=['MASTER','GRANDMASTER','CHALLENGER'].includes(s.tier),g=s.w+s.l;
 return`<span class="riot-rank t-${esc(String(s.tier).toLowerCase())}">${esc(TIER[s.tier]||s.tier)}${apex?'':' '+esc(s.rank)} · ${s.lp} LP${r.solo?'':' · Flex'}</span>${g?`<span class="fine">${pct(s.w/g*100)} wins in ${g} games</span>`:''}`;
}
// Wo wird gerade angezeigt? scope 'team' oder 'opp', i = Rolle.
function riotTarget(scope,i){
 if(scope==='team'){const p=state.players[i];return p?{region:state.riotRegion||'euw',id:p.riotId||'',role:ROLES[i],have:p.pool.map(v=>v.id)}:null;}
 const o=selOpp(),p=o?.players[i];return p?{region:o.region||'euw',id:p.riotId||'',role:ROLES[i],have:p.champs}:null;
}
function riotInner(scope,i){
 const t=riotTarget(scope,i);if(!t||!t.id)return'';
 const st=riotState(t.region,t.id);if(!st)return'';
 if(st.status==='wait')return`<p class="riot-status"><span class="spinner small"></span>Riot limit reached. Next try in <b data-riot-count="${st.retryAt}">${Math.max(1,Math.ceil((st.retryAt-Date.now())/1000))}</b> s.</p>`;
 if(!st.data)return st.status==='loading'?'<p class="riot-status"><span class="spinner small"></span>Loading recent games …</p>':`<p class="riot-err">${RIOT_ERR[st.err]||RIOT_ERR.upstream}</p>`;
 const d=st.data,s=riotSummary(d,t.role,catalog),team=scope==='team';
 const btn=c=>team?(t.have.includes(c.id)?'<span class="bis-in" title="Already in the pool">✓</span>':`<button class="icon-btn riot-add" data-riot-add="${i}|${c.id}|${c.n}" aria-label="${esc(cname(c.id))} to pool">${icon('plus')}</button>`)
  :`<button class="icon-btn riot-add ${t.have.includes(c.id)?'on':''}" data-riot-main="${i}|${c.id}" aria-pressed="${t.have.includes(c.id)}" aria-label="${esc(cname(c.id))} as main">${t.have.includes(c.id)?'✓':icon('plus')}</button>`;
 const row=c=>`<li>${portrait(c.id,'av sm')}<span class="riot-cname"><b>${esc(cname(c.id))}</b><small>${c.n} ${c.n===1?'game':'games'} · ${Math.round(c.w/c.n*100)}% · KDA ${kdaTxt(c)}</small></span>${btn(c)}</li>`;
 const main=s.mainRole?`mostly ${ROLE_NAMES[s.mainRole]||s.mainRole} (${s.roles[0][1]})`:'';
 const status=st.status==='loading'?'<span class="spinner small"></span>':st.status==='error'?`<span class="riot-err">${RIOT_ERR[st.err]||''}</span>`:'';
 const headLine=`<div class="riot-head">${rankHtml(d.rank)}<button class="icon-btn" data-riot-load="${scope}|${i}" aria-label="Reload" title="Reload">${icon('refresh')}</button>${status}</div><p class="fine riot-sub">${d.games?`${d.games} ${d.onlyRanked?'ranked games':'games'}${main?' · '+main:''} · ${agoTxt(st.t)}`:'No recent games on Summoner’s Rift.'}</p>`;
 const warn=d.games&&!s.roleGames?`<p class="riot-note">No recent games as ${ROLE_NAMES[t.role]}.</p>`:'';
 const list=s.inRole.length?`<ul class="riot-list">${s.inRole.slice(0,team?5:4).map(row).join('')}</ul>`:'';
 const other=s.other.length?`<div class="riot-chips"><span class="fine">Other roles</span>${s.other.slice(0,4).map(c=>`<span class="riot-chip" title="${c.n} ${c.n===1?'game':'games'} · ${pct(c.w/c.n*100)}">${portrait(c.id,'av xs')}${esc(cname(c.id))} <small>${c.n}</small></span>`).join('')}</div>`:'';
 const mastery=s.mastery.length?`<div class="riot-chips"><span class="fine">Highest mastery</span>${s.mastery.slice(0,5).map(m=>`<span class="riot-chip" title="Mastery level ${m.lvl} · ${int(m.pts)} points">${portrait(m.id,'av xs')}${esc(cname(m.id))}</span>`).join('')}</div>`:'';
 const take=s.inRole.some(c=>!t.have.includes(c.id))?`<button class="btn small" data-riot-take="${scope}|${i}">${icon('plus')}${team?'Add top 3 to pool':'Top 3 as mains'}</button>`:'';
 return headLine+warn+list+other+mastery+take;
}
const riotBox=(scope,i)=>STANDALONE?`<div class="riot-res" data-riot-res="${scope}|${i}">${riotInner(scope,i)}</div>`:'';
let riotTick=null;
function riotRepaint(){
 document.querySelectorAll('[data-riot-res]').forEach(el=>{const [scope,i]=el.dataset.riotRes.split('|');el.innerHTML=riotInner(scope,Number(i));});
 if(document.querySelector('[data-riot-count]')&&!riotTick)riotTick=setInterval(()=>{const els=document.querySelectorAll('[data-riot-count]');if(!els.length){clearInterval(riotTick);riotTick=null;return;}els.forEach(e=>e.textContent=Math.max(1,Math.ceil((Number(e.dataset.riotCount)-Date.now())/1000)));},1000);
}
function riotStart(scope,i,force){const t=riotTarget(scope,i);if(!t?.id)return;riotLoad(t.region,t.id,force);}
function riotTakeTop(scope,i){
 const t=riotTarget(scope,i),st=t&&riotState(t.region,t.id);if(!st?.data)return;
 const s=riotSummary(st.data,t.role,catalog),pick=s.inRole.filter(c=>!t.have.includes(c.id)).slice(0,3);
 if(scope==='team'){const p=state.players[i];for(const c of pick)if(p.pool.length<100)p.pool.push({id:c.id,comfort:comfortFromGames(c.n)});toast(`${pick.length} Champion${pick.length===1?'':'s'} added to the pool of ${p.name}.`);}
 else{const p=selOpp().players[i];for(const c of pick)if(p.champs.length<5)p.champs.push(c.id);toast('Mains added. They now come first in the ban suggestions.');}
 save();render();
}

/* ---------- Team ---------- */
// Hinweise zur Pool-Tiefe: zu wenige Champions, kein sicherer Pick, Champion bei mehreren Spielern.
function poolWarnings(){
 const owners=new Map();state.players.forEach((p,i)=>p.pool.forEach(v=>owners.set(v.id,[...(owners.get(v.id)||[]),i])));
 return state.players.map((p,i)=>{const w=[];
  if(p.pool.length<3)w.push(p.pool.length?`Only ${p.pool.length} Champion${p.pool.length>1?'s':''} in the pool. Two bans are enough to take ${p.name} off the pool.`:'No champion in the pool yet.');
  if(p.pool.length&&p.pool.every(v=>v.comfort<3))w.push('No safe pick: all champions have comfort 1 or 2.');
  const shared=p.pool.filter(v=>owners.get(v.id).length>1).map(v=>`${cname(v.id)} (auch ${owners.get(v.id).filter(j=>j!==i).map(j=>ROLE_NAMES[ROLES[j]]).join(', ')})`);
  if(shared.length)w.push(`Twice in the team: ${shared.join(', ')}. Only one of them can play it in the draft.`);
  return w;});
}
// Best in Slot: optional ausklappbar. Pro = Worlds-Picks, Solo = Master+ Winrates. Stern = in beiden Listen.
let bisOpen=false,bisTab='pro';
try{const u=JSON.parse(localStorage.getItem('riftroom.bis')||'{}');bisOpen=!!u.open;if(u.tab==='solo')bisTab='solo';}catch{}
const saveBis=()=>{try{localStorage.setItem('riftroom.bis',JSON.stringify({open:bisOpen,tab:bisTab}));}catch{}};
function renderBis(){
 const src=BIS[bisTab],other=BIS[bisTab==='pro'?'solo':'pro'];
 const sub=bisTab==='pro'?`${src.games} games · patch ${src.patch} · ${src.note}`:`Global · patch ${src.patch} · smoothed win rate, only picks from 2% pick rate`;
 const cols=ROLES.map((r,i)=>{
  const both=new Set(other.roles[r].map(x=>x[0])),pool=new Set(state.players[i].pool.map(v=>v.id));
  const rows=src.roles[r].filter(x=>champ(x[0])).map(x=>{const id=x[0],inPool=pool.has(id);
   const stat=bisTab==='pro'?`${x[1]} Picks${x[2]?`<span class="bis-sec"> · ${x[2]} Bans</span>`:''}`:`${pct(x[1])} WR<span class="bis-sec"> · ${pct(x[2])} Pick</span>`;
   return`<li>${portrait(id,'av sm')}<span class="bis-name"><b>${esc(cname(id))}${both.has(id)?'<i class="bis-star" title="Also near the top of the other list">★</i>':''}</b><small>${stat}</small></span>${inPool?`<span class="bis-in" title="Already in the pool">✓</span>`:`<button class="icon-btn bis-add" data-bis-add="${id}|${i}" aria-label="${esc(cname(id))}: add to the pool of ${esc(state.players[i].name)}" title="Add to pool">${icon('plus')}</button>`}</li>`;}).join('');
  return`<div class="bis-col"><span class="role-label">${ROLE_NAMES[r]}</span><ol>${rows}</ol></div>`;}).join('');
 return`<details class="card bis" id="bis" ${bisOpen?'open':''}><summary><span class="bis-title"><span class="bis-badge">BiS</span><span><strong>Best in Slot</strong><span class="fine">What pros at Worlds and Master+ players play right now</span></span></span>${icon('chevrondown')}</summary>
 <div class="bis-body"><div class="bis-top"><div class="seg" role="group" aria-label="Data source"><button data-bis-tab="pro" aria-pressed="${bisTab==='pro'}">Pro · Worlds</button><button data-bis-tab="solo" aria-pressed="${bisTab==='solo'}">Solo Queue · Master+</button></div><span class="fine">${sub}</span></div>
 <div class="bis-grid">${cols}</div><p class="fine bis-foot"><span class="bis-star">★</span> ranks high in both lists. Tap + to add the champion to the pool of that role’s player. As of ${new Date(src.asOf).toLocaleDateString('en-US')}, source: ${bisTab==='pro'?'gol.gg':'Lolalytics'}.</p></div></details>`;
}
function renderTeam(){
 const warns=poolWarnings(),st=status(),tips=state.players.map((_,i)=>learnTip(state,i,st.ok?state.meta:null));
 const cards=state.players.map((p,i)=>`<section class="card player"><span class="role-label">${ROLE_NAMES[p.role]}</span><input class="field" data-player-name="${i}" maxlength="40" value="${esc(p.name)}" aria-label="Player name ${ROLE_NAMES[p.role]}">${STANDALONE?`<div class="riot-row"><input class="field" data-player-riot="${i}" value="${esc(p.riotId||'')}" placeholder="Riot ID: Name#EUW" maxlength="40" aria-label="Riot ID ${ROLE_NAMES[p.role]}" autocomplete="off" spellcheck="false"><button class="btn small" data-riot-load="team|${i}">Load</button></div>${riotBox('team',i)}`:''}${warns[i].length?`<ul class="warn-list">${warns[i].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<ul class="pool">${p.pool.map(v=>`<li class="pool-item">${portrait(v.id,'av sm')}<span class="pool-name">${esc(cname(v.id))}</span><button class="icon-btn" data-remove-pool="${v.id}" data-index="${i}" aria-label="${esc(cname(v.id))}: remove from pool">${icon('close')}</button><div class="comfort" role="group" aria-label="Comfort on ${esc(cname(v.id))}">${[1,2,3,4,5].map(n=>`<button class="${v.comfort===n?'on':''}" data-comfort="${n}" data-champion="${v.id}" data-index="${i}" aria-label="Comfort ${n} of 5" aria-pressed="${v.comfort===n}">${n}</button>`).join('')}</div></li>`).join('')}</ul><button class="btn ghost small add" data-picker="pool" data-index="${i}">${icon('plus')}Champion</button>${tips[i]?`<div class="learn"><span class="role-label">Learning tip</span><div class="learn-row">${portrait(tips[i].id,'av sm')}<span><b>${esc(cname(tips[i].id))}</b> <span class="num muted">${pct(tips[i].wr)}</span><br><span class="fine">${esc(tips[i].reason)}.</span></span></div></div>`:''}</section>`).join('');
 const nameField=`<label class="inline-label" for="team-name">Team name</label><input id="team-name" class="field" value="${esc(state.teamName)}" maxlength="50">${STANDALONE?`<select class="field" id="team-region" aria-label="Region of the Riot IDs">${OPP_REGIONS.map(r=>`<option value="${r}" ${state.riotRegion===r?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select>${state.players.some(p=>validRiotId(p.riotId))?`<button class="btn small" data-riot-all="team">${icon('refresh')}Load all</button>`:''}`:''}`;
 const example=isExampleTeam()?'<div class="banner">Names and pools are still examples. Add your players and replace the pools with your own champions.</div>':'';
 return head('Team','Champion pools and your comfort on every pick. Both feed directly into the recommendations.',nameField)+example+renderBis()+`<div class="team-grid">${cards}</div><p class="fine">Comfort: 1 = new in pool, 3 = familiar, 5 = comfort pick.</p>`;
}

/* ---------- Spiele (eigene Historie) ---------- */
function renderGames(){
 const h=[...state.history].reverse();
 const sub='Your own results. More meaningful than solo queue win rates once a few games add up.';
 if(!h.length)return head('Results',sub)+`<section class="card empty"><h2>No games yet</h2><p>After a game, tap “Log game” in the draft and choose win or loss. Your own stats build up here: per player and champion, and against which opponents.</p><button class="btn primary" data-page="draft">To the draft</button></section>`;
 const w=h.filter(g=>g.result==='win').length,l=h.length-w;
 const rate=(w,l)=>w+l?pct(w/(w+l)*100):'—';
 const last=h.slice(0,10).reverse();
 const summary=`<section class="card games-sum"><div><div class="big-rec num">${w}–${l}</div><div class="fine">${rate(w,l)} wins in ${h.length} game${h.length>1?'s':''}</div></div><div><div class="fine" style="margin-bottom:6px">Last ${last.length}</div><div class="form-pips">${last.map(g=>`<i class="${g.result}" title="${date(g.date)} · ${g.result==='win'?'Win':'Loss'}${g.opponentName?' vs '+esc(g.opponentName):''}"></i>`).join('')}</div></div></section>`;
 const players=state.players.map((p,i)=>{const m=new Map();for(const g of h){const id=g.allies[i];if(!id)continue;const r=m.get(id)||{w:0,l:0};g.result==='win'?r.w++:r.l++;m.set(id,r);}
  const rows=[...m].sort((a,b)=>(b[1].w+b[1].l)-(a[1].w+a[1].l)||b[1].w-a[1].w).slice(0,6);
  return`<section class="card"><div class="pc-head"><span class="role-label">${ROLE_NAMES[ROLES[i]]}</span><strong>${esc(p.name)}</strong></div>${rows.length?`<ul class="pc-list">${rows.map(([id,r])=>`<li>${portrait(id,'av sm')}<span class="pc-name">${esc(cname(id))}</span><span class="num">${recTxt(r)}</span><span class="num r ${r.w>r.l?'pos':''}">${rate(r.w,r.l)}</span></li>`).join('')}</ul>`:'<p class="fine">No picks in this position yet.</p>'}</section>`;}).join('');
 const opp=new Map();for(const g of h){const k=g.opponentName||'';if(!k)continue;const r=opp.get(k)||{w:0,l:0};g.result==='win'?r.w++:r.l++;opp.set(k,r);}
 const oppHtml=opp.size?`<section class="card"><h3 class="card-title">Against</h3><ul class="pc-list opp-rec">${[...opp].sort((a,b)=>(b[1].w+b[1].l)-(a[1].w+a[1].l)).map(([n,r])=>`<li><span class="pc-name">${esc(n)}</span><span class="num">${recTxt(r)}</span><span class="num r ${r.w>r.l?'pos':''}">${rate(r.w,r.l)}</span></li>`).join('')}</ul></section>`:'';
 const icons=ids=>`<span class="mini-row">${ids.map(id=>id?`<img class="mini" src="${SQUARE[id]||'icon.svg'}" alt="${esc(cname(id))}" title="${esc(cname(id))}">`:'<span class="mini empty"></span>').join('')}</span>`;
 const list=`<section class="card flush"><ul class="game-list">${h.map(g=>`<li class="game"><div class="game-meta"><span class="tag ${g.result==='win'?'good':'warn'}">${g.result==='win'?'Win':'Loss'}</span><span class="fine">${date(g.date)}${g.side?` · ${g.side==='red'?'Red':'Blue'}`:''}</span></div><div class="game-teams">${icons(g.allies)}<span class="fine">vs ${g.opponentName?esc(g.opponentName):'unknown'}</span>${icons(g.enemies)}</div>${g.note?`<p class="fine game-note">${esc(g.note)}</p>`:''}<button class="icon-btn game-x" data-game-delete="${esc(g.id)}" aria-label="Delete game from ${date(g.date)}" title="Delete">${icon('trash')}</button></li>`).join('')}</ul></section>`;
 return head('Results',sub)+summary+`<div class="pool-grid">${players}${oppHtml}</div><h2>All games</h2>`+list;
}
function showLogGame(){
 if(![...state.allies,...state.enemies].some(Boolean)){toast('Enter the picks first.',true);return;}
 confirmAction=null;logResult=null;
 const opp=activeOpp();
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">Log game</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <div class="log-form">
  <div class="seg wide" role="group" aria-label="Result"><button data-log-result="win" aria-pressed="false">Win</button><button data-log-result="loss" aria-pressed="false">Loss</button></div>
  <div><label class="field-label" for="log-opp">Opponent</label><input class="field" id="log-opp" maxlength="40" value="${esc(opp?.name||'')}" placeholder="Name des Gegnerteams" list="log-opp-list" autocomplete="off"><datalist id="log-opp-list">${state.opponents.map(o=>`<option value="${esc(o.name)}"></option>`).join('')}</datalist></div>
  <div><label class="field-label" for="log-note">Note (optional)</label><input class="field" id="log-note" maxlength="300" placeholder="What worked, what didn’t?" autocomplete="off"></div>
  <label class="toggle"><input type="checkbox" id="log-clear" checked>Clear draft afterwards</label>
 </div>
 <div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Cancel</button><button class="btn primary" data-action="save-game" id="log-save" disabled>Save</button></div>`;
 $('#confirm-dialog').showModal();
}
function saveGame(){
 if(!logResult)return;
 const name=($('#log-opp')?.value||'').trim().slice(0,40),o=state.opponents.find(x=>x.name.toLowerCase()===name.toLowerCase());
 state.history.push({id:Date.now().toString(36),date:new Date().toISOString(),result:logResult,side:state.draftMode==='tournament'?state.side:null,opponentId:o?.id||'',opponentName:o?.name||name,note:($('#log-note')?.value||'').trim().slice(0,300),allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]});
 if(state.history.length>200)state.history=state.history.slice(-200);
 if($('#log-clear')?.checked){state.draftActive=false;undoStack=[];state.allies=Array(5).fill(null);state.enemies=Array(5).fill(null);state.bans=Array(10).fill(null);}
 const r=logResult;logResult=null;save();$('#confirm-dialog').close();render();toast(`${r==='win'?'Win':'Loss'} logged. You can see it under “Results”.`);
}

/* ---------- Daten ---------- */
function renderSettings(){
 const m=state.meta,s=status();
 const steps=[['Champion pool','Weight 35. Your comfort (1–5) sets the value. Champions outside the pool start lower.'],['Team composition','Weight 40. Missing frontline, missing engage, damage balance and protection for carries.'],['Opponent profile','Weight 15 once opponent picks are known. Peel against engage, scaling against frontline. No measured lane counters.'],['Win rates','Weight 25, only with matching current data. The win rate is smoothed towards 50% with 200 virtual games.']];
 const sample=JSON.stringify({schemaVersion:1,source:'Name of your data source',patch:shortPatch(currentPatch()),updatedAt:'ISO 8601 timestamp',region:'EUW',rank:'Emerald+',queue:'Ranked Solo',matches:123456,entries:[{champion:'Ahri',role:'MIDDLE',games:4000,wins:2050,pickRate:8.1,banRate:3.2}]},null,2);
 return head('Data','Where the numbers come from and how the recommendation is calculated.')+`<div class="settings-grid">
 <section class="card"><h2 class="card-title">Data status</h2><dl class="kv">
  <div><dt>Champion catalog</dt><dd>Riot Data Dragon ${esc(catalog.version)} · ${catalog.champions.length} champions</dd></div>
  <div><dt>Win rates</dt><dd>${m?`${esc(m.source)} · Patch ${esc(shortPatch(m.patch))} · ${date(m.updatedAt)}`:'No data yet'} <span class="tag ${s.ok?'good':'warn'}">${m?esc(s.label):'missing'}</span></dd></div>
  <div><dt>Comparison patch</dt><dd>${prevMeta?'Patch '+esc(shortPatch(prevMeta.patch)):'not available'}</dd></div>
 </dl><p class="fine" style="margin-top:14px">Win rates are updated automatically every day.</p></section>
 <section class="card"><h2 class="card-title">Target patch</h2><form id="settings-form"><div class="row"><input class="field grow" id="target-patch" value="${esc(state.targetPatch)}" placeholder="Automatic: ${esc(shortPatch(catalog.version))}" maxlength="12" aria-label="Target patch"><button class="btn" type="submit">Save</button></div><p class="fine" style="margin-top:8px">Only needed if your tournament is played on a different patch. Win rates are only used if the patch matches and they are at most 14 days old.</p><div id="settings-error" class="err" role="alert"></div></form></section>
 <section class="card"><h2 class="card-title">Backup</h2><p class="fine">${STANDALONE?'Team, pools, drafts and opponents stay in this browser. With “Show backup” you can copy them and pass them on to your team.':'When signed in to Claude, team, pools, drafts and opponents are automatically shared with everyone who opens this page. Without signing in they stay in this browser.'}</p><div class="row wrap" style="margin-top:14px"><button class="btn" data-action="export">${icon('download')}Show backup</button><button class="btn" data-action="import-team">${icon('upload')}Import backup</button></div></section>${STANDALONE?'<section class="card"><h2 class="card-title">Install as an app</h2><p class="fine">On PC and Android an “App” button appears at the top as soon as the browser offers installation. On iPhone, tap “Share” in Safari and then “Add to Home Screen”. Updates arrive automatically after that.</p></section>':''}
 <section class="card"><h2 class="card-title">Your own win rates</h2><p class="fine">Instead of the automatic data you can load your own JSON file. It only applies in this browser.</p><div class="row wrap" style="margin-top:14px"><button class="btn" data-action="import-meta">${icon('upload')}Import file</button>${m?'<button class="btn ghost" data-action="clear-meta">Remove win rates</button>':''}</div><details class="fold inner"><summary>File format ${icon('chevrondown')}</summary><pre class="code">${esc(sample)}</pre><p class="fine">Champion IDs as in Data Dragon, roles: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY. The numbers in the example are placeholders only.</p></details></section>
 <section class="card"><h2 class="card-title">How the recommendation works</h2><ol class="steps-list">${steps.map(([t,d])=>`<li><strong>${t}</strong><br><span class="fine">${d}</span></li>`).join('')}</ol><p class="fine" style="margin-top:12px">If a factor is missing, it is left out and the remaining weights are redistributed. Roles and archetypes are maintained by hand.</p></section>
 <section class="card"><h2 class="card-title">Legal</h2><p class="fine">Riftroom was created under Riot Games' &quot;Legal Jibber Jabber&quot; policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p></section>
 </div>`;
}

/* ---------- Dialoge ---------- */
function openPicker(type,index){
 if(['allies','enemies','bans'].includes(type)&&practiceBlocks(type,index))return;
 pickerTarget={type,index};pickerRole=type==='bans'||type==='mu'?'ALL':ROLES[index];pickerSearch='';
 if(type==='allies'){state.selectedRole=index;save();render();}
 const title=type==='mu'?'Matchup note: against whom?':type==='opp'?`Mains: ${ROLE_NAMES[ROLES[index]]} of ${esc(selOpp()?.name||'')}`:type==='pool'?`Pool of ${esc(state.players[index].name)}`:type==='bans'?'Ban champion':`${type==='allies'?'Your':'Opponent'} ${ROLE_NAMES[ROLES[index]]}`;
 const dialog=$('#picker');
 dialog.innerHTML=`<div class="dlg-head"><h2 id="picker-title">${title}</h2><button class="icon-btn" data-action="close-picker" aria-label="Close">${icon('close')}</button></div><div class="picker-controls"><div class="search">${icon('search')}<input id="picker-search" class="field" placeholder="Search all champions" aria-label="Search champion" autocomplete="off"></div><select id="picker-role" class="field" aria-label="Role filter"><option value="ALL" ${pickerRole==='ALL'?'selected':''}>All roles</option>${ROLES.map(r=>`<option value="${r}" ${pickerRole===r?'selected':''}>${ROLE_NAMES[r]}</option>`).join('')}</select></div><div class="picker-grid" id="picker-grid"></div>${['allies','enemies','bans'].includes(type)&&state[type][index]?'<div class="dlg-actions"><button class="btn" data-action="clear-slot">Clear slot</button></div>':''}`;
 renderPickerGrid();dialog.showModal();$('#picker-search').focus();
}
// Gruppen oben im Picker, je nach Slot. Vergebene Champions werden in den Gruppen ausgelassen.
function pickerSections(type,index,blocked){
 if(type==='mu')return[];
 const free=ids=>[...new Set(ids)].filter(id=>champ(id)&&!blocked.has(id));
 const byId=new Map(catalog.champions.map(c=>[c.id,c]));
 const st=status(),meta=st.ok?state.meta:null;
 const strong=role=>meta?meta.entries.filter(e=>e.role===role&&e.games>=10000).sort((a,b)=>(b.wins+100)/(b.games+200)-(a.wins+100)/(a.games+200)).map(e=>e.champion):[];
 const opp=activeOpp();
 if(type==='allies'){
  const p=state.players[index];
  const recs=rec({...state,selectedRole:index,poolOnly:false}).slice(0,3).map(c=>c.id);
  const pool=[...p.pool].sort((a,b)=>b.comfort-a.comfort).map(v=>v.id);
  return[['Recommended',free(recs)],[`Pool of ${esc(p.name)}`,free(pool).filter(id=>!recs.includes(id))]];
 }
 if(type==='opp')return[[meta?`Strong as ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).slice(0,6)]];
 if(type==='enemies')return[[opp?`Mains ${ROLE_NAMES[ROLES[index]]}${opp.players[index].riotId?' ('+esc(opp.players[index].riotId)+')':''}`:'',free(opp?.players[index].champs||[])],[opp?`Favorites of ${esc(opp.name)}`:'',free(oppAll(opp)).filter(id=>!opp.players[index].champs.includes(id))],[meta?`Strong as ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).filter(id=>!oppAll(opp).includes(id)).slice(0,6)]];
 if(type==='bans')return[['Ban suggestions',free(banList(15).items.map(b=>b.id)).slice(0,8)]];
 return[[meta?`Strong as ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).slice(0,6)]];
}
function renderPickerGrid(){
 syncEngine();
 const {type,index}=pickerTarget,q=pickerSearch.trim().toLowerCase();
 const blocked=new Set(type==='pool'?state.players[index].pool.map(v=>v.id):type==='opp'?(selOpp()?.players[index].champs||[]):type==='mu'?[]:[...taken()]);
 const inPool=id=>type==='allies'&&state.players[index]?.pool.some(p=>p.id===id);
 const btn=c=>`<button class="champ-btn" data-choose="${c.id}" ${blocked.has(c.id)?'disabled':''} aria-label="${esc(c.name)}${blocked.has(c.id)?' (vergeben)':''}">${portrait(c.id,'')}<span>${esc(c.name)}</span>${inPool(c.id)?'<small>Pool</small>':''}</button>`;
 const sorted=[...catalog.champions].sort((a,b)=>a.name.localeCompare(b.name,'de'));
 let html='';
 if(q){
  // Die Suche geht über alle Champions, unabhängig vom Rollenfilter.
  html=searchChamps(sorted,q).map(btn).join('');
 }else{
  const sections=pickerSections(type,index,blocked).filter(([t,ids])=>t&&ids.length);
  const shown=new Set(sections.flatMap(([,ids])=>ids));
  const rest=sorted.filter(c=>!shown.has(c.id)&&(pickerRole==='ALL'||profileOf(c.id)?.roles.includes(pickerRole)));
  html=sections.map(([t,ids])=>`<h3 class="picker-section">${t}</h3>${ids.map(id=>btn(champ(id))).join('')}`).join('')
   +(sections.length&&rest.length?`<h3 class="picker-section">${pickerRole==='ALL'?'All Champions':'All for '+ROLE_NAMES[pickerRole]}</h3>`:'')+rest.map(btn).join('');
 }
 $('#picker-grid').innerHTML=html||`<div class="no-results">${q?'No champion with that name.':'No champions for this role. Choose “All roles”.'}</div>`;
}
function choose(id){
 const {type,index}=pickerTarget;
 if(type==='mu'){$('#picker').close();showMatchupDialog(id);return;}
 if(type==='opp'){const pl=selOpp()?.players[index];if(!pl)return;if(!pl.champs.includes(id)&&pl.champs.length<5)pl.champs.push(id);save();$('#picker').close();render();toast(`${cname(id)} added as a main.`);return;}
 if(type==='pool'){if(!state.players[index].pool.some(p=>p.id===id))state.players[index].pool.push({id,comfort:3});}
 else{if(taken().has(id))return;state[type][index]=id;}
 save();$('#picker').close();render();
 toast(type==='pool'?`${cname(id)} added to the pool.`:`${cname(id)} ${type==='bans'?'banned':'set'}.`);
}
function confirmDialog(title,message,action){confirmAction=action;$('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">${esc(title)}</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Abbrechen">${icon('close')}</button></div><p class="muted">${esc(message)}</p><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Cancel</button><button class="btn primary" data-action="confirm">Confirm</button></div>`;$('#confirm-dialog').showModal();}
function showExport(){
 const {catalog:_c,...data}=state;confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">Backup</h2><p class="fine" style="margin-top:4px">Copy the text and save it as a .json file. Use “Import backup” to restore it.</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div><textarea id="export-text" class="field code" rows="12" readonly aria-label="Sicherung als JSON">${esc(JSON.stringify(data,null,2))}</textarea><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Close</button><button class="btn primary" data-action="copy-export">Copy</button></div>`;
 $('#confirm-dialog').showModal();
}
function pickFile(kind){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024)throw Error('The file can be at most 5 MB.');const raw=JSON.parse((await file.text()).replace(/^﻿/,''));if(kind==='meta'){const data=validateMeta(raw,new Set(catalog.champions.map(c=>c.id)));state.meta=data;state.metaImported=true;save();render();toast(`Win rates from ${data.source} imported. ${status().ok?'They are used in recommendations.':status().label+': not included.'}`);}else{const data=validateState(raw,catalog);confirmDialog('Restore backup?','Team, draft, settings and win rates will be replaced by the selected backup.',()=>{state=data;save();render();toast('Backup restored.');});}}catch(e){toast('Import failed: '+e.message,true);}};input.click();}

/* ---------- Gemeinsame Datenbank ---------- */
let db=null,teamRef=null,lastSharedJson='',pushing=false,teamReadOnly=false;
const SHARED=['teamName','players','allies','enemies','bans','templates','draftMode','side','opponents','opponentId','history','matchups','draftActive','fearless'];
const sharedPart=()=>Object.fromEntries(SHARED.map(k=>[k,state[k]]));
const champIds=()=>new Set(catalog.champions.map(c=>c.id));
async function pushBackup(){
 if(!teamRef||teamReadOnly||pushing)return;
 const body=JSON.stringify(sharedPart());if(body===lastSharedJson)return;
 pushing=true;
 try{await teamRef.set({state:JSON.parse(body),updatedAt:new Date().toISOString()});lastSharedJson=body;}
 catch(e){if(e?.code==='invalid_argument'){teamReadOnly=true;toast('You can view the team but not change it. Ask the owner for edit rights.',true);}}
 finally{pushing=false;}
 if(JSON.stringify(sharedPart())!==lastSharedJson&&!teamReadOnly){clearTimeout(backupTimer);backupTimer=setTimeout(pushBackup,1500);}
}
function applyRemoteTeam(snap){
 if(snap.metadata?.hasPendingWrites)return;
 if(practice){pendingRemote=snap;return;}
 if(!snap.exists){if(!snap.metadata?.fromCache)pushBackup();return;}
 const d=snap.data()?.state;if(!d)return;
 const body=JSON.stringify(d);if(body===lastSharedJson)return;
 try{const merged=validateState({...state,meta:null,...d,version:1},catalog);for(const k of SHARED)state[k]=merged[k];lastSharedJson=body;
  try{localStorage.setItem(storageKey,JSON.stringify({...state,catalog:null}));}catch{}
  const typing=document.activeElement&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName);if(!typing)render();}catch{}
}
// Datenquellen: in Claude die gemeinsame Datenbank, in der eigenständigen Version (GitHub) die Datei data/meta.json.
function onCatalog(c){if(c?.champions?.length>=100&&c.version!==catalog.version){const en=new Map(catalog.champions.map(x=>[x.id,x]));catalog={...c,champions:c.champions.map(x=>en.has(x.id)?{...x,name:en.get(x.id).name,title:en.get(x.id).title}:x)};render();}}
// Selbst importierte Winrates haben Vorrang, bis sie entfernt werden.
function onCurrent(d){if(!d||state.metaImported)return;try{state.meta=validateMeta(d.snapshot,champIds());state.meta.source=state.meta.source.replace('inoffizielle Abfrage, nicht von Riot','unofficial query, not from Riot');state.lastChecked=d.snapshot.updatedAt;render();}catch{}}
function onPrevious(d){if(!d)return;try{prevMeta=validateMeta(d.snapshot,champIds());render();}catch{}}
// Best in Slot (Master+): täglich aktualisiert. Nur übernehmen, wenn das Format stimmt.
function onBis(b){try{if(!b||!b.roles||!ROLES.every(r=>Array.isArray(b.roles[r])&&b.roles[r].length>=3&&b.roles[r].every(x=>Array.isArray(x)&&typeof x[0]==='string'&&isFinite(x[1])&&isFinite(x[2]))))return;BIS.solo={label:String(b.label||'Solo Queue Master+'),patch:String(b.patch||''),region:String(b.region||'Global'),asOf:String(b.asOf||''),roles:Object.fromEntries(ROLES.map(r=>[r,b.roles[r].slice(0,6).map(x=>[x[0],Number(x[1]),Number(x[2]),Number(x[3])||0])]))};if(page==='team')render();}catch{}}
async function loadStatic(){
 try{const r=await fetch('data/meta.json',{cache:'no-cache'});if(!r.ok)throw Error();const d=await r.json();onCatalog(d.catalog);onCurrent(d.current);onPrevious(d.previous);onBis(d.bis);}
 catch{refreshMessage='The win rates couldn\'t be loaded right now. Check your internet connection and reload the page.';render();}
}
async function connect(){
 try{db=window.claude?.use?await window.claude.use('db'):null;}catch{db=null;}
 if(!db){if(STANDALONE){loadStatic();return;}refreshMessage='Offline: Without signing in to Claude your data stays in this browser, and there are no win rates.';render();return;}
 db.doc('meta/catalog').onSnapshot(s=>onCatalog(s.exists?s.data()?.catalog:null),()=>{});
 db.doc('meta/current').onSnapshot(s=>onCurrent(s.exists?s.data():null),()=>{});
 db.doc('meta/previous').onSnapshot(s=>onPrevious(s.exists?s.data():null),()=>{});
 db.doc('meta/bis').onSnapshot(s=>onBis(s.exists?s.data()?.solo:null),()=>{});
 db.doc('meta/matchups').onSnapshot(s=>{if(s.exists){setMatchups(s.data());if(page==='mini')render();}},()=>{});
 teamRef=db.doc('team/main');
 teamRef.onSnapshot(applyRemoteTeam,()=>{});
}

/* ---------- Live-Raum (nur eigenständige Version) ---------- */
// Einer bedient den Draft (Host), das Team schaut per Raum-Code live zu. Gespeichert wird nur der Draft-Stand
// bei Supabase in Frankfurt, ohne Login. Die Bibliothek lädt erst, wenn jemand einen Raum benutzt.
const SB_URL='https://vupytxgbazwgyhslzaxo.supabase.co',SB_KEY='sb_publishable_gHcNFcK3HK-HgrvshRIKBQ_lxOq3e5a';
let scoutTimer=null;
if(STANDALONE)initRiot({url:SB_URL+'/functions/v1/riot',key:SB_KEY,onUpdate:()=>{if(page==='team'||page==='opponents'||$('#confirm-dialog').open)riotRepaint();if(page==='draft'){clearTimeout(scoutTimer);scoutTimer=setTimeout(render,400);}}});
const ROOM_KEYS=['teamName','players','allies','enemies','bans','draftMode','side','draftActive','opponents','opponentId','matchups','fearless'];
let room=null,sbClient=null,roomChannel=null,roomPushTimer=null,roomPoll=null,roomPushing=false,roomDirty=false;
const viewerLocked=()=>room?.role==='viewer'&&!['plan','meta','mini','draft'].includes(page);
function loadSb(){
 if(sbClient)return Promise.resolve(sbClient);
 return new Promise((ok,fail)=>{const el=document.createElement('script');el.src='vendor/supabase.js';el.onload=()=>{try{sbClient=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});ok(sbClient);}catch(e){fail(e);}};el.onerror=()=>fail(Error('load'));document.head.appendChild(el);});
}
const roomState=()=>Object.fromEntries(ROOM_KEYS.map(k=>[k,state[k]]));
const roomLink=()=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',room.code);return u.href;};
function saveRoomSession(){try{if(room)localStorage.setItem('riftroom.room',JSON.stringify({code:room.code,token:room.token||null}));else localStorage.removeItem('riftroom.room');}catch{}}
function openRoomDialog(){
 confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">Live room</h2><p class="fine" style="margin-top:4px">One person runs the draft, everyone else sees every ban and pick instantly on their own device. No account needed.</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Close">${icon('close')}</button></div>
 <div class="room-opt"><h3>Create a room</h3><p class="fine">You run the draft. Then send your team the link or the code.</p><button class="btn primary" data-action="room-create">${icon('users')}Create room</button></div>
 <div class="room-opt"><h3>Join a room</h3><p class="fine">You watch and see your team's draft live.</p><div class="row"><input class="field grow room-code" id="room-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code, e.g. K7Q2M" aria-label="Room code"><button class="btn" data-action="room-join">Join</button></div></div>
 <p class="fine">Only the draft state with your player and opponent names is stored, without any login. Rooms are deleted after one day without changes.</p>`;
 $('#confirm-dialog').showModal();
}
async function createRoom(){
 try{
  const sb=await loadSb();const {data,error}=await sb.rpc('create_room',{p_state:roomState()});if(error||!data?.[0])throw error||Error('empty');
  room={code:data[0].code,token:data[0].host_token,role:'host',version:1,viewers:0,status:'connecting'};saveRoomSession();subscribeRoom();
  $('#confirm-dialog').close();render();copyRoomLink(`Room ${room.code} created. The link is copied, send it to your team.`);
 }catch{toast('The room couldn\'t be created. Check your internet connection.',true);}
}
async function joinRoom(code,token=null){
 code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(code.length!==5){toast('The room code has 5 characters.',true);return;}
 try{
  const sb=await loadSb();const {data,error}=await sb.rpc('get_room',{p_code:code});if(error)throw error;
  if(!data?.[0]){toast('Room not found. It may have expired.',true);if(room?.code===code||!room)forgetRoom();return;}
  room={code,token,role:token?'host':'viewer',version:0,viewers:0,status:'connecting'};saveRoomSession();
  if(room.role==='viewer'){page='draft';applyRoom(data[0]);}else room.version=data[0].version;
  if(document.querySelector('#confirm-dialog[open]'))$('#confirm-dialog').close();
  subscribeRoom();render();
  if(room.role==='viewer')toast(`You're watching in room ${code}.`);
 }catch{toast('Can\'t connect to the room. Check your internet connection.',true);}
}
function resumeRoom(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem('riftroom.room'));}catch{}
 const fromLink=new URLSearchParams(location.search).get('room');
 if(fromLink){joinRoom(fromLink,saved&&saved.code===fromLink.toUpperCase()?saved.token:null);return;}
 if(saved?.code)joinRoom(saved.code,saved.token);
}
function applyRoom(row){
 if(!room||row.version<=room.version)return;
 const before={allies:[...state.allies],enemies:[...state.enemies]};
 try{
  const remote=Object.fromEntries(ROOM_KEYS.filter(k=>k in row.state).map(k=>[k,row.state[k]]));
  const merged=validateState({...state,meta:null,...remote,version:1},catalog);
  for(const k of ROOM_KEYS)state[k]=merged[k];
 }catch{return;}
 room.version=row.version;
 if(state.bans.every(x=>!x))myVotes.clear();
 if(document.activeElement?.closest?.('.page-body')&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
 render();
 for(const type of ['allies','enemies'])for(let i=0;i<5;i++)if(state[type][i]&&state[type][i]!==before[type][i]){lockSplash(state[type][i],type==='allies'?'us':'them',i);return;}
}
async function refreshRoom(){
 if(room?.role!=='viewer'||!sbClient)return;
 try{const {data,error}=await sbClient.rpc('get_room',{p_code:room.code});if(error)throw error;
  if(!data?.[0]){toast('The room has expired.',true);leaveRoom();return;}
  if(room.status!=='live'&&roomChannel?.state==='joined'){room.status='live';updateRoomBar();}
  applyRoom(data[0]);
 }catch{if(room){room.status='offline';updateRoomBar();}}
}
function subscribeRoom(){
 if(!sbClient||!room)return;
 if(roomChannel)sbClient.removeChannel(roomChannel);
 const me=myId,code=room.code;
 roomChannel=sbClient.channel('room:'+code,{config:{presence:{key:me}}})
  .on('broadcast',{event:'changed'},()=>refreshRoom())
  .on('broadcast',{event:'vote'},({payload:p})=>{if(room?.role!=='host'||!p||!champIds().has(p.id))return;const set=rawVotes.get(p.id)||new Set();if(p.on)set.add(String(p.from));else set.delete(String(p.from));rawVotes.set(p.id,set);hostTally();})
  .on('broadcast',{event:'wish'},({payload:p})=>{if(room?.role!=='host'||!p||!champIds().has(p.id)||!(p.role>=0&&p.role<5))return;rawWishes.set(Number(p.role),{id:p.id,from:String(p.from)});hostTally();})
  .on('broadcast',{event:'tally'},({payload:p})=>{if(room?.role!=='viewer'||!p)return;const ids=champIds();tally={votes:Object.fromEntries(Object.entries(p.votes||{}).filter(([id,n])=>ids.has(id)&&n>0).map(([id,n])=>[id,Number(n)])),wishes:Object.fromEntries(Object.entries(p.wishes||{}).filter(([r,id])=>r>=0&&r<5&&ids.has(id)))};updateWishUI();})
  .on('presence',{event:'sync'},()=>{if(!room||!roomChannel)return;room.viewers=Object.values(roomChannel.presenceState()).filter(v=>v[0]?.role==='viewer').length;updateRoomBar();if(room.role==='host')hostTally();})
  .subscribe(status=>{
   if(!room||room.code!==code)return;
   if(status==='SUBSCRIBED'){room.status='live';roomChannel.track({role:room.role});if(room.role==='viewer')refreshRoom();else pushRoom();}
   else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')room.status='offline';
   updateRoomBar();
  });
 clearInterval(roomPoll);
 // Sicherheitsnetz, falls das Live-Signal einmal verloren geht.
 roomPoll=setInterval(()=>{if(room?.role==='viewer'&&!document.hidden)refreshRoom();},10000);
}
function queueRoomPush(){if(room?.role!=='host')return;clearTimeout(roomPushTimer);roomPushTimer=setTimeout(pushRoom,120);}
async function pushRoom(){
 if(room?.role!=='host'||!sbClient)return;
 if(roomPushing){roomDirty=true;return;}
 roomPushing=true;
 try{const {data,error}=await sbClient.rpc('update_room',{p_code:room.code,p_token:room.token,p_state:roomState()});if(error)throw error;
  room.version=data;if(room.status!=='live'&&roomChannel?.state==='joined'){room.status='live';updateRoomBar();}hostTally();}
 catch(e){if(/not allowed/.test(e?.message||'')){toast('The room has expired. Create a new one if you need it.',true);leaveRoom();}else if(room){room.status='offline';updateRoomBar();}}
 finally{roomPushing=false;if(roomDirty){roomDirty=false;pushRoom();}}
}
function forgetRoom(){
 if(roomChannel&&sbClient)sbClient.removeChannel(roomChannel);
 roomChannel=null;clearInterval(roomPoll);clearTimeout(roomPushTimer);room=null;saveRoomSession();
 const u=new URL(location.href);if(u.searchParams.has('room')){u.searchParams.delete('room');history.replaceState(null,'',u);}
}
function leaveRoom(){
 const wasViewer=room?.role==='viewer';forgetRoom();
 // Zuschauer haben fremde Daten angezeigt bekommen: eigenen Stand frisch laden.
 if(wasViewer){location.reload();return;}
 render();
}
async function copyRoomLink(msg){
 if(!room)return;const link=roomLink();
 try{await navigator.clipboard.writeText(link);toast(msg||'Link copied. Send it to your team.');}
 catch{toast(`Room code: ${room.code} · ${link}`);}
}
function roomBarHtml(){
 if(!room)return'';
 const live=room.status==='live',host=room.role==='host',done=draftStarted()&&draftTurn(state).finished;
 const who=host?`You're running the draft · ${!room.viewers?'nobody watching yet':room.viewers===1?'1 watching':room.viewers+' watching'}`:'You\'re watching';
 const state_=room.status==='connecting'?' · connecting …':live?'':' · connection lost';
 return`<div id="room-bar" class="room-bar ${live?'live':'off'}"><span class="rb-dot" aria-hidden="true"></span><span class="rb-text"><strong>Live room ${room.code}</strong><span>${who}${state_}</span></span><span class="rb-actions">${host?`<button class="btn small" data-action="room-copy">${icon('copy')}Copy link</button>`:done&&page!=='plan'?`<button class="btn small primary" data-page="plan">${icon('map')}Game plan</button>`:''}<button class="btn ghost small" data-action="room-leave">Leave</button></span></div>`;
}
function updateRoomBar(){const el=document.getElementById('room-bar');if(el)el.outerHTML=roomBarHtml();}
// Mitmachen als Zuschauer: Bans vorschlagen (👍) und sich einen Champion für eine Rolle wünschen.
// Läuft nur live zwischen den Geräten, nichts davon wird gespeichert. Bestätigen kann nur der Host.
const myId=(()=>{try{let v=sessionStorage.getItem('riftroom.me');if(!v){v=Math.random().toString(36).slice(2,10);sessionStorage.setItem('riftroom.me',v);}return v;}catch{return Math.random().toString(36).slice(2,10);}})();
let tally={votes:{},wishes:{}},myVotes=new Set(),rawVotes=new Map(),rawWishes=new Map();
function resetTeamWishes(){rawVotes.clear();rawWishes.clear();myVotes.clear();tally={votes:{},wishes:{}};}
function hostTally(){
 if(room?.role!=='host')return;
 const tk=taken(),votes={},wishes={};
 for(const [id,set] of rawVotes)if(set.size&&!tk.has(id))votes[id]=set.size;
 for(const [r,w] of rawWishes)if(!state.allies[r]&&!tk.has(w.id))wishes[r]=w.id;
 tally={votes,wishes};
 roomChannel?.send({type:'broadcast',event:'tally',payload:tally});
 updateWishUI();
}
function teamWishHtml(c){
 if(!room||!c||c.who!=='us')return'';
 const tk=taken(),ban=c.type==='ban';
 const items=ban?Object.entries(tally.votes).filter(([id])=>!tk.has(id)).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,n])=>({id,tag:`${n} 👍${myVotes.has(id)?' · you':''}`}))
  :Object.entries(tally.wishes).filter(([r,id])=>!state.allies[r]&&!tk.has(id)).map(([r,id])=>({id,role:Number(r),tag:`Wish for ${ROLE_NAMES[ROLES[r]]}`}));
 if(!items.length)return'';
 return`<div class="cs-sug team-wish"><span class="label">${ban?'Ban suggestions from the team':'Wishes from the team'}</span><div class="cs-sug-row">${items.map(x=>`<button class="cs-sug-item ${hoverId===x.id?'on':''}" data-hover="${x.id}" ${x.role!=null?`data-wish-role="${x.role}"`:''}>${portrait(x.id,'av sm')}<span><b>${esc(cname(x.id))}</b><small>${x.tag}</small></span></button>`).join('')}</div></div>`;
}
function wishChip(i){const id=room&&!state.allies[i]?tally.wishes[i]:null;return id&&!taken().has(id)?`<span class="wish-chip">Wish: ${esc(cname(id))}</span>`:'';}
function updateWishUI(){
 const el=document.getElementById('team-wish');if(el)el.innerHTML=teamWishHtml(draftTurn(state).current);
 for(let i=0;i<5;i++){const row=document.querySelector(`[data-slot="allies|${i}"] .cs-row-text`);if(!row)continue;row.querySelector('.wish-chip')?.remove();const h=wishChip(i);if(h)row.insertAdjacentHTML('beforeend',h);}
}
function viewerLockBar(c){
 const ban=c.type==='ban';
 if(!hoverId)return`<span class="fine">${ban?'Tap a champion your team should ban.':'Tap the champion you want to play.'}</span><span class="lock-actions"><button class="btn primary" disabled>${ban?'Suggest ban':'Send wish'}</button></span>`;
 const pr=ban?null:(pickRole??stepTarget(c).index);
 const roleSel=ban?'':`<div class="pick-roles"><span class="fine">For which role?</span><div class="seg" role="group" aria-label="Role for your wish">${openSlots('allies').map(i=>`<button data-pick-role="${i}" aria-pressed="${pr===i}">${ROLE_NAMES[ROLES[i]]}</button>`).join('')}</div></div>`;
 const label=ban?(myVotes.has(hoverId)?'Withdraw suggestion':'👍 Suggest ban'):`Send wish: ${ROLE_NAMES[ROLES[pr]]}`;
 return`<div class="cs-lock-champ">${portrait(hoverId,'av')}<div><strong>${esc(cname(hoverId))}</strong><span class="fine">${ban?'Your team sees your suggestion instantly.':'The host sees your wish at your slot.'}</span></div></div>${roleSel}<button class="btn primary lock-btn" data-action="lock-in">${label}</button>`;
}
function viewerSend(){
 const c=draftTurn(state).current;if(!c||c.who!=='us'||!hoverId)return;
 if(!roomChannel||room.status!=='live'){toast('No connection to the room. Try again in a moment.',true);return;}
 if(c.type==='ban'){
  const on=!myVotes.has(hoverId);if(on)myVotes.add(hoverId);else myVotes.delete(hoverId);
  roomChannel.send({type:'broadcast',event:'vote',payload:{from:myId,id:hoverId,on}});
  toast(on?`${cname(hoverId)} suggested as a ban.`:'Suggestion withdrawn.');
 }else{
  const r=pickRole??stepTarget(c).index;
  roomChannel.send({type:'broadcast',event:'wish',payload:{from:myId,id:hoverId,role:r}});
  toast(`Wish sent: ${cname(hoverId)} for ${ROLE_NAMES[ROLES[r]]}.`);
 }
 hoverId=null;pickRole=null;render();
}
// Zuschauer im Live-Raum: im Draft nur Champions ansehen, filtern und vorschlagen, sonst nichts ändern.
document.addEventListener('click',e=>{
 if(room?.role!=='viewer'||page!=='draft')return;
 const el=e.target.closest('button');if(!el||!el.closest('.page-body'))return;
 const d=el.dataset;
 if(d.hover||d.ra!=null||d.pickRole!=null||d.csRole||d.csPool!=null||d.page||d.action==='lock-in')return;
 e.preventDefault();e.stopImmediatePropagation();
},true);

/* ---------- Ereignisse ---------- */
document.addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el||el.disabled)return;
 if(el.dataset.minitab){miniTab=el.dataset.minitab;try{localStorage.setItem('riftroom.minitab',miniTab);}catch{}render();return;}
 if(handleLobbyClick(el))return;
 if(page==='mini'&&miniTab!=='guess'&&handlePuzzleClick(el))return;
 if(handleMiniClick(el))return;
 if(el.dataset.page){page=el.dataset.page;if(page==='meta'&&catalog&&state.meta&&state.seenPatch!==shortPatch(catalog.version)){state.seenPatch=shortPatch(catalog.version);save();}saveUi();render();window.scrollTo({top:0,behavior:'instant'});return;}
 if(el.dataset.metaTab){metaTab=el.dataset.metaTab;saveUi();render();return;}
 if(el.dataset.picker){openPicker(el.dataset.picker,Number(el.dataset.index));return;}
 if(el.dataset.choose){choose(el.dataset.choose);return;}
 if(el.dataset.role!=null){state.selectedRole=Number(el.dataset.role);save();render();return;}
 if(el.dataset.pick){const id=el.dataset.pick;if(taken().has(id))return;if(practiceBlocks('allies',state.selectedRole))return;const i=state.selectedRole;if(state.allies[i]){confirmDialog('Replace pick?',`${cname(state.allies[i])} will be replaced by ${cname(id)}.`,()=>{state.allies[i]=id;save();render();toast('Pick replaced.');});}else{state.allies[i]=id;const next=[1,2,3,4].map(k=>(i+k)%5).find(k=>!state.allies[k]);if(next!=null)state.selectedRole=next;save();render();toast(`${cname(id)} for ${ROLE_NAMES[ROLES[i]]} set.${next!=null?' Next: '+ROLE_NAMES[ROLES[next]]+'.':''}`);}return;}
 if(el.dataset.remove){if(practice){toast('There is no undo in a practice draft. Restart if needed.',true);return;}state[el.dataset.remove][Number(el.dataset.index)]=null;save();render();return;}
 if(el.dataset.removePool){const p=state.players[Number(el.dataset.index)];p.pool=p.pool.filter(c=>c.id!==el.dataset.removePool);save();render();return;}
 if(el.dataset.comfort){state.players[Number(el.dataset.index)].pool.find(c=>c.id===el.dataset.champion).comfort=Number(el.dataset.comfort);save();render();return;}
 if(el.dataset.setMode){state.draftMode=el.dataset.setMode;save();render();return;}
 if(el.dataset.setSide){state.side=el.dataset.setSide;save();render();return;}
 if(el.dataset.quickBan){const i=state.bans.slice(0,5).findIndex(x=>!x);if(i<0){toast('All five of your bans are used.',true);return;}if(practiceBlocks('bans',i))return;state.bans[i]=el.dataset.quickBan;save();render();toast(`${cname(el.dataset.quickBan)} banned.`);return;}
 if(el.dataset.selectOpponent){selectedOpponent=el.dataset.selectOpponent;render();return;}
 if(el.dataset.removeMain){const [i,id]=el.dataset.removeMain.split('|');const pl=selOpp()?.players[Number(i)];if(pl){pl.champs=pl.champs.filter(x=>x!==id);save();render();}return;}
 if(el.dataset.removeFav){const o=selOpp();if(o){o.favorites=o.favorites.filter(x=>x!==el.dataset.removeFav);save();render();}return;}
 if(el.dataset.templateLoad){const t=state.templates.find(x=>x.id===el.dataset.templateLoad);if(t)confirmDialog(`Template “${t.name}”: load it?`,'The current draft will be replaced by the template.',()=>{state.allies=[...t.allies];state.enemies=[...t.enemies];state.bans=[...t.bans];save();render();toast('Template loaded.');});return;}
 if(el.dataset.templateDelete){state.templates=state.templates.filter(x=>x.id!==el.dataset.templateDelete);save();render();toast('Template deleted.');return;}
 if(el.dataset.jump){const t=document.getElementById(el.dataset.jump);if(t){t.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});t.classList.remove('flash');void t.offsetWidth;t.classList.add('flash');}return;}
 if(el.dataset.myrole){myRole=myRole===el.dataset.myrole?null:el.dataset.myrole;try{myRole?localStorage.setItem('riftroom.myrole',myRole):localStorage.removeItem('riftroom.myrole');}catch{}render();if(myRole)requestAnimationFrame(()=>document.querySelector('.my-plan')?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'}));return;}
 if(el.dataset.csPool!=null){csPoolOnly=!csPoolOnly;el.setAttribute('aria-pressed',String(csPoolOnly));const g=$('#cs-grid');if(g)g.innerHTML=csGrid();return;}
 if(el.dataset.bisTab){bisTab=el.dataset.bisTab;saveBis();render();return;}
 if(el.dataset.riotLoad){const [scope,i]=el.dataset.riotLoad.split('|');if(scope==='team'){const inp=document.querySelector(`[data-player-riot="${i}"]`);if(inp){state.players[Number(i)].riotId=inp.value.trim().replace(/\s*#\s*/,'#').slice(0,40);save();}}const t=riotTarget(scope,Number(i));if(!t?.id){toast('Enter a Riot ID first, e.g. Name#EUW.',true);return;}const st=riotState(t.region,t.id);riotStart(scope,Number(i),st?.status==='ok');return;}
 if(el.dataset.riotAll){const scope=el.dataset.riotAll;for(let i=0;i<5;i++){const t=riotTarget(scope,i);if(t&&validRiotId(t.id))riotLoad(t.region,t.id);}return;}
 if(el.dataset.riotAdd){const [i,id,n]=el.dataset.riotAdd.split('|');const p=state.players[Number(i)];if(p&&!p.pool.some(v=>v.id===id)&&p.pool.length<100){p.pool.push({id,comfort:comfortFromGames(Number(n)||1)});save();render();toast(`${cname(id)} is now in the pool of ${p.name}.`);}return;}
 if(el.dataset.riotMain){const [i,id]=el.dataset.riotMain.split('|');const pl=selOpp()?.players[Number(i)];if(pl){if(pl.champs.includes(id))pl.champs=pl.champs.filter(x=>x!==id);else if(pl.champs.length<5)pl.champs.push(id);else{toast('At most five mains per player.',true);return;}save();render();}return;}
 if(el.dataset.riotTake){const [scope,i]=el.dataset.riotTake.split('|');riotTakeTop(scope,Number(i));return;}
 if(el.dataset.bisAdd){const [id,i]=el.dataset.bisAdd.split('|');const p=state.players[Number(i)];if(!p.pool.some(v=>v.id===id)&&p.pool.length<100){p.pool.push({id,comfort:2});save();render();toast(`${cname(id)} is now in the pool of ${p.name}.`);}return;}
 if(el.dataset.swap){const [type,i]=el.dataset.swap.split('|');openSwapDialog(type,Number(i));return;}
 if(el.dataset.swapTo){const [type,a,b]=el.dataset.swapTo.split('|');const i=Number(a),j=Number(b);if(i!==j){const x=state[type][i];state[type][i]=state[type][j];state[type][j]=x;if(type==='enemies')enemyRole=null;save();render();toast(`${cname(x)} now plays ${ROLE_NAMES[ROLES[j]]}.`);}$('#confirm-dialog').close();return;}
 if(el.dataset.swapClear){const [type,i]=el.dataset.swapClear.split('|');const id=state[type][Number(i)];state[type][Number(i)]=null;undoStack=[];$('#confirm-dialog').close();save();render();toast(`${cname(id)} removed.`);return;}
 if(el.dataset.swapChange){const [type,i]=el.dataset.swapChange.split('|');$('#confirm-dialog').close();openPicker(type,Number(i));return;}
 if(el.dataset.prTimer){prTimer=el.dataset.prTimer==='on';document.querySelectorAll('[data-pr-timer]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}
 if(el.dataset.ra!=null){const i=Number(el.dataset.ra);state.selectedRole=i;pickRole=i;if(!csSearch)csRole=ROLES[i];save();render();return;}
 if(el.dataset.pickRole!=null){pickRole=Number(el.dataset.pickRole);if(!csSearch)csRole=ROLES[pickRole];render();return;}
 if(el.dataset.hover){selectHover(el.dataset.hover,el.dataset.wishRole!=null?Number(el.dataset.wishRole):null);return;}
 if(el.dataset.csTarget){const [type,i]=el.dataset.csTarget.split('|');if(type==='allies')state.selectedRole=Number(i);else enemyRole=Number(i);render();return;}
 if(el.dataset.csRole){csRole=el.dataset.csRole;document.querySelectorAll('[data-cs-role]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const g=$('#cs-grid');if(g)g.innerHTML=csGrid();return;}
 if(el.dataset.flNext){fearlessNext(el.dataset.flNext);return;}
 if(el.dataset.prFearless){prFearless=el.dataset.prFearless==='on';document.querySelectorAll('[data-pr-fearless]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const h=$('#pr-fl-hint');if(h)h.textContent=prFearless?FL_HINT:'A normal draft.';return;}
 if(el.dataset.prMode){prMode=el.dataset.prMode;document.querySelectorAll('[data-pr-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const h=$('#pr-mode-hint');const tr=$('#pr-timer-row');if(tr)tr.hidden=prMode!=='ai';if(h)h.textContent=prMode==='ai'?'Practice against the computer. Only in this browser.':'You enter the opponent picks. The team sees the draft live.';return;}
 if(el.dataset.muEdit){showMatchupDialog(el.dataset.muEdit);return;}
 if(el.dataset.muSave){const id=el.dataset.muSave,t=($('#mu-text')?.value||'').trim().slice(0,500);if(t)state.matchups[id]=t;else delete state.matchups[id];save();$('#confirm-dialog').close();render();toast(t?`Note on ${cname(id)} saved.`:`Note on ${cname(id)} removed.`);return;}
 if(el.dataset.muDelete){delete state.matchups[el.dataset.muDelete];save();$('#confirm-dialog').close();render();toast('Note deleted.');return;}
 if(el.dataset.prSide){prSide=el.dataset.prSide;document.querySelectorAll('[data-pr-side]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}
 if(el.dataset.logResult){logResult=el.dataset.logResult;document.querySelectorAll('[data-log-result]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const s=$('#log-save');if(s)s.disabled=false;return;}
 if(el.dataset.gameDelete){const g=state.history.find(x=>x.id===el.dataset.gameDelete);if(g)confirmDialog('Delete game?',`${g.result==='win'?'Win':'Loss'} from ${date(g.date)}${g.opponentName?' vs '+g.opponentName:''} will be removed for everyone.`,()=>{state.history=state.history.filter(x=>x.id!==g.id);save();render();toast('Game deleted.');});return;}
 const action=el.dataset.action;if(!action)return;
 if(action==='log-game')showLogGame();
 if(action==='draft-open')openDraftDialog();
 if(action==='draft-start'){const opp=$('#pr-opp')?.value||'';$('#confirm-dialog').close();saveDraftOpts();if(prMode==='ai')startPractice({side:prSide,opponentId:opp,timer:prTimer,fearless:prFearless?{game:1,used:[]}:null});else startRealDraft(prSide,opp);}
 if(action==='lock-in')lockIn();
 if(action==='undo'){const u=undoStack.pop();if(u){state[u.type][u.index]=null;if(u.type==='allies')state.selectedRole=u.index;csKey=null;save();render();}}
 if(action==='draft-end'){if(practice)endPractice();else if(draftTurn(state).finished)endDraft();else confirmDialog('Cancel draft?','All picks and bans of this draft will be cleared.',()=>{endDraft();toast('Draft cancelled.');});}
 if(action==='practice-again'&&practice)startPractice({timer:practice.timer,side:state.side,opponentId:state.opponentId,fearless:state.fearless?{game:1,used:[]}:null});
 if(action==='practice-end')endPractice();
 if(action==='copy-discord')copyText(discordText(),'For Discord');
 if(action==='plan-regen')generatePlan(draftKey(),true);
 if(action==='save-game')saveGame();
 if(action==='analyze')analyze();
 if(action==='stop-analysis')analysisCtrl?.abort();
 if(action==='add-opponent'){const name=($('#new-opponent')?.value||'').trim().slice(0,40);if(!name){toast('Please enter a team name.',true);return;}if(state.opponents.length>=50){toast('You can have at most 50 opponent teams.',true);return;}const o={id:Date.now().toString(36),name,notes:'',favorites:[],region:'euw',players:emptyOppPlayers()};state.opponents.push(o);selectedOpponent=o.id;save();render();toast(`${name} added.`);}
 if(action==='toggle-active-opponent'){const o=selOpp();if(o){state.opponentId=state.opponentId===o.id?'':o.id;save();render();toast(state.opponentId?`${o.name} is active in the draft.`:'No opponent active in the draft.');}}
 if(action==='delete-opponent'){const o=selOpp();if(o)confirmDialog(`${o.name}: delete?`,'Notes and favorite champions of this team will be removed for everyone.',()=>{state.opponents=state.opponents.filter(x=>x.id!==o.id);if(state.opponentId===o.id)state.opponentId='';selectedOpponent='';save();render();toast('Opponent team deleted.');});}
 if(action==='add-fav'){const o=selOpp();const v=($('#fav-input')?.value||'').trim().toLowerCase();const c=catalog.champions.find(x=>x.name.toLowerCase()===v||x.id.toLowerCase()===v);if(!o)return;if(!c){toast('That champion does not exist. Choose one from the list.',true);return;}if(o.favorites.includes(c.id))return;if(o.favorites.length>=15){toast('At most 15 favorite champions.',true);return;}o.favorites.push(c.id);save();render();}
 if(action==='save-template'){const name=($('#template-name')?.value||'').trim().slice(0,40);if(!name){toast('Please give the template a name.',true);return;}if(state.templates.length>=20){toast('You can have at most 20 templates.',true);return;}const t={id:Date.now().toString(36),name,allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]};if(![...t.allies,...t.enemies,...t.bans].some(Boolean)){toast('The draft is still empty.',true);return;}state.templates.push(t);templatesOpen=true;save();render();toast(`Template “${name}” saved.`);}
 if(action==='reset-draft')confirmDialog('Clear draft?','All picks and bans will be removed. Team and champion pools stay.',()=>{endDraft();toast('Ready for a new draft.');});
 if(action==='close-picker')$('#picker').close();
 if(action==='clear-slot'){state[pickerTarget.type][pickerTarget.index]=null;save();$('#picker').close();render();}
 if(action==='room-open'){openRoomDialog();return;}
 if(action==='room-create'){createRoom();return;}
 if(action==='room-join'){joinRoom($('#room-code')?.value);return;}
 if(action==='room-copy'){copyRoomLink();return;}
 if(action==='room-leave'){confirmDialog('Leave the room?',room?.role==='host'?'Your team won\'t see new picks after that. The draft stays with you.':'You\'ll see your own data again afterwards.',()=>leaveRoom());return;}
 if(action==='scout-open'){openScout();return;}
 if(action==='cancel-confirm'){$('#confirm-dialog').close();confirmAction=null;}
 if(action==='confirm'){const fn=confirmAction;confirmAction=null;$('#confirm-dialog').close();fn?.();}
 if(action==='export')showExport();
 if(action==='copy-export'){const ta=$('#export-text');const fallback=()=>{ta.focus();ta.select();toast('Text is selected. Copy it with Ctrl+C or Cmd+C.');};try{navigator.clipboard.writeText(ta.value).then(()=>toast('Backup copied.'),fallback);}catch{fallback();}}
 if(action==='install'){const ev=installEvt;installEvt=null;render();if(ev){ev.prompt();ev.userChoice.catch(()=>{});}return;}
 if(action==='lang'){try{localStorage.setItem('riftroom.lang',document.documentElement.lang==='de'?'en':'de');}catch{}location.reload();return;}
 if(action==='no-ban'){const t=draftTurn(state),c=t.current;if(!c||c.type!=='ban'||(practice&&c.who!=='us'))return;const tg=stepTarget(c);if(!tg||tg.index==null)return;state.bans[tg.index]='none';if(!practice)undoStack.push(tg);hoverId=null;save();render();toast('No ban entered.');return;}
 if(action==='close-banner'){bannerClosed=true;render();return;}
 if(action==='hide-checklist'){guide.hide(true);render();toast('Checklist hidden. Use the ? at the top to bring the introduction back.');}
 if(action==='tour'){const n=el.dataset.tourName;if(n==='team'){page='team';saveUi();render();startTour('team',el.dataset.tourStep);}else helpTour();}
 if(action==='import-team')pickFile('team');
 if(action==='import-meta')pickFile('meta');
 if(action==='clear-meta')confirmDialog('Remove win rates?','The win rates will be removed from this browser.',()=>{state.meta=null;state.metaImported=false;save();render();if(STANDALONE)loadStatic();});
});
document.addEventListener('dblclick',e=>{const el=e.target.closest('[data-hover]');if(el&&!el.disabled){selectHover(el.dataset.hover);lockIn();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&hoverId&&e.target.id!=='cs-search'&&!['TEXTAREA','INPUT','SELECT','BUTTON'].includes(e.target.tagName)&&$('#cs-lock'))lockIn();});
document.addEventListener('keydown',e=>{
 const s=$('#cs-search');if(!s||tourRunning()||document.querySelector('dialog[open]')||viewerLocked())return;
 if(e.target===s&&e.key==='Enter'){e.preventDefault();const first=document.querySelector('#cs-grid .champ-btn:not([disabled])');if(!first)return;if(hoverId===first.dataset.hover)lockIn();else selectHover(first.dataset.hover);return;}
 if(e.target===s&&e.key==='Escape'){s.value='';csSearch='';const g=$('#cs-grid');if(g)g.innerHTML=csGrid();return;}
 // Einfach lostippen: Buchstaben landen in der Suche, ohne erst hineinzuklicken.
 if(e.key.length===1&&/[\p{L}\d]/u.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){s.focus();}
});
document.addEventListener('toggle',e=>{if(e.target.id==='fold-templates')templatesOpen=e.target.open;if(e.target.id==='bis'){bisOpen=e.target.open;saveBis();}},true);
document.addEventListener('input',e=>{const t=e.target;if(handleLobbyInput(t))return;if(handleMiniInput(t))return;if(t.id==='team-name'){state.teamName=t.value.trim()||'My Team';save();}if(t.dataset.playerName!=null){state.players[Number(t.dataset.playerName)].name=t.value.trim()||'Player '+(Number(t.dataset.playerName)+1);save();}if(t.id==='cs-search'){csSearch=t.value;const g=$('#cs-grid');if(g)g.innerHTML=csGrid();}if(t.id==='picker-search'){pickerSearch=t.value;renderPickerGrid();}if(t.id==='meta-search'){metaSearch=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='opp-notes'){const o=selOpp();if(o){o.notes=t.value.slice(0,4000);save();}}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.playerRiot!=null){const i=Number(t.dataset.playerRiot),v=t.value.trim().replace(/\s*#\s*/,'#').slice(0,40);t.value=v;state.players[i].riotId=v;save();if(v&&!validRiotId(v))toast('A Riot ID looks like this: Name#Tag, e.g. Faker#KR1.',true);else if(v&&STANDALONE){riotStart('team',i);const b=document.querySelector('[data-riot-res="team|'+i+'"]');if(b)b.innerHTML=riotInner('team',i);}return;}if(t.id==='team-region'){if(OPP_REGIONS.includes(t.value)){state.riotRegion=t.value;save();render();}return;}if(t.dataset.oppRiot!=null){const o=selOpp();if(o){const v=t.value.trim().replace(/\s*#\s*/,'#').slice(0,40);o.players[Number(t.dataset.oppRiot)].riotId=v;save();render();if(STANDALONE&&validRiotId(v))riotStart('opp',Number(t.dataset.oppRiot));if(v&&!/^[^#]{3,16}#[^#\s]{2,5}$/.test(v))toast('A Riot ID looks like this: Name#Tag, e.g. Faker#KR1. Without the tag op.gg cannot find the profile.',true);}return;}if(t.id==='opp-region'){const o=selOpp();if(o&&OPP_REGIONS.includes(t.value)){o.region=t.value;save();render();}return;}if(t.id==='opp-name'){const o=selOpp();if(o&&t.value.trim()){o.name=t.value.trim().slice(0,40);save();render();}}if(t.id==='draft-opponent'){state.opponentId=t.value;save();render();}if(t.id==='picker-role'){pickerRole=t.value;renderPickerGrid();}if(t.id==='pool-only'){state.poolOnly=t.checked;save();render();}if(t.id==='meta-role'){metaRole=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='meta-sort'){metaSort=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='team-name'){state.teamName=t.value.trim()||'My Team';save();render();}if(t.dataset.playerName!=null){state.players[Number(t.dataset.playerName)].name=t.value.trim()||`Player ${Number(t.dataset.playerName)+1}`;save();}});
document.addEventListener('submit',e=>{if(handleMiniSubmit(e))return;if(e.target.id!=='settings-form')return;e.preventDefault();try{const patch=$('#target-patch').value.trim();if(patch&&!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(patch))throw Error('Please enter the patch as 16.20 or 16.20.1.');state.targetPatch=patch;save();render();toast(patch?`Target patch ${patch} saved.`:'Target patch follows the current patch again.');}catch(err){$('#settings-error').textContent=err.message;}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('.lock-splash')){e.target.remove();return;}if(e.target.tagName==='IMG'&&e.target.src.includes('/img/ld/')){e.target.src=e.target.src.replace('/img/ld/','/img/sq/');return;}if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='icon.svg';e.target.style.objectFit='contain';e.target.style.opacity='.5';}},true);

function init(){
 catalog=structuredClone(BUNDLED_CATALOG);
 let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 if(saved){try{state=validateState(saved,catalog);}catch{toast('Saved data could not be loaded. Example profiles are active.',true);}}
 try{const u=JSON.parse(localStorage.getItem(uiKey));if(u&&PAGES[u.page])page=u.page;if(u&&META_TABS.some(([k])=>k===u.metaTab))metaTab=u.metaTab;}catch{}
 initGuide({page:()=>page,go:k=>{page=k;saveUi();render();window.scrollTo({top:0,behavior:'instant'});},onEnd:()=>{if(page==='draft'&&!draftStarted())render();}});
 render();connect();
 if(STANDALONE)resumeRoom();
 // Einladung in eine Minispiel-Lobby per Link.
 const lb=STANDALONE?new URLSearchParams(location.search).get('lobby'):null;
 if(lb&&openLobbyLink(lb,lbCtx)){page='mini';miniTab='lobby';render();}
}
init();

// Mehr-Menü schließen, wenn außerhalb geklickt oder Escape gedrückt wird.
document.addEventListener('click',e=>{for(const d of document.querySelectorAll('details.more[open]'))if(!d.contains(e.target))d.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='room-code'){e.preventDefault();joinRoom(e.target.value);}if(e.key==='Enter'&&e.target.id==='lb-code'){e.preventDefault();document.querySelector('[data-lb="join"]')?.click();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of document.querySelectorAll('details.more[open]'))d.open=false;});
