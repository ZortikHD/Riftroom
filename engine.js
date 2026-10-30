export const ROLES=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
// Winrate mit 200 virtuellen Spielen Richtung 50 % geglättet, damit seltene Picks nicht übertrieben wirken.
export const adj=e=>(e.wins+100)/(e.games+200);
export const ROLE_NAMES={TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTTOM:'Bot',UTILITY:'Support'};
// Editorial archetypes: role | damage (physical/magic/mixed) | frontline | engage | peel | scaling.
// These are coarse planning aids, not measured matchup or win probabilities.
const lines=`Aatrox|TOP|physical|2|1|0|1
Ahri|MIDDLE|magic|0|2|1|1
Akali|TOP,MIDDLE|magic|0|1|0|2
Akshan|MIDDLE|physical|0|0|0|1
Alistar|UTILITY|magic|3|3|3|1
Ambessa|TOP|physical|2|2|0|2
Amumu|JUNGLE|magic|3|3|1|2
Anivia|MIDDLE|magic|0|1|3|3
Annie|MIDDLE|magic|0|3|1|2
Aphelios|BOTTOM|physical|0|0|1|3
Ashe|BOTTOM,UTILITY|physical|0|3|2|2
AurelionSol|MIDDLE|magic|0|1|1|3
Aurora|MIDDLE,TOP|magic|0|1|1|2
Azir|MIDDLE|magic|0|2|2|3
Bard|UTILITY|magic|1|2|2|2
Belveth|JUNGLE|physical|1|1|0|3
Blitzcrank|UTILITY|magic|2|3|1|1
Brand|UTILITY,JUNGLE,MIDDLE|magic|0|1|1|2
Braum|UTILITY|magic|3|1|3|2
Briar|JUNGLE|physical|1|2|0|1
Caitlyn|BOTTOM|physical|0|0|1|2
Camille|TOP|physical|2|3|0|3
Cassiopeia|MIDDLE|magic|0|1|2|3
Chogath|TOP|magic|3|1|2|3
Corki|MIDDLE,BOTTOM|physical|0|0|0|2
Darius|TOP|physical|2|1|0|1
Diana|JUNGLE,MIDDLE|magic|1|3|0|2
Draven|BOTTOM|physical|0|0|0|1
DrMundo|TOP|magic|3|0|0|3
Ekko|JUNGLE,MIDDLE|magic|0|1|0|3
Elise|JUNGLE|magic|0|2|1|1
Evelynn|JUNGLE|magic|0|1|0|2
Ezreal|BOTTOM|physical|0|0|0|2
Fiddlesticks|JUNGLE|magic|0|3|2|2
Fiora|TOP|physical|1|0|0|3
Fizz|MIDDLE|magic|0|2|0|2
Galio|MIDDLE|magic|3|3|2|2
Gangplank|TOP|physical|1|0|1|3
Garen|TOP|physical|2|0|0|2
Gnar|TOP|mixed|2|3|1|2
Gragas|TOP,JUNGLE|magic|2|3|2|2
Graves|JUNGLE|physical|1|0|0|3
Gwen|TOP|magic|1|0|0|3
Hecarim|JUNGLE|physical|2|3|0|2
Heimerdinger|TOP,MIDDLE|magic|0|1|2|2
Hwei|MIDDLE|magic|0|2|2|3
Illaoi|TOP|physical|2|0|0|2
Irelia|TOP,MIDDLE|physical|1|2|0|2
Ivern|JUNGLE|magic|0|1|3|3
Janna|UTILITY|magic|0|0|3|3
JarvanIV|JUNGLE|physical|2|3|1|1
Jax|TOP|mixed|2|2|1|3
Jayce|TOP,MIDDLE|physical|0|0|1|2
Jhin|BOTTOM|physical|0|2|1|2
Jinx|BOTTOM|physical|0|0|1|3
Kaisa|BOTTOM|mixed|0|1|0|3
Kalista|BOTTOM|physical|0|2|1|1
Karma|UTILITY,MIDDLE|magic|0|1|3|1
Karthus|JUNGLE|magic|0|0|0|3
Kassadin|MIDDLE|magic|0|0|0|3
Katarina|MIDDLE|magic|0|0|0|2
Kayle|TOP|mixed|0|0|2|3
Kayn|JUNGLE|physical|1|1|0|2
Kennen|TOP|magic|0|3|1|2
Khazix|JUNGLE|physical|0|0|0|2
Kindred|JUNGLE|physical|0|0|2|3
Kled|TOP|physical|2|3|0|1
KogMaw|BOTTOM|mixed|0|0|0|3
KSante|TOP|physical|3|2|2|2
Leblanc|MIDDLE|magic|0|1|0|1
LeeSin|JUNGLE|physical|1|2|1|1
Leona|UTILITY|magic|3|3|2|1
Lillia|JUNGLE|magic|1|2|0|3
Lissandra|MIDDLE|magic|1|3|2|2
Lucian|BOTTOM|physical|0|0|0|1
Lulu|UTILITY|magic|0|0|3|3
Lux|UTILITY,MIDDLE|magic|0|1|2|2
Malphite|TOP|magic|3|3|1|2
Malzahar|MIDDLE|magic|0|2|2|2
Maokai|TOP,JUNGLE,UTILITY|magic|3|3|3|2
MasterYi|JUNGLE|physical|0|0|0|3
Mel|MIDDLE,UTILITY|magic|0|1|2|2
Milio|UTILITY|magic|0|0|3|3
MissFortune|BOTTOM|physical|0|0|0|2
Mordekaiser|TOP|magic|2|1|0|2
Morgana|UTILITY|magic|0|2|3|2
Naafiri|MIDDLE|physical|0|1|0|2
Nami|UTILITY|magic|0|2|3|2
Nasus|TOP|physical|2|0|1|3
Nautilus|UTILITY|magic|3|3|2|1
Neeko|MIDDLE,UTILITY|magic|0|3|1|2
Nidalee|JUNGLE|magic|0|0|1|1
Nilah|BOTTOM|physical|1|2|0|3
Nocturne|JUNGLE|physical|1|3|0|2
Nunu|JUNGLE|magic|3|3|1|1
Olaf|TOP,JUNGLE|physical|2|1|0|1
Orianna|MIDDLE|magic|0|2|2|3
Ornn|TOP|magic|3|3|2|3
Pantheon|TOP,MIDDLE,UTILITY|physical|1|2|1|1
Poppy|TOP,JUNGLE,UTILITY|physical|3|2|3|2
Pyke|UTILITY|physical|0|3|1|1
Qiyana|MIDDLE|physical|0|3|0|2
Quinn|TOP|physical|0|0|0|1
Rakan|UTILITY|magic|1|3|3|2
Rammus|JUNGLE|magic|3|2|2|2
RekSai|JUNGLE|physical|2|2|1|1
Rell|UTILITY|magic|3|3|2|2
Renata|UTILITY|magic|0|2|3|3
Renekton|TOP|physical|2|2|0|1
Rengar|JUNGLE|physical|0|1|0|2
Riven|TOP|physical|1|2|1|2
Rumble|TOP|magic|1|2|0|2
Ryze|MIDDLE,TOP|magic|0|1|1|3
Samira|BOTTOM|physical|0|1|0|2
Sejuani|JUNGLE|magic|3|3|2|2
Senna|UTILITY|physical|0|1|2|3
Seraphine|UTILITY,BOTTOM|magic|0|2|3|3
Sett|TOP|physical|3|2|1|2
Shaco|JUNGLE|mixed|0|0|1|2
Shen|TOP|magic|3|2|3|2
Shyvana|JUNGLE|mixed|2|1|0|3
Singed|TOP|magic|2|2|1|2
Sion|TOP|physical|3|2|1|3
Sivir|BOTTOM|physical|0|1|0|3
Skarner|JUNGLE|physical|3|3|2|2
Smolder|BOTTOM|physical|0|0|0|3
Sona|UTILITY|magic|0|2|3|3
Soraka|UTILITY|magic|0|0|3|3
Swain|MIDDLE,UTILITY,BOTTOM|magic|2|1|1|2
Sylas|MIDDLE|magic|1|2|0|2
Syndra|MIDDLE|magic|0|1|2|3
TahmKench|TOP,UTILITY|magic|3|1|3|2
Taliyah|MIDDLE,JUNGLE|magic|0|2|2|2
Talon|MIDDLE,JUNGLE|physical|0|1|0|1
Taric|UTILITY|magic|2|1|3|3
Teemo|TOP|magic|0|0|1|2
Thresh|UTILITY|magic|2|3|3|2
Tristana|BOTTOM,MIDDLE|physical|0|1|1|3
Trundle|TOP,JUNGLE|physical|2|1|1|2
Tryndamere|TOP|physical|1|0|0|3
TwistedFate|MIDDLE|magic|0|2|1|2
Twitch|BOTTOM|physical|0|0|0|3
Udyr|JUNGLE|mixed|3|1|0|2
Urgot|TOP|physical|2|1|1|2
Varus|BOTTOM|mixed|0|2|1|2
Vayne|BOTTOM,TOP|physical|0|0|1|3
Veigar|MIDDLE|magic|0|2|2|3
Velkoz|MIDDLE,UTILITY|magic|0|0|1|2
Vex|MIDDLE|magic|0|3|1|2
Vi|JUNGLE|physical|2|3|1|2
Viego|JUNGLE|physical|1|1|0|2
Viktor|MIDDLE|magic|0|1|1|3
Vladimir|TOP,MIDDLE|magic|1|0|0|3
Volibear|TOP,JUNGLE|mixed|3|2|1|1
Warwick|JUNGLE,TOP|physical|2|2|0|1
MonkeyKing|TOP,JUNGLE|physical|2|3|1|2
Xayah|BOTTOM|physical|0|0|2|3
Xerath|MIDDLE,UTILITY|magic|0|0|1|2
XinZhao|JUNGLE|physical|2|2|1|1
Yasuo|MIDDLE,TOP|physical|1|2|1|3
Yone|MIDDLE,TOP|mixed|1|3|0|3
Yorick|TOP|physical|2|0|0|3
Yunara|BOTTOM|physical|0|0|0|3
Yuumi|UTILITY|magic|0|0|3|3
Zac|JUNGLE,TOP|magic|3|3|2|2
Zed|MIDDLE|physical|0|0|0|2
Zeri|BOTTOM|physical|0|0|0|3
Ziggs|MIDDLE,BOTTOM|magic|0|0|1|3
Zilean|UTILITY|magic|0|1|3|3
Zoe|MIDDLE|magic|0|2|0|1
Zyra|UTILITY|magic|0|2|2|2`;
export const PROFILES=Object.fromEntries(lines.split('\n').map(line=>{const [id,roles,damage,...nums]=line.split('|');const [front,engage,peel,scaling]=nums.map(Number);return[id,{roles:roles.split(','),damage,front,engage,peel,scaling}];}));
// Rollen aus den Winrate-Daten: eine Rolle zählt, wenn sie mindestens 8 % der Spiele des Champions
// und mindestens 2.000 Spiele hat. So sind Off-Rollen und neue Champions automatisch dabei.
let META_ROLES=new Map(),CATALOG_BY_ID=new Map(),lastMeta=null,lastCatalog=null;
export function learnRoles(meta){if(meta===lastMeta)return;lastMeta=meta;META_ROLES=new Map();if(!meta)return;const tot=new Map();for(const e of meta.entries)tot.set(e.champion,(tot.get(e.champion)||0)+e.games);for(const e of meta.entries){if(e.games>=2000&&e.games>=0.08*tot.get(e.champion)){if(!META_ROLES.has(e.champion))META_ROLES.set(e.champion,new Set());META_ROLES.get(e.champion).add(e.role);}}}
export function useCatalog(catalog){if(catalog===lastCatalog)return;lastCatalog=catalog;CATALOG_BY_ID=new Map((catalog?.champions||[]).map(c=>[c.id,c]));}
const TAG_ROLE={Marksman:'BOTTOM',Support:'UTILITY',Mage:'MIDDLE',Assassin:'MIDDLE',Fighter:'TOP',Tank:'TOP'};
// Grobe Ableitung für Champions ohne kuratiertes Profil (z. B. ganz neue). Wird als "geschätzt" markiert.
function derivedProfile(id){const c=CATALOG_BY_ID.get(id);if(!c)return null;const t=c.tags||[],i=c.info||{};const tank=t.includes('Tank'),fighter=t.includes('Fighter'),support=t.includes('Support'),mage=t.includes('Mage');
 return{roles:[TAG_ROLE[t[0]]||'TOP'],damage:(i.magic||0)>=(i.attack||0)+3?'magic':(i.attack||0)>=(i.magic||0)+3?'physical':'mixed',front:tank?3:fighter?((i.defense||0)>=6?2:1):0,engage:tank?2:fighter?1:0,peel:support?2:(tank||mage)?1:0,scaling:2,estimated:true};}
export function profileOf(id){const base=PROFILES[id]||derivedProfile(id);if(!base)return null;const extra=META_ROLES.get(id);if(!extra)return base;const roles=base.estimated?[...extra]:[...new Set([...base.roles,...extra])];return{...base,roles};}
export function initialState(){return{version:1,teamName:'Mein Team',players:ROLES.map((role,i)=>({name:`Spieler ${String(i+1).padStart(2,'0')}`,role,pool:[['Ornn','Gnar','Camille'],['JarvanIV','Sejuani','Viego'],['Orianna','Ahri','Syndra'],['Jinx','Kaisa','Ashe'],['Rakan','Nautilus','Lulu']][i].map(id=>({id,comfort:3}))})),allies:Array(5).fill(null),enemies:Array(5).fill(null),bans:Array(10).fill(null),selectedRole:0,poolOnly:false,feedUrl:'',targetPatch:'',meta:null,catalog:null,lastChecked:null,templates:[],seenPatch:'',draftMode:'free',side:'blue',opponents:[],opponentId:'',history:[],matchups:{},draftActive:false,riotRegion:'euw'};}
// Regionen für die op.gg-Suche (Kürzel wie in op.gg-Links).
export const OPP_REGIONS=['euw','eune','na','kr','tr','br','lan','las','oce','jp','ru','me','sg','tw','vn'];
export const emptyOppPlayers=()=>ROLES.map(()=>({riotId:'',champs:[]}));
export const shortPatch=v=>String(v||'').split('.').slice(0,2).join('.');
// Direkt nach einem Patchwechsel gibt es noch kaum Spiele. Winrates genau eines Patches davor gelten dann als Ersatz (fallback).
export function metaStatus(meta,patch,now=Date.now()){if(!meta)return {ok:false,label:'Nicht verbunden'};if(now-Date.parse(meta.updatedAt)>14*86400000)return{ok:false,label:'Veraltet'};const mp=shortPatch(meta.patch),tp=shortPatch(patch);if(mp===tp)return{ok:true,label:'Verbunden'};const [ma,mi]=mp.split('.').map(Number),[ta,ti]=tp.split('.').map(Number);if((ma===ta&&mi===ti-1)||(ma===ta-1&&ti===1))return{ok:true,fallback:true,label:`Winrates von ${mp}`};return{ok:false,label:'Anderer Patch'};}
export function validateMeta(value,ids,now=Date.now()){
 if(!value||value.schemaVersion!==1)throw Error('Das Format benötigt schemaVersion: 1.');
 for(const k of ['source','patch','updatedAt','region','rank','queue'])if(typeof value[k]!=='string'||!value[k].trim()||value[k].length>180)throw Error(`Das Feld ${k} fehlt oder ist ungültig.`);
 if(!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(value.patch))throw Error('Patch muss z. B. 16.20 sein.');
 const date=Date.parse(value.updatedAt);if(!Number.isFinite(date)||date>now+300000)throw Error('Ungültiger Datenzeitpunkt.');
 if(!Number.isInteger(value.matches)||value.matches<1)throw Error('matches muss die Zahl der ausgewerteten Spiele enthalten.');
 if(!Array.isArray(value.entries)||value.entries.length<1||value.entries.length>1500)throw Error('entries muss 1–1500 Statistikzeilen enthalten.');
 const seen=new Set();const entries=value.entries.map(e=>{if(!e||!ids.has(e.champion)||!ROLES.includes(e.role))throw Error('Unbekannter Champion oder ungültige Rolle.');const k=e.champion+e.role;if(seen.has(k))throw Error('Doppelte Champion-Rollen-Kombination.');seen.add(k);if(!Number.isInteger(e.games)||e.games<1||e.games>value.matches||!Number.isInteger(e.wins)||e.wins<0||e.wins>e.games)throw Error('games/wins sind ungültig oder größer als die Stichprobe.');for(const f of ['pickRate','banRate'])if(e[f]!=null&&(typeof e[f]!=='number'||!Number.isFinite(e[f])||e[f]<0||e[f]>100))throw Error(`${f} muss zwischen 0 und 100 liegen.`);return{champion:e.champion,role:e.role,games:e.games,wins:e.wins,...(e.pickRate!=null?{pickRate:e.pickRate}:{}),...(e.banRate!=null?{banRate:e.banRate}:{})};});
 return{schemaVersion:1,...Object.fromEntries(['source','patch','updatedAt','region','rank','queue','matches'].map(k=>[k,value[k]])),entries};
}
export function composition(ids){const p=ids.filter(Boolean).map(id=>profileOf(id)).filter(Boolean);return{count:ids.filter(Boolean).length,known:p.length,front:p.reduce((a,c)=>a+c.front,0),engage:p.reduce((a,c)=>a+c.engage,0),peel:p.reduce((a,c)=>a+c.peel,0),scaling:p.reduce((a,c)=>a+c.scaling,0),physical:p.filter(c=>c.damage==='physical').length,magic:p.filter(c=>c.damage==='magic').length,mixed:p.filter(c=>c.damage==='mixed').length};}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// mu: Matchup-Winrates (roles[rolle][gegner] = [[champion, winrate gegen gegner, spiele], …]). Ist der Gegner auf dieser Rolle
// schon gepickt, zählt das Lane-Duell mit. Champions, die auf der Rolle kaum gespielt werden, gelten als Off-Meta.
export function recommend(state,catalog,now=Date.now(),mu=null){
 const index=state.selectedRole,role=ROLES[index],player=state.players[index];
 const occupied=new Set([...state.allies,...state.enemies,...state.bans,...(state.fearless?.used||[])].filter(Boolean));
 const peers=state.allies.filter((_,i)=>i!==index);const team=composition(peers),enemy=composition(state.enemies);
 const patch=state.targetPatch||catalog.version;const live=metaStatus(state.meta,patch,now).ok;
 const foe=state.enemies[index]&&state.enemies[index]!=='none'?state.enemies[index]:null,laneRows=foe?mu?.roles?.[role]?.[foe]:null;
 return catalog.champions.filter(c=>!occupied.has(c.id)&&profileOf(c.id)?.roles.includes(role)&&(!state.poolOnly||player.pool.some(p=>p.id===c.id))).map(c=>{
  const p=profileOf(c.id),pool=player.pool.find(x=>x.id===c.id),reasons=[];
  const comfort=pool?20+pool.comfort*16:35;
  let fit=50;if(team.front<3){fit+=p.front*7;if(p.front>=2)reasons.push('Frontline');}if(team.engage<3){fit+=p.engage*5;if(p.engage>=2)reasons.push('Engage');}
  if(team.physical>team.magic&&p.damage==='magic'){fit+=15;reasons.push('Magischer Schaden');}if(team.magic>team.physical&&p.damage==='physical'){fit+=15;reasons.push('Physischer Schaden');}
  if(team.scaling>=5&&p.peel>=2){fit+=10;reasons.push('Schützt Carries');}fit=clamp(fit,0,100);
  let response=50;if(enemy.engage>=4){response+=p.peel*12;if(p.peel>=2)reasons.push('Peel gegen Engage');}if(enemy.front>=5&&p.scaling>=3){response+=15;reasons.push('Scaling gegen Frontline');}response=clamp(response,0,100);
  const stat=live?(state.meta.entries.find(s=>s.champion===c.id&&s.role===role)??null):null;
  // Shrink small samples to 50%; strength is a heuristic, never a win probability.
  const adjusted=stat?adj(stat):null;
  let meta=adjusted===null?null:clamp(50+(adjusted-.5)*400,0,100);
  if(live&&!stat){meta=30;reasons.push('Off-Meta');}
  // Unter 1 % Pickrate auf der Rolle: Nischen-Pick. Die Winrate ist oft geschönt, weil ihn fast nur Spezialisten spielen.
  else if(live&&!pool&&(stat.pickRate??1)<1){meta=Math.min(meta,40);reasons.push('Nische');}
  // Lane-Duell gegen den schon gepickten Gegner (geglättet mit 200 virtuellen Spielen).
  let lane=null,matchup=null;const lr=laneRows?.find(x=>x[0]===c.id);
  if(lr&&lr[2]>=300){const a=(lr[1]*lr[2]+50*200)/(lr[2]+200);matchup={foe,wr:a,n:lr[2]};lane=clamp(50+(a-50)*8,0,100);if(a>=51.5)reasons.unshift('Matchup+');else if(a<=48.5)reasons.unshift('Matchup-');}
  const components=[{label:'Champion-Pool',value:comfort,weight:.35},{label:'Teamkomposition',value:fit,weight:.4},...(enemy.known?[{label:'Gegnerprofil',value:response,weight:.15}]:[]),...(meta!==null?[{label:'Meta-Daten',value:meta,weight:.25}]:[]),...(lane!==null?[{label:'Lane-Duell',value:lane,weight:.3}]:[])];
  const total=components.reduce((a,v)=>a+v.weight,0);let raw=components.reduce((a,v)=>a+v.value*v.weight,0)/total;
  // Off-Meta- und Nischen-Picks außerhalb des Pools nur, wenn sonst wirklich alles passt.
  if(!pool&&reasons.includes('Off-Meta'))raw*=0.85;else if(!pool&&reasons.includes('Nische'))raw*=0.9;
  const score=Math.round(raw);
  if(pool)reasons.unshift(`Pool ${pool.comfort}/5`);if(!reasons.length)reasons.push('Alternative');
  return {...c,score,raw,adjusted,reasons:reasons.slice(0,3),components,stat,profile:p,matchup};
 }).sort((a,b)=>b.raw-a.raw||(b.adjusted??0)-(a.adjusted??0)||a.name.localeCompare(b.name,'de'));
}
export function validateState(s,catalog){
 const ids=new Set(catalog.champions.map(c=>c.id));if(!s||s.version!==1||!Array.isArray(s.players)||s.players.length!==5)throw Error('Ungültige Team-Datei.');
 const base=initialState();base.teamName=String(s.teamName||'Mein Team').slice(0,50);
 base.players=s.players.map((p,i)=>{if(!p||!Array.isArray(p.pool)||p.pool.length>100)throw Error('Ungültiger Champion-Pool.');const used=new Set();return{name:String(p.name||`Spieler ${i+1}`).slice(0,40),role:ROLES[i],riotId:typeof p.riotId==='string'?p.riotId.trim().slice(0,40):'',pool:p.pool.map(v=>{if(!ids.has(v.id)||used.has(v.id)||!Number.isInteger(v.comfort)||v.comfort<1||v.comfort>5)throw Error('Ungültiger Champion oder Sicherheitswert.');used.add(v.id);return{id:v.id,comfort:v.comfort};})};});
 const occupied=new Set();for(const [field,length] of [['allies',5],['enemies',5],['bans',10]]){if(!Array.isArray(s[field])||s[field].length!==length)throw Error('Ungültiger Draft.');base[field]=s[field].map(id=>{if(id===null)return null;if(field==='bans'&&id==='none')return 'none';if(!ids.has(id)||occupied.has(id))throw Error('Champion doppelt oder unbekannt.');occupied.add(id);return id;});}
 base.selectedRole=Number.isInteger(s.selectedRole)&&s.selectedRole>=0&&s.selectedRole<5?s.selectedRole:0;base.poolOnly=!!s.poolOnly;
 if(s.targetPatch&&!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(s.targetPatch))throw Error('Ungültiger Ziel-Patch.');base.targetPatch=s.targetPatch||'';
 if(s.feedUrl){const u=new URL(s.feedUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Die Daten-URL muss HTTPS verwenden und darf keine Zugangsdaten oder Query-Parameter enthalten.');base.feedUrl=u.href;}
 if(s.meta)base.meta=validateMeta(s.meta,ids);base.metaImported=!!(s.metaImported&&base.meta);
 base.fearless=s.fearless&&Number.isInteger(s.fearless.game)&&s.fearless.game>=1&&s.fearless.game<=9&&Array.isArray(s.fearless.used)?{game:s.fearless.game,used:[...new Set(s.fearless.used.filter(id=>ids.has(id)))].slice(0,60)}:null;base.lastChecked=typeof s.lastChecked==='string'&&Number.isFinite(Date.parse(s.lastChecked))?s.lastChecked:null;
 base.seenPatch=typeof s.seenPatch==='string'&&/^\d{1,2}\.\d{1,2}$/.test(s.seenPatch)?s.seenPatch:'';
 base.templates=(Array.isArray(s.templates)?s.templates:[]).slice(0,20).flatMap(t=>{try{if(!t||typeof t.name!=='string')return[];const pick=(a,n)=>{if(!Array.isArray(a)||a.length!==n)throw Error();return a.map(id=>{if(id===null)return null;if(id==='none'&&n===10)return 'none';if(!ids.has(id))throw Error();return id;});};return[{id:String(t.id||t.name).slice(0,30),name:t.name.slice(0,40),allies:pick(t.allies,5),enemies:pick(t.enemies,5),bans:pick(t.bans,10)}];}catch{return[];}});
 base.draftMode=s.draftMode==='tournament'?'tournament':'free';base.draftActive=!!s.draftActive;base.side=s.side==='red'?'red':'blue';
 base.opponents=(Array.isArray(s.opponents)?s.opponents:[]).slice(0,50).flatMap(o=>{if(!o||typeof o.name!=='string'||!o.name.trim())return[];return[{id:String(o.id||o.name).slice(0,30),name:o.name.trim().slice(0,40),notes:typeof o.notes==='string'?o.notes.slice(0,4000):'',favorites:[...new Set((Array.isArray(o.favorites)?o.favorites:[]).filter(id=>ids.has(id)))].slice(0,15),region:OPP_REGIONS.includes(o.region)?o.region:'euw',players:ROLES.map((_,i)=>{const p=Array.isArray(o.players)?o.players[i]:null;return{riotId:typeof p?.riotId==='string'?p.riotId.trim().slice(0,40):'',champs:[...new Set((Array.isArray(p?.champs)?p.champs:[]).filter(id=>ids.has(id)))].slice(0,5)};})}];});
 base.opponentId=base.opponents.some(o=>o.id===s.opponentId)?s.opponentId:'';
 base.riotRegion=OPP_REGIONS.includes(s.riotRegion)?s.riotRegion:'euw';
 // Gespielte Drafts mit Ergebnis (höchstens 200, älteste zuerst). Unbekannte Champion-IDs werden zu leeren Slots.
 base.history=(Array.isArray(s.history)?s.history:[]).slice(-200).flatMap(g=>{try{if(!g||(g.result!=='win'&&g.result!=='loss'))return[];const d=Date.parse(g.date);if(!Number.isFinite(d))return[];const pick=(a,n)=>{if(!Array.isArray(a)||a.length!==n)throw Error();return a.map(id=>typeof id==='string'&&ids.has(id)?id:null);};return[{id:String(g.id||d).slice(0,30),date:new Date(d).toISOString(),result:g.result,side:g.side==='red'||g.side==='blue'?g.side:null,opponentId:typeof g.opponentId==='string'?g.opponentId.slice(0,30):'',opponentName:typeof g.opponentName==='string'?g.opponentName.slice(0,40):'',note:typeof g.note==='string'?g.note.slice(0,300):'',allies:pick(g.allies,5),enemies:pick(g.enemies,5),bans:pick(g.bans,10)}];}catch{return[];}});
 // Matchup-Notizen: gegnerischer Champion -> Notiz des Teams (höchstens 300, je 500 Zeichen).
 base.matchups=Object.fromEntries(Object.entries(s.matchups&&typeof s.matchups==='object'&&!Array.isArray(s.matchups)?s.matchups:{}).filter(([id,t])=>ids.has(id)&&typeof t==='string'&&t.trim()).slice(0,300).map(([id,t])=>[id,t.slice(0,500)]));
 return base;
}
