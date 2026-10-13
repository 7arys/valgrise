// Essai : partie v7 ; première séance réelle, le coach propose une fourchette par exercice, le joueur accepte ou garde.
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
const debut = jour(-10);
const profil = {
  v: 7, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20],
  programme: [
    { id: 'pompes', actif: false, series: 3, niveau: 0 }, { id: 'developpe', actif: false, series: 3, charge: 10 },
    { id: 'curl', actif: false, series: 3, charge: 8 }, { id: 'chinup', actif: true, series: 3, niveau: 0 },
    { id: 'abdos', actif: true, series: 3, niveau: 0 }
  ],
  priorites: [], pauses: [], morts: [], mesures: [{ id: 'm', date: jour(-2), bras: 35, taille: 85, hanches: 96 }],
  pesees: [], rappelPesee: 'jamais'
};
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const avis = () => d.getElementById('avis').textContent;
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const saisir = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 500) + ' | avis : ' + avis()); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil;
const exo = id => stocke().programme.find(e => e.id === id);
const compteur = () => +d.querySelector('.compteur .chiffre').textContent;
function series(liste) {
  liste.forEach(n => {
    while (compteur() > n) clic('[data-action="moins"]');
    while (compteur() < n) clic('[data-action="plus"]');
    clic('[data-action="valider"]');
  });
}

setTimeout(() => {
  try {
    verifier(stocke().v === 10 && /Nouveau : après ta prochaine séance, je te proposerai pour chaque exercice une fourchette/.test(texte()), 'partie v8 : le coach annonce le calibrage');
    clic('[data-action="annonce-lue"][data-id="calibrage"]');
    clic('[data-action="partir"]');
    verifier(d.querySelector('.titre-exo').textContent === 'Tractions assistées, pieds sur une chaise' && /Objectif : 3 séries de 5 à 8/.test(texte()), 'première séance : tractions, fourchette du coach 5 à 8');
    series([3, 3, 3]);
    verifier(d.querySelector('.titre-exo').textContent === 'Crunchs' && /Objectif : 3 séries de 12 à 20/.test(texte()), 'puis les crunchs, 12 à 20');
    series([9, 8, 7]);
    verifier(/Fin de sortie/.test(texte()), 'fin de sortie');
    saisir('#f-duree', '30');
    clic('[data-action="effort"][data-valeur="7"]');
    clic('[data-action="enregistrer"]');
    verifier(/Bon de pesée/.test(texte()) && /Le coach a revu tes fourchettes d’après cette sortie/.test(texte()), 'le bon de pesée annonce les propositions du coach');
    clic('[data-action="aller"][data-ecran="accueil"]');
    verifier(/Tractions assistées, pieds sur une chaise : tu as fait 3, 3 et 3\. Je te propose 3 à 5 répétitions par série\./.test(texte()), 'proposition pour les tractions : 3 à 5');
    verifier(/Crunchs : tu as fait 9, 8 et 7\. Je te propose 6 à 10 répétitions par série\./.test(texte()) && /Garder 12 à 20/.test(texte()), 'proposition pour les crunchs : 6 à 10, ou garder 12 à 20');
    clic('[data-action="calibrage"][data-ex="chinup"][data-ok="1"]');
    verifier(JSON.stringify(exo('chinup').reps) === '[3,5]' && exo('chinup').calibre === 'n0' && /Fourchette mise à jour : 3 à 5 répétitions/.test(avis()), 'appliquer : tractions à 3 à 5');
    clic('[data-action="calibrage"][data-ex="abdos"][data-ok="0"]');
    verifier(exo('abdos').reps === undefined && exo('abdos').calibre === 'n0' && !/Je te propose/.test(texte()), 'garder : crunchs à 12 à 20, plus de proposition');
    clic('[data-action="aller"][data-ecran="survivant"]');
    verifier(d.querySelector('#f-reps-chinup').value === '3-5' && d.querySelector('#f-reps-abdos').value === '12-20', 'le programme reflète les réponses');
    // Nouvel échelon choisi à la main : il sera calibré à sa prochaine séance
    const sel = d.querySelector('#f-prog-abdos'); sel.value = 'n1'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    verifier(exo('abdos').niveau === 1 && exo('abdos').calibre === 'n0', 'roulette partielle : à calibrer');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
