// Essai : dans Claude, la copie passe par la capacité « downloads » et contient aussi les photos.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const auj = jour(0), debut = jour(-20);
const pause = ms => new Promise(r => setTimeout(r, ms));
function verifier(cond, msg) { if (!cond) throw new Error('Échec : ' + msg); console.log('ok  ' + msg); }

(async () => {
  const idb = new IDBFactory();
  await new Promise((ok, ko) => {
    const r = idb.open('valgrise-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => { const tx = r.result.transaction('photos', 'readwrite'); tx.objectStore('photos').put(PNG, auj + '-face'); tx.oncomplete = () => { r.result.close(); ok(); }; };
    r.onerror = () => ko(r.error);
  });
  const profil = { v: 10, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 45 },
    survivants: [{ nom: 'Testeur', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20],
    programme: [{ id: 'curl', actif: true, series: 3, charge: 8 }], priorites: [], pauses: [], morts: [], rappelPesee: 'jamais',
    annonces: [], rapports: [], mesures: [{ id: 'm1', date: auj, bras: 31 }], pesees: [], photos: [{ id: auj + '-face', date: auj, angle: 'face' }] };
  const enregistre = [];
  let reponse = 'ok';
  const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.indexedDB = idb;
      w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] }));
      const downloads = { save: r => { enregistre.push(r); return reponse === 'ok' ? Promise.resolve({ status: 'saved' }) : Promise.reject({ code: reponse }); } };
      w.claude = { use: name => Promise.resolve(name === 'downloads' ? downloads : null) };
    }
  });
  const w = dom.window, d = w.document;
  const clic = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const avis = () => d.getElementById('avis').textContent;
  await pause(80);
  clic('[data-action="aller"][data-ecran="survivant"]');
  await pause(80);
  verifier(!/Enregistrer dans Fichiers/.test(d.getElementById('app').textContent), 'pas de conseil iPhone dans Claude (la capacité s’en charge)');
  clic('[data-action="exporter"]');
  await pause(80);
  verifier(enregistre.length === 1 && enregistre[0].filename === 'valgrise-copie-' + auj + '.json' && enregistre[0].data instanceof w.Blob, 'downloads.save reçoit un fichier .json');
  const texte = await new Promise(ok => { const r = new w.FileReader(); r.onload = () => ok(r.result); r.readAsText(enregistre[0].data); });
  const c = JSON.parse(texte);
  verifier(c.v === 2 && c.photos[auj + '-face'] === PNG && c.profil.survivants[0].nom === 'Testeur', 'la copie contient la photo du jour');
  verifier(/Copie téléchargée/.test(avis()), 'avis : copie téléchargée');
  reponse = 'declined';
  w.document.getElementById('avis').innerHTML = '';
  clic('[data-action="exporter"]');
  await pause(80);
  verifier(enregistre.length === 2 && avis() === '', 'refus du téléchargement : rien à signaler');
  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
})().catch(e => { console.error(e.message); if (erreurs.length) console.error('Erreurs JS :', erreurs); process.exit(1); });
