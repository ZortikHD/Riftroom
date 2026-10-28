// Lobbys für die Minispiele: 1 gegen 1 bis zu vier Spieler, beliebig viele Zuschauer.
// Wer die Lobby erstellt, ist Host und wählt Spiel und Anzahl der Aufgaben. Alles läuft über Presence (live.js):
// Der Host trägt Einstellungen und einen Zufallsstartwert in sein Presence-Objekt, jeder erzeugt daraus bei sich
// dieselben Aufgaben und meldet nur Punkte und Fortschritt zurück. Gespeichert wird nichts.
// Verlässt der Host die Lobby, übernimmt automatisch, wer am längsten da ist.
import {joinLive,canLive} from './live.js';
import {mpReady,mpGen,mpSig,mpGrade,mpMax,mpCard,MP_SECS} from './puzzles.js';
import {startLobbyGuess,leaveLobbyGuess,lobbyGuessResult} from './minigame.js';

const NICK_KEY='riftroom.nick',MAX=4,ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789',COUNT_IN=4000;
// Spiel: Name, Bild, Standardanzahl, Kartenklasse
const GAMES={counter:['Counter puzzle','Yasuo',10,'pz-card'],whowins:['Who wins?','Jinx',10,'ww-card'],ban:['Ban puzzle','Zed',5,'bp-card'],macro:['Macro quiz','Nautilus',5,'mq-card'],timer:['Timer quiz','Zilean',5,'tq-card'],guess:['Guess the champion','Neeko',90,'']};
const COUNTS=[5,10,15],DURS=[60,90,120];
let ctx=null,room=null,code='',status='idle',err='',peers=[],unsub=null,presetCode='';
const me={id:Math.random().toString(36).slice(2,10),nick:'',at:0};
let host=false,cfg=null,lastCfg=null,claimTimer=null,tick=null;
let setup={game:'counter',n:10,dur:90};
let match=null,pending=null,seen={},celebrated='',lastKey='';

const esc=v=>ctx.esc(v);
const nickOf=()=>{try{return localStorage.getItem(NICK_KEY)||'';}catch{return'';}};
const COLORS=['var(--accent)','var(--blue)','var(--red)','var(--warn)','var(--magic)','var(--phys)'];
const colorOf=nick=>{let h=0;for(const ch of String(nick))h=(h*31+ch.charCodeAt(0))>>>0;return COLORS[h%COLORS.length];};
const avatar=(nick,cls='')=>`<span class="mg-av ${cls}" style="--c:${colorOf(nick)}">${esc((String(nick).trim()[0]||'?').toUpperCase())}</span>`;
const crown='<svg class="mg-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 0 3l7 5 5-8 5 8 7-5-2 11z"/></svg>';
// Unter einer Minute mit Zehnteln, damit man bei gleichen Punkten sieht, wer schneller war.
const mmss=ms=>{if(ms<60000){const t=(ms/1000).toFixed(1);return(document.documentElement.lang==='de'?t:t)+' s';}const s=Math.round(ms/1000);return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const sq=m=>[...String(m||'')].map(c=>c==='2'?'🟩':c==='1'?'🟨':'🟥').join('');

/* ---------- Zustand aus den Presence-Daten ---------- */
function validCfg(c){
 if(!c||typeof c!=='object'||!GAMES[c.game]||!['lobby','play'].includes(c.phase))return null;
 const n=c.game==='guess'?(DURS.includes(c.n)?c.n:90):(COUNTS.includes(c.n)?c.n:GAMES[c.game][2]);
 const players=Array.isArray(c.players)?c.players.filter(x=>typeof x==='string').slice(0,MAX):[];
 return{game:c.game,n,phase:c.phase,r:Number.isInteger(c.r)?c.r:0,seed:Number.isInteger(c.seed)?c.seed:0,players,sig:typeof c.sig==='string'?c.sig.slice(0,40):''};
}
function people(){
 const out=new Map();
 for(const p of peers){
  const pr=p.presence||{};if(typeof pr.id!=='string'||!pr.nick)continue;
  const prog=pr.prog&&typeof pr.prog==='object'?{r:Number(pr.prog.r)||0,i:Number(pr.prog.i)||0,pts:Number(pr.prog.pts)||0,ms:Number(pr.prog.ms)||0,m:String(pr.prog.m||'').replace(/[^012]/g,'').slice(0,20),d:!!pr.prog.d}:null;
  out.set(pr.id,{id:pr.id,nick:String(pr.nick).slice(0,24),at:Number(pr.at)||0,host:!!pr.host,cfg:pr.host?validCfg(pr.cfg):null,prog,me:pr.id===me.id});
 }
 if(room&&!out.has(me.id))out.set(me.id,{id:me.id,nick:me.nick,at:me.at,host,cfg:host?cfg:null,prog:progOf(),me:true});
 return[...out.values()].sort((a,b)=>a.at-b.at||(a.id<b.id?-1:1));
}
const hostPerson=()=>people().find(p=>p.host&&p.cfg)||null;
const current=()=>{const h=hostPerson();return h?h.cfg:null;};
const isHost=()=>{const h=hostPerson();return!!h&&h.me;};
const lineup=()=>people().slice(0,MAX);
const progOf=()=>match&&match.game!=='guess'?{r:match.r,i:match.marks.length,pts:match.pts,ms:Math.round(match.ms),m:match.marks,d:match.done}:null;
function push(){if(room)room.presence({id:me.id,nick:me.nick,at:me.at,host,cfg:host?cfg:null,prog:progOf()});}

function onPeers(list){
 peers=list;
 const h=hostPerson();
 if(h)lastCfg=h.cfg;
 // Zwei Hosts: der früher Gekommene bleibt.
 if(host&&h&&!h.me){host=false;cfg=null;push();}
 // Kein Host da: nach kurzer Wartezeit übernimmt, wer am längsten in der Lobby ist.
 if(!h&&!claimTimer)claimTimer=setTimeout(()=>{claimTimer=null;if(!room||hostPerson())return;const first=people()[0];if(first?.me){host=true;cfg=lastCfg?{...lastCfg}:{game:setup.game,n:setup.game==='guess'?setup.dur:setup.n,phase:'lobby',r:0,seed:0,players:[],sig:''};push();update(true);}else update();},2500);
 sync();
}
function sync(){
 const c=current();
 for(const p of people())if(p.prog&&c&&p.prog.r===c.r)seen[p.id]={nick:p.nick,...p.prog};
 if(c?.phase==='play'&&(!match||match.r!==c.r||match.game!==c.game)&&c.players.includes(me.id))startMatch(c);
 if(c?.phase==='lobby'&&(match||pending)){endMatch();if(ctx.tab()==='guess')ctx.setTab('lobby');}
 update();
}
function endMatch(){if(match?.game==='guess')leaveLobbyGuess();match=null;pending=null;stopTick();}
function startMatch(c){
 endMatch();seen={};
 if(c.game==='guess'){
  match={r:c.r,game:'guess'};
  startLobbyGuess({name:`rr-g-${code.toLowerCase()}-${c.r}`,seed:c.seed,start:Date.now()+COUNT_IN,dur:c.n*1000,nick:me.nick,host:hostPerson()?.nick||'',c:ctx.mg});
  if(ctx.page()==='mini')ctx.setTab('guess');else ctx.toast('Guess the Champion is starting in your lobby.');
  return;
 }
 const wait=mpReady(c.game,ctx.pz);
 if(wait){pending=c;return;}
 const qs=mpGen(c.game,c.seed,c.n);
 match={r:c.r,game:c.game,qs,n:qs.length,i:0,answers:[],gains:[],marks:'',pts:0,ms:0,shownAt:0,deadline:0,done:false,start:Date.now()+COUNT_IN,sigOk:!c.sig||mpSig(c.game,qs)===c.sig};
 push();
 if(ctx.page()==='mini'&&ctx.tab()!=='lobby')ctx.setTab('lobby');
 else if(ctx.page()!=='mini')ctx.toast('The round in your lobby is starting. Open “With friends”.');
}
// Alle Spieler der Runde fertig? Wer die Lobby verlassen hat, zählt nicht mehr.
function standings(c){
 const here=new Map(people().map(p=>[p.id,p]));
 return c.players.map(id=>{const s=seen[id]||{},p=here.get(id);return{id,nick:s.nick||p?.nick||'?',pts:s.pts||0,ms:s.ms||0,m:s.m||'',i:s.i||0,done:!!s.d,gone:!p&&!s.d,me:id===me.id};});
}
const allDone=c=>{const st=standings(c);return st.some(x=>x.done)&&st.every(x=>x.done||x.gone);};
const ranked=c=>standings(c).sort((a,b)=>(a.gone-b.gone)||b.pts-a.pts||a.ms-b.ms);

/* ---------- Neuzeichnen ---------- */
// Ganz neu zeichnen nur, wenn sich die Ansicht ändert. Sonst nur Spielerliste und Rennen aktualisieren.
function viewKey(){
 const c=current();
 return[status,!!room,host,isHost(),c?.phase,c?.r,c?.game,c?.n,match?.r,match?.i,match?.done,match&&match.answers&&match.answers[match.i]!=null,c&&c.phase==='play'&&match&&match.done&&allDone(c),!!pending].join('|');
}
function update(force){
 if(!ctx||ctx.page()!=='mini'||ctx.tab()!=='lobby')return;
 const k=viewKey();
 if(force||k!==lastKey){lastKey=k;ctx.rerender();return;}
 paint();
}
function paint(){
 const c=current();
 const sl=document.getElementById('lb-slots');if(sl)sl.innerHTML=slotsHtml();
 const ra=document.getElementById('lb-race');if(ra&&c)ra.innerHTML=raceHtml(c);
 const st=document.getElementById('lb-start');if(st&&c){const n=lineup().length,ld=c.game!=='guess'&&!!mpReady(c.game,ctx.pz);st.disabled=n<2||ld;st.querySelector('span').textContent=ld?'Loading data …':n<2?'Waiting for players':'Start game';}
}

/* ---------- Ansichten ---------- */
function gamePicker(sel,n,edit){
 const tiles=Object.entries(GAMES).map(([k,[l,art]],i)=>`<button class="lb-game ${sel===k?'on':''}" data-lb-game="${k}" aria-pressed="${sel===k}" style="--i:${i}" ${edit?'':'disabled'}><img src="${ctx.LOADING[art]}" alt=""><b>${l}</b></button>`).join('');
 const opts=sel==='guess'?DURS:COUNTS;
 const seg=`<div class="seg lb-count" role="group" aria-label="${sel==='guess'?'Duration':'Questions'}">${opts.map(v=>`<button data-lb-n="${v}" aria-pressed="${n===v}" ${edit?'':'disabled'}>${sel==='guess'?v+' s':v}</button>`).join('')}</div>`;
 return`<div class="lb-games">${tiles}</div><div class="lb-countrow"><span class="fine">${sel==='guess'?'Duration':'Questions per round'}</span>${seg}</div>`;
}
function startScreen(){
 const nick=me.nick||nickOf();
 if(!canLive())return'<section class="card empty"><h2>No live connection</h2><p>Lobbies need an internet connection.</p></section>';
 const busy=status==='connecting';
 return`<section class="mg-hero pz-hero lb-hero"><img class="pz-hero-art" src="${ctx.LOADING.Teemo||''}" alt=""><div class="mg-hero-in">
  <span class="mg-badge">Multiplayer</span><h1 class="mg-title"><span>With</span><span>friends</span></h1>
  <div class="pz-demo lb-demo" aria-hidden="true">${['A','B','C','D'].map((x,i)=>`<span class="mg-av" style="--c:${COLORS[i]};--i:${i}">${x}</span>${i<3?'<i>VS</i>':''}`).join('')}</div>
  <p class="mg-rules">1 vs 1 or up to four players. Everyone gets the same questions, and whoever scores the most points wins.</p>
  <input class="field lb-nick" id="lb-nick" maxlength="24" value="${esc(nick)}" placeholder="Your name in the game" aria-label="Your name in the game" autocomplete="off">
  ${err?`<p class="lb-err">${esc(err)}</p>`:''}
  <div class="lb-create">${gamePicker(setup.game,setup.game==='guess'?setup.dur:setup.n,true)}</div>
  <button class="mg-go" data-lb="create" ${busy?'disabled':''}><span>${busy?'Connecting …':'Create lobby'}</span></button>
  <div class="lb-join"><span class="fine">Or join a lobby</span><div class="row"><input class="field lb-codein" id="lb-code" maxlength="5" value="${esc(presetCode)}" placeholder="CODE" aria-label="Lobby code" autocomplete="off" spellcheck="false"><button class="btn primary" data-lb="join" ${busy?'disabled':''}>Join</button></div></div>
 </div></section>`;
}
function slotsHtml(){
 const list=people(),line=list.slice(0,MAX),watch=list.slice(MAX),h=hostPerson();
 const slots=Array.from({length:MAX},(_,k)=>{const p=line[k];
  return p?`<div class="lb-slot ${p.me?'me':''}" style="--i:${k}">${h&&h.id===p.id?crown:''}${avatar(p.nick,'big')}<b>${esc(p.nick)}</b><span class="fine">${h&&h.id===p.id?'Host':'Player'}${p.me?' · you':''}</span></div>`
   :`<div class="lb-slot empty" style="--i:${k}"><span class="mg-av big">?</span><b>Open</b><span class="fine">Waiting …</span></div>`;}).join('');
 return slots+(watch.length?`<p class="fine lb-watch">Watching: ${watch.map(p=>esc(p.nick)+(p.me?' (you)':'')).join(', ')}</p>`:'');
}
function roomHead(){
 const tiles=[...code].map((ch,i)=>`<span class="mg-l on" style="--i:${i}"><span>${ch}</span></span>`).join('');
 return`<div class="lb-head"><div><span class="mg-badge">Lobby</span><h2>With friends</h2></div><div class="lb-code"><div class="lb-code-tiles" aria-label="Code ${code}">${tiles}</div><button class="btn small" data-lb="copy">${ctx.icon('copy')}${ctx.standalone?'Copy link':'Copy code'}</button></div></div>`;
}
function lobbyRoom(c){
 const mine=isHost(),n=lineup().length;
 const info=GAMES[c.game];
 // Daten fürs gewählte Spiel schon in der Lobby laden, damit der Start nicht warten muss.
 const loadingData=c.game!=='guess'&&!!mpReady(c.game,ctx.pz);
 const setupHtml=mine?gamePicker(c.game,c.n,true):`<div class="lb-chosen"><img src="${ctx.LOADING[info[1]]}" alt=""><div><span class="fine">Selected game</span><b>${info[0]}</b><span>${c.game==='guess'?`${c.n} seconds`:`${c.n} questions`}</span></div></div>`;
 const act=mine?`<button class="mg-go" id="lb-start" data-lb="start" ${n<2||loadingData?'disabled':''}><span>${loadingData?'Loading data …':n<2?'Waiting for players':'Start game'}</span></button>`:'<p class="lb-wait"><span class="spinner small"></span>Waiting for the host to start</p>';
 return`<section class="card lb-room">${roomHead()}<div class="lb-slots" id="lb-slots">${slotsHtml()}</div><p class="fine lb-tip">${n<2?'Send your friends the code. As soon as someone joins, you can start.':'Up to four play, everyone else watches.'}</p><div class="lb-setup">${setupHtml}</div><div class="lb-actions">${act}<button class="btn ghost" data-lb="leave">Leave lobby</button></div></section>`;
}
function raceHtml(c){
 const st=standings(c),max=Math.max(1,...st.map(x=>x.pts)),lead=[...st].sort((a,b)=>b.pts-a.pts)[0];
 const n=match?.n||c.n;
 return st.map(x=>`<div class="lb-runner ${x.me?'me':''} ${x.done?'done':''} ${x.gone?'gone':''}" style="--c:${colorOf(x.nick)}">${avatar(x.nick)}<div class="lb-lane"><span class="lb-name">${lead&&lead.id===x.id&&x.pts>0?crown:''}${esc(x.nick)}${x.me?' (you)':''}${x.gone?' · left':x.done?' · done':''}</span><div class="lb-track"><i style="width:${Math.min(100,x.i/Math.max(1,n)*100)}%"></i></div><span class="lb-sq">${sq(x.m)}</span></div><b>${x.pts}</b></div>`).join('');
}
function countdown(c){
 const left=Math.max(0,Math.ceil((match.start-Date.now())/1000));
 const vs=standings(c).map((x,i)=>`${i?'<i class="lb-vs">VS</i>':''}<span class="lb-face">${avatar(x.nick,'big')}<b>${esc(x.nick)}</b></span>`).join('');
 return`<section class="card lb-count-card"><span class="mg-badge">${GAMES[c.game][0]} · Round ${c.r}</span><div class="lb-faces">${vs}</div><div class="mg-count" id="lb-count">${left}</div><p class="fine">${match.n} questions. Everyone gets the same ones.</p></section>`;
}
function playView(c){
 const q=match.qs[match.i],ans=match.answers[match.i],last=match.i+1>=match.n;
 if(!match.shownAt&&ans==null){match.shownAt=Date.now();if(match.game==='timer')match.deadline=match.shownAt+MP_SECS*1000;}
 const left=match.game==='timer'&&ans==null?Math.max(0,(match.deadline-Date.now())/1000):0;
 const next=`<button class="btn primary" data-lb="next">${last?'Done':'Next'}</button>`;
 const top=`<div class="lb-qtop"><span class="mg-badge">${GAMES[c.game][0]}</span><span class="fine">Question <b>${match.i+1}</b> of ${match.n}</span><span class="fine">Points: <b>${match.pts}</b></span></div>`;
 const warn=match.sigOk?'':'<p class="lb-err">Your data differs from the host’s. Everyone should reload the page, otherwise you will see different questions.</p>';
 return`<div class="lb-race" id="lb-race">${raceHtml(c)}</div>${warn}<section class="card ${GAMES[c.game][3]} lb-card">${top}${mpCard(c.game,q,ans,match.gains[match.i],left,next)}</section>`;
}
function waitView(c){
 return`<section class="card lb-waitcard"><span class="mg-badge">Done</span><div class="dl-score-big"><b>${match.pts}</b><span>/${mpMax(c.game,match.n)}</span></div><div class="dl-squares">${sq(match.marks)}</div><p class="lb-wait"><span class="spinner small"></span>Waiting for the others …</p></section><div class="lb-race" id="lb-race">${raceHtml(c)}</div>`;
}
function hostButtons(){
 return isHost()?`<div class="lb-actions"><button class="mg-go small" data-lb="again"><span>Rematch</span></button><button class="btn" data-lb="lobby">Other game</button><button class="btn ghost" data-lb="leave">Leave lobby</button></div>`
  :`<div class="lb-actions"><p class="lb-wait"><span class="spinner small"></span>The host starts the next round</p><button class="btn ghost" data-lb="leave">Leave lobby</button></div>`;
}
function podium(rows,unit=''){
 const top=rows[0],tie=rows.length>1&&rows[1].pts===top.pts&&rows[1].ms===top.ms;
 const title=tie?'It’s a tie!':top.me?'You win!':`${esc(top.nick)} wins!`;
 const pod=[rows[1],rows[0],rows[2]].map((r,k)=>r?`<div class="mg-pod p${[2,1,3][k]}">${[2,1,3][k]===1?crown:''}${avatar(r.nick)}<span class="mg-pod-name">${esc(r.nick)}${r.me?' (you)':''}</span><div class="mg-pod-block"><b>${r.pts}</b><span>${[2,1,3][k]}.</span></div></div>`:'<div class="mg-pod empty"></div>').join('');
 return`<h2 class="mg-res-title">${title}</h2><div class="mg-podium">${pod}</div>`;
}
function resultView(c){
 const rows=ranked(c);
 const table=`<ol class="lb-table">${rows.map((r,i)=>`<li class="${r.me?'me':''} ${r.gone?'gone':''}" style="--i:${i}"><span class="lb-pos">${i+1}.</span>${avatar(r.nick)}<span class="lb-name">${esc(r.nick)}${r.me?' (you)':''}</span><span class="lb-sq">${sq(r.m)}</span><span class="lb-time">${r.gone?'left':mmss(r.ms)}</span><b>${r.pts}</b></li>`).join('')}</ol>`;
 return`<section class="card lb-result" id="lb-result"><span class="mg-badge">${GAMES[c.game][0]} · Round ${c.r}</span>${podium(rows)}${table}<p class="fine">Same points: the faster player ranks higher.</p>${hostButtons()}</section>`;
}
function guessView(c){
 const res=lobbyGuessResult();
 if(!res||!res.done)return`<section class="card lb-room"><span class="mg-badge">Guess the Champion · Round ${c.r}</span><h2>The game is on</h2><p class="fine">Everyone in the lobby is guessing the same champions right now.</p><div class="lb-actions"><button class="mg-go small" data-minitab="guess"><span>To the game</span></button><button class="btn ghost" data-lb="leave">Leave lobby</button></div></section>`;
 const rows=res.rows.map(r=>({...r,pts:r.score,ms:0}));
 return`<section class="card lb-result" id="lb-result"><span class="mg-badge">Guess the Champion · Round ${c.r}</span>${podium(rows)}${hostButtons()}</section>`;
}
export function renderLobby(c){
 ctx=c;if(!me.nick)me.nick=nickOf();
 lastKey=viewKey();
 if(!room)return startScreen();
 const cfgNow=current();
 if(!cfgNow)return`<section class="card lb-room">${roomHead()}<p class="lb-wait"><span class="spinner small"></span>Looking for the lobby …</p><p class="fine">If nobody is there, you become the host in a moment. Otherwise check the code.</p><div class="lb-actions"><button class="btn ghost" data-lb="leave">Leave lobby</button></div></section>`;
 if(cfgNow.phase==='lobby')return lobbyRoom(cfgNow);
 if(!cfgNow.players.includes(me.id))return`<section class="card lb-room">${roomHead()}<h2>You are watching</h2><p class="fine">The round has already started. You join the next round if a spot is free.</p><div class="lb-race" id="lb-race">${raceHtml(cfgNow)}</div><div class="lb-actions"><button class="btn ghost" data-lb="leave">Leave lobby</button></div></section>`;
 if(cfgNow.game==='guess')return guessView(cfgNow);
 if(pending){const w=mpReady(cfgNow.game,ctx.pz);if(!w){const p=pending;pending=null;startMatch(p);lastKey=viewKey();}else return w;}
 if(!match)return'<section class="card pz-loading"><div class="spinner"></div></section>';
 if(Date.now()<match.start)return countdown(cfgNow);
 if(match.done)return allDone(cfgNow)?resultView(cfgNow):waitView(cfgNow);
 return playView(cfgNow);
}
// Nach dem Zeichnen: Countdown und Timer laufen lassen, Konfetti für den Sieger.
export function afterLobby(){
 stopTick();
 const c=current();
 if(!match||match.game==='guess'||!c)return;
 if(Date.now()<match.start){tick=setInterval(()=>{const el=document.getElementById('lb-count');if(!el){stopTick();return;}const left=Math.ceil((match.start-Date.now())/1000);if(left<=0){stopTick();ctx.rerender();return;}if(el.textContent!==String(left)){const n=el.cloneNode(false);n.textContent=left;el.replaceWith(n);}},100);return;}
 if(match.game==='timer'&&!match.done&&match.answers[match.i]==null){
  tick=setInterval(()=>{const ring=document.getElementById('mp-ring'),num=document.getElementById('mp-left');if(!ring){stopTick();return;}const left=Math.max(0,match.deadline-Date.now());ring.style.setProperty('--p',String(left/(MP_SECS*1000)));if(num)num.textContent=Math.ceil(left/1000);if(!left){stopTick();answer(-1);}},100);
 }
 const res=document.getElementById('lb-result');
 if(res&&celebrated!==code+c.r){celebrated=code+c.r;if(ranked(c)[0]?.me)setTimeout(()=>ctx.burst(res,60),300);}
}
function stopTick(){clearInterval(tick);tick=null;}

/* ---------- Aktionen ---------- */
function readNick(){
 const el=document.getElementById('lb-nick'),v=(el?el.value:me.nick||nickOf()).trim().slice(0,24);
 if(!v){ctx.toast('Enter your name first.',true);el?.focus();return'';}
 me.nick=v;try{localStorage.setItem(NICK_KEY,v);}catch{}return v;
}
async function enter(c,asHost){
 if(!readNick())return;
 status='connecting';err='';ctx.rerender();
 try{
  const r=await joinLive('rr-lobby-'+c.toLowerCase());if(!r)throw Error('none');
  room=r;code=c;me.at=Date.now();status='in';presetCode='';seen={};
  if(asHost){host=true;cfg={game:setup.game,n:setup.game==='guess'?setup.dur:setup.n,phase:'lobby',r:0,seed:0,players:[],sig:''};}
  unsub=room.onPeers(onPeers,()=>{room=null;status='idle';err='The connection to the lobby was lost.';ctx.rerender();});
  push();
  if(ctx.standalone)try{history.replaceState(null,'',`${location.pathname}?lobby=${c}`);}catch{}
 }catch{status='idle';err='Could not connect to the lobby. Check your internet connection and try again.';}
 lastKey='';ctx.rerender();
}
export async function leaveLobby(){
 endMatch();try{unsub?.();}catch{}
 const r=room;room=null;code='';status='idle';host=false;cfg=null;lastCfg=null;peers=[];seen={};clearTimeout(claimTimer);claimTimer=null;
 if(r)await r.leave();
 if(ctx?.standalone)try{history.replaceState(null,'',location.pathname);}catch{}
 ctx?.rerender();
}
function setCfg(patch){if(!isHost())return;cfg={...cfg,...patch};push();sync();}
function startRound(){
 const c=current();if(!c||!isHost())return;
 const line=lineup();if(line.length<2){ctx.toast('Wait until at least two players are here.',true);return;}
 const seed=Math.floor(Math.random()*2**31);
 let sig='';
 if(c.game!=='guess'){
  if(mpReady(c.game,ctx.pz)){ctx.toast('The game data is still loading. Try again in a moment.',true);ctx.rerender();return;}
  const qs=mpGen(c.game,seed,c.n);if(!qs.length){ctx.toast('Data for this game is missing right now.',true);return;}
  sig=mpSig(c.game,qs);
 }
 setCfg({phase:'play',r:c.r+1,seed,players:line.map(p=>p.id),sig});
}
function answer(val){
 if(!match||match.done||match.answers[match.i]!=null||Date.now()<match.start)return;
 const q=match.qs[match.i];if(!q)return;
 const left=match.game==='timer'?Math.max(0,(match.deadline-Date.now())/1000):0;
 const g=mpGrade(match.game,q,val,left);
 match.answers[match.i]=val;match.gains[match.i]=g.pts;match.pts+=g.pts;match.marks+=g.mark;
 match.ms+=Math.min(120000,Date.now()-(match.shownAt||Date.now()));
 push();lastKey='';ctx.rerender();
 if(g.mark==="2"){const el=document.querySelector('.lb-card .pz-verdict.best,.lb-card .mq-opt.best,.lb-card .tq-opt.best,.lb-card .pz-opt.best');if(el)ctx.burst(el,18);}
}
function next(){
 if(!match||match.answers[match.i]==null)return;
 if(match.i+1<match.n){match.i++;match.shownAt=0;match.deadline=0;}else match.done=true;
 push();lastKey='';ctx.rerender();window.scrollTo({top:0,behavior:'smooth'});
}
export function handleLobbyClick(el){
 const d=el.dataset;
 if(d.lobbyNew){if(GAMES[d.lobbyNew]){setup.game=d.lobbyNew;setup.n=GAMES[d.lobbyNew][2];}ctx.setTab('lobby');return true;}
 if(d.lbGame){if(room){if(isHost())setCfg({game:d.lbGame,n:d.lbGame==='guess'?90:GAMES[d.lbGame][2]});}else{setup.game=d.lbGame;if(d.lbGame!=='guess')setup.n=GAMES[d.lbGame][2];ctx.rerender();}return true;}
 if(d.lbN){const v=Number(d.lbN);if(room){if(isHost())setCfg({n:v});}else{if(setup.game==='guess')setup.dur=v;else setup.n=v;ctx.rerender();}return true;}
 if(d.mpPick!=null){const g=match?.game;answer(g==='macro'||g==='timer'?Number(d.mpPick):d.mpPick);return true;}
 const a=d.lb;if(!a)return false;
 if(a==='create'){const c=Array.from({length:5},()=>ALPHA[Math.floor(Math.random()*ALPHA.length)]).join('');enter(c,true);}
 else if(a==='join'){const v=(document.getElementById('lb-code')?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z2-9]{5}$/.test(v)){ctx.toast('The code has five characters.',true);document.getElementById('lb-code')?.focus();}else enter(v,false);}
 else if(a==='leave')leaveLobby();
 else if(a==='copy'){const text=ctx.standalone?`${location.origin}${location.pathname}?lobby=${code}`:code;navigator.clipboard?.writeText(text).then(()=>ctx.toast(ctx.standalone?'Link copied. Send it to your friends.':'Code copied. Your friends enter it under “With friends”.'),()=>ctx.toast(text));}
 else if(a==='start'||a==='again')startRound();
 else if(a==='lobby')setCfg({phase:'lobby'});
 else if(a==='next')next();
 else return false;
 return true;
}
export function handleLobbyInput(t){
 if(t.id==='lb-code'){const v=t.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(v!==t.value)t.value=v;presetCode=v;return true;}
 if(t.id==='lb-nick'){me.nick=t.value.trim().slice(0,24);return true;}
 return false;
}
// Aufruf über einen Link mit ?lobby=CODE: mit gespeichertem Namen direkt beitreten, sonst Code vorausfüllen.
export function openLobbyLink(c,context){
 ctx=context;const v=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(!/^[A-Z2-9]{5}$/.test(v))return false;
 presetCode=v;me.nick=nickOf();if(me.nick&&!room)enter(v,false);return true;
}
export const lobbyInfo=()=>room?code:'';
