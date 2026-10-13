// Essai : le site installable (docs/index.html), hors de Claude.
// Partie sur le téléphone seulement, copie avec photos (téléchargement ou feuille de partage), restauration dès l'inscription,
// ménage des photos orphelines, bandeau de mise à jour, et pas de rapport d'Ida.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
vc.on('error', m => erreurs.push(String(m)));

const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const auj = jour(0), avant = jour(-14), debut = jour(-30);
const pause = ms => new Promise(r => setTimeout(r, ms));
function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg); console.log('ok  ' + msg); }

function profil(photos) {
  return { v: 10, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 45 },
    survivants: [{ nom: 'Testeuse', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20],
    programme: [{ id: 'curl', actif: true, series: 3, charge: 8 }, { id: 'pompes', actif: true, series: 3, niveau: 1 }],
    priorites: [], pauses: [], morts: [], rappelPesee: 'jamais', annonces: [], rapports: [],
    mesures: [{ id: 'm0', date: avant, bras: 31 }, { id: 'm1', date: auj, bras: 31.5 }], pesees: [], photos };
}
const INDEX = [{ id: avant + '-face', date: avant, angle: 'face' }, { id: auj + '-face', date: auj, angle: 'face' }, { id: auj + '-dos', date: auj, angle: 'dos' }];
const V = require('../../src/engine.js');
const SEANCES = [[avant, 'Le silo'], [auj, 'La gare']].reduce((l, [date, lieu]) => l.concat([Object.assign({ id: 's' + (l.length + 1), date, debut: date + 'T18:00:00', minutes: 45, effort: 7, genre: 'expedition', lieu, exercices: [] }, V.faitsSeance(profil(INDEX), l, date, 'expedition'))]), []);
function copie(v, avecPhotos) {
  const c = { app: 'valgrise', v, profil: profil(INDEX), seances: SEANCES };
  if (avecPhotos) c.photos = { [INDEX[0].id]: PNG_A, [INDEX[1].id]: PNG_B, [INDEX[2].id]: PNG_A, intrus: 'javascript:alert(1)' };
  return JSON.stringify(c);
}

function ouvrir(idb, initial, prepa) {
  const dom = new JSDOM(page, {
    url: 'https://exemple.test/valgrise/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.indexedDB = idb;
      if (initial) w.localStorage.setItem('valgrise:v1', JSON.stringify(initial));
      if (prepa) prepa(w);
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
    choisirFichier(texte, nom) {
      const el = d.getElementById('f-restaurer');
      if (!el) throw new Error('Pas de champ de restauration');
      Object.defineProperty(el, 'files', { configurable: true, value: [new w.File([texte], nom || 'copie.json', { type: 'application/json' })] });
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
    },
    stocke: () => JSON.parse(w.localStorage.getItem('valgrise:v1')),
    lireBlob: b => new Promise((ok, ko) => { const r = new w.FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsText(b); })
  };
}
function cles(idb) {
  return new Promise((ok, ko) => {
    const r = idb.open('valgrise-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => {
      const tx = r.result.transaction('photos', 'readonly'), q = tx.objectStore('photos').getAllKeys();
      tx.oncomplete = () => { r.result.close(); ok(q.result.map(String).sort()); };
      tx.onerror = () => ko(tx.error);
    };
    r.onerror = () => ko(r.error);
  });
}
function semer(idb, entrees) {
  return new Promise((ok, ko) => {
    const r = idb.open('valgrise-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => {
      const tx = r.result.transaction('photos', 'readwrite');
      entrees.forEach(([k, v]) => tx.objectStore('photos').put(v, k));
      tx.oncomplete = () => { r.result.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
    r.onerror = () => ko(r.error);
  });
}

(async () => {
  // 1. La page elle-même : installable, polices locales, rien chez Google
  verifier(/<!doctype html>/i.test(page) && /<html lang="fr">/.test(page), 'document complet, en français');
  verifier(/viewport-fit=cover/.test(page) && /apple-mobile-web-app-capable/.test(page) && /rel="apple-touch-icon"/.test(page) && /rel="manifest"/.test(page), 'écran d’accueil : viewport, icône, manifeste');
  verifier(!/googleapis|gstatic/.test(page) && /polices\/archivo-latin-wdth-normal\.woff2/.test(page), 'polices hébergées avec l’appli, aucun appel à Google');
  verifier(/serviceWorker\.register\('sw\.js'\)/.test(page), 'hors connexion : le service worker est enregistré');

  // 2. Premier lancement sur un nouvel appareil : on reprend sa partie dès l'inscription
  let idb = new IDBFactory();
  let o = ouvrir(idb);
  await pause(80);
  verifier(/Demande de carte d’alimentation/.test(o.texte()) && /Déjà une partie \? Restaurer une copie/.test(o.texte()), 'inscription : lien pour restaurer une copie');
  o.choisirFichier('pas du json');
  await pause(30);
  verifier(/n’est pas une copie de Valgrise/.test(o.avis()), 'un mauvais fichier est refusé');
  o.choisirFichier(copie(2, true));
  await pause(30);
  verifier(/Cette copie devient ta partie : 2 séances, 3 photos\./.test(o.texte()), 'confirmation : 2 séances, 3 photos (l’intrus est écarté)');
  o.clic('[data-action="restaurer-oui"]');
  await pause(150);
  verifier(/Aujourd’hui/.test(o.d.getElementById('onglets').textContent) && o.stocke().profil.survivants[0].nom === 'Testeuse', 'partie reprise, écran du jour');
  verifier(o.stocke().profil.photos.length === 3 && o.stocke().seances.length === 2, 'index des photos et séances enregistrés sur le téléphone');
  verifier(JSON.stringify(await cles(idb)) === JSON.stringify(INDEX.map(x => x.id).sort()), 'les trois photos sont dans le téléphone');
  verifier(/Partie restaurée, avec 3 photos\./.test(o.avis()), 'avis : partie restaurée avec 3 photos');

  // 3. Pas de rapport d'Ida hors de Claude, mais le registre photo reste
  o.clic('[data-action="aller"][data-ecran="survivant"]');
  await pause(120);
  verifier(/Fiche signalétique/.test(o.texte()) && !/Demander le rapport d’Ida/.test(o.texte()) && !/peut les commenter/.test(o.texte()), 'fiche signalétique sans rapport d’Ida');
  verifier(/sur ce téléphone seulement/.test(o.texte()) && /Enregistrer dans Fichiers/.test(o.texte()), 'sauvegarde : téléphone seulement, conseil pour l’iPhone');

  // 4. Copie sur ordinateur : téléchargement classique, photos comprises
  let blob = null, nom = null;
  o.w.URL.createObjectURL = b => { blob = b; return 'blob:valgrise'; };
  o.w.URL.revokeObjectURL = () => {};
  o.w.HTMLAnchorElement.prototype.click = function () { nom = this.download; };
  o.clic('[data-action="exporter"]');
  await pause(120);
  verifier(nom === 'valgrise-copie-' + auj + '.json' && blob, 'téléchargement du fichier ' + nom);
  const exportee = JSON.parse(await o.lireBlob(blob));
  verifier(exportee.v === 2 && exportee.seances.length === 2 && Object.keys(exportee.photos).length === 3 && exportee.photos[INDEX[1].id] === PNG_B, 'la copie contient la partie et les 3 photos');
  verifier(/Copie téléchargée/.test(o.avis()), 'avis : copie téléchargée');

  // 5. Sur iPhone : feuille de partage ; si le geste a expiré, un second appui suffit
  const partages = [];
  let refusSuivant = true;
  o.w.matchMedia = q => ({ matches: q === '(pointer: coarse)', addListener() {}, removeListener() {} });
  Object.defineProperty(o.w.navigator, 'canShare', { configurable: true, value: x => !!(x && x.files && x.files.length) });
  Object.defineProperty(o.w.navigator, 'share', { configurable: true, value: x => {
    partages.push(x.files[0].name);
    if (refusSuivant) { refusSuivant = false; return Promise.reject(new o.w.DOMException('geste expiré', 'NotAllowedError')); }
    return Promise.resolve();
  } });
  o.clic('[data-action="exporter"]');
  await pause(120);
  verifier(partages.length === 1 && /Enregistrer la copie \(\d+ Ko\)/.test(o.texte()), 'geste expiré : bouton « Enregistrer la copie » prêt');
  o.clic('[data-action="exporter-copie"]');
  await pause(50);
  verifier(partages.length === 2 && /Copie exportée/.test(o.avis()) && !o.d.querySelector('[data-action="exporter-copie"]'), 'second appui : feuille de partage ouverte');

  // 6. Restaurer par-dessus une partie : les photos de l'ancienne partie partent
  await semer(idb, [['orpheline-face', PNG_A]]);
  o.choisirFichier(copie(2, true));
  await pause(30);
  verifier(/Cette copie remplace toute ta partie actuelle : 2 séances, 3 photos\./.test(o.texte()), 'confirmation de remplacement');
  o.clic('[data-action="restaurer-oui"]');
  await pause(150);
  verifier(!(await cles(idb)).includes('orpheline-face') && (await cles(idb)).length === 3, 'ménage : la photo orpheline est supprimée');

  // 7. Ancienne copie (format 1, sans photos) sur un appareil vide : l'index ne garde que ce qui existe
  idb = new IDBFactory();
  o = ouvrir(idb);
  await pause(60);
  o.choisirFichier(copie(1, false));
  await pause(30);
  verifier(/Cette copie devient ta partie : 2 séances\./.test(o.texte()), 'ancienne copie sans photos acceptée');
  o.clic('[data-action="restaurer-oui"]');
  await pause(150);
  verifier(o.stocke().profil.photos.length === 0 && /3 photos n’étaient pas dans la copie/.test(o.avis()), 'les photos absentes sortent de la fiche, avec un avis');

  // 8. Une nouvelle version arrive : bandeau pour recharger
  o.w.dispatchEvent(new o.w.Event('valgrise:maj'));
  await pause(20);
  verifier(!!o.d.querySelector('.bandeau-maj[data-action="recharger"]') && /Nouvelle version de Valgrise/.test(o.texte()), 'bandeau de mise à jour');

  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
})().catch(e => { console.error(e.message); if (erreurs.length) console.error('Erreurs JS :', erreurs); process.exit(1); });
