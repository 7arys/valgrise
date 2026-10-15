// Essai : bilan d'Ida. Partie v8 avec la visite et la pesée de ce matin ; fiche d'admission, masse grasse, correction de l'âge.
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
const debut = jour(-10), auj = jour(0);
const profil = {
  v: 8, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20],
  programme: [{ id: 'curl', actif: true, series: 3, charge: 8 }], priorites: [], pauses: [], morts: [],
  mesures: [{ id: 'm1', date: auj, bras: 29, taille: 81, hanches: 90 }], pesees: [{ date: auj, kg: 66.5 }], rappelPesee: 'jamais', annonces: []
};
const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () { w.__ancre = this.id; }; w.Date.prototype.getHours = function () { return 14; }; w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] })); }
});
const w = dom.window, d = w.document;
const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
const avis = () => d.getElementById('avis').textContent;
const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const saisir = (sel, v) => { const el = d.querySelector(sel); if (!el) throw new Error('Champ introuvable : ' + sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
function verifier(c, m) { if (!c) { console.error('Échec : ' + m + ' | ' + texte().slice(0, 600) + ' | avis : ' + avis()); process.exit(1); } console.log('ok  ' + m); }
const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil;
const lus = () => Array.from(d.querySelectorAll('#bilan svg.toise')).map(s => s.getAttribute('aria-label'));

setTimeout(() => {
  try {
    verifier(stocke().v === 11 && /Ida fait maintenant un bilan de santé à chaque visite/.test(texte()), 'v9 : le coach invite à voir le bilan');
    clic('[data-action="voir-bilan"]');
    verifier(w.__ancre === 'bilan' && !(stocke().annonces || []).includes('bilan'), 'le lien mène au bilan et range la note');
    verifier(/Pour ton bilan, Ida a besoin de ta taille/.test(texte()) && lus().length === 2, 'fiche d’admission demandée ; bras et hanches déjà suivis');
    saisir('#f-hauteur', 'abc'); saisir('#f-naissance', '1992');
    clic('[data-action="admission"]');
    verifier(/Indique ta taille en centimètres/.test(texte()), 'une taille invalide est refusée');
    saisir('#f-hauteur', '182');
    clic('[data-action="admission"]');
    verifier(/Choisis tes repères : homme ou femme/.test(texte()), 'les repères sont demandés');
    clic('[data-action="sexe"][data-valeur="homme"]');
    clic('[data-action="admission"]');
    const p = stocke();
    verifier(p.hauteur === 182 && p.naissance === 1992 && p.sexe === 'homme', 'fiche d’admission enregistrée');
    verifier(lus().some(l => l === 'Tour de taille ÷ taille : 0,45, zone sain') && lus().some(l => l === 'Indice de masse corporelle : 20,1, zone sain'), 'toises : 0,45 et 20,1, zone saine');
    verifier(/34 ans · 182 cm · 66,5 kg, moyenne de ta pesée/.test(texte()) && /Note ta masse grasse à la prochaine visite/.test(texte()), 'en-tête du bilan, et invitation à noter la masse grasse');
    verifier(/Ton ventre n’a rien à perdre/.test(texte()), 'la note d’Ida');
    // Refaire la visite du jour pour ajouter la masse grasse
    clic('[data-action="visite"]');
    verifier(d.querySelector('#f-mes-bras').value === '29' && d.querySelector('#f-mes-hanches').value === '90' && !d.querySelector('#f-hauteur'), 'la visite du jour se rouvre préremplie, sans redemander l’admission');
    verifier(/Poids : 66,5 kg, moyenne de ta pesée/.test(texte()), 'le poids vient de la pesée');
    saisir('#f-graisse', '70');
    clic('[data-action="signer-visite"]');
    verifier(/Masse grasse : indique un pourcentage entre 2 et 60/.test(texte()), 'une masse grasse invalide est refusée');
    saisir('#f-graisse', '13,2');
    clic('[data-action="signer-visite"]');
    verifier(stocke().mesures.length === 1 && stocke().mesures[0].graisse === 13.2, 'la visite du jour est complétée, pas dupliquée');
    verifier(lus().some(l => l === 'Masse grasse, selon ta balance : 13,2 %, zone sain') && lus().some(l => /^Indice de masse maigre : 17,4, médiane 18,9/.test(l)), 'masse grasse 13,2 % et indice de masse maigre 17,4');
    verifier(/Repères pour un homme de 20 à 39 ans/.test(texte()), 'repères selon l’âge');
    verifier(lus().some(l => /^Indice de masse maigre : 17,4, médiane 18,9, cible 20/.test(l)) &&
      /Cible 20, silhouette athlétique : encore 8,5 kg de masse maigre, soit environ 76 kg à 13,2 % de graisse\./.test(texte()), 'cible 20 : 8,5 kg de masse maigre à gagner, environ 76 kg');
    verifier(/sans produits, les pratiquants de musculation sont en moyenne vers 22/.test(texte()), 'repère des pratiquants naturels');
    const cible = d.getElementById('f-cible');
    cible.value = '22';
    cible.dispatchEvent(new w.Event('change', { bubbles: true }));
    verifier(stocke().cibleMaigre === 22 && /Cible 22, silhouette très musclée : encore 15,2 kg de masse maigre/.test(texte()) && d.getElementById('f-cible').value === '22', 'cible passée à 22, enregistrée');
    clic('[data-action="modifier-admission"]');
    verifier(d.querySelector('#f-naissance').value === '1992', 'la fiche se corrige, préremplie');
    saisir('#f-naissance', '1980');
    clic('[data-action="admission"]');
    verifier(/Repères pour un homme de 40 à 59 ans/.test(texte()) && /46 ans/.test(texte()), 'à 46 ans, les repères changent');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
    process.exit(0);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
