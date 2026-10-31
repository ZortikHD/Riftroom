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
  {page:'draft',sel:'.tabs',title:'Willkommen bei Riftroom',text:'Riftroom hilft eurem Team, Drafts gemeinsam vorzubereiten. Oben findest du alle Bereiche, die ihr braucht.'},
  {sel:'.tab[data-page="team"]',title:'1 · Team',text:'Hier tragt ihr eure Spieler und ihre Champion-Pools ein. Das ist die Grundlage für alle Empfehlungen.'},
  {sel:'.tab[data-page="opponents"]',title:'2 · Gegner',text:'Optional: Notizen und Lieblingschampions eurer Gegner. Riftroom schlägt dann passende Bans vor.'},
  {sel:'.tab[data-page="meta"]',title:'3 · Meta',text:'Aktuelle Winrates und Ban-Vorschläge zum Patch. Schau hier rein, wenn ein neuer Patch kommt.'},
  {sel:'.tab[data-page="mini"]',title:'Minispiele',text:'Counter-Puzzle, Macro-Quiz, Champion raten und mehr, allein oder mit Freunden in einer Lobby.'},
  {sel:'.more>summary',title:'Alles andere',text:'Eure Ergebnisse und die Datensicherung liegen unter „Mehr“.'},
  {sel:'[data-action="draft-open"]',title:'4 · Draft',text:'Hier startet ihr den Draft wie im Champ Select, echt oder als Übung gegen den Computer.'},
  {sel:'.cl-list li.next',title:'Dein nächster Schritt',text:'Der leuchtende Punkt in der Startliste ist immer das, worauf du dich als Nächstes konzentrieren solltest. „Zeig mir“ führt dich direkt hin.'},
 ],
 team:[
  {page:'team',sel:'#team-name',title:'Teamname',text:'Gib eurem Team einen Namen. Er erscheint im Draft über eurer Seite.'},
  {sel:'.card.player .field',title:'Spielername',text:'Pro Rolle eine Karte. Trag hier den Namen des Spielers ein.'},
  {sel:'.card.player .pool',title:'Champion-Pool',text:'Die Champions, die dieser Spieler sicher spielt. Mit dem X entfernst du die Beispiele.'},
  {sel:'.card.player .comfort',title:'Wie sicher?',text:'1 = probiert er gerade, 5 = absoluter Main. Je höher, desto stärker empfiehlt Riftroom den Champion.'},
  {sel:'.card.player .add',title:'Champion hinzufügen',text:'Hier kommen neue Champions dazu. Drei bis fünf pro Spieler reichen völlig.'},
 ],
 draft:[
  {sel:'.cs-phase',title:'Hier steht, wer dran ist',text:'Das ist das Wichtigste im Draft: wer gerade bannt oder pickt. Die Kästchen zeigen die ganze Reihenfolge, das umrandete ist der aktuelle Schritt.'},
  {sel:'.cs-sug',title:'Vorschläge',text:'Für jeden Schritt schlägt Riftroom passende Champions vor. Die Zahl zeigt, wie gut er zu eurem Team passt.'},
  {sel:'.cs-filter',title:'Suchen',text:'Lieber jemand anderes? Tippe den Namen ein oder filtere nach Rolle.'},
  {sel:'#cs-lock',title:'Bestätigen',text:'Champion antippen, dann hier bestätigen. Beim Picken wählst du hier auch die Rolle, falls zum Beispiel euer Support zuerst pickt.'},
  {sel:'.cs-team.ours',title:'Euer Team',text:'Hier landen eure Picks. Tippe auf eine leere Rolle, um sie als Nächstes zu füllen.'},
  {sel:'.cs-extras',title:'Nach dem Draft',text:'Wenn alle gepickt haben, öffnet ihr den Spielplan: Stärken, Schwächen, eine Zeitleiste mit Objectives und Richtwerte für jeden Spieler.'},
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
 root.innerHTML=`<div class="tour-catch"></div><div class="tour-hole"></div><div class="tour-pop"><div class="tour-top"><span class="tour-count"></span><button class="tour-x" data-tour="skip" aria-label="Einführung beenden">Überspringen</button></div><h3 id="tour-title"></h3><p></p><div class="tour-dots"></div><div class="tour-btns"><button class="btn ghost small" data-tour="back">Zurück</button><button class="btn primary small" data-tour="next">Weiter</button></div></div>`;
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
 root.querySelector('.tour-count').textContent=`${idx+1} von ${tour.steps.length}`;
 root.querySelector('h3').textContent=s.title;
 root.querySelector('p').textContent=s.text;
 root.querySelector('.tour-dots').innerHTML=tour.steps.map((_,i)=>i).map(i=>`<i class="${i===idx?'on':i<idx?'done':''}"></i>`).join('');
 root.querySelector('[data-tour="back"]').style.visibility=idx>0?'visible':'hidden';
 const last=idx===tour.steps.length-1;root.querySelector('[data-tour="next"]').textContent=last?'Fertig':'Weiter';
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
