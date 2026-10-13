// Essai : une partie telle que la v5 l'enregistre (goblet squat et triceps à l'haltère) passe en v10.
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
  v: 5, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }],
  programme: [
    { id: 'pompes', actif: true, series: 3, niveau: 1 },
    { id: 'developpe', actif: true, series: 3, charge: 10 },
    { id: 'curl', actif: true, series: 3, charge: 8 },
    { id: 'triceps', actif: true, series: 3, charge: 8 },
    { id: 'chinup', actif: true, series: 3, niveau: 0 },
    { id: 'abdos', actif: true, series: 3, niveau: 0 },
    { id: 'releves', actif: false, series: 3, niveau: 0 },
    { id: 'rowing', actif: false, series: 3, charge: 15 },
    { id: 'squat', actif: true, series: 3, charge: 12 },
    { id: 'hipthrust', actif: true, series: 3, charge: 10 }
  ],
  priorites: ['bras', 'jambes'], pauses: [], morts: [], mesures: [{ id: 'm', date: jour(-2), bras: 35, taille: 85, hanches: 96 }],
  pesees: [], rappelPesee: 'jamais'
};
// Une sortie faite avec l'ancien goblet squat : l'historique garde son nom
const seances = [{ id: 'a1', date: jour(-3), debut: jour(-3) + 'T18:00:00', minutes: 65, effort: 7, genre: 'expedition', lieu: 'La gare de triage',
  prevue: true, rationsBase: 4, cibleSemaine: 2, exercices: [{ id: 'squat', nom: 'Goblet squat', reglage: 'Un haltère de 12 kg', prevu: 4, series: [12, 12, 12, 12] }] }];
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 400)); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1'));

setTimeout(() => {
  try {
    const p = stocke().profil;
    const squat = p.programme.find(e => e.id === 'squat'), triceps = p.programme.find(e => e.id === 'triceps'), ht = p.programme.find(e => e.id === 'hipthrust');
    verifier(p.v === 10 && squat.niveau === 1 && squat.charge === undefined && triceps.charge === 10 && ht.charge === 10, 'partie passée en v10 : squat au poids du corps, triceps à 10 kg d’élastique, hip thrust intact');
    verifier(/J’ai suivi ton choix : le squat repart au poids du corps, puis passera aux élastiques quand il deviendra trop facile ; l’extension triceps se fait à l’élastique de 10 kg\./.test(texte()), 'le coach annonce le changement de matériel');
    verifier(/Squat au poids du corps/.test(texte()) && /Extension triceps à l’élastique/.test(texte()) && !/Goblet/.test(texte()), 'l’ordre de sortie suit le nouveau matériel');
    verifier(/Priorités : bras et jambes, fessiers/.test(texte()), 'les priorités sont conservées');
    clic('[data-action="annonce-lue"][data-id="elastiques"]');
    verifier(!/J’ai suivi ton choix/.test(texte()) && JSON.stringify(stocke().profil.annonces) === '["reglages","calibrage","bilan","photos"]', 'la note disparaît une fois lue');
    clic('[data-action="aller"][data-ecran="survivant"]');
    const sel = d.querySelector('#f-prog-squat');
    verifier(sel && sel.tagName === 'SELECT' && sel.value === 'n1', 'le programme règle le squat par échelon');
    verifier(d.querySelector('#f-reps-squat').value === '12-20', 'fourchette du squat : 12 à 20');
    verifier(d.querySelector('#f-reps-abdos').value === '12-20', 'les crunchs se comptent par 12 à 20');
    const st = d.querySelector('#f-prog-triceps');
    verifier(st.tagName === 'SELECT' && st.value === 'k10' && d.querySelector('#f-reps-triceps').value === '10-15', 'le triceps se règle à l’élastique, 10 à 15 répétitions');
    sel.value = 'k10'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    const sq2 = stocke().profil.programme.find(e => e.id === 'squat');
    verifier(sq2.niveau === 3 && sq2.charge === 10, 'passer le squat à l’élastique de 10 kg à la main');
    const abdos = d.querySelector('#f-prog-abdos'); abdos.value = 'n1'; abdos.dispatchEvent(new w.Event('change', { bubbles: true }));
    verifier(d.querySelector('#f-reps-abdos').value === '6-10' && /6 à 10, conseil du coach/.test(d.querySelector('#f-reps-abdos').selectedOptions[0].textContent), 'la roulette se compte par 6 à 10');
    const ancienne = stocke().seances.find(x => x.id === 'a1').exercices[0];
    verifier(ancienne.nom === 'Goblet squat' && ancienne.reglage === 'Un haltère de 12 kg', 'l’ancienne sortie garde son goblet squat dans l’historique');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
