// Riot-Abfrage (nur GitHub-Version): Riot-ID rein, Rang, Mastery und meistgespielte Champions der letzten 20 Spiele raus.
// Der Riot-Key liegt nur in der Supabase-Funktion „riot“, der Browser bekommt ihn nie zu sehen.
// Abfragen laufen nacheinander. Meldet die Funktion „busy“ (Riot-Limit), wird nach der genannten Zeit automatisch erneut gefragt.
// Ergebnisse bleiben 30 Minuten in diesem Browser, damit ein Neuladen der Seite nichts kostet.
const CACHE_KEY='riftroom.riot',TTL=30*60e3,MAX_CACHE=60;
let cfg=null,queue=Promise.resolve();
const store=new Map();
try{const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');for(const [k,v] of Object.entries(saved))if(v?.data&&Date.now()-v.t<24*36e5)store.set(k,{status:'ok',data:v.data,t:v.t});}catch{}
function persist(){
 try{const list=[...store.entries()].filter(([,v])=>v.status==='ok').sort((a,b)=>b[1].t-a[1].t).slice(0,MAX_CACHE);localStorage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(list.map(([k,v])=>[k,{data:v.data,t:v.t}]))));}catch{}
}
// cfg: {url, key, onUpdate(key)}
export function initRiot(c){cfg=c;}
export const riotKey=(region,id)=>`${region}|${String(id||'').trim().toLowerCase()}`;
export const riotState=(region,id)=>store.get(riotKey(region,id))||null;
export const validRiotId=id=>/^[^#]{1,24}#[^#\s]{2,6}$/.test(String(id||'').trim());

export function riotLoad(region,id,force=false){
 const k=riotKey(region,id),cur=store.get(k);
 if(!validRiotId(id)){store.set(k,{status:'error',err:'bad'});cfg?.onUpdate(k);return Promise.resolve();}
 if(cur&&(cur.status==='loading'||cur.status==='wait'))return Promise.resolve();
 if(!force&&cur?.status==='ok'&&Date.now()-cur.t<TTL)return Promise.resolve();
 store.set(k,{status:'loading',data:cur?.data,t:cur?.t});cfg?.onUpdate(k);
 const run=()=>ask(region,String(id).trim(),k);
 queue=queue.then(run,run);
 return queue;
}
async function ask(region,id,k){
 for(let attempt=0;attempt<6;attempt++){
  let res;
  try{
   const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.key},body:JSON.stringify({riotId:id,region})});
   res=await r.json();
  }catch{res={error:'net'};}
  if(res&&!res.error&&res.name){store.set(k,{status:'ok',data:res,t:Date.now()});persist();cfg.onUpdate(k);return;}
  if(res?.error==='busy'){
   const secs=Math.min(130,Math.max(3,Number(res.retry)||20));
   store.set(k,{...store.get(k),status:'wait',retryAt:Date.now()+secs*1000});cfg.onUpdate(k);
   await new Promise(r=>setTimeout(r,secs*1000));
   store.set(k,{...store.get(k),status:'loading'});cfg.onUpdate(k);
   continue;
  }
  const prev=store.get(k);
  store.set(k,{status:'error',err:res?.error||'net',data:prev?.data,t:prev?.t});cfg.onUpdate(k);return;
 }
 store.set(k,{status:'error',err:'busy'});cfg.onUpdate(k);
}

// Auswertung für eine Rolle: Champions dieser Rolle, andere Rollen, Mastery.
// Champion-Namen aus Riots Spieldaten weichen manchmal in der Schreibweise ab (FiddleSticks), deshalb ohne Groß/klein vergleichen.
export function riotSummary(data,role,catalog){
 const byLower=new Map(catalog.champions.map(c=>[c.id.toLowerCase(),c.id])),byKey=new Map(catalog.champions.map(c=>[String(c.key),c.id]));
 const id=x=>byLower.get(String(x||'').toLowerCase());
 const merge=list=>{const m=new Map();for(const c of list){const cid=id(c.id);if(!cid)continue;const r=m.get(cid)||{id:cid,n:0,w:0,k:0,d:0,a:0};r.n+=c.n;r.w+=c.w;r.k+=c.k;r.d+=c.d;r.a+=c.a;m.set(cid,r);}return[...m.values()].sort((a,b)=>b.n-a.n||b.w-a.w);};
 const champs=data.champs||[];
 const inRole=merge(champs.filter(c=>c.pos===role));
 const other=merge(champs.filter(c=>c.pos!==role)).filter(c=>!inRole.some(r=>r.id===c.id));
 const ORDER=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
 const roles=Object.entries(data.roles||{}).sort((a,b)=>b[1]-a[1]||ORDER.indexOf(a[0])-ORDER.indexOf(b[0]));
 const mastery=(data.mastery||[]).map(m=>({id:byKey.get(String(m.c)),pts:m.pts,lvl:m.lvl})).filter(m=>m.id);
 return{inRole,other,roles,mainRole:roles[0]?.[0]||'',roleGames:data.roles?.[role]||0,mastery};
}
// Sicherheit im Pool aus der Zahl der Spiele: viel gespielt = vertraut.
export const comfortFromGames=n=>n>=6?5:n>=3?4:3;
