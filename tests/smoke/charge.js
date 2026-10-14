// Essai : la charge des exercices à élastiques et haltères.
// 1. Proposition du coach après une séance trop légère : la charge au-dessus, la fourchette en alternative.
// 2. Mise à jour v11 : une proposition de fourchette en attente devient une proposition de charge.
// 3. Pendant la sortie : changer la charge sur la fiche ; les séries d'avant gardent la leur.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const V = require(path.join(__dirname, '..', '..', 'src', 'engine.js'));

const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
vc.on('error', m => erreurs.push(String(m)));
const pause = ms => new Promise(r => setTimeout(r, ms));
function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg); console.log('ok  ' + msg); }
function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const auj = jour(0), debut = jour(-10);

function profil(v, extra) {
  return Object.assign({ v, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 2, 3, 4, 5, 6, 7], minutes: 45 },
    survivants: [{ nom: 'Testeur', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20],
    programme: [{ id: 'developpe', actif: true, series: 3, charge: 25 }, { id: 'curl', actif: false, series: 3, charge: 8 }],
    priorites: [], pauses: [], morts: [], rappelPesee: 'jamais', annonces: [], rapports: [], mesures: [], pesees: [], photos: [] }, extra || {});
}
function ouvrir(p) {
  const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.Date.prototype.getHours = function () { return 14; };
      w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil: p, seances: [] }));
    }
  });
  const w = dom.window, d = w.document;
  return {
    w, d,
    texte: () => d.getElementById('app').textContent.replace(/\s+/g, ' '),
    avis: () => d.getElementById('avis').textContent,
    clic(sel) {
      const el = d.querySelector(sel);
      if (!el) throw new Error('Introuvable : ' + sel + ' | ' + d.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 300));
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    },
    stocke: () => JSON.parse(w.localStorage.getItem('valgrise:v1')),
    reps: () => +d.querySelector('.compteur .chiffre').textContent
  };
}

(async () => {
  // 1. Proposition après une séance trop légère
  const p1 = profil(11);
  const reg25 = V.reglage(p1.programme[0], p1);
  p1.calibrages = [Object.assign({ id: 'developpe', cle: 'charge', reglage: reg25, seance: 's1', series: [20, 20, 18] },
    V.evaluerCalibrage(p1, p1.programme[0], [20, 20, 18]))];
  let o = ouvrir(p1);
  await pause(60);
  verifier(/Développé vertical à l’élastique : 20, 20 et 18 répétitions avec l’élastique de 25 kg \(10 \+ 15\)\. Trop léger : je te propose l’élastique de 30 kg \(10 \+ 20\), pour rester entre 8 et 12\./.test(o.texte()),
    'note du coach : l’élastique de 30 kg, pour rester entre 8 et 12');
  const liens = [...o.d.querySelectorAll('[data-action="calibrage"]')].map(b => b.textContent);
  verifier(JSON.stringify(liens) === JSON.stringify(['Passer à 30 kg', 'Garder 25 kg, viser 15 à 25', 'Ne rien changer']), 'trois choix : ' + liens.join(' · '));
  o.clic('[data-action="calibrage"][data-ok="1"]');
  await pause(30);
  verifier(o.stocke().profil.programme[0].charge === 30 && /Réglage mis à jour : élastique de 30 kg \(10 \+ 20\)\./.test(o.avis()), 'Passer à 30 kg : le programme suit');
  verifier(!/Trop léger/.test(o.texte()), 'la proposition disparaît');

  // 2. Mise à jour v11 : la fourchette en attente devient une charge
  const p2 = profil(10, { calibrages: [{ id: 'developpe', cle: 'charge', reglage: reg25, seance: 's1', series: [20, 20, 18], reps: [15, 25] }] });
  o = ouvrir(p2);
  await pause(60);
  verifier(o.stocke().profil.v === 11 && /je te propose l’élastique de 30 kg/.test(o.texte()) && !/Je te propose 15 à 25/.test(o.texte()), 'partie v10 : la proposition de fourchette devient une proposition de charge');
  o.clic('[data-action="calibrage"][data-ok="alt"]');
  await pause(30);
  verifier(o.stocke().profil.programme[0].charge === 25 && JSON.stringify(o.stocke().profil.programme[0].reps) === '[15,25]' && /Fourchette mise à jour : 15 à 25/.test(o.avis()), 'alternative : 25 kg gardés, 15 à 25 répétitions');

  // 3. Pendant la sortie : la charge change sur la fiche
  const p3 = profil(11);
  p3.programme[0].calibre = 'charge';
  o = ouvrir(p3);
  await pause(60);
  o.clic('[data-action="partir"]');
  await pause(30);
  const boutons = [...o.d.querySelectorAll('[data-action="charge-seance"]')].map(b => b.textContent);
  verifier(JSON.stringify(boutons) === JSON.stringify(['‹ 20 kg', '30 kg (10 + 20) ›']), 'fiche : ' + boutons.join('   '));
  for (let i = 0; i < 6; i++) o.clic('[data-action="plus"]');
  verifier(o.reps() === 14, 'série 1 : 14 répétitions');
  o.clic('[data-action="valider"]');
  await pause(20);
  o.clic('[data-action="charge-seance"][data-sens="1"]');
  await pause(20);
  verifier(/Séries suivantes : 30 kg \(10 \+ 20\)\. Ton programme garde ce réglage\./.test(o.avis()) && o.stocke().profil.programme[0].charge === 30, 'charge passée à 30 kg, programme compris');
  verifier(/Élastique de 30 kg \(10 \+ 20\)/.test(o.texte()) && /14 \(25 kg\)/.test(o.texte()), 'la fiche affiche 30 kg, et la série 1 garde « 14 (25 kg) »');
  const brouillon = JSON.parse(o.w.localStorage.getItem('valgrise:brouillon'));
  verifier(JSON.stringify(brouillon.exos[0].reglagesFaits) === JSON.stringify([reg25]), 'le brouillon retient la charge de chaque série');
  o.clic('[data-action="valider"]');
  await pause(20);
  o.clic('[data-action="valider"]');
  await pause(30);
  verifier(/Fin de sortie/.test(o.texte()), 'fin de sortie');
  o.clic('[data-action="effort"][data-valeur="7"]');
  o.clic('[data-action="enregistrer"]');
  await pause(40);
  const s = o.stocke().seances[0];
  const lignes = s.exercices.map(e => e.reglage + ' : ' + e.series.join(', ') + ' (prévu ' + e.prevu + ')');
  verifier(s.exercices.length === 2 && s.exercices[0].reglage === reg25 && s.exercices[0].prevu === 1 && s.exercices[0].series[0] === 14 &&
    s.exercices[1].reglage === 'Élastique de 30 kg (10 + 20)' && s.exercices[1].prevu === 2 && s.exercices[1].series.length === 2,
    'séance enregistrée en deux lignes : ' + lignes.join(' | '));

  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
})().catch(e => { console.error(e.message); if (erreurs.length) console.error('Erreurs JS :', erreurs); process.exit(1); });
