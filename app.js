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
 addEventListener('appinstalled',()=>{installEvt=null;if(catalog)render();toast('Riftroom ist installiert. Du findest es jetzt bei deinen Programmen.');});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={swap:'M7 4 3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',close:'m6 6 12 12 M6 18 18 6',plus:'M12 5v14 M5 12h14',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',upload:'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',chevrondown:'m6 9 6 6 6-6',trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15',map:'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',timer:'M12 8v5l3 2 M9 2h6 M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0',copy:'M8 8h12v12H8z M16 8V4H4v12h4',play:'M7 4v16l13-8z',book:'M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z M8 20a4 4 0 0 1 0-8h10',back:'M15 18l-6-6 6-6',refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M18 17a7 7 0 0 1-12 2l-2-3'};
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
const MINI_GAMES=[['lobby','Mit Freunden','Teemo','1 gegen 1 bis 4 Spieler'],['counter','Counter-Puzzle','Yasuo','Finde den besten Konter'],['daily','Tägliches Puzzle','Ahri','Für alle gleich, mit Rangliste'],['whowins','Wer gewinnt?','Jinx','Zwei Drafts, ein Favorit'],['ban','Ban-Puzzle','Zed','Welcher Ban tut am meisten weh?'],['macro','Macro-Quiz','Nautilus','Der beste Play auf der Karte'],['timer','Timer-Quiz','Zilean','Respawns und Flash im Kopf'],['guess','Champion raten','Neeko','Buchstabe für Buchstabe']];
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
const pzCtx={friendsBtn:g=>`<button class="btn pz-friends" data-lobby-new="${g}">${icon('users')}Mit Freunden spielen</button>`,catalog:()=>catalog,meta:()=>state.meta,esc:v=>esc(v),cname:id=>cname(id),SQUARE,LOADING,toast:(m,e)=>toast(m,e),burst:(h,n)=>burst(h,n),board:dailyBoard,rerender:()=>{if(page==='mini')render();}};
function renderMiniPage(){
 const st=miniStats();
 const tiles=`<div class="game-hub" role="tablist" aria-label="Minispiele">${MINI_GAMES.map(([k,l,art,sub],i)=>`<button class="game-tile ${miniTab===k?'on':''} ${k==='lobby'?'mp':''}" role="tab" aria-selected="${miniTab===k}" data-minitab="${k}" style="--i:${i}"><img src="${LOADING[art]}" alt=""><span class="gt-text"><b>${l}</b><small>${k==='lobby'&&lobbyInfo()?'Lobby '+esc(lobbyInfo()):st[k]?esc(st[k]):sub}</small></span>${k==='daily'&&st.daily!=='Erledigt'?'<i class="gt-new">Neu</i>':''}</button>`).join('')}</div>`;
 return tiles+(miniTab==='guess'?renderMini(miniCtx):miniTab==='lobby'?renderLobby(lbCtx):renderPuzzle(miniTab,pzCtx));
}
const miniCtx={catalog:()=>catalog,esc:v=>esc(v),portrait:id=>portrait(id,'av'),toast:(m,e)=>toast(m,e),rerender:()=>{if(page==='mini')render();}};
const setMiniTab=t=>{miniTab=t;try{localStorage.setItem('riftroom.minitab',t);}catch{}if(page==='mini'){render();window.scrollTo({top:0,behavior:'instant'});}};
const lbCtx={esc:v=>esc(v),LOADING,SQUARE,icon:n=>icon(n),toast:(m,e)=>toast(m,e),burst:(h,n)=>burst(h,n),standalone:STANDALONE,rerender:()=>{if(page==='mini')render();},setTab:setMiniTab,tab:()=>miniTab,page:()=>page,pz:pzCtx,mg:miniCtx};
if(STANDALONE)setSupabase(()=>loadSb());
const MAIN_PAGES={draft:'Draft',team:'Team',opponents:'Gegner',meta:'Meta'};
const MORE_PAGES={games:'Ergebnisse',mini:'Minispiele',settings:'Daten & Sicherung'};
const PAGES={...MAIN_PAGES,...MORE_PAGES};
const META_TABS=[['pool','Euer Pool'],['bans','Bans'],['trends','Trends'],['all','Alle Champions']];

const champ=id=>catalog?.champions.find(c=>c.id===id);
const cname=id=>id==='none'?'Kein Ban':champ(id)?.name||id;
// Suche: ohne Akzente, Leerzeichen und Apostrophe, plus gängige Kürzel aus der Community.
const ALIAS={MissFortune:'mf',TwistedFate:'tf',JarvanIV:'j4 jarvan',AurelionSol:'asol',KogMaw:'kog',XinZhao:'xin',Warwick:'ww',Leblanc:'lb',Gangplank:'gp',TahmKench:'tk tahm',RekSai:'rek',MasterYi:'yi',DrMundo:'mundo',Heimerdinger:'heimer donger',Kassadin:'kassa',Katarina:'kat',Lissandra:'liss',Malzahar:'malz',Nocturne:'noc',Sejuani:'sej',Tristana:'trist',Vladimir:'vlad',Volibear:'voli',Ezreal:'ez',Caitlyn:'cait',LeeSin:'lee',Cassiopeia:'cass cassio',Morgana:'morg',Blitzcrank:'blitz',Fiddlesticks:'fid fiddle',MonkeyKing:'wukong wu',Chogath:'cho',Khazix:'kha',Velkoz:'vel',Kaisa:'kai',Belveth:'bel',Renata:'glasc',Seraphine:'sera',Orianna:'ori',Hecarim:'hec',Mordekaiser:'morde',Pantheon:'panth',Tryndamere:'trynd',Aphelios:'aph',Malphite:'malph',Nautilus:'naut',Soraka:'raka',Renekton:'renek croc',Evelynn:'eve',Alistar:'ali',Nidalee:'nid',Maokai:'mao',Yasuo:'yas',Zilean:'zil',Taliyah:'tali',Viktor:'vik',Gragas:'grag'};
const normQ=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function champMatch(c,q){const n=normQ(q);if(!n)return 0;const nm=normQ(c.name),id=normQ(c.id);
 if(nm.startsWith(n)||id.startsWith(n))return 3;if((ALIAS[c.id]||'').split(' ').some(a=>a.startsWith(n)))return 3;
 if(c.name.split(/[\s.']+/).some(w=>normQ(w).startsWith(n)))return 2;if(nm.includes(n)||id.includes(n))return 1;return 0;}
const searchChamps=(list,q)=>list.map(c=>[c,champMatch(c,q)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]||a[0].name.localeCompare(b[0].name,'de')).map(x=>x[0]);
const portrait=(id,cls='av')=>`<img class="${cls}" src="${SQUARE[id]||'icon.svg'}" alt="" loading="lazy">`;
const date=v=>v?new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'noch nie';
const pct=v=>v.toFixed(1).replace('.',',')+' %';
const int=n=>Number(n).toLocaleString('de-DE');
const deltaTag=d=>d==null?'<span></span>':`<span class="tag ${d<=-1?'warn':d>=1?'good':''}">${d>0?'+':''}${d.toFixed(1).replace('.',',')}</span>`;
const head=(title,sub='',actions='')=>`<div class="page-head"><div><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div>${actions?`<div class="head-actions">${actions}</div>`:''}</div>`;

function toast(message,error=false){const t=$('#toast');clearTimeout(toastTimer);t.textContent=message;t.className=`show ${error?'error':''}`;toastTimer=setTimeout(()=>t.className='',error?8000:4000);}
function save(){if(room?.role==='viewer')return;if(practice){queueMicrotask(practiceCheck);return;}queueRoomPush();clearTimeout(backupTimer);backupTimer=setTimeout(pushBackup,3000);try{localStorage.setItem(storageKey,JSON.stringify({...state,catalog:null}));}catch{toast('Der Browserspeicher ist voll oder gesperrt. Sichere dein Team unter „Daten“.',true);}}
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
 if(x.kind==='main')return x.n?`${ROLE_NAMES[x.role]}-Main · ${x.n} ${x.n===1?'Spiel':'Spiele'}, ${Math.round(x.pw)} %`:`${ROLE_NAMES[x.role]}-Main${x.wr!=null?' · '+pct(x.wr):''}`;
 if(x.kind==='fav')return`Team-Favorit${x.wr!=null?' · '+pct(x.wr):''}`;
 if(x.kind==='counter')return`Konter gegen ${cname(x.vs)} (${pct(x.wr)})`;
 return`Stark im Meta · ${pct(x.wr)}`;
}
// Ist ein Champion schon als Main begründet, ist „stark im Meta“ doppelt: dann weglassen.
const banNote=b=>{const own=b.notes.some(x=>x.kind==='main'||x.kind==='fav');return[...new Set(b.notes.filter(x=>!(own&&x.kind==='meta')).slice(0,2).map(banWhy))].join(' · ');};
// „Kein Ban nötig“: Gegner-Mains, die gerade schwach sind oder vom Spieler selbst kaum gewonnen werden.
const skipWhy=x=>x.n>=5?`${x.n} Spiele, nur ${Math.round(x.pw)} % Siege`:x.offmeta?(x.role?`auf ${ROLE_NAMES[x.role]} kaum gespielt`:'kaum gespielt'):`gerade schwach, ${pct(x.wr)}`;
const skipHtml=sk=>sk.length?`<p class="fine ban-skip">Kein Ban nötig: ${sk.slice(0,3).map(x=>`<b>${esc(cname(x.id))}</b> (${skipWhy(x)})`).join(', ')}.</p>`:'';
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
 return`<div class="banner closable"><span>${esc(refreshMessage)}</span><button class="icon-btn" data-action="close-banner" aria-label="Hinweis schließen">${icon('close')}</button></div>`;
}
function render(){
 syncEngine();
 const st=status(),m=state.meta;
 const newPatch=m&&catalog&&state.seenPatch!==shortPatch(catalog.version);
 const inMore=page in MORE_PAGES;
 const nav=Object.entries(MAIN_PAGES).map(([k,l])=>`<button class="tab ${page===k?'on':''}" data-page="${k}" ${page===k?'aria-current="page"':''}>${l}${k==='meta'&&newPatch?'<span class="new-dot" title="Neuer Patch"></span>':''}</button>`).join('')
  +`<details class="more"><summary class="tab ${inMore?'on':''}">${inMore?`<span class="more-full">${MORE_PAGES[page]}</span><span class="more-short">Mehr</span>`:'Mehr'}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></summary><div class="more-menu">${Object.entries(MORE_PAGES).map(([k,l])=>`<button class="more-item ${page===k?'on':''}" data-page="${k}" ${page===k?'aria-current="page"':''}>${l}</button>`).join('')}</div></details>`;
 const chip=st.ok?`<span class="chip ok" title="Winrates von ${esc(m.source)}, Stand ${date(m.updatedAt)}"><span class="dot"></span>Patch ${esc(shortPatch(currentPatch()))}${st.fallback?` · Winrates ${esc(shortPatch(m.patch))}`:''}</span>`:`<span class="chip" title="${refreshMessage.startsWith('Offline')?esc(refreshMessage):''}"><span class="dot"></span>${m?esc(st.label):refreshMessage.startsWith('Offline')?'Offline':'Keine Winrates'}</span>`;
 const views={plan:renderPlan,draft:renderDraft,meta:renderMeta,opponents:renderOpponents,team:renderTeam,games:renderGames,mini:renderMiniPage,settings:renderSettings};
 app.innerHTML=`<header class="top"><div class="top-in"><button class="brand" data-page="draft"><img src="icon.svg" alt="">Riftroom</button><nav class="tabs" aria-label="Hauptnavigation">${nav}</nav><div class="top-right">${chip}${installEvt?`<button class="install-btn" data-action="install" title="Riftroom als App installieren">${icon('download')}<span>App</span></button>`:''}<button class="lang-btn" data-action="lang" title="Switch to English" aria-label="Sprache: Deutsch. Auf Englisch umstellen">EN</button><button class="help-btn" data-action="tour" title="Einführung ansehen" aria-label="Einführung ansehen">?</button></div></div></header>
 <main class="page ${page!==lastPageRendered?'enter':''}">${bannerHtml()}${roomBarHtml()}<div class="page-body ${room?.role==='viewer'?'viewer':''}" ${viewerLocked()?'inert':''}>${views[page]()}</div></main>
 <footer class="foot"><div class="foot-in">Fan-Projekt. Riot Games does not endorse or sponsor this project. <button class="link" data-page="settings">Datenquellen und Rechtliches</button></div></footer>`;
 placeTabInk();decorateEmpty();
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
 const sub=`${state.side==='red'?'Rote':'Blaue'} Seite · gegen ${esc(opp?.name||(practice?'den Computer':'Gegner'))}${practice?' · Übung':''}${state.fearless?` · Fearless Spiel ${state.fearless.game}`:''}`;
 const actions=(t.finished?`<button class="btn small primary" data-page="plan">${icon('map')}Spielplan</button><button class="btn small" data-action="copy-discord">${icon('copy')}Für Discord</button>${practice?'':'<button class="btn small" data-action="log-game">Spiel eintragen</button>'}`:'')
  +(!practice&&undoStack.length&&!t.finished?`<button class="btn small" data-action="undo">${icon('back')}Rückgängig</button>`:'')
  +`<button class="btn ghost small" data-action="draft-end">${t.finished?'Neuer Draft':practice?'Übung beenden':'Abbrechen'}</button>`;
 // Phase
 const verb=t.finished?'Draft komplett':`${c.who==='us'?'Ihr':'Gegner'} ${c.type==='ban'?'bannt':'pickt'}`;
 const hint=t.finished?'Alle Picks stehen. Zeit für den Spielplan.':aiTurn?'Der Computer überlegt …':c.who==='them'&&!practice?`${c.type==='ban'?'Ban':'Pick'} ${c.n} von 5 · tragt ein, was der Gegner wählt`:`${c.type==='ban'?'Ban':'Pick'} ${c.n} von 5`;
 const steps=t.steps.map(s=>`<span class="step ${s.side==='B'?'b':'r'} ${s.done?'done':''} ${c&&c.i===s.i?'now':''}" title="${s.who==='us'?'Ihr':'Gegner'} · ${s.type==='ban'?'Ban':'Pick'} ${s.n}">${s.type==='ban'?'B':'P'}${s.n}</span>`).join('');
 const left=practice?.deadline?Math.max(0,practice.deadline-Date.now()):null;
 const timer=left!=null?`<div class="cs-timer"><span id="practice-time" class="num">${Math.ceil(left/1000)}</span><div class="timer-bar"><i id="practice-bar" style="width:${left/300}%"></i></div></div>`:'';
 const pk=t.finished?'done':String(c.i),changed=lastPhaseKey!==null&&pk!==lastPhaseKey,prevWho=lastPhaseWho;
 const fx=changed?(t.finished?'swap':c.who==='us'&&prevWho==='them'?'swap yourturn':'swap'):'';
 if(changed&&t.finished)setTimeout(()=>burst(document.querySelector('.cs-done-in'),46),60);
 lastPhaseKey=pk;lastPhaseWho=c?.who||null;
 const phase=`<section class="cs-phase side-${t.finished?ours:sideOf(c.who)} ${t.finished?'done':''} ${fx}">${fx.includes('yourturn')?'<span class="yt-tag">Ihr seid dran</span>':''}<div class="cs-phase-main"><strong>${verb}</strong><span>${hint}</span>${!t.finished&&!aiTurn?`<span class="cs-focus">${icon('spark')}${esc(focusTip(c))}</span>`:''}</div>${timer}<div class="steps">${steps}</div><div class="steps-compact"><span>${t.finished?'Fertig':`Schritt ${c.i+1} von ${t.steps.length}`}</span><div class="steps-bar"><i style="width:${(t.finished?t.steps.length:c.i)/t.steps.length*100}%"></i></div></div></section>`;
 // Bans
 const ban=i=>{const id=state.bans[i],act=tgt?.type==='bans'&&tgt.index===i;return`<span class="cs-ban ${id?'filled':''} ${id==='none'?'none':''} ${act?'active':''} ${isNew('bans',i)?'just':''}" title="${id?esc(cname(id)):act?'Ban läuft':'Ban '+(i%5+1)}">${id==='none'?'<span class="no-ban">–</span>':id?portrait(id,''):act&&hoverId?`<img class="ghost" src="${SQUARE[hoverId]||'icon.svg'}" alt="">`:''}</span>`;};
 const bans=`<div class="cs-bans"><div class="cs-ban-row side-${ours}">${[0,1,2,3,4].map(ban).join('')}</div><span class="fine">Bans</span><div class="cs-ban-row side-${theirs} rev">${[5,6,7,8,9].map(ban).join('')}</div></div>`;
 const html=head('Draft',sub,actions)+phase+bans+flUsedHtml()+`<div class="cs-grid-wrap">${teamColumn('allies',ours,tgt,t)}${renderCenter(t,c,tgt,aiTurn)}${teamColumn('enemies',theirs,tgt,t)}</div>`+renderDraftExtras();
 lastBoard={allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]};lastComp=composition(state.allies);
 return html;
}
// Welche Pool-Champions eines Spielers noch frei sind. Ab höchstens einem freien kommt eine Warnung.
function poolStatus(i){
 const pool=state.players[i].pool;if(!pool.length)return'';
 const tk=taken(),free=pool.filter(v=>!tk.has(v.id)).length,warn=free<=1;
 const imgs=pool.slice(0,5).map(v=>`<img src="${SQUARE[v.id]}" alt="" class="${tk.has(v.id)?'gone':''}" title="${esc(cname(v.id))}${tk.has(v.id)?' (weg)':''}">`).join('');
 return`<span class="cs-pool ${warn?'warn':''}" title="${free} von ${pool.length} Pool-Champions frei"><span class="cs-pool-imgs">${imgs}</span><span class="cs-pool-n">${warn?'! ':''}${free}/${pool.length}</span></span>`;
}
function teamColumn(type,side,tgt,t){
 const list=state[type],us=type==='allies',enemyInfo=us?null:roleInfo(state.enemies);
 const rows=list.map((id,i)=>{
  const pv=t.current?.type==='pick'&&tgt?.type===type&&pickRole!=null&&!list[pickRole]?pickRole:tgt?.index;
  const act=tgt?.type===type&&pv===i,canTarget=!t.finished&&!id&&t.current?.type==='pick'&&t.current.who===(us?'us':'them')&&!(practice&&!us);
  const prev=act&&hoverId?hoverId:null,img=id||prev;
  const mu=!us&&id&&state.matchups[id];
  const name=id?esc(cname(id)):prev?esc(cname(prev)):act?'wählt …':'';
  const who=us?esc(state.players[i].name):ROLE_NAMES[ROLES[i]];
  const fx=!us&&id?enemyInfo.flex.get(i):null;
  const ps=us&&!id&&!t.finished?poolStatus(i):'';
  const attrs=canTarget?`data-cs-target="${type}|${i}"`:t.finished&&!practice?`data-picker="${type}" data-index="${i}"`:'';
  return`<div data-slot="${type}|${i}" class="cs-row ${id?'filled':''} ${act?'active':''} ${isNew(type,i)?'just':''}">${attrs?`<button class="cs-row-btn" ${attrs} aria-label="${us?'Euer':'Gegner'} ${ROLE_NAMES[ROLES[i]]}${id?': '+esc(cname(id)):''}"></button>`:''}${img?`<img class="cs-splash ${prev&&!id?'ghost':''}" src="${LOADING[img]||SQUARE[img]||'icon.svg'}" alt="">`:''}<div class="cs-row-text"><span class="role-label">${ROLE_NAMES[ROLES[i]]}${fx?'?':''}</span><strong>${name||'<span class="muted">—</span>'}</strong>${us?`<span class="fine">${who}</span>`:''}${us?wishChip(i):''}${fx?`<span class="flex-note" title="Kann mehrere Rollen spielen. Erst später sicher, welche."><i class="flex-tag">Flex</i>${fx.map(r=>ROLE_NAMES[r]).join(' / ')}</span>`:''}${ps}</div>${id?`<button class="cs-swap" data-swap="${type}|${i}" title="Rolle tauschen oder Pick ändern" aria-label="${esc(cname(id))}: Rolle tauschen oder Pick ändern">${icon('swap')}</button>`:''}${!us&&id?`<button class="cs-mu ${mu?'has':''}" data-mu-edit="${id}" title="${mu?esc(mu):'Matchup-Notiz zu '+esc(cname(id))}" aria-label="Matchup-Notiz zu ${esc(cname(id))}">${icon('book')}</button>`:''}</div>`;}).join('');
 return`<section class="cs-team side-${side} ${us?'ours':'theirs'}"><div class="cs-team-head"><span class="side-tag ${side}">${esc(us?state.teamName:(activeOpp()?.name||'Gegner'))}</span></div>${rows}</section>`;
}
// Vorschläge für den aktuellen Schritt.
// Kurze Begründung für Pick-Vorschläge, z. B. „passt zum Pool (4/5) · ergänzt Engage“.
const WHY=new Map([['Frontline','bringt Frontline'],['Engage','ergänzt Engage'],['Magischer Schaden','es fehlt magischer Schaden'],['Physischer Schaden','es fehlt physischer Schaden'],['Schützt Carries','schützt eure Carries'],['Peel gegen Engage','Peel gegen ihren Engage'],['Scaling gegen Frontline','skaliert gegen ihre Frontline'],['Alternative','solide Alternative']]);
const why=(x,r)=>{const m=/(\d)\/5$/.exec(x);if(m)return`passt zum Pool (${m[1]}/5)`;if(x==='Matchup+'&&r?.matchup)return`gewinnt die Lane gegen ${cname(r.matchup.foe)} (${pct(r.matchup.wr)})`;if(x==='Matchup-'&&r?.matchup)return`schwer gegen ${cname(r.matchup.foe)} (${pct(r.matchup.wr)})`;if(x==='Off-Meta')return'auf dieser Rolle kaum gespielt';if(x==='Nische')return'auf dieser Rolle selten gespielt';return WHY.get(x)||x;};
function stepSuggestions(c,tgt){
 const tk=taken(),byId=new Map(catalog.champions.map(x=>[x.id,x])),st=status(),meta=st.ok?state.meta:null,opp=activeOpp();
 if(c.type==='ban'&&c.who==='us'){
  // Nur Rollen bannen, die der Gegner noch nicht sicher besetzt hat. Schwache Mains werden als „kein Ban nötig“ erklärt.
  const info=roleInfo(state.enemies),plan=banList(5);
  const filled=ROLES.filter(r=>info.certain.has(r));
  return{title:filled.length?`Ban-Vorschläge für offene Rollen`:'Ban-Vorschläge',items:plan.items.map(x=>({id:x.id,note:banNote(x)})),after:skipHtml(plan.skipped)};
 }
 const ri=c.type==='pick'&&pickRole!=null?pickRole:tgt.index;
 if(c.who==='us'){const recs=rec({...state,selectedRole:ri,poolOnly:false}).slice(0,5);return{title:`Empfohlen für ${ROLE_NAMES[ROLES[ri]]}`,items:recs.map((r,k)=>({id:r.id,score:r.score,top:k<3,note:r.reasons.slice(0,k<3?2:1).map(x=>why(x,r)).join(' · ')}))};}
 const mains=c.type==='pick'?(opp?.players[ri]?.champs||[]):oppAll(opp);
 const items=mains.filter(id=>!tk.has(id)).map(id=>({id,note:'Main'}));
 return{title:opp?`Typisch für ${esc(opp.name)}`:'',items:items.slice(0,5)};
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
  if(enemy.certain.has(r)){score+=3;reasons.push(foe?`Konter möglich gegen ${cname(foe)}`:'Konter möglich: Gegner-Rolle steht fest');}
  const pool=state.players[i].pool,free=pool.filter(v=>!tk.has(v.id)).length;
  if(pool.length&&free<=1){score+=3;reasons.push(free?'Pool fast leer: nur noch 1 frei':'Pool leer: schnell sichern');}
  else if(pool.length&&free===2){score+=1;reasons.push('Pool wird knapp: 2 frei');}
  const blindLate=!enemy.certain.has(r)&&picksDone<3&&BLIND[r]<1;
  if(!enemy.certain.has(r)&&picksDone<3){score+=BLIND[r];if(BLIND[r]>=1)reasons.push('Sicherer Blind-Pick');}
  const best=rec({...state,selectedRole:i,poolOnly:false})[0];
  if(best&&best.score>=75){score+=1;reasons.push(`Starker Pick frei: ${cname(best.id)}`);}
  if(!reasons.length)reasons.push(blindLate?'Lieber später, sonst leicht zu kontern':'Offen');
  return{i,score,reasons};
 }).sort((a,b)=>b.score-a.score||a.i-b.i);
}
function renderCenter(t,c,tgt,aiTurn){
 if(t.finished)return`<section class="card cs-center cs-done"><div class="cs-done-in">${icon('map','big')}<h2>Draft komplett</h2><p class="fine">Auf dem Spielplan seht ihr die Karte mit allen Champions und kurze Notizen für jede Position.</p><button class="btn primary" data-page="plan">Spielplan öffnen</button>${state.fearless&&room?.role!=='viewer'?flNextHtml():''}${practice?'<button class="btn ghost small" data-action="practice-again">Nochmal üben</button>':''}</div></section>`;
 if(room?.role==='viewer'&&c.who!=='us')return`<section class="card cs-center cs-wait"><div class="cs-done-in"><div class="spinner"></div><p>${c.who==='us'?`${esc(state.teamName)} ${c.type==='ban'?'bannt':'pickt'} …`:`${esc(state.teamName)} trägt ${c.type==='ban'?'den Gegner-Ban':'den Gegner-Pick'} ein …`}</p><p class="fine">Du schaust live zu. Jeder Ban und Pick erscheint sofort.</p></div></section>`;
 if(aiTurn)return`<section class="card cs-center cs-wait"><div class="cs-done-in"><div class="spinner"></div><p>Der Computer ${c.type==='ban'?'bannt':'pickt'} …</p></div></section>`;
 const sug=stepSuggestions(c,tgt);
 const adv=c.who==='us'&&c.type==='pick'?roleAdvice():[],curRole=pickRole!=null?pickRole:tgt?.index;
 const advHtml=adv.length?`<div class="role-adv"><span class="label">Welche Rolle jetzt picken?</span><div class="role-adv-row">${adv.map((x,k)=>`<button class="ra ${k===0?'best':''} ${x.i===curRole?'on':''}" data-ra="${x.i}" aria-pressed="${x.i===curRole}">${k===0?'<i class="ra-star" aria-hidden="true">★</i>':''}<b>${ROLE_NAMES[ROLES[x.i]]}</b><small>${esc(x.reasons[0])}</small></button>`).join('')}</div></div>`:'';
 const sugHtml=`<div id="team-wish">${teamWishHtml(c)}</div>`+advHtml+(sug.title&&sug.items.length?`<div class="cs-sug"><span class="label">${sug.title}</span><div class="cs-sug-row">${sug.items.map(x=>`<button class="cs-sug-item ${hoverId===x.id?'on':''}" data-hover="${x.id}" title="${esc(x.note)}">${portrait(x.id,'av sm')}<span><b>${esc(cname(x.id))}${c.type==='pick'&&(profileOf(x.id)?.roles.length||0)>1?'<i class="flex-tag" title="Kann mehrere Rollen spielen">Flex</i>':''}</b><small class="${x.top?'why':''}">${esc(x.note)}</small></span>${x.score!=null?`<span class="mini-score">${x.score}</span>`:''}</button>`).join('')}</div>${sug.after||''}</div>`:'');
 const roles=['ALL',...ROLES];
 return`<section class="card cs-center">${sugHtml}<div class="cs-filter"><div class="search">${icon('search')}<input class="field" id="cs-search" placeholder="Champion suchen" value="${esc(csSearch)}" autocomplete="off" aria-label="Champion suchen"></div><button class="pool-toggle" data-cs-pool aria-pressed="${csPoolOnly}" title="Nur Champions aus euren Pools zeigen">Nur Pools</button><div class="seg cs-roles" role="group" aria-label="Rolle">${roles.map(r=>`<button data-cs-role="${r}" aria-pressed="${csRole===r}">${r==='ALL'?'Alle':ROLE_NAMES[r]}</button>`).join('')}</div></div><div class="cs-champs" id="cs-grid">${csGrid()}</div><div class="cs-lock" id="cs-lock">${lockBar()}</div></section>`;
}
function csGrid(){
 const tk=taken(),q=csSearch.trim().toLowerCase();
 const pools=csPoolOnly?new Set(state.players.flatMap(p=>p.pool.map(v=>v.id))):null;
 const base=[...catalog.champions].filter(c=>!pools||pools.has(c.id));
 const list=q?searchChamps(base,q):base.filter(c=>csRole==='ALL'||profileOf(c.id)?.roles.includes(csRole)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 const fl=new Set(state.fearless?.used||[]);
 return list.map(c=>`<button class="champ-btn ${hoverId===c.id?'on':''} ${fl.has(c.id)?'fl':''}" data-hover="${c.id}" ${tk.has(c.id)?'disabled':''} aria-label="${esc(c.name)}${tk.has(c.id)?' (vergeben)':''}">${portrait(c.id,'')}<span>${esc(c.name)}</span></button>`).join('')||'<div class="no-results">Kein Champion gefunden.</div>';
}
function lockBar(){
 const t=draftTurn(state),c=t.current;if(!c)return'';
 if(room?.role==='viewer')return viewerLockBar(c);
 const verb=c.type==='ban'?(c.who==='us'?'Bannen':'Gegner-Ban eintragen'):(c.who==='us'?'Picken':'Gegner-Pick eintragen');
 const noBan=c.type==='ban'&&!(practice&&c.who!=='us')?`<button class="btn ghost small" data-action="no-ban" title="Wenn kein Champion gebannt wurde">Kein Ban</button>`:'';
 if(!hoverId)return`<span class="fine">Wähle einen Champion. Doppelklick bestätigt direkt.</span><span class="lock-actions">${noBan}<button class="btn primary" disabled>${verb}</button></span>`;
 const tgL=stepTarget(c),isPick=c.type==='pick',type=c.who==='us'?'allies':'enemies',pr=isPick?(pickRole??tgL.index):null;
 const roleSel=isPick?`<div class="pick-roles"><span class="fine">${c.who==='us'?'Für welche Rolle?':'Welche Rolle?'}</span><div class="seg" role="group" aria-label="Rolle für diesen Pick">${openSlots(type).map(i=>`<button data-pick-role="${i}" aria-pressed="${pr===i}">${ROLE_NAMES[ROLES[i]]}</button>`).join('')}</div></div>`:'';
 let info='';
 const pf=profileOf(hoverId),flex=pf&&pf.roles.length>1?`Flex: ${pf.roles.map(r=>ROLE_NAMES[r]).join('/')}`:'';
 if(c.who==='us'&&c.type==='pick'){const pa=previewAllies(),a0=composition(state.allies),a1=pa?composition(pa):a0,gains=[['front','Frontline'],['engage','Engage'],['peel','Peel']].filter(([k])=>a1[k]>a0[k]).map(([k,l])=>`${l} +${a1[k]-a0[k]}`),r=rec({...state,selectedRole:pr,poolOnly:false}).find(x=>x.id===hoverId);info=[r?`Passung ${r.score}`:'',r?.stat?`${pct(r.stat.wins/r.stat.games*100)} WR`:'',r?.matchup?`${pct(r.matchup.wr)} gegen ${cname(r.matchup.foe)}`:'',...gains,flex].filter(Boolean).join(' · ');}
 else if(state.meta){const e=state.meta.entries.filter(x=>x.champion===hoverId).sort((a,b)=>b.games-a.games)[0];if(e)info=`${pct(e.wins/e.games*100)} WR · ${ROLE_NAMES[e.role]}${e.banRate!=null?` · Banrate ${pct(e.banRate)}`:''}`;}
 if(!info&&flex)info=flex;
 const v2=isPick?`${verb} als ${ROLE_NAMES[ROLES[pr]]}`:verb;
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
 if(taken().has(hoverId)){toast('Dieser Champion ist schon vergeben.',true);return;}
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
  const status=x=>x===0?'fehlt':x<5?'vorhanden':'stark';
  const diff=pv?pv[key]-v:0;
  return`<div class="meter"><div class="meter-top"><span>${label}</span><span class="muted">${diff>0?`<b class="gain">+${diff}</b> `:''}${status(pv?pv[key]:v)}</span></div><div class="pips">${[0,1,2,3,4].map(k=>`<i class="${k<cur?'on':k<nv?'next':''}${k<cur&&k>=p&&!pv?' pop':''}" style="--d:${(k-p)*70}ms"></i>`).join('')}</div></div>`;};
 const dmg=[['physical','phys','Physisch'],['magic','magic','Magisch'],['mixed','mixed','Gemischt']],d=pv||comp;
 return`<div class="card-head"><h2>Komposition</h2><span class="muted">${pv?`<span class="tag good">Vorschau</span>`:`${comp.count} / 5`}</span></div><div class="comp">${meter('Frontline',comp.front,'front')}${meter('Engage',comp.engage,'engage')}${meter('Peel',comp.peel,'peel')}<div class="dmg"><div class="dmg-legend">${dmg.map(([k,c,l])=>`<span><i class="${c}"></i>${l} ${d[k]}</span>`).join('')}</div><div class="dmg-bar">${d.known?dmg.filter(([k])=>d[k]).map(([k,c])=>`<span class="${c}" style="flex:${d[k]}"></span>`).join(''):''}</div></div></div>`;
}
function renderDraftExtras(){
 const compCard=`<section class="card" id="comp-card">${compCardHtml()}</section>`;
 const curve=state.allies.some(Boolean)&&state.enemies.some(Boolean)?`<section class="card"><div class="card-head"><h2>Stärkekurve</h2><span class="tag">Schätzung</span></div>${renderCurve(true)}</section>`:'';
 const analysis=STANDALONE?'':`<section class="card"><div class="card-head"><h2>Draft-Analyse</h2><button class="btn small ${analysisBusy?'':'primary'}" data-action="${analysisBusy?'stop-analysis':'analyze'}">${analysisBusy?'Stopp':icon('spark')+'Analysieren'}</button></div><div id="analysis-text" class="analysis">${analysisText?esc(analysisText):'<span class="muted">Claude sagt in wenigen Sätzen, was fehlt und was passt.</span>'}</div></section>`;
 return`<div class="cs-extras">${compCard}${curve}${analysis}</div>`;
}
function renderDraftStart(){
 if(room?.role==='viewer')return`<section class="card empty room-wait"><h2>Warte auf den Draft</h2><p>Sobald ${esc(state.teamName)} den Draft startet, siehst du hier jeden Ban und Pick live.</p></section>`;
 const intro=renderChecklist();
 const ours=[...new Set(state.players.flatMap(p=>p.pool.map(v=>v.id)))].slice(0,12);
 const theirs=[...new Set([...oppAll(activeOpp()),'Ahri','Thresh','LeeSin','Jinx','Darius','Leona','Yasuo','Viego','Kaisa','Orianna','Sett','Lux','Zed','Caitlyn','Graves','Lulu','Jax','Syndra'])].filter(id=>!ours.includes(id)).slice(0,12);
 const tiles=(ids,side)=>`<div class="ds-mosaic ${side}" aria-hidden="true">${ids.map((id,k)=>`<img src="${SQUARE[id]}" alt="" style="--k:${k}" loading="lazy">`).join('')}</div>`;
 return`<section class="ds-hero">${tiles(ours,'blue')}${tiles(theirs,'red')}<div class="ds-side blue"><span>Blau</span></div><div class="ds-mid"><span class="ds-eyebrow">Champ Select · Turnier-Reihenfolge</span><h1>Bereit für den Draft?</h1><p>Abwechselnd bannen und picken, Schritt für Schritt, mit Vorschlägen für jede Rolle.</p><button class="btn primary big" data-action="draft-open">${icon('play')}Draft starten</button>${STANDALONE&&!room?`<button class="btn ds-room" data-action="room-open">${icon('users')}Live-Raum fürs Team</button>`:''}</div><div class="ds-side red"><span>Rot</span></div></section>`+intro+renderTemplates();
}
// Startliste: was ein neues Team der Reihe nach erledigen sollte. Der erste offene Punkt ist hervorgehoben.
const EX_POOLS=initialState().players.map(p=>p.pool.map(v=>v.id).join());
function checklistItems(){
 const team=!isExampleTeam();
 const pools=state.players.every(p=>p.pool.length>=2)&&state.players.filter((p,i)=>p.pool.map(v=>v.id).join()!==EX_POOLS[i]).length>=3;
 return[
  {done:team,title:'Spieler eintragen',text:'Teamname und die fünf Spielernamen.',btn:`<button class="btn small" data-action="tour" data-tour-name="team">Zeig mir</button>`},
  {done:pools,title:'Champion-Pools füllen',text:'Drei bis fünf sichere Champions pro Spieler.',btn:`<button class="btn small" data-action="tour" data-tour-name="team" data-tour-step="pool">Zeig mir</button>`},
  {done:state.opponents.length>0,optional:true,title:'Gegner anlegen',text:'Optional, bringt bessere Ban-Vorschläge.',btn:`<button class="btn small" data-page="opponents">Öffnen</button>`},
  {done:guide.get().drafted||state.history.length>0,title:'Ersten Draft machen',text:'Am besten erst als Übung gegen den Computer.',btn:`<button class="btn small" data-action="draft-open">Starten</button>`},
 ];
}
let lastChecklist=null;
function renderChecklist(){
 const items=checklistItems(),done=items.filter(x=>x.done).length,prev=lastChecklist;lastChecklist=items.map(x=>x.done);
 if(prev&&done===items.length&&prev.some(x=>!x))setTimeout(()=>toast('Startliste komplett. Ihr seid bereit für den Draft!'),100);
 if(done===items.length||guide.get().hidden)return'';
 const next=items.findIndex(x=>!x.done);
 return`<section class="card checklist"><div class="card-head"><div><h2>Startliste</h2><p class="fine">${done} von ${items.length} erledigt</p></div><button class="btn ghost small" data-action="hide-checklist">Ausblenden</button></div>
 <div class="cl-bar"><i style="width:${done/items.length*100}%"></i></div>
 <ol class="cl-list">${items.map((x,i)=>`<li class="${x.done?'done':''} ${i===next?'next':''} ${x.done&&prev&&!prev[i]?'just-done':''}"><span class="cl-mark">${x.done?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>':i+1}</span><div class="cl-text"><strong>${x.title}${x.optional?' <span class="tag">optional</span>':''}</strong><span class="fine">${x.text}</span></div>${x.done?'':x.btn}</li>`).join('')}</ol></section>`;
}
// Worauf ihr im aktuellen Draft-Schritt achten solltet.
function focusTip(c){
 if(!c)return'';
 if(c.who==='them')return c.type==='ban'?'Tragt den Gegner-Ban ein. Wen nehmen sie euch weg?':'Tragt den Gegner-Pick ein. Welche eurer offenen Rollen kann ihn kontern?';
 if(c.type==='ban'){
  const info=roleInfo(state.enemies),filled=ROLES.filter(r=>info.certain.has(r)).map(r=>ROLE_NAMES[r]),open=info.open.map(r=>ROLE_NAMES[r]);
  const flex=[...info.flex.entries()].map(([i,rs])=>`${cname(state.enemies[i])} (${rs.map(r=>ROLE_NAMES[r]).join('/')})`);
  if(filled.length||flex.length)return`${filled.length?`Gegner hat ${filled.join(', ')} schon. `:''}Bannt für ${open.join(', ')}.${flex.length?` Flex noch unklar: ${flex.join(', ')}.`:''}`;
  return activeOpp()?.favorites?.length||activeOpp()?.players?.some(p=>p.champs.length)?'Bannt, was der Gegner am liebsten spielt.':'Bannt starke Meta-Champions, die eure Picks bedrohen.';
 }
 const comp=composition(state.allies);
 {const adv=roleAdvice();if(adv.length&&adv[0].score>=2)return`Empfehlung: jetzt ${ROLE_NAMES[ROLES[adv[0].i]]} picken. ${adv[0].reasons.join(', ')}.`;}
 if(comp.count<2)return'Sichert zuerst starke, flexible Champions aus euren Pools. Flex-Picks verraten früh nichts.';
 if(comp.count>=3&&ROLES.some((r,i)=>!state.allies[i]&&state.enemies[i]))return`Kontern: ${ROLES.map((r,i)=>!state.allies[i]&&state.enemies[i]?`${ROLE_NAMES[r]} gegen ${cname(state.enemies[i])}`:null).filter(Boolean).join(', ')} steht schon fest. Wählt passend dazu.`;
 if(comp.front<3)return'Euch fehlt noch Frontline. Schaut auf Tanks und Fighter.';
 if(comp.engage<3)return'Euch fehlt noch Engage, um Kämpfe zu starten.';
 if(comp.physical>=3&&comp.magic===0)return'Bisher nur physischer Schaden. Ein magischer Pick macht euch schwerer zu kontern.';
 if(comp.magic>=3&&comp.physical===0)return'Bisher nur magischer Schaden. Ein physischer Pick macht euch schwerer zu kontern.';
 return'Eure Komposition steht gut. Jetzt zählt, was eure Spieler sicher beherrschen.';
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
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">${esc(cname(id))}</h2><p class="fine" style="margin-top:4px">${type==='allies'?'Spielt eigentlich jemand anderes diesen Champion? Tausche die Rolle.':'Spielt der Gegner ihn auf einer anderen Rolle? Tausche sie hier.'}</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div>
 <div><span class="field-label">Rolle</span><div class="seg wide five" role="group" aria-label="Rolle">${ROLES.map((r,j)=>`<button data-swap-to="${type}|${i}|${j}" aria-pressed="${i===j}">${ROLE_NAMES[r]}${state[type][j]&&j!==i?`<small>${esc(cname(state[type][j]))}</small>`:''}</button>`).join('')}</div><p class="fine" style="margin-top:6px">Steht dort schon ein Champion, tauschen beide die Rollen.</p></div>
 <div class="dlg-actions">${fix?`<button class="btn ghost" data-swap-clear="${type}|${i}">Pick entfernen</button><button class="btn" data-swap-change="${type}|${i}">Anderer Champion</button>`:''}<button class="btn primary" data-action="cancel-confirm">Fertig</button></div>`;
 $('#confirm-dialog').showModal();
}
function openDraftDialog(){
 confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">Draft starten</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div>
 <div class="log-form">
  <div><span class="field-label">Eure Seite</span><div class="seg wide side-pick" role="group" aria-label="Eure Seite"><button data-pr-side="blue" aria-pressed="${prSide==='blue'}">Blau</button><button data-pr-side="red" aria-pressed="${prSide==='red'}">Rot</button></div></div>
  <div><span class="field-label">Gegner</span><div class="seg wide" role="group" aria-label="Gegner"><button data-pr-mode="real" aria-pressed="${prMode==='real'}">Echtes Spiel</button><button data-pr-mode="ai" aria-pressed="${prMode==='ai'}">Gegen Computer</button></div><p class="fine" id="pr-mode-hint" style="margin-top:6px">${prMode==='ai'?'Übung gegen den Computer. Nur in diesem Browser.':'Ihr tragt die Picks des Gegners ein. Das Team sieht den Draft live.'}</p></div>
  <div><span class="field-label">Modus</span><div class="seg wide" role="group" aria-label="Modus"><button data-pr-fearless="off" aria-pressed="${!prFearless}">Einzelspiel</button><button data-pr-fearless="on" aria-pressed="${prFearless}">Fearless-Serie</button></div><p class="fine" id="pr-fl-hint" style="margin-top:6px">${prFearless?FL_HINT:'Ein normaler Draft.'}</p></div>
  <div id="pr-timer-row" ${prMode==='ai'?'':'hidden'}><span class="field-label">Timer pro Schritt</span><div class="seg wide" role="group" aria-label="Timer"><button data-pr-timer="on" aria-pressed="${prTimer}">30 Sekunden</button><button data-pr-timer="off" aria-pressed="${!prTimer}">Ohne Timer</button></div></div>
  ${state.opponents.length?`<div><label class="field-label" for="pr-opp">Gegnerteam (optional)</label><select class="field" id="pr-opp" style="width:100%"><option value="">Keins</option>${state.opponents.map(o=>`<option value="${esc(o.id)}" ${o.id===state.opponentId?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>`:''}
 </div>
 <div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Abbrechen</button><button class="btn primary" data-action="draft-start">Los geht's</button></div>`;
 $('#confirm-dialog').showModal();
}
// Fearless-Serie: Wer in einem Spiel der Serie gepickt wurde, ist danach für beide Teams gesperrt (Bans zählen nicht).
const FL_HINT='Was in einem Spiel gepickt wurde, ist für den Rest der Serie für beide Teams gesperrt. So spielen seit 2025 auch die Profiligen.';
function flUsedHtml(){
 const f=state.fearless;if(!f)return'';
 return`<div class="fl-used"><span class="fl-tag">Fearless</span><span class="fine">Spiel ${f.game}${f.used.length?` · ${f.used.length} gesperrt`:' · noch nichts gesperrt'}</span>${f.used.length?`<div class="fl-row">${f.used.map(id=>`<img src="${SQUARE[id]}" alt="${esc(cname(id))}" title="${esc(cname(id))}">`).join('')}</div>`:''}</div>`;
}
function flNextHtml(){return`<div class="fl-next"><span class="fine">Nächstes Spiel der Serie, eure Seite:</span><div class="row"><button class="btn" data-fl-next="blue">Blau</button><button class="btn" data-fl-next="red">Rot</button></div></div>`;}
function fearlessNext(side){
 const f=state.fearless;if(!f)return;
 const next={game:f.game+1,used:[...new Set([...f.used,...state.allies,...state.enemies].filter(Boolean))]};
 if(practice)startPractice({timer:practice.timer,side,opponentId:state.opponentId,fearless:next});else startRealDraft(side,state.opponentId,next);
 toast(`Spiel ${next.game} der Fearless-Serie: ${next.used.length} Champions sind gesperrt.`);
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
 const list=state.templates.map(t=>`<li class="tpl"><div class="tpl-info"><strong>${esc(t.name)}</strong><div class="fine">${t.allies.filter(Boolean).length} Picks · ${t.enemies.filter(Boolean).length} Gegner · ${t.bans.filter(Boolean).length} Bans</div></div><button class="btn small" data-template-load="${esc(t.id)}">Laden</button><button class="icon-btn" data-template-delete="${esc(t.id)}" aria-label="Vorlage ${esc(t.name)} löschen">${icon('close')}</button></li>`).join('');
 return`<details class="card fold" id="fold-templates" ${templatesOpen?'open':''}><summary>Gespeicherte Drafts <span class="tag">${state.templates.length}</span>${icon('chevrondown')}</summary><div class="fold-body"><div class="row wrap"><input class="field grow" id="template-name" maxlength="40" placeholder="Name, z. B. Plan A gegen Engage" aria-label="Name der Vorlage"><button class="btn" data-action="save-template">${icon('plus')}Aktuellen Draft speichern</button></div>${list?`<ul class="tpl-list">${list}</ul>`:'<p class="fine">Noch keine Vorlage gespeichert.</p>'}</div></details>`;
}

/* ---------- Matchup-Notizen ---------- */
function showMatchupDialog(id){
 confirmAction=null;const n=state.matchups[id]||'';
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div class="row">${portrait(id,'av sm')}<h2 id="confirm-title">Gegen ${esc(cname(id))}</h2></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div>
 <label class="field-label" for="mu-text">Was muss man gegen ${esc(cname(id))} wissen? Gilt für alle Spiele und ist fürs ganze Team sichtbar.</label>
 <textarea class="field" id="mu-text" rows="5" maxlength="500" placeholder="z. B. Level 1–3 nicht traden, auf Ghost achten, nach verfehltem Q reingehen.">${esc(n)}</textarea>
 <div class="dlg-actions">${n?`<button class="btn ghost" data-mu-delete="${id}">Löschen</button>`:''}<button class="btn" data-action="cancel-confirm">Abbrechen</button><button class="btn primary" data-mu-save="${id}">Speichern</button></div>`;
 $('#confirm-dialog').showModal();$('#mu-text').focus();
}

/* ---------- Stärkekurve ---------- */
function renderCurve(compact){
 const a=phaseCurve(state.allies),b=phaseCurve(state.enemies);
 const ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue',theirs=ours==='red'?'blue':'red';
 // Wertebereich eng um die Daten, damit Unterschiede sichtbar werden (Linien, keine Flächen).
 const W=compact?320:520,H=compact?132:190,L=14,R=compact?74:96,T=12,B=26,lo=Math.max(0,Math.min(...a,...b)-1.5),hi=Math.max(...a,...b,1)+1.5;
 const x=i=>L+i*(W-L-R)/2,y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
 const line=(v,cls)=>`<polyline class="cv-line ${cls}" points="${v.map((p,i)=>`${x(i)},${y(p)}`).join(' ')}"/>`+v.map((p,i)=>`<circle class="cv-dot ${cls}" cx="${x(i)}" cy="${y(p)}" r="4"/>`).join('');
 const nameA=esc(state.teamName).slice(0,14),nameB=esc(activeOpp()?.name||'Gegner').slice(0,14);
 let ya=y(a[2]),yb=y(b[2]);if(Math.abs(ya-yb)<13){const mid=(ya+yb)/2;ya=mid+(ya<=yb?-7:7);yb=mid+(ya<=yb?7:-7);}
 const hits=PHASES.map((p,i)=>`<rect class="cv-hit" x="${x(i)-26}" y="${T}" width="52" height="${H-T-B}"><title>${p} (${PHASE_TIME[i]}): ${nameA} ${String(a[i]).replace('.',',')} · ${nameB} ${String(b[i]).replace('.',',')}</title></rect>`).join('');
 const svg=`<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Geschätzte Stärke beider Teams in früher, mittlerer und später Spielphase">
  ${[0,.5,1].map(f=>`<line class="cv-grid" x1="${L}" x2="${W-R+6}" y1="${T+f*(H-T-B)}" y2="${T+f*(H-T-B)}"/>`).join('')}
  ${PHASES.map((p,i)=>`<text class="cv-x" x="${x(i)}" y="${H-8}" text-anchor="middle">${p}</text>`).join('')}
  ${line(b,'c-'+theirs)}${line(a,'c-'+ours)}
  <text class="cv-lab" x="${x(2)+10}" y="${ya+4}">${nameA}</text><text class="cv-lab" x="${x(2)+10}" y="${yb+4}">${nameB}</text>
  ${hits}</svg>`;
 const legend=`<div class="cv-legend"><span><i class="c-${ours}"></i>${nameA}</span><span><i class="c-${theirs}"></i>${nameB}</span></div>`;
 const table=compact?'':`<details class="rec-more"><summary>Werte als Tabelle</summary><table class="cv-table"><thead><tr><th>Phase</th><th class="r">${nameA}</th><th class="r">${nameB}</th></tr></thead><tbody>${PHASES.map((p,i)=>`<tr><td>${p} <span class="muted">${PHASE_TIME[i]}</span></td><td class="r">${String(a[i]).replace('.',',')}</td><td class="r">${String(b[i]).replace('.',',')}</td></tr>`).join('')}</tbody></table></details>`;
 return`<p class="cv-sum">${curveSummary(a,b)}</p>${legend}${svg}<p class="fine">Grobe Schätzung aus den Champion-Profilen (Scaling und Engage), keine gemessenen Werte.</p>${table}`;
}

/* ---------- Spielplan nach dem Draft ---------- */
const draftKey=()=>JSON.stringify([state.allies,state.enemies,state.bans,state.side,state.opponentId]);
const POS=[[10,32],[25,62],[42,58],[73,90],[53,90]];
function mapSvg(ours){
 const theirs=ours==='blue'?'red':'blue';
 const pos=(side,i)=>side==='blue'?POS[i]:[POS[i][1],POS[i][0]];
 const tok=(id,side,i,k,mine)=>{const [x,y]=pos(side,i);return`<g transform="translate(${x} ${y})"><g class="token ${mine?'mine':''}" style="--k:${k}"><circle r="5.7" class="tok-ring ${side}"/><clipPath id="tc${k}"><circle r="4.8"/></clipPath><image href="${SQUARE[id]||'icon.svg'}" x="-4.8" y="-4.8" width="9.6" height="9.6" clip-path="url(#tc${k})" preserveAspectRatio="xMidYMid slice"/><text y="9.6" class="tok-name">${esc(cname(id))}</text><title>${mine?'Euer':'Gegner'} ${ROLE_NAMES[ROLES[i]]}: ${esc(cname(id))}</title></g></g>`;};
 return`<svg class="rift" viewBox="-2 -2 104 106" role="img" aria-label="Kartenskizze mit den Positionen beider Teams">
  <rect x="0" y="0" width="100" height="100" rx="6" class="m-ground"/>
  <g class="m-jungle"><ellipse cx="27" cy="52" rx="9" ry="15" transform="rotate(45 27 52)"/><ellipse cx="48" cy="73" rx="9" ry="15" transform="rotate(45 48 73)"/><ellipse cx="52" cy="27" rx="9" ry="15" transform="rotate(45 52 27)"/><ellipse cx="73" cy="48" rx="9" ry="15" transform="rotate(45 73 48)"/></g>
  <path d="M7 7 L93 93" class="m-river"/>
  <g class="m-lanes"><path d="M10 86 V10 H86"/><path d="M14 90 H90 V14"/><path d="M15 85 L85 15"/></g>
  <circle cx="10" cy="90" r="8" class="m-base blue"/><circle cx="90" cy="10" r="8" class="m-base red"/>
  <circle cx="30" cy="30" r="2.8" class="m-pit"/><circle cx="70" cy="70" r="2.8" class="m-pit"/>
  <text x="30" y="25.4" class="m-label" text-anchor="middle">Baron</text><text x="70" y="77.2" class="m-label" text-anchor="middle">Drache</text>
  ${state.enemies.map((id,i)=>tok(id,theirs,i,i+5,false)).join('')}${state.allies.map((id,i)=>tok(id,ours,i,i,true)).join('')}
 </svg>`;
}
function renderPlan(){
 const back=`<button class="btn small" data-page="draft">${icon('back')}Zurück zum Draft</button>`;
 if(!(state.allies.every(Boolean)&&state.enemies.every(Boolean)))return head('Spielplan','Der Spielplan erscheint, sobald alle zehn Champions gesetzt sind.',back)+`<section class="card empty"><p>Setzt zuerst alle Picks für beide Teams.</p><button class="btn primary" data-page="draft">Zum Draft</button></section>`;
 const key=draftKey();let n=planNotes.get(key);
 if(!n){if(STANDALONE)n={status:'off'};else{n={status:'loading',pending:true};setTimeout(()=>generatePlan(key),0);}planNotes.set(key,n);}
 const ours=state.draftMode==='tournament'&&state.side==='red'?'red':'blue',opp=activeOpp();
 const actions=`${back}<button class="btn small" data-action="copy-discord">${icon('copy')}Für Discord</button>${n.status!=='loading'&&n.status!=='off'?`<button class="btn small" data-action="plan-regen">${icon('refresh')}Notizen neu</button>`:''}${practice||room?.role==='viewer'?'':`<button class="btn small primary" data-action="log-game">Spiel eintragen</button>`}`;
 const note=n.status==='loading'?`<div class="banner ai-wait">${icon('spark')}Claude schreibt die Notizen für jede Position<span>.</span><span>.</span><span>.</span></div>`
  :n.status==='unavailable'?'<div class="banner">Die KI-Notizen gibt es nur, wenn die Seite angemeldet in Claude geöffnet ist. Karte, Stärkekurve und eure Matchup-Notizen siehst du trotzdem.</div>'
  :n.status==='error'?`<div class="banner warn">${n.code==='not_granted'?'Die KI-Notizen wurden nicht erlaubt. Du kannst das im Berechtigungsmenü der Seite ändern.':n.code==='rate_limited'?'Gerade zu viele Anfragen. Versuch es in einer Minute noch einmal.':'Die Notizen konnten nicht erstellt werden.'} <button class="link" data-action="plan-regen">Nochmal versuchen</button></div>`:'';
 const win=n.status==='done'&&n.data.win?`<section class="card win-cond"><span class="role-label">So gewinnt ihr</span><p>${esc(n.data.win)}</p></section>`:'';
 const list=(t,arr)=>arr?.length?`<h4>${t}</h4><ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
 const cards=ROLES.map((r,i)=>{const a=state.allies[i],e=state.enemies[i],mu=state.matchups[e],ai=n.status==='done'?n.data.roles[r]:null;
  const body=ai?list('Wichtig',ai.wichtig)+list('Plan',ai.plan):n.status==='loading'?'<div class="sk"></div><div class="sk short"></div><div class="sk"></div>':'';
  const bm=benchmarks(i,a,state.allies);
  const when=(ai?.wann||[]).map(x=>{const m=x.match(/^\s*(ca\.\s*)?(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)\s*[–:-]?\s*(.*)$/);return m?[m[2].replace(/\s+/g,''),m[3]]:['',x];});
  const bmHtml=`<div class="bench"><h4>Deine Richtwerte</h4><ul class="bench-list">${[...bm.items,...when].map(([t,txt])=>`<li>${t?`<span class="bench-t">${esc(t)}</span>`:''}<span>${esc(txt)}</span></li>`).join('')}</ul><p class="bench-note"><b>Power-Spike:</b> ${esc(bm.spike)}</p><p class="bench-note"><b>Roamen:</b> ${esc(bm.roam)}</p></div>`;
  return`<section class="card role-card side-${ours}" id="rc-${r}" style="--k:${i}"><div class="rc-head"><span class="role-label">${ROLE_NAMES[r]}</span><span class="fine">${esc(state.players[i].name)}</span></div><div class="rc-vs">${portrait(a)}<span class="vs">vs</span>${portrait(e)}</div><p class="rc-names"><strong>${esc(cname(a))}</strong> gegen <strong>${esc(cname(e))}</strong></p>${mu?`<p class="rc-mu">${icon('book')}<span>${esc(mu)}</span></p>`:''}${body}${bmHtml}</section>`;}).join('');
 return head('Spielplan',`${esc(state.teamName)} gegen ${esc(opp?.name||'Gegner')} · Patch ${esc(shortPatch(currentPatch()))}${practice?' · Übung':''}`,actions)+renderMyPlan()+`<div class="plan-grid"><section class="card map-card">${mapSvg(ours)}</section><div class="plan-side">${win}<section class="card"><div class="card-head"><h2>Stärkekurve</h2><span class="tag">Schätzung</span></div>${renderCurve(false)}</section></div></div>${renderSW()}${renderTimeline()}${note}<h2 class="plan-sec">Pro Spieler</h2><div class="role-grid">${cards}</div>`;
}
// Persönlicher Fahrplan: optional, Auswahl wird pro Gerät gemerkt. Bot-Lane = ADC + Support.
let myRole=null;try{const v=localStorage.getItem('riftroom.myrole');if(PLAN_ROLES.includes(v))myRole=v;}catch{}
function renderMyPlan(){
 const idx=k=>k==='BOTLANE'?[3,4]:[ROLES.indexOf(k)];
 const chips=PLAN_ROLES.map(k=>`<button data-myrole="${k}" aria-pressed="${myRole===k}">${idx(k).map(i=>portrait(state.allies[i],'av xs')).join('')}${PLAN_ROLE_NAMES[k]}</button>`).join('');
 let body='';
 if(myRole){
  const tl=roleTimeline(myRole,state.allies,state.enemies),label={go:'Euer Fenster',careful:'Vorsicht',even:''};
  const who=idx(myRole).map(i=>esc(cname(state.allies[i]))).join(' + '),vs=tl.vs.filter(Boolean).map(id=>esc(cname(id))).join(' + ');
  body=`<section class="card tl my-plan"><div class="card-head"><div><h2>Dein Fahrplan · ${PLAN_ROLE_NAMES[myRole]}</h2><p class="fine">${who}${vs?` gegen ${vs}`:''}${tl.spikes.length?' · '+tl.spikes.map(x=>`${esc(cname(x.id))}: ${x.txt}`).join(', '):''}</p></div><button class="btn small" data-jump="rc-${myRole==='BOTLANE'?'BOTTOM':myRole}">Richtwerte</button></div><ol class="tl-list">${tl.items.map((x,i)=>`<li class="tl-${x.tone}" style="--k:${i}"><span class="tl-time">${esc(x.t)}</span><span class="tl-dot"></span><div class="tl-body"><strong>${esc(x.title)}${label[x.tone]&&(i===0||tl.items[i-1].tone!==x.tone)?` <span class="tl-tag">${label[x.tone]}</span>`:''}</strong><span>${esc(x.text)}</span></div></li>`).join('')}</ol></section>`;
 }
 return`<nav class="plan-jump my-role" aria-label="Deine Rolle wählen"><span class="fine">${myRole?'Deine Rolle:':'Deine Rolle wählen (optional):'}</span>${chips}</nav>${body}`;
}
function renderSW(){
 const {S,W,A}=strengthsWeaknesses(state.allies,state.enemies);
 const col=(cls,title,arr,ic)=>`<div class="sw-col ${cls}"><h3>${ic}${title}</h3>${arr.length?`<ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="fine">Nichts Auffälliges.</p>'}</div>`;
 return`<section class="card sw"><div class="card-head"><h2>Stärken und Schwächen</h2><span class="tag">aus eurer Komposition</span></div><div class="sw-grid">${col('s','Stärken',S,'<span class="sw-dot"></span>')}${col('w','Schwächen',W,'<span class="sw-dot"></span>')}${col('a','Achtet auf',A,'<span class="sw-dot"></span>')}</div></section>`;
}
function renderTimeline(){
 const items=timeline(state.allies,state.enemies);
 const label={go:'Euer Fenster',careful:'Vorsicht',even:''};
 return`<section class="card tl"><div class="card-head"><h2>Was wann</h2><span class="tag">Timer Saison 2026</span></div><ol class="tl-list">${items.map((x,i)=>`<li class="tl-${x.tone}" style="--k:${i}"><span class="tl-time">${x.t}</span><span class="tl-dot"></span><div class="tl-body"><strong>${esc(x.title)}${label[x.tone]?` <span class="tl-tag">${label[x.tone]}</span>`:''}</strong><span>${esc(x.text)}</span></div></li>`).join('')}</ol><p class="fine tl-legend"><span class="lg go"></span>ihr seid stärker <span class="lg careful"></span>Gegner ist stärker</p></section>`;
}
function buildPlanPrompt(){
 const name=cname,ours=state.draftMode==='tournament'&&state.side==='red'?'rote':'blaue';
 const prof=id=>{const p=profileOf(id);return p?`${p.damage==='magic'?'magisch':p.damage==='physical'?'physisch':'gemischt'}, Frontline ${p.front}, Engage ${p.engage}, Peel ${p.peel}, Scaling ${p.scaling}`:'';};
 const wrTxt=(id,role)=>{const e=metaFor(id,role);return e?`, Winrate ${(e.wins/e.games*100).toFixed(1)} %`:'';};
 const a=phaseCurve(state.allies),b=phaseCurve(state.enemies),L=[];
 L.push('Du bist ein erfahrener League-of-Legends-Coach für ein Amateurteam (Prime League / Clash). Erstelle für jeden unserer fünf Spieler kurze Notizen für genau dieses Spiel.');
 L.push('Antworte NUR mit gültigem JSON, ohne Markdown und ohne Text davor oder danach, genau in diesem Format:');
 L.push('{"winCondition":"ein Satz","roles":[{"role":"TOP","wichtig":["…","…"],"plan":["…","…"],"wann":["6:00 – …","14:00 – …"]},{"role":"JUNGLE","wichtig":[],"plan":[]},{"role":"MIDDLE","wichtig":[],"plan":[]},{"role":"BOTTOM","wichtig":[],"plan":[]},{"role":"UTILITY","wichtig":[],"plan":[]}]}');
 L.push('Regeln: Deutsch. Je Rolle genau 2 Punkte unter "wichtig" und genau 2 unter "plan", jeder Punkt höchstens 9 Wörter, im Telegrammstil ohne Füllwörter. "wichtig" = was der Spieler über sein Matchup und die gegnerischen Champions wissen muss (Power-Spikes, gefährliche Fähigkeiten, Level-Vorteile). "plan" = was er konkret tun soll (Wellen, Trades, Roams, Objectives, Rolle im Teamfight). Für den Jungle geht es um Pathing, Gank-Ziele und Objectives. "wann" = genau 2 Zeitpunkte im Format "mm:ss – Aufgabe" (höchstens 8 Wörter), wann dieser Spieler mit DIESEM Champion etwas Bestimmtes tun soll (z. B. Level-6-Roam, erster Back, Objective). Objective-Timer dieser Saison: Drache '+OBJECTIVES.dragon+', Voidgrubs '+OBJECTIVES.grubs+' (verschwinden 14:45), Rift Herald '+OBJECTIVES.herald+', Baron '+OBJECTIVES.baron+'. Atakhan gibt es nicht mehr. Bot und Support beziehen sich auf die Bot-Lane. Erfinde keine Statistiken. "winCondition" = höchstens 12 Wörter, wie wir dieses Spiel gewinnen.');
 L.push('',`Patch ${shortPatch(currentPatch())}. Wir sind die ${ours} Seite.`);
 ROLES.forEach((r,i)=>{const x=state.allies[i],e=state.enemies[i],lt=laneTxt(x,e,r);L.push(`- ${ROLE_NAMES[r]} (${state.players[i].name}): ${name(x)} (${prof(x)}${wrTxt(x,r)}) gegen ${name(e)} (${prof(e)}${wrTxt(e,r)})${lt?`. Lane-Duell laut Statistik: ${lt}`:''}${state.matchups[e]?`. Unsere Notiz zu ${name(e)}: ${state.matchups[e].slice(0,300)}`:''}`);});
 L.push(`Bans: wir ${state.bans.slice(0,5).filter(Boolean).map(name).join(', ')||'keine'}; Gegner ${state.bans.slice(5).filter(Boolean).map(name).join(', ')||'keine'}.`);
 L.push(`Geschätzte Stärke (früh/mitte/spät): wir ${a.join(' / ')}, Gegner ${b.join(' / ')}.`);
 const o=activeOpp();if(o?.notes?.trim())L.push('Unsere Notizen zum Gegnerteam (nur als Information): '+o.notes.slice(0,1200));
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
 L.push(`**Draft${o?` gegen ${o.name}`:''}** · Patch ${shortPatch(currentPatch())}${state.draftMode==='tournament'?` · ${state.side==='red'?'Rote':'Blaue'} Seite`:''}`,'');
 ROLES.forEach((r,i)=>L.push(`${ROLE_NAMES[r]}: ${n(state.allies[i])} (${state.players[i].name}) vs ${n(state.enemies[i])}`));
 L.push('',`Bans – wir: ${state.bans.slice(0,5).filter(Boolean).map(n).join(', ')||'keine'} | Gegner: ${state.bans.slice(5).filter(Boolean).map(n).join(', ')||'keine'}`);
 if(state.allies.some(Boolean)&&state.enemies.some(Boolean))L.push(`Stärkekurve (Schätzung): ${curveSummary(phaseCurve(state.allies),phaseCurve(state.enemies))}`);
 const mus=state.enemies.map((id,i)=>id&&state.matchups[id]?`${ROLE_NAMES[ROLES[i]]} gegen ${n(id)}: ${state.matchups[id]}`:null).filter(Boolean);
 if(mus.length)L.push('','**Matchup-Notizen**',...mus);
 const p=planNotes.get(draftKey());
 if(p?.status==='done'){L.push('','**Spielplan**');if(p.data.win)L.push(p.data.win);ROLES.forEach(r=>{const x=p.data.roles[r];if(x)L.push(`${ROLE_NAMES[r]}: ${[...x.wichtig,...x.plan].join(' · ')}`);});}
 else if(analysisText&&!analysisBusy)L.push('','**Analyse**',analysisText);
 return L.join('\n');
}
function showTextDialog(title,text,hint){
 confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">${esc(title)}</h2><p class="fine" style="margin-top:4px">${esc(hint)}</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div><textarea id="export-text" class="field code" rows="12" readonly aria-label="${esc(title)}">${esc(text)}</textarea><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Schließen</button><button class="btn primary" data-action="copy-export">Kopieren</button></div>`;
 $('#confirm-dialog').showModal();
}
function copyText(text,title){
 const fallback=()=>showTextDialog(title,text,'Kopieren war hier nicht direkt möglich. Markiere den Text oder tippe auf „Kopieren“.');
 try{navigator.clipboard.writeText(text).then(()=>toast('Kopiert. Jetzt in Discord einfügen.'),fallback);}catch{fallback();}
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
 if(t.finished){toast('Draft komplett. Schau dir den Spielplan an.');return;}
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
 if(c.type==='ban'){const id=banList(15).items.map(b=>b.id).find(x=>!tk.has(x))||randomFree(tk);const i=[0,1,2,3,4].find(k=>!state.bans[k]);state.bans[i]=id;toast(`Zeit abgelaufen: ${cname(id)} automatisch gebannt.`,true);}
 else{const i=state.allies[state.selectedRole]?state.allies.findIndex(x=>!x):state.selectedRole;const id=rec({...state,selectedRole:i,poolOnly:false})[0]?.id||randomFree(tk);state.allies[i]=id;toast(`Zeit abgelaufen: ${cname(id)} automatisch gepickt.`,true);}
 save();render();
}
function endPractice(){
 if(!practice)return;clearTimeout(practice.ai);clearInterval(practice.tick);
 const s=practice.snapshot;practice=null;
 Object.assign(state,{draftActive:s.draftActive,allies:s.allies,enemies:s.enemies,bans:s.bans,draftMode:s.draftMode,side:s.side,opponentId:s.opponentId,selectedRole:s.selectedRole,fearless:s.fearless||null});
 lastBoard=null;page='draft';analysisText='';
 if(pendingRemote){const snap=pendingRemote;pendingRemote=null;lastSharedJson='';applyRemoteTeam(snap);}
 save();render();toast('Übung beendet. Euer Draft ist wieder da.');
}
// Im Übungs-Draft nur erlaubte Schritte zulassen.
function practiceBlocks(type,index){
 if(!practice)return false;
 const c=draftTurn(state).current;
 if(!c){toast('Der Übungs-Draft ist fertig.',true);return true;}
 if(type==='enemies'||(type==='bans'&&index>=5)){toast('Für den Gegner wählt der Computer.',true);return true;}
 if(c.who!=='us'){toast('Warte kurz, der Gegner ist dran.',true);return true;}
 if(type==='bans'&&c.type!=='ban'){toast('Jetzt ist ein Pick dran, kein Ban.',true);return true;}
 if(type==='allies'&&c.type!=='pick'){toast('Jetzt ist ein Ban dran.',true);return true;}
 if(state[type][index]){toast('Dieser Slot ist schon gesetzt.',true);return true;}
 return false;
}

/* ---------- Analyse (Claude) ---------- */
// Lane-Duell laut Statistik als Text, z. B. „Garen gewinnt 52,1 % gegen Darius (4.123 Spiele)“.
function laneTxt(x,e,r){const row=x&&e?getMatchups()?.roles?.[r]?.[e]?.find(z=>z[0]===x):null;if(!row||row[2]<300)return'';const a=(row[1]*row[2]+50*200)/(row[2]+200);return`${cname(x)} gewinnt ${pct(a)} gegen ${cname(e)} (${int(row[2])} Spiele)`;}
function buildAnalysisPrompt(){
 const name=cname;
 const wrTxt=(id,role)=>{const e=metaFor(id,role);return e?` (Winrate ${(e.wins/e.games*100).toFixed(1)} % in ${e.games} Spielen)`:'';};
 const comp=composition(state.allies),L=[];
 L.push('Du bist ein erfahrener League-of-Legends-Draft-Coach für ein Amateurteam (Prime League / Clash). Antworte auf Deutsch, knapp und konkret, höchstens 170 Wörter, ohne Überschriften und ohne Markdown. Gliedere in drei kurze Absätze: 1) Stärken und Lücken unserer Komposition, 2) konkreter Vorschlag für den nächsten Pick oder Ban, möglichst aus dem Champion-Pool des betroffenen Spielers, 3) worauf wir gegen die Gegner-Komposition achten müssen. Erfinde keine Statistiken, nutze nur die angegebenen Zahlen.');
 L.push('',`Patch: ${shortPatch(catalog.version)}. Statistikquelle: ${state.meta?state.meta.source+', '+state.meta.rank+', '+state.meta.queue:'keine'}.`);
 if(state.draftMode==='tournament'){const t=draftTurn(state);L.push(`Draft-Modus: Turnier-Reihenfolge, wir sind die ${state.side==='red'?'rote':'blaue'} Seite. ${t.finished?'Der Draft ist komplett.':'Als Nächstes '+(t.current.who==='us'?'sind wir':'ist der Gegner')+' dran mit '+(t.current.type==='ban'?'Ban':'Pick')+' '+t.current.n+'.'}`);}
 L.push('','Unser Team:');
 ROLES.forEach((r,i)=>{const p=state.players[i],id=state.allies[i];L.push(`- ${ROLE_NAMES[r]} (${p.name}): ${id?name(id)+wrTxt(id,r):'noch offen'}; Pool: ${p.pool.map(x=>name(x.id)+' '+x.comfort+'/5').join(', ')||'leer'}`);});
 L.push('','Gegner-Picks: '+(state.enemies.map((id,i)=>id?ROLE_NAMES[ROLES[i]]+': '+name(id)+wrTxt(id,ROLES[i]):null).filter(Boolean).join(', ')||'noch keine'));
 L.push('Unsere Bans: '+(state.bans.slice(0,5).filter(Boolean).map(name).join(', ')||'keine'));
 L.push('Gegner-Bans: '+(state.bans.slice(5).filter(Boolean).map(name).join(', ')||'keine'));
 L.push(`Komposition (grobe Profile): Frontline ${comp.front}, Engage ${comp.engage}, Peel ${comp.peel}, Scaling ${comp.scaling}; Schaden physisch ${comp.physical}, magisch ${comp.magic}, gemischt ${comp.mixed}.`);
 const lanes=ROLES.map((r,i)=>laneTxt(state.allies[i],state.enemies[i],r)).filter(Boolean);
 if(lanes.length)L.push('Lane-Duelle laut Statistik (Winrate unseres Champions): '+lanes.join('; ')+'.');
 // Riftrooms eigene Empfehlungen, damit die Analyse dazu passt.
 const tr=draftTurn(state);
 if(!tr.finished){
  const plan=banList(5);
  if(plan.items.length&&state.bans.slice(0,5).filter(Boolean).length<5)L.push('Ban-Vorschläge von Riftroom: '+plan.items.map(b=>`${name(b.id)} (${banNote(b)})`).join(', ')+'.');
  if(plan.skipped.length)L.push('Gegner-Mains, die gerade keinen Ban wert sind: '+plan.skipped.map(x=>`${name(x.id)} (${skipWhy(x)})`).join(', ')+'. Schlage diese nicht als Ban vor.');
  const open=state.allies.findIndex(x=>!x);
  if(open>=0){const ri=state.allies[state.selectedRole]?open:state.selectedRole;L.push(`Pick-Vorschläge von Riftroom für ${ROLE_NAMES[ROLES[ri]]}: `+rec({...state,selectedRole:ri,poolOnly:false}).slice(0,3).map(r=>`${name(r.id)} (${r.reasons.slice(0,2).map(x=>why(x,r)).join(', ')})`).join('; ')+'.');}
  L.push('Nutze diese Vorschläge als Grundlage. Weiche nur mit einem klaren Grund ab und nenne ihn.');
 }
 const o=activeOpp();if(o){L.push('',`Gegnerteam: ${o.name}. Team-Favoriten: ${o.favorites.map(name).join(', ')||'keine notiert'}.`);o.players.forEach((p,i)=>{if(p.champs.length)L.push(`Gegner ${ROLE_NAMES[ROLES[i]]}: Mains ${p.champs.map(name).join(', ')}.`);});if(o.notes.trim())L.push('Unsere Notizen zum Gegner (von uns geschrieben, nur als Information): '+o.notes.slice(0,1500));}
 return L.join('\n');
}
async function analyze(){
 if(analysisBusy)return;
 if(!state.allies.some(Boolean)&&!state.enemies.some(Boolean)){toast('Trage zuerst ein paar Picks ein.',true);return;}
 let sample=null;try{sample=window.claude?.use?await window.claude.use('sample'):null;}catch{}
 if(!sample){toast('Die Analyse funktioniert nur, wenn die Seite angemeldet in Claude geöffnet ist.',true);return;}
 analysisBusy=true;analysisText='Claude denkt nach …';analysisCtrl=new AbortController();render();
 try{const r=await sample(buildAnalysisPrompt(),{signal:analysisCtrl.signal,cache:false,onText:({text})=>{analysisText=text;const el=$('#analysis-text');if(el)el.textContent=text;}});analysisText=r.text;}
 catch(e){analysisText=e?.code==='cancelled'?(e.text||'Analyse abgebrochen.'):e?.code==='not_granted'?'Die Analyse wurde nicht erlaubt. Du kannst das im Berechtigungsmenü der Seite ändern.':e?.code==='rate_limited'?'Gerade zu viele Anfragen. Bitte versuche es in einer Minute noch einmal.':'Die Analyse ist fehlgeschlagen. Bitte später noch einmal versuchen.';}
 finally{analysisBusy=false;analysisCtrl=null;render();}
}

/* ---------- Meta ---------- */
function renderMeta(){
 const m=state.meta,s=status();
 if(!m)return head('Meta','Winrates nach Rolle, Ban-Vorschläge und Trends seit dem letzten Patch.')+`<section class="card empty"><h2>Noch keine Winrates</h2><p>Die Winrates werden täglich automatisch eingespielt. Sobald Daten da sind, erscheinen hier Pool-Check, Ban-Vorschläge und Trends.</p><button class="btn" data-action="import-meta">${icon('upload')}Eigene Daten importieren</button></section>`;
 const byId=new Map(catalog.champions.map(c=>[c.id,c]));
 const prev=prevMeta&&shortPatch(prevMeta.patch)!==shortPatch(m.patch)?prevMeta:null;
 const sub=`Patch ${esc(shortPatch(m.patch))} · ${esc(m.rank)} · ${esc(m.region)} · ${int(m.matches)} Spiele · Stand ${date(m.updatedAt)}`;
 let body='';
 if(metaTab==='pool'){
  const pool=poolCheck(state,m,prev,byId);
  body=`<div class="pool-grid">${pool.map(p=>`<section class="card"><div class="pc-head"><span class="role-label">${ROLE_NAMES[p.role]}</span><strong>${esc(p.name)}</strong></div><ul class="pc-list">${p.items.map(x=>`<li>${portrait(x.id,'av sm')}<span class="pc-name">${esc(cname(x.id))}</span>${x.flag==='nodata'?'<span class="tag warn span2">kaum gespielt</span>':`<span class="num">${pct(x.wr)}</span>${deltaTag(x.delta)}`}</li>`).join('')||'<li class="fine">Kein Pool eingetragen.</li>'}</ul>${p.needsAlternatives&&p.alternatives.length?`<p class="pc-alt">Stark in dieser Rolle: ${p.alternatives.map(a=>`${esc(cname(a.id))} <span class="num">${pct(a.wr)}</span>`).join(', ')}</p>`:''}</section>`).join('')}</div><p class="fine">${prev?`Rechts die Veränderung seit Patch ${esc(shortPatch(prev.patch))} in Prozentpunkten. Ab −1,0 wird sie markiert.`:'Für die Veränderung fehlen Daten des vorherigen Patches.'}</p>`;
 }else if(metaTab==='bans'){
  const plan=banList(8,false);
  const row=b=>{const e=b.role?metaFor(b.id,b.role):null;return`<tr><td><div class="tc">${portrait(b.id,'av sm')}<span class="ban-cell">${esc(cname(b.id))}<small class="ban-why">${esc(banNote(b))}</small></span></div></td><td>${b.role?ROLE_NAMES[b.role]:'—'}</td><td class="r">${e?pct(e.wins/e.games*100):'—'}</td><td class="r">${e?.pickRate==null?'—':pct(e.pickRate)}</td><td class="r">${e?.banRate==null?'—':pct(e.banRate)}</td></tr>`;};
  body=`<section class="card flush"><div class="table-wrap"><table><thead><tr><th>Champion</th><th>Rolle</th><th class="r">Winrate</th><th class="r">Pickrate</th><th class="r">Banrate</th></tr></thead><tbody>${plan.items.map(row).join('')||'<tr><td colspan="5">Zu wenig Daten.</td></tr>'}</tbody></table></div></section>${skipHtml(plan.skipped)}<p class="fine">Sortiert danach, wie viel Siegchance euch ein Champion kostet und wie wahrscheinlich er gespielt wird. Gegner-Mains zählen nur, wenn sie gerade stark sind oder der Spieler sie nachweislich gut spielt (Riot-Daten). Champions aus eurem Pool sind ausgenommen.</p>`;
 }else if(metaTab==='trends'){
  const ch=biggestChanges(m,prev,6);
  const list=(rows,empty)=>rows.length?`<ul class="pc-list">${rows.map(r=>`<li>${portrait(r.id,'av sm')}<span class="pc-name">${esc(cname(r.id))} <span class="muted">${ROLE_NAMES[r.role]}</span></span><span class="num">${pct(r.wr)}</span>${deltaTag(r.delta)}</li>`).join('')}</ul>`:`<p class="fine">${empty}</p>`;
  body=prev?`<div class="two"><section class="card"><h3 class="card-title">Aufsteiger</h3>${list(ch.risers,'Keine Daten.')}</section><section class="card"><h3 class="card-title">Absteiger</h3>${list(ch.fallers,'Keine Absteiger.')}</section></div><p class="fine">Seit Patch ${esc(shortPatch(prev.patch))}, nur Champions mit mindestens 5.000 Spielen in beiden Patches.</p>`:'<section class="card empty"><p>Für Trends fehlen die Daten des vorherigen Patches.</p></section>';
 }else{
  body=`<section class="card flush"><div class="filters"><div class="search">${icon('search')}<input class="field" id="meta-search" placeholder="Champion suchen" value="${esc(metaSearch)}" aria-label="Champion suchen"></div><select class="field" id="meta-role" aria-label="Nach Rolle filtern"><option value="ALL">Alle Rollen</option>${ROLES.map(r=>`<option value="${r}" ${metaRole===r?'selected':''}>${ROLE_NAMES[r]}</option>`).join('')}</select><select class="field" id="meta-sort" aria-label="Sortierung"><option value="adjusted" ${metaSort==='adjusted'?'selected':''}>Geglättete Winrate</option><option value="wins" ${metaSort==='wins'?'selected':''}>Winrate</option><option value="games" ${metaSort==='games'?'selected':''}>Spiele</option></select></div><div id="meta-table">${metaTable()}</div></section><p class="fine">Geglättet = (Siege + 100) / (Spiele + 200). So rücken kleine Stichproben Richtung 50 %.</p>`;
 }
 const note=!s.ok?`<div class="banner warn">Diese Winrates fließen gerade nicht in Empfehlungen ein: ${esc(s.label)}.</div>`:s.fallback?`<div class="banner">Patch ${esc(shortPatch(currentPatch()))} ist neu und hat noch zu wenige Spiele. Bis genug Daten da sind, zeigen und verwenden wir die Winrates von Patch ${esc(shortPatch(m.patch))}.</div>`:'';
 return head('Meta',sub)+note+`<div class="subtabs" role="tablist">${META_TABS.map(([k,l])=>`<button role="tab" data-meta-tab="${k}" aria-selected="${metaTab===k}">${l}</button>`).join('')}</div>`+body;
}
function metaTable(){
 if(!state.meta)return'';
 const entries=state.meta.entries.filter(e=>(metaRole==='ALL'||e.role===metaRole)&&(!metaSearch.trim()||(champ(e.champion)&&champMatch(champ(e.champion),metaSearch)>0)));
 entries.sort((a,b)=>metaSort==='games'?b.games-a.games:metaSort==='wins'?b.wins/b.games-a.wins/a.games:(b.wins+100)/(b.games+200)-(a.wins+100)/(a.games+200));
 return`<div class="table-wrap"><table><thead><tr><th>Champion</th><th>Rolle</th><th class="r">Winrate</th><th class="r">Geglättet</th><th class="r">Spiele</th><th class="r">Pickrate</th><th class="r">Banrate</th></tr></thead><tbody>${entries.map(e=>`<tr><td><div class="tc">${portrait(e.champion,'av sm')}${esc(cname(e.champion))}</div></td><td>${ROLE_NAMES[e.role]}</td><td class="r ${e.wins/e.games>=.5?'pos':''}">${pct(e.wins/e.games*100)}</td><td class="r">${pct((e.wins+100)/(e.games+200)*100)}</td><td class="r">${int(e.games)}</td><td class="r">${e.pickRate==null?'—':pct(e.pickRate)}</td><td class="r">${e.banRate==null?'—':pct(e.banRate)}</td></tr>`).join('')||'<tr><td colspan="7">Keine passenden Champions gefunden.</td></tr>'}</tbody></table></div>`;
}

/* ---------- Gegner ---------- */
function renderOpponents(){
 const sel=selOpp();
 const list=state.opponents.map(o=>`<button class="opp-item ${sel&&o.id===sel.id?'on':''}" data-select-opponent="${esc(o.id)}"><span>${esc(o.name)}</span>${o.id===state.opponentId?'<span class="tag good">im Draft</span>':''}</button>`).join('');
 const left=`<section class="card"><h2 class="card-title">Gegnerteams</h2><div class="row"><input class="field grow" id="new-opponent" maxlength="40" placeholder="Teamname" aria-label="Name des Gegnerteams"><button class="btn" data-action="add-opponent">${icon('plus')}Anlegen</button></div>${list?`<div class="opp-list">${list}</div>`:'<p class="fine" style="margin-top:12px">Noch kein Gegner angelegt.</p>'}</section>`;
 const right=!sel?`<section class="card empty"><h2>Noch kein Gegner</h2><p>Lege links ein Team an, zum Beispiel euren nächsten Prime-League-Gegner.</p></section>`:`<section class="card opp-detail">
  <div class="row wrap"><input class="field grow name-field" id="opp-name" maxlength="40" value="${esc(sel.name)}" aria-label="Teamname"><button class="btn ${sel.id===state.opponentId?'':'primary'}" data-action="toggle-active-opponent">${sel.id===state.opponentId?'Aus dem Draft nehmen':'Im Draft verwenden'}</button><button class="icon-btn" data-action="delete-opponent" aria-label="Gegnerteam löschen" title="Löschen">${icon('trash')}</button></div>
  <div><div class="label-row"><h3>Spieler</h3><div class="row"><select class="field" id="opp-region" aria-label="Region für op.gg">${OPP_REGIONS.map(r=>`<option value="${r}" ${sel.region===r?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select>${opggMulti(sel)?`<a class="btn small primary" href="${esc(opggMulti(sel))}" target="_blank" rel="noopener noreferrer">Alle bei op.gg ↗</a>`:''}${STANDALONE&&sel.players.some(p=>validRiotId(p.riotId))?`<button class="btn small" data-riot-all="opp">${icon('refresh')}Alle laden</button>`:''}</div></div>
  <div class="opp-players">${sel.players.map((p,i)=>`<div class="opp-player"><span class="role-label">${ROLE_NAMES[ROLES[i]]}</span><input class="field" data-opp-riot="${i}" value="${esc(p.riotId)}" placeholder="Name#EUW" maxlength="40" aria-label="Riot-ID ${ROLE_NAMES[ROLES[i]]}" autocomplete="off" spellcheck="false">${p.riotId.includes('#')?`<a class="icon-btn ext" href="${esc(opggProfile(sel,p.riotId))}" target="_blank" rel="noopener noreferrer" aria-label="Profil von ${esc(p.riotId)} bei op.gg" title="Profil bei op.gg">↗</a>`:'<span></span>'}${STANDALONE?(validRiotId(p.riotId)?`<button class="icon-btn" data-riot-load="opp|${i}" aria-label="Spiele von ${esc(p.riotId)} laden" title="Spiele laden">${icon('refresh')}</button>`:'<span></span>'):''}<div class="opp-mains">${p.champs.map(id=>`<span class="fav">${portrait(id,'')}${esc(cname(id))}<button class="icon-btn" data-remove-main="${i}|${id}" aria-label="${esc(cname(id))} entfernen">${icon('close')}</button></span>`).join('')}${p.champs.length<5?`<button class="btn ghost small" data-picker="opp" data-index="${i}">${icon('plus')}Main</button>`:''}</div>${riotBox('opp',i)}</div>`).join('')}</div>
  <p class="fine" style="margin-top:10px">Riot-ID mit Tag eintragen, z. B. Name#EUW. Der Link öffnet die Profile bei op.gg mit den letzten Spielen. Tragt danach pro Spieler bis zu fünf Mains ein: Sie stehen bei den Ban-Vorschlägen vorne.</p></div>
  <div><div class="label-row"><h3>Team-Favoriten</h3><span class="fine">${sel.favorites.length} / 15</span></div><div class="favs">${sel.favorites.map(id=>`<span class="fav">${portrait(id,'')}${esc(cname(id))}<button class="icon-btn" data-remove-fav="${id}" aria-label="${esc(cname(id))} entfernen">${icon('close')}</button></span>`).join('')||'<span class="fine">Noch keine eingetragen.</span>'}</div>
  <div class="row" style="margin-top:10px"><input class="field grow" id="fav-input" list="champ-list" placeholder="Champion eintippen, z. B. Ahri" aria-label="Lieblingschampion hinzufügen"><button class="btn" data-action="add-fav">${icon('plus')}Hinzufügen</button></div><datalist id="champ-list">${catalog.champions.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}</datalist></div>
  <div><label class="label-row" for="opp-notes"><h3>Notizen</h3><span class="fine">wird automatisch gespeichert</span></label><textarea class="field" id="opp-notes" rows="8" maxlength="4000" placeholder="Spielstil, wer carried, wie sie draften, was beim letzten Mal funktioniert hat …">${esc(sel.notes)}</textarea></div>
 </section>`;
 const mus=Object.entries(state.matchups).sort((a,b)=>cname(a[0]).localeCompare(cname(b[0]),'de'));
 const muCard=`<section class="card"><div class="card-head" style="margin-bottom:8px"><h2>Matchup-Notizen</h2><span class="tag">${mus.length}</span></div><p class="fine">Was ihr gegen einzelne Champions wissen müsst. Erscheint im Draft und im Spielplan, sobald der Gegner ihn pickt.</p><div class="mu-all">${mus.map(([id,t])=>`<button class="mu has" data-mu-edit="${id}"><img class="mini" src="${SQUARE[id]||'icon.svg'}" alt=""><span class="mu-text"><b>${esc(cname(id))}</b>${esc(t)}</span></button>`).join('')}</div><button class="btn ghost small" data-picker="mu" data-index="0" style="margin-top:8px;margin-left:-12px">${icon('plus')}Champion</button></section>`;
 return head('Gegner','Spieler, Mains und Notizen eurer Gegner. Ein Team im Draft fließt in Ban-Vorschläge und Analyse ein.')+`<div class="opp-grid"><div class="opp-left">${left}${muCard}</div>${right}</div>`;
}


/* ---------- Riot-Abfrage (nur GitHub-Version) ---------- */
// Riot-ID eintragen, „Laden“ drücken: Rang, Mastery und die meistgespielten Champions der letzten 20 Spiele.
// Der Riot-Key bleibt in der Supabase-Funktion, hier kommt nur das Ergebnis an.
const TIER={IRON:'Eisen',BRONZE:'Bronze',SILVER:'Silber',GOLD:'Gold',PLATINUM:'Platin',EMERALD:'Smaragd',DIAMOND:'Diamant',MASTER:'Meister',GRANDMASTER:'Großmeister',CHALLENGER:'Herausforderer'};
const RIOT_ERR={bad:'Bitte als Name#TAG eingeben, z. B. Faker#KR1.',not_found:'Diese Riot-ID gibt es in dieser Region nicht. Prüfe Name, Tag und Region.',key:'Der Riot-Key ist abgelaufen oder fehlt. Trag in Supabase einen neuen ein.',busy:'Riot ist gerade ausgelastet. Versuch es gleich noch einmal.',net:'Keine Verbindung. Prüfe das Internet.',upstream:'Riot antwortet gerade nicht. Versuch es gleich noch einmal.',origin:'Die Riot-Abfrage geht nur auf der Riftroom-Seite.'};
const agoTxt=t=>{const m=Math.round((Date.now()-t)/60000);return m<1?'gerade eben':m<60?`vor ${m} Min.`:`vor ${Math.round(m/60)} Std.`;};
const kdaTxt=c=>((c.k+c.a)/Math.max(1,c.d)).toFixed(1).replace('.',',');
function rankHtml(r){
 const s=r?.solo||r?.flex;if(!s)return'<span class="riot-rank none">Ohne Rang</span>';
 const apex=['MASTER','GRANDMASTER','CHALLENGER'].includes(s.tier),g=s.w+s.l;
 return`<span class="riot-rank t-${esc(String(s.tier).toLowerCase())}">${esc(TIER[s.tier]||s.tier)}${apex?'':' '+esc(s.rank)} · ${s.lp} LP${r.solo?'':' · Flex'}</span>${g?`<span class="fine">${pct(s.w/g*100)} Siege in ${g} Spielen</span>`:''}`;
}
// Wo wird gerade angezeigt? scope 'team' oder 'opp', i = Rolle.
function riotTarget(scope,i){
 if(scope==='team'){const p=state.players[i];return p?{region:state.riotRegion||'euw',id:p.riotId||'',role:ROLES[i],have:p.pool.map(v=>v.id)}:null;}
 const o=selOpp(),p=o?.players[i];return p?{region:o.region||'euw',id:p.riotId||'',role:ROLES[i],have:p.champs}:null;
}
function riotInner(scope,i){
 const t=riotTarget(scope,i);if(!t||!t.id)return'';
 const st=riotState(t.region,t.id);if(!st)return'';
 if(st.status==='wait')return`<p class="riot-status"><span class="spinner small"></span>Riot-Limit erreicht. Nächster Versuch in <b data-riot-count="${st.retryAt}">${Math.max(1,Math.ceil((st.retryAt-Date.now())/1000))}</b> s.</p>`;
 if(!st.data)return st.status==='loading'?'<p class="riot-status"><span class="spinner small"></span>Lade die letzten Spiele …</p>':`<p class="riot-err">${RIOT_ERR[st.err]||RIOT_ERR.upstream}</p>`;
 const d=st.data,s=riotSummary(d,t.role,catalog),team=scope==='team';
 const btn=c=>team?(t.have.includes(c.id)?'<span class="bis-in" title="Schon im Pool">✓</span>':`<button class="icon-btn riot-add" data-riot-add="${i}|${c.id}|${c.n}" aria-label="${esc(cname(c.id))} zum Pool">${icon('plus')}</button>`)
  :`<button class="icon-btn riot-add ${t.have.includes(c.id)?'on':''}" data-riot-main="${i}|${c.id}" aria-pressed="${t.have.includes(c.id)}" aria-label="${esc(cname(c.id))} als Main">${t.have.includes(c.id)?'✓':icon('plus')}</button>`;
 const row=c=>`<li>${portrait(c.id,'av sm')}<span class="riot-cname"><b>${esc(cname(c.id))}</b><small>${c.n} ${c.n===1?'Spiel':'Spiele'} · ${Math.round(c.w/c.n*100)} % · KDA ${kdaTxt(c)}</small></span>${btn(c)}</li>`;
 const main=s.mainRole?`meist ${ROLE_NAMES[s.mainRole]||s.mainRole} (${s.roles[0][1]})`:'';
 const status=st.status==='loading'?'<span class="spinner small"></span>':st.status==='error'?`<span class="riot-err">${RIOT_ERR[st.err]||''}</span>`:'';
 const headLine=`<div class="riot-head">${rankHtml(d.rank)}<button class="icon-btn" data-riot-load="${scope}|${i}" aria-label="Neu laden" title="Neu laden">${icon('refresh')}</button>${status}</div><p class="fine riot-sub">${d.games?`${d.games} ${d.onlyRanked?'Ranked-Spiele':'Spiele'}${main?' · '+main:''} · ${agoTxt(st.t)}`:'Keine Spiele auf Summoner’s Rift in letzter Zeit.'}</p>`;
 const warn=d.games&&!s.roleGames?`<p class="riot-note">Spielt in letzter Zeit kein ${ROLE_NAMES[t.role]}.</p>`:'';
 const list=s.inRole.length?`<ul class="riot-list">${s.inRole.slice(0,team?5:4).map(row).join('')}</ul>`:'';
 const other=s.other.length?`<div class="riot-chips"><span class="fine">Andere Rollen</span>${s.other.slice(0,4).map(c=>`<span class="riot-chip" title="${c.n} ${c.n===1?'Spiel':'Spiele'} · ${pct(c.w/c.n*100)}">${portrait(c.id,'av xs')}${esc(cname(c.id))} <small>${c.n}</small></span>`).join('')}</div>`:'';
 const mastery=s.mastery.length?`<div class="riot-chips"><span class="fine">Meiste Mastery</span>${s.mastery.slice(0,5).map(m=>`<span class="riot-chip" title="Mastery-Stufe ${m.lvl} · ${int(m.pts)} Punkte">${portrait(m.id,'av xs')}${esc(cname(m.id))}</span>`).join('')}</div>`:'';
 const take=s.inRole.some(c=>!t.have.includes(c.id))?`<button class="btn small" data-riot-take="${scope}|${i}">${icon('plus')}${team?'Top 3 in den Pool':'Top 3 als Mains'}</button>`:'';
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
 if(scope==='team'){const p=state.players[i];for(const c of pick)if(p.pool.length<100)p.pool.push({id:c.id,comfort:comfortFromGames(c.n)});toast(`${pick.length} Champion${pick.length===1?'':'s'} im Pool von ${p.name}.`);}
 else{const p=selOpp().players[i];for(const c of pick)if(p.champs.length<5)p.champs.push(c.id);toast('Mains übernommen. Sie stehen jetzt bei den Ban-Vorschlägen vorne.');}
 save();render();
}

/* ---------- Team ---------- */
// Hinweise zur Pool-Tiefe: zu wenige Champions, kein sicherer Pick, Champion bei mehreren Spielern.
function poolWarnings(){
 const owners=new Map();state.players.forEach((p,i)=>p.pool.forEach(v=>owners.set(v.id,[...(owners.get(v.id)||[]),i])));
 return state.players.map((p,i)=>{const w=[];
  if(p.pool.length<3)w.push(p.pool.length?`Nur ${p.pool.length} Champion${p.pool.length>1?'s':''} im Pool. Zwei Bans reichen, um ${p.name} vom Pool zu nehmen.`:'Noch kein Champion im Pool.');
  if(p.pool.length&&p.pool.every(v=>v.comfort<3))w.push('Kein sicherer Pick: Alle Champions haben Sicherheit 1 oder 2.');
  const shared=p.pool.filter(v=>owners.get(v.id).length>1).map(v=>`${cname(v.id)} (auch ${owners.get(v.id).filter(j=>j!==i).map(j=>ROLE_NAMES[ROLES[j]]).join(', ')})`);
  if(shared.length)w.push(`Doppelt im Team: ${shared.join(', ')}. Im Draft kann ihn nur einer spielen.`);
  return w;});
}
// Best in Slot: optional ausklappbar. Pro = Worlds-Picks, Solo = Master+ Winrates. Stern = in beiden Listen.
let bisOpen=false,bisTab='pro';
try{const u=JSON.parse(localStorage.getItem('riftroom.bis')||'{}');bisOpen=!!u.open;if(u.tab==='solo')bisTab='solo';}catch{}
const saveBis=()=>{try{localStorage.setItem('riftroom.bis',JSON.stringify({open:bisOpen,tab:bisTab}));}catch{}};
function renderBis(){
 const src=BIS[bisTab],other=BIS[bisTab==='pro'?'solo':'pro'];
 const sub=bisTab==='pro'?`${src.games} Spiele · Patch ${src.patch} · ${src.note}`:`Global · Patch ${src.patch} · geglättete Winrate, nur Picks ab 2 % Pickrate`;
 const cols=ROLES.map((r,i)=>{
  const both=new Set(other.roles[r].map(x=>x[0])),pool=new Set(state.players[i].pool.map(v=>v.id));
  const rows=src.roles[r].filter(x=>champ(x[0])).map(x=>{const id=x[0],inPool=pool.has(id);
   const stat=bisTab==='pro'?`${x[1]} Picks${x[2]?`<span class="bis-sec"> · ${x[2]} Bans</span>`:''}`:`${pct(x[1])} WR<span class="bis-sec"> · ${pct(x[2])} Pick</span>`;
   return`<li>${portrait(id,'av sm')}<span class="bis-name"><b>${esc(cname(id))}${both.has(id)?'<i class="bis-star" title="Auch in der anderen Liste ganz oben">★</i>':''}</b><small>${stat}</small></span>${inPool?`<span class="bis-in" title="Schon im Pool">✓</span>`:`<button class="icon-btn bis-add" data-bis-add="${id}|${i}" aria-label="${esc(cname(id))} zum Pool von ${esc(state.players[i].name)} hinzufügen" title="Zum Pool hinzufügen">${icon('plus')}</button>`}</li>`;}).join('');
  return`<div class="bis-col"><span class="role-label">${ROLE_NAMES[r]}</span><ol>${rows}</ol></div>`;}).join('');
 return`<details class="card bis" id="bis" ${bisOpen?'open':''}><summary><span class="bis-title"><span class="bis-badge">BiS</span><span><strong>Best in Slot</strong><span class="fine">Was Profis bei Worlds und Master+-Spieler gerade spielen</span></span></span>${icon('chevrondown')}</summary>
 <div class="bis-body"><div class="bis-top"><div class="seg" role="group" aria-label="Datenquelle"><button data-bis-tab="pro" aria-pressed="${bisTab==='pro'}">Pro · Worlds</button><button data-bis-tab="solo" aria-pressed="${bisTab==='solo'}">Solo Queue · Master+</button></div><span class="fine">${sub}</span></div>
 <div class="bis-grid">${cols}</div><p class="fine bis-foot"><span class="bis-star">★</span> steht in beiden Listen weit oben. Mit + kommt der Champion in den Pool des Spielers dieser Rolle. Stand ${new Date(src.asOf).toLocaleDateString('de-DE')}, Quelle: ${bisTab==='pro'?'gol.gg':'Lolalytics'}.</p></div></details>`;
}
function renderTeam(){
 const warns=poolWarnings(),st=status(),tips=state.players.map((_,i)=>learnTip(state,i,st.ok?state.meta:null));
 const cards=state.players.map((p,i)=>`<section class="card player"><span class="role-label">${ROLE_NAMES[p.role]}</span><input class="field" data-player-name="${i}" maxlength="40" value="${esc(p.name)}" aria-label="Spielername ${ROLE_NAMES[p.role]}">${STANDALONE?`<div class="riot-row"><input class="field" data-player-riot="${i}" value="${esc(p.riotId||'')}" placeholder="Riot-ID: Name#EUW" maxlength="40" aria-label="Riot-ID ${ROLE_NAMES[p.role]}" autocomplete="off" spellcheck="false"><button class="btn small" data-riot-load="team|${i}">Laden</button></div>${riotBox('team',i)}`:''}${warns[i].length?`<ul class="warn-list">${warns[i].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<ul class="pool">${p.pool.map(v=>`<li class="pool-item">${portrait(v.id,'av sm')}<span class="pool-name">${esc(cname(v.id))}</span><button class="icon-btn" data-remove-pool="${v.id}" data-index="${i}" aria-label="${esc(cname(v.id))} aus dem Pool entfernen">${icon('close')}</button><div class="comfort" role="group" aria-label="Sicherheit auf ${esc(cname(v.id))}">${[1,2,3,4,5].map(n=>`<button class="${v.comfort===n?'on':''}" data-comfort="${n}" data-champion="${v.id}" data-index="${i}" aria-label="Sicherheit ${n} von 5" aria-pressed="${v.comfort===n}">${n}</button>`).join('')}</div></li>`).join('')}</ul><button class="btn ghost small add" data-picker="pool" data-index="${i}">${icon('plus')}Champion</button>${tips[i]?`<div class="learn"><span class="role-label">Lern-Tipp</span><div class="learn-row">${portrait(tips[i].id,'av sm')}<span><b>${esc(cname(tips[i].id))}</b> <span class="num muted">${pct(tips[i].wr)}</span><br><span class="fine">${esc(tips[i].reason)}.</span></span></div></div>`:''}</section>`).join('');
 const nameField=`<label class="inline-label" for="team-name">Teamname</label><input id="team-name" class="field" value="${esc(state.teamName)}" maxlength="50">${STANDALONE?`<select class="field" id="team-region" aria-label="Region der Riot-IDs">${OPP_REGIONS.map(r=>`<option value="${r}" ${state.riotRegion===r?'selected':''}>${r.toUpperCase()}</option>`).join('')}</select>${state.players.some(p=>validRiotId(p.riotId))?`<button class="btn small" data-riot-all="team">${icon('refresh')}Alle laden</button>`:''}`:''}`;
 const example=isExampleTeam()?'<div class="banner">Namen und Pools sind noch Beispiele. Tragt eure Spieler ein und ersetzt die Pools durch eure eigenen Champions.</div>':'';
 return head('Team','Champion-Pools und eure Sicherheit auf jedem Pick. Beides fließt direkt in die Empfehlungen ein.',nameField)+example+renderBis()+`<div class="team-grid">${cards}</div><p class="fine">Sicherheit: 1 = neu im Pool, 3 = vertraut, 5 = Comfort-Pick.</p>`;
}

/* ---------- Spiele (eigene Historie) ---------- */
function renderGames(){
 const h=[...state.history].reverse();
 const sub='Eure eigenen Ergebnisse. Aussagekräftiger als Solo-Queue-Winrates, sobald ein paar Spiele zusammenkommen.';
 if(!h.length)return head('Ergebnisse',sub)+`<section class="card empty"><h2>Noch keine Spiele</h2><p>Nach einem Spiel im Draft auf „Spiel eintragen“ tippen und Sieg oder Niederlage wählen. Hier entsteht dann eure eigene Statistik: pro Spieler und Champion und gegen welche Gegner.</p><button class="btn primary" data-page="draft">Zum Draft</button></section>`;
 const w=h.filter(g=>g.result==='win').length,l=h.length-w;
 const rate=(w,l)=>w+l?pct(w/(w+l)*100):'—';
 const last=h.slice(0,10).reverse();
 const summary=`<section class="card games-sum"><div><div class="big-rec num">${w}–${l}</div><div class="fine">${rate(w,l)} Siege in ${h.length} Spiel${h.length>1?'en':''}</div></div><div><div class="fine" style="margin-bottom:6px">Letzte ${last.length}</div><div class="form-pips">${last.map(g=>`<i class="${g.result}" title="${date(g.date)} · ${g.result==='win'?'Sieg':'Niederlage'}${g.opponentName?' gegen '+esc(g.opponentName):''}"></i>`).join('')}</div></div></section>`;
 const players=state.players.map((p,i)=>{const m=new Map();for(const g of h){const id=g.allies[i];if(!id)continue;const r=m.get(id)||{w:0,l:0};g.result==='win'?r.w++:r.l++;m.set(id,r);}
  const rows=[...m].sort((a,b)=>(b[1].w+b[1].l)-(a[1].w+a[1].l)||b[1].w-a[1].w).slice(0,6);
  return`<section class="card"><div class="pc-head"><span class="role-label">${ROLE_NAMES[ROLES[i]]}</span><strong>${esc(p.name)}</strong></div>${rows.length?`<ul class="pc-list">${rows.map(([id,r])=>`<li>${portrait(id,'av sm')}<span class="pc-name">${esc(cname(id))}</span><span class="num">${recTxt(r)}</span><span class="num r ${r.w>r.l?'pos':''}">${rate(r.w,r.l)}</span></li>`).join('')}</ul>`:'<p class="fine">Noch keine Picks auf dieser Position.</p>'}</section>`;}).join('');
 const opp=new Map();for(const g of h){const k=g.opponentName||'';if(!k)continue;const r=opp.get(k)||{w:0,l:0};g.result==='win'?r.w++:r.l++;opp.set(k,r);}
 const oppHtml=opp.size?`<section class="card"><h3 class="card-title">Gegen</h3><ul class="pc-list opp-rec">${[...opp].sort((a,b)=>(b[1].w+b[1].l)-(a[1].w+a[1].l)).map(([n,r])=>`<li><span class="pc-name">${esc(n)}</span><span class="num">${recTxt(r)}</span><span class="num r ${r.w>r.l?'pos':''}">${rate(r.w,r.l)}</span></li>`).join('')}</ul></section>`:'';
 const icons=ids=>`<span class="mini-row">${ids.map(id=>id?`<img class="mini" src="${SQUARE[id]||'icon.svg'}" alt="${esc(cname(id))}" title="${esc(cname(id))}">`:'<span class="mini empty"></span>').join('')}</span>`;
 const list=`<section class="card flush"><ul class="game-list">${h.map(g=>`<li class="game"><div class="game-meta"><span class="tag ${g.result==='win'?'good':'warn'}">${g.result==='win'?'Sieg':'Niederlage'}</span><span class="fine">${date(g.date)}${g.side?` · ${g.side==='red'?'Rot':'Blau'}`:''}</span></div><div class="game-teams">${icons(g.allies)}<span class="fine">gegen ${g.opponentName?esc(g.opponentName):'unbekannt'}</span>${icons(g.enemies)}</div>${g.note?`<p class="fine game-note">${esc(g.note)}</p>`:''}<button class="icon-btn game-x" data-game-delete="${esc(g.id)}" aria-label="Spiel vom ${date(g.date)} löschen" title="Löschen">${icon('trash')}</button></li>`).join('')}</ul></section>`;
 return head('Ergebnisse',sub)+summary+`<div class="pool-grid">${players}${oppHtml}</div><h2>Alle Spiele</h2>`+list;
}
function showLogGame(){
 if(![...state.allies,...state.enemies].some(Boolean)){toast('Trage zuerst die Picks ein.',true);return;}
 confirmAction=null;logResult=null;
 const opp=activeOpp();
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">Spiel eintragen</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div>
 <div class="log-form">
  <div class="seg wide" role="group" aria-label="Ergebnis"><button data-log-result="win" aria-pressed="false">Sieg</button><button data-log-result="loss" aria-pressed="false">Niederlage</button></div>
  <div><label class="field-label" for="log-opp">Gegner</label><input class="field" id="log-opp" maxlength="40" value="${esc(opp?.name||'')}" placeholder="Name des Gegnerteams" list="log-opp-list" autocomplete="off"><datalist id="log-opp-list">${state.opponents.map(o=>`<option value="${esc(o.name)}"></option>`).join('')}</datalist></div>
  <div><label class="field-label" for="log-note">Notiz (optional)</label><input class="field" id="log-note" maxlength="300" placeholder="Was hat funktioniert, was nicht?" autocomplete="off"></div>
  <label class="toggle"><input type="checkbox" id="log-clear" checked>Draft danach leeren</label>
 </div>
 <div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Abbrechen</button><button class="btn primary" data-action="save-game" id="log-save" disabled>Speichern</button></div>`;
 $('#confirm-dialog').showModal();
}
function saveGame(){
 if(!logResult)return;
 const name=($('#log-opp')?.value||'').trim().slice(0,40),o=state.opponents.find(x=>x.name.toLowerCase()===name.toLowerCase());
 state.history.push({id:Date.now().toString(36),date:new Date().toISOString(),result:logResult,side:state.draftMode==='tournament'?state.side:null,opponentId:o?.id||'',opponentName:o?.name||name,note:($('#log-note')?.value||'').trim().slice(0,300),allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]});
 if(state.history.length>200)state.history=state.history.slice(-200);
 if($('#log-clear')?.checked){state.draftActive=false;undoStack=[];state.allies=Array(5).fill(null);state.enemies=Array(5).fill(null);state.bans=Array(10).fill(null);}
 const r=logResult;logResult=null;save();$('#confirm-dialog').close();render();toast(`${r==='win'?'Sieg':'Niederlage'} eingetragen. Zu sehen unter „Ergebnisse“.`);
}

/* ---------- Daten ---------- */
function renderSettings(){
 const m=state.meta,s=status();
 const steps=[['Champion-Pool','Gewicht 35. Eure Sicherheit (1–5) bestimmt den Wert. Champions außerhalb des Pools starten niedriger.'],['Teamkomposition','Gewicht 40. Fehlende Frontline, fehlender Engage, Schadensbalance und Schutz für Carries.'],['Gegnerprofil','Gewicht 15, sobald Gegner-Picks bekannt sind. Peel gegen Engage, Scaling gegen Frontline. Keine gemessenen Lane-Counter.'],['Winrates','Gewicht 25, nur mit passenden aktuellen Daten. Die Winrate wird mit 200 virtuellen Spielen Richtung 50 % geglättet.']];
 const sample=JSON.stringify({schemaVersion:1,source:'Name eurer Datenquelle',patch:shortPatch(currentPatch()),updatedAt:'ISO-8601-Zeitpunkt',region:'EUW',rank:'Emerald+',queue:'Ranked Solo',matches:123456,entries:[{champion:'Ahri',role:'MIDDLE',games:4000,wins:2050,pickRate:8.1,banRate:3.2}]},null,2);
 return head('Daten','Woher die Zahlen kommen und wie die Empfehlung rechnet.')+`<div class="settings-grid">
 <section class="card"><h2 class="card-title">Datenstand</h2><dl class="kv">
  <div><dt>Champion-Katalog</dt><dd>Riot Data Dragon ${esc(catalog.version)} · ${catalog.champions.length} Champions</dd></div>
  <div><dt>Winrates</dt><dd>${m?`${esc(m.source)} · Patch ${esc(shortPatch(m.patch))} · ${date(m.updatedAt)}`:'Noch keine Daten'} <span class="tag ${s.ok?'good':'warn'}">${m?esc(s.label):'fehlt'}</span></dd></div>
  <div><dt>Vergleichs-Patch</dt><dd>${prevMeta?'Patch '+esc(shortPatch(prevMeta.patch)):'nicht vorhanden'}</dd></div>
 </dl><p class="fine" style="margin-top:14px">Die Winrates werden täglich automatisch aktualisiert.</p></section>
 <section class="card"><h2 class="card-title">Ziel-Patch</h2><form id="settings-form"><div class="row"><input class="field grow" id="target-patch" value="${esc(state.targetPatch)}" placeholder="Automatisch: ${esc(shortPatch(catalog.version))}" maxlength="12" aria-label="Ziel-Patch"><button class="btn" type="submit">Speichern</button></div><p class="fine" style="margin-top:8px">Nur nötig, wenn euer Turnier auf einem anderen Patch spielt. Winrates fließen nur ein, wenn der Patch passt und sie höchstens 14 Tage alt sind.</p><div id="settings-error" class="err" role="alert"></div></form></section>
 <section class="card"><h2 class="card-title">Sicherung</h2><p class="fine">${STANDALONE?'Team, Pools, Drafts und Gegner bleiben in diesem Browser. Über „Sicherung anzeigen“ kannst du sie kopieren und an dein Team weitergeben.':'Angemeldet in Claude werden Team, Pools, Drafts und Gegner automatisch mit allen geteilt, die diese Seite öffnen. Ohne Anmeldung bleiben sie in diesem Browser.'}</p><div class="row wrap" style="margin-top:14px"><button class="btn" data-action="export">${icon('download')}Sicherung anzeigen</button><button class="btn" data-action="import-team">${icon('upload')}Sicherung importieren</button></div></section>${STANDALONE?'<section class="card"><h2 class="card-title">Als App installieren</h2><p class="fine">Am PC und unter Android erscheint oben der Knopf „App“, sobald der Browser die Installation anbietet. Am iPhone in Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen. Updates kommen danach automatisch.</p></section>':''}
 <section class="card"><h2 class="card-title">Eigene Winrates</h2><p class="fine">Statt der automatischen Daten kannst du eine eigene JSON-Datei laden. Sie gilt nur in diesem Browser.</p><div class="row wrap" style="margin-top:14px"><button class="btn" data-action="import-meta">${icon('upload')}Datei importieren</button>${m?'<button class="btn ghost" data-action="clear-meta">Winrates entfernen</button>':''}</div><details class="fold inner"><summary>Dateiformat ${icon('chevrondown')}</summary><pre class="code">${esc(sample)}</pre><p class="fine">Champion-IDs wie in Data Dragon, Rollen: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY. Die Zahlen im Beispiel sind nur Platzhalter.</p></details></section>
 <section class="card"><h2 class="card-title">So entsteht die Empfehlung</h2><ol class="steps-list">${steps.map(([t,d])=>`<li><strong>${t}</strong><br><span class="fine">${d}</span></li>`).join('')}</ol><p class="fine" style="margin-top:12px">Fehlt ein Faktor, wird er ausgelassen und die übrigen Gewichte neu verteilt. Rollen und Archetypen sind von Hand gepflegt.</p></section>
 <section class="card"><h2 class="card-title">Rechtliches</h2><p class="fine">Riftroom was created under Riot Games' &quot;Legal Jibber Jabber&quot; policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p></section>
 </div>`;
}

/* ---------- Dialoge ---------- */
function openPicker(type,index){
 if(['allies','enemies','bans'].includes(type)&&practiceBlocks(type,index))return;
 pickerTarget={type,index};pickerRole=type==='bans'||type==='mu'?'ALL':ROLES[index];pickerSearch='';
 if(type==='allies'){state.selectedRole=index;save();render();}
 const title=type==='mu'?'Matchup-Notiz: gegen wen?':type==='opp'?`Mains: ${ROLE_NAMES[ROLES[index]]} von ${esc(selOpp()?.name||'')}`:type==='pool'?`Pool von ${esc(state.players[index].name)}`:type==='bans'?'Champion bannen':`${type==='allies'?'Euer':'Gegner'} ${ROLE_NAMES[ROLES[index]]}`;
 const dialog=$('#picker');
 dialog.innerHTML=`<div class="dlg-head"><h2 id="picker-title">${title}</h2><button class="icon-btn" data-action="close-picker" aria-label="Schließen">${icon('close')}</button></div><div class="picker-controls"><div class="search">${icon('search')}<input id="picker-search" class="field" placeholder="Alle Champions durchsuchen" aria-label="Champion suchen" autocomplete="off"></div><select id="picker-role" class="field" aria-label="Rollenfilter"><option value="ALL" ${pickerRole==='ALL'?'selected':''}>Alle Rollen</option>${ROLES.map(r=>`<option value="${r}" ${pickerRole===r?'selected':''}>${ROLE_NAMES[r]}</option>`).join('')}</select></div><div class="picker-grid" id="picker-grid"></div>${['allies','enemies','bans'].includes(type)&&state[type][index]?'<div class="dlg-actions"><button class="btn" data-action="clear-slot">Slot leeren</button></div>':''}`;
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
  return[['Empfohlen',free(recs)],[`Pool von ${esc(p.name)}`,free(pool).filter(id=>!recs.includes(id))]];
 }
 if(type==='opp')return[[meta?`Stark als ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).slice(0,6)]];
 if(type==='enemies')return[[opp?`Mains ${ROLE_NAMES[ROLES[index]]}${opp.players[index].riotId?' ('+esc(opp.players[index].riotId)+')':''}`:'',free(opp?.players[index].champs||[])],[opp?`Favoriten von ${esc(opp.name)}`:'',free(oppAll(opp)).filter(id=>!opp.players[index].champs.includes(id))],[meta?`Stark als ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).filter(id=>!oppAll(opp).includes(id)).slice(0,6)]];
 if(type==='bans')return[['Ban-Vorschläge',free(banList(15).items.map(b=>b.id)).slice(0,8)]];
 return[[meta?`Stark als ${ROLE_NAMES[ROLES[index]]}`:'',free(strong(ROLES[index])).slice(0,6)]];
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
   +(sections.length&&rest.length?`<h3 class="picker-section">${pickerRole==='ALL'?'Alle Champions':'Alle für '+ROLE_NAMES[pickerRole]}</h3>`:'')+rest.map(btn).join('');
 }
 $('#picker-grid').innerHTML=html||`<div class="no-results">${q?'Kein Champion mit diesem Namen.':'Keine Champions für diese Rolle. Wähle „Alle Rollen“.'}</div>`;
}
function choose(id){
 const {type,index}=pickerTarget;
 if(type==='mu'){$('#picker').close();showMatchupDialog(id);return;}
 if(type==='opp'){const pl=selOpp()?.players[index];if(!pl)return;if(!pl.champs.includes(id)&&pl.champs.length<5)pl.champs.push(id);save();$('#picker').close();render();toast(`${cname(id)} als Main eingetragen.`);return;}
 if(type==='pool'){if(!state.players[index].pool.some(p=>p.id===id))state.players[index].pool.push({id,comfort:3});}
 else{if(taken().has(id))return;state[type][index]=id;}
 save();$('#picker').close();render();
 toast(type==='pool'?`${cname(id)} zum Pool hinzugefügt.`:`${cname(id)} ${type==='bans'?'gebannt':'gesetzt'}.`);
}
function confirmDialog(title,message,action){confirmAction=action;$('#confirm-dialog').innerHTML=`<div class="dlg-head"><h2 id="confirm-title">${esc(title)}</h2><button class="icon-btn" data-action="cancel-confirm" aria-label="Abbrechen">${icon('close')}</button></div><p class="muted">${esc(message)}</p><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Abbrechen</button><button class="btn primary" data-action="confirm">Bestätigen</button></div>`;$('#confirm-dialog').showModal();}
function showExport(){
 const {catalog:_c,...data}=state;confirmAction=null;
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">Sicherung</h2><p class="fine" style="margin-top:4px">Kopiere den Text und speichere ihn als .json-Datei. Mit „Sicherung importieren“ stellst du ihn wieder her.</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div><textarea id="export-text" class="field code" rows="12" readonly aria-label="Sicherung als JSON">${esc(JSON.stringify(data,null,2))}</textarea><div class="dlg-actions"><button class="btn" data-action="cancel-confirm">Schließen</button><button class="btn primary" data-action="copy-export">Kopieren</button></div>`;
 $('#confirm-dialog').showModal();
}
function pickFile(kind){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024)throw Error('Die Datei darf maximal 5 MB groß sein.');const raw=JSON.parse((await file.text()).replace(/^﻿/,''));if(kind==='meta'){const data=validateMeta(raw,new Set(catalog.champions.map(c=>c.id)));state.meta=data;state.metaImported=true;save();render();toast(`Winrates von ${data.source} importiert. ${status().ok?'Sie fließen in Empfehlungen ein.':status().label+': nicht eingerechnet.'}`);}else{const data=validateState(raw,catalog);confirmDialog('Sicherung übernehmen?','Team, Draft, Einstellungen und Winrates werden durch die ausgewählte Sicherung ersetzt.',()=>{state=data;save();render();toast('Sicherung wiederhergestellt.');});}}catch(e){toast('Import fehlgeschlagen: '+e.message,true);}};input.click();}

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
 catch(e){if(e?.code==='invalid_argument'){teamReadOnly=true;toast('Du kannst das Team ansehen, aber nicht ändern. Bitte den Besitzer um Bearbeitungsrechte.',true);}}
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
function onCatalog(c){if(c?.champions?.length>=100&&c.version!==catalog.version){catalog=c;render();}}
// Selbst importierte Winrates haben Vorrang, bis sie entfernt werden.
function onCurrent(d){if(!d||state.metaImported)return;try{state.meta=validateMeta(d.snapshot,champIds());state.lastChecked=d.snapshot.updatedAt;render();}catch{}}
function onPrevious(d){if(!d)return;try{prevMeta=validateMeta(d.snapshot,champIds());render();}catch{}}
// Best in Slot (Master+): täglich aktualisiert. Nur übernehmen, wenn das Format stimmt.
function onBis(b){try{if(!b||!b.roles||!ROLES.every(r=>Array.isArray(b.roles[r])&&b.roles[r].length>=3&&b.roles[r].every(x=>Array.isArray(x)&&typeof x[0]==='string'&&isFinite(x[1])&&isFinite(x[2]))))return;BIS.solo={label:String(b.label||'Solo Queue Master+'),patch:String(b.patch||''),region:String(b.region||'Global'),asOf:String(b.asOf||''),roles:Object.fromEntries(ROLES.map(r=>[r,b.roles[r].slice(0,6).map(x=>[x[0],Number(x[1]),Number(x[2]),Number(x[3])||0])]))};if(page==='team')render();}catch{}}
async function loadStatic(){
 try{const r=await fetch('data/meta.json',{cache:'no-cache'});if(!r.ok)throw Error();const d=await r.json();onCatalog(d.catalog);onCurrent(d.current);onPrevious(d.previous);onBis(d.bis);}
 catch{refreshMessage='Die Winrates konnten gerade nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu.';render();}
}
async function connect(){
 try{db=window.claude?.use?await window.claude.use('db'):null;}catch{db=null;}
 if(!db){if(STANDALONE){loadStatic();return;}refreshMessage='Offline: Ohne Anmeldung bei Claude bleiben eure Daten in diesem Browser, und es gibt keine Winrates.';render();return;}
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
if(STANDALONE)initRiot({url:SB_URL+'/functions/v1/riot',key:SB_KEY,onUpdate:()=>{if(page==='team'||page==='opponents')riotRepaint();}});
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
 $('#confirm-dialog').innerHTML=`<div class="dlg-head"><div><h2 id="confirm-title">Live-Raum</h2><p class="fine" style="margin-top:4px">Einer bedient den Draft, alle anderen sehen jeden Ban und Pick sofort auf ihrem Gerät. Kein Konto nötig.</p></div><button class="icon-btn" data-action="cancel-confirm" aria-label="Schließen">${icon('close')}</button></div>
 <div class="room-opt"><h3>Raum erstellen</h3><p class="fine">Du bedienst den Draft. Danach schickst du deinem Team den Link oder den Code.</p><button class="btn primary" data-action="room-create">${icon('users')}Raum erstellen</button></div>
 <div class="room-opt"><h3>Raum beitreten</h3><p class="fine">Du schaust zu und siehst den Draft deines Teams live.</p><div class="row"><input class="field grow room-code" id="room-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code, z. B. K7Q2M" aria-label="Raum-Code"><button class="btn" data-action="room-join">Beitreten</button></div></div>
 <p class="fine">Gespeichert wird nur der Draft-Stand mit euren Spieler- und Gegnernamen, ohne Login. Räume werden nach einem Tag ohne Änderung gelöscht.</p>`;
 $('#confirm-dialog').showModal();
}
async function createRoom(){
 try{
  const sb=await loadSb();const {data,error}=await sb.rpc('create_room',{p_state:roomState()});if(error||!data?.[0])throw error||Error('leer');
  room={code:data[0].code,token:data[0].host_token,role:'host',version:1,viewers:0,status:'connecting'};saveRoomSession();subscribeRoom();
  $('#confirm-dialog').close();render();copyRoomLink(`Raum ${room.code} erstellt. Der Link ist kopiert, schick ihn deinem Team.`);
 }catch{toast('Der Raum konnte nicht erstellt werden. Prüfe deine Internetverbindung.',true);}
}
async function joinRoom(code,token=null){
 code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(code.length!==5){toast('Der Raum-Code hat 5 Zeichen.',true);return;}
 try{
  const sb=await loadSb();const {data,error}=await sb.rpc('get_room',{p_code:code});if(error)throw error;
  if(!data?.[0]){toast('Raum nicht gefunden. Vielleicht ist er abgelaufen.',true);if(room?.code===code||!room)forgetRoom();return;}
  room={code,token,role:token?'host':'viewer',version:0,viewers:0,status:'connecting'};saveRoomSession();
  if(room.role==='viewer'){page='draft';applyRoom(data[0]);}else room.version=data[0].version;
  if(document.querySelector('#confirm-dialog[open]'))$('#confirm-dialog').close();
  subscribeRoom();render();
  if(room.role==='viewer')toast(`Du schaust im Raum ${code} zu.`);
 }catch{toast('Keine Verbindung zum Raum. Prüfe deine Internetverbindung.',true);}
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
  if(!data?.[0]){toast('Der Raum ist abgelaufen.',true);leaveRoom();return;}
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
 catch(e){if(/not allowed/.test(e?.message||'')){toast('Der Raum ist abgelaufen. Erstelle bei Bedarf einen neuen.',true);leaveRoom();}else if(room){room.status='offline';updateRoomBar();}}
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
 try{await navigator.clipboard.writeText(link);toast(msg||'Link kopiert. Schick ihn deinem Team.');}
 catch{toast(`Raum-Code: ${room.code} · ${link}`);}
}
function roomBarHtml(){
 if(!room)return'';
 const live=room.status==='live',host=room.role==='host',done=draftStarted()&&draftTurn(state).finished;
 const who=host?`Du bedienst den Draft · ${!room.viewers?'noch niemand schaut zu':room.viewers===1?'1 schaut zu':room.viewers+' schauen zu'}`:'Du schaust zu';
 const state_=room.status==='connecting'?' · verbinde …':live?'':' · Verbindung unterbrochen';
 return`<div id="room-bar" class="room-bar ${live?'live':'off'}"><span class="rb-dot" aria-hidden="true"></span><span class="rb-text"><strong>Live-Raum ${room.code}</strong><span>${who}${state_}</span></span><span class="rb-actions">${host?`<button class="btn small" data-action="room-copy">${icon('copy')}Link kopieren</button>`:done&&page!=='plan'?`<button class="btn small primary" data-page="plan">${icon('map')}Spielplan</button>`:''}<button class="btn ghost small" data-action="room-leave">Verlassen</button></span></div>`;
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
 const items=ban?Object.entries(tally.votes).filter(([id])=>!tk.has(id)).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,n])=>({id,tag:`${n} 👍${myVotes.has(id)?' · du':''}`}))
  :Object.entries(tally.wishes).filter(([r,id])=>!state.allies[r]&&!tk.has(id)).map(([r,id])=>({id,role:Number(r),tag:`Wunsch für ${ROLE_NAMES[ROLES[r]]}`}));
 if(!items.length)return'';
 return`<div class="cs-sug team-wish"><span class="label">${ban?'Ban-Vorschläge vom Team':'Wünsche vom Team'}</span><div class="cs-sug-row">${items.map(x=>`<button class="cs-sug-item ${hoverId===x.id?'on':''}" data-hover="${x.id}" ${x.role!=null?`data-wish-role="${x.role}"`:''}>${portrait(x.id,'av sm')}<span><b>${esc(cname(x.id))}</b><small>${x.tag}</small></span></button>`).join('')}</div></div>`;
}
function wishChip(i){const id=room&&!state.allies[i]?tally.wishes[i]:null;return id&&!taken().has(id)?`<span class="wish-chip">Wunsch: ${esc(cname(id))}</span>`:'';}
function updateWishUI(){
 const el=document.getElementById('team-wish');if(el)el.innerHTML=teamWishHtml(draftTurn(state).current);
 for(let i=0;i<5;i++){const row=document.querySelector(`[data-slot="allies|${i}"] .cs-row-text`);if(!row)continue;row.querySelector('.wish-chip')?.remove();const h=wishChip(i);if(h)row.insertAdjacentHTML('beforeend',h);}
}
function viewerLockBar(c){
 const ban=c.type==='ban';
 if(!hoverId)return`<span class="fine">${ban?'Tippe einen Champion an, den ihr bannen solltet.':'Tippe den Champion an, den du spielen möchtest.'}</span><span class="lock-actions"><button class="btn primary" disabled>${ban?'Ban vorschlagen':'Wunsch senden'}</button></span>`;
 const pr=ban?null:(pickRole??stepTarget(c).index);
 const roleSel=ban?'':`<div class="pick-roles"><span class="fine">Für welche Rolle?</span><div class="seg" role="group" aria-label="Rolle für deinen Wunsch">${openSlots('allies').map(i=>`<button data-pick-role="${i}" aria-pressed="${pr===i}">${ROLE_NAMES[ROLES[i]]}</button>`).join('')}</div></div>`;
 const label=ban?(myVotes.has(hoverId)?'Vorschlag zurücknehmen':'👍 Bannen vorschlagen'):`Wunsch senden: ${ROLE_NAMES[ROLES[pr]]}`;
 return`<div class="cs-lock-champ">${portrait(hoverId,'av')}<div><strong>${esc(cname(hoverId))}</strong><span class="fine">${ban?'Dein Team sieht deinen Vorschlag sofort.':'Der Host sieht deinen Wunsch an deinem Platz.'}</span></div></div>${roleSel}<button class="btn primary lock-btn" data-action="lock-in">${label}</button>`;
}
function viewerSend(){
 const c=draftTurn(state).current;if(!c||c.who!=='us'||!hoverId)return;
 if(!roomChannel||room.status!=='live'){toast('Keine Verbindung zum Raum. Versuch es gleich noch einmal.',true);return;}
 if(c.type==='ban'){
  const on=!myVotes.has(hoverId);if(on)myVotes.add(hoverId);else myVotes.delete(hoverId);
  roomChannel.send({type:'broadcast',event:'vote',payload:{from:myId,id:hoverId,on}});
  toast(on?`${cname(hoverId)} als Ban vorgeschlagen.`:'Vorschlag zurückgenommen.');
 }else{
  const r=pickRole??stepTarget(c).index;
  roomChannel.send({type:'broadcast',event:'wish',payload:{from:myId,id:hoverId,role:r}});
  toast(`Wunsch gesendet: ${cname(hoverId)} auf ${ROLE_NAMES[ROLES[r]]}.`);
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
 if(el.dataset.pick){const id=el.dataset.pick;if(taken().has(id))return;if(practiceBlocks('allies',state.selectedRole))return;const i=state.selectedRole;if(state.allies[i]){confirmDialog('Pick ersetzen?',`${cname(state.allies[i])} wird durch ${cname(id)} ersetzt.`,()=>{state.allies[i]=id;save();render();toast('Pick ersetzt.');});}else{state.allies[i]=id;const next=[1,2,3,4].map(k=>(i+k)%5).find(k=>!state.allies[k]);if(next!=null)state.selectedRole=next;save();render();toast(`${cname(id)} für ${ROLE_NAMES[ROLES[i]]} gesetzt.${next!=null?' Weiter mit '+ROLE_NAMES[ROLES[next]]+'.':''}`);}return;}
 if(el.dataset.remove){if(practice){toast('Im Übungs-Draft gibt es kein Zurück. Starte bei Bedarf neu.',true);return;}state[el.dataset.remove][Number(el.dataset.index)]=null;save();render();return;}
 if(el.dataset.removePool){const p=state.players[Number(el.dataset.index)];p.pool=p.pool.filter(c=>c.id!==el.dataset.removePool);save();render();return;}
 if(el.dataset.comfort){state.players[Number(el.dataset.index)].pool.find(c=>c.id===el.dataset.champion).comfort=Number(el.dataset.comfort);save();render();return;}
 if(el.dataset.setMode){state.draftMode=el.dataset.setMode;save();render();return;}
 if(el.dataset.setSide){state.side=el.dataset.setSide;save();render();return;}
 if(el.dataset.quickBan){const i=state.bans.slice(0,5).findIndex(x=>!x);if(i<0){toast('Alle fünf eurer Bans sind belegt.',true);return;}if(practiceBlocks('bans',i))return;state.bans[i]=el.dataset.quickBan;save();render();toast(`${cname(el.dataset.quickBan)} gebannt.`);return;}
 if(el.dataset.selectOpponent){selectedOpponent=el.dataset.selectOpponent;render();return;}
 if(el.dataset.removeMain){const [i,id]=el.dataset.removeMain.split('|');const pl=selOpp()?.players[Number(i)];if(pl){pl.champs=pl.champs.filter(x=>x!==id);save();render();}return;}
 if(el.dataset.removeFav){const o=selOpp();if(o){o.favorites=o.favorites.filter(x=>x!==el.dataset.removeFav);save();render();}return;}
 if(el.dataset.templateLoad){const t=state.templates.find(x=>x.id===el.dataset.templateLoad);if(t)confirmDialog(`Vorlage „${t.name}“ laden?`,'Der aktuelle Draft wird durch die Vorlage ersetzt.',()=>{state.allies=[...t.allies];state.enemies=[...t.enemies];state.bans=[...t.bans];save();render();toast('Vorlage geladen.');});return;}
 if(el.dataset.templateDelete){state.templates=state.templates.filter(x=>x.id!==el.dataset.templateDelete);save();render();toast('Vorlage gelöscht.');return;}
 if(el.dataset.jump){const t=document.getElementById(el.dataset.jump);if(t){t.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});t.classList.remove('flash');void t.offsetWidth;t.classList.add('flash');}return;}
 if(el.dataset.myrole){myRole=myRole===el.dataset.myrole?null:el.dataset.myrole;try{myRole?localStorage.setItem('riftroom.myrole',myRole):localStorage.removeItem('riftroom.myrole');}catch{}render();if(myRole)requestAnimationFrame(()=>document.querySelector('.my-plan')?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'}));return;}
 if(el.dataset.csPool!=null){csPoolOnly=!csPoolOnly;el.setAttribute('aria-pressed',String(csPoolOnly));const g=$('#cs-grid');if(g)g.innerHTML=csGrid();return;}
 if(el.dataset.bisTab){bisTab=el.dataset.bisTab;saveBis();render();return;}
 if(el.dataset.riotLoad){const [scope,i]=el.dataset.riotLoad.split('|');if(scope==='team'){const inp=document.querySelector(`[data-player-riot="${i}"]`);if(inp){state.players[Number(i)].riotId=inp.value.trim().replace(/\s*#\s*/,'#').slice(0,40);save();}}const t=riotTarget(scope,Number(i));if(!t?.id){toast('Trag zuerst eine Riot-ID ein, z. B. Name#EUW.',true);return;}const st=riotState(t.region,t.id);riotStart(scope,Number(i),st?.status==='ok');return;}
 if(el.dataset.riotAll){const scope=el.dataset.riotAll;for(let i=0;i<5;i++){const t=riotTarget(scope,i);if(t&&validRiotId(t.id))riotLoad(t.region,t.id);}return;}
 if(el.dataset.riotAdd){const [i,id,n]=el.dataset.riotAdd.split('|');const p=state.players[Number(i)];if(p&&!p.pool.some(v=>v.id===id)&&p.pool.length<100){p.pool.push({id,comfort:comfortFromGames(Number(n)||1)});save();render();toast(`${cname(id)} ist jetzt im Pool von ${p.name}.`);}return;}
 if(el.dataset.riotMain){const [i,id]=el.dataset.riotMain.split('|');const pl=selOpp()?.players[Number(i)];if(pl){if(pl.champs.includes(id))pl.champs=pl.champs.filter(x=>x!==id);else if(pl.champs.length<5)pl.champs.push(id);else{toast('Höchstens fünf Mains pro Spieler.',true);return;}save();render();}return;}
 if(el.dataset.riotTake){const [scope,i]=el.dataset.riotTake.split('|');riotTakeTop(scope,Number(i));return;}
 if(el.dataset.bisAdd){const [id,i]=el.dataset.bisAdd.split('|');const p=state.players[Number(i)];if(!p.pool.some(v=>v.id===id)&&p.pool.length<100){p.pool.push({id,comfort:2});save();render();toast(`${cname(id)} ist jetzt im Pool von ${p.name}.`);}return;}
 if(el.dataset.swap){const [type,i]=el.dataset.swap.split('|');openSwapDialog(type,Number(i));return;}
 if(el.dataset.swapTo){const [type,a,b]=el.dataset.swapTo.split('|');const i=Number(a),j=Number(b);if(i!==j){const x=state[type][i];state[type][i]=state[type][j];state[type][j]=x;if(type==='enemies')enemyRole=null;save();render();toast(`${cname(x)} spielt jetzt ${ROLE_NAMES[ROLES[j]]}.`);}$('#confirm-dialog').close();return;}
 if(el.dataset.swapClear){const [type,i]=el.dataset.swapClear.split('|');const id=state[type][Number(i)];state[type][Number(i)]=null;undoStack=[];$('#confirm-dialog').close();save();render();toast(`${cname(id)} entfernt.`);return;}
 if(el.dataset.swapChange){const [type,i]=el.dataset.swapChange.split('|');$('#confirm-dialog').close();openPicker(type,Number(i));return;}
 if(el.dataset.prTimer){prTimer=el.dataset.prTimer==='on';document.querySelectorAll('[data-pr-timer]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}
 if(el.dataset.ra!=null){const i=Number(el.dataset.ra);state.selectedRole=i;pickRole=i;if(!csSearch)csRole=ROLES[i];save();render();return;}
 if(el.dataset.pickRole!=null){pickRole=Number(el.dataset.pickRole);if(!csSearch)csRole=ROLES[pickRole];render();return;}
 if(el.dataset.hover){selectHover(el.dataset.hover,el.dataset.wishRole!=null?Number(el.dataset.wishRole):null);return;}
 if(el.dataset.csTarget){const [type,i]=el.dataset.csTarget.split('|');if(type==='allies')state.selectedRole=Number(i);else enemyRole=Number(i);render();return;}
 if(el.dataset.csRole){csRole=el.dataset.csRole;document.querySelectorAll('[data-cs-role]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const g=$('#cs-grid');if(g)g.innerHTML=csGrid();return;}
 if(el.dataset.flNext){fearlessNext(el.dataset.flNext);return;}
 if(el.dataset.prFearless){prFearless=el.dataset.prFearless==='on';document.querySelectorAll('[data-pr-fearless]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const h=$('#pr-fl-hint');if(h)h.textContent=prFearless?FL_HINT:'Ein normaler Draft.';return;}
 if(el.dataset.prMode){prMode=el.dataset.prMode;document.querySelectorAll('[data-pr-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const h=$('#pr-mode-hint');const tr=$('#pr-timer-row');if(tr)tr.hidden=prMode!=='ai';if(h)h.textContent=prMode==='ai'?'Übung gegen den Computer. Nur in diesem Browser.':'Ihr tragt die Picks des Gegners ein. Das Team sieht den Draft live.';return;}
 if(el.dataset.muEdit){showMatchupDialog(el.dataset.muEdit);return;}
 if(el.dataset.muSave){const id=el.dataset.muSave,t=($('#mu-text')?.value||'').trim().slice(0,500);if(t)state.matchups[id]=t;else delete state.matchups[id];save();$('#confirm-dialog').close();render();toast(t?`Notiz zu ${cname(id)} gespeichert.`:`Notiz zu ${cname(id)} entfernt.`);return;}
 if(el.dataset.muDelete){delete state.matchups[el.dataset.muDelete];save();$('#confirm-dialog').close();render();toast('Notiz gelöscht.');return;}
 if(el.dataset.prSide){prSide=el.dataset.prSide;document.querySelectorAll('[data-pr-side]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}
 if(el.dataset.logResult){logResult=el.dataset.logResult;document.querySelectorAll('[data-log-result]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const s=$('#log-save');if(s)s.disabled=false;return;}
 if(el.dataset.gameDelete){const g=state.history.find(x=>x.id===el.dataset.gameDelete);if(g)confirmDialog('Spiel löschen?',`${g.result==='win'?'Sieg':'Niederlage'} vom ${date(g.date)}${g.opponentName?' gegen '+g.opponentName:''} wird für alle entfernt.`,()=>{state.history=state.history.filter(x=>x.id!==g.id);save();render();toast('Spiel gelöscht.');});return;}
 const action=el.dataset.action;if(!action)return;
 if(action==='log-game')showLogGame();
 if(action==='draft-open')openDraftDialog();
 if(action==='draft-start'){const opp=$('#pr-opp')?.value||'';$('#confirm-dialog').close();saveDraftOpts();if(prMode==='ai')startPractice({side:prSide,opponentId:opp,timer:prTimer,fearless:prFearless?{game:1,used:[]}:null});else startRealDraft(prSide,opp);}
 if(action==='lock-in')lockIn();
 if(action==='undo'){const u=undoStack.pop();if(u){state[u.type][u.index]=null;if(u.type==='allies')state.selectedRole=u.index;csKey=null;save();render();}}
 if(action==='draft-end'){if(practice)endPractice();else if(draftTurn(state).finished)endDraft();else confirmDialog('Draft abbrechen?','Alle Picks und Bans dieses Drafts werden geleert.',()=>{endDraft();toast('Draft abgebrochen.');});}
 if(action==='practice-again'&&practice)startPractice({timer:practice.timer,side:state.side,opponentId:state.opponentId,fearless:state.fearless?{game:1,used:[]}:null});
 if(action==='practice-end')endPractice();
 if(action==='copy-discord')copyText(discordText(),'Für Discord');
 if(action==='plan-regen')generatePlan(draftKey(),true);
 if(action==='save-game')saveGame();
 if(action==='analyze')analyze();
 if(action==='stop-analysis')analysisCtrl?.abort();
 if(action==='add-opponent'){const name=($('#new-opponent')?.value||'').trim().slice(0,40);if(!name){toast('Bitte gib einen Teamnamen ein.',true);return;}if(state.opponents.length>=50){toast('Es sind maximal 50 Gegnerteams möglich.',true);return;}const o={id:Date.now().toString(36),name,notes:'',favorites:[],region:'euw',players:emptyOppPlayers()};state.opponents.push(o);selectedOpponent=o.id;save();render();toast(`${name} angelegt.`);}
 if(action==='toggle-active-opponent'){const o=selOpp();if(o){state.opponentId=state.opponentId===o.id?'':o.id;save();render();toast(state.opponentId?`${o.name} ist im Draft aktiv.`:'Kein Gegner im Draft aktiv.');}}
 if(action==='delete-opponent'){const o=selOpp();if(o)confirmDialog(`${o.name} löschen?`,'Notizen und Lieblingschampions dieses Teams werden für alle entfernt.',()=>{state.opponents=state.opponents.filter(x=>x.id!==o.id);if(state.opponentId===o.id)state.opponentId='';selectedOpponent='';save();render();toast('Gegnerteam gelöscht.');});}
 if(action==='add-fav'){const o=selOpp();const v=($('#fav-input')?.value||'').trim().toLowerCase();const c=catalog.champions.find(x=>x.name.toLowerCase()===v||x.id.toLowerCase()===v);if(!o)return;if(!c){toast('Diesen Champion gibt es nicht. Wähle einen aus der Liste.',true);return;}if(o.favorites.includes(c.id))return;if(o.favorites.length>=15){toast('Maximal 15 Lieblingschampions.',true);return;}o.favorites.push(c.id);save();render();}
 if(action==='save-template'){const name=($('#template-name')?.value||'').trim().slice(0,40);if(!name){toast('Bitte gib der Vorlage einen Namen.',true);return;}if(state.templates.length>=20){toast('Es sind maximal 20 Vorlagen möglich.',true);return;}const t={id:Date.now().toString(36),name,allies:[...state.allies],enemies:[...state.enemies],bans:[...state.bans]};if(![...t.allies,...t.enemies,...t.bans].some(Boolean)){toast('Der Draft ist noch leer.',true);return;}state.templates.push(t);templatesOpen=true;save();render();toast(`Vorlage „${name}“ gespeichert.`);}
 if(action==='reset-draft')confirmDialog('Draft leeren?','Alle Picks und Bans werden entfernt. Team und Champion-Pools bleiben.',()=>{endDraft();toast('Bereit für einen neuen Draft.');});
 if(action==='close-picker')$('#picker').close();
 if(action==='clear-slot'){state[pickerTarget.type][pickerTarget.index]=null;save();$('#picker').close();render();}
 if(action==='room-open'){openRoomDialog();return;}
 if(action==='room-create'){createRoom();return;}
 if(action==='room-join'){joinRoom($('#room-code')?.value);return;}
 if(action==='room-copy'){copyRoomLink();return;}
 if(action==='room-leave'){confirmDialog('Raum verlassen?',room?.role==='host'?'Dein Team sieht danach keine neuen Picks mehr. Der Draft bleibt bei dir erhalten.':'Du siehst danach wieder deinen eigenen Stand.',()=>leaveRoom());return;}
 if(action==='cancel-confirm'){$('#confirm-dialog').close();confirmAction=null;}
 if(action==='confirm'){const fn=confirmAction;confirmAction=null;$('#confirm-dialog').close();fn?.();}
 if(action==='export')showExport();
 if(action==='copy-export'){const ta=$('#export-text');const fallback=()=>{ta.focus();ta.select();toast('Text ist markiert. Kopiere ihn mit Strg+C bzw. Cmd+C.');};try{navigator.clipboard.writeText(ta.value).then(()=>toast('Sicherung kopiert.'),fallback);}catch{fallback();}}
 if(action==='install'){const ev=installEvt;installEvt=null;render();if(ev){ev.prompt();ev.userChoice.catch(()=>{});}return;}
 if(action==='lang'){try{localStorage.setItem('riftroom.lang',document.documentElement.lang==='de'?'en':'de');}catch{}location.reload();return;}
 if(action==='no-ban'){const t=draftTurn(state),c=t.current;if(!c||c.type!=='ban'||(practice&&c.who!=='us'))return;const tg=stepTarget(c);if(!tg||tg.index==null)return;state.bans[tg.index]='none';if(!practice)undoStack.push(tg);hoverId=null;save();render();toast('Kein Ban eingetragen.');return;}
 if(action==='close-banner'){bannerClosed=true;render();return;}
 if(action==='hide-checklist'){guide.hide(true);render();toast('Startliste ausgeblendet. Über das ? oben holst du die Einführung zurück.');}
 if(action==='tour'){const n=el.dataset.tourName;if(n==='team'){page='team';saveUi();render();startTour('team',el.dataset.tourStep);}else helpTour();}
 if(action==='import-team')pickFile('team');
 if(action==='import-meta')pickFile('meta');
 if(action==='clear-meta')confirmDialog('Winrates entfernen?','Die Winrates werden aus diesem Browser entfernt.',()=>{state.meta=null;state.metaImported=false;save();render();if(STANDALONE)loadStatic();});
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
document.addEventListener('input',e=>{const t=e.target;if(handleLobbyInput(t))return;if(handleMiniInput(t))return;if(t.id==='team-name'){state.teamName=t.value.trim()||'Mein Team';save();}if(t.dataset.playerName!=null){state.players[Number(t.dataset.playerName)].name=t.value.trim()||'Spieler '+(Number(t.dataset.playerName)+1);save();}if(t.id==='cs-search'){csSearch=t.value;const g=$('#cs-grid');if(g)g.innerHTML=csGrid();}if(t.id==='picker-search'){pickerSearch=t.value;renderPickerGrid();}if(t.id==='meta-search'){metaSearch=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='opp-notes'){const o=selOpp();if(o){o.notes=t.value.slice(0,4000);save();}}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.playerRiot!=null){const i=Number(t.dataset.playerRiot),v=t.value.trim().replace(/\s*#\s*/,'#').slice(0,40);t.value=v;state.players[i].riotId=v;save();if(v&&!validRiotId(v))toast('Eine Riot-ID sieht so aus: Name#Tag, z. B. Faker#KR1.',true);else if(v&&STANDALONE){riotStart('team',i);const b=document.querySelector('[data-riot-res="team|'+i+'"]');if(b)b.innerHTML=riotInner('team',i);}return;}if(t.id==='team-region'){if(OPP_REGIONS.includes(t.value)){state.riotRegion=t.value;save();render();}return;}if(t.dataset.oppRiot!=null){const o=selOpp();if(o){const v=t.value.trim().replace(/\s*#\s*/,'#').slice(0,40);o.players[Number(t.dataset.oppRiot)].riotId=v;save();render();if(STANDALONE&&validRiotId(v))riotStart('opp',Number(t.dataset.oppRiot));if(v&&!/^[^#]{3,16}#[^#\s]{2,5}$/.test(v))toast('Eine Riot-ID sieht so aus: Name#Tag, z. B. Faker#KR1. Ohne Tag findet op.gg das Profil nicht.',true);}return;}if(t.id==='opp-region'){const o=selOpp();if(o&&OPP_REGIONS.includes(t.value)){o.region=t.value;save();render();}return;}if(t.id==='opp-name'){const o=selOpp();if(o&&t.value.trim()){o.name=t.value.trim().slice(0,40);save();render();}}if(t.id==='draft-opponent'){state.opponentId=t.value;save();render();}if(t.id==='picker-role'){pickerRole=t.value;renderPickerGrid();}if(t.id==='pool-only'){state.poolOnly=t.checked;save();render();}if(t.id==='meta-role'){metaRole=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='meta-sort'){metaSort=t.value;$('#meta-table').innerHTML=metaTable();}if(t.id==='team-name'){state.teamName=t.value.trim()||'Mein Team';save();render();}if(t.dataset.playerName!=null){state.players[Number(t.dataset.playerName)].name=t.value.trim()||`Spieler ${Number(t.dataset.playerName)+1}`;save();}});
document.addEventListener('submit',e=>{if(handleMiniSubmit(e))return;if(e.target.id!=='settings-form')return;e.preventDefault();try{const patch=$('#target-patch').value.trim();if(patch&&!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(patch))throw Error('Patch bitte im Format 16.20 oder 16.20.1 angeben.');state.targetPatch=patch;save();render();toast(patch?`Ziel-Patch ${patch} gespeichert.`:'Ziel-Patch folgt wieder dem aktuellen Patch.');}catch(err){$('#settings-error').textContent=err.message;}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('.lock-splash')){e.target.remove();return;}if(e.target.tagName==='IMG'&&e.target.src.includes('/img/ld/')){e.target.src=e.target.src.replace('/img/ld/','/img/sq/');return;}if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='icon.svg';e.target.style.objectFit='contain';e.target.style.opacity='.5';}},true);

function init(){
 catalog=structuredClone(BUNDLED_CATALOG);
 let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 if(saved){try{state=validateState(saved,catalog);}catch{toast('Gespeicherte Daten konnten nicht geladen werden. Beispielprofile sind aktiv.',true);}}
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
