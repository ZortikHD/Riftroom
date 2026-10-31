// Reine Hilfsfunktionen für Stärkekurve, Lern-Tipps und den Computer-Gegner im Übungs-Draft.
// Alles sind Schätzungen aus den Champion-Profilen und Winrates, keine gemessenen Werte.
import {ROLES,profileOf,adj} from './engine.js';

/* ---------- Stärkekurve ---------- */
// Pro Champion grobe Stärke in drei Phasen aus dem Scaling-Wert (1 = früh stark, 3 = spät stark).
const PHASE={1:[3,2,1],2:[2,2.5,2],3:[1,2,3]};
export const PHASES=['Früh','Mitte','Spät'];
export const PHASE_TIME=['bis ca. 14 Min.','ca. 14–25 Min.','ab ca. 25 Min.'];
export function phaseCurve(ids){
  const out=[0,0,0];
  for(const id of ids){if(!id)continue;const p=profileOf(id);if(!p)continue;const s=PHASE[Math.max(1,Math.min(3,p.scaling||2))];out[0]+=s[0]+p.engage*0.2;out[1]+=s[1]+p.engage*0.1;out[2]+=s[2];}
  return out.map(v=>Math.round(v*10)/10);
}
export function curveSummary(ours,theirs){
  const d=ours.map((v,i)=>v-theirs[i]);
  if(d[0]>1&&d[2]<-1)return'Ihr seid früh stärker, der Gegner skaliert besser. Macht Druck und sichert Objectives, bevor 25 Minuten erreicht sind.';
  if(d[0]<-1&&d[2]>1)return'Der Gegner ist früh stärker, ihr skaliert besser. Spielt früh sicher, gebt keine Kills ab und sucht die Teamfights ab 25 Minuten.';
  if(d.every(x=>x>=-0.5)&&d.some(x=>x>0.5))return'Auf dem Papier seid ihr in keiner Phase schwächer. Spielt eure Stärke aus und erzwingt Kämpfe um Objectives.';
  if(d.every(x=>x<=0.5)&&d.some(x=>x<-0.5))return'Auf dem Papier ist der Gegner in keiner Phase schwächer. Spielt auf seine Fehler, gute Sicht und saubere Wellen.';
  return'Ziemlich ausgeglichen. Entscheidend sind die Matchups und wer die Objectives besser vorbereitet.';
}

/* ---------- Lern-Tipps ---------- */
const NEEDS={TOP:['front','dmg','depth'],JUNGLE:['engage','front','depth'],MIDDLE:['dmg','scaling','depth'],BOTTOM:['scaling','depth'],UTILITY:['engage','peel','depth']};
const REASON={front:'bringt Frontline, die deinem Pool fehlt',engage:'bringt Engage, der deinem Pool fehlt',peel:'schützt eure Carries, das fehlt deinem Pool noch',scaling:'skaliert spät stark, das fehlt deinem Pool noch',magic:'bringt magischen Schaden, dein Pool ist nur physisch',physical:'bringt physischen Schaden, dein Pool ist nur magisch',depth:'macht deinen Pool breiter, damit du nicht weggebannt wirst'};
export function learnTip(state,i,meta){
  if(!meta)return null;
  const role=ROLES[i],pool=state.players[i].pool.map(v=>profileOf(v.id)).filter(Boolean);
  const allPools=new Set(state.players.flatMap(p=>p.pool.map(v=>v.id)));
  const dmg=new Set(pool.map(p=>p.damage));
  const gaps=[];
  for(const n of NEEDS[role]){
    if(n==='front'&&!pool.some(p=>p.front>=2))gaps.push('front');
    if(n==='engage'&&!pool.some(p=>p.engage>=2))gaps.push('engage');
    if(n==='peel'&&!pool.some(p=>p.peel>=2))gaps.push('peel');
    if(n==='scaling'&&!pool.some(p=>p.scaling>=3))gaps.push('scaling');
    if(n==='dmg'&&pool.length>=2&&dmg.size===1&&!dmg.has('mixed'))gaps.push(dmg.has('physical')?'magic':'physical');
    if(n==='depth'&&pool.length<3)gaps.push('depth');
  }
  if(!gaps.length)return null;
  // Nur Champions, die in dieser Rolle wirklich gespielt werden (Pickrate ab 2 %), keine Off-Meta-Exoten.
  const cands=meta.entries.filter(e=>e.role===role&&e.games>=2500&&(e.pickRate==null||e.pickRate>=2)&&!allPools.has(e.champion)).sort((a,b)=>adj(b)-adj(a));
  const fits={front:p=>p.front>=2,engage:p=>p.engage>=2,peel:p=>p.peel>=2,scaling:p=>p.scaling>=3,magic:p=>p.damage==='magic',physical:p=>p.damage==='physical',depth:()=>true};
  for(const g of gaps){const e=cands.find(x=>{const p=profileOf(x.champion);return p&&fits[g](p);});if(e)return{id:e.champion,wr:e.wins/e.games*100,games:e.games,reason:REASON[g]};}
  return null;
}

/* ---------- Rollen eines Teams aus den Picks ableiten ---------- */
// Jeder Pick steht in einem Rollen-Slot, kann aber oft mehrere Rollen spielen (Flex). Wir prüfen alle
// gültigen Zuordnungen Champion -> Rolle. Eine Rolle ist "sicher besetzt", wenn sie in jeder Zuordnung
// belegt ist; "vielleicht besetzt", wenn nur in manchen. Flex = Pick, der mehrere Rollen haben kann.
export function roleInfo(picks){
  const items=picks.map((id,i)=>id?{i,id,cand:[...new Set([...(profileOf(id)?.roles||[]),ROLES[i]])]}:null).filter(Boolean);
  const count=Object.fromEntries(ROLES.map(r=>[r,0]));let total=0;const takes=items.map(()=>new Set());
  (function rec(k,used,assign){
    if(total>2000)return;
    if(k===items.length){total++;for(const r of used)count[r]++;assign.forEach((r,j)=>takes[j].add(r));return;}
    for(const r of items[k].cand)if(!used.has(r)){used.add(r);assign.push(r);rec(k+1,used,assign);assign.pop();used.delete(r);}
  })(0,new Set(),[]);
  if(!total){const slot=new Set(items.map(x=>ROLES[x.i]));return{certain:slot,maybe:new Set(),open:ROLES.filter(r=>!slot.has(r)),flex:new Map()};}
  const certain=new Set(ROLES.filter(r=>count[r]===total)),maybe=new Set(ROLES.filter(r=>count[r]>0&&count[r]<total));
  const flex=new Map();items.forEach((x,j)=>{if(takes[j].size>1)flex.set(x.i,ROLES.filter(r=>takes[j].has(r)));});
  return{certain,maybe,open:ROLES.filter(r=>!certain.has(r)),flex};
}
// In welchen Rollen wird ein Champion wirklich gespielt? Anteile aus den Winrate-Daten (Spiele je Rolle).
// Ohne Daten: alle Profil-Rollen gleich gewichtet.
const shareCache=new WeakMap();
export function roleShares(id,meta){
  if(meta?.entries){let m=shareCache.get(meta);if(!m){m=new Map();const tot=new Map();for(const e of meta.entries)tot.set(e.champion,(tot.get(e.champion)||0)+e.games);for(const e of meta.entries){if(!m.has(e.champion))m.set(e.champion,{});m.get(e.champion)[e.role]=e.games/tot.get(e.champion);}shareCache.set(meta,m);}
    if(m.has(id))return m.get(id);}
  const roles=profileOf(id)?.roles||[];return Object.fromEntries(roles.map(r=>[r,1/roles.length]));
}
// Wie viel bringt ein Ban gegen dieses Team noch? Summe der Rollenanteile, die beim Gegner offen sind
// (sicher offen voll, Flex-unklar halb). Ashe nach einem gegnerischen ADC-Pick: nur noch ~0,1 (Support-Anteil).
export function banValue(id,info,meta){
  const sh=roleShares(id,meta);let v=0;
  for(const [r,x] of Object.entries(sh))if(info.open.includes(r))v+=x*(info.maybe.has(r)?0.5:1);
  return v;
}
export function banRole(id,info,meta){
  const sh=roleShares(id,meta);let best=null,bv=0;
  for(const [r,x] of Object.entries(sh))if(info.open.includes(r)&&x>bv){bv=x;best=r;}
  return best;
}

/* ---------- Computer-Gegner ---------- */
// Wählt zufällig unter den besten Kandidaten, damit jede Übung anders verläuft.
function pickWeighted(list,rand){if(!list.length)return null;const top=list.slice(0,5);const w=top.map((_,k)=>5-k);let r=rand()*w.reduce((a,b)=>a+b,0);for(let k=0;k<top.length;k++){r-=w[k];if(r<=0)return top[k];}return top[0];}
export function aiBan(state,meta,taken,rand=Math.random){
  // Der Computer bannt gern eure Comfort-Picks, sonst starke Meta-Champions.
  const ours=roleInfo(state.allies);
  const comfort=state.players.flatMap((p,i)=>state.allies[i]?[]:p.pool.filter(v=>v.comfort>=4).map(v=>({id:v.id,score:1+v.comfort/10})));
  const strong=meta?[...new Map(meta.entries.filter(e=>e.games>=2500).map(e=>[e.champion,e])).values()].map(e=>({id:e.champion,score:(adj(e)-0.5)*20+(e.banRate||0)/20})):[];
  const list=[...comfort,...strong].filter(x=>!taken.has(x.id)&&banValue(x.id,ours,meta)>=0.35).map(x=>({...x,score:x.score*banValue(x.id,ours,meta)})).sort((a,b)=>b.score-a.score);
  return pickWeighted([...new Map(list.map(x=>[x.id,x])).values()],rand)?.id||null;
}
export function aiPick(state,meta,taken,opp,catalog,rand=Math.random){
  const open=state.enemies.map((id,i)=>id?null:i).filter(i=>i!=null);
  const list=[];
  for(const i of open){
    const role=ROLES[i],mains=opp?.players?.[i]?.champs||[];
    // Mains spielt der Computer gern, schwache aber seltener (wie ein echter Gegner, der lieber etwas Starkes nimmt).
    for(const id of mains)if(!taken.has(id)){const e=meta?.entries.find(x=>x.champion===id&&x.role===role);list.push({i,id,score:e?1.4+(adj(e)-0.5)*20:1.2});}
    if(meta)for(const e of meta.entries)if(e.role===role&&e.games>=2500&&!taken.has(e.champion))list.push({i,id:e.champion,score:(adj(e)-0.5)*20+Math.min(e.pickRate||0,15)/15});
  }
  if(!list.length){for(const i of open)for(const c of catalog.champions)if(!taken.has(c.id)&&profileOf(c.id)?.roles.includes(ROLES[i]))list.push({i,id:c.id,score:rand()});}
  list.sort((a,b)=>b.score-a.score);
  return pickWeighted(list,rand);
}
