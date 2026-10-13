// Essai : fiche signalétique. Photos sur ce téléphone (IndexedDB simulée), comparaison à glisser, rapport d'Ida simulé.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { indexedDB } = require('fake-indexeddb');
const page = fs.readFileSync(process.argv[2], 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });

const PNG_A = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_B = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const URL_A = 'data:image/png;base64,' + PNG_A, URL_B = 'data:image/png;base64,' + PNG_B;
function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const auj = jour(0), avant = jour(-14), debut = jour(-30);
const attendre = ms => new Promise(r => setTimeout(r, ms));
function seed(entrees) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('valgrise-photos', 1);
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
function profil(photos) {
  return { v: 10, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
    survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }], elastiques: [5, 10, 15, 20], hauteur: 182, naissance: 1992, sexe: 'homme',
    programme: [{ id: 'curl', actif: true, series: 3, charge: 8 }, { id: 'elevations', actif: false, series: 3, charge: 5 }],
    priorites: ['bras', 'jambes'], pauses: [], morts: [], rappelPesee: 'jamais', annonces: [], rapports: [],
    mesures: [{ id: 'm0', date: avant, bras: 28.4, taille: 81.5, hanches: 89.2 }, { id: 'm1', date: auj, bras: 29, taille: 81, hanches: 90 }],
    pesees: [{ date: auj, kg: 66.5 }], photos };
}
function ouvrir(p, claude) {
  return new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.Date.prototype.getHours = function () { return 14; };
      w.indexedDB = indexedDB;
      if (claude) w.claude = claude(w);
      w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil: p, seances: [] }));
    }
  });
}
function outils(dom) {
  const w = dom.window, d = w.document;
  return {
    w, d,
    texte: () => d.getElementById('app').textContent.replace(/\s+/g, ' '),
    avis: () => d.getElementById('avis').textContent,
    clic: sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel + ' | ' + d.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 300)); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
    stocke: () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil,
    choisirPhoto: (angle, b64) => {
      const input = d.querySelector('#f-photo-' + angle);
      const fichier = w.eval("new File([Uint8Array.from(atob('" + b64 + "'), c => c.charCodeAt(0))], '" + angle + ".png', { type: 'image/png' })");
      Object.defineProperty(input, 'files', { value: [fichier], configurable: true });
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
    }
  };
}
function verifier(c, m, o) { if (!c) { console.error('Échec : ' + m + (o ? ' | ' + o.texte().slice(0, 500) + ' | avis : ' + o.avis() : '')); process.exit(1); } console.log('ok  ' + m); }

(async () => {
  await seed([['ancienne-face', URL_A]]);
  // 1. Sans Claude : registre, ajout d'une photo à la visite du jour, comparaison
  const A = outils(ouvrir(profil([{ id: 'ancienne-face', date: avant, angle: 'face' }])));
  await attendre(150);
  A.clic('[data-action="aller"][data-ecran="survivant"]');
  await attendre(150);
  verifier(A.d.querySelector('#photos .fiche-photos img') && A.d.querySelector('#photos .fiche-photos img').getAttribute('src') === URL_A, 'la fiche signalétique affiche la photo gardée sur le téléphone', A);
  verifier(!A.d.querySelector('#photos .comparateur') && !/Demander le rapport d’Ida/.test(A.texte()), 'une seule photo : pas de comparaison ; sans Claude, pas de rapport', A);
  A.clic('#photos [data-action="visite"]');
  verifier(/Fiche signalétique/.test(A.texte()) && A.d.querySelectorAll('.fiche-photos .cadre-photo').length === 3 && A.d.querySelector('#f-mes-bras').value === '29', 'la visite du jour se rouvre avec trois cadres photo', A);
  A.choisirPhoto('face', PNG_B);
  await attendre(100);
  verifier(A.d.querySelector('label[for="f-photo-face"] img') && A.d.querySelector('label[for="f-photo-face"] img').getAttribute('src') === URL_B, 'la photo choisie apparaît dans son cadre', A);
  A.clic('[data-action="signer-visite"]');
  await attendre(200);
  const p1 = A.stocke();
  verifier(p1.photos.some(x => x.id === auj + '-face' && x.angle === 'face' && x.date === auj) && p1.mesures.length === 2, 'photo rangée dans l’index, visite du jour non dupliquée', A);
  const imgs = Array.from(A.d.querySelectorAll('#photos .comparateur img')).map(i => i.getAttribute('src'));
  verifier(imgs.length === 2 && imgs[0] === URL_A && imgs[1] === URL_B, 'comparaison : la première photo dessous, la dernière par-dessus', A);
  const curseur = A.d.querySelector('#photos .comparateur input[type="range"]');
  curseur.value = '30'; curseur.dispatchEvent(new A.w.Event('input', { bubbles: true }));
  verifier(A.d.querySelector('#photos .comparateur').style.getPropertyValue('--pos') === '30%', 'la barre se fait glisser', A);
  verifier(/Rangée|rangée/.test(A.avis()) || /Visite enregistrée/.test(A.avis()), 'avis d’enregistrement', A);
  // Retirer la photo du jour
  A.clic('#photos [data-action="visite"]');
  await attendre(100);
  A.clic('[data-action="retirer-photo"][data-angle="face"]');
  verifier(/\+ Photo/.test(A.d.querySelector('label[for="f-photo-face"]').textContent), 'retirer vide le cadre', A);
  A.clic('[data-action="signer-visite"]');
  await attendre(200);
  verifier(!A.stocke().photos.some(x => x.id === auj + '-face'), 'la photo retirée quitte l’index', A);

  // 2. Avec un Claude simulé : rapport d'Ida et action sur le programme
  await seed([['ancienne-face', URL_A], ['nouvelle-face', URL_B]]);
  const appels = [];
  const fauxClaude = () => {
    const sample = function () { return Promise.reject({ code: 'invalid_request', message: '' }); };
    sample.limits = () => Promise.resolve({ maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 20000000, mediaTypes: ['image/jpeg', 'image/png'] } });
    sample.json = (texte, opts) => { appels.push({ texte, images: opts.images }); return Promise.resolve({ changements: 'Le haut des bras se dessine.', posture: 'Épaules un peu en avant.', conseils: ['Garde tes tractions.'], actions: [{ type: 'activer', exercice: 'elevations' }, { type: 'activer', exercice: 'inconnu' }], conditions: '' }); };
    return { use: name => Promise.resolve(name === 'sample' ? sample : null) };
  };
  const B = outils(ouvrir(profil([{ id: 'ancienne-face', date: avant, angle: 'face' }, { id: 'nouvelle-face', date: auj, angle: 'face' }]), fauxClaude));
  await attendre(150);
  B.clic('[data-action="aller"][data-ecran="survivant"]');
  await attendre(150);
  verifier(/Demander le rapport d’Ida/.test(B.texte()) && /envoyées à Claude, sur ton compte/.test(B.texte()), 'avec Claude : le rapport se demande, l’envoi est annoncé', B);
  B.clic('[data-action="regard"]');
  await attendre(200);
  verifier(appels.length === 1 && appels[0].images.length === 2 && appels[0].images.every(b => b.type === 'image/png'), 'Claude reçoit les deux photos du face-à-face', B);
  verifier(/Image 1 : face, .*première photo\.\nImage 2 : face, .*dernière photo\./.test(appels[0].texte) && /sans conseil de régime/.test(appels[0].texte), 'la consigne annonce les images et les règles', B);
  verifier(/Le haut des bras se dessine\./.test(B.texte()) && /Épaules un peu en avant\./.test(B.texte()) && B.d.querySelector('#photos svg.tampon[aria-label="Tampon : changements"]'), 'le rapport tamponné s’affiche', B);
  verifier(/Ida propose : ajouter élévations latérales à l’élastique\./.test(B.texte()), 'seule l’action possible est proposée', B);
  B.clic('[data-action="appliquer-regard"]');
  verifier(B.stocke().programme.find(e => e.id === 'elevations').actif === true && /Programme mis à jour : ajouter élévations latérales à l’élastique/.test(B.avis()), 'appliquer ajoute les élévations latérales au programme', B);
  verifier(!/Ida propose/.test(B.texte()) && B.stocke().rapports.length === 1 && B.stocke().rapports[0].appliquees === true, 'la proposition est rangée une fois appliquée', B);
  verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  process.exit(0);
})().catch(e => { console.error(e && e.message || e, erreurs); process.exit(1); });
