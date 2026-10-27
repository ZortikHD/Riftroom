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
 if(us.front>=6)S.push('Starke Frontline: ihr haltet lange Teamfights aus.');else if(us.front<3)W.push('Wenig Frontline: kämpft nicht ohne Sicht und nicht face-check.');
 if(us.engage>=6)S.push('Viel Engage: ihr könnt Kämpfe erzwingen, wann ihr wollt.');else if(us.engage<3)W.push('Kaum Engage: ihr müsst auf Fehler oder Picks warten.');
 if(us.peel>=6)S.push('Viel Peel: eure Carries sind gut geschützt.');else if(us.peel<3&&them.engage>=5)W.push('Wenig Peel gegen viel Engage: Carries hinten bleiben.');
 const oneSided=us.count>=4&&(us.magic===0||us.physical===0)&&us.mixed===0;
 if(oneSided)W.push(`Nur ${us.magic?'magischer':'physischer'} Schaden: der Gegner kann gezielt ${us.magic?'Magieresistenz':'Rüstung'} bauen.`);
 else if(us.magic&&us.physical)S.push('Gemischter Schaden: schwer mit Items zu kontern.');
 if(edge[0]===1)S.push('Früh stärker: Druck in den ersten 14 Minuten.');if(edge[2]===1)S.push('Skaliert besser: lange Spiele gehören euch.');
 if(edge[0]===-1)W.push('Früh schwächer: kein unnötiges Risiko vor 14 Minuten.');if(edge[2]===-1)W.push('Gegner skaliert besser: entscheidet das Spiel vor 25 Minuten.');
 if(them.engage>=6)A.push('Gegner hat viel Engage: nicht klumpen, Flash für Gefahren aufheben.');
 if(them.front>=6)A.push('Gegner hat viel Frontline: Carries treffen, was erreichbar ist, nicht immer den Tank.');
 const assassins=enemies.filter(id=>{const p=profileOf(id);return p&&p.front===0&&p.scaling<=2&&p.engage>=1;}).length;
 if(assassins>=2)A.push('Mehrere gefährliche Burst-Champions: in der Mitte der Karte nur zu zweit laufen.');
 if(them.peel>=6)A.push('Gegner schützt seine Carries gut: lieber Seiten splitten oder Picks suchen.');
 if(!A.length)A.push('Auf Sicht um Objectives achten: wer zuerst wardet, entscheidet den Kampf.');
 return{S:S.slice(0,4),W:W.slice(0,4),A:A.slice(0,3)};
}

// Zeitleiste: was wann wichtig ist, eingefärbt nach eurer Stärke in der Phase.
export function timeline(allies,enemies){
 const e=phaseEdge(allies,enemies);
 const tone=k=>e[k]===1?'go':e[k]===-1?'careful':'even';
 return[
  {t:'0:00',tone:tone(0),title:'Start',text:e[0]===1?'Ihr seid früh stärker: Invade oder Level-2-Druck in der Bot-Lane lohnt sich.':e[0]===-1?'Sicher starten: Jungle-Eingänge warden, kein Invade.':'Sauberer Start: Wellen halten, Jungle-Eingänge warden.'},
  {t:OBJECTIVES.dragon,tone:tone(0),title:'Erster Drache',text:'Bot und Jungle bauen davor Prio auf. Ab ca. 4:00 Sicht um die Grube setzen.'},
  {t:OBJECTIVES.grubs,tone:tone(0),title:'Voidgrubs',text:'Top und Jungle. Nur einmal pro Spiel, verschwinden um 14:45. Gut für frühen Turmdruck.'},
  {t:'10:00',tone:'even',title:'Kurzer Check',text:'Jeder vergleicht mit seinen Richtwerten unten: CS, Level und erstes Item.'},
  {t:OBJECTIVES.herald,tone:tone(1),title:'Rift Herald',text:e[1]===1?'Euer Fenster: Herald holen und in eine Lane setzen, die schon vorne liegt.':'Herald nur ohne Risiko. Verschwindet um 19:45.'},
  {t:OBJECTIVES.baron,tone:tone(2),title:'Baron',text:e[2]===1?'Ihr werdet stärker: Baron erzwingen, sobald ein Gegner fehlt.':e[2]===-1?'Gegner wird stärker: Baron nur nach gewonnenem Kampf, sonst Sicht und Seiten.':'Baron nach einem Pick oder gewonnenem Kampf.'},
  {t:'25:00',tone:tone(2),title:'Spätes Spiel',text:e[2]===1?'Jetzt seid ihr am stärksten: zusammen bleiben und Kämpfe suchen.':e[2]===-1?'Gegner ist jetzt stärker: Sicht, Wellen und auf Fehler warten.':'Einzelne Fehler entscheiden: niemand allein in den Jungle.'},
 ];
}

// Richtwerte pro Rolle, angepasst an das Scaling des Champions.
export function benchmarks(i,allyId,allies){
 const role=ROLES[i],p=profileOf(allyId)||{scaling:2,engage:0};
 const spike=p.scaling>=3?'Spät stark: sicher farmen, Spike mit zwei Items (ca. 20 Min.).':p.scaling<=1?'Früh stark: bis ca. 14 Min. Druck machen und Vorsprung ausbauen.':'Stark nach dem ersten Item: dann Kämpfe suchen.';
 const B={
  TOP:[['10:00','70+ CS'],['ca. 7:00','Level 6'],[OBJECTIVES.grubs,'Bei den Voidgrubs Prio haben']],
  JUNGLE:[['ca. 3:15','Erster Clear fertig'],['ca. 7:30','Level 6'],[OBJECTIVES.dragon,'Drache oder Gegenseite planen']],
  MIDDLE:[['10:00','75+ CS'],['ca. 6:30','Level 6, dann Roams'],['ca. 11:00','Erstes Item']],
  BOTTOM:[['10:00','80+ CS'],['ca. 8:30','Level 6'],['ca. 12:00','Erstes Item']],
  UTILITY:[['ca. 1:45','Level 2 zuerst erreichen'],['ca. 4:00','Drachengrube warden'],['nach 1. Back','Roam Mid oder Jungle helfen']],
 }[role];
 const roam={
  TOP:'Nach dem Crash deiner Welle zu Grubs oder Herald drehen.',
  JUNGLE:gankTarget(allies),
  MIDDLE:'Roamen, wenn deine Welle gepusht ist und dein Gegner zurück muss.',
  BOTTOM:'Nicht roamen. Farm hat Vorrang, nach dem ersten Turm Mid übernehmen.',
  UTILITY:'Roamen, wenn die Bot-Welle crasht oder dein Schütze zurück ist.',
 }[role];
 return{items:B,spike,roam};
}
function gankTarget(allies){
 const lanes=[[0,'Top'],[2,'Mid'],[3,'Bot']];
 let best=null,score=-1;
 for(const [i,name] of lanes){const ids=i===3?[allies[3],allies[4]]:[allies[i]];const v=ids.reduce((a,id)=>{const p=profileOf(id);return a+(p?p.engage+(3-p.scaling):0);},0);if(v>score){score=v;best=name;}}
 return`Gank-Ziel: ${best}. Dort ist euer Early-Game mit Engage am stärksten.`;
}
export {ROLE_NAMES};

/* ---------- Persönlicher Fahrplan je Rolle ---------- */
// Top, Jungle, Mid einzeln. Bot-Lane = ADC und Support zusammen, weil sie die Lane-Phase gemeinsam spielen.
export const PLAN_ROLES=['TOP','JUNGLE','MIDDLE','BOTLANE'];
export const PLAN_ROLE_NAMES={TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTLANE:'Bot-Lane'};
const early=id=>(profileOf(id)?.scaling??2)<=1,late=id=>(profileOf(id)?.scaling??2)>=3,engager=id=>(profileOf(id)?.engage??0)>=2;
export function roleTimeline(key,allies,enemies){
 const e=phaseEdge(allies,enemies),tone=k=>e[k]===1?'go':e[k]===-1?'careful':'even';
 const me=key==='BOTLANE'?[allies[3],allies[4]]:[allies[ROLES.indexOf(key)]],vs=key==='BOTLANE'?[enemies[3],enemies[4]]:[enemies[ROLES.indexOf(key)]];
 const L=[];const add=(t,phase,title,text)=>L.push({t,tone:phase==null?'even':tone(phase),title,text});
 if(key==='TOP'){
  add('0:00',0,'Level 1–3',early(me[0])?'Du bist früh stark: kurze Trades suchen und die Welle kontrollieren.':'Sicher farmen, keine unnötigen Trades. Dein Champion wird später stärker.');
  add('ca. 3:15',0,'Jungler-Fenster','Der gegnerische Jungler ist mit dem ersten Clear fertig. Welle nicht weit pushen, solange du keine Sicht hast.');
  add('ca. 7:00',0,'Level 6','Prüfe dein Kill-Fenster. Mit Teleport: auf Bot- oder Drachen-Plays achten.');
  add(OBJECTIVES.grubs,0,'Voidgrubs','Mit deinem Jungler Prio holen: Welle pushen, dann zur Grube.');
  add('10:00',null,'Check','Ziel: 70+ CS.');
  add('ca. 14:00',1,'Ende der Lane-Phase',`Side-Lane halten. Ab ${OBJECTIVES.herald} zum Herald, wenn dein Team Prio hat.`);
  add(OBJECTIVES.baron,2,'Baron','Side-Lane vorher pushen und rechtzeitig zum Team kommen.');
 }
 if(key==='JUNGLE'){
  add('0:00',0,'Start','Beginne auf der Seite, auf der du danach ganken willst. Level 1 Invades nur, wenn euer Team früh stärker ist.');
  add('ca. 3:15',0,'Erster Clear fertig',gankTarget(allies)+' Alternativ Scuttle Crab holen.');
  add(OBJECTIVES.dragon,0,'Erster Drache','Nur mit Prio in Bot und Mid. Sonst die Gegenseite (Top, Grubs) spielen.');
  add('ca. 7:30',0,'Level 6','Jetzt sind Ganks mit Ulti am stärksten.');
  add(OBJECTIVES.grubs,0,'Voidgrubs','Mit Top-Prio holen, gut für frühen Turmdruck.');
  add(OBJECTIVES.herald,1,'Rift Herald','In eine Lane setzen, die schon vorne liegt.');
  add(OBJECTIVES.baron,2,'Baron','Nur nach Pick oder gewonnenem Kampf. Smite bereithalten.');
 }
 if(key==='MIDDLE'){
  add('0:00',0,'Level 1–3','Welle schnell clearen. Mit Prio kannst du deinem Jungler am Scuttle helfen.');
  add('ca. 3:15',0,'Jungler-Fenster','River warden. Wenn der gegnerische Jungler gezeigt wird, kannst du traden.');
  add(OBJECTIVES.dragon,0,'Erster Drache','Mit Prio als Erster in den River, damit dein Team den Drachen sichern kann.');
  add('ca. 6:30',0,'Level 6',early(me[0])?'Dein stärkstes Fenster: nach dem Push nach Bot oder Top roamen.':'Nach dem Push roamen, aber keine CS verschenken.');
  add('10:00',null,'Check','Ziel: 75+ CS.');
  add('ca. 11:00',1,'Erstes Item','Danach Mid-Prio halten und Sicht um die Objectives setzen.');
  add(OBJECTIVES.herald,1,'Rift Herald','Prio Mid heißt: dein Team kann zum Herald.');
  add(OBJECTIVES.baron,2,'Baron',late(me[0])?'Jetzt bist du am stärksten: Kämpfe am Baron suchen.':'Mit dem Team Sicht legen, nicht allein auf die Seite.');
 }
 if(key==='BOTLANE'){
  const eng=engager(me[1]),foe=vs.some(engager);
  add('0:00',0,'Level-2-Rennen','Erste Welle plus drei Nahkampf-Vasallen der zweiten Welle bringen Level 2. Support hilft beim Pushen.');
  add('ca. 1:45',0,'Level 2',eng?'Wer zuerst Level 2 ist, geht rein. Euer Support hat Engage: Fenster nutzen.':'Nicht ohne Level-Vorteil kämpfen. Lieber farmen und auf Fehler warten.');
  add('ca. 3:15',0,'Jungler-Fenster','Support wardet Tri-Bush oder River. Nicht über die Mitte pushen ohne Sicht.');
  add('ca. 4:00',0,'Sicht für den Drachen','Support legt ein Ward in die Drachengrube, ADC hält die Welle.');
  add(OBJECTIVES.dragon,0,'Erster Drache','Nur mit Prio und eurem Jungler in der Nähe. Welle vorher pushen.');
  add('6:00–8:30',0,'Level 6 Kill-Fenster',foe?'Der Gegner hat Engage: Abstand halten, bis eure Ultis bereit sind.':'Beide Ultis bereit: gemeinsam All-in suchen.');
  add('ca. 8:00',0,'Support-Roam','Nach einem Crash oder wenn der ADC zurück ist: Mid oder Jungle helfen.');
  add('10:00',null,'Check','Ziel: ADC 80+ CS. Support: Quest fast fertig, Sicht im River.');
  add('ca. 12:00',1,'Erstes Item',late(me[0])?'Dein ADC skaliert: sicher farmen bis zwei Items.':'Mit dem ersten Item Druck machen und Turm-Platten holen.');
  add('ca. 14:00',1,'Ende der Lane-Phase','Zusammen Mid übernehmen oder für den nächsten Drachen gruppieren.');
 }
 const spikes=me.filter(Boolean).map(id=>({id,txt:late(id)?'spät stark':early(id)?'früh stark':'stark nach dem ersten Item'}));
 return{items:L,spikes,me,vs};
}
