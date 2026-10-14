const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/engine.js');

const D = '2026-10-12'; // un lundi
function profil(extra) {
  return Object.assign(V.nouveauProfil({
    date: D, horodatage: D + 'T08:00:00Z', jours: [1, 4], minutes: 45, nom: 'Aubin', mode: 'survie',
    programme: [
      { id: 'pompes', actif: true, series: 3, niveau: 1 },
      { id: 'developpe', actif: true, series: 3, charge: 10 },
      { id: 'curl', actif: true, series: 3, charge: 8 },
      { id: 'abdos', actif: true, series: 3, niveau: 2 }
    ]
  }), extra || {});
}
function seance(p, liste, date, opts) {
  const o = Object.assign({ minutes: 45, effort: 7, genre: 'expedition', heure: '18:00' }, opts || {});
  const f = V.faitsSeance(p, liste, date, o.genre);
  const s = Object.assign({ id: 's' + (liste.length + 1) + '-' + date, date: date, debut: date + 'T' + o.heure + ':00', minutes: o.minutes, effort: o.effort, genre: o.genre, exercices: o.exercices || [] }, f);
  liste.push(s);
  return s;
}

test('courbe de niveaux du document', () => {
  assert.equal(V.xpCumulee(10), 5400);
  assert.equal(V.xpCumulee(20), 19000);
  assert.equal(V.xpCumulee(30), 40600);
  assert.equal(V.xpCumulee(50), 107800);
  assert.equal(V.niveau(5399).niveau, 9);
  assert.equal(V.niveau(5400).niveau, 10);
  assert.equal(V.niveau(0).besoin, 280);
});

test('compte à rebours : faim, agonie, chute au 13e matin', () => {
  const p = profil();
  assert.equal(V.simuler(p, [], V.addDays(D, 7)).stock, 0);
  assert.equal(V.simuler(p, [], V.addDays(D, 8)).statut, 'faim');
  assert.equal(V.simuler(p, [], V.addDays(D, 10)).statut, 'faim');
  const ag = V.simuler(p, [], V.addDays(D, 12));
  assert.equal(ag.statut, 'agonie');
  assert.equal(ag.joursAvantChute, 1);
  assert.equal(ag.chutes.length, 0);
  const r = V.simuler(p, [], V.addDays(D, 13));
  assert.deepEqual(r.chutes, [V.addDays(D, 13)]);
  assert.equal(r.stock, 3);
  assert.equal(r.cicatrices, 1);
  assert.equal(r.convalescence, 2);
  assert.equal(r.statut, 'nourri');
});

test('une maladie déclarée après coup annule la chute en mode Survie', () => {
  const p = profil();
  p.pauses.push({ id: 'p1', genre: 'malade', debut: V.addDays(D, 8), fin: null });
  const r = V.simuler(p, [], V.addDays(D, 13));
  assert.equal(r.chutes.length, 0);
  assert.equal(r.statut, 'abri');
  assert.equal(r.stock, 0);
});

test('Ironman : la mort est définitive une fois actée', () => {
  const p = profil();
  p.survivants[0].mode = 'ironman';
  const s = [];
  seance(p, s, D);
  const r = V.simuler(p, s, V.addDays(D, 20));
  assert.equal(r.nouvellesMorts.length, 1);
  p.morts.push({ date: r.nouvellesMorts[0], nom: 'Aubin', niveau: 2 });
  p.pauses.push({ id: 'p1', genre: 'malade', debut: V.addDays(D, 9), fin: null });
  const r2 = V.simuler(p, s, V.addDays(D, 21));
  assert.equal(r2.xp, 0);
  assert.equal(r2.nouvellesMorts.length, 0);
});

test('vivres du plan lundi et jeudi : 4 puis 5 rations, le stock reste plein', () => {
  const p = profil();
  const s = [];
  const lundi = seance(p, s, D);
  assert.equal(lundi.prevue, true);
  assert.equal(lundi.rationsBase, 4);
  const jeudi = seance(p, s, V.addDays(D, 3));
  assert.equal(jeudi.rationsBase, 5);
  for (let w = 1; w < 4; w++) { seance(p, s, V.addDays(D, 7 * w)); seance(p, s, V.addDays(D, 7 * w + 3)); }
  const r = V.simuler(p, s, V.addDays(D, 27));
  assert.equal(r.statut, 'nourri');
  assert.ok(r.stock >= 4);
});

test('XP de la maquette : 46 min, effort 7, prévue = 386, plus le bonus de semaine', () => {
  const p = profil();
  const s = [];
  const a = seance(p, s, D, { minutes: 46, effort: 7 });
  const r = V.simuler(p, s, D);
  assert.equal(r.resultats[a.id].charge, 322);
  assert.equal(r.resultats[a.id].xp, 386);
  const b = seance(p, s, V.addDays(D, 3), { minutes: 46, effort: 7 });
  const r2 = V.simuler(p, s, V.addDays(D, 3));
  assert.equal(r2.resultats[b.id].bonusSemaine, 250);
  assert.equal(r2.xp, 386 * 2 + 250);
});

test('deuxième séance du jour : XP divisée par deux, pas de vivres', () => {
  const p = profil();
  const s = [];
  seance(p, s, D, { heure: '08:00' });
  const b = seance(p, s, D, { genre: 'libre', heure: '19:00', minutes: 30, effort: 4 });
  assert.equal(b.rationsBase, 0);
  const r = V.simuler(p, s, D);
  assert.equal(r.resultats[b.id].xp, 60);
  assert.equal(r.resultats[b.id].rationsDues, 0);
});

test('plafond de 90 minutes comptées par jour', () => {
  const p = profil();
  const s = [];
  const a = seance(p, s, D, { minutes: 120, effort: 5 });
  assert.equal(V.simuler(p, s, D).resultats[a.id].minutesComptees, 90);
});

test('revenir après la faim rapporte au moins trois rations', () => {
  const p = profil();
  const s = [];
  const a = seance(p, s, V.addDays(D, 9), { genre: 'libre' });
  const r = V.simuler(p, s, V.addDays(D, 9));
  assert.equal(r.resultats[a.id].rationsDues, 3);
  assert.equal(r.statut, 'nourri');
});

test('convalescence après une chute : deux expéditions à demi-XP', () => {
  const p = profil();
  const s = [];
  const j = V.addDays(D, 14);
  const a = seance(p, s, j, { minutes: 40, effort: 5, genre: 'libre' });
  const b = seance(p, s, V.addDays(j, 1), { minutes: 40, effort: 5, genre: 'libre' });
  const c = seance(p, s, V.addDays(j, 2), { minutes: 40, effort: 5, genre: 'libre' });
  const r = V.simuler(p, s, V.addDays(j, 2));
  assert.equal(r.chutes.length, 1);
  assert.equal(r.resultats[a.id].xp, 100);
  assert.equal(r.resultats[b.id].xp, 100);
  assert.equal(r.resultats[c.id].xp, 200);
});

test('fouille déterministe et objet rare garanti au plus toutes les 10 fouilles', () => {
  const p = profil();
  const s = [];
  for (let i = 0; i < 12; i++) seance(p, s, V.addDays(D, i), { genre: 'libre', minutes: 20, effort: 3 });
  const r1 = V.simuler(p, s, V.addDays(D, 12));
  const r2 = V.simuler(p, s, V.addDays(D, 12));
  assert.deepEqual(r1.inventaire, r2.inventaire);
  let sansRare = 0, max = 0;
  s.forEach(x => r1.resultats[x.id].butin.forEach(b => { sansRare = b.rarete === 'rare' ? 0 : sansRare + 1; max = Math.max(max, sansRare); }));
  assert.ok(max <= 9, 'au plus 9 fouilles de suite sans objet rare');
});

test('le coach propose l’échelon suivant après deux séances au plafond', () => {
  const p = profil();
  const s = [];
  const ex = (series) => [{ id: 'developpe', reglage: V.reglage(p.programme[1]), series: series }];
  seance(p, s, D, { exercices: ex([12, 12, 12]) });
  assert.equal(V.suggestions(p, s).length, 0);
  seance(p, s, V.addDays(D, 3), { exercices: ex([12, 13, 12]) });
  const sug = V.suggestions(p, s);
  assert.equal(sug.length, 1);
  assert.equal(sug[0].nouveau.charge, 15);
  assert.equal(sug[0].sens, 1);
});

test('priorités bras et abdos en 45 min : tractions à 4 séries, priorités à 3, le reste à 2', () => {
  const p = profil();
  const ajoutes = V.definirPriorites(p, ['bras', 'abdos']);
  assert.deepEqual(ajoutes, ['chinup', 'triceps', 'releves']);
  const plan = V.planSeance(p);
  assert.deepEqual(plan.exos.map(x => x.ex.id), ['chinup', 'curl', 'triceps', 'pompes', 'developpe', 'abdos', 'releves']);
  assert.deepEqual(plan.exos.map(x => x.series), [4, 3, 3, 2, 2, 3, 3]);
  assert.equal(plan.minutes, 45);
  assert.equal(plan.depasse, false);
});

test('avec plus de temps, les priorités gardent leurs 4 séries', () => {
  const p = profil();
  V.definirPriorites(p, ['bras', 'abdos']);
  p.plan.minutes = 60;
  const plan = V.planSeance(p);
  assert.deepEqual(plan.exos.map(x => x.series), [4, 4, 4, 3, 3, 4, 4]);
  assert.equal(plan.minutes, 57);
});

test('séance complète à 70 min : bras et abdos en priorité, jambes et fessiers à 3 séries, abdos en dernier', () => {
  const p = profil();
  p.programme.push({ id: 'squat', actif: true, series: 3, niveau: 0 }, { id: 'hipthrust', actif: true, series: 3, charge: 10 });
  V.definirPriorites(p, ['bras', 'abdos']);
  p.plan.minutes = 70;
  const plan = V.planSeance(p);
  assert.deepEqual(plan.exos.map(x => x.ex.id), ['chinup', 'curl', 'triceps', 'squat', 'hipthrust', 'pompes', 'developpe', 'abdos', 'releves']);
  assert.deepEqual(plan.exos.map(x => x.series), [4, 4, 4, 3, 3, 3, 3, 4, 4]);
  assert.equal(plan.minutes, 69);
  p.plan.minutes = 60;
  assert.deepEqual(V.planSeance(p).exos.map(x => x.series), [4, 4, 4, 2, 2, 2, 2, 4, 3], 'à 60 min : le reste à 2 séries');
});

test('priorités bras et fessiers : les abdos restent en fin de séance, sans priorité', () => {
  const p = profil();
  V.definirPriorites(p, ['bras', 'jambes']);
  p.plan.minutes = 70;
  const plan = V.planSeance(p);
  assert.deepEqual(plan.exos.map(x => x.ex.id), ['chinup', 'curl', 'triceps', 'squat', 'hipthrust', 'pompes', 'developpe', 'abdos']);
  assert.equal(plan.exos.at(-1).priorite, false);
});

test('visite au dispensaire : due au départ, puis toutes les deux semaines', () => {
  const p = profil();
  assert.equal(V.visiteDue(p, D), true);
  p.mesures.push({ id: 'm1', date: D, bras: 34.5, taille: 86, hanches: 97 });
  assert.equal(V.prochaineVisite(p, D), V.addDays(D, 14));
  assert.equal(V.visiteDue(p, V.addDays(D, 13)), false);
  assert.equal(V.visiteDue(p, V.addDays(D, 14)), true);
  p.mesures.push({ id: 'm2', date: V.addDays(D, 14), bras: 35.2, taille: 85.1, hanches: null });
  const e = V.ecartsMesures(p);
  assert.deepEqual(e.find(x => x.cle === 'bras').points.map(pt => pt.ecart), [0, 0.7]);
  assert.deepEqual(e.find(x => x.cle === 'taille').points.map(pt => pt.ecart), [0, -0.9]);
  assert.equal(e.find(x => x.cle === 'hanches').points.length, 1, 'une mesure absente est ignorée');
});

test('sans priorité : 3 séries partout ; trop court, les priorités ne descendent pas sous 3 séries', () => {
  const p = profil();
  assert.deepEqual(V.planSeance(p).exos.map(x => x.series), [3, 3, 3, 3]);
  V.definirPriorites(p, ['bras', 'jambes']);
  p.plan.minutes = 30;
  const plan = V.planSeance(p);
  plan.exos.filter(x => x.priorite).forEach(x => assert.equal(x.series, 3));
  plan.exos.filter(x => !x.priorite).forEach(x => assert.equal(x.series, 2));
  assert.equal(plan.depasse, true);
});

test('deux priorités au plus', () => {
  const p = profil();
  V.definirPriorites(p, ['bras', 'abdos', 'jambes']);
  assert.deepEqual(p.priorites, ['bras', 'abdos']);
});

test('mise à jour v2 : la priorité biceps devient bras et ajoute le triceps, avec une annonce', () => {
  const p = profil();
  p.v = 2;
  p.programme.push({ id: 'chinup', actif: true, series: 3, niveau: 2 }, { id: 'releves', actif: true, series: 3, niveau: 0 });
  p.priorites = ['biceps', 'abdos'];
  V.migrer(p);
  assert.equal(p.v, 11);
  assert.deepEqual(p.priorites, ['bras', 'abdos']);
  assert.equal(p.programme.find(e => e.id === 'triceps').actif, true);
  assert.equal(V.reglage(p.programme.find(e => e.id === 'triceps')), 'Élastique de 10 kg');
  assert.deepEqual(p.annonces, ['triceps', 'jambes', 'reglages', 'calibrage'], 'pas d’annonce des élastiques : il n’a jamais connu l’haltère');
  assert.equal(p.programme.find(e => e.id === 'chinup').niveau, 2, 'le réglage des tractions est conservé');
});

test('mise à jour d’une partie v1 : relevés séparés de la roulette, priorités à choisir', () => {
  const ancien = profil();
  ancien.v = 1;
  delete ancien.priorites;
  ancien.programme[3].niveau = 3; // ancien « Relevés de genoux à la barre »
  ancien.programme.push({ id: 'squat', actif: false, series: 3, charge: 12 }); // l'ancien goblet squat, inactif en v1
  const p = V.migrer(JSON.parse(JSON.stringify(ancien)));
  assert.equal(p.v, 11);
  assert.deepEqual(p.elastiques, [5, 10, 15, 20]);
  assert.deepEqual(p.pesees, []);
  assert.equal(p.rappelPesee, 'matin');
  assert.equal(p.priorites, null);
  assert.equal(p.programme.find(e => e.id === 'triceps').actif, false);
  assert.equal(p.programme.find(e => e.id === 'squat').actif, true);
  assert.equal(V.reglage(p.programme.find(e => e.id === 'squat')), 'Squat au poids du corps');
  assert.equal(p.programme.find(e => e.id === 'squat').charge, undefined);
  assert.equal(p.programme.find(e => e.id === 'hipthrust').actif, true);
  assert.deepEqual(p.annonces, ['jambes', 'reglages', 'calibrage']);
  assert.deepEqual(p.mesures, []);
  assert.equal(V.reglage(p.programme.find(e => e.id === 'abdos')), 'Roulette à genoux');
  assert.equal(p.programme.find(e => e.id === 'releves').actif, true);
  assert.equal(p.programme.find(e => e.id === 'chinup').actif, false);
  assert.deepEqual(V.migrer(JSON.parse(JSON.stringify(p))), p, 'une deuxième mise à jour ne change rien');
});

test('le plafond tient compte du nombre de séries prévues', () => {
  const p = profil();
  const s = [];
  const reg = V.reglage(p.programme[2]);
  seance(p, s, D, { exercices: [{ id: 'curl', reglage: reg, prevu: 4, series: [12, 12, 12] }] });
  seance(p, s, V.addDays(D, 3), { exercices: [{ id: 'curl', reglage: reg, prevu: 4, series: [12, 12, 12] }] });
  assert.equal(V.suggestions(p, s).length, 0, 'trois séries sur quatre prévues : pas encore');
  seance(p, s, V.addDays(D, 7), { exercices: [{ id: 'curl', reglage: reg, prevu: 4, series: [12, 12, 12, 12] }] });
  seance(p, s, V.addDays(D, 10), { exercices: [{ id: 'curl', reglage: reg, prevu: 4, series: [12, 12, 13, 12] }] });
  const sug = V.suggestions(p, s);
  assert.equal(sug.length, 1);
  assert.equal(sug[0].nouveau.charge, 10);
});

test('pesée : moyenne sur 7 jours et tendance d’une semaine sur l’autre', () => {
  const p = profil();
  assert.equal(V.moyennePoids(p, D), null);
  [[-13, 80.4], [-11, 80.0], [-9, 80.2], [-6, 79.8], [-4, 79.6], [-1, 79.4], [0, 79.7]].forEach(([j, kg]) => p.pesees.push({ date: V.addDays(D, j), kg }));
  assert.deepEqual(V.moyennePoids(p, D), { kg: 79.6, n: 4 });
  const t = V.tendancePoids(p, D);
  assert.equal(t.ecart, -0.6);
  assert.equal(t.rapide, false);
  assert.equal(V.seriePoids(p, D, 7).length, 4);
});

test('pesée : une perte de plus de 1 % par semaine déclenche l’alerte d’Ida', () => {
  const p = profil();
  [[-12, 82], [-10, 82.2], [-5, 80.6], [-2, 80.8]].forEach(([j, kg]) => p.pesees.push({ date: V.addDays(D, j), kg }));
  assert.equal(V.tendancePoids(p, D).rapide, true);
  p.pesees = [{ date: D, kg: 80 }];
  assert.equal(V.tendancePoids(p, D), null, 'pas de tendance sans deux pesées par semaine');
});

test('rappel de pesée : le matin seulement, tant que la pesée du jour manque', () => {
  const p = profil();
  assert.equal(V.rappelPesee(p, D, 8), true);
  assert.equal(V.rappelPesee(p, D, 14), false, 'pas l’après-midi');
  p.rappelPesee = 'lundi';
  assert.equal(V.rappelPesee(p, D, 8), true, 'D est un lundi');
  assert.equal(V.rappelPesee(p, V.addDays(D, 1), 8), false);
  p.rappelPesee = 'matin';
  p.peseeReportee = D;
  assert.equal(V.rappelPesee(p, D, 8), false, 'reporté à demain');
  p.peseeReportee = null;
  p.pesees.push({ date: D, kg: 79 });
  assert.equal(V.rappelPesee(p, D, 8), false, 'déjà pesé');
  p.rappelPesee = 'jamais';
  assert.equal(V.rappelPesee(p, V.addDays(D, 1), 8), false);
});

test('prochaine expédition : aujourd’hui si prévue, sinon le jour suivant du plan', () => {
  const p = profil();
  const s = [];
  assert.equal(V.prochaineExpedition(p, s, D), D);
  seance(p, s, D);
  assert.equal(V.prochaineExpedition(p, s, D), V.addDays(D, 3));
});

test('mise à jour v6 : squat au poids du corps, extension triceps à l’élastique, hip thrust inchangé', () => {
  const p = profil();
  p.v = 5;
  p.programme.push(
    { id: 'triceps', actif: true, series: 3, charge: 12 },
    { id: 'squat', actif: true, series: 3, charge: 14 },
    { id: 'hipthrust', actif: true, series: 3, charge: 16 }
  );
  V.migrer(p);
  assert.equal(p.v, 11);
  const squat = p.programme.find(e => e.id === 'squat'), triceps = p.programme.find(e => e.id === 'triceps');
  assert.equal(squat.niveau, 1);
  assert.equal(squat.charge, undefined);
  assert.equal(V.reglage(squat), 'Squat au poids du corps');
  assert.equal(V.reglage(triceps), 'Élastique de 10 kg');
  assert.equal(V.reglage(p.programme.find(e => e.id === 'hipthrust')), 'Un haltère de 16 kg');
  assert.deepEqual(p.annonces, ['elastiques', 'reglages', 'calibrage']);
  assert.deepEqual(V.migrer(JSON.parse(JSON.stringify(p))), p, 'une deuxième mise à jour ne change rien');
});

test('mise à jour v6 : rien à annoncer si le squat et le triceps n’étaient pas au programme', () => {
  const p = profil();
  p.v = 5;
  p.programme.push({ id: 'triceps', actif: false, series: 3, charge: 8 }, { id: 'squat', actif: false, series: 3, charge: 12 });
  V.migrer(p);
  assert.deepEqual(p.annonces, ['reglages', 'calibrage'], 'seulement les notes sur les nouveaux réglages');
  assert.equal(p.programme.find(e => e.id === 'triceps').charge, 10);
});

test('squat : du banc au poids du corps, puis au squat lent et à l’élastique de 10 kg', () => {
  const p = profil();
  p.programme.push(V.defautExercice('squat'));
  const squat = p.programme.at(-1);
  squat.actif = true;
  assert.equal(V.reglage(squat, p), 'Squat sur le banc');
  assert.deepEqual(V.fourchette(squat), { min: 12, max: 20 });
  const s = [];
  let jour = 0;
  const deuxFois = series => {
    for (let k = 0; k < 2; k++) { seance(p, s, V.addDays(D, jour), { exercices: [{ id: 'squat', reglage: V.reglage(squat, p), prevu: 3, series }] }); jour += 3; }
    return V.suggestions(p, s);
  };
  const attendus = ['Squat au poids du corps', 'Squat lent, 3 s à la descente', 'Squat à l’élastique de 10 kg', 'Squat à l’élastique de 15 kg'];
  attendus.forEach(vers => {
    const sug = deuxFois([20, 20, 20]);
    assert.equal(sug.length, 1);
    assert.equal(sug[0].vers, vers);
    Object.assign(squat, sug[0].nouveau);
  });
  assert.deepEqual([squat.niveau, squat.charge], [3, 15]);
  // Deux fois sous la fourchette : retour à l'élastique de 10 kg, puis au squat lent
  let sug = deuxFois([9, 8, 8]);
  assert.equal(sug[0].vers, 'Squat à l’élastique de 10 kg');
  Object.assign(squat, sug[0].nouveau);
  sug = deuxFois([9, 8, 8]);
  assert.equal(sug[0].vers, 'Squat lent, 3 s à la descente');
  Object.assign(squat, sug[0].nouveau);
  assert.equal(squat.niveau, 2);
  assert.equal('charge' in sug[0].nouveau, false, 'plus de charge au poids du corps');
});

test('échelon du squat : 3 au poids du corps puis un par résistance d’élastique', () => {
  const p = profil();
  assert.deepEqual(V.echelon({ id: 'squat', niveau: 0 }, p), { rang: 1, total: 11 });
  assert.deepEqual(V.echelon({ id: 'squat', niveau: 3, charge: 25 }, p), { rang: 7, total: 11 });
  assert.equal(V.reglage({ id: 'squat', niveau: 3, charge: 25 }, p), 'Squat à l’élastique de 25 kg (10 + 15)');
  assert.deepEqual(V.echelon({ id: 'abdos', niveau: 1 }, p), { rang: 2, total: 5 });
  assert.equal(V.echelon({ id: 'curl', charge: 8 }, p), null);
});

test('extension triceps à l’élastique : 10 à 15 répétitions, puis l’élastique suivant', () => {
  const p = profil();
  const tri = V.defautExercice('triceps');
  tri.actif = true;
  p.programme.push(tri);
  assert.equal(V.reglage(tri), 'Élastique de 10 kg');
  const s = [];
  seance(p, s, D, { exercices: [{ id: 'triceps', reglage: V.reglage(tri), prevu: 3, series: [12, 12, 12] }] });
  seance(p, s, V.addDays(D, 3), { exercices: [{ id: 'triceps', reglage: V.reglage(tri), prevu: 3, series: [12, 12, 12] }] });
  assert.equal(V.suggestions(p, s).length, 0, '12 répétitions : pas encore le plafond');
  seance(p, s, V.addDays(D, 7), { exercices: [{ id: 'triceps', reglage: V.reglage(tri), prevu: 3, series: [15, 15, 15] }] });
  seance(p, s, V.addDays(D, 10), { exercices: [{ id: 'triceps', reglage: V.reglage(tri), prevu: 3, series: [15, 16, 15] }] });
  const sug = V.suggestions(p, s);
  assert.equal(sug.length, 1);
  assert.equal(sug[0].nouveau.charge, 15);
});

test('crunchs : 12 à 20 répétitions avant la roulette, qui se compte par 6 à 10', () => {
  const p = profil();
  const abdos = p.programme.find(e => e.id === 'abdos');
  abdos.niveau = 0;
  assert.deepEqual(V.fourchette(abdos), { min: 12, max: 20 });
  assert.deepEqual(V.fourchette(Object.assign({}, abdos, { niveau: 1 })), { min: 6, max: 10 });
  const s = [];
  const fait = (date, series) => seance(p, s, date, { exercices: [{ id: 'abdos', reglage: 'Crunchs', prevu: 3, series }] });
  fait(D, [10, 10, 10]);
  fait(V.addDays(D, 3), [10, 10, 10]);
  const bas = V.suggestions(p, s);
  assert.deepEqual(bas.map(x => x.vers), ['8 à 12 répétitions'], '10 crunchs ne mènent pas à la roulette : au premier échelon, le coach propose de baisser la fourchette');
  fait(V.addDays(D, 7), [20, 20, 20]);
  fait(V.addDays(D, 10), [20, 20, 22]);
  assert.equal(V.suggestions(p, s)[0].vers, 'Roulette à genoux, partielle');
});

test('élastiques : le kit de départ se combine jusqu’à trois, du plus équilibré au plus lourd', () => {
  assert.deepEqual(V.resistances(null), [5, 10, 15, 20, 25, 30, 35, 40, 45]);
  const libelles = V.resistances(null).map(kg => V.libelleElastique(kg, null));
  assert.deepEqual(libelles.slice(4), ['25 kg (10 + 15)', '30 kg (10 + 20)', '35 kg (15 + 20)', '40 kg (5 + 15 + 20)', '45 kg (10 + 15 + 20)']);
  const p = profil();
  assert.deepEqual(p.elastiques, [5, 10, 15, 20]);
  p.elastiques.push(2.5);
  assert.equal(V.libelleElastique(7.5, p), '7,5 kg (2,5 + 5)');
  assert.equal(V.reglage({ id: 'developpe', charge: 12.5 }, p), 'Élastique de 12,5 kg (2,5 + 10)');
});

test('élastiques : retirer un élastique ramène chaque réglage à la résistance possible juste en dessous', () => {
  const p = profil();
  p.programme.find(e => e.id === 'developpe').charge = 45;
  p.programme.push({ id: 'squat', actif: true, series: 3, niveau: 3, charge: 40 }, { id: 'triceps', actif: true, series: 3, charge: 10 });
  p.elastiques = [5, 10, 15];
  assert.deepEqual(V.resistances(p), [5, 10, 15, 20, 25, 30]);
  const changes = V.ajusterElastiques(p);
  assert.deepEqual(changes, [
    { id: 'developpe', vers: 'Élastique de 30 kg (5 + 10 + 15)' },
    { id: 'squat', vers: 'Squat à l’élastique de 30 kg (5 + 10 + 15)' }
  ]);
  assert.equal(p.programme.find(e => e.id === 'triceps').charge, 10, 'un réglage encore possible ne bouge pas');
  p.elastiques = [5];
  V.ajusterElastiques(p);
  const squat = p.programme.find(e => e.id === 'squat');
  assert.deepEqual([squat.niveau, squat.charge], [2, undefined], 'sans élastique d’au moins 10 kg, le squat revient au squat lent');
});

test('fourchette choisie par le joueur : le coach progresse à partir d’elle', () => {
  const p = profil();
  const curl = p.programme.find(e => e.id === 'curl');
  curl.reps = [5, 8];
  assert.deepEqual(V.fourchette(curl), { min: 5, max: 8, perso: true });
  assert.deepEqual(V.fourchetteCoach(curl), { min: 8, max: 12 });
  const s = [];
  const reg = V.reglage(curl, p);
  seance(p, s, D, { exercices: [{ id: 'curl', reglage: reg, prevu: 3, series: [8, 8, 8] }] });
  seance(p, s, V.addDays(D, 3), { exercices: [{ id: 'curl', reglage: reg, prevu: 3, series: [8, 9, 8] }] });
  const sug = V.suggestions(p, s);
  assert.equal(sug.length, 1);
  assert.equal(sug[0].nouveau.charge, 10);
  assert.deepEqual(sug[0].nouveau.reps, [5, 8], 'la fourchette choisie suit le nouveau réglage');
  curl.reps = [9, 4];
  assert.deepEqual(V.fourchette(curl), { min: 8, max: 12 }, 'une fourchette incohérente est ignorée');
});

test('fourchettes proposées : celle du coach figure toujours dans la liste', () => {
  const l = V.fourchettesProposees({ id: 'releves', niveau: 0 });
  assert.ok(l.some(f => f[0] === 6 && f[1] === 12));
  assert.deepEqual(l[0], [3, 5]);
  assert.equal(V.fourchettesProposees({ id: 'curl', charge: 8 }).length, V.FOURCHETTES.length);
});

test('mise à jour v7 : l’échelle du squat se décale d’un cran, le kit d’élastiques est enregistré', () => {
  const avant = [0, 1, 2, 5, 7].map(n => {
    const p = profil();
    p.v = 6;
    delete p.elastiques;
    p.programme.push({ id: 'squat', actif: true, series: 3, niveau: n });
    V.migrer(p);
    return p;
  });
  assert.deepEqual(avant.map(p => V.reglage(p.programme.find(e => e.id === 'squat'), p)), [
    'Squat au poids du corps', 'Squat lent, 3 s à la descente', 'Squat à l’élastique de 10 kg',
    'Squat à l’élastique de 25 kg (10 + 15)', 'Squat à l’élastique de 35 kg (15 + 20)'
  ]);
  avant.forEach(p => {
    assert.equal(p.v, 11);
    assert.deepEqual(p.elastiques, [5, 10, 15, 20]);
    assert.deepEqual(p.annonces, ['reglages', 'calibrage']);
    assert.deepEqual(V.migrer(JSON.parse(JSON.stringify(p))), p, 'une deuxième mise à jour ne change rien');
  });
});

test('calibrage : la fourchette où la séance tombe vers le milieu', () => {
  const F = V.FOURCHETTES;
  assert.deepEqual(V.proposerFourchette([9, 8, 7], F), [6, 10]);
  assert.deepEqual(V.proposerFourchette([12, 10, 9], F), [8, 12]);
  assert.deepEqual(V.proposerFourchette([20, 18, 15], F), [12, 20]);
  assert.deepEqual(V.proposerFourchette([5, 4, 3], F), [3, 5]);
  assert.deepEqual(V.proposerFourchette([10, 10, 10], F), [8, 12]);
  assert.deepEqual(V.proposerFourchette([8, 6, 4], F), [5, 8], 'grosse baisse de fatigue : la fourchette la plus proche de la moyenne');
  assert.equal(V.proposerFourchette([], F), null);
});

function avecSeance(p, s, date, exercices) { return seance(p, s, date, { exercices }); }

test('calibrage : proposé après la première séance, une fois par échelon', () => {
  const p = profil();
  const abdos = p.programme.find(e => e.id === 'abdos');
  abdos.niveau = 0;
  const s = [];
  const a = avecSeance(p, s, D, [{ id: 'abdos', reglage: 'Crunchs', prevu: 3, series: [9, 8, 7] }, { id: 'curl', reglage: V.reglage(p.programme[2], p), prevu: 3, series: [10, 10, 10] }]);
  const props = V.calibrer(p, a);
  assert.deepEqual(props.map(x => [x.id, x.reps]), [['abdos', [6, 10]]], 'le curl, déjà bien réglé, ne demande rien');
  assert.equal(V.estCalibre(p.programme[2]), true, 'fourchette identique : calibré sans question');
  assert.equal(V.calibragesEnAttente(p).length, 1);
  V.repondreCalibrage(p, 'abdos', true);
  assert.deepEqual(abdos.reps, [6, 10]);
  assert.equal(V.estCalibre(abdos), true);
  assert.equal(V.calibragesEnAttente(p).length, 0);
  const b = avecSeance(p, s, V.addDays(D, 3), [{ id: 'abdos', reglage: 'Crunchs', prevu: 3, series: [10, 9, 9] }]);
  assert.equal(V.calibrer(p, b).length, 0, 'déjà calibré à cet échelon');
  // Nouvel échelon : nouveau calibrage à sa première séance
  abdos.niveau = 1;
  assert.equal(V.estCalibre(abdos), false);
  const c = avecSeance(p, s, V.addDays(D, 7), [{ id: 'abdos', reglage: 'Roulette à genoux, partielle', prevu: 3, series: [5, 4, 4] }]);
  assert.deepEqual(V.calibrer(p, c)[0].reps, [3, 5]);
  V.repondreCalibrage(p, 'abdos', false);
  assert.deepEqual(abdos.reps, [6, 10], 'refuser garde la fourchette');
  assert.equal(V.estCalibre(abdos), true);
});

test('calibrage : une charge plus lourde ne recalibre pas', () => {
  const p = profil();
  const curl = p.programme[2];
  curl.calibre = 'charge';
  curl.charge = 10;
  assert.equal(V.estCalibre(curl), true);
  const squat = { id: 'squat', actif: true, series: 3, niveau: 3, charge: 10, calibre: 'n3' };
  squat.charge = 15;
  assert.equal(V.estCalibre(squat), true, 'élastique plus lourd au même échelon');
});

test('calibrage : nettement trop dur ou trop facile, le coach propose un autre échelon', () => {
  const p = profil();
  p.programme.push({ id: 'chinup', actif: true, series: 3, niveau: 1 });
  const s = [];
  const a = avecSeance(p, s, D, [{ id: 'chinup', reglage: 'Tractions négatives, 5 s de descente', prevu: 3, series: [2, 1, 1] },
    { id: 'pompes', reglage: 'Pompes', prevu: 3, series: [30, 28, 27] }]);
  const props = V.calibrer(p, a);
  assert.deepEqual(props.map(x => [x.id, x.sens, x.texte]), [['chinup', -1, 'Tractions assistées, pieds sur une chaise'], ['pompes', 1, 'Pompes pieds surélevés']]);
  V.repondreCalibrage(p, 'chinup', true);
  const chinup = p.programme.find(e => e.id === 'chinup');
  assert.equal(chinup.niveau, 0);
  assert.equal(V.estCalibre(chinup), false, 'le nouvel échelon sera calibré à sa première séance');
});

test('calibrage : une proposition devient caduque si le réglage change, et met en pause la double progression', () => {
  const p = profil();
  const s = [];
  const curl = p.programme[2];
  const reg = V.reglage(curl, p);
  avecSeance(p, s, D, [{ id: 'curl', reglage: reg, prevu: 3, series: [12, 12, 12] }]);
  const b = avecSeance(p, s, V.addDays(D, 3), [{ id: 'curl', reglage: reg, prevu: 3, series: [15, 15, 14] }]);
  V.calibrer(p, b);
  assert.equal(V.calibragesEnAttente(p).length, 1);
  assert.equal(V.suggestions(p, s).length, 0, 'pas de charge plus lourde tant que le calibrage attend');
  curl.charge = 10;
  assert.equal(V.calibragesEnAttente(p).length, 0, 'réglage changé à la main : la proposition tombe');
});

test('premier échelon : sous la fourchette deux fois de suite, le coach propose une fourchette plus basse', () => {
  const p = profil();
  p.programme.push({ id: 'squat', actif: true, series: 3, niveau: 0, reps: [6, 10], calibre: 'n0' });
  const s = [];
  avecSeance(p, s, D, [{ id: 'squat', reglage: 'Squat sur le banc', prevu: 3, series: [5, 4, 3] }]);
  avecSeance(p, s, V.addDays(D, 3), [{ id: 'squat', reglage: 'Squat sur le banc', prevu: 3, series: [4, 4, 3] }]);
  const sug = V.suggestions(p, s);
  assert.equal(sug.length, 1);
  assert.deepEqual(sug[0].nouveau.reps, [3, 5]);
  assert.equal(sug[0].vers, '3 à 5 répétitions');
});

test('bilan d’Ida : un homme mince de 34 ans', () => {
  const p = profil({ hauteur: 182, naissance: 1992, sexe: 'homme' });
  p.pesees = [{ date: D, kg: 66.5 }];
  const m = { id: 'v1', date: D, bras: 29, taille: 81, hanches: 90, graisse: 13.2 };
  p.mesures.push(m);
  const b = V.bilanIda(p, m);
  assert.equal(b.age, 34);
  assert.deepEqual(b.poids, { kg: 66.5, source: 'pesee' });
  const i = b.indicateurs;
  assert.equal(i.ratio.valeur.toFixed(2), '0.45');
  assert.equal(i.ratio.zone.nom, 'sain');
  assert.equal(i.imc.valeur.toFixed(1), '20.1');
  assert.equal(i.imc.zone.nom, 'sain');
  assert.equal(i.graisse.zone.nom, 'sain');
  assert.deepEqual(i.graisse.graduations, [8, 20, 25]);
  assert.equal(i.maigre.valeur.toFixed(1), '17.4');
  assert.equal(i.maigre.reference, 18.9);
  assert.equal(b.note, 'Ton ventre n’a rien à perdre. Ton chantier, c’est le volume : mange à ta faim.');
  assert.deepEqual(b.suivis.map(s => [s.cle, s.points.length]), [['bras', 1], ['hanches', 1]]);
  assert.equal(b.avant, null);
});

test('bilan d’Ida : l’âge déplace les repères de masse grasse, pas les autres', () => {
  const p = profil({ hauteur: 177, naissance: 1980, sexe: 'homme' });
  const m = { id: 'v1', date: D, bras: 32, taille: 92, hanches: 98, graisse: 21, poids: 85 };
  const b = V.bilanIda(p, m);
  assert.equal(b.age, 46);
  assert.deepEqual(b.indicateurs.graisse.graduations, [11, 22, 28]);
  assert.equal(b.indicateurs.graisse.zone.nom, 'sain', '21 % : sain à 46 ans, élevé à 31 ans');
  assert.equal(b.indicateurs.ratio.zone.nom, 'accru');
  assert.equal(b.indicateurs.imc.zone.nom, 'surpoids');
  assert.deepEqual(b.poids, { kg: 85, source: 'visite' });
  assert.equal(b.note, 'Ton tour de taille dépasse la moitié de ta taille : on le surveille.');
  const f = V.bilanIda(profil({ hauteur: 165, naissance: 1994, sexe: 'femme' }), { date: D, taille: 70, graisse: 26, poids: 58 });
  assert.deepEqual(f.indicateurs.graisse.graduations, [21, 33, 39]);
  assert.equal(f.indicateurs.maigre.reference, 15.4);
});

test('bilan d’Ida : sans fiche d’admission, seuls les suivis sans norme ; la visite suivante donne les écarts', () => {
  const p = profil();
  const a = { id: 'v1', date: D, bras: 31, taille: 83, hanches: 91 };
  const b = { id: 'v2', date: V.addDays(D, 14), bras: 31.6, taille: 83, hanches: 92 };
  p.mesures.push(a, b);
  assert.equal(V.admissionComplete(p), false);
  const r = V.bilanIda(p, b);
  assert.deepEqual(Object.keys(r.indicateurs), []);
  assert.equal(r.note, '');
  assert.equal(r.avant, D);
  assert.deepEqual(r.ecarts, [{ cle: 'bras', nom: 'Bras', ecart: 0.6 }, { cle: 'taille', nom: 'Taille', ecart: 0 }, { cle: 'hanches', nom: 'Hanches', ecart: 1 }]);
  assert.deepEqual(r.suivis.find(s => s.cle === 'bras').points.map(x => x.valeur), [31, 31.6]);
});

test('mise à jour v9 : invitation au bilan seulement après une première visite', () => {
  const avec = profil(); avec.v = 8; avec.mesures.push({ id: 'v1', date: D, bras: 31 });
  const sans = profil(); sans.v = 8;
  V.migrer(avec); V.migrer(sans);
  assert.equal(avec.v, 11);
  assert.deepEqual(avec.annonces, ['bilan', 'photos']);
  assert.equal(sans.annonces, undefined);
});

test('catalogue : élévations latérales à l’élastique, complément des épaules', () => {
  const p = profil();
  assert.equal(V.CATALOGUE.elevations.type, 'elastique');
  assert.deepEqual(V.defautExercice('elevations'), { id: 'elevations', actif: false, series: 3, charge: 5 });
  assert.deepEqual(V.definirPriorites(p, ['epaules']), ['elevations']);
  assert.equal(V.reglage(p.programme.find(e => e.id === 'elevations'), p), 'Élastique de 5 kg');
});

function avecPhotos(p) {
  p.photos = [
    { id: 'a-face', date: '2026-09-29', angle: 'face' }, { id: 'a-dos', date: '2026-09-29', angle: 'dos' },
    { id: 'b-face', date: '2026-10-13', angle: 'face' }, { id: 'b-profil', date: '2026-10-13', angle: 'profil' }, { id: 'b-dos', date: '2026-10-13', angle: 'dos' }
  ];
  return p;
}

test('fiche signalétique : la première et la dernière photo de chaque angle', () => {
  const p = avecPhotos(profil());
  const paires = V.pairesPhotos(p);
  assert.deepEqual(paires.map(x => [x.angle, x.avant && x.avant.id, x.apres.id]), [['face', 'a-face', 'b-face'], ['profil', null, 'b-profil'], ['dos', 'a-dos', 'b-dos']]);
  assert.equal(V.derniereDatePhotos(p), '2026-10-13');
  assert.equal(V.photoDe(p, '2026-10-13', 'profil').id, 'b-profil');
});

test('regard d’Ida : consigne, images dans l’ordre annoncé, plafond d’images par paires entières', () => {
  const p = avecPhotos(profil({ priorites: ['bras', 'jambes'] }));
  const r = V.promptRegard(p, 6);
  assert.deepEqual(r.images.map(x => x.id), ['a-face', 'b-face', 'b-profil', 'a-dos', 'b-dos']);
  assert.match(r.texte, /Image 1 : face, 2026-09-29, première photo\.\nImage 2 : face, 2026-10-13, dernière photo\./);
  assert.match(r.texte, /Image 3 : profil, 2026-10-13, seule photo pour l’instant\./);
  assert.match(r.texte, /Groupes musculaires prioritaires : bras, jambes, fessiers\./);
  assert.match(r.texte, /sans conseil de régime/);
  assert.match(r.texte, /- curl : Curl biceps aux haltères \(bras\), au programme/);
  assert.deepEqual(V.promptRegard(p, 3).images.map(x => x.id), ['a-face', 'b-face', 'b-profil'], 'trois images au plus : la paire du dos ne tient pas');
});

test('regard d’Ida : la réponse est vérifiée, seules les actions possibles restent', () => {
  const p = profil({ priorites: ['bras', 'jambes'] });
  p.programme.push(V.defautExercice('elevations'));
  const r = V.lireRegard(p, { changements: 'Les bras se dessinent.', posture: 'Épaules en avant.', conseils: ['Garde les tractions.', 'Ajoute du volume aux épaules.', 'De trop'],
    actions: [{ type: 'activer', exercice: 'curl' }, { type: 'activer', exercice: 'inconnu' }, { type: 'activer', exercice: 'elevations' }, { type: 'priorites', groupes: ['bras', 'jambes'] }, { type: 'priorites', groupes: ['epaules', 'bras', 'dos'] }],
    conditions: '' });
  assert.deepEqual(r.conseils, ['Garde les tractions.', 'Ajoute du volume aux épaules.']);
  assert.deepEqual(r.actions, [{ type: 'activer', exercice: 'elevations' }, { type: 'priorites', groupes: ['epaules', 'bras'] }], 'curl déjà au programme, exercice inconnu et priorités identiques écartés');
  assert.equal(V.lireRegard(p, { posture: 'sans changements' }), null, 'un rapport sans observation est refusé');
  assert.equal(V.lireRegard(p, ['liste']), null);
  const faits = V.appliquerActions(p, r.actions);
  assert.deepEqual(faits, ['ajouter élévations latérales à l’élastique', 'priorités : épaules et bras']);
  assert.equal(p.programme.find(e => e.id === 'elevations').actif, true);
  assert.deepEqual(p.priorites, ['epaules', 'bras']);
});

test('mise à jour v10 : élévations latérales au programme (inactives), fiche signalétique vide', () => {
  const p = profil(); p.v = 9; delete p.photos; delete p.rapports;
  p.programme = p.programme.filter(e => e.id !== 'elevations');
  p.mesures.push({ id: 'v1', date: D, bras: 31 });
  V.migrer(p);
  assert.equal(p.v, 11);
  assert.deepEqual(p.programme.find(e => e.id === 'elevations'), { id: 'elevations', actif: false, series: 3, charge: 5 });
  assert.deepEqual([p.photos, p.rapports, p.annonces], [[], [], ['photos']]);
  assert.deepEqual(V.migrer(JSON.parse(JSON.stringify(p))), p);
});

// ---------- Exercices à charge : le coach bouge la charge, pas la fourchette
test('charge : trop léger dès la première séance, l’élastique au-dessus, la fourchette en alternative', () => {
  const p = profil();
  const dev = p.programme[1];
  dev.charge = 25;
  const a = avecSeance(p, [], D, [{ id: 'developpe', reglage: V.reglage(dev, p), prevu: 3, series: [20, 20, 18] }]);
  const props = V.calibrer(p, a);
  assert.equal(props.length, 1);
  assert.equal(props[0].sens, 1);
  assert.equal(props[0].vers.charge, 30);
  assert.equal(props[0].texte, 'Élastique de 30 kg (10 + 20)');
  assert.equal(props[0].saut, undefined);
  assert.deepEqual(props[0].alternative, [15, 25]);
  V.repondreCalibrage(p, 'developpe', true);
  assert.equal(p.programme[1].charge, 30);
  assert.equal(V.estCalibre(p.programme[1]), true, 'nouvelle charge : pas de recalibrage, la double progression suit');
  assert.equal(V.fourchette(p.programme[1]).max, 12, 'la fourchette du coach reste');
});

test('charge : beaucoup trop léger, plusieurs crans d’un coup', () => {
  const p = profil();
  p.programme[1].charge = 25;
  const a = avecSeance(p, [], D, [{ id: 'developpe', reglage: V.reglage(p.programme[1], p), prevu: 3, series: [30, 28, 25] }]);
  assert.equal(V.calibrer(p, a)[0].texte, 'Élastique de 35 kg (15 + 20)');
});

test('charge : un gros cran est proposé quand même, signalé comme tel', () => {
  const p = profil();
  const a = avecSeance(p, [], D, [{ id: 'curl', reglage: V.reglage(p.programme[2], p), prevu: 3, series: [15, 15, 14] }]);
  const x = V.calibrer(p, a)[0];
  assert.equal(x.vers.charge, 10);
  assert.equal(x.saut, true);
  assert.deepEqual(x.alternative, [12, 20]);
});

test('charge : trop lourd, l’élastique en dessous ; au bout de l’échelle, la fourchette s’adapte', () => {
  const p = profil();
  p.programme[1].charge = 20;
  const a = avecSeance(p, [], D, [{ id: 'developpe', reglage: V.reglage(p.programme[1], p), prevu: 3, series: [6, 5, 4] }]);
  const x = V.calibrer(p, a)[0];
  assert.equal(x.sens, -1);
  assert.equal(x.vers.charge, 15);
  const q = profil();
  q.programme[1].charge = 5;
  const b = avecSeance(q, [], D, [{ id: 'developpe', reglage: V.reglage(q.programme[1], q), prevu: 3, series: [4, 3, 3] }]);
  const y = V.calibrer(q, b)[0];
  assert.equal(y.vers, undefined);
  assert.deepEqual(y.reps, [3, 5]);
});

test('charge : dans la fourchette, rien à proposer ; l’alternative garde la charge', () => {
  const p = profil();
  p.programme[1].charge = 25;
  const a = avecSeance(p, [], D, [{ id: 'developpe', reglage: V.reglage(p.programme[1], p), prevu: 3, series: [12, 10, 9] }]);
  assert.equal(V.calibrer(p, a).length, 0);
  assert.equal(V.estCalibre(p.programme[1]), true);
  const q = profil();
  q.programme[1].charge = 25;
  const b = avecSeance(q, [], D, [{ id: 'developpe', reglage: V.reglage(q.programme[1], q), prevu: 3, series: [20, 20, 18] }]);
  V.calibrer(q, b);
  V.repondreCalibrage(q, 'developpe', 'alt');
  assert.equal(q.programme[1].charge, 25);
  assert.deepEqual(q.programme[1].reps, [15, 25]);
  assert.equal(V.estCalibre(q.programme[1]), true);
});

test('charge changée en cours de séance : la double progression lit le dernier réglage', () => {
  const p = profil();
  const dev = p.programme[1];
  dev.charge = 30; dev.calibre = 'charge';
  const s = [];
  const deux = [{ id: 'developpe', reglage: 'Élastique de 25 kg (10 + 15)', prevu: 1, series: [14] },
    { id: 'developpe', reglage: 'Élastique de 30 kg (10 + 20)', prevu: 2, series: [12, 12] }];
  avecSeance(p, s, D, deux);
  avecSeance(p, s, V.addDays(D, 3), deux);
  const sug = V.suggestions(p, s).filter(x => x.id === 'developpe');
  assert.equal(sug.length, 1);
  assert.equal(sug[0].vers, 'Élastique de 35 kg (15 + 20)');
});

test('mise à jour v11 : une fourchette en attente pour un exercice à charge devient une charge', () => {
  const p = profil();
  p.v = 10;
  p.programme[1].charge = 25;
  const abdos = p.programme[3];
  p.calibrages = [
    { id: 'developpe', cle: 'charge', reglage: V.reglage(p.programme[1], p), seance: 's1', series: [20, 20, 18], reps: [15, 25] },
    { id: 'abdos', cle: 'n2', reglage: V.reglage(abdos, p), seance: 's1', series: [12, 12, 11], reps: [10, 15] }
  ];
  V.migrer(p);
  assert.equal(p.v, 11);
  const dev = p.calibrages.find(x => x.id === 'developpe'), ab = p.calibrages.find(x => x.id === 'abdos');
  assert.equal(dev.vers.charge, 30);
  assert.equal(dev.reps, undefined);
  assert.deepEqual(dev.alternative, [15, 25]);
  assert.deepEqual(ab.reps, [10, 15], 'les exercices au poids du corps gardent leur proposition');
  assert.equal(V.calibragesEnAttente(p).length, 2);
});
