// Essai : mort en Ironman après 20 jours d'abandon, puis nouveau survivant et absence annoncée.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });

function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const debut = jour(-20);
const profil = {
  v: 1, debut: debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z',
  plan: { jours: [1, 4], minutes: 45 },
  survivants: [{ nom: 'Aubin', mode: 'ironman', depuis: debut }],
  programme: [{ id: 'pompes', actif: true, series: 3, niveau: 1 }], pauses: [], morts: []
};
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const clic = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 300)); process.exit(1); } console.log('ok  ' + m); }

setTimeout(() => {
  verifier(/Comité de la Sucrerie, registre/.test(texte()) && /Aubin/.test(texte()), 'écran de mort après 13 jours sans vivres en Ironman');
  verifier(!d.querySelector('#onglets .onglet'), 'pas d’onglets tant qu’un nouveau survivant n’est pas nommé');
  const m = JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.morts;
  verifier(m.length === 1 && m[0].date === jour(-7), 'mort actée et enregistrée au bon jour (13e matin)');
  clic('[data-action="nouveau-survivant"]');
  verifier(/Registre/i.test(texte()), 'un nom est exigé');
  const nom = d.querySelector('#f-nouveau'); nom.value = 'Mila'; nom.dispatchEvent(new w.Event('input', { bubbles: true }));
  clic('[data-action="mode"][data-mode="survie"]');
  clic('[data-action="nouveau-survivant"]');
  verifier(/Mila/.test(texte()) && /Carte d’alimentation/.test(texte()), 'Mila prend la relève');
  clic('[data-action="aller"][data-ecran="survivant"]');
  verifier(/Mémorial/.test(texte()) && /Aubin, tombé le/.test(texte()), 'Aubin est au Mémorial');
  const deb = d.querySelector('#f-absdebut'); deb.value = jour(2); deb.dispatchEvent(new w.Event('change', { bubbles: true }));
  const fin = d.querySelector('#f-absfin'); fin.value = jour(9); fin.dispatchEvent(new w.Event('input', { bubbles: true }));
  clic('[data-action="absence"]');
  verifier(/Absence prévue du/.test(texte()), 'absence annoncée pour plus tard');
  clic('[data-action="aller"][data-ecran="accueil"]');
  clic('[data-action="libre"]');
  const q = d.querySelector('#f-duree-libre'); q.value = '20'; q.dispatchEvent(new w.Event('input', { bubbles: true }));
  clic('[data-action="effort"][data-valeur="3"]');
  clic('[data-action="enregistrer-libre"]');
  clic('[data-action="aller"][data-ecran="accueil"]');
  clic('[data-action="aller"][data-ecran="survivant"]');
  verifier(/Absence prévue du/.test(texte()), 'une séance ne supprime pas l’absence prévue');
  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
}, 60);
