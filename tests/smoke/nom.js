// Essai : le nom du survivant. Obligatoire à l'inscription (plus de nom d'exemple pris en silence),
// et corrigeable au crayon sur la carte d'alimentation.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
vc.on('error', m => erreurs.push(String(m)));
const pause = ms => new Promise(r => setTimeout(r, ms));
function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg); console.log('ok  ' + msg); }

(async () => {
  const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.Date.prototype.getHours = function () { return 8; };   // le matin : la pesée du jour est proposée sur l'accueil
    }
  });
  const w = dom.window, d = w.document;
  const texte = () => d.getElementById('app').textContent.replace(/\s+/g, ' ');
  const avis = () => d.getElementById('avis').textContent;
  const clic = sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + texte().slice(0, 200)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  function saisir(sel, val) { const el = d.querySelector(sel); el.value = val; el.dispatchEvent(new w.Event('input', { bubbles: true })); }
  const stocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1') || 'null');
  await pause(60);

  // Inscription : le champ est vide pour de vrai, l'exemple est écrit dessous
  const champ = d.getElementById('f-nom');
  verifier(champ && champ.value === '' && !champ.getAttribute('placeholder'), 'le champ du nom est vide, sans exemple écrit dedans');
  verifier(/Par exemple : Aubin, Jo, Maëlle\./.test(texte()), 'l’exemple est écrit sous le champ');
  clic('[data-action="inscrire"]');
  await pause(20);
  verifier(stocke() === null, 'sans nom, pas de carte : la demande est refusée');
  verifier(/Ton survivant a besoin d’un nom : écris-le en haut, sur la carte\./.test(texte()) && d.querySelector('#aide-nom.alerte'), 'message près du bouton et sous le champ');
  verifier(d.activeElement && d.activeElement.id === 'f-nom', 'le curseur revient dans le champ du nom');
  saisir('#f-nom', '   ');
  clic('[data-action="inscrire"]');
  await pause(20);
  verifier(stocke() === null, 'des espaces ne font pas un nom');
  saisir('#f-nom', '  Maël ');
  clic('[data-action="inscrire"]');
  await pause(40);
  verifier(stocke() && stocke().profil.survivants[0].nom === 'Maël', 'avec un nom, la carte est faite au nom de Maël');
  verifier(/Maël arrive à la Sucrerie/.test(avis()), 'avis d’arrivée au bon nom');

  // Sur la carte : Renommer, puis Valider
  const titulaire = () => { const el = d.querySelector('dd.titulaire > span'); return el ? el.textContent : null; };
  verifier(titulaire() === 'Maël' && d.querySelector('dd.titulaire [data-action="renommer"]'), 'carte : le titulaire et le lien Renommer');
  saisir('#f-kg-matin', '70,2');   // une pesée en cours de saisie ne doit pas se perdre
  clic('[data-action="renommer"]');
  await pause(20);
  const nouveau = d.getElementById('f-renommer');
  verifier(nouveau && nouveau.value === 'Maël' && d.activeElement === nouveau, 'le nom passe en saisie, prérempli, curseur dedans');
  saisir('#f-renommer', '');
  clic('[data-action="renommer-ok"]');
  await pause(20);
  verifier(d.getElementById('f-renommer') && /a besoin d’un nom/.test(avis()) && stocke().profil.survivants[0].nom === 'Maël', 'nom vide refusé, la saisie reste ouverte');
  saisir('#f-renommer', 'Jo');
  clic('[data-action="renommer-annuler"]');
  await pause(20);
  verifier(!d.getElementById('f-renommer') && stocke().profil.survivants[0].nom === 'Maël' && titulaire() === 'Maël', 'Annuler garde l’ancien nom');
  clic('[data-action="renommer"]');
  await pause(20);
  saisir('#f-renommer', '  Joachim ');
  d.getElementById('f-renommer').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await pause(30);
  verifier(stocke().profil.survivants[0].nom === 'Joachim' && titulaire() === 'Joachim', 'Entrée valide : la carte est au nom de Joachim');
  verifier(/Maël s’appelle désormais Joachim\./.test(avis()), 'avis : Maël s’appelle désormais Joachim');
  verifier(d.getElementById('f-kg-matin') && d.getElementById('f-kg-matin').value === '70,2', 'la pesée en cours de saisie est restée');
  clic('[data-action="aller"][data-ecran="survivant"]');
  await pause(40);
  verifier(/Joachim/.test(d.querySelector('[aria-label="Fiche du survivant"]').textContent), 'la fiche du survivant suit');

  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
})().catch(e => { console.error(e.message); if (erreurs.length) console.error('Erreurs JS :', erreurs); process.exit(1); });
