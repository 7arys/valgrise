// Essai : une partie créée avec la version précédente s'ouvre, garde ses données et propose les priorités.
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
const debut = jour(-3);
// Profil tel que la version précédente l'enregistrait
const profil = {
  v: 1, debut: debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z',
  plan: { jours: [1, 4], minutes: 45 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }],
  programme: [
    { id: 'pompes', actif: true, series: 3, niveau: 1 },
    { id: 'developpe', actif: true, series: 3, charge: 10 },
    { id: 'curl', actif: true, series: 3, charge: 8 },
    { id: 'abdos', actif: true, series: 3, niveau: 3 },
    { id: 'rowing', actif: false, series: 3, charge: 15 },
    { id: 'squat', actif: false, series: 3, charge: 12 }
  ],
  pauses: [], morts: []
};
const seances = [{ id: 'a1', date: debut, debut: debut + 'T18:00:00', minutes: 40, effort: 6, genre: 'expedition', lieu: 'La gare de triage',
  prevue: true, rationsBase: 4, cibleSemaine: 2, exercices: [{ id: 'curl', nom: 'Curl biceps aux haltères', reglage: '8 kg par haltère', series: [10, 9, 8] }] }];
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 300)); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1'));

setTimeout(() => {
  try {
    verifier(/Aubin/.test(texte()) && /Carte d’alimentation/.test(texte()), 'la partie existante s’ouvre');
    verifier(/Nouveau : choisis jusqu’à deux groupes musculaires/.test(texte()), 'le coach propose de choisir les priorités');
    verifier(stocke().profil.v === 11 && stocke().seances.length === 1, 'partie mise à jour et séance conservée');
    verifier(/Jambes et fessiers reviennent : squat et hip thrust/.test(texte()) && !/J’ai suivi ton choix/.test(texte()), 'une partie v1 n’a jamais connu le goblet squat : pas d’annonce des élastiques');
    verifier(/Jambes et fessiers reviennent/.test(texte()) && /Passer à 70 min/.test(texte()), 'le coach annonce le retour des jambes et propose 70 minutes');
    verifier(/Ida veut te voir pour une première visite/.test(texte()), 'convocation à la première visite');
    const abdos = stocke().profil.programme.find(e => e.id === 'abdos');
    const releves = stocke().profil.programme.find(e => e.id === 'releves');
    verifier(abdos.niveau === 2 && releves.actif === true, 'les anciens relevés deviennent un exercice à part');
    clic('[data-action="choisir-priorites"]');
    verifier(/Mes priorités/.test(texte()), 'le lien mène aux priorités');
    clic('[data-action="prio"][data-groupe="bras"]');
    verifier(/Ajouté à ton programme : tractions en supination, extension triceps/.test(d.getElementById('avis').textContent), 'tractions et extension triceps sont ajoutées');
    verifier(d.querySelector('#f-actif-chinup').checked && d.querySelector('#f-actif-triceps').checked, 'elles apparaissent cochées dans le programme');
    clic('[data-action="prio"][data-groupe="abdos"]');
    verifier(JSON.stringify(stocke().profil.priorites) === '["bras","abdos"]', 'priorités enregistrées');
    clic('[data-action="aller"][data-ecran="accueil"]');
    verifier(/Priorités : bras et abdos/.test(texte()) && !/Nouveau : choisis/.test(texte()), 'la carte suit les priorités et la note disparaît');
    clic('[data-action="duree"][data-minutes="70"]');
    verifier(stocke().profil.plan.minutes === 70 && !/Jambes et fessiers reviennent/.test(texte()), 'un geste passe la séance à 70 minutes');
    verifier(/Environ 69 min/.test(texte()), 'la séance complète tient en 69 minutes');
    clic('[data-action="visite-plus-tard"]');
    verifier(!/Ida veut te voir/.test(texte()), 'la convocation se reporte au lendemain');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
