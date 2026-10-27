// Startanimation bei jedem Öffnen der App. Antippen überspringt sie.
// Bei "Bewegung reduzieren" läuft eine ruhige Variante ohne Lichtstrahlen und Blitz.
(function(){
  var d=document.documentElement,reduce=false;
  try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  if(reduce)d.classList.add('calm-splash');
  function go(){
    var s=document.getElementById('splash');if(!s)return;
    var done=false;function out(){if(done)return;done=true;s.classList.add('out');setTimeout(function(){s.remove();},600);}
    s.addEventListener('click',out);setTimeout(out,reduce?1100:1750);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
