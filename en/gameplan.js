// Spielplan ohne KI: Stärken/Schwächen, Zeitleiste mit Objectives und Richtwerte pro Rolle.
// Alles sind Faustregeln aus den Champion-Profilen, keine gemessenen Werte.
import {ROLES,ROLE_NAMES,profileOf,composition} from './engine.js';
import {phaseCurve} from './features.js';

// Objective-Timer ab Patch 26.1 (Saison 2026). Atakhan gibt es nicht mehr.
export const OBJECTIVES={dragon:'5:00',grubs:'8:00',herald:'15:00',baron:'20:00'};

const phaseDiff=(a,b)=>{const x=phaseCurve(a),y=phaseCurve(b);return x.map((v,i)=>v-y[i]);};
// 1 = ihr seid stärker, -1 = Gegner stärker, 0 = ausgeglichen
export function phaseEdge(allies,enemies){return phaseDiff(allies,enemies).map(d=>d>0.8?1:d<-0.8?-1:0);}

export function strengthsWeaknesses(allies,enemies){
 const us=composition(allies),them=composition(enemies),edge=phaseEdge(allies,enemies);
 const S=[],W=[],A=[];
 if(us.front>=6)S.push('Strong frontline: you can survive long teamfights.');else if(us.front<3)W.push('Little frontline: don’t fight without vision and don’t face-check.');
 if(us.engage>=6)S.push('Lots of engage: you can force fights whenever you want.');else if(us.engage<3)W.push('Barely any engage: you have to wait for mistakes or picks.');
 if(us.peel>=6)S.push('Lots of peel: your carries are well protected.');else if(us.peel<3&&them.engage>=5)W.push('Little peel against lots of engage: carries stay in the back.');
 const oneSided=us.count>=4&&(us.magic===0||us.physical===0)&&us.mixed===0;
 if(oneSided)W.push(`Only ${us.magic?'magic':'physical'} damage: the opponent can build ${us.magic?'magic resist':'armor'} on purpose.`);
 else if(us.magic&&us.physical)S.push('Mixed damage: hard to counter with items.');
 if(edge[0]===1)S.push('Stronger early: pressure in the first 14 minutes.');if(edge[2]===1)S.push('Scales better: long games belong to you.');
 if(edge[0]===-1)W.push('Weaker early: no unnecessary risks before 14 minutes.');if(edge[2]===-1)W.push('Opponent scales better: decide the game before 25 minutes.');
 if(them.engage>=6)A.push('Opponent has lots of engage: don’t clump up, keep Flash for danger.');
 if(them.front>=6)A.push('Opponent has lots of frontline: carries hit what they can reach, not always the tank.');
 const assassins=enemies.filter(id=>{const p=profileOf(id);return p&&p.front===0&&p.scaling<=2&&p.engage>=1;}).length;
 if(assassins>=2)A.push('Several dangerous burst champions: only walk mid-map in pairs.');
 if(them.peel>=6)A.push('Opponent protects their carries well: rather split sides or look for picks.');
 if(!A.length)A.push('Mind vision around objectives: whoever wards first decides the fight.');
 return{S:S.slice(0,4),W:W.slice(0,4),A:A.slice(0,3)};
}

// Zeitleiste: was wann wichtig ist, eingefärbt nach eurer Stärke in der Phase.
export function timeline(allies,enemies){
 const e=phaseEdge(allies,enemies);
 const tone=k=>e[k]===1?'go':e[k]===-1?'careful':'even';
 return[
  {t:'0:00',tone:tone(0),title:'Start',text:e[0]===1?'You are stronger early: an invade or level 2 pressure in bot lane pays off.':e[0]===-1?'Start safe: ward the jungle entrances, no invade.':'Clean start: hold waves, ward the jungle entrances.'},
  {t:OBJECTIVES.dragon,tone:tone(0),title:'First dragon',text:'Bot and jungle build priority before it. Set vision around the pit from about 4:00.'},
  {t:OBJECTIVES.grubs,tone:tone(0),title:'Voidgrubs',text:'Top and jungle. Only once per game, they despawn at 14:45. Good for early tower pressure.'},
  {t:'10:00',tone:'even',title:'Quick check',text:'Everyone compares with their benchmarks below: CS, level and first item.'},
  {t:OBJECTIVES.herald,tone:tone(1),title:'Rift Herald',text:e[1]===1?'Your window: take Herald and drop it in a lane that is already ahead.':'Herald only without risk. Despawns at 19:45.'},
  {t:OBJECTIVES.baron,tone:tone(2),title:'Baron',text:e[2]===1?'You are getting stronger: force Baron as soon as an opponent is missing.':e[2]===-1?'Opponent is getting stronger: Baron only after a won fight, otherwise vision and side lanes.':'Baron after a pick or a won fight.'},
  {t:'25:00',tone:tone(2),title:'Late game',text:e[2]===1?'Now you are at your strongest: stay together and look for fights.':e[2]===-1?'Opponent is stronger now: vision, waves and wait for mistakes.':'Single mistakes decide: nobody goes into the jungle alone.'},
 ];
}

// Richtwerte pro Rolle, angepasst an das Scaling des Champions.
export function benchmarks(i,allyId,allies){
 const role=ROLES[i],p=profileOf(allyId)||{scaling:2,engage:0};
 const spike=p.scaling>=3?'Strong late: farm safely, spike at two items (~20 min).':p.scaling<=1?'Strong early: apply pressure until ~14 min and extend your lead.':'Strong after the first item: then look for fights.';
 const B={
  TOP:[['10:00','70+ CS'],['~7:00','Level 6'],[OBJECTIVES.grubs,'Have priority at Voidgrubs']],
  JUNGLE:[['~3:15','First clear done'],['~7:30','Level 6'],[OBJECTIVES.dragon,'Plan dragon or the other side']],
  MIDDLE:[['10:00','75+ CS'],['~6:30','Level 6, then roam'],['~11:00','First item']],
  BOTTOM:[['10:00','80+ CS'],['~8:30','Level 6'],['~12:00','First item']],
  UTILITY:[['~1:45','Hit level 2 first'],['~4:00','Ward the dragon pit'],['after 1st back','Roam mid or help jungle']],
 }[role];
 const roam={
  TOP:'After crashing your wave, rotate to Grubs or Herald.',
  JUNGLE:gankTarget(allies),
  MIDDLE:'Roam when your wave is pushed and your opponent has to back.',
  BOTTOM:'Don’t roam. Farm comes first, take over mid after the first tower.',
  UTILITY:'Roam when the bot wave crashes or your ADC has backed.',
 }[role];
 return{items:B,spike,roam};
}
function gankTarget(allies){
 const lanes=[[0,'Top'],[2,'Mid'],[3,'Bot']];
 let best=null,score=-1;
 for(const [i,name] of lanes){const ids=i===3?[allies[3],allies[4]]:[allies[i]];const v=ids.reduce((a,id)=>{const p=profileOf(id);return a+(p?p.engage+(3-p.scaling):0);},0);if(v>score){score=v;best=name;}}
 return`Gank target: ${best}. That is where your early game with engage is strongest.`;
}
export {ROLE_NAMES};

/* ---------- Persönlicher Fahrplan je Rolle ---------- */
// Top, Jungle, Mid einzeln. Bot-Lane = ADC und Support zusammen, weil sie die Lane-Phase gemeinsam spielen.
export const PLAN_ROLES=['TOP','JUNGLE','MIDDLE','BOTLANE'];
export const PLAN_ROLE_NAMES={TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTLANE:'Bot lane'};
const early=id=>(profileOf(id)?.scaling??2)<=1,late=id=>(profileOf(id)?.scaling??2)>=3,engager=id=>(profileOf(id)?.engage??0)>=2;
export function roleTimeline(key,allies,enemies){
 const e=phaseEdge(allies,enemies),tone=k=>e[k]===1?'go':e[k]===-1?'careful':'even';
 const me=key==='BOTLANE'?[allies[3],allies[4]]:[allies[ROLES.indexOf(key)]],vs=key==='BOTLANE'?[enemies[3],enemies[4]]:[enemies[ROLES.indexOf(key)]];
 const L=[];const add=(t,phase,title,text)=>L.push({t,tone:phase==null?'even':tone(phase),title,text});
 if(key==='TOP'){
  add('0:00',0,'Level 1–3',early(me[0])?'You are strong early: look for short trades and control the wave.':'Farm safely, no unnecessary trades. Your champion gets stronger later.');
  add('~3:15',0,'Jungler window','The enemy jungler has finished the first clear. Don’t push the wave far while you have no vision.');
  add('~7:00',0,'Level 6','Check your kill window. With Teleport: watch for bot lane or dragon plays.');
  add(OBJECTIVES.grubs,0,'Voidgrubs','Get priority with your jungler: push the wave, then go to the pit.');
  add('10:00',null,'Check','Goal: 70+ CS.');
  add('~14:00',1,'End of laning phase',`Hold the side lane. From ${OBJECTIVES.herald} go to Herald if your team has priority.`);
  add(OBJECTIVES.baron,2,'Baron','Push the side lane first and join your team in time.');
 }
 if(key==='JUNGLE'){
  add('0:00',0,'Start','Start on the side where you want to gank afterwards. Level 1 invades only if your team is stronger early.');
  add('~3:15',0,'First clear done',gankTarget(allies)+' Alternatively take Scuttle Crab.');
  add(OBJECTIVES.dragon,0,'First dragon','Only with priority in bot and mid. Otherwise play the other side (top, Grubs).');
  add('~7:30',0,'Level 6','Ganks with your ultimate are strongest now.');
  add(OBJECTIVES.grubs,0,'Voidgrubs','Take them with top priority, good for early tower pressure.');
  add(OBJECTIVES.herald,1,'Rift Herald','Drop it in a lane that is already ahead.');
  add(OBJECTIVES.baron,2,'Baron','Only after a pick or a won fight. Keep Smite ready.');
 }
 if(key==='MIDDLE'){
  add('0:00',0,'Level 1–3','Clear the wave fast. With priority you can help your jungler at Scuttle.');
  add('~3:15',0,'Jungler window','Ward the river. When the enemy jungler shows elsewhere, you can trade.');
  add(OBJECTIVES.dragon,0,'First dragon','With priority, be first in the river so your team can secure dragon.');
  add('~6:30',0,'Level 6',early(me[0])?'Your strongest window: roam bot or top after pushing.':'Roam after pushing, but don’t give up CS.');
  add('10:00',null,'Check','Goal: 75+ CS.');
  add('~11:00',1,'First item','Then hold mid priority and place vision around objectives.');
  add(OBJECTIVES.herald,1,'Rift Herald','Mid priority means your team can go to Herald.');
  add(OBJECTIVES.baron,2,'Baron',late(me[0])?'You are at your strongest now: look for fights at Baron.':'Place vision with your team, don’t go to a side lane alone.');
 }
 if(key==='BOTLANE'){
  const eng=engager(me[1]),foe=vs.some(engager);
  add('0:00',0,'Level 2 race','The first wave plus three melee minions of the second wave give level 2. Support helps push.');
  add('~1:45',0,'Level 2',eng?'Whoever hits level 2 first goes in. Your support has engage: use the window.':'Don’t fight without a level advantage. Farm and wait for mistakes instead.');
  add('~3:15',0,'Jungler window','Support wards tri-bush or river. Don’t push past the middle without vision.');
  add('~4:00',0,'Vision for dragon','Support places a ward in the dragon pit, ADC holds the wave.');
  add(OBJECTIVES.dragon,0,'First dragon','Only with priority and your jungler nearby. Push the wave first.');
  add('6:00–8:30',0,'Level 6 kill window',foe?'The opponent has engage: keep your distance until your ultimates are ready.':'Both ultimates ready: look for an all-in together.');
  add('~8:00',0,'Support roam','After a crash or when the ADC has backed: help mid or jungle.');
  add('10:00',null,'Check','Goal: ADC 80+ CS. Support: quest nearly done, vision in the river.');
  add('~12:00',1,'First item',late(me[0])?'Your ADC scales: farm safely until two items.':'Apply pressure with the first item and take tower plates.');
  add('~14:00',1,'End of laning phase','Take over mid together or group for the next dragon.');
 }
 const spikes=me.filter(Boolean).map(id=>({id,txt:late(id)?'strong late':early(id)?'strong early':'strong after first item'}));
 return{items:L,spikes,me,vs};
}
