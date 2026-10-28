// Minispiele mit Wertung, ähnlich wie Puzzles auf Chess.com:
// Counter-Puzzle: Gegner und Rolle sind vorgegeben, du wählst aus vier Champions den besten Konter.
//   Bewertet wird mit echten Matchup-Winrates (Lolalytics, Emerald+). Deine Wertung steigt und fällt wie eine Elo-Zahl.
// Tägliches Puzzle: fünf Counter-Puzzles, für alle gleich, mit Rangliste.
// Wer gewinnt?: zwei Drafts, welches Team liegt laut Lane-Duellen vorne.
// Ban-Puzzle: ein Gegnerteam mit Pools, welcher Ban tut am meisten weh.
// Macro-Quiz: eine Situation auf der Karte, drei Möglichkeiten. Oft ist mehr als eine okay, aber nur eine ist die beste.
// Timer-Quiz: Respawn- und Abklingzeiten schnell im Kopf rechnen.
// Daten liegen als Dateien im Ordner data/ und laden erst, wenn ein Spiel sie braucht.
let ctx=null,mu=null,scen=null,loading={},cp=null,mq=null,daily=null,ww=null,bp=null,tq=null,fx=null,tqTimer=null;
const PZ_KEY='riftroom.puzzle',MQ_KEY='riftroom.macro',DAILY_KEY='riftroom.daily',WW_KEY='riftroom.whowins',BP_KEY='riftroom.banpuzzle',TQ_KEY='riftroom.timer',NICK_KEY='riftroom.nick',PID_KEY='riftroom.pid';
const ROLE_KEYS=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
const ROLE_LABEL={TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTTOM:'Bot',UTILITY:'Support'};
const LETTER_ROLE={T:'Top',J:'Jungle',M:'Mid',A:'ADC',S:'Support'};
const OBJ_NAME={drake:'Dragon',baron:'Baron',grubs:'Voidgrubs',herald:'Herald',tower:''};
const OBJ_STATE={up:'up',taken:'taken',fight:'fight',buff:'enemy has buff',enemy:'enemy on it'};
const MIN_GAMES=400;

const load=(k,d)=>{try{return{...d,...JSON.parse(localStorage.getItem(k)||'{}')};}catch{return{...d};}};
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
let pz=load(PZ_KEY,{rating:1000,games:0,streak:0,best:0,solved:0,role:'ALL'});
let mqs=load(MQ_KEY,{best:0,rounds:0,seen:[]});
let wws=load(WW_KEY,{streak:0,best:0,played:0,right:0});
let bps=load(BP_KEY,{played:0,points:0,streak:0,best:0});
let tqs=load(TQ_KEY,{best:0,rounds:0});
const de=()=>document.documentElement.lang==='de';
const pct=v=>de()?v.toFixed(1)+' %':v.toFixed(1)+'%';
const int=v=>Number(v).toLocaleString(de()?'en-US':'en-US');
const mmss=s=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;
let R=Math.random;
const pick=a=>a[Math.floor(R()*a.length)];
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// Gleicher Text ergibt die gleiche Zufallsfolge: so bekommen alle dasselbe tägliche Puzzle.
function seeded(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}let a=h>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const withRng=(rng,fn)=>{const old=R;R=rng;try{return fn();}finally{R=old;}};
// Winrate mit 200 virtuellen Spielen Richtung 50 % geglättet, damit kleine Stichproben nicht täuschen.
const adj=(wr,n)=>(wr*n+50*200)/(n+200);
const name=id=>ctx.esc(ctx.cname(id));
const icon=id=>`<img src="${ctx.SQUARE[id]}" alt="">`;
const spinner='<section class="card pz-loading"><div class="spinner"></div></section>';
// Startbildschirm wie bei „Champion raten“: Titel, Regeln, Stand und ein großer Start-Knopf.
function hero({art,badge,t1,t2,rules,demo='',extra='',stats='',btn,act,friends=''}){
 return`<section class="mg-hero pz-hero"><img class="pz-hero-art" src="${ctx.LOADING[art]||''}" alt=""><div class="mg-hero-in"><span class="mg-badge">${badge}</span><h1 class="mg-title"><span>${t1}</span><span>${t2}</span></h1>${demo?`<div class="pz-demo" aria-hidden="true">${demo}</div>`:''}<p class="mg-rules">${rules}</p>${stats?`<div class="pz-hero-stats">${stats}</div>`:''}${extra}<button class="mg-go" ${act}><span>${btn}</span></button>${friends&&ctx.friendsBtn?ctx.friendsBtn(friends):''}</div></section>`;
}
const stat=(v,l)=>`<span><b>${v}</b>${l}</span>`;
// Ergebnis einer Runde: große Zahl, Kästchen pro Aufgabe, Nochmal-Knopf.
function roundEnd({badge,pre='',big,unit,sq,text,act}){
 return`<section class="card mq-end pz-end"><span class="mg-badge">${badge}</span><div class="dl-score-big">${pre?`<em>${pre}</em>`:''}<b data-countup="0">${big}</b><span>${unit}</span></div>${sq?`<div class="dl-squares">${sq}</div>`:''}<p class="fine">${text}</p><button class="mg-go small" ${act}><span>Play again</span></button></section>`;
}
const sqOf=g=>g==='best'?'🟩':g==='good'?'🟨':'🟥';

function fetchData(n){
 if(loading[n])return;loading[n]=true;
 fetch(`data/${n}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();})
  .then(d=>{if(n==='matchups'){if(!mu)mu=d;}else scen=d;ctx?.rerender();})
  .catch(()=>{loading[n]='error';ctx?.rerender();});
}
const dataError=n=>`<section class="card empty"><h2>Data unavailable</h2><p>${n==='matchups'?'The matchup data':'The situations'} could not be loaded. Check your internet connection.</p></section>`;
const known=id=>ctx.catalog().champions.some(c=>c.id===id);

/* ---------- Counter-Puzzle ---------- */
function makePuzzle(roles){
 for(let tries=0;tries<80;tries++){
  const role=pick(roles),table=mu.roles[role]||{},enemies=Object.keys(table).filter(known).sort();if(!enemies.length)continue;
  const enemy=pick(enemies);
  const rows=table[enemy].filter(r=>r[2]>=MIN_GAMES&&known(r[0])).map(([id,wr,n])=>({id,wr,n,a:adj(wr,n)})).sort((x,y)=>y.a-x.a||(x.id<y.id?-1:1));
  if(rows.length<8)continue;
  const best=rows[0];if(best.a-rows[1].a<0.6||best.a<51)continue;
  const rest=rows.slice(1),used=new Set([best.id]);
  const take=list=>{const c=list.filter(r=>!used.has(r.id));if(!c.length)return null;const r=pick(c);used.add(r.id);return r;};
  const opts=[best,take(rest.filter(r=>r.a>=50.5&&r.a<=best.a-0.6)),take(rest.filter(r=>r.a<48.5)),take(rest.filter(r=>r.a<=best.a-0.6))].filter(Boolean);
  while(opts.length<4){const r=take(rest);if(!r)break;opts.push(r);}
  if(opts.length<4)continue;
  // Schwierigkeit: je knapper der Abstand zwischen bestem und zweitbestem Angebot, desto schwerer.
  const second=Math.max(...opts.slice(1).map(o=>o.a));
  return{role,enemy,opts:shuffle(opts),bestId:best.id,diff:Math.round(Math.min(1700,Math.max(700,1650-(best.a-second)*180))),answer:null,delta:0};
 }
 return null;
}
const gradeOf=(p,id)=>{const o=p.opts.find(x=>x.id===id);return id===p.bestId?'best':o&&o.a>=50?'good':'bad';};
function newPuzzle(){cp=makePuzzle(pz.role==='ALL'?ROLE_KEYS:[pz.role]);}
function answerPuzzle(id){
 if(!cp||cp.answer||!cp.opts.some(o=>o.id===id))return;
 const grade=gradeOf(cp,id),S={best:1,good:0.75,bad:0}[grade];
 const E=1/(1+10**((cp.diff-pz.rating)/400)),K=pz.games<20?40:24;
 cp.delta=Math.round(K*(S-E));if(grade==='good')cp.delta=Math.max(1,cp.delta);cp.answer=id;cp.grade=grade;cp.from=pz.rating;
 pz.rating=Math.max(100,pz.rating+cp.delta);pz.games++;
 if(grade==='best'){pz.streak++;pz.solved++;fx='best';}else if(grade==='bad')pz.streak=0;
 pz.best=Math.max(pz.best,pz.streak);store(PZ_KEY,pz);
 if(cr)cr.grades[cr.i]=grade;
}
// Eine Puzzle-Karte, genutzt vom Counter-Puzzle und vom täglichen Puzzle.
function puzzleCard(p,pickAttr,next){
 const enemy=p.enemy,done=!!p.answer;
 const optHtml=p.opts.map((o,k)=>{
  const cls=!done?'':o.id===p.bestId?'best':o.a>=50?'good':'bad';
  const res=done?`<span class="pz-res"><span class="pz-bar"><i style="width:${Math.max(4,Math.min(100,(o.wr-40)*5))}%"></i></span><b>${pct(o.wr)}</b><small>${int(o.n)} games</small></span>`:'';
  return`<button class="pz-opt ${cls} ${p.answer===o.id?'mine':''}" style="--i:${k}" ${pickAttr}="${o.id}" ${done?'disabled':''}>${icon(o.id)}<span class="pz-name">${name(o.id)}${done&&o.id===p.bestId?' <i class="pz-star">★</i>':''}</span>${res}</button>`;
 }).join('');
 const chosen=done?p.opts.find(o=>o.id===p.answer):null,best=p.opts.find(o=>o.id===p.bestId);
 const verdict=!done?'':`<div class="pz-verdict ${p.grade}"><strong>${p.grade==='best'?'Best pick!':p.grade==='good'?'Good pick':'Unfavorable pick'}</strong><p>${p.grade==='best'?`${name(best.id)} wins ${pct(best.wr)} vs ${name(enemy)}. It doesn't get better than that.`:p.grade==='good'?`${name(chosen.id)} wins ${pct(chosen.wr)} vs ${name(enemy)}, which is solid. Even better would be ${name(best.id)} with ${pct(best.wr)}.`:`${name(chosen.id)} wins only ${pct(chosen.wr)} vs ${name(enemy)}. Best would be ${name(best.id)} with ${pct(best.wr)}.`}</p>${next}</div>`;
 return`<div class="pz-enemy"><img class="pz-splash" src="${ctx.LOADING[enemy]||ctx.SQUARE[enemy]}" alt=""><div class="pz-enemy-text"><span class="role-label">Opponent · ${ROLE_LABEL[p.role]}</span><strong>${name(enemy)}</strong><span>Who wins most often against ${name(enemy)}?</span></div></div><div class="pz-opts">${optHtml}</div>${verdict}`;
}
const muSource=()=>`<p class="fine pz-src">Win rate in this matchup, patch ${ctx.esc(mu.patch)}, ${ctx.esc(mu.rank)}, Solo/Duo (${ctx.esc(mu.source)}). At least ${int(MIN_GAMES)} games.</p>`;
const CP_N=10;let cr=null;
const dotsOf=(list,i,n)=>Array.from({length:n},(_,k)=>`<i class="${list[k]||''} ${k===i?'now':''}"></i>`).join('');
function counterHtml(){
 if(!mu){fetchData('matchups');return loading.matchups==='error'?dataError('matchups'):spinner;}
 const roleSeg=`<div class="seg pz-roles" role="group" aria-label="Role">${['ALL',...ROLE_KEYS].map(r=>`<button data-pz-role="${r}" aria-pressed="${pz.role===r}">${r==='ALL'?'All':ROLE_LABEL[r]}</button>`).join('')}</div>`;
 if(!cr)return hero({art:'Yasuo',badge:'Minigame',t1:'Counter',t2:'Puzzle',rules:`You see an opponent and pick the best counter out of four champions. ${CP_N} puzzles per round. Your rating rises and falls like on Chess.com.`,demo:['?','?','★','?'].map((x,i)=>`<span class="pz-demo-card ${x==='★'?'hit':''}" style="--i:${i}">${x}</span>`).join(''),stats:stat(pz.rating,'Rating')+stat(pz.best,'best streak')+stat(pz.games,'played'),extra:`<div class="pz-hero-roles"><span class="fine">Role</span>${roleSeg}</div>`,btn:'Start round',act:'data-pz="start"',friends:'counter'});
 if(cr.done){const gain=pz.rating-cr.from;return roundEnd({badge:'Round complete',pre:gain>=0?'+':'−',big:Math.abs(gain),unit:'Rating',sq:cr.grades.map(sqOf).join(''),text:`${cr.grades.filter(g=>g==='best').length} of ${CP_N} solved perfectly. Your rating: ${pz.rating}.`,act:'data-pz="start"'});}
 if(!cp)newPuzzle();
 if(!cp)return'<section class="card empty"><h2>No puzzle found</h2><p>There is not enough data for this role right now. Pick another role.</p></section>';
 const delta=cp.answer?`<span class="pz-delta ${cp.delta>=0?'up':'down'}">${cp.delta>=0?'+':''}${cp.delta}</span>`:'';
 const head=`<div class="pz-head"><div class="pz-rating"><span class="fine">Your rating</span><b ${cp.answer?`data-countup="${cp.from}"`:''}>${pz.rating}</b>${delta}</div><div class="pz-stats"><span><b>${pz.streak}</b> streak</span></div><span class="dl-dots pz-dots" aria-label="Puzzle ${cr.i+1} of ${CP_N}">${dotsOf(cr.grades,cr.i,CP_N)}</span></div>`;
 return`<section class="card pz-card">${head}${puzzleCard(cp,'data-pz-pick',`<button class="btn primary" data-pz="next">${cr.i+1<CP_N?'Next puzzle':'Result'}</button>`)}${muSource()}</section>`;
}

/* ---------- Tägliches Puzzle ---------- */
const DAILY_N=5;
function todayKey(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const pid=()=>{try{let v=localStorage.getItem(PID_KEY);if(!v){v=Math.random().toString(36).slice(2,12)+Math.random().toString(36).slice(2,12);localStorage.setItem(PID_KEY,v);}return v;}catch{return'gast';}};
function initDaily(){
 const date=todayKey(),rng=seeded('riftroom-daily-'+date+'-'+mu.patch);
 const puzzles=withRng(rng,()=>shuffle(ROLE_KEYS).map(r=>makePuzzle([r])).filter(Boolean)).slice(0,DAILY_N);
 const saved=load(DAILY_KEY,{});
 daily={date,puzzles,i:0,ms:0,shownAt:0,done:false,submitted:false,board:null,boardState:''};
 if(saved.date===date&&Array.isArray(saved.answers)){
  saved.answers.slice(0,puzzles.length).forEach((id,k)=>{const p=puzzles[k];if(p.opts.some(o=>o.id===id)){p.answer=id;p.grade=gradeOf(p,id);}});
  daily.i=Math.min(saved.answers.length,puzzles.length-1);daily.ms=saved.ms||0;daily.submitted=!!saved.submitted;
  daily.done=saved.answers.length>=puzzles.length;
 }
}
const dailyScore=()=>daily.puzzles.reduce((s,p)=>s+(p.grade==='best'?2:p.grade==='good'?1:0),0);
function saveDaily(){store(DAILY_KEY,{date:daily.date,answers:daily.puzzles.filter(p=>p.answer).map(p=>p.answer),ms:daily.ms,submitted:daily.submitted});}
function answerDaily(id){
 const p=daily?.puzzles[daily.i];if(!p||p.answer||!p.opts.some(o=>o.id===id))return;
 p.answer=id;p.grade=gradeOf(p,id);daily.ms+=Math.min(120000,Date.now()-(daily.shownAt||Date.now()));
 if(p.grade==='best')fx='best';
 saveDaily();
}
function nextDaily(){if(!daily)return;if(daily.i+1<daily.puzzles.length){daily.i++;daily.shownAt=0;}else{daily.done=true;loadBoard();}}
const squares=()=>daily.puzzles.map(p=>p.grade==='best'?'🟩':p.grade==='good'?'🟨':'🟥').join('');
function loadBoard(){
 if(!ctx.board){daily.boardState='none';return;}
 daily.boardState='loading';
 ctx.board.list(daily.date).then(list=>{daily.board=list;daily.boardState='ok';ctx.rerender();}).catch(()=>{daily.boardState='error';ctx.rerender();});
}
function submitDaily(){
 const input=document.getElementById('dl-nick'),nick=(input?.value||'').trim().slice(0,24);
 if(!nick){ctx.toast('Enter your name first.',true);input?.focus();return;}
 try{localStorage.setItem(NICK_KEY,nick);}catch{}
 if(!ctx.board){ctx.toast('The leaderboard needs an internet connection.',true);return;}
 daily.boardState='loading';ctx.rerender();
 ctx.board.submit(daily.date,{pid:pid(),nick,score:dailyScore(),ms:Math.round(daily.ms)}).then(()=>{daily.submitted=true;saveDaily();loadBoard();ctx.toast('Submitted.');}).catch(()=>{daily.boardState='error';ctx.rerender();ctx.toast('Submitting didn\'t work. Try again in a moment.',true);});
}
function boardHtml(){
 const st=daily.boardState;
 if(st==='none')return'<p class="fine">The leaderboard needs an internet connection.</p>';
 if(st==='loading'||!st)return'<div class="spinner small"></div>';
 if(st==='error')return'<p class="fine">The leaderboard is not available right now.</p>';
 const me=pid(),list=[...(daily.board||[])].sort((a,b)=>b.score-a.score||a.ms-b.ms).slice(0,30);
 if(!list.length)return'<p class="fine">Nobody has entered yet. Be the first!</p>';
 return`<ol class="dl-board">${list.map((e,k)=>`<li class="${e.pid===me||e.me?'me':''}" style="--i:${k}"><span class="dl-rank">${k+1}</span><span class="dl-nick">${ctx.esc(e.nick)}</span><span class="dl-score">${e.score}/10</span><span class="dl-time">${mmss(e.ms/1000)}</span></li>`).join('')}</ol>`;
}
function dailyHtml(){
 if(!mu){fetchData('matchups');return loading.matchups==='error'?dataError('matchups'):spinner;}
 if(!daily||daily.date!==todayKey())initDaily();
 const started=daily.started||daily.done||daily.puzzles.some(p=>p.answer);
 if(!started)return hero({art:'Ahri',badge:'Today',t1:'Daily',t2:'Puzzle',rules:'Five counter puzzles, one per role, the same for everyone. Only your first try counts. Afterwards you can enter the leaderboard.',demo:['🟩','🟩','🟨','🟥','🟩'].map((x,i)=>`<span class="pz-demo-sq" style="--i:${i}">${x}</span>`).join(''),btn:'Start puzzle',act:'data-dl="start"'});
 if(!daily.puzzles.length)return'<section class="card empty"><h2>No puzzle today</h2><p>Data is missing right now. Try again later.</p></section>';
 const dateLabel=new Date().toLocaleDateString(de()?'en-US':'en-US',{weekday:'long',day:'numeric',month:'long'});
 const dots=daily.puzzles.map((p,k)=>`<i class="${p.grade||''} ${k===daily.i&&!daily.done?'now':''}"></i>`).join('');
 const top=`<div class="dl-top"><div><span class="mg-badge">Daily puzzle</span><h2>${ctx.esc(dateLabel)}</h2><p class="fine">Five counter puzzles, the same for everyone. Best pick 2 points, good pick 1 point.</p></div><span class="dl-dots">${dots}</span></div>`;
 if(daily.done){
  if(daily.boardState===''&&ctx.board)loadBoard();
  const score=dailyScore(),nick=(()=>{try{return localStorage.getItem(NICK_KEY)||'';}catch{return'';}})();
  const share=`Riftroom Daily ${daily.date} · ${score}/10\n${squares()}`;
  const form=daily.submitted?'<p class="fine">You\'re on the board. There\'s a new puzzle tomorrow.</p>':`<div class="row dl-form"><input class="field grow" id="dl-nick" maxlength="24" value="${ctx.esc(nick)}" placeholder="Your name" aria-label="Your name" autocomplete="off"><button class="btn primary" data-dl="submit">Add to leaderboard</button></div>`;
  return`<section class="card dl-card">${top}<div class="dl-result"><div class="dl-score-big"><b data-countup="0">${score}</b><span>/10</span></div><div class="dl-squares" aria-label="Ergebnis">${squares()}</div><p class="fine">Time: ${mmss(daily.ms/1000)}</p><button class="btn small" data-dl="share" data-share="${ctx.esc(share)}">Copy result</button></div>${form}<h3 class="dl-h">Today's leaderboard</h3>${boardHtml()}</section>`;
 }
 const p=daily.puzzles[daily.i];if(!daily.shownAt&&!p.answer)daily.shownAt=Date.now();
 const next=`<button class="btn primary" data-dl="next">${daily.i+1<daily.puzzles.length?'Next':'See result'}</button>`;
 return`<section class="card pz-card dl-card">${top}${puzzleCard(p,'data-dl-pick',next)}${muSource()}</section>`;
}

/* ---------- Wer gewinnt? ---------- */
function rolePool(role){
 const meta=ctx.meta();if(!meta)return[];
 return meta.entries.filter(e=>e.role===role&&(e.pickRate||0)>=1.5&&known(e.champion)).map(e=>({id:e.champion,a:adj(e.wins/e.games*100,e.games),w:e.pickRate||1}));
}
function weighted(list){const sum=list.reduce((s,x)=>s+x.w,0);let r=R()*sum;for(const x of list){r-=x.w;if(r<=0)return x;}return list[list.length-1];}
// Vorteil des blauen Champions im Duell gegen den roten, in Prozentpunkten über 50 %.
function laneEdge(role,b,r,poolB,poolR){
 const t=mu?.roles?.[role]||{};
 const vs=(t[r]||[]).find(x=>x[0]===b);if(vs&&vs[2]>=300)return{edge:adj(vs[1],vs[2])-50,n:vs[2],src:'duel'};
 const vs2=(t[b]||[]).find(x=>x[0]===r);if(vs2&&vs2[2]>=300)return{edge:50-adj(vs2[1],vs2[2]),n:vs2[2],src:'duel'};
 return{edge:((poolB?.a||50)-(poolR?.a||50))/2,n:0,src:'wr'};
}
function makeDuel(){
 for(let tries=0;tries<60;tries++){
  const used=new Set(),blue=[],red=[],lanes=[];
  for(const role of ROLE_KEYS){
   const pool=rolePool(role).filter(x=>!used.has(x.id));if(pool.length<4)return null;
   const b=weighted(pool);used.add(b.id);const r=weighted(pool.filter(x=>!used.has(x.id)));used.add(r.id);
   blue.push(b.id);red.push(r.id);lanes.push({role,b:b.id,r:r.id,...laneEdge(role,b.id,r.id,b,r)});
  }
  const total=lanes.reduce((s,l)=>s+l.edge,0);
  if(Math.abs(total)<2.5)continue;
  return{blue,red,lanes,total,win:Math.max(35,Math.min(65,50+total*0.9)),answer:null};
 }
 return null;
}
const WW_N=10;let wr=null;
function answerDuel(side){
 if(!ww||ww.answer)return;
 ww.answer=side;const right=(side==='blue')===(ww.total>0);ww.right=right;if(wr)wr.res[wr.i]=right?'best':'bad';
 wws.played++;if(right){wws.right++;wws.streak++;fx='best';}else wws.streak=0;wws.best=Math.max(wws.best,wws.streak);store(WW_KEY,wws);
}
function duelHtml(){
 if(!mu){fetchData('matchups');return loading.matchups==='error'?dataError('matchups'):spinner;}
 if(!ctx.meta())return'<section class="card empty"><h2>No win rates yet</h2><p>This game needs the current win rates. They load automatically once there is a connection.</p></section>';
 if(!wr)return hero({art:'Jinx',badge:'Minigame',t1:'Who',t2:'wins?',rules:`Two drafts face off. Guess which team is ahead based on the lane matchups. ${WW_N} duels per round.`,demo:'<span class="pz-demo-vs b">Blue</span><span class="pz-demo-x">VS</span><span class="pz-demo-vs r">Red</span>',stats:stat(wws.best,'best streak')+stat(`${wws.right}/${wws.played}`,'correct'),btn:'Start round',act:'data-ww="start"',friends:'whowins'});
 if(wr.done){const n=wr.res.filter(x=>x==='best').length;return roundEnd({badge:'Round complete',big:n,unit:`/${WW_N}`,sq:wr.res.map(sqOf).join(''),text:n>=8?'You read drafts like an analyst.':n>=5?'Solid. Watch for the biggest lane advantages.':'Look at the lane bars and it will go better.',act:'data-ww="start"'});}
 if(!ww)ww=makeDuel();
 if(!ww)return'<section class="card empty"><h2>No matchup found</h2><p>Data is missing right now. Try again later.</p></section>';
 return`<section class="card ww-card"><div class="pz-head"><div class="pz-rating"><span class="fine">Streak</span><b>${wws.streak}</b></div><span class="dl-dots pz-dots">${dotsOf(wr.res,wr.i,WW_N)}</span></div>${duelView(ww,'data-ww-pick',`<button class="btn primary" data-ww="next">${wr.i+1<WW_N?'Next duel':'Result'}</button>`)}</section>`;
}
// Die Duell-Karte, genutzt allein und in der Lobby.
function duelView(ww,pickAttr,next){
 const done=!!ww.answer,favBlue=ww.total>0;
 const team=(ids,side)=>`<div class="ww-team ${side} ${done&&(side==='blue')===favBlue?'fav':''}">${ids.map((id,k)=>`<div class="ww-row" style="--i:${k}"><img class="ww-art" src="${ctx.LOADING[id]||ctx.SQUARE[id]}" alt=""><span class="role-label">${ROLE_LABEL[ROLE_KEYS[k]]}</span><strong>${name(id)}</strong></div>`).join('')}</div>`;
 const max=Math.max(4,...ww.lanes.map(l=>Math.abs(l.edge)));
 const lanes=done?`<div class="ww-lanes">${ww.lanes.map((l,k)=>{const w=Math.abs(l.edge)/max*50;return`<div class="ww-lane" style="--i:${k}"><span class="ww-l">${icon(l.b)}</span><span class="ww-track"><i class="${l.edge>=0?'b':'r'}" style="${l.edge>=0?`right:50%`:`left:50%`};width:${w}%"></i><em>${ROLE_LABEL[l.role]} · ${l.edge>=0?'+':''}${l.edge.toFixed(1).replace('.',de()?',':'.')}</em></span><span class="ww-l">${icon(l.r)}</span></div>`;}).join('')}</div>`:'';
 const winBar=done?`<div class="ww-win"><span class="b" style="width:${ww.win}%">${Math.round(ww.win)} %</span><span class="r">${Math.round(100-ww.win)} %</span></div>`:'';
 const verdict=done?`<div class="pz-verdict ${ww.right?'best':'bad'}"><strong>${ww.right?'Correct!':'Wrong'}</strong><p>${favBlue?'Blue':'Red'} is ahead: ${ww.lanes.filter(l=>(l.edge>0)===favBlue).length} of 5 lane matchups go to ${favBlue?'Blue':'Red'}. Estimated win chance ${Math.round(Math.max(ww.win,100-ww.win))} %.</p>${next}</div>`:'';
 const ask=done?'':`<div class="ww-ask"><p>Which team do the stats favor?</p><div class="row"><button class="btn ww-pick blue" ${pickAttr}="blue">Blue</button><button class="btn ww-pick red" ${pickAttr}="red">Red</button></div></div>`;
 return`<div class="ww-board">${team(ww.blue,'blue')}<div class="ww-vs">VS</div>${team(ww.red,'red')}</div>${ask}${lanes}${winBar}${verdict}<p class="fine pz-src">Based on the win rates of the five lane matchups (${ctx.esc(mu.rank)}, Patch ${ctx.esc(mu.patch)}). An estimate, not a guarantee.</p>`;
}

/* ---------- Ban-Puzzle ---------- */
function makeBan(){
 for(let tries=0;tries<60;tries++){
  const used=new Set(),players=[];
  for(const role of ROLE_KEYS){
   const pool=rolePool(role).filter(x=>!used.has(x.id));if(pool.length<4)return null;
   const n=2+Math.floor(R()*2),champs=[];
   for(let k=0;k<n;k++){const c=weighted(pool.filter(x=>!used.has(x.id)));used.add(c.id);champs.push({id:c.id,meta:c.a});}
   const raw=champs.map(()=>0.5+R());const sum=raw.reduce((s,x)=>s+x,0);
   champs.forEach((c,k)=>{c.share=raw[k]/sum;c.wr=47+R()*8;});
   players.push({role,games:40+Math.floor(R()*80),champs});
  }
  // Ein Spieler hängt stark an einem Champion: das ist die beste Ban-Chance. Ein anderer hat einen breiten, guten Pool.
  const ot=Math.floor(R()*5),deep=(ot+1+Math.floor(R()*4))%5;
  const o=players[ot];o.champs[0].share=0.66+R()*0.14;o.champs.slice(1).forEach(c=>{c.share=(1-o.champs[0].share)/(o.champs.length-1);c.wr=43+R()*4;});o.champs[0].wr=58+R()*5;
  players[deep].champs.forEach(c=>{c.wr=52+R()*3;});
  for(const p of players)for(const c of p.champs){
   const others=p.champs.filter(x=>x!==c),os=others.reduce((s,x)=>s+x.share,0);
   const backup=others.reduce((s,x)=>s+x.wr*x.share,0)/(os||1);
   c.impact=Math.max(0,c.share*(c.wr-backup))+Math.max(0,c.meta-50)*0.3;
   c.games=Math.max(1,Math.round(p.games*c.share));c.backup=backup;
  }
  const all=players.flatMap((p,i)=>p.champs.map(c=>({...c,pi:i}))).sort((a,b)=>b.impact-a.impact);
  if(all[0].impact<all[1].impact*1.4)continue;
  return{players,rank:all.map(c=>c.id),bestId:all[0].id,answer:null};
 }
 return null;
}
const BP_N=5;let br=null;
function answerBan(id){
 if(!bp||bp.answer||!bp.rank.includes(id))return;
 const r=bp.rank.indexOf(id),pts=r===0?2:r<=2?1:0;bp.answer=id;bp.pts=pts;if(br)br.res[br.i]=pts===2?'best':pts?'good':'bad';
 bps.played++;bps.points+=pts;if(pts===2){bps.streak++;fx='best';}else if(!pts)bps.streak=0;bps.best=Math.max(bps.best,bps.streak);store(BP_KEY,bps);
}
function banHtml(){
 if(!ctx.meta())return'<section class="card empty"><h2>No win rates yet</h2><p>This game needs the current win rates. They load automatically once there is a connection.</p></section>';
 if(!br)return hero({art:'Zed',badge:'Minigame',t1:'Ban',t2:'Puzzle',rules:`You see an enemy team with their champion pools. Which ban hurts them most? ${BP_N} teams per round, best ban scores 2 points.`,demo:['','✕',''].map((x,i)=>`<span class="pz-demo-card ${x?'ban':''}" style="--i:${i}">${x||'?'}</span>`).join(''),stats:stat(bps.best,'best streak')+stat(bps.played,'played'),btn:'Start round',act:'data-bp="start"',friends:'ban'});
 if(br.done){const n=br.res.reduce((s,x)=>s+(x==='best'?2:x==='good'?1:0),0);return roundEnd({badge:'Round complete',big:n,unit:`/${BP_N*2}`,sq:br.res.map(sqOf).join(''),text:n>=8?'You spot the weak points right away.':n>=5?'Solid. Look for players with few fallback picks.':'Tip: a player who plays almost only one champion is the best target.',act:'data-bp="start"'});}
 if(!bp)bp=makeBan();
 if(!bp)return'<section class="card empty"><h2>No puzzle found</h2><p>Data is missing right now. Try again later.</p></section>';
 return`<section class="card bp-card"><div class="pz-head"><div class="pz-rating"><span class="fine">Streak</span><b>${bps.streak}</b></div><span class="dl-dots pz-dots">${dotsOf(br.res,br.i,BP_N)}</span></div>${banView(bp,'data-bp-pick',`<button class="btn primary" data-bp="next">${br.i+1<BP_N?'Next team':'Result'}</button>`)}</section>`;
}
function banView(bp,pickAttr,next){
 const done=!!bp.answer,maxI=Math.max(...bp.players.flatMap(p=>p.champs.map(c=>c.impact)),0.1);
 const cards=bp.players.map((p,i)=>`<div class="bp-player" style="--i:${i}"><div class="bp-ph"><span class="role-label">${ROLE_LABEL[p.role]}</span><span class="fine">${p.games} games</span></div>${p.champs.map(c=>{const cls=!done?'':c.id===bp.bestId?'best':bp.rank.indexOf(c.id)<=2?'good':'';return`<button class="bp-champ ${cls} ${bp.answer===c.id?'mine':''}" ${pickAttr}="${c.id}" ${done?'disabled':''}>${icon(c.id)}<span class="bp-info"><b>${name(c.id)}</b><small>${Math.round(c.share*100)}% of games · ${Math.round(c.wr)}% wins</small>${done?`<span class="bp-bar"><i style="width:${Math.max(3,c.impact/maxI*100)}%"></i></span>`:''}</span>${!done?'<span class="bp-x" aria-hidden="true">✕</span>':''}</button>`;}).join('')}</div>`).join('');
 const b=bp.players.flatMap(p=>p.champs.map(c=>({...c,role:p.role}))).find(c=>c.id===bp.bestId);
 const verdict=done?`<div class="pz-verdict ${bp.pts===2?'best':bp.pts?'good':'bad'}"><strong>${bp.pts===2?'Perfect ban!':bp.pts?'Good ban':'Little impact'}</strong><p> ${name(b.id)} hurts the most: the ${ROLE_LABEL[b.role]} player picks it in ${Math.round(b.share*100)}% of games and wins ${Math.round(b.wr)}%. Without it he drops to about ${Math.round(b.backup)}%.</p>${next}</div>`:'<p class="bp-ask">Tap the champion you would ban.</p>';
 return`<div class="bp-intro"><h2>The enemy team</h2><p class="fine">An example team with its recent games. Which ban takes the most away from them?</p></div><div class="bp-grid">${cards}</div>${verdict}`;
}

/* ---------- Macro-Quiz ---------- */
const ROUND=5;
function scenList(){return scen?.[de()?'de':'en']||[];}
function newRound(){
 const all=scenList();if(!all.length){mq=null;return;}
 let fresh=all.filter(s=>!mqs.seen.includes(s.id));if(fresh.length<ROUND){mqs.seen=[];fresh=all;}
 mq={ids:shuffle(fresh).slice(0,ROUND).map(s=>s.id),i:0,points:0,answer:null,done:false};
}
// Spieler, die zu dicht stehen, sanft auseinanderschieben, damit sich keine Kreise überdecken.
function spread(tokens,objs){
 const p=tokens.map(t=>[t[2],t[3]]),fixed=objs.map(o=>[o[1],o[2]]);
 for(let it=0;it<80;it++){let moved=false;
  for(let i=0;i<p.length;i++){
   for(let j=i+1;j<p.length;j++){const dx=p[j][0]-p[i][0],dy=p[j][1]-p[i][1],d=Math.hypot(dx,dy)||0.01;if(d<8.8){const k=(8.8-d)/2,ux=d>0.02?dx/d:Math.cos(i+j),uy=d>0.02?dy/d:Math.sin(i+j);p[i][0]-=ux*k;p[i][1]-=uy*k;p[j][0]+=ux*k;p[j][1]+=uy*k;moved=true;}}
   for(const f of fixed){const dx=p[i][0]-f[0],dy=p[i][1]-f[1],d=Math.hypot(dx,dy)||0.01;if(d<6.5){p[i][0]+=dx/d*(6.5-d);p[i][1]+=dy/d*(6.5-d);moved=true;}}
   p[i][0]=Math.min(95,Math.max(5,p[i][0]));p[i][1]=Math.min(95,Math.max(5,p[i][1]));
  }
  if(!moved)break;}
 return tokens.map((t,i)=>[t[0],t[1],Math.round(p[i][0]*10)/10,Math.round(p[i][1]*10)/10,t[4]]);
}
function mapSvg(s){
 const on=spread(s.tokens.filter(t=>t[2]||t[3]),s.objs),cls=t=>`tk ${t[0]==='b'?'blue':'red'} ${t[4]||''}`;
 const tok=(t,k)=>`<g class="${cls(t)}" transform="translate(${t[2]} ${t[3]})"><g class="tk-in" style="--i:${k}"><circle r="4"/><text y="1.5" text-anchor="middle">${t[1]}</text>${t[4]==='me'?'<text class="tk-me" y="-6.4" text-anchor="middle">YOU</text>':''}${t[4]==='miss'?'<text class="tk-q" x="4.4" y="-3" text-anchor="middle">?</text>':''}</g></g>`;
 const obj=o=>o[0]==='tower'?`<g class="ob-tower" transform="translate(${o[1]} ${o[2]})"><rect x="-2" y="-2" width="4" height="4"/><path d="M-2.4 -2.4 2.4 2.4 M2.4 -2.4 -2.4 2.4"/></g>`
  :`<g class="ob ${o[0]}" transform="translate(${o[1]} ${o[2]})"><circle class="ob-pulse" r="3"/><rect x="-2.6" y="-2.6" width="5.2" height="5.2" transform="rotate(45)"/></g>`;
 // Beschriftung der Ziele zuletzt zeichnen, damit sie über den Spielern liegt.
 const objLabel=o=>o[0]==='tower'?'':`<text class="ob-label" x="${o[1]}" y="${o[2]>50?o[2]+9:o[2]-5.5}" text-anchor="middle">${OBJ_NAME[o[0]]}${o[3]?' · '+(OBJ_STATE[o[3]]||o[3]):''}</text>`;
 const others=on.filter(t=>t[4]!=='me'),mine=on.filter(t=>t[4]==='me');
 return`<svg class="rift mq-map" viewBox="-2 -2 104 104" role="img" aria-label="Map of the situation">
  <rect x="0" y="0" width="100" height="100" rx="6" class="m-ground"/>
  <g class="m-jungle"><ellipse cx="27" cy="52" rx="9" ry="15" transform="rotate(45 27 52)"/><ellipse cx="48" cy="73" rx="9" ry="15" transform="rotate(45 48 73)"/><ellipse cx="52" cy="27" rx="9" ry="15" transform="rotate(45 52 27)"/><ellipse cx="73" cy="48" rx="9" ry="15" transform="rotate(45 73 48)"/></g>
  <path d="M7 7 L93 93" class="m-river"/>
  <g class="m-lanes"><path d="M10 86 V10 H86"/><path d="M14 90 H90 V14"/><path d="M15 85 L85 15"/></g>
  <circle cx="10" cy="90" r="8" class="m-base blue"/><circle cx="90" cy="10" r="8" class="m-base red"/>
  ${s.objs.map(obj).join('')}${others.map(tok).join('')}${mine.map((t,k)=>tok(t,others.length+k)).join('')}${s.objs.map(objLabel).join('')}
 </svg>`;
}
function offMap(s){
 const off=s.tokens.filter(t=>!t[2]&&!t[3]);if(!off.length)return'';
 const group=(flag,label)=>{const l=off.filter(t=>t[4]===flag);return l.length?`<span><b>${label}:</b> ${l.map(t=>`${t[0]==='b'?'Your':'Opponent'} ${LETTER_ROLE[t[1]]}`).join(', ')}</span>`:'';};
 return`<div class="mq-off fine">${group('dead','Dead')}${group('miss','Not visible')}</div>`;
}
function macroHtml(){
 if(!scen){fetchData('scenarios');return loading.scenarios==='error'?dataError('scenarios'):spinner;}
 if(!mq)return hero({art:'Nautilus',badge:'Minigame',t1:'Macro',t2:'Quiz',rules:`You see a situation on the map and get three options. The best one scores 2 points, an okay one 1 point. ${ROUND} situations per round, ${scenList().length} in total.`,demo:'<span class="pz-demo-dot b"></span><span class="pz-demo-dot b me"></span><span class="pz-demo-dot obj"></span><span class="pz-demo-dot r"></span>',stats:mqs.best?stat(mqs.best,'Best')+stat(mqs.rounds,'rounds'):'',btn:'Start round',act:'data-mq="again"',friends:'macro'});
 const all=scenList();
 if(mq.done){
  const max=ROUND*2;
  return`<section class="card mq-end"><span class="mg-badge">Round complete</span><h2><b data-countup="0">${mq.points}</b> of ${max} points</h2><p class="fine">${mq.points>=max-1?'Well played, those are high-level decisions.':mq.points>=max/2?'Solid. Have another look at the explanations for the others.':'Read the explanations and the next round will go better.'} Best: ${mqs.best} points.</p><button class="mg-go small" data-mq="again"><span>Play again</span></button></section>`;
 }
 const s=all.find(x=>x.id===mq.ids[mq.i]);if(!s){mq=null;return macroHtml();}
 const dots=mq.ids.map((_,k)=>`<i class="${k<mq.i?'done':k===mq.i?'now':''}"></i>`).join('');
 const res=mq.answer!=null?`<div class="mq-next"><span class="mq-pts">${s.opts[mq.answer].s===2?'+2 points':s.opts[mq.answer].s===1?'+1 point':'0 points'}</span><button class="btn primary" data-mq="next">${mq.i+1<ROUND?'Next':'Result'}</button></div>`:'';
 return`<section class="card mq-card"><div class="mq-top"><span class="mq-dots" aria-label="Question ${mq.i+1} of ${ROUND}">${dots}</span><span class="fine">Points: <b>${mq.points}</b></span></div>${macroView(s,mq.answer,'data-mq-pick',res)}</section>`;
}
function macroView(s,answer,pickAttr,res){
 const opts=s.opts.map((o,k)=>{const done=answer!=null;const cls=!done?'':['bad','ok','best'][o.s];
  return`<button class="mq-opt ${cls} ${answer===k?'mine':''}" style="--i:${k}" ${pickAttr}="${k}" ${done?'disabled':''}><span class="mq-letter">${'ABC'[k]}</span><span class="mq-t">${ctx.esc(o.t)}${done?`<small>${o.s===2?'Best choice':o.s===1?'Okay':'Bad'}: ${ctx.esc(o.why)}</small>`:''}</span></button>`;}).join('');
 return`<div class="mq-grid"><div class="mq-mapwrap">${mapSvg(s)}${offMap(s)}<p class="fine mq-legend"><span class="lg blue"></span>Your team <span class="lg red"></span>Enemy <span class="lg me"></span>You</p></div>
  <div class="mq-body"><div class="mq-meta"><span class="tag">You: ${LETTER_ROLE[s.role]}</span><span class="tag mq-clock">${ctx.esc(s.time)}</span></div><h2>${ctx.esc(s.title)}</h2><p>${ctx.esc(s.text)}</p><p class="mq-q">What is the best play?</p><div class="mq-opts">${opts}</div>${res}</div></div>`;
}
function answerMacro(k){
 if(!mq||mq.answer!=null)return;
 const s=scenList().find(x=>x.id===mq.ids[mq.i]);if(!s||!s.opts[k])return;
 mq.answer=k;mq.points+=s.opts[k].s;if(s.opts[k].s===2)fx='best';
 if(!mqs.seen.includes(s.id))mqs.seen.push(s.id);store(MQ_KEY,mqs);
}
function nextMacro(){
 if(!mq)return;
 if(mq.i+1<ROUND){mq.i++;mq.answer=null;return;}
 mq.done=true;mqs.rounds++;mqs.best=Math.max(mqs.best,mq.points);store(MQ_KEY,mqs);if(mq.points>=8)fx='best';
}

/* ---------- Timer-Quiz ---------- */
// Feste Zeiten: Drache 5 Min. nach dem Tod, Baron 6 Min., Inhibitor 5 Min., Buffs 5 Min.
// Abklingzeiten der Beschwörerzauber aus Riots Data Dragon (ohne Rabatt durch Runen oder Stiefel).
const TQ_N=5,TQ_SECS=12;
const SPELLS=[['Flash',300],['Ignite',180],['Heal',240],['Exhaust',240],['Barrier',180],['Cleanse',240],['Ghost',240]];
const FIRST=[['Dragon',300],['Voidgrubs',480],['Herald',900],['Baron',1200]];
const rnd=(a,b)=>a+Math.floor(R()*(b-a+1));
function makeTimerQ(){
 const kind=pick(['drake','drake','baron','inhib','buff','spell','spell','spell','first']);
 let q,ans,rule,alt=[];
 if(kind==='first'){
  const [n,t]=pick(FIRST);
  q=`When does ${n} spawn for the first time?`;ans=t;rule=`${n} first spawns at ${mmss(t)}.`;
  alt=FIRST.map(f=>f[1]).filter(x=>x!==t).concat([600,360]);
 }else{
  const T={drake:[rnd(330,1800),300,'Dragon','The next dragon spawns 5 minutes after the last one dies.'],baron:[rnd(1230,2100),360,'Baron','Baron respawns 6 minutes after it dies.'],inhib:[rnd(1080,2400),300,'Inhibitor','An inhibitor respawns after 5 minutes.'],buff:[rnd(120,1500),300,pick(['Blue buff','Red buff']),'Blue and red buff respawn 5 minutes after they die.']};
  if(kind==='spell'){const [n,cd]=pick(SPELLS),t=rnd(150,1800);q=`Enemy uses ${n} at ${mmss(t)}. When is it ready again?`;ans=t+cd;rule=`${n} has a ${mmss(cd)} cooldown (without reductions from runes or boots).`;alt=[t+cd-60,t+cd+60,t+300,t+240,t+180,t+cd-30,t+cd+30];}
  else{const [t,add,n,r]=T[kind];q=kind==='inhib'?`Inhibitor destroyed at ${mmss(t)}. When is it back?`:`${n} at ${mmss(t)}. When is it back?`;ans=t+add;rule=r;alt=[t+add-60,t+add+60,t+(add===300?360:300),t+add-30,t+add+30];}
 }
 const opts=[ans];for(const a of shuffle(alt))if(a>0&&!opts.includes(a)&&opts.length<4)opts.push(a);
 return{kind,q,ans,rule,opts:opts.sort((a,b)=>a-b)};
}
function newTimerRound(){tq={qs:Array.from({length:TQ_N},makeTimerQ),i:0,points:0,answer:null,deadline:0,done:false,right:0};}
function stopTimer(){clearInterval(tqTimer);tqTimer=null;}
function startTimer(){
 stopTimer();if(!tq||tq.done||tq.answer!=null)return;
 if(!tq.deadline)tq.deadline=Date.now()+TQ_SECS*1000;
 tqTimer=setInterval(()=>{
  const left=Math.max(0,tq.deadline-Date.now()),ring=document.getElementById('tq-ring'),num=document.getElementById('tq-left');
  if(!ring){stopTimer();return;}
  ring.style.setProperty('--p',String(left/(TQ_SECS*1000)));if(num)num.textContent=Math.ceil(left/1000);
  if(!left){stopTimer();answerTimer(-1);ctx.rerender();}
 },100);
}
function answerTimer(val){
 if(!tq||tq.answer!=null)return;
 stopTimer();const q=tq.qs[tq.i],left=Math.max(0,tq.deadline-Date.now())/1000;
 tq.answer=val;q.ok=val===q.ans;q.gain=q.ok?Math.round(50+left*10):0;tq.points+=q.gain;if(q.ok){tq.right++;fx='small';}
}
function nextTimer(){if(!tq)return;if(tq.i+1<TQ_N){tq.i++;tq.answer=null;tq.deadline=0;}else{tq.done=true;tqs.rounds++;const rec=tq.points>tqs.best;tqs.best=Math.max(tqs.best,tq.points);store(TQ_KEY,tqs);if(rec||tq.right>=4)fx='best';}}
function timerHtml(){
 if(!tq)return hero({art:'Zilean',badge:'Minigame',t1:'Timer',t2:'Quiz',rules:`When does the dragon respawn? When does the enemy have Flash again? ${TQ_N} questions, ${TQ_SECS} seconds. The faster you are, the more points you get.`,demo:'<div class="tq-clock big"><span>5:00</span></div>',stats:tqs.best?stat(tqs.best,'Best')+stat(tqs.rounds,'rounds'):'',btn:'Let\'s go',act:'data-tq="start"',friends:'timer'});
 if(tq.done){
  return`<section class="card mq-end"><span class="mg-badge">Round complete</span><h2><b data-countup="0">${tq.points}</b> points</h2><p class="fine">${tq.right} of ${TQ_N} correct. Best: ${tqs.best} points.</p><button class="mg-go small" data-tq="start"><span>Play again</span></button></section>`;
 }
 const q=tq.qs[tq.i],done=tq.answer!=null;
 const dots=tq.qs.map((x,k)=>`<i class="${k<tq.i?(x.ok?'best':'bad'):k===tq.i?'now':''}"></i>`).join('');
 const left=done?0:Math.max(0,tq.deadline?(tq.deadline-Date.now())/1000:TQ_SECS);
 return`<section class="card tq-card"><div class="mq-top"><span class="mq-dots dl-dots">${dots}</span><span class="fine">Points: <b>${tq.points}</b></span></div>${timerView(q,tq.answer,q.gain,left,'data-tq-pick',`<button class="btn primary" data-tq="next">${tq.i+1<TQ_N?'Next':'Result'}</button>`,'tq')}</section>`;
}
function timerView(q,answer,gain,left,pickAttr,next,idp){
 const done=answer!=null,ok=answer===q.ans;
 const opts=q.opts.map((t,k)=>{const cls=!done?'':t===q.ans?'best':t===answer?'bad':'';return`<button class="tq-opt ${cls}" style="--i:${k}" ${pickAttr}="${t}" ${done?'disabled':''}>${mmss(t)}</button>`;}).join('');
 const res=done?`<div class="pz-verdict ${ok?'best':'bad'}"><strong>${ok?`+${gain}`:answer===-1?'Time\'s up':'Wrong'}</strong><p>The answer is ${mmss(q.ans)}. ${ctx.esc(q.rule)}</p>${next}</div>`:'';
 return`<div class="tq-main"><div class="tq-ring" id="${idp}-ring" style="--p:${left/TQ_SECS}"><span id="${idp}-left">${Math.ceil(left)}</span></div><h2 class="tq-q">${ctx.esc(q.q)}</h2></div><div class="tq-opts">${opts}</div>${res}`;
}

/* ---------- Mehrspieler (Lobby) ---------- */
// Alle in einer Lobby erzeugen aus demselben Startwert dieselben Aufgaben, jeder bei sich und in seiner Sprache.
// Die Prüfsumme zeigt, ob wirklich alle dieselben Aufgaben haben (sonst sind die Daten unterschiedlich alt).
const noWr='<section class="card empty"><h2>No win rates yet</h2><p>This game needs the current win rates. They load automatically once there is a connection.</p></section>';
export function mpReady(game,c){
 if(c)ctx=c;
 if(game==='timer')return null;
 if(game==='macro'){if(!scen){fetchData('scenarios');return loading.scenarios==='error'?dataError('scenarios'):spinner;}return null;}
 if(!mu){fetchData('matchups');return loading.matchups==='error'?dataError('matchups'):spinner;}
 if((game==='whowins'||game==='ban')&&!ctx.meta())return noWr;
 return null;
}
const qKey=(g,q)=>g==='counter'?q.role+q.enemy:g==='whowins'?q.blue.join()+q.red.join():g==='ban'?q.rank.join():g==='macro'?q.id:`${q.ans}|${q.opts.join()}`;
export function mpGen(game,seed,n){
 return withRng(seeded(`riftroom-mp-${game}-${seed}`),()=>{
  if(game==='macro')return shuffle((scen?.de||[]).map(x=>x.id).sort()).slice(0,n).map(id=>({id}));
  const make={counter:()=>makePuzzle(ROLE_KEYS),whowins:makeDuel,ban:makeBan,timer:makeTimerQ}[game];
  const out=[],seen=new Set();
  for(let t=0;t<n*4&&out.length<n;t++){const q=make();if(!q)break;const k=qKey(game,q);if(seen.has(k))continue;seen.add(k);out.push(q);}
  return out;
 });
}
export function mpSig(game,qs){const str=qs.map(q=>qKey(game,q)).join('/');let h=7;for(let i=0;i<str.length;i++)h=Math.imul(h,31)+str.charCodeAt(i)>>>0;return h.toString(36)+'-'+qs.length;}
export const mpMax=(game,n)=>game==='timer'?n*170:game==='whowins'?n:n*2;
// Punkte und Farbe (2 grün, 1 gelb, 0 rot) einer Antwort.
export function mpGrade(game,q,val,left=0){
 if(game==='counter'){const g=gradeOf(q,val);return{pts:g==='best'?2:g==='good'?1:0,mark:g==='best'?'2':g==='good'?'1':'0'};}
 if(game==='whowins'){const ok=(val==='blue')===(q.total>0);return{pts:ok?1:0,mark:ok?'2':'0'};}
 if(game==='ban'){const r=q.rank.indexOf(val),p=r===0?2:r>=1&&r<=2?1:0;return{pts:p,mark:String(p)};}
 if(game==='macro'){const s=scenList().find(x=>x.id===q.id),p=s?.opts[val]?.s||0;return{pts:p,mark:String(p)};}
 const ok=val===q.ans;return{pts:ok?Math.round(50+left*10):0,mark:ok?'2':'0'};
}
export function mpCard(game,q,answer,gain,left,next){
 const has=answer!=null;
 if(game==='counter')return puzzleCard({...q,answer:has?answer:null,grade:has?gradeOf(q,answer):null},'data-mp-pick',next);
 if(game==='whowins')return duelView({...q,answer:has?answer:null,right:has&&(answer==='blue')===(q.total>0)},'data-mp-pick',next);
 if(game==='ban'){const r=has?q.rank.indexOf(answer):-1;return banView({...q,answer:has?answer:null,pts:r===0?2:r>=1&&r<=2?1:0},'data-mp-pick',next);}
 if(game==='macro'){
  const s=scenList().find(x=>x.id===q.id);if(!s)return'';
  const res=has?`<div class="mq-next"><span class="mq-pts">${s.opts[answer].s===2?'+2 points':s.opts[answer].s===1?'+1 point':'0 points'}</span>${next}</div>`:'';
  return macroView(s,has?answer:null,'data-mp-pick',res);
 }
 return timerView(q,has?answer:null,gain,left,'data-mp-pick',next,'mp');
}
export const MP_SECS=TQ_SECS;

/* ---------- Schnittstelle zur App ---------- */
export function setMatchups(d){if(d?.roles&&(!mu||d.updatedAt>(mu.updatedAt||'')))mu=d;}
export function miniStats(){
 const d=load(DAILY_KEY,{}),today=todayKey();
 return{counter:String(pz.rating),daily:d.date===today&&(d.answers||[]).length>=DAILY_N?'Done':'',whowins:wws.played?`${wws.right}/${wws.played}`:'',ban:bps.played?`${bps.points} pts`:'',macro:mqs.best?`Best ${mqs.best}`:'',timer:tqs.best?`Best ${tqs.best}`:''};
}
export function renderPuzzle(tab,c){
 ctx=c;if(tab!=='timer')stopTimer();
 return tab==='macro'?macroHtml():tab==='daily'?dailyHtml():tab==='whowins'?duelHtml():tab==='ban'?banHtml():tab==='timer'?timerHtml():counterHtml();
}
// Nach dem Zeichnen: Zahlen hochzählen, Konfetti bei starken Antworten, Timer weiterlaufen lassen.
export function afterPuzzle(tab){
 if(tab==='timer'&&tq&&!tq.done&&tq.answer!=null)stopTimer();
 if(tab==='timer'&&tq&&!tq.done&&tq.answer==null)startTimer();
 const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.querySelectorAll('[data-countup]').forEach(el=>{
  const to=Number(el.textContent),from=Number(el.dataset.countup);if(calm||!isFinite(to)||!isFinite(from)||to===from)return;
  const t0=performance.now(),dur=700;el.textContent=from;
  const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-(1-k)**3;el.textContent=Math.round(from+(to-from)*e);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);
 });
 if(fx){const host=document.querySelector('.pz-verdict.best,.mq-opt.best,.mq-end,.tq-opt.best,.pz-end');if(host)ctx.burst(host,fx==='small'?16:40);fx=null;}
}
export function handlePuzzleClick(el){
 const d=el.dataset;
 if(d.pzPick){answerPuzzle(d.pzPick);ctx.rerender();return true;}
 if(d.pz==='start'){cr={i:0,grades:[],from:pz.rating,done:false};newPuzzle();ctx.rerender();window.scrollTo({top:0,behavior:'smooth'});return true;}
 if(d.pz==='next'){if(cr&&cr.i+1>=CP_N){cr.done=true;fx=cr.grades.filter(g=>g==='best').length>=7?'best':null;}else{if(cr)cr.i++;newPuzzle();}ctx.rerender();return true;}
 if(d.pzRole){pz.role=d.pzRole;store(PZ_KEY,pz);ctx.rerender();return true;}
 if(d.dlPick){answerDaily(d.dlPick);ctx.rerender();return true;}
 if(d.dl==='start'){daily.started=true;daily.shownAt=0;ctx.rerender();return true;}
 if(d.dl==='next'){nextDaily();ctx.rerender();return true;}
 if(d.dl==='submit'){submitDaily();return true;}
 if(d.dl==='share'){navigator.clipboard?.writeText(d.share).then(()=>ctx.toast('Result copied. Paste it into Discord.'),()=>ctx.toast(d.share));return true;}
 if(d.wwPick){answerDuel(d.wwPick);ctx.rerender();return true;}
 if(d.ww==='start'){wr={i:0,res:[],done:false};ww=makeDuel();ctx.rerender();return true;}
 if(d.ww==='next'){if(wr&&wr.i+1>=WW_N){wr.done=true;if(wr.res.filter(x=>x==='best').length>=8)fx='best';}else{if(wr)wr.i++;ww=makeDuel();}ctx.rerender();return true;}
 if(d.bpPick){answerBan(d.bpPick);ctx.rerender();return true;}
 if(d.bp==='start'){br={i:0,res:[],done:false};bp=makeBan();ctx.rerender();return true;}
 if(d.bp==='next'){if(br&&br.i+1>=BP_N){br.done=true;if(br.res.filter(x=>x==='best').length>=4)fx='best';}else{if(br)br.i++;bp=makeBan();}ctx.rerender();return true;}
 if(d.mqPick!=null){answerMacro(Number(d.mqPick));ctx.rerender();return true;}
 if(d.mq==='next'){nextMacro();ctx.rerender();window.scrollTo({top:0,behavior:'smooth'});return true;}
 if(d.mq==='again'){newRound();ctx.rerender();return true;}
 if(d.tq==='start'){newTimerRound();ctx.rerender();return true;}
 if(d.tqPick){answerTimer(Number(d.tqPick));ctx.rerender();return true;}
 if(d.tq==='next'){nextTimer();ctx.rerender();return true;}
 return false;
}
