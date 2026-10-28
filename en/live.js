// Live-Verbindung für Minispiele mit mehreren Leuten. Eine Schnittstelle für beide Versionen:
// in Claude über die room-Fähigkeit, auf der GitHub-Seite über Supabase Realtime (nur Presence, nichts wird gespeichert).
// Jeder Teilnehmer hat ein kleines Presence-Objekt (Name, Fortschritt). Wer den Raum verlässt, verschwindet daraus.
let getSb=null;
export function setSupabase(fn){getSb=fn;}
const TAB=Math.random().toString(36).slice(2,12);
export const canLive=()=>!!(window.claude?.use||getSb);

// name: Kleinbuchstaben, Ziffern und Bindestriche.
export async function joinLive(name){
 if(window.claude?.use){
  const lobby=await window.claude.use('room').catch(()=>null);
  if(lobby)return wrapClaude(await lobby.join(name));
  if(!getSb)return null;
 }
 if(!getSb)return null;
 return wrapSb(await getSb(),name);
}

function wrapClaude(r){
 let cur={};
 return{
  presence(o){
   // Fehlende Felder des alten Objekts ausdrücklich löschen: so ersetzt jeder Aufruf das ganze Objekt, wie bei Supabase.
   const patch={...o};for(const k of Object.keys(cur))if(!(k in o))patch[k]=null;cur={...o};
   return r.presence(patch).catch(()=>{});
  },
  onPeers(cb,onClose){return r.onPeers(ch=>cb(ch.peers.map(p=>({peer:p.peer,sameTab:p.sameTab,presence:p.presence||{}}))),()=>onClose?.());},
  leave(){return r.leave().catch(()=>{});}
 };
}

// Supabase erlaubt pro Client nur wenige Presence-Änderungen. Presence zeigt deshalb nur, wer online ist (einmal gesetzt);
// den eigentlichen Stand verschickt jeder per Broadcast: sofort bei Änderungen (gebündelt) und alle paar Sekunden erneut,
// damit Neuankömmlinge ihn auch bekommen.
function wrapSb(sb,name){
 return new Promise((ok,fail)=>{
  const ch=sb.channel('mini:'+name,{config:{presence:{key:TAB},broadcast:{self:false}}});
  let cbs=[],cur=null,settled=false,closed=false,sendTimer=null,lastSend=0,beat=null,known=new Set();
  const states=new Map();
  const emit=()=>{
   if(closed)return;
   const online=Object.keys(ch.presenceState());
   const peers=online.filter(k=>k!==TAB).map(k=>({peer:k,sameTab:false,presence:states.get(k)||{}}));
   peers.push({peer:TAB,sameTab:true,presence:cur||{}});
   cbs.forEach(f=>f(peers));
  };
  const send=()=>{clearTimeout(sendTimer);sendTimer=null;if(closed||!cur)return;lastSend=Date.now();ch.send({type:'broadcast',event:'st',payload:{k:TAB,s:cur}}).catch(()=>{});};
  const queue=()=>{if(sendTimer)return;const wait=Math.max(0,250-(Date.now()-lastSend));sendTimer=setTimeout(send,wait);};
  const api={
   presence(o){cur={...o};setTimeout(emit,0);queue();return Promise.resolve();},
   onPeers(cb){cbs.push(cb);setTimeout(emit,0);return()=>{cbs=cbs.filter(f=>f!==cb);};},
   leave(){closed=true;cbs=[];clearInterval(beat);clearTimeout(sendTimer);return sb.removeChannel(ch).catch(()=>{});}
  };
  ch.on('broadcast',{event:'st'},({payload})=>{
   const k=payload?.k;if(typeof k!=='string'||k===TAB||!payload.s||typeof payload.s!=='object')return;
   states.set(k,payload.s);emit();
  });
  ch.on('presence',{event:'sync'},()=>{
   const online=Object.keys(ch.presenceState());
   for(const k of states.keys())if(!online.includes(k))states.delete(k);
   // Jemand Neues: eigenen Stand gleich schicken, statt auf den nächsten Herzschlag zu warten.
   if(online.some(k=>!known.has(k)&&k!==TAB))queue();
   known=new Set(online);emit();
  });
  ch.subscribe(status=>{
   if(status==='SUBSCRIBED'){ch.track({on:1}).catch(()=>{});queue();if(!settled){settled=true;ok(api);}}
   else if(!settled&&(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')){settled=true;sb.removeChannel(ch).catch(()=>{});fail(Error(status));}
  });
  beat=setInterval(()=>{if(Date.now()-lastSend>3500)send();},4000);
  setTimeout(()=>{if(!settled){settled=true;closed=true;clearInterval(beat);sb.removeChannel(ch).catch(()=>{});fail(Error('timeout'));}},12000);
 });
}
