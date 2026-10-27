// Lädt die App in der gewählten Sprache. Standard: Englisch. Wahl pro Gerät in localStorage.
let lang='en';try{if(localStorage.getItem('riftroom.lang')==='de')lang='de';}catch{}
document.documentElement.lang=lang;
import(lang==='de'?'./app.js':'./en/app.js');
