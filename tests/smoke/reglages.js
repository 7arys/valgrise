// Essai : une partie v6 (squat au poids du corps) passe en v10 ; le joueur baisse ses répétitions et complète ses élastiques.
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
  v: 6, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }],
  programme: [
    { id: 'pompes', actif: true, series: 3, niveau: 0 }, { id: 'developpe', actif: true, series: 3, charge: 10 },
    { id: 'curl', actif: true, series: 3, charge: 8 }, { id: 'triceps', actif: true, series: 3, charge: 10 },
    { id: 'chinup', actif: true, series: 3, niveau: 0 }, { id: 'abdos', actif: true, series: 3, niveau: 0 },
    { id: 'releves', actif: false, series: 3, niveau: 0 }, { id: 'rowing', actif: false, series: 3, charge: 15 },
    { id: 'squat', actif: true, series: 3, niveau: 0 }, { id: 'hipthrust', actif: true, series: 3, charge: 10 }
  ],
  priorites: ['bras', 'jambes'], pauses: [], morts: [], mesures: [{ id: 'm', date: jour(-2), bras: 35, taille: 85, hanches: 96 }],
  pesees: [], rappelPesee: 'jamais'
};
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () { w.__ancre = this.id; }; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const avis = () => d.getElementById('avis').textContent;
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const choisir = (sel, v) => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const saisir = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 400) + ' | avis : ' + avis()); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil;
const exo = id => stocke().programme.find(e => e.id === id);

setTimeout(() => {
  try {
    verifier(stocke().v === 11 && exo('squat').niveau === 1 && JSON.stringify(stocke().elastiques) === '[5,10,15,20]', 'partie v6 passée en v11 : squat au poids du corps conservé, kit d’élastiques enregistré');
    verifier(/Nouveau : tu règles toi-même le nombre de répétitions/.test(texte()) && /t’asseoir sur ton banc/.test(texte()), 'le coach annonce les nouveaux réglages');
    clic('[data-action="voir-reglages"]');
    verifier(/Mon programme/.test(texte()) && w.__ancre === 'programme' && JSON.stringify(stocke().annonces) === '["calibrage","bilan","photos"]', 'le lien ouvre le programme et range la note');

    // Le joueur baisse ses répétitions et ses charges
    choisir('#f-prog-squat', 'n0');
    verifier(exo('squat').niveau === 0, 'squat sur le banc');
    choisir('#f-reps-squat', '6-10');
    choisir('#f-reps-abdos', '8-12');
    choisir('#f-prog-triceps', 'k5');
    choisir('#f-reps-triceps', '8-12');
    choisir('#f-prog-curl', '5');
    verifier(JSON.stringify(exo('squat').reps) === '[6,10]' && JSON.stringify(exo('abdos').reps) === '[8,12]' && exo('triceps').charge === 5 && exo('curl').charge === 5, 'fourchettes et charges baissées');
    verifier(d.querySelector('#f-reps-squat').selectedOptions[0].textContent === '6 à 10' && /12 à 20, conseil du coach/.test(d.querySelector('#f-reps-squat').textContent), 'le conseil du coach reste visible dans la liste');

    clic('[data-action="aller"][data-ecran="accueil"]');
    clic('[data-action="partir"]');
    let garde = 0;
    while (d.querySelector('.titre-exo') && d.querySelector('.titre-exo').textContent !== 'Squat sur le banc' && garde++ < 12) clic('[data-action="passer-exo"]');
    verifier(/Objectif : 4 séries de 6 à 10/.test(texte()) && d.querySelector('.compteur .chiffre').textContent === '6' && /Squat, échelon 1 sur 11/.test(texte()), 'la fiche de sortie suit la fourchette choisie : 6 à 10, le compteur part de 6');
    clic('[data-action="abandon"]'); clic('[data-action="abandon-oui"]');

    // Compléter les élastiques
    clic('[data-action="aller"][data-ecran="survivant"]');
    choisir('#f-prog-squat', 'k25');
    verifier(exo('squat').niveau === 3 && exo('squat').charge === 25 && /Squat à l’élastique de 25 kg \(10 \+ 15\)/.test(d.querySelector('#f-prog-squat').selectedOptions[0].textContent), 'squat à 25 kg, en combinant 10 et 15');
    saisir('#f-elastique', '25');
    clic('[data-action="ajouter-elastique"]');
    verifier(d.querySelector('#f-prog-squat').selectedOptions[0].textContent === 'Squat à l’élastique de 25 kg', 'avec un élastique de 25 kg, plus besoin de combiner');
    saisir('#f-elastique', '2,5');
    clic('[data-action="ajouter-elastique"]');
    verifier(JSON.stringify(stocke().elastiques) === '[2.5,5,10,15,20,25]' && /2,5 kg/.test(d.querySelector('.liste-elastiques').textContent) && /Élastique de 7,5 kg \(2,5 \+ 5\)/.test(d.querySelector('#f-prog-triceps').textContent), 'un élastique de 2,5 kg ouvre des paliers intermédiaires');
    ['25', '2.5', '20', '15'].forEach(kg => clic('[data-action="retirer-elastique"][data-kg="' + kg + '"]'));
    verifier(JSON.stringify(stocke().elastiques) === '[5,10]' && exo('squat').charge === 15 && exo('developpe').charge === 10, 'sans les 15 et 20 kg, le squat redescend à 15 kg (5 + 10)');
    verifier(/Réglages revus : squat à l’élastique de 15 kg \(5 \+ 10\)/.test(avis()), 'l’avis explique le réglage revu');
    clic('[data-action="retirer-elastique"][data-kg="10"]');
    verifier(exo('squat').niveau === 2 && exo('squat').charge === undefined && exo('developpe').charge === 5 && !d.querySelector('[data-action="retirer-elastique"]'), 'avec un seul élastique de 5 kg : squat lent, développé à 5 kg, le dernier élastique reste');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
