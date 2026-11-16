// Spielplan ohne KI: Stärken/Schwächen, Zeitleiste mit Objectives und Richtwerte pro Rolle.
// Alles sind Faustregeln aus den Champion-Profilen, keine gemessenen Werte.
import {ROLES,ROLE_NAMES,profileOf,composition,champName} from './engine.js';
import {phaseCurve} from './features.js';

// Objective-Timer ab Patch 26.1 (Saison 2026). Atakhan gibt es nicht mehr.
export const OBJECTIVES={dragon:'5:00',grubs:'8:00',herald:'15:00',baron:'20:00'};


// Wie gern ein Champion die Lane verlässt: 2 = starker Roamer (Mobilität, globale Ulti, Engage), 0 = bleibt in der Lane.
// Handgepflegt, weil die Profile dafür keinen Wert haben. Unbekannte Champions gelten als 1 (mittel).
const ROAM=new Map([...["Galio", "TwistedFate", "Taliyah", "Ahri", "Qiyana", "Talon", "Katarina", "Leblanc", "Pantheon", "Sylas", "Akali", "Ekko", "Zed", "Fizz", "Diana", "Naafiri", "Aurora", "Kassadin", "Ryze", "Shen", "Nocturne", "Bard", "Pyke", "Rakan", "Alistar", "Rell", "Thresh", "Nautilus", "Leona", "Camille", "Quinn"].map(id=>[id,2]),...["Veigar", "Azir", "Viktor", "Anivia", "Cassiopeia", "Vladimir", "Ziggs", "Xerath", "Velkoz", "Hwei", "Smolder", "Kayle", "Karthus", "Malzahar", "AurelionSol", "Heimerdinger", "Soraka", "Yuumi", "Sona", "Seraphine", "Lulu", "Nami", "Milio", "Renata", "Zyra", "Brand", "Senna", "KogMaw"].map(id=>[id,0])]);
const GLOBAL_ULT=new Set(["Galio", "TwistedFate", "Shen", "Pantheon", "Ryze", "Taliyah", "Nocturne"]);
export const roamOf=id=>id?ROAM.get(id)??1:1;
const nm=id=>champName(id)||'';
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
export function benchmarks(i,allyId,allies,enemies=[]){
 const r=roamOf(allyId),foe=enemies[i],foeRoams=roamOf(foe)===2&&!!foe;
 const role=ROLES[i],p=profileOf(allyId)||{scaling:2,engage:0};
 const spike=p.scaling>=3?'Strong late: farm safely, spike at two items (~20 min).':p.scaling<=1?'Strong early: apply pressure until ~14 min and extend your lead.':'Strong after the first item: then look for fights.';
 const B={
  TOP:[['10:00','70+ CS'],['~7:00','Level 6'],[OBJECTIVES.grubs,'Have priority at Voidgrubs']],
  JUNGLE:[['~3:15','First clear done'],['~7:30','Level 6'],[OBJECTIVES.dragon,'Plan dragon or the other side']],
  MIDDLE:[['10:00','75+ CS'],['~6:30',r>=1?'Level 6, then roam':'Level 6, hold the wave'],['~11:00','First item']],
  BOTTOM:[['10:00','80+ CS'],['~8:30','Level 6'],['~12:00','First item']],
  UTILITY:[['~1:45','Hit level 2 first'],['~4:00','Ward the dragon pit'],['after 1st back',r>=1?'Roam mid or help jungle':'Ward the river, stay with your ADC']],
 }[role];
 const roam={
  TOP:r===2?'Use your ultimate to help bot or your jungler as soon as a fight starts there. Push the wave first.':'After crashing your wave, rotate to Grubs or Herald.',
  JUNGLE:gankTarget(allies),
  MIDDLE:(r===2?'Roam once your wave is pushed and your opponent has to back.':r===1?'Only roam after a push and with vision. Farm comes first.':'Barely roam: farm and hold the wave. When your opponent roams, take tower plates.')+(foeRoams?` Careful: ${nm(foe)} likes to roam, so ping as soon as they go missing.`:''),
  BOTTOM:'Don’t roam. Farm comes first, take over mid after the first tower.',
  UTILITY:r===2?'Roam when the bot wave crashes or your ADC has backed.':r===1?'Roam now and then when the wave crashes. Otherwise ward the river.':'Stay with your ADC. Roams barely pay off for your champion, ward the river instead.',
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
  add('~6:30',0,'Level 6',roamOf(me[0])===2?`${nm(me[0])} roams well: after pushing, go bot or top when your opponent has to back.${early(me[0])?' This is your strongest window.':''}`:roamOf(me[0])===1?'Only roam when your wave is pushed and there is vision on the way. Otherwise keep farming.':`${nm(me[0])} barely roams: control the wave and farm${late(me[0])?', you get much stronger later':''}. Instead of roaming, take tower plates when your opponent goes missing.`);
  add('10:00',null,'Check','Goal: 75+ CS.');
  add('~11:00',1,'First item','Then hold mid priority and place vision around objectives.');
  add(OBJECTIVES.herald,1,'Rift Herald','Mid priority means your team can go to Herald.');
  add(OBJECTIVES.baron,2,'Baron',late(me[0])?'You are at your strongest now: look for fights at Baron.':'Place vision with your team, don’t go to a side lane alone.');
  if(vs[0]&&roamOf(vs[0])===2)add('from ~6:00',0,'Enemy roams',`${nm(vs[0])} likes to roam${GLOBAL_ULT.has(vs[0])?' and can join other lanes with their ultimate':''}. As soon as they leave the lane: ping right away, then ${roamOf(me[0])===2?'follow or roam on the other side yourself':'push the wave and take tower plates instead of chasing'}.`);
 }
 if(key==='BOTLANE'){
  const eng=engager(me[1]),foe=vs.some(engager);
  add('0:00',0,'Level 2 race','The first wave plus three melee minions of the second wave give level 2. Support helps push.');
  add('~1:45',0,'Level 2',eng?'Whoever hits level 2 first goes in. Your support has engage: use the window.':'Don’t fight without a level advantage. Farm and wait for mistakes instead.');
  add('~3:15',0,'Jungler window','Support wards tri-bush or river. Don’t push past the middle without vision.');
  add('~4:00',0,'Vision for dragon','Support places a ward in the dragon pit, ADC holds the wave.');
  add(OBJECTIVES.dragon,0,'First dragon','Only with priority and your jungler nearby. Push the wave first.');
  add('6:00–8:30',0,'Level 6 kill window',foe?'The opponent has engage: keep your distance until your ultimates are ready.':'Both ultimates ready: look for an all-in together.');
  if(roamOf(me[1])===0)add('~8:00',0,'Vision instead of roams',`${nm(me[1])} should stay with the ADC and ward the river. Roams barely pay off for your support.`);else add('~8:00',0,'Support roam','After a crash or when the ADC has backed: help mid or jungle.');
  if(vs[1]&&roamOf(vs[1])===2)add('from ~5:00',0,'Enemy support roams',`${nm(vs[1])} likes to roam. As soon as they go missing: warn mid and jungle, and pressure 2-v-1 with your ADC.`);
  add('10:00',null,'Check','Goal: ADC 80+ CS. Support: quest nearly done, vision in the river.');
  add('~12:00',1,'First item',late(me[0])?'Your ADC scales: farm safely until two items.':'Apply pressure with the first item and take tower plates.');
  add('~14:00',1,'End of laning phase','Take over mid together or group for the next dragon.');
 }
 const mins=t=>{const m=String(t).match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:9999;};L.sort((a,b)=>mins(a.t)-mins(b.t));
 const spikes=me.filter(Boolean).map(id=>({id,txt:late(id)?'strong late':early(id)?'strong early':'strong after first item'}));
 return{items:L,spikes,me,vs};
}
