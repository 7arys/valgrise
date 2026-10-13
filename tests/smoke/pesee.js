// Essai : pesée du matin sur la carte (avant midi), registre, alerte de perte rapide, report au lendemain.
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
const debut = jour(-20);
const profil = {
  v: 5, debut, cree: debut + 'T08:00:00Z', maj: debut + 'T08:00:00Z', plan: { jours: [1, 4], minutes: 70 },
  survivants: [{ nom: 'Aubin', mode: 'survie', depuis: debut }],
  programme: [{ id: 'curl', actif: true, series: 3, charge: 8 }], priorites: ['bras', 'jambes'], pauses: [], morts: [],
  mesures: [{ id: 'm', date: jour(-3), bras: 35, taille: 85, hanches: 96 }], rappelPesee: 'matin',
  pesees: [{ date: jour(-12), kg: 82 }, { date: jour(-10), kg: 82.2 }, { date: jour(-5), kg: 80.6 }, { date: jour(-2), kg: 80.8 }]
};
function ouvrir() {
  return new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + page + '</body></html>', {
    url: 'https://exemple.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {};
      w.Date.prototype.getHours = function () { return 8; };
      w.localStorage.setItem('valgrise:v1', JSON.stringify({ profil, seances: [] }));
    }
  });
}
function outils(dom) {
  const w = dom.window, d = w.document;
  return {
    w, d,
    texte: () => d.getElementById('app').textContent.replace(/\s+/g, ' '),
    clic: sel => { const el = d.querySelector(sel); if (!el) throw new Error('Introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
    saisir: (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); },
    stocke: () => JSON.parse(w.localStorage.getItem('valgrise:v1')).profil
  };
}
function verifier(c, m, t) { if (!c) { console.error('Échec : ' + m + (t ? ' | ' + t().slice(0, 300) : '')); process.exit(1); } console.log('ok  ' + m); }

const A = outils(ouvrir());
setTimeout(() => {
  try {
    verifier(/Pesée du matin/.test(A.texte()), 'la pesée du matin apparaît sur la carte avant midi', A.texte);
    A.saisir('#f-kg-matin', '80,4');
    A.clic('[data-action="noter-pesee"]');
    verifier(!/Pesée du matin/.test(A.texte()), 'la fiche disparaît une fois la pesée notée', A.texte);
    verifier(/Ida s’inquiète/.test(A.d.getElementById('avis').textContent), 'perte de plus de 1 % par semaine : Ida s’inquiète');
    verifier(A.stocke().pesees.some(x => x.date === jour(0) && x.kg === 80.4), 'pesée enregistrée');
    A.clic('[data-action="aller"][data-ecran="survivant"]');
    verifier(/Ida : tu perds plus de 1 % de ton poids par semaine/.test(A.texte()), 'l’alerte figure dans le registre', A.texte);
    verifier(!!A.d.querySelector('#pesee svg polyline') && /moyenne sur 7 jours, 3 pesées/.test(A.texte()), 'courbe et moyenne affichées', A.texte);

    const B = outils(ouvrir());
    setTimeout(() => {
      try {
        verifier(/Pesée du matin/.test(B.texte()), 'nouvelle ouverture : la pesée du matin est là');
        B.clic('[data-action="pesee-plus-tard"]');
        verifier(!/Pesée du matin/.test(B.texte()) && B.stocke().peseeReportee === jour(0), '« Pas aujourd’hui » la reporte au lendemain', B.texte);
        verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
        process.exit(0);
      } catch (e) { console.error(e.message, erreurs); process.exit(1); }
    }, 60);
  } catch (e) { console.error(e.message, erreurs); process.exit(1); }
}, 60);
