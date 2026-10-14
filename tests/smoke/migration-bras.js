// Essai : une partie où la priorité « Biceps » était déjà choisie passe à « Bras », triceps ajouté, avec une note du coach.
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
const debut = jour(-1);
const profil = {
  v: 2, debut: debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z',
  plan: { jours: [1, 4], minutes: 45 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }],
  programme: [
    { id: 'pompes', actif: true, series: 3, niveau: 1 },
    { id: 'developpe', actif: true, series: 3, charge: 10 },
    { id: 'curl', actif: true, series: 3, charge: 8 },
    { id: 'chinup', actif: true, series: 3, niveau: 1 },
    { id: 'abdos', actif: true, series: 3, niveau: 2 },
    { id: 'releves', actif: true, series: 3, niveau: 0 },
    { id: 'rowing', actif: false, series: 3, charge: 15 },
    { id: 'squat', actif: false, series: 3, charge: 12 }
  ],
  priorites: ['biceps', 'abdos'], pauses: [], morts: []
};
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 300)); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil;

setTimeout(() => {
  try {
    verifier(/Ta priorité biceps devient « Bras »/.test(texte()), 'le coach annonce le passage à « Bras »');
    verifier(JSON.stringify(stocke().priorites) === '["bras","abdos"]' && stocke().v === 11, 'priorités converties et enregistrées');
    verifier(stocke().programme.find(e => e.id === 'triceps').actif === true, 'l’extension triceps est ajoutée');
    verifier(/Priorités : bras et abdos/.test(texte()) && /Extension triceps à l’élastique/.test(texte()), 'l’ordre de sortie inclut le triceps, à l’élastique');
    clic('[data-action="annonce-lue"][data-id="triceps"]');
    verifier(!/Ta priorité biceps devient/.test(texte()), 'la note disparaît une fois lue');
    verifier(JSON.stringify(stocke().annonces) === '["jambes","reglages","calibrage"]', 'restent l’annonce des jambes et celle des réglages');
    verifier(/Plus long que tes 45 min visées/.test(texte()), 'à 45 minutes, la séance complète déborde');
    clic('[data-action="annonce-lue"][data-id="jambes"]');
    verifier(JSON.stringify(stocke().annonces) === '["reglages","calibrage"]' && stocke().plan.minutes === 45, 'garder 45 minutes reste possible');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
