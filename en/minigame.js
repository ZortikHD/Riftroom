// Minispiel "Champion raten": alle bekommen dieselbe Champion-Reihenfolge. Alle 5 Sekunden
// wird ein weiterer Buchstabe sichtbar. Wer richtig rät, geht zum nächsten Champion weiter.
// Nach Ablauf der Zeit gewinnt, wer die meisten erraten hat.
// Live über die room-Fähigkeit (nur presence, nichts wird gespeichert). Ohne Verbindung: allein spielen.
const STEP=5000,NICK_KEY='riftroom.nick';
let ctx=null,room=null,roomTried=false,peers=[],me={nick:'',state:'lobby',game:null,score:0,cur:0},champStart=0,tick=null,dur=90000,flash=null,busy=false,streak=0,lastCount=null,celebrated=null;

const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const isLetter=ch=>/[\p{L}\p{N}]/u.test(ch);
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function sequence(seed){const ids=ctx.catalog().champions.map(c=>c.id).sort();const r=rng(seed);for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
const champ=id=>ctx.catalog().champions.find(c=>c.id===id);
function current(){if(!me.game)return null;const seq=sequence(me.game.seed);return champ(seq[me.cur%seq.length]);}
const letterCount=name=>[...name].filter(isLetter).length;
function revealed(name,now=Date.now()){return Math.min(letterCount(name)-1,1+Math.floor(Math.max(0,now-champStart)/STEP));}

function setPresence(){if(room)room.presence({nick:me.nick.slice(0,24),state:me.state,game:me.game,score:me.score,cur:me.cur}).catch(()=>{});}
function activeGame(now=Date.now()){
 let best=null;
 for(const p of peers){const g=p.presence?.game;if(g&&typeof g.id==='string'&&Number.isFinite(g.start)&&Number.isFinite(g.dur)&&now<g.start+g.dur&&(!best||g.start>best.start))best=g;}
 return best;
}
async function connect(){
 if(roomTried)return;roomTried=true;
 try{const lobby=window.claude?.use?await window.claude.use('room'):null;if(!lobby)return;room=await lobby.join('mini-champ-raten');
  room.onPeers(ch=>{peers=ch.peers;adopt();paintBoard();},()=>{room=null;paintBoard();});
  setPresence();}catch{room=null;}
 paintBoard();
}
// Wer in der Lobby ist, steigt automatisch in ein laufendes Spiel ein.
function adopt(){
 if(me.state==='play')return;
 const g=activeGame();if(!g||g.id===me.game?.id)return;
 joinGame(g);
}
function joinGame(g){me.game={id:g.id,seed:g.seed,start:g.start,dur:g.dur,host:String(g.host||'').slice(0,24)};me.state='play';me.score=0;me.cur=0;streak=0;busy=false;lastCount=null;champStart=Math.max(Date.now(),g.start);setPresence();ctx.rerender();}
function startGame(){
 if(!me.nick.trim()){ctx.toast('Enter your name first.',true);document.getElementById('mg-nick')?.focus();return;}
 joinGame({id:Math.random().toString(36).slice(2,10),seed:Math.floor(Math.random()*2**31),start:Date.now()+4000,dur,host:me.nick});
}
function finish(){
 if(me.state!=='play')return;
 me.state='done';
 setPresence();ctx.rerender();
}
function standings(g){
 const rows=new Map();
 rows.set('me',{nick:me.nick||'Du',score:me.score,me:true});
 for(const p of peers){if(p.sameTab)continue;const pr=p.presence||{};if(pr.game?.id===g?.id)rows.set(p.peer,{nick:String(pr.nick||'Player').slice(0,24),score:Number(pr.score)||0,me:false});}
 return[...rows.values()].sort((a,b)=>b.score-a.score);
}
function guess(text){
 const c=current();if(!c||me.state!=='play'||Date.now()<me.game.start)return;
 const g=norm(text);if(!g)return;
 if(busy)return;
 if(g===norm(c.name)||g===norm(c.id)){
  const fast=revealed(c.name)<=2;me.score++;streak++;busy=true;setPresence();
  celebrate(c,fast);setTimeout(()=>{busy=false;next();},850);
 }else{streak=0;const inp=document.getElementById('mg-input');if(inp){inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');}const w=document.getElementById('mg-word');if(w){w.classList.remove('wrong');void w.offsetWidth;w.classList.add('wrong');}paintStreak();}
}
function skip(){
 const c=current();if(!c||busy||me.state!=='play'||Date.now()<me.game.start)return;
 busy=true;streak=0;paintStreak();
 const w=document.getElementById('mg-word');if(w){w.innerHTML=tiles(c.name,99,'miss');}
 setTimeout(()=>{busy=false;next();},900);
}
function next(){
 me.cur++;champStart=Date.now();setPresence();
 const inp=document.getElementById('mg-input');if(inp)inp.value='';
 paintRound(true);paintBoard();
}

/* ---------- Darstellung ---------- */
const COLORS=['var(--accent)','var(--blue)','var(--red)','var(--warn)','var(--magic)','var(--phys)'];
const colorOf=nick=>{let h=0;for(const ch of String(nick))h=(h*31+ch.charCodeAt(0))>>>0;return COLORS[h%COLORS.length];};
const avatar=nick=>`<span class="mg-av" style="--c:${colorOf(nick)}">${ctx.esc((String(nick).trim()[0]||'?').toUpperCase())}</span>`;
const crown='<svg class="mg-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 0 3l7 5 5-8 5 8 7-5-2 11z"/></svg>';
// Kacheln für einen Namen: n Buchstaben offen; mode 'win'/'miss' zeigt alles.
function tiles(name,n,mode=''){
 let k=0;
 return[...name].map(ch=>{
  if(!isLetter(ch))return`<span class="mg-sym">${ctx.esc(ch)}</span>`;
  const i=k++;const open=mode||i<n;
  return`<span class="mg-l ${open?'on':''} ${mode}" style="--i:${i}"><span>${open?ctx.esc(ch.toUpperCase()):'?'}</span></span>`;
 }).join('');
}
function bubbles(){
 const ids=ctx.catalog().champions.map(c=>c.id);const r=rng(7);
 return Array.from({length:14},(_,i)=>{const id=ids[Math.floor(r()*ids.length)];return`<img class="mg-bubble" src="img/sq/${id}.webp" alt="" style="left:${Math.round(r()*92)}%;--s:${Math.round(34+r()*30)}px;--d:${(9+r()*9).toFixed(1)}s;--delay:-${(r()*12).toFixed(1)}s">`;}).join('');
}
export function renderMini(c){
 if(c)ctx=c;
 if(!me.nick){try{me.nick=localStorage.getItem(NICK_KEY)||'';}catch{}}
 const board=`<aside class="card mg-board"><div class="card-head"><h3>${me.state==='lobby'?'In the lobby':'Race'}</h3><span class="mg-live" id="mg-live"></span></div><div id="mg-board"></div></aside>`;
 if(me.state==='play'){
  return`<div class="mg-grid"><section class="mg-play">
   <div class="mg-hud"><div class="mg-timebar"><i id="mg-timebar"></i></div><span class="mg-timer" id="mg-timer"></span><span class="mg-streak" id="mg-streak"></span><span class="mg-score"><span class="fine">Guessed</span><b id="mg-score">${me.score}</b></span></div>
   <div class="mg-stage" id="mg-stage"><img class="mg-ghost" id="mg-ghost" alt=""><div class="mg-flash" id="mg-flash"></div><div class="mg-word" id="mg-word"></div><div class="mg-next"><i id="mg-next"></i></div><p class="mg-hint" id="mg-hint"></p></div>
   <form id="mg-form" class="mg-form" autocomplete="off"><input class="field" id="mg-input" placeholder="Type a champion, press Enter" aria-label="Your answer" autocomplete="off" spellcheck="false"><button class="btn primary" type="submit">Guess</button><button class="btn ghost" type="button" data-mg="skip">Next</button></form>
  </section>${board}</div>`;
 }
 const res=me.state==='done'?`<section class="card mg-result" id="mg-result">${resultHtml()}</section>`:'';
 const hero=`<section class="mg-hero"><div class="mg-bubbles" aria-hidden="true">${bubbles()}</div><div class="mg-hero-in">
  <span class="mg-badge">Minigame</span>
  <h1 class="mg-title"><span>Guess the</span><span>Champion</span></h1>
  <div class="mg-demo" aria-hidden="true">${['J','I','N','X'].map((ch,i)=>`<span class="mg-l demo" style="--i:${i}"><span class="q">?</span><span class="a">${ch}</span></span>`).join('')}</div>
  <p class="mg-rules">Everyone gets the same champions. One more letter every 5 seconds. Guess right to move on. Whoever has the most at the end wins.</p>
  <div class="mg-setup"><input class="field mg-nickin" id="mg-nick" maxlength="24" value="${ctx.esc(me.nick)}" placeholder="Your in-game name" aria-label="Your in-game name" autocomplete="off">
   <div class="mg-durs" role="group" aria-label="Duration">${[60000,90000,120000].map(d=>`<button data-mg-dur="${d}" aria-pressed="${dur===d}">${d/1000}s</button>`).join('')}</div></div>
  <button class="mg-go" data-mg="start"><span>${me.state==='done'?'Again':'Start game'}</span></button>
 </div></section>`;
 return`<div class="mg-grid">${res?`<div class="mg-main">${res}${hero}</div>`:hero}${board}</div>`;
}
function resultHtml(){
 const rows=standings(me.game),top=rows[0],tie=rows.length>1&&rows[1].score===top.score;
 const title=rows.length===1?`${me.score} champions guessed`:tie?'It’s a tie!':top.me?'Du hast gewonnen!':`${ctx.esc(top.nick)} wins!`;
 const podium=[rows[1],rows[0],rows[2]].map((r,k)=>r?`<div class="mg-pod p${[2,1,3][k]}">${[2,1,3][k]===1?crown:''}${avatar(r.nick)}<span class="mg-pod-name">${ctx.esc(r.nick)}${r.me?' (you)':''}</span><div class="mg-pod-block"><b>${r.score}</b><span>${[2,1,3][k]}.</span></div></div>`:'<div class="mg-pod empty"></div>').join('');
 const rest=rows.slice(3).map((r,i)=>`<li class="${r.me?'me':''}"><span class="mg-pos">${i+4}.</span>${avatar(r.nick)}<span class="mg-nick">${ctx.esc(r.nick)}</span><b>${r.score}</b></li>`).join('');
 return`<h2 class="mg-res-title">${title}</h2><div class="mg-podium">${podium}</div>${rest?`<ol class="mg-rest">${rest}</ol>`:''}`;
}
function paintBoard(){
 const res=document.getElementById('mg-result');if(res&&me.state==='done')res.innerHTML=resultHtml();
 const el=document.getElementById('mg-board');if(!el)return;
 const live=document.getElementById('mg-live');if(live)live.innerHTML=room?'<i></i>live':'';
 const others=peers.filter(p=>!p.sameTab&&p.presence?.nick);
 const inGame=me.game&&me.state!=='lobby';
 const rows=[{nick:me.nick||'Du',score:me.score,state:me.state,me:true,same:true},...others.map(p=>({nick:String(p.presence.nick).slice(0,24),score:Number(p.presence.score)||0,state:p.presence.state,same:inGame&&p.presence.game?.id===me.game.id}))];
 let html='';
 if(inGame){
  const list=rows.filter(r=>r.same).sort((a,b)=>b.score-a.score),max=Math.max(5,...list.map(r=>r.score));
  html=`<ul class="mg-race">${list.map((r,i)=>`<li class="${r.me?'me':''}" style="--c:${colorOf(r.nick)}">${avatar(r.nick)}<div class="mg-lane"><span class="mg-nick">${i===0&&r.score>0?crown:''}${ctx.esc(r.nick)}${r.me?' (you)':''}</span><div class="mg-track"><i style="width:${Math.max(4,r.score/max*100)}%"></i></div></div><b>${r.score}</b></li>`).join('')}</ul>`;
 }else html=`<ul class="mg-lobby">${rows.map(r=>`<li class="${r.me?'me':''}">${avatar(r.nick)}<span class="mg-nick">${ctx.esc(r.nick)}${r.me?' (you)':''}</span><span class="mg-chip ${r.state==='play'?'play':''}">${r.state==='play'?'playing':'ready'}</span></li>`).join('')}</ul>`;
 el.innerHTML=html+(room?(others.length?'':'<p class="fine">Nobody else here yet. Send your team the link to make it a race.</p>'):'<p class="fine">No live connection. You are playing alone.</p>');
}
function paintStreak(){const el=document.getElementById('mg-streak');if(!el)return;el.textContent=streak>=2?`Streak ×${streak}`:'';el.classList.toggle('on',streak>=2);if(streak>=2){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}}
function confetti(host,count=36){
 if(!host||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(let i=0;i<count;i++){const p=document.createElement('i');p.className='mg-conf';p.style.cssText=`--x:${(Math.random()*2-1)*220}px;--y:${-(80+Math.random()*180)}px;--r:${Math.random()*720-360}deg;--c:${COLORS[i%COLORS.length]};--t:${(.7+Math.random()*.6).toFixed(2)}s;left:50%;top:45%`;host.appendChild(p);setTimeout(()=>p.remove(),1400);}
}
function celebrate(c,fast){
 const w=document.getElementById('mg-word');if(w)w.innerHTML=tiles(c.name,99,'win');
 const g=document.getElementById('mg-ghost');if(g){g.style.filter='blur(0) brightness(.7)';}
 const st=document.getElementById('mg-stage');confetti(st);
 const f=document.getElementById('mg-flash');if(f){f.innerHTML=`<b>+1</b>${fast?'<span>Lightning!</span>':''}`;f.className='mg-flash show';}
 const sc=document.getElementById('mg-score');if(sc){sc.textContent=me.score;sc.classList.remove('bump');void sc.offsetWidth;sc.classList.add('bump');}
 paintStreak();paintBoard();
}
function paintRound(changed){
 const c=current();if(!c)return;
 const now=Date.now(),g=me.game;
 const word=document.getElementById('mg-word'),hint=document.getElementById('mg-hint'),timer=document.getElementById('mg-timer'),bar=document.getElementById('mg-timebar'),ghost=document.getElementById('mg-ghost'),nx=document.getElementById('mg-next');
 if(!word)return;
 const left=Math.max(0,g.start+g.dur-now),sec=Math.ceil(left/1000);
 timer.textContent=now<g.start?'':`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;timer.classList.toggle('low',left<10000&&now>=g.start);
 if(bar){bar.style.width=`${now<g.start?100:left/g.dur*100}%`;bar.classList.toggle('low',left<10000);}
 if(now<g.start){const n=Math.ceil((g.start-now)/1000);if(lastCount!==n){lastCount=n;word.innerHTML=`<span class="mg-count">${n}</span>`;hint.textContent=g.host?`Game by ${g.host}`:'Starting soon';if(ghost)ghost.removeAttribute('src');}return;}
 if(lastCount!==null&&lastCount!==0){lastCount=0;const st=document.getElementById('mg-stage');const go=document.createElement('span');go.className='mg-gotext';go.textContent='LOS!';st?.appendChild(go);setTimeout(()=>go.remove(),900);changed=true;}
 if(busy)return;
 const n=revealed(c.name,now),len=letterCount(c.name);
 if(changed||word.dataset.id!==c.id){word.innerHTML=tiles(c.name,n,'');word.dataset.id=c.id;word.dataset.n=n;word.classList.remove('wrong');if(ghost)ghost.src=`img/sq/${c.id}.webp`;}
 else if(word.dataset.n!==String(n)){
  // nur die neu aufgedeckten Kacheln umdrehen
  const ts=[...word.querySelectorAll('.mg-l')];ts.forEach((t,i)=>{if(i<n&&!t.classList.contains('on')){t.classList.add('on','flip');const letters=[...c.name].filter(isLetter);t.firstElementChild.textContent=letters[i].toUpperCase();}});word.dataset.n=n;
 }
 if(ghost)ghost.style.filter=`blur(${Math.round(22-14*(n/Math.max(1,len-1)))}px) brightness(.45) saturate(.6)`;
 const el=now-champStart;
 hint.textContent=el>=2*STEP&&c.title?`Hint: ${c.title}`:`${len} letters`;
 if(nx)nx.style.width=n<len-1?`${(el%STEP)/STEP*100}%`:'0%';
 if(n>=len-1&&el>=(len-1)*STEP+STEP)skip();
 if(left<=0)finish();
}
// Nach jedem Rendern der Seite aufrufen.
export function mountMini(c){
 ctx=c;connect();paintBoard();clearInterval(tick);
 if(me.state==='play'){paintRound(true);paintStreak();tick=setInterval(()=>{if(!document.getElementById('mg-word')){clearInterval(tick);return;}paintRound(false);},100);document.getElementById('mg-input')?.focus();}
 if(me.state==='done'&&celebrated!==me.game?.id){celebrated=me.game?.id;if(standings(me.game)[0]?.me)setTimeout(()=>confetti(document.getElementById('mg-result'),70),250);}
}
export function handleMiniClick(el){
 if(el.dataset.mg==='start'){startGame();return true;}
 if(el.dataset.mg==='skip'){skip();document.getElementById('mg-input')?.focus();return true;}
 if(el.dataset.mgDur){dur=Number(el.dataset.mgDur);document.querySelectorAll('[data-mg-dur]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return true;}
 return false;
}
export function handleMiniInput(t){
 if(t.id==='mg-nick'){me.nick=t.value.trim().slice(0,24);try{localStorage.setItem(NICK_KEY,me.nick);}catch{}setPresence();paintBoard();return true;}
 return false;
}
export function handleMiniSubmit(e){
 if(e.target.id!=='mg-form')return false;
 e.preventDefault();const inp=document.getElementById('mg-input');guess(inp?.value||'');if(inp&&me.state==='play'){inp.select();}return true;
}
