// Geführte Einführung: dunkelt die Seite ab und hebt Schritt für Schritt einen Bereich hervor,
// mit kurzer Erklärung daneben. Fortschritt liegt nur im Browser (localStorage).
const KEY='riftroom.guide';
let G={seen:{},drafted:false,hidden:false};
try{G={...G,...JSON.parse(localStorage.getItem(KEY)||'{}')};G.seen=G.seen||{};}catch{}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(G));}catch{}};
export const guide={
 get:()=>G,
 seen:k=>!!G.seen[k],
 markDrafted(){if(!G.drafted){G.drafted=true;persist();}},
 hide(v=true){G.hidden=v;persist();},
};

export const TOURS={
 welcome:[
  {page:'draft',sel:'.tabs',title:'Welcome to Riftroom',text:'Riftroom helps your team prepare drafts together. At the top you find the four areas you really need.'},
  {sel:'.tab[data-page="team"]',title:'1 · Team',text:'This is where you add your players and their champion pools. Everything else is based on this.'},
  {sel:'.tab[data-page="opponents"]',title:'2 · Opponents',text:'Optional: notes and favorite champions of your opponents. Riftroom then suggests fitting bans.'},
  {sel:'.tab[data-page="meta"]',title:'3 · Meta',text:'Current win rates and ban suggestions for the patch. Check here when a new patch drops.'},
  {sel:'.more>summary',title:'Everything else',text:'Results, minigame and your backup are under “More” to keep the top bar tidy.'},
  {sel:'[data-action="draft-open"]',title:'4 · Draft',text:'Start the draft here just like champ select, for real or as practice against the computer.'},
  {sel:'.cl-list li.next',title:'Your next step',text:'The glowing item in the checklist is always what you should focus on next. “Show me” takes you right there.'},
 ],
 team:[
  {page:'team',sel:'#team-name',title:'Team name',text:'Give your team a name. It appears above your side in the draft.'},
  {sel:'.card.player .field',title:'Player name',text:'One card per role. Enter the player’s name here.'},
  {sel:'.card.player .pool',title:'Champion pool',text:'The champions this player is comfortable on. Use the X to remove the examples.'},
  {sel:'.card.player .comfort',title:'How comfortable?',text:'1 = just trying it, 5 = absolute main. The higher, the more Riftroom recommends the champion.'},
  {sel:'.card.player .add',title:'Add champion',text:'Add new champions here. Three to five per player are plenty.'},
 ],
 draft:[
  {sel:'.cs-phase',title:'This shows whose turn it is',text:'The most important thing in the draft: who is banning or picking right now. The boxes show the whole order, the outlined one is the current step.'},
  {sel:'.cs-sug',title:'Suggestions',text:'For every step Riftroom suggests fitting champions. The number shows how well it fits your team.'},
  {sel:'.cs-filter',title:'Search',text:'Prefer someone else? Type the name or filter by role.'},
  {sel:'#cs-lock',title:'Confirm',text:'Tap a champion, then confirm here. When picking you also choose the role here, for example if your support picks first.'},
  {sel:'.cs-team.ours',title:'Your team',text:'Your picks land here. Tap an empty role to fill it next.'},
  {sel:'.cs-extras',title:'After the draft',text:'Once everyone has picked, open the game plan: strengths, weaknesses, a timeline with objectives and benchmarks for every player.'},
 ],
};

let ctx=null,tour=null,idx=0,root=null,raf=0;
export function initGuide(c){ctx=c;}
export const tourRunning=()=>!!tour;

export function startTour(name,from){
 const all=TOURS[name];if(!all||!ctx)return;
 if(tour)end(false);
 // Erst auf die richtige Seite wechseln, dann nur Schritte behalten, die dort gerade etwas zeigen.
 // So stimmt der Zähler ("2 von 5") und es wird nie ein Schritt übersprungen.
 const pg=all.find(x=>x.page)?.page;if(pg&&ctx.page()!==pg)ctx.go(pg);
 let steps=all.filter(x=>document.querySelector(x.sel));
 // Einstieg mitten in der Tour (z. B. "Zeig mir" bei den Pools): ab dort neu zählen, damit es bei 1 beginnt.
 if(from){const k=steps.findIndex(x=>x.sel.includes(from));if(k>0)steps=steps.slice(k);}
 if(!steps.length)return;
 tour={name,steps};idx=0;build();show();
}
function end(done=true){
 if(!tour)return;
 if(done){G.seen[tour.name]=true;persist();}
 tour=null;cancelAnimationFrame(raf);root?.remove();root=null;
 window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);
 document.removeEventListener('keydown',onKey,true);
 ctx.onEnd?.();
}
function build(){
 root?.remove();
 root=document.createElement('div');root.className='tour';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','tour-title');
 root.innerHTML=`<div class="tour-catch"></div><div class="tour-hole"></div><div class="tour-pop"><div class="tour-top"><span class="tour-count"></span><button class="tour-x" data-tour="skip" aria-label="End introduction">Skip</button></div><h3 id="tour-title"></h3><p></p><div class="tour-dots"></div><div class="tour-btns"><button class="btn ghost small" data-tour="back">Back</button><button class="btn primary small" data-tour="next">Next</button></div></div>`;
 document.body.appendChild(root);
 root.addEventListener('click',e=>{const b=e.target.closest('[data-tour]');if(!b)return;e.stopPropagation();const a=b.dataset.tour;if(a==='skip')end(true);if(a==='back')go(-1);if(a==='next')go(1);});
 window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
 document.addEventListener('keydown',onKey,true);
}
function onKey(e){if(!tour)return;if(e.key==='Escape'){e.preventDefault();end(true);}if(e.key==='ArrowRight'){e.preventDefault();go(1);}if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}
function target(s){return s&&document.querySelector(s.sel);}
function go(d){
 let n=idx+d;
 // Schritte ohne sichtbares Ziel überspringen.
 while(n>=0&&n<tour.steps.length){const s=tour.steps[n];if(s.page&&ctx.page()!==s.page){ctx.go(s.page);}if(target(s))break;n+=d;}
 if(n>=tour.steps.length){end(true);return;}
 if(n<0)return;
 idx=n;show();
}
function show(){
 const s=tour.steps[idx];
 if(s.page&&ctx.page()!==s.page)ctx.go(s.page);
 if(!target(s)){go(1);return;}
 root.querySelector('.tour-count').textContent=`${idx+1} of ${tour.steps.length}`;
 root.querySelector('h3').textContent=s.title;
 root.querySelector('p').textContent=s.text;
 root.querySelector('.tour-dots').innerHTML=tour.steps.map((_,i)=>i).map(i=>`<i class="${i===idx?'on':i<idx?'done':''}"></i>`).join('');
 root.querySelector('[data-tour="back"]').style.visibility=idx>0?'visible':'hidden';
 const last=idx===tour.steps.length-1;root.querySelector('[data-tour="next"]').textContent=last?'Done':'Next';
 const el=target(s);const r=el.getBoundingClientRect();
 if(r.top<70||r.bottom>innerHeight-40)el.scrollIntoView({block:'center',behavior:'instant'});
 root.classList.remove('in');void root.offsetWidth;root.classList.add('in');
 place();root.querySelector('[data-tour="next"]').focus({preventScroll:true});
}
function place(){
 cancelAnimationFrame(raf);
 raf=requestAnimationFrame(()=>{
  if(!tour||!root)return;const el=target(tour.steps[idx]);if(!el)return;
  const r=el.getBoundingClientRect(),pad=8;
  const hole=root.querySelector('.tour-hole'),pop=root.querySelector('.tour-pop');
  const x=Math.max(4,r.left-pad),y=Math.max(4,r.top-pad),w=Math.min(innerWidth-8,r.width+pad*2),h=Math.min(innerHeight-8,r.height+pad*2);
  Object.assign(hole.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
  const pw=Math.min(340,innerWidth-32);pop.style.width=pw+'px';
  const ph=pop.offsetHeight,gap=14;
  let top=y+h+gap;let below=true;
  if(top+ph>innerHeight-12){top=y-gap-ph;below=false;}
  if(top<12){top=Math.min(innerHeight-ph-12,Math.max(12,y+h/2-ph/2));}
  let left=Math.min(Math.max(16,r.left+r.width/2-pw/2),innerWidth-pw-16);
  Object.assign(pop.style,{top:top+'px',left:left+'px'});
  pop.dataset.side=below?'below':'above';
  pop.style.setProperty('--arrow',`${Math.min(pw-24,Math.max(24,r.left+r.width/2-left))}px`);
 });
}
