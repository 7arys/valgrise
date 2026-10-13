// Essai fonctionnel : parcours complet du prototype dans un DOM simulé.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
vc.on('error', m => erreurs.push(String(m)));

const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
  url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.scrollTo = () => {}; w.Date.prototype.getHours = function () { return 14; }; }
});
const w = dom.window, d = w.document;
const pause = ms => new Promise(r => setTimeout(r, ms));
const app = () => d.getElementById('app');
const texte = () => app().textContent.replace(/\s+/g, ' ');
function clic(sel) {
  const el = d.querySelector(sel);
  if (!el) throw new Error('Introuvable : ' + sel + ' | écran : ' + texte().slice(0, 120));
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
}
function saisir(sel, val, evt) {
  const el = d.querySelector(sel);
  if (!el) throw new Error('Champ introuvable : ' + sel);
  el.value = val;
  el.dispatchEvent(new w.Event(evt || 'input', { bubbles: true }));
}
function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg + ' | écran : ' + texte().slice(0, 300)); console.log('ok  ' + msg); }

(async () => {
  await pause(50);
  verifier(/Demande de carte/.test(texte()), 'écran d’inscription au premier lancement');
  saisir('#f-nom', 'Testeur');
  clic('[data-action="jour"][data-jour="4"]'); // retire jeudi
  clic('[data-action="inscrire"]');
  verifier(/au moins deux jours/.test(texte()), 'refuse un plan d’un seul jour');
  clic('[data-action="jour"][data-jour="4"]');
  clic('[data-action="prio-inscription"][data-groupe="bras"]');
  clic('[data-action="prio-inscription"][data-groupe="abdos"]');
  verifier(d.querySelector('#f-chinup').checked && d.querySelector('#f-triceps').checked && d.querySelector('#f-releves').checked, 'bras et abdos cochent tractions, extension triceps et relevés');
  verifier(!!d.querySelector('#f-chinupNiveau') && !!d.querySelector('#f-tricepsCharge') && !!d.querySelector('#f-relevesNiveau'), 'leurs réglages s’affichent');
  const tri = d.querySelector('#f-tricepsCharge');
  verifier(tri.tagName === 'SELECT' && tri.value === '10' && /Élastique de 10 kg/.test(tri.selectedOptions[0].textContent), 'l’extension triceps se règle à l’élastique, 10 kg au départ');
  clic('[data-action="prio-inscription"][data-groupe="jambes"]');
  verifier(d.querySelectorAll('.groupes [aria-pressed="true"]').length === 2, 'deux priorités au plus');
  const sq = d.querySelector('#f-squat');
  verifier(sq && sq.tagName === 'SELECT' && sq.selectedOptions[0].textContent === 'Squat sur le banc' && !d.querySelector('#f-hipthrust').checked, 'le squat sur le banc fait partie de la séance de base, le hip thrust est proposé');
  verifier(Array.from(sq.options).map(o => o.textContent).join(' | ') === 'Squat sur le banc | Squat au poids du corps | Squat lent, 3 s à la descente | Squat à l’élastique de 10 kg | Squat à l’élastique de 15 kg | Squat à l’élastique de 20 kg | Squat à l’élastique de 25 kg (10 + 15) | Squat à l’élastique de 30 kg (10 + 20) | Squat à l’élastique de 35 kg (15 + 20) | Squat à l’élastique de 40 kg (5 + 15 + 20) | Squat à l’élastique de 45 kg (10 + 15 + 20)', 'l’échelle du squat : banc, poids du corps, lent, puis les élastiques');
  const ht = d.querySelector('#f-hipthrust'); ht.checked = true; ht.dispatchEvent(new w.Event('change', { bubbles: true }));
  verifier(!!d.querySelector('#f-hipthrustCharge'), 'le hip thrust coché affiche sa charge');
  saisir('#f-minutes', '70');
  clic('[data-action="inscrire"]');
  verifier(/Carte d’alimentation/.test(texte()) && /Testeur/.test(texte()), 'carte d’alimentation créée au nom du survivant');
  verifier(/7\s*jours de vivres/.test(texte()), 'le survivant arrive avec 7 rations');
  verifier(d.querySelectorAll('#onglets .onglet').length === 3, 'trois onglets du classeur');
  verifier(/Priorités : bras et abdos/.test(texte()) && /Environ 69 min/.test(texte()), 'ordre de sortie : priorités bras et abdos, 69 minutes');
  verifier(/Extension triceps à l’élastique/.test(texte()) && /Élastique de 10 kg/.test(texte()) && /Squat sur le banc/.test(texte()) && /Hip thrust à l’haltère/.test(texte()) && !/Goblet/.test(texte()), 'triceps à l’élastique, squat sur le banc et hip thrust dans l’ordre de sortie');
  const noms = Array.from(d.querySelectorAll('.liste-exos li')).map(li => li.firstChild.firstChild.textContent);
  verifier(noms[noms.length - 1] === 'Relevés de genoux' && noms[noms.length - 2] === 'Roulette à genoux', 'les abdos ferment la séance');
  verifier(!/Nouveau : choisis/.test(texte()), 'pas de note sur les priorités pour une nouvelle partie');

  // Visite au dispensaire
  verifier(/Ida veut te voir pour une première visite/.test(texte()), 'convocation à la première visite');
  clic('[data-action="visite"]');
  verifier(/Fiche de visite/.test(texte()), 'fiche de visite ouverte');
  saisir('#f-mes-bras', '35,5');
  clic('[data-action="tuto"]');
  verifier(/Bien se mesurer/.test(texte()) && !!d.querySelector('svg.figure-mesures') && /Tour de hanches/.test(texte()) && /La pesée/.test(texte()), 'la fiche d’Ida s’ouvre avec son illustration');
  clic('[data-action="retour-tuto"]');
  verifier(/Fiche de visite/.test(texte()) && d.querySelector('#f-mes-bras').value === '35,5', 'retour à la fiche de visite, saisie conservée');
  saisir('#f-mes-taille', '84'); saisir('#f-mes-hanches', 'abc');
  clic('[data-action="signer-visite"]');
  verifier(/Tour de hanches : indique une valeur entre 50 et 200 cm/.test(texte()), 'une valeur invalide est refusée');
  saisir('#f-mes-hanches', '96');
  clic('[data-action="signer-visite"]');
  verifier(/Visite enregistrée/.test(d.getElementById('avis').textContent) && /Dossier de l’infirmerie/.test(texte()), 'visite enregistrée, dossier affiché');
  verifier(/35,5/.test(texte()) && /La courbe démarre à la deuxième visite/.test(texte()), 'le relevé apparaît, la courbe attend la deuxième visite');
  const mesures = JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.mesures;
  verifier(mesures.length === 1 && mesures[0].bras === 35.5 && mesures[0].hanches === 96, 'mesures enregistrées en centimètres');
  verifier(/Registre de pesée/.test(texte()) && /Première pesée à noter/.test(texte()), 'registre de pesée vide');
  saisir('#f-kg', '78,4');
  clic('[data-action="noter-pesee"]');
  verifier(/Pesée notée : 78,4 kg/.test(d.getElementById('avis').textContent) && /moyenne sur 7 jours, 1 pesée/.test(texte()), 'pesée notée, moyenne affichée');
  saisir('#f-kg', '7a');
  clic('[data-action="noter-pesee"]');
  verifier(/Indique ton poids en kilos/.test(d.getElementById('avis').textContent), 'un poids invalide est refusé');
  clic('[data-action="rappel"][data-valeur="lundi"]');
  verifier(JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.rappelPesee === 'lundi', 'rappel de pesée réglable');
  clic('[data-action="aller"][data-ecran="accueil"]');
  verifier(!/Ida veut te voir/.test(texte()), 'plus de convocation après la visite');

  clic('[data-action="partir"]');
  verifier(/Exercice 1 sur 9, priorité bras/.test(texte()) && /Tractions assistées, pieds sur une chaise/.test(texte()), 'expédition : les tractions en premier');
  verifier(/Objectif : 4 séries de 5 à 8/.test(texte()), 'les tractions gardent 4 séries');
  clic('[data-action="plus"]'); clic('[data-action="plus"]');
  verifier(/7/.test(d.querySelector('.compteur .chiffre').textContent), 'le compteur monte à 7');
  clic('[data-action="valider"]');
  verifier(!!d.querySelector('[data-live="repos"]'), 'un repos démarre après la série');
  clic('[data-action="passer-repos"]');
  clic('[data-action="valider"]'); clic('[data-action="valider"]'); clic('[data-action="valider"]');
  verifier(/Exercice 2 sur 9, priorité bras/.test(texte()) && /Curl biceps aux haltères/.test(texte()), 'puis le curl, après 4 séries');
  verifier(/Objectif : 4 séries de 8 à 12/.test(texte()), 'à 70 minutes, le curl garde ses 4 séries');
  clic('[data-action="passer-exo"]');
  verifier(/Exercice 3 sur 9/.test(texte()) && /Extension triceps à l’élastique/.test(texte()) && /Élastique de 10 kg/.test(texte()) && /Objectif : 4 séries de 10 à 15/.test(texte()), 'extension triceps : élastique de 10 kg, 10 à 15 répétitions');
  clic('[data-action="passer-exo"]');
  verifier(/Exercice 4 sur 9/.test(texte()) && d.querySelector('.titre-exo').textContent === 'Squat sur le banc' && /Squat, échelon 1 sur 11/.test(texte()), 'squat sur le banc, échelon 1 sur 11, sans titre en double');
  verifier(/Objectif : 3 séries de 12 à 20/.test(texte()) && d.querySelector('.compteur .chiffre').textContent === '12', 'squat : 12 à 20 répétitions, le compteur part de 12');
  clic('[data-action="abandon"]');
  verifier(/Abandonner la sortie/.test(texte()), 'l’abandon demande confirmation dans la page');
  clic('[data-action="abandon-non"]');
  clic('[data-action="terminer"]');
  verifier(/Fin de sortie/.test(texte()), 'écran de fin de sortie');
  verifier(d.querySelector('[data-action="enregistrer"]').disabled, 'enregistrement bloqué tant que l’effort n’est pas noté');
  saisir('#f-duree', '46');
  clic('[data-action="effort"][data-valeur="7"]');
  clic('[data-action="enregistrer"]');
  verifier(/Bon de pesée/.test(texte()), 'bon de pesée affiché');
  // Une expédition se déplace dans la semaine : la première de la semaine compte toujours comme prévue
  verifier(/386 XP/.test(texte()) && /Majoration, sortie prévue/.test(texte()), 'XP nette correcte (386, première expédition de la semaine, quel que soit le jour)');
  verifier(/Tickets délivrés/.test(texte()), 'tickets délivrés indiqués');

  clic('[data-action="aller"][data-ecran="accueil"]');
  clic('[data-action="aller"][data-ecran="carnet"]');
  verifier(d.querySelectorAll('.rang-carnet').length === 1, 'la sortie apparaît au carnet');
  clic('.rang-carnet');
  verifier(/Bon de pesée/.test(texte()), 'le carnet rouvre le bon de pesée');

  clic('[data-action="aller"][data-ecran="accueil"]');
  clic('[data-action="aller"][data-ecran="survivant"]');
  verifier(/Pause/.test(texte()) && /Mon programme/.test(texte()) && /Mes priorités/.test(texte()), 'fiche du survivant complète');
  verifier(d.querySelectorAll('#priorites .groupes [aria-pressed="true"]').length === 2 && /environ 69 min, pour 70 visées/.test(texte()), 'priorités et durée estimée affichées');
  clic('[data-action="malade"]');
  verifier(/Malade ou blessé depuis/.test(texte()), 'pause maladie enregistrée');
  clic('[data-action="aller"][data-ecran="accueil"]');
  verifier(/À l’abri/.test(texte()), 'la carte indique que le survivant est à l’abri');
  clic('[data-action="aller"][data-ecran="survivant"]');
  clic('[data-action="reprendre-pause"]');
  verifier(!/Malade ou blessé depuis le/.test(texte()), 'reprise après la pause');
  // Répétitions réglées par le joueur
  const repsCurl = d.querySelector('#f-reps-curl');
  verifier(repsCurl && repsCurl.selectedOptions[0].textContent === '8 à 12, conseil du coach', 'le curl propose la fourchette du coach');
  repsCurl.value = '5-8'; repsCurl.dispatchEvent(new w.Event('change', { bubbles: true }));
  const curlStocke = () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.programme.find(e => e.id === 'curl');
  verifier(JSON.stringify(curlStocke().reps) === '[5,8]' && d.querySelector('#f-reps-curl').value === '5-8', 'le joueur passe le curl à 5 à 8 répétitions');
  verifier(/Curl biceps aux haltères : 5 à 8 répétitions par série/.test(d.getElementById('avis').textContent), 'l’avis confirme la nouvelle fourchette');
  const repsCurl2 = d.querySelector('#f-reps-curl'); repsCurl2.value = '8-12'; repsCurl2.dispatchEvent(new w.Event('change', { bubbles: true }));
  verifier(curlStocke().reps === undefined, 'revenir au conseil du coach efface la fourchette choisie');
  // Mes élastiques
  verifier(/Mes élastiques/.test(texte()) && /Résistances possibles : 5, 10, 15, 20, 25, 30, 35, 40, 45 kg/.test(texte()), 'les élastiques du kit et leurs combinaisons');
  saisir('#f-elastique', 'abc');
  clic('[data-action="ajouter-elastique"]');
  verifier(/Indique la résistance de l’élastique en kilos/.test(d.getElementById('avis').textContent), 'une résistance invalide est refusée');
  saisir('#f-elastique', '25');
  clic('[data-action="ajouter-elastique"]');
  verifier(JSON.stringify(JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.elastiques) === '[5,10,15,20,25]' && /Résistances possibles : 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60 kg/.test(texte()), 'un élastique de 25 kg ajouté, jusqu’à 60 kg combinés');
  clic('[data-action="retirer-elastique"][data-kg="25"]');
  verifier(JSON.stringify(JSON.parse(w.localStorage.getItem('valgrise:v1')).profil.elastiques) === '[5,10,15,20]', 'et retiré');
  // retirer les relevés du programme
  const cb = d.querySelector('#f-actif-releves'); cb.checked = false; cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  verifier(!d.querySelector('#f-prog-releves'), 'un exercice se retire du programme');

  clic('[data-action="aller"][data-ecran="accueil"]');
  clic('[data-action="libre"]');
  saisir('#f-quoi', 'Marche'); saisir('#f-duree-libre', '30');
  clic('[data-action="effort"][data-valeur="4"]');
  clic('[data-action="enregistrer-libre"]');
  verifier(/Aucun : une seule séance par jour/.test(texte()), 'deuxième séance du jour : pas de vivres');
  verifier(/÷ 2/.test(texte()), 'deuxième séance du jour : XP divisée par deux');

  const sauvegarde = JSON.parse(w.localStorage.getItem('valgrise:v1'));
  verifier(sauvegarde && sauvegarde.seances.length === 2, 'partie enregistrée sur l’appareil (2 séances)');
  const tractions = sauvegarde.seances.find(s => s.genre === 'expedition').exercices.find(e => e.id === 'chinup');
  verifier(tractions && tractions.prevu === 4 && tractions.series.length === 4, 'la séance garde les 4 séries prévues des tractions');

  // Rechargement : la partie revient
  const dom2 = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w2) { w2.scrollTo = () => {}; w2.localStorage.setItem('valgrise:v1', JSON.stringify(sauvegarde)); }
  });
  await pause(50);
  verifier(/Testeur/.test(dom2.window.document.getElementById('app').textContent), 'la partie se recharge');

  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  console.log('\nParcours complet sans erreur.');
  process.exit(0);
})().catch(e => { console.error(e.message); if (erreurs.length) console.error('Erreurs JS :', erreurs); process.exit(1); });
