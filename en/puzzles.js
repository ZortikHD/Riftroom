// Minispiele mit Wertung, ähnlich wie Puzzles auf Chess.com:
// Counter-Puzzle: Gegner und Rolle sind vorgegeben, du wählst aus vier Champions den besten Konter.
//   Bewertet wird mit echten Matchup-Winrates (Lolalytics, Emerald+). Deine Wertung steigt und fällt wie eine Elo-Zahl.
// Macro-Quiz: eine Situation auf der Karte, drei Möglichkeiten. Oft ist mehr als eine okay, aber nur eine ist die beste.
// Daten liegen als Dateien im Ordner data/ und laden erst, wenn das Spiel geöffnet wird.
let ctx=null,mu=null,scen=null,loading={},cp=null,mq=null;
const PZ_KEY='riftroom.puzzle',MQ_KEY='riftroom.macro';
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
const pct=v=>(document.documentElement.lang==='de'?v.toFixed(1):v.toFixed(1))+' %';
const int=v=>Number(v).toLocaleString(document.documentElement.lang==='de'?'en-US':'en-US');
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// Winrate mit 200 virtuellen Spielen Richtung 50 % geglättet, damit kleine Stichproben nicht täuschen.
const adj=(wr,n)=>(wr*n+50*200)/(n+200);

function fetchData(name){
 if(loading[name])return;loading[name]=true;
 fetch(`data/${name}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();})
  .then(d=>{if(name==='matchups')mu=d;else scen=d;ctx?.rerender();})
  .catch(()=>{loading[name]='error';ctx?.rerender();});
}
const known=id=>ctx.catalog().champions.some(c=>c.id===id);

/* ---------- Counter-Puzzle ---------- */
function newPuzzle(){
 const roles=pz.role==='ALL'?ROLE_KEYS:[pz.role];
 for(let tries=0;tries<60;tries++){
  const role=pick(roles),table=mu.roles[role]||{},enemies=Object.keys(table).filter(known);if(!enemies.length)continue;
  const enemy=pick(enemies);
  const rows=table[enemy].filter(r=>r[2]>=MIN_GAMES&&known(r[0])).map(([id,wr,n])=>({id,wr,n,a:adj(wr,n)})).sort((x,y)=>y.a-x.a);
  if(rows.length<8)continue;
  const best=rows[0];if(best.a-rows[1].a<0.6||best.a<51)continue;
  const rest=rows.slice(1),used=new Set([best.id]);
  const take=list=>{const c=list.filter(r=>!used.has(r.id));if(!c.length)return null;const r=pick(c);used.add(r.id);return r;};
  const opts=[best,take(rest.filter(r=>r.a>=50.5&&r.a<=best.a-0.6)),take(rest.filter(r=>r.a<48.5)),take(rest.filter(r=>r.a<=best.a-0.6))].filter(Boolean);
  while(opts.length<4){const r=take(rest);if(!r)break;opts.push(r);}
  if(opts.length<4)continue;
  // Schwierigkeit: je knapper der Abstand zwischen bestem und zweitbestem Angebot, desto schwerer.
  const second=Math.max(...opts.slice(1).map(o=>o.a));
  cp={role,enemy,opts:shuffle(opts),bestId:best.id,diff:Math.round(Math.min(1700,Math.max(700,1650-(best.a-second)*180))),answer:null,delta:0};
  return;
 }
 cp=null;
}
function answerPuzzle(id){
 if(!cp||cp.answer)return;
 const o=cp.opts.find(x=>x.id===id);if(!o)return;
 const grade=id===cp.bestId?'best':o.a>=50?'good':'bad',S={best:1,good:0.75,bad:0}[grade];
 const E=1/(1+10**((cp.diff-pz.rating)/400)),K=pz.games<20?40:24;
 cp.delta=Math.round(K*(S-E));if(grade==='good')cp.delta=Math.max(1,cp.delta);cp.answer=id;cp.grade=grade;
 pz.rating=Math.max(100,pz.rating+cp.delta);pz.games++;
 if(grade==='best'){pz.streak++;pz.solved++;}else if(grade==='bad')pz.streak=0;
 pz.best=Math.max(pz.best,pz.streak);store(PZ_KEY,pz);
}
function counterHtml(){
 if(!mu){fetchData('matchups');return loading.matchups==='error'?'<section class="card empty"><h2>Data unavailable</h2><p>The matchup data could not be loaded. Check your internet connection.</p></section>':'<section class="card pz-loading"><div class="spinner"></div></section>';}
 if(!cp||(pz.role!=='ALL'&&cp.role!==pz.role&&!cp.answer))newPuzzle();
 if(!cp)return'<section class="card empty"><h2>No puzzle found</h2><p>There is not enough data for this role right now. Pick another role.</p></section>';
 const roleSeg=`<div class="seg pz-roles" role="group" aria-label="Role">${['ALL',...ROLE_KEYS].map(r=>`<button data-pz-role="${r}" aria-pressed="${pz.role===r}">${r==='ALL'?'All':ROLE_LABEL[r]}</button>`).join('')}</div>`;
 const delta=cp.answer?`<span class="pz-delta ${cp.delta>=0?'up':'down'}">${cp.delta>=0?'+':''}${cp.delta}</span>`:'';
 const head=`<div class="pz-head"><div class="pz-rating"><span class="fine">Your rating</span><b>${pz.rating}</b>${delta}</div><div class="pz-stats"><span><b>${pz.streak}</b> streak</span><span><b>${pz.best}</b> best</span><span><b>${pz.games}</b> played</span></div>${roleSeg}</div>`;
 const name=id=>ctx.esc(ctx.cname(id)),enemy=cp.enemy,maxA=Math.max(...cp.opts.map(o=>o.wr));
 const optHtml=cp.opts.map(o=>{
  const done=!!cp.answer,cls=!done?'':o.id===cp.bestId?'best':o.a>=50?'good':'bad';
  const res=done?`<span class="pz-res"><span class="pz-bar"><i style="width:${Math.max(4,Math.min(100,(o.wr-40)*5))}%"></i></span><b>${pct(o.wr)}</b><small>${int(o.n)} games</small></span>`:'';
  return`<button class="pz-opt ${cls} ${cp.answer===o.id?'mine':''}" data-pz-pick="${o.id}" ${done?'disabled':''}><img src="${ctx.SQUARE[o.id]}" alt=""><span class="pz-name">${name(o.id)}${done&&o.id===cp.bestId?' <i class="pz-star">★</i>':''}</span>${res}</button>`;
 }).join('');
 const chosen=cp.answer?cp.opts.find(o=>o.id===cp.answer):null,best=cp.opts.find(o=>o.id===cp.bestId);
 const verdict=!cp.answer?'':`<div class="pz-verdict ${cp.grade}"><strong>${cp.grade==='best'?'Best pick!':cp.grade==='good'?'Good pick':'Unfavorable pick'}</strong><p>${cp.grade==='best'?`${name(best.id)} wins ${pct(best.wr)} vs ${name(enemy)}. It doesn't get better than that.`:cp.grade==='good'?`${name(chosen.id)} wins ${pct(chosen.wr)} vs ${name(enemy)}, which is solid. Even better would be ${name(best.id)} with ${pct(best.wr)}.`:`${name(chosen.id)} wins only ${pct(chosen.wr)} vs ${name(enemy)}. Best would be ${name(best.id)} with ${pct(best.wr)}.`}</p><button class="btn primary" data-pz="next">Next puzzle</button></div>`;
 const src=`<p class="fine pz-src">Win rate in this matchup, patch ${ctx.esc(mu.patch)}, ${ctx.esc(mu.rank)}, Solo/Duo (${ctx.esc(mu.source)}). Ab ${int(MIN_GAMES)} games.</p>`;
 return`<section class="card pz-card">${head}<div class="pz-enemy"><img class="pz-splash" src="${ctx.LOADING[enemy]||ctx.SQUARE[enemy]}" alt=""><div class="pz-enemy-text"><span class="role-label">Opponent · ${ROLE_LABEL[cp.role]}</span><strong>${name(enemy)}</strong><span>Who wins most often against ${name(enemy)}?</span></div></div><div class="pz-opts">${optHtml}</div>${verdict}${src}</section>`;
}

/* ---------- Macro-Quiz ---------- */
const ROUND=5;
function scenList(){const l=document.documentElement.lang==='de'?'de':'en';return scen?.[l]||[];}
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
 const tok=t=>`<g class="${cls(t)}" transform="translate(${t[2]} ${t[3]})"><circle r="4"/><text y="1.5" text-anchor="middle">${t[1]}</text>${t[4]==='me'?'<text class="tk-me" y="-6.4" text-anchor="middle">YOU</text>':''}${t[4]==='miss'?'<text class="tk-q" x="4.4" y="-3" text-anchor="middle">?</text>':''}</g>`;
 const obj=o=>o[0]==='tower'?`<g class="ob-tower" transform="translate(${o[1]} ${o[2]})"><rect x="-2" y="-2" width="4" height="4"/><path d="M-2.4 -2.4 2.4 2.4 M2.4 -2.4 -2.4 2.4"/></g>`
  :`<g class="ob ${o[0]}" transform="translate(${o[1]} ${o[2]})"><rect x="-2.6" y="-2.6" width="5.2" height="5.2" transform="rotate(45)"/></g>`;
 // Beschriftung der Ziele zuletzt zeichnen, damit sie über den Spielern liegt.
 const objLabel=o=>o[0]==='tower'?'':`<text class="ob-label" x="${o[1]}" y="${o[2]>50?o[2]+9:o[2]-5.5}" text-anchor="middle">${OBJ_NAME[o[0]]}${o[3]?' · '+(OBJ_STATE[o[3]]||o[3]):''}</text>`;
 return`<svg class="rift mq-map" viewBox="-2 -2 104 104" role="img" aria-label="Map of the situation">
  <rect x="0" y="0" width="100" height="100" rx="6" class="m-ground"/>
  <g class="m-jungle"><ellipse cx="27" cy="52" rx="9" ry="15" transform="rotate(45 27 52)"/><ellipse cx="48" cy="73" rx="9" ry="15" transform="rotate(45 48 73)"/><ellipse cx="52" cy="27" rx="9" ry="15" transform="rotate(45 52 27)"/><ellipse cx="73" cy="48" rx="9" ry="15" transform="rotate(45 73 48)"/></g>
  <path d="M7 7 L93 93" class="m-river"/>
  <g class="m-lanes"><path d="M10 86 V10 H86"/><path d="M14 90 H90 V14"/><path d="M15 85 L85 15"/></g>
  <circle cx="10" cy="90" r="8" class="m-base blue"/><circle cx="90" cy="10" r="8" class="m-base red"/>
  ${s.objs.map(obj).join('')}${on.filter(t=>t[4]!=='me').map(tok).join('')}${on.filter(t=>t[4]==='me').map(tok).join('')}${s.objs.map(objLabel).join('')}
 </svg>`;
}
function offMap(s){
 const off=s.tokens.filter(t=>!t[2]&&!t[3]);if(!off.length)return'';
 const group=(flag,label)=>{const l=off.filter(t=>t[4]===flag);return l.length?`<span><b>${label}:</b> ${l.map(t=>`${t[0]==='b'?'Your':'Opponent'} ${LETTER_ROLE[t[1]]}`).join(', ')}</span>`:'';};
 return`<div class="mq-off fine">${group('dead','Dead')}${group('miss','Not visible')}</div>`;
}
function macroHtml(){
 if(!scen){fetchData('scenarios');return loading.scenarios==='error'?'<section class="card empty"><h2>Data unavailable</h2><p>The situations could not be loaded. Check your internet connection.</p></section>':'<section class="card pz-loading"><div class="spinner"></div></section>';}
 if(!mq)newRound();
 if(!mq)return'';
 const all=scenList();
 if(mq.done){
  const max=ROUND*2;
  return`<section class="card mq-end"><span class="mg-badge">Round complete</span><h2>${mq.points} of ${max} points</h2><p class="fine">${mq.points>=max-1?'Well played, those are high-level decisions.':mq.points>=max/2?'Solid. Have another look at the explanations for the others.':'Read the explanations and the next round will go better.'} Best: ${mqs.best} points.</p><button class="btn primary" data-mq="again">New round</button></section>`;
 }
 const s=all.find(x=>x.id===mq.ids[mq.i]);if(!s){mq=null;return macroHtml();}
 const dots=mq.ids.map((_,k)=>`<i class="${k<mq.i?'done':k===mq.i?'now':''}"></i>`).join('');
 const opts=s.opts.map((o,k)=>{const done=mq.answer!=null;const cls=!done?'':['bad','ok','best'][o.s];
  return`<button class="mq-opt ${cls} ${mq.answer===k?'mine':''}" data-mq-pick="${k}" ${done?'disabled':''}><span class="mq-letter">${'ABC'[k]}</span><span class="mq-t">${ctx.esc(o.t)}${done?`<small>${o.s===2?'Best choice':o.s===1?'Okay':'Bad'}: ${ctx.esc(o.why)}</small>`:''}</span></button>`;}).join('');
 const res=mq.answer!=null?`<div class="mq-next"><span class="mq-pts">${s.opts[mq.answer].s===2?'+2 points':s.opts[mq.answer].s===1?'+1 point':'0 points'}</span><button class="btn primary" data-mq="next">${mq.i+1<ROUND?'Next':'Result'}</button></div>`:'';
 return`<section class="card mq-card"><div class="mq-top"><span class="mq-dots" aria-label="Question ${mq.i+1} of ${ROUND}">${dots}</span><span class="fine">Points: <b>${mq.points}</b></span></div>
  <div class="mq-grid"><div class="mq-mapwrap">${mapSvg(s)}${offMap(s)}<p class="fine mq-legend"><span class="lg blue"></span>Your team <span class="lg red"></span>Enemy <span class="lg me"></span>You</p></div>
  <div class="mq-body"><div class="mq-meta"><span class="tag">You: ${LETTER_ROLE[s.role]}</span><span class="tag">${ctx.esc(s.time)}</span></div><h2>${ctx.esc(s.title)}</h2><p>${ctx.esc(s.text)}</p><p class="mq-q">What is the best play?</p><div class="mq-opts">${opts}</div>${res}</div></div></section>`;
}
function answerMacro(k){
 if(!mq||mq.answer!=null)return;
 const s=scenList().find(x=>x.id===mq.ids[mq.i]);if(!s)return;
 mq.answer=k;mq.points+=s.opts[k].s;
 if(!mqs.seen.includes(s.id))mqs.seen.push(s.id);store(MQ_KEY,mqs);
}
function nextMacro(){
 if(!mq)return;
 if(mq.i+1<ROUND){mq.i++;mq.answer=null;return;}
 mq.done=true;mqs.rounds++;mqs.best=Math.max(mqs.best,mq.points);store(MQ_KEY,mqs);
}

/* ---------- Schnittstelle zur App ---------- */
export function renderPuzzle(tab,c){ctx=c;return tab==='macro'?macroHtml():counterHtml();}
export function handlePuzzleClick(el){
 const d=el.dataset;
 if(d.pzPick){answerPuzzle(d.pzPick);ctx.rerender();return true;}
 if(d.pz==='next'){newPuzzle();ctx.rerender();return true;}
 if(d.pzRole){pz.role=d.pzRole;store(PZ_KEY,pz);if(!cp||cp.answer||cp.role!==pz.role)newPuzzle();ctx.rerender();return true;}
 if(d.mqPick!=null){answerMacro(Number(d.mqPick));ctx.rerender();return true;}
 if(d.mq==='next'){nextMacro();ctx.rerender();window.scrollTo({top:0,behavior:'smooth'});return true;}
 if(d.mq==='again'){newRound();ctx.rerender();return true;}
 return false;
}
