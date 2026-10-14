/* Valgrise : moteur de règles du prototype.
   Fonctions pures. L'état du jeu est rejoué à partir du profil et des séances,
   jour par jour, ce qui applique correctement les pauses déclarées après coup. */
(function (root) {
  'use strict';

  // ---------- Dates (chaînes AAAA-MM-JJ, calcul en UTC pour éviter les changements d'heure)
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localToday(now) {
    const d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function toUTC(s) { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fromUTC(ms) { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fromUTC(toUTC(s) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  function isoWeekday(s) { const w = new Date(toUTC(s)).getUTCDay(); return w === 0 ? 7 : w; }
  function weekKey(s) {
    const d = new Date(toUTC(s));
    const wd = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - wd);
    const y = d.getUTCFullYear();
    const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return y + '-S' + pad(w);
  }

  // ---------- Constantes de jeu (document de conception)
  const STOCK_MAX = 7;
  const CHUTE_A = 6;           // 3 jours de faim + 2 d'agonie, chute au 6e matin sans ration
  const MINUTES_MAX_JOUR = 90;
  const BONUS_PREVUE = 1.2;
  const BONUS_SEMAINE = 250;
  const CONVALESCENCE = 2;
  const ABSENCE_MAX = 21;
  const RETRO_MAX = 7;

  function xpPourNiveau(n) { return 200 + 80 * n; }            // XP pour passer de n à n + 1
  function xpCumulee(L) { return (L - 1) * (200 + 40 * L); }   // XP totale pour atteindre L
  function niveau(xp) {
    let L = 1;
    while (xp >= xpCumulee(L + 1)) L++;
    return { niveau: L, dans: xp - xpCumulee(L), besoin: xpPourNiveau(L) };
  }

  // ---------- Élastiques : ceux que possède le joueur, combinés jusqu'à trois à la fois
  const ELASTIQUES_DEPART = [5, 10, 15, 20];   // le kit SmartWorkout de départ
  const COMBINAISON_MAX = 3;
  const ELASTIQUE_MIN = 0.5, ELASTIQUE_MAX = 100, ELASTIQUES_NB_MAX = 10;
  function arrondi(x) { return Math.round(x * 10) / 10; }
  function kgTexte(n) { return String(n).replace('.', ','); }
  function elastiquesDe(p) {
    const l = p && Array.isArray(p.elastiques) ? p.elastiques.filter(function (k) { return typeof k === 'number' && k > 0; }) : [];
    return l.length ? l : ELASTIQUES_DEPART;
  }
  // Moins d'élastiques d'abord, puis la combinaison la plus équilibrée (25 kg = 10 + 15 plutôt que 5 + 20)
  function preferee(a, b) {
    if (a.length !== b.length) return a.length < b.length;
    return a[a.length - 1] < b[b.length - 1];
  }
  // Toutes les résistances possibles, chacune avec sa meilleure combinaison (élastiques triés du plus léger au plus lourd)
  function combinaisons(p) {
    const b = elastiquesDe(p).slice().sort(function (x, y) { return x - y; });
    const meilleures = {};
    function retenir(combo) {
      const t = arrondi(combo.reduce(function (s, k) { return s + k; }, 0));
      if (!meilleures[t] || preferee(combo, meilleures[t])) meilleures[t] = combo;
    }
    for (let i = 0; i < b.length; i++) {
      retenir([b[i]]);
      for (let j = i + 1; j < b.length && COMBINAISON_MAX >= 2; j++) {
        retenir([b[i], b[j]]);
        for (let k = j + 1; k < b.length && COMBINAISON_MAX >= 3; k++) retenir([b[i], b[j], b[k]]);
      }
    }
    return Object.keys(meilleures).map(Number).sort(function (x, y) { return x - y; })
      .map(function (t) { return { kg: t, elastiques: meilleures[t] }; });
  }
  function resistances(p) { return combinaisons(p).map(function (c) { return c.kg; }); }
  function libelleElastique(kg, p) {
    const c = combinaisons(p).filter(function (x) { return x.kg === kg; })[0];
    return kgTexte(kg) + ' kg' + (c && c.elastiques.length > 1 ? ' (' + c.elastiques.map(kgTexte).join(' + ') + ')' : '');
  }

  // ---------- Catalogue d'exercices (échelons construits sur le matériel)
  // Groupes musculaires que le joueur peut mettre en priorité (deux au plus)
  const GROUPES = [
    { id: 'bras', nom: 'Bras' }, { id: 'abdos', nom: 'Abdos' }, { id: 'pectoraux', nom: 'Pectoraux' },
    { id: 'epaules', nom: 'Épaules' }, { id: 'dos', nom: 'Dos' }, { id: 'jambes', nom: 'Jambes, fessiers' }
  ];
  // Exercices que le coach ajoute quand un groupe devient prioritaire
  const COMPLEMENTS = { bras: ['chinup', 'triceps'], abdos: ['releves'], dos: ['chinup'], jambes: ['squat', 'hipthrust'], epaules: ['elevations'] };
  const ORDRE = ['chinup', 'curl', 'triceps', 'squat', 'hipthrust', 'pompes', 'developpe', 'elevations', 'rowing', 'abdos', 'releves'];
  const CATALOGUE = {
    pompes: { nom: 'Pompes', stat: 'Poussée', groupes: ['pectoraux'], type: 'variante', min: 8, max: 12,
      variantes: ['Pompes inclinées', 'Pompes', 'Pompes pieds surélevés', 'Pompes diamant', 'Pompes archer', 'Pompes lestées'] },
    developpe: { nom: 'Développé vertical à l’élastique', stat: 'Poussée', groupes: ['epaules'], type: 'elastique', min: 8, max: 12 },
    curl: { nom: 'Curl biceps aux haltères', stat: 'Tirage', groupes: ['bras'], type: 'charge', min: 8, max: 12, pas: 2, depart: 8 },
    triceps: { nom: 'Extension triceps à l’élastique', stat: 'Poussée', groupes: ['bras'], type: 'elastique', min: 10, max: 15, depart: 10,
      recommande: 'Élastique sous le pied, bras tendus au-dessus de la tête : le triceps fait la plus grosse part du bras.' },
    chinup: { nom: 'Tractions en supination', stat: 'Tirage', groupes: ['bras', 'dos'], type: 'variante', min: 5, max: 8,
      variantes: ['Tractions assistées, pieds sur une chaise', 'Tractions négatives, 5 s de descente', 'Tractions assistées, élastique 20 kg',
        'Tractions assistées, élastique 15 kg', 'Tractions assistées, élastique 10 kg', 'Tractions assistées, élastique 5 kg',
        'Tractions strictes', 'Tractions lestées'],
      recommande: 'Paumes vers toi : biceps et dos dans le même exercice.' },
    // fourchettes : répétitions propres à un échelon (les crunchs se comptent par 12 à 20, la roulette par 6 à 10)
    abdos: { nom: 'Abdos à la roulette', stat: 'Gainage', groupes: ['abdos'], type: 'variante', min: 6, max: 10,
      variantes: ['Crunchs', 'Roulette à genoux, partielle', 'Roulette à genoux', 'Roulette debout vers un mur', 'Roulette debout'],
      fourchettes: [[12, 20]] },
    releves: { nom: 'Relevés à la barre', stat: 'Gainage', groupes: ['abdos'], type: 'variante', min: 6, max: 12,
      variantes: ['Relevés de genoux', 'Relevés de genoux jusqu’à la poitrine', 'Relevés de jambes fléchies', 'Relevés de jambes tendues', 'Pieds à la barre'],
      recommande: 'Suspendu à la barre : le bas des abdos, en complément de la roulette.' },
    rowing: { nom: 'Rowing à l’élastique', stat: 'Tirage', groupes: ['dos'], type: 'elastique', min: 10, max: 15 },
    elevations: { nom: 'Élévations latérales à l’élastique', stat: 'Poussée', groupes: ['epaules'], type: 'elastique', min: 10, max: 15, depart: 5,
      recommande: 'Élastique sous les pieds, bras tendus sur les côtés jusqu’à l’horizontale : la largeur des épaules.' },
    // Mixte : des échelons au poids du corps, puis debout sur les élastiques, poignées aux épaules.
    // Les échelons d'élastique suivent les combinaisons que permettent les élastiques du joueur, à partir de 10 kg.
    squat: { nom: 'Squat', stat: 'Jambes', groupes: ['jambes'], type: 'mixte', min: 12, max: 20,
      variantes: ['Squat sur le banc', 'Squat au poids du corps', 'Squat lent, 3 s à la descente'],
      elastique: 'Squat à l’élastique de ', elastiqueMin: 10,
      recommande: 'Cuisses et fessiers : sur le banc, au poids du corps, puis debout sur les élastiques.' },
    hipthrust: { nom: 'Hip thrust à l’haltère', stat: 'Jambes', groupes: ['jambes'], type: 'charge', min: 10, max: 15, pas: 2, unHaltere: true, depart: 10,
      recommande: 'Dos appuyé contre le canapé, haltère sur les hanches : il complète le squat pour les fessiers.' }
  };
  // Fourchette de répétitions : celle que le joueur a choisie, sinon celle du coach pour le réglage en cours
  const FOURCHETTES = [[3, 5], [4, 6], [5, 8], [6, 10], [8, 12], [10, 15], [12, 20], [15, 25]];
  function fourchetteValide(r) {
    return Array.isArray(r) && r.length === 2 && r.every(function (n) { return Number.isInteger(n); }) && r[0] >= 1 && r[1] > r[0] && r[1] <= 100;
  }
  function fourchetteCoach(ex) {
    const c = CATALOGUE[ex.id];
    const f = c.type === 'variante' && c.fourchettes && c.fourchettes[ex.niveau];
    return f ? { min: f[0], max: f[1] } : { min: c.min, max: c.max };
  }
  function fourchette(ex) {
    return fourchetteValide(ex.reps) ? { min: ex.reps[0], max: ex.reps[1], perso: true } : fourchetteCoach(ex);
  }
  // Fourchettes proposées au joueur : les habituelles, plus celle du coach si elle n'en fait pas partie
  function fourchettesProposees(ex) {
    const coach = fourchetteCoach(ex), l = FOURCHETTES.slice();
    if (!l.some(function (f) { return f[0] === coach.min && f[1] === coach.max; })) l.push([coach.min, coach.max]);
    return l.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  }
  // Échelons d'élastique d'un exercice mixte : les résistances possibles à partir de son seuil
  function etapesElastique(c, p) {
    return resistances(p).filter(function (kg) { return kg >= (c.elastiqueMin || 0); });
  }
  function nomGroupe(id) {
    for (let i = 0; i < GROUPES.length; i++) if (GROUPES[i].id === id) return GROUPES[i].nom;
    return id;
  }
  function defautExercice(id) {
    const c = CATALOGUE[id];
    const e = { id: id, actif: false, series: 3 };
    if (c.type === 'variante' || c.type === 'mixte') e.niveau = 0;
    else e.charge = c.depart || (c.type === 'elastique' ? 15 : 8);
    return e;
  }

  // ---------- Visite au dispensaire : mensurations toutes les deux semaines, sans XP
  const VISITE_JOURS = 14;
  const MESURES = [
    { cle: 'bras', nom: 'Tour de bras', court: 'Bras', min: 15, max: 70, aide: 'Bras contracté, au plus large.' },
    { cle: 'taille', nom: 'Tour de taille', court: 'Taille', min: 40, max: 200, aide: 'Au niveau du nombril, ventre relâché.' },
    { cle: 'hanches', nom: 'Tour de hanches', court: 'Hanches', min: 50, max: 200, aide: 'Au plus large des fessiers, pieds joints.' }
  ];
  function mesuresTriees(p) {
    return (p.mesures || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function prochaineVisite(p, aujourdhui) {
    const m = mesuresTriees(p);
    return m.length ? addDays(m[m.length - 1].date, VISITE_JOURS) : aujourdhui;
  }
  function visiteDue(p, aujourdhui) { return prochaineVisite(p, aujourdhui) <= aujourdhui; }

  // ---------- Pesée : le registre retient la moyenne sur 7 jours, jamais d'XP
  const POIDS_MIN = 30, POIDS_MAX = 300;
  function peseesTriees(p) {
    return (p.pesees || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function moyennePoids(p, date) {
    const debut = addDays(date, -6);
    const l = (p.pesees || []).filter(function (x) { return x.date >= debut && x.date <= date; });
    if (!l.length) return null;
    return { kg: Math.round(l.reduce(function (t, x) { return t + x.kg; }, 0) / l.length * 10) / 10, n: l.length };
  }
  // Écart entre la moyenne de cette semaine et celle de la précédente ; au moins deux pesées de chaque côté
  function tendancePoids(p, date) {
    const now = moyennePoids(p, date), avant = moyennePoids(p, addDays(date, -7));
    if (!now || !avant || now.n < 2 || avant.n < 2) return null;
    const ecart = Math.round((now.kg - avant.kg) * 10) / 10;
    return { ecart: ecart, pct: ecart / avant.kg, rapide: ecart / avant.kg < -0.01 };
  }
  function seriePoids(p, date, jours) {
    const debut = addDays(date, -(jours - 1));
    return peseesTriees(p).filter(function (x) { return x.date >= debut && x.date <= date; })
      .map(function (x) { return { date: x.date, kg: x.kg, moyenne: moyennePoids(p, x.date).kg }; });
  }
  // Rappel sur la carte : seulement le matin, et seulement si la pesée du jour manque
  function rappelPesee(p, date, heure) {
    const r = p.rappelPesee || 'matin';
    if (r === 'jamais' || heure >= 12) return false;
    if (r === 'lundi' && isoWeekday(date) !== 1) return false;
    if (p.peseeReportee === date) return false;
    return !(p.pesees || []).some(function (x) { return x.date === date; });
  }
  // ---------- Bilan d'Ida : repères de santé pour adultes, et suivi sans norme des bras et des hanches.
  // Tour de taille ÷ taille : NICE 2022. IMC : OMS. Masse grasse selon l'âge et le sexe : Gallagher et al. 2000.
  // Indice de masse maigre : médiane des 18-34 ans, Schutz et al. 2002. Jamais d'XP.
  const HAUTEUR_MIN = 120, HAUTEUR_MAX = 230, GRAISSE_MIN = 2, GRAISSE_MAX = 60;
  // [âge de, âge à, sain à partir de, élevé à partir de, très élevé à partir de]
  const GRAISSE_REPERES = {
    homme: [[20, 39, 8, 20, 25], [40, 59, 11, 22, 28], [60, 79, 13, 25, 30]],
    femme: [[20, 39, 21, 33, 39], [40, 59, 23, 34, 40], [60, 79, 24, 36, 42]]
  };
  const MASSE_MAIGRE_MEDIANE = { homme: 18.9, femme: 15.4 };
  function ageA(p, date) { return p.naissance ? +date.slice(0, 4) - p.naissance : null; }
  function admissionComplete(p) { return !!(p.hauteur && p.naissance && p.sexe); }
  // Poids d'une visite : noté à la visite, sinon la moyenne de la pesée sur 7 jours
  function poidsVisite(p, m) {
    if (typeof m.poids === 'number') return { kg: m.poids, source: 'visite' };
    const moy = moyennePoids(p, m.date);
    return moy ? { kg: moy.kg, source: 'pesee' } : null;
  }
  function zoneDe(zones, v) {
    for (let i = 0; i < zones.length; i++) if (v >= zones[i].de && v < zones[i].a) return zones[i];
    return v < zones[0].de ? zones[0] : zones[zones.length - 1];
  }
  function indicateur(o) { o.zone = o.zones.length ? zoneDe(o.zones, o.valeur) : null; return o; }
  function bilanIda(p, m) {
    const h = p.hauteur, pv = poidsVisite(p, m), age = ageA(p, m.date), sexe = p.sexe;
    const ind = {};
    if (h && typeof m.taille === 'number') {
      ind.ratio = indicateur({ nom: 'Tour de taille ÷ taille', valeur: m.taille / h, decimales: 2, min: 0.35, max: 0.7, pas: 0.01, graduations: [0.4, 0.5, 0.6],
        zones: [{ de: 0, a: 0.4, type: 'neutre', nom: '' }, { de: 0.4, a: 0.5, type: 'sain', nom: 'sain' },
          { de: 0.5, a: 0.6, type: 'risque', nom: 'accru' }, { de: 0.6, a: Infinity, type: 'risque', nom: 'élevé' }] });
    }
    if (h && pv) {
      ind.imc = indicateur({ nom: 'Indice de masse corporelle', valeur: pv.kg / Math.pow(h / 100, 2), decimales: 1, min: 15, max: 35, pas: 0.5, graduations: [18.5, 25, 30],
        zones: [{ de: 0, a: 18.5, type: 'risque', nom: 'maigreur' }, { de: 18.5, a: 25, type: 'sain', nom: 'sain' },
          { de: 25, a: 30, type: 'risque', nom: 'surpoids' }, { de: 30, a: Infinity, type: 'risque', nom: 'obésité' }] });
    }
    if (typeof m.graisse === 'number' && sexe) {
      const tranches = GRAISSE_REPERES[sexe];
      const t = tranches.filter(function (x) { return age != null && age <= x[1]; })[0] || tranches[age != null && age > 79 ? 2 : 0];
      const homme = sexe === 'homme';
      ind.graisse = indicateur({ nom: 'Masse grasse, selon ta balance', valeur: m.graisse, decimales: 1, unite: ' %', min: homme ? 0 : 10, max: homme ? 35 : 50, pas: 1,
        graduations: [t[2], t[3], t[4]], tranche: t[0] + ' à ' + t[1] + ' ans',
        zones: [{ de: 0, a: t[2], type: 'risque', nom: 'bas' }, { de: t[2], a: t[3], type: 'sain', nom: 'sain' },
          { de: t[3], a: t[4], type: 'risque', nom: 'élevé' }, { de: t[4], a: Infinity, type: 'risque', nom: 'très élevé' }] });
      if (h && pv) {
        const ref = MASSE_MAIGRE_MEDIANE[sexe];
        ind.maigre = indicateur({ nom: 'Indice de masse maigre', valeur: pv.kg * (1 - m.graisse / 100) / Math.pow(h / 100, 2), decimales: 1,
          min: homme ? 14 : 11, max: homme ? 24 : 21, pas: 0.5, graduations: [], reference: ref, zones: [] });
      }
    }
    const visites = mesuresTriees(p).filter(function (x) { return x.date <= m.date; });
    const suivis = MESURES.filter(function (d) { return d.cle !== 'taille'; }).map(function (d) {
      return { cle: d.cle, nom: d.nom, points: visites.filter(function (x) { return typeof x[d.cle] === 'number'; }).map(function (x) { return { date: x.date, valeur: x[d.cle] }; }) };
    }).filter(function (s) { return s.points.length; });
    const avant = visites.filter(function (x) { return x.date < m.date; }).slice(-1)[0] || null;
    const ecarts = avant ? MESURES.filter(function (d) { return typeof m[d.cle] === 'number' && typeof avant[d.cle] === 'number'; })
      .map(function (d) { return { cle: d.cle, nom: d.court, ecart: Math.round((m[d.cle] - avant[d.cle]) * 10) / 10 }; }) : [];
    return { date: m.date, hauteur: h, age: age, poids: pv, indicateurs: ind, suivis: suivis, avant: avant ? avant.date : null, ecarts: ecarts, note: noteIda(ind) };
  }
  // Ce qu'Ida dit, à partir des repères de santé
  function noteIda(ind) {
    const r = ind.ratio, imc = ind.imc, mm = ind.maigre, l = [];
    if (r && r.valeur >= 0.6) l.push('Ton tour de taille est élevé pour ta taille : parles-en à un médecin.');
    else if (r && r.valeur >= 0.5) l.push('Ton tour de taille dépasse la moitié de ta taille : on le surveille.');
    if (imc && imc.valeur < 18.5) l.push('Tu es sous la zone saine : mange à ta faim, et vois un médecin si ça dure.');
    else if (imc && imc.valeur >= 25 && r && r.valeur < 0.5) l.push('IMC haut mais ventre sain : souvent le signe d’une carrure solide.');
    if (!l.length && r) {
      if ((imc && imc.valeur < 21) || (mm && mm.valeur < mm.reference)) l.push('Ton ventre n’a rien à perdre. Ton chantier, c’est le volume : mange à ta faim.');
      else l.push('Tout est dans les clous. On suit tes courbes.');
    }
    return l.join(' ');
  }
  // ---------- Fiche signalétique : photos de suivi et regard d'Ida (analyse par Claude, version privée seulement)
  const ANGLES = [{ cle: 'face', nom: 'Face' }, { cle: 'profil', nom: 'Profil' }, { cle: 'dos', nom: 'Dos' }];
  function photosTriees(p) {
    return (p.photos || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function photoDe(p, date, angle) {
    return (p.photos || []).filter(function (x) { return x.date === date && x.angle === angle; })[0] || null;
  }
  // Angle par angle : la première photo et la dernière (une seule tant qu'il n'y en a qu'une)
  function pairesPhotos(p) {
    return ANGLES.map(function (a) {
      const l = photosTriees(p).filter(function (x) { return x.angle === a.cle; });
      return l.length ? { angle: a.cle, nom: a.nom, avant: l.length > 1 ? l[0] : null, apres: l[l.length - 1] } : null;
    }).filter(Boolean);
  }
  function derniereDatePhotos(p) { const l = photosTriees(p); return l.length ? l[l.length - 1].date : null; }
  // Consigne envoyée à Claude avec les photos ; au plus maxImages photos, paires gardées entières
  function promptRegard(p, maxImages) {
    const max = maxImages || 6, images = [], lignes = [];
    pairesPhotos(p).forEach(function (pr) {
      const n = pr.avant ? 2 : 1;
      if (images.length + n > max) return;
      if (pr.avant) { images.push(pr.avant); lignes.push('Image ' + images.length + ' : ' + pr.nom.toLowerCase() + ', ' + pr.avant.date + ', première photo.'); }
      images.push(pr.apres);
      lignes.push('Image ' + images.length + ' : ' + pr.nom.toLowerCase() + ', ' + pr.apres.date + (pr.avant ? ', dernière photo.' : ', seule photo pour l’instant.'));
    });
    const prio = (p.priorites || []).map(nomGroupe).join(', ').toLowerCase() || 'aucune';
    const m = mesuresTriees(p).slice(-1)[0];
    const chiffres = [];
    if (m) {
      const b = bilanIda(p, m), i = b.indicateurs;
      if (i.ratio) chiffres.push('Tour de taille ÷ taille : ' + i.ratio.valeur.toFixed(2) + ' (' + i.ratio.zone.nom + ').');
      if (i.imc) chiffres.push('IMC : ' + i.imc.valeur.toFixed(1) + ' (' + i.imc.zone.nom + ').');
      if (i.graisse) chiffres.push('Masse grasse selon sa balance : ' + i.graisse.valeur + ' %.');
      if (i.maigre) chiffres.push('Indice de masse maigre : ' + i.maigre.valeur.toFixed(1) + ' (médiane de référence ' + i.maigre.reference + ').');
      ['bras', 'taille', 'hanches'].forEach(function (k) { if (typeof m[k] === 'number') chiffres.push('Tour de ' + k + ' : ' + m[k] + ' cm.'); });
      b.ecarts.forEach(function (e) { chiffres.push('Écart ' + e.nom.toLowerCase() + ' depuis la visite précédente : ' + e.ecart + ' cm.'); });
    }
    const exos = p.programme.filter(function (e) { return CATALOGUE[e.id]; }).map(function (e) {
      const c = CATALOGUE[e.id];
      return '- ' + e.id + ' : ' + c.nom + ' (' + c.groupes.map(nomGroupe).join(', ').toLowerCase() + ')' + (e.actif ? ', au programme' : ', pas au programme');
    });
    const texte = [
      'Tu es Ida, l’infirmière d’un camp de survivants, dans un jeu de suivi sportif. Le joueur t’envoie ses photos de suivi, prises chez lui.',
      'Son objectif : l’apparence avant tout, un peu de force. Groupes musculaires prioritaires : ' + prio + '.',
      'Règles : décris ce qui se voit et ce qui a changé, sans note, sans jugement sur sa beauté ni sur son corps, sans conseil de régime ni de perte de poids. Aucun diagnostic médical. Si deux photos d’un même angle ne sont pas comparables (lumière, distance, pose, vêtements), dis-le dans "conditions" et reste prudent. Tutoie-le, en français, phrases courtes.',
      'Photos :'].concat(lignes, ['Repères de sa dernière visite :'], chiffres.length ? chiffres : ['(aucun)'],
      ['Exercices de l’application (identifiant : nom) :'], exos, [
      'Réponds uniquement avec un objet JSON de cette forme :',
      '{"changements": "1 ou 2 phrases sur ce qui a changé entre les photos, ou sur l’état actuel s’il n’y a qu’une photo, en lien avec ses priorités", ' +
      '"posture": "une phrase, ou une chaîne vide", "conseils": ["au plus 2 conseils d’entraînement concrets"], ' +
      '"actions": [au plus 2 objets {"type": "activer", "exercice": "identifiant d’un exercice pas encore au programme"} ou {"type": "priorites", "groupes": ["1 ou 2 parmi bras, abdos, pectoraux, epaules, dos, jambes"]}], ' +
      '"conditions": "une phrase si des photos ne sont pas comparables, sinon une chaîne vide"}'
    ]).join('\n');
    return { texte: texte, images: images };
  }
  // Réponse de Claude, vérifiée : textes bornés, actions limitées à ce que l'application sait faire
  function lireRegard(p, r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const t = function (v) { return typeof v === 'string' ? v.trim().slice(0, 400) : ''; };
    const ids = GROUPES.map(function (g) { return g.id; });
    const actions = (Array.isArray(r.actions) ? r.actions : []).map(function (a) {
      if (!a || typeof a !== 'object') return null;
      if (a.type === 'activer' && CATALOGUE[a.exercice]) {
        const e = p.programme.filter(function (x) { return x.id === a.exercice; })[0];
        return e && e.actif ? null : { type: 'activer', exercice: a.exercice };
      }
      if (a.type === 'priorites' && Array.isArray(a.groupes)) {
        const g = a.groupes.filter(function (x, i, l) { return ids.indexOf(x) >= 0 && l.indexOf(x) === i; }).slice(0, 2);
        const actuelles = (p.priorites || []).slice().sort().join();
        return g.length && g.slice().sort().join() !== actuelles ? { type: 'priorites', groupes: g } : null;
      }
      return null;
    }).filter(Boolean).slice(0, 2);
    const rapport = { changements: t(r.changements), posture: t(r.posture),
      conseils: (Array.isArray(r.conseils) ? r.conseils : []).map(t).filter(Boolean).slice(0, 2), actions: actions, conditions: t(r.conditions) };
    return rapport.changements ? rapport : null;
  }
  function libelleAction(a) {
    if (a.type === 'activer') return 'ajouter ' + CATALOGUE[a.exercice].nom.charAt(0).toLowerCase() + CATALOGUE[a.exercice].nom.slice(1);
    return 'priorités : ' + a.groupes.map(nomGroupe).join(' et ').toLowerCase();
  }
  function appliquerActions(p, actions) {
    const faits = [];
    (actions || []).forEach(function (a) {
      if (a.type === 'activer' && CATALOGUE[a.exercice]) {
        let e = p.programme.filter(function (x) { return x.id === a.exercice; })[0];
        if (!e) { e = defautExercice(a.exercice); p.programme.push(e); }
        if (!e.actif) { e.actif = true; faits.push(libelleAction(a)); }
      } else if (a.type === 'priorites') {
        definirPriorites(p, a.groupes);
        faits.push(libelleAction(a));
      }
    });
    return faits;
  }
  // Écart de chaque mesure depuis la première visite où elle a été prise
  function ecartsMesures(p) {
    const m = mesuresTriees(p);
    return MESURES.map(function (def) {
      const points = m.filter(function (x) { return typeof x[def.cle] === 'number'; })
        .map(function (x) { return { date: x.date, valeur: x[def.cle] }; });
      const depart = points.length ? points[0].valeur : null;
      return { cle: def.cle, nom: def.court, depart: depart,
        points: points.map(function (pt) { return { date: pt.date, valeur: pt.valeur, ecart: Math.round((pt.valeur - depart) * 10) / 10 }; }) };
    });
  }
  // p (le profil) donne les élastiques du joueur ; sans lui, le kit de départ
  function reglage(ex, p) {
    const c = CATALOGUE[ex.id];
    if (c.type === 'variante') return c.variantes[ex.niveau];
    if (c.type === 'mixte') return ex.niveau < c.variantes.length ? c.variantes[ex.niveau] : c.elastique + libelleElastique(ex.charge, p);
    if (c.type === 'elastique') return 'Élastique de ' + libelleElastique(ex.charge, p);
    return c.unHaltere ? 'Un haltère de ' + ex.charge + ' kg' : ex.charge + ' kg par haltère';
  }
  function nomExercice(ex, p) {
    const c = CATALOGUE[ex.id];
    return c.type === 'variante' || c.type === 'mixte' ? reglage(ex, p) : c.nom;
  }
  // Position sur l'échelle d'un exercice à échelons : { rang, total } comptés à partir de 1
  function echelon(ex, p) {
    const c = CATALOGUE[ex.id];
    if (c.type === 'variante') return { rang: ex.niveau + 1, total: c.variantes.length };
    if (c.type !== 'mixte') return null;
    const etapes = etapesElastique(c, p), V = c.variantes.length;
    const i = ex.niveau < V ? ex.niveau : V + Math.max(0, etapes.indexOf(ex.charge));
    return { rang: i + 1, total: V + etapes.length };
  }

  // ---------- Lieux d'expédition et butin
  const LIEUX = [
    'La pharmacie de la rue Haute', 'La gare de triage', 'Le supermarché pillé', 'Le château d’eau',
    'Les jardins ouvriers', 'Le garage de la nationale', 'La médiathèque', 'Le lotissement des Tilleuls',
    'La coopérative agricole', 'L’école du bourg', 'Le pont de la Sucrerie', 'La caserne des pompiers'
  ];
  const TENUES = [
    { id: 'bonnet', nom: 'Bonnet de laine grise', rarete: 'commun' },
    { id: 'gants', nom: 'Gants de chantier', rarete: 'commun' },
    { id: 'echarpe', nom: 'Écharpe tricotée main', rarete: 'commun' },
    { id: 'bottes', nom: 'Bottes de pluie fendues', rarete: 'commun' },
    { id: 'frontale', nom: 'Lampe frontale sans piles', rarete: 'commun' },
    { id: 'bleu', nom: 'Veste de bleu de travail', rarete: 'peu commun' },
    { id: 'jute', nom: 'Sac de jute « Sucre 50 kg »', rarete: 'peu commun' },
    { id: 'soudeur', nom: 'Lunettes de soudeur', rarete: 'peu commun' },
    { id: 'brassard', nom: 'Brassard du Comité', rarete: 'peu commun' },
    { id: 'parka', nom: 'Parka militaire rapiécée', rarete: 'peu commun' }
  ];
  const RELIQUES = [
    { id: 'ticket', nom: 'Ticket de bus, ligne 4', histoire: 'Aller simple, composté le 14 novembre, la veille de la Coupure.' },
    { id: 'montre', nom: 'Montre arrêtée', histoire: 'Les aiguilles sont figées sur 4 h 12, comme toutes celles de la vallée.' },
    { id: 'carte', nom: 'Carte postale de la côte', histoire: '« On rentre dimanche. Garde le chat. » Jamais postée.' },
    { id: 'cassette', nom: 'Cassette « Été 98 »', histoire: 'Écrit au feutre sur l’étiquette. Plus rien pour l’écouter.' },
    { id: 'photo', nom: 'Photo de classe', histoire: 'CM2, 2019. Quelqu’un a entouré un visage au stylo.' },
    { id: 'badge', nom: 'Badge de la Sucrerie', histoire: 'Équipe de nuit, accès quai 3. La photo est délavée.' },
    { id: 'recettes', nom: 'Carnet de recettes', histoire: 'Confiture de rhubarbe, page cornée. L’écriture tremble à la fin.' },
    { id: 'cle', nom: 'Clé sans porte', histoire: 'Un porte-clés du club de hand de Valgrise. Aucune serrure ne lui va.' },
    { id: 'lettre', nom: 'Dernier courrier', histoire: 'Une facture d’électricité, distribuée le jour de la Coupure.' },
    { id: 'dessin', nom: 'Dessin d’enfant', histoire: 'Une maison, un soleil, quatre personnages. Le quatrième est barré.' }
  ];
  const CONSERVE = { id: 'conserve', nom: 'Conserve de haricots', rarete: 'commun' };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Plan hebdomadaire
  function ecartProchaineExpedition(date, jours) {
    for (let k = 1; k <= 7; k++) if (jours.indexOf(isoWeekday(addDays(date, k))) >= 0) return k;
    return 7;
  }
  function expeditionsPrevuesSemaine(seances, date) {
    const wk = weekKey(date);
    return seances.filter(function (s) { return s.prevue && weekKey(s.date) === wk; }).length;
  }
  // Faits figés au moment où la séance est enregistrée
  function faitsSeance(profil, seances, date, genre) {
    const cible = profil.plan.jours.length;
    const prevue = genre === 'expedition' && expeditionsPrevuesSemaine(seances, date) < cible;
    const premiereDuJour = !seances.some(function (s) { return s.date === date; });
    const base = prevue ? ecartProchaineExpedition(date, profil.plan.jours) + 1 : 1;
    return { prevue: prevue, rationsBase: premiereDuJour ? base : 0, cibleSemaine: cible };
  }
  function prochaineExpedition(profil, seances, aujourdhui) {
    const jours = profil.plan.jours;
    const faiteAujourdhui = seances.some(function (s) { return s.date === aujourdhui && s.genre === 'expedition'; });
    const quota = expeditionsPrevuesSemaine(seances, aujourdhui) >= jours.length;
    if (!faiteAujourdhui && !quota && jours.indexOf(isoWeekday(aujourdhui)) >= 0) return aujourdhui;
    let d = aujourdhui;
    for (let k = 1; k <= 14; k++) {
      d = addDays(aujourdhui, k);
      if (jours.indexOf(isoWeekday(d)) < 0) continue;
      if (quota && weekKey(d) === weekKey(aujourdhui)) continue;
      return d;
    }
    return d;
  }

  // ---------- Survivants et pauses
  function survivantA(profil, date) {
    let s = profil.survivants[0];
    for (let i = 0; i < profil.survivants.length; i++) if (profil.survivants[i].depuis <= date) s = profil.survivants[i];
    return s;
  }
  function ironmanA(profil, date) {
    const s = survivantA(profil, date);
    return s.mode === 'ironman' && !(s.renonce && date >= s.renonce);
  }
  function pauseA(profil, date, aujourdhui) {
    for (let i = 0; i < profil.pauses.length; i++) {
      const p = profil.pauses[i];
      const fin = p.fin || aujourdhui;
      if (p.debut <= date && date <= fin) return p;
    }
    return null;
  }

  // ---------- Simulation complète
  function simuler(profil, seancesBrutes, aujourdhui) {
    const seances = seancesBrutes.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0);
    });
    const morts = (profil.morts || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    const st = {
      stock: STOCK_MAX, faim: 0, xp: 0, convalescence: 0, cicatrices: 0,
      chutes: [], nouvellesMorts: [], possede: {}, inventaire: [], sansRare: 0,
      bonusSemaine: {}, prevuesSemaine: {}, resultats: {}, expeditions: 0
    };
    let idx = 0;
    const debut = profil.debut;
    const fin = aujourdhui < debut ? debut : aujourdhui;
    for (let d = debut; d <= fin; d = addDays(d, 1)) {
      // Mort Ironman déjà actée : définitive, même si une pause est déclarée après coup
      const morte = morts.filter(function (m) { return m.date === d; })[0];
      if (morte) appliquerMort(st);
      else if (d > debut) {
        // Le matin, le survivant mange
        if (!pauseA(profil, d, aujourdhui)) {
          if (st.stock > 0) st.stock--;
          else {
            st.faim++;
            if (st.faim >= CHUTE_A) {
              if (ironmanA(profil, d)) { st.nouvellesMorts.push(d); appliquerMort(st); }
              else { st.cicatrices++; st.convalescence = CONVALESCENCE; st.stock = 3; st.faim = 0; st.chutes.push(d); }
            }
          }
        }
      }
      // Séances du jour
      let minutesJour = 0, rangJour = 0;
      while (idx < seances.length && seances[idx].date === d) {
        const s = seances[idx++];
        const compte = Math.max(0, Math.min(s.minutes, MINUTES_MAX_JOUR - minutesJour));
        minutesJour += s.minutes;
        const charge = compte * s.effort;
        let mult = s.prevue ? BONUS_PREVUE : 1;
        const deuxieme = rangJour > 0;
        if (deuxieme) mult *= 0.5;
        const enConvalescence = st.convalescence > 0;
        if (enConvalescence) { mult *= 0.5; st.convalescence--; }
        let xp = Math.round(charge * mult);
        const avant = niveau(st.xp).niveau;
        const affame = st.faim > 0;
        let rations = deuxieme ? 0 : s.rationsBase;
        if (!deuxieme && affame) rations = Math.max(rations, 3);
        const stockAvant = st.stock;
        st.stock = Math.min(STOCK_MAX, st.stock + rations);
        if (!deuxieme) st.faim = 0;
        let bonus = 0;
        const wk = weekKey(d);
        if (s.prevue) {
          st.prevuesSemaine[wk] = (st.prevuesSemaine[wk] || 0) + 1;
          if (st.prevuesSemaine[wk] >= s.cibleSemaine && !st.bonusSemaine[wk]) { st.bonusSemaine[wk] = true; bonus = BONUS_SEMAINE; }
        }
        // Fouille, déterministe pour chaque séance
        const tirages = s.genre === 'expedition' ? (s.prevue ? 2 : 1) : 1;
        const butin = [];
        for (let t = 0; t < tirages; t++) butin.push(fouiller(st, s.id + ':' + t, charge));
        butin.forEach(function (b) { if (b.id === 'conserve') st.stock = Math.min(STOCK_MAX, st.stock + 1); });
        st.xp += xp + bonus;
        if (s.genre === 'expedition') st.expeditions++;
        st.resultats[s.id] = {
          minutesComptees: compte, charge: charge, prevue: s.prevue, deuxieme: deuxieme, convalescence: enConvalescence,
          xp: xp, bonusSemaine: bonus, niveauAvant: avant, niveauApres: niveau(st.xp).niveau,
          rations: st.stock - stockAvant, rationsDues: rations, stockApres: st.stock, butin: butin
        };
        rangJour++;
      }
    }
    const pause = pauseA(profil, fin, aujourdhui);
    const n = niveau(st.xp);
    let statut = 'nourri';
    if (pause) statut = pause.genre === 'absence' ? 'convoi' : 'abri';
    else if (st.faim >= 4) statut = 'agonie';
    else if (st.faim >= 1) statut = 'faim';
    return {
      aujourdhui: fin, stock: st.stock, faim: st.faim, statut: statut, pause: pause,
      joursAvantChute: pause ? null : st.stock + (CHUTE_A - st.faim),
      xp: st.xp, niveau: n.niveau, xpDansNiveau: n.dans, xpBesoin: n.besoin,
      convalescence: st.convalescence, cicatrices: st.cicatrices, chutes: st.chutes,
      nouvellesMorts: st.nouvellesMorts, inventaire: st.inventaire, resultats: st.resultats,
      expeditions: st.expeditions
    };

    function appliquerMort(s) {
      s.xp = 0; s.inventaire = []; s.possede = {}; s.convalescence = 0; s.cicatrices = 0;
      s.stock = STOCK_MAX; s.faim = 0;
    }
  }

  function fouiller(st, graine, charge) {
    const r = rng(hash(graine));
    const pRare = Math.min(0.35, 0.08 + charge / 3000);
    const rare = st.sansRare >= 9 || r() < pRare;
    let pool;
    if (rare) {
      pool = RELIQUES.filter(function (o) { return !st.possede[o.id]; });
      if (pool.length) {
        st.sansRare = 0;
        const o = pool[Math.floor(r() * pool.length)];
        st.possede[o.id] = true;
        const item = { id: o.id, nom: o.nom, genre: 'relique', rarete: 'rare', histoire: o.histoire };
        st.inventaire.push(item);
        return item;
      }
    }
    st.sansRare++;
    if (r() < 0.25) return { id: CONSERVE.id, nom: CONSERVE.nom, genre: 'conserve', rarete: 'commun' };
    pool = TENUES.filter(function (o) { return !st.possede[o.id]; });
    if (!pool.length) return { id: CONSERVE.id, nom: CONSERVE.nom, genre: 'conserve', rarete: 'commun' };
    const o = pool[Math.floor(r() * pool.length)];
    st.possede[o.id] = true;
    const item = { id: o.id, nom: o.nom, genre: 'tenue', rarete: o.rarete };
    st.inventaire.push(item);
    return item;
  }

  // ---------- Coach : double progression
  function suggestions(profil, seances) {
    const res = [];
    const triees = seances.filter(function (s) { return s.genre === 'expedition'; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.debut < b.debut ? 1 : -1); });
    const enAttente = calibragesEnAttente(profil).map(function (x) { return x.id; });
    profil.programme.forEach(function (ex) {
      if (!ex.actif || enAttente.indexOf(ex.id) >= 0) return;   // le calibrage passe d'abord
      const c = fourchette(ex);
      const cle = reglage(ex, profil);
      const dernieres = [];
      for (let i = 0; i < triees.length && dernieres.length < 2; i++) {
        // Charge changée en cours de séance : c'est le dernier réglage de l'exercice qui compte
        const e = (triees[i].exercices || []).filter(function (x) { return x.id === ex.id; }).pop();
        if (!e || !e.series.length) continue;
        if (e.reglage !== cle) break;
        dernieres.push(e);
      }
      if (dernieres.length < 2) return;
      const plafond = dernieres.every(function (e) { return e.series.length >= (e.prevu || ex.series) && e.series.every(function (v) { return v >= c.max; }); });
      const sous = dernieres.every(function (e) { return e.series.some(function (v) { return v < c.min; }); });
      const sens = plafond ? 1 : sous ? -1 : 0;
      if (!sens) return;
      const vers = changerReglage(ex, sens, profil);
      if (!vers) {
        // Rien de plus facile : le coach propose une fourchette plus basse, tirée de la dernière séance
        if (sens > 0) return;
        const f = proposerFourchette(dernieres[0].series, fourchettesProposees(ex));
        if (!f || f[0] >= c.min) return;
        const nouveau = Object.assign({}, ex, { reps: f }), coach = fourchetteCoach(ex);
        if (f[0] === coach.min && f[1] === coach.max) delete nouveau.reps;
        res.push({ id: ex.id, sens: -1, depuis: cle, vers: f[0] + ' à ' + f[1] + ' répétitions', nouveau: nouveau,
          texte: 'Sous la fourchette deux fois de suite, sans échelon plus facile : ' + f[0] + ' à ' + f[1] + ' répétitions.' });
        return;
      }
      const libelle = reglage(vers, profil);
      res.push({ id: ex.id, sens: sens, depuis: cle, vers: libelle, nouveau: vers,
        texte: (sens > 0 ? 'Plafond atteint deux fois de suite : ' : 'Sous la fourchette deux fois de suite : ') + libelle.toLowerCase() + '.' });
    });
    return res;
  }
  function changerReglage(ex, sens, p) {
    const c = CATALOGUE[ex.id];
    const n = Object.assign({}, ex);
    if (c.type === 'variante') {
      n.niveau = ex.niveau + sens;
      if (n.niveau < 0 || n.niveau >= c.variantes.length) return null;
    } else if (c.type === 'mixte') {
      // Du dernier échelon au poids du corps vers le premier élastique, et retour
      const V = c.variantes.length, etapes = etapesElastique(c, p);
      if (ex.niveau < V) {
        n.niveau = ex.niveau + sens;
        if (n.niveau < 0) return null;
        if (n.niveau === V) { if (!etapes.length) return null; n.charge = etapes[0]; }
      } else {
        const i = etapes.indexOf(ex.charge) + sens;
        if (i < 0) { n.niveau = V - 1; delete n.charge; }
        else if (i >= etapes.length) return null;
        else n.charge = etapes[i];
      }
    } else if (c.type === 'elastique') {
      const r = resistances(p), i = r.indexOf(ex.charge) + sens;
      if (i < 0 || i >= r.length) return null;
      n.charge = r[i];
    } else {
      n.charge = Math.max(1, ex.charge + sens * c.pas);
      if (n.charge === ex.charge) return null;
    }
    return n;
  }

  // ---------- Exercices à charge : élastiques, haltères, et squat une fois debout sur les élastiques.
  // Quand la charge ne convient pas, c'est elle qui bouge : la fourchette du coach reste.
  function aCharge(ex) {
    const c = CATALOGUE[ex.id];
    return !!c && (c.type === 'elastique' || c.type === 'charge' || (c.type === 'mixte' && ex.niveau >= c.variantes.length));
  }
  // Les charges possibles pour cet exercice, de la plus légère à la plus lourde
  function chargesPossibles(ex, p) {
    const c = CATALOGUE[ex.id];
    if (c.type === 'elastique') return resistances(p);
    if (c.type === 'mixte') return etapesElastique(c, p);
    const l = [];
    for (let k = -30; k <= 30; k++) {
      const kg = arrondi(ex.charge + k * c.pas);
      if (kg >= 1 && kg <= 60) l.push(kg);
    }
    return l;
  }
  // Répétitions qu'on peut attendre à `charge`, d'après `reps` faites à `kg` (formule d'Epley) : une estimation
  function repsEstimees(kg, reps, charge) { return 30 * (kg * (1 + reps / 30) / charge - 1); }
  // Charge visée d'après une séance : { kg } ; { rien: 'bout' } quand l'échelle s'arrête dans ce sens.
  // Plus lourd : la charge dont l'estimation tombe le plus près du milieu de la fourchette, sans passer sous le plancher ;
  // si même le cran suivant y passerait, c'est lui quand même ({ kg, saut: true }) : un gros cran, à prendre par le bas.
  function chargeVisee(ex, p, series, sens) {
    const f = fourchette(ex), cible = (f.min + f.max) / 2;
    const moy = series.reduce(function (s, n) { return s + n; }, 0) / series.length;
    const l = chargesPossibles(ex, p).filter(function (kg) { return sens > 0 ? kg > ex.charge : kg < ex.charge; });
    if (!l.length) return { rien: 'bout' };
    const estime = function (kg) { return repsEstimees(ex.charge, moy, kg); };
    const tenables = l.filter(function (kg) { return estime(kg) >= f.min; });
    if (!tenables.length) return sens > 0 ? { kg: l[0], saut: true } : { kg: l[0] };
    tenables.sort(function (a, b) { return Math.abs(estime(a) - cible) - Math.abs(estime(b) - cible) || a - b; });
    return { kg: tenables[0] };
  }
  // Libellé court d'une charge : « 30 kg (10 + 20) », « 10 kg », « sans élastique »
  function libelleCharge(ex, p) {
    const c = CATALOGUE[ex.id];
    if (c.type === 'mixte' && ex.niveau < c.variantes.length) return 'sans élastique';
    if (c.type === 'elastique' || c.type === 'mixte') return libelleElastique(ex.charge, p);
    return kgTexte(ex.charge) + ' kg';
  }

  // ---------- Calibrage : une fourchette tirée de ce que le joueur fait vraiment, une fois par échelon.
  // Une charge ou un élastique plus lourd ne recalibre pas : c'est la progression normale.
  function cleCalibrage(ex) {
    const c = CATALOGUE[ex.id];
    return c.type === 'variante' || c.type === 'mixte' ? 'n' + ex.niveau : 'charge';
  }
  function estCalibre(ex) { return ex.calibre === cleCalibrage(ex); }
  // La fourchette où la séance tombe vers le milieu ; si possible sans série sous le plancher ni au-dessus du plafond
  function proposerFourchette(series, candidates) {
    const l = (series || []).filter(function (n) { return typeof n === 'number' && n >= 0; });
    if (!l.length || !candidates.length) return null;
    const bas = Math.min.apply(null, l), haut = Math.max.apply(null, l);
    const moy = l.reduce(function (s, n) { return s + n; }, 0) / l.length;
    const ecart = function (f) { return Math.abs((f[0] + f[1]) / 2 - moy); };
    let cands = candidates.filter(function (f) { return f[0] <= bas && f[1] >= haut; });
    if (!cands.length) cands = candidates;
    return cands.slice().sort(function (x, y) { return ecart(x) - ecart(y) || x[0] - y[0]; })[0].slice();
  }
  // Ce que le coach propose après une séance à un réglage pas encore calibré :
  // - exercice à charge hors de sa fourchette : la charge visée ({ sens, vers, texte, charge: true }),
  //   avec la fourchette où la séance tombe en alternative ;
  // - exercice au poids du corps : un autre échelon si c'est nettement trop dur ou trop facile ;
  // - sinon une fourchette ({ reps }) ; { calibre: true } quand il n'y a rien à proposer.
  function evaluerCalibrage(p, ex, series) {
    const candidates = fourchettesProposees(ex);
    const haut = Math.max.apply(null, series), bas = Math.min.apply(null, series);
    if (aCharge(ex)) {
      const f = fourchette(ex);
      const sens = bas > f.max ? 1 : haut < f.min ? -1 : 0;
      if (!sens) return { calibre: true };
      const v = chargeVisee(ex, p, series, sens);
      if (v.kg != null) {
        const vers = Object.assign({}, ex, { charge: v.kg });
        const r = { sens: sens, vers: vers, texte: reglage(vers, p), charge: true };
        if (v.saut) r.saut = true;
        const alt = proposerFourchette(series, candidates);
        if (alt && !(alt[0] === f.min && alt[1] === f.max)) r.alternative = alt;
        return r;
      }
      if (sens < 0 && CATALOGUE[ex.id].type === 'mixte') {
        const vers = changerReglage(ex, -1, p);
        if (vers) return { sens: -1, vers: vers, texte: reglage(vers, p) };
      }
      // Bout de l'échelle : faute de charge, c'est la fourchette qui s'adapte
    } else {
      const sens = haut < candidates[0][0] ? -1 : bas > candidates[candidates.length - 1][1] ? 1 : 0;
      const vers = sens ? changerReglage(ex, sens, p) : null;
      if (vers) return { sens: sens, vers: vers, texte: reglage(vers, p) };
    }
    const f = proposerFourchette(series, candidates), actuelle = fourchette(ex);
    if (f[0] === actuelle.min && f[1] === actuelle.max) return { calibre: true };
    return { reps: f };
  }
  // Après une expédition, pour chaque exercice pas encore calibré à son échelon. Une séance où la charge a changé
  // en cours de route compte au réglage final : les séries d'avant sont rangées sous l'ancien réglage.
  function calibrer(p, seance) {
    const nouvelles = [];
    (seance.exercices || []).forEach(function (fait) {
      const ex = p.programme.filter(function (e) { return e.id === fait.id; })[0];
      if (!ex || !ex.actif || !CATALOGUE[ex.id] || estCalibre(ex) || !fait.series || !fait.series.length) return;
      if (fait.reglage !== reglage(ex, p)) return;   // réglage changé depuis la séance
      const prop = { id: ex.id, cle: cleCalibrage(ex), reglage: reglage(ex, p), seance: seance.id, series: fait.series.slice() };
      const e = evaluerCalibrage(p, ex, fait.series);
      if (e.calibre) { ex.calibre = prop.cle; return; }
      nouvelles.push(Object.assign(prop, e));
    });
    if (nouvelles.length) {
      const ids = nouvelles.map(function (x) { return x.id; });
      p.calibrages = (p.calibrages || []).filter(function (x) { return ids.indexOf(x.id) < 0; }).concat(nouvelles);
    }
    return nouvelles;
  }
  // Propositions encore valables : l'exercice est actif et son réglage n'a pas bougé depuis la séance
  function calibragesEnAttente(p) {
    return (p.calibrages || []).filter(function (x) {
      const ex = p.programme.filter(function (e) { return e.id === x.id; })[0];
      return ex && ex.actif && CATALOGUE[ex.id] && !estCalibre(ex) && x.cle === cleCalibrage(ex) && x.reglage === reglage(ex, p);
    });
  }
  // Réponse du joueur : accepter applique la proposition, refuser garde le réglage. L'échelon est alors calibré,
  // sauf si le joueur accepte un autre échelon : celui-ci le sera à sa première séance.
  // accepte = 'alt' : garder la charge et prendre la fourchette proposée en alternative.
  function repondreCalibrage(p, id, accepte) {
    const x = calibragesEnAttente(p).filter(function (c) { return c.id === id; })[0];
    p.calibrages = (p.calibrages || []).filter(function (c) { return c.id !== id; });
    if (!x) return null;
    const i = p.programme.map(function (e) { return e.id; }).indexOf(id);
    const ex = p.programme[i];
    if (accepte === 'alt') {
      if (x.alternative) {
        const coach = fourchetteCoach(ex);
        if (x.alternative[0] === coach.min && x.alternative[1] === coach.max) delete ex.reps; else ex.reps = x.alternative.slice();
      }
      ex.calibre = x.cle;
      return x;
    }
    if (accepte && x.vers) {
      const n = Object.assign({}, ex, { niveau: x.vers.niveau, charge: x.vers.charge });
      if (n.niveau === undefined) delete n.niveau;
      if (n.charge === undefined) delete n.charge;
      // Nouvelle charge : la double progression prend le relais (pas de nouveau calibrage qui ferait l'aller-retour)
      if (x.charge && aCharge(n)) n.calibre = cleCalibrage(n);
      p.programme[i] = n;
      return x;
    }
    if (accepte && x.reps) {
      const coach = fourchetteCoach(ex);
      if (x.reps[0] === coach.min && x.reps[1] === coach.max) delete ex.reps; else ex.reps = x.reps.slice();
    }
    ex.calibre = x.cle;
    return x;
  }

  // ---------- Séance du jour : priorités en tête, séries ajustées à la durée visée
  const ECHAUFFEMENT = 5;        // minutes
  const MINUTES_PAR_SERIE = 2;   // une série et son repos
  function planSeance(p) {
    const prio = p.priorites || [];
    const exos = p.programme.filter(function (e) { return e.actif && CATALOGUE[e.id]; }).map(function (e) {
      const groupes = CATALOGUE[e.id].groupes.filter(function (g) { return prio.indexOf(g) >= 0; });
      return { ex: e, priorite: groupes.length > 0, groupes: groupes, series: groupes.length ? 4 : 3 };
    });
    // Les abdos ferment toujours la séance : ils stabilisent tout le reste
    exos.sort(function (a, b) {
      const ga = CATALOGUE[a.ex.id].stat === 'Gainage' ? 1 : 0, gb = CATALOGUE[b.ex.id].stat === 'Gainage' ? 1 : 0;
      if (ga !== gb) return ga - gb;
      if (a.priorite !== b.priorite) return a.priorite ? -1 : 1;
      return ORDRE.indexOf(a.ex.id) - ORDRE.indexOf(b.ex.id);
    });
    function duree() { return ECHAUFFEMENT + MINUTES_PAR_SERIE * exos.reduce(function (t, x) { return t + x.series; }, 0); }
    // Pour tenir dans la durée visée : le reste descend d'abord à 2 séries, puis les priorités à 3, en partant de la fin
    for (let i = exos.length - 1; i >= 0 && duree() > p.plan.minutes; i--) {
      if (!exos[i].priorite) exos[i].series = 2;
    }
    for (let i = exos.length - 1; i >= 0 && duree() > p.plan.minutes; i--) {
      if (exos[i].priorite) exos[i].series = 3;
    }
    return { exos: exos, minutes: duree(), depasse: duree() > p.plan.minutes };
  }
  // Fixe les priorités et active l'exercice complémentaire de chacune ; renvoie les exercices ajoutés
  function definirPriorites(p, liste) {
    const ajoutes = [];
    p.priorites = liste.slice(0, 2);
    p.priorites.forEach(function (g) {
      (COMPLEMENTS[g] || []).forEach(function (id) {
        let e = p.programme.filter(function (x) { return x.id === id; })[0];
        if (!e) { e = defautExercice(id); p.programme.push(e); }
        if (!e.actif) { e.actif = true; ajoutes.push(id); }
      });
    });
    return ajoutes;
  }

  // ---------- Mise à jour des parties enregistrées avec une version précédente
  function migrer(p) {
    if (!p || !Array.isArray(p.programme)) return p;
    const version = p.v || 1; // version d'origine de la partie : les annonces ne parlent que de ce que le joueur a connu
    if (version < 2) {
      // v2 : les relevés à la barre quittent l'échelle de la roulette pour devenir un exercice à part
      let releves = false;
      p.programme.forEach(function (e) {
        if (e.id !== 'abdos') return;
        const n = Math.max(0, Math.min(5, e.niveau | 0));
        if (n === 3) releves = true;
        e.niveau = [0, 1, 2, 2, 3, 4][n];
      });
      if (!p.programme.some(function (e) { return e.id === 'chinup'; })) p.programme.push(defautExercice('chinup'));
      if (!p.programme.some(function (e) { return e.id === 'releves'; })) {
        const r = defautExercice('releves');
        r.actif = releves;
        p.programme.push(r);
      }
      if (!Array.isArray(p.priorites)) p.priorites = null; // null : pas encore choisies
      p.v = 2;
    }
    if (p.v < 3) {
      // v3 : la priorité « Biceps » devient « Bras » (biceps et triceps), avec l'extension triceps
      if (!p.programme.some(function (e) { return e.id === 'triceps'; })) p.programme.push(defautExercice('triceps'));
      if (Array.isArray(p.priorites)) {
        p.priorites = p.priorites.map(function (g) { return g === 'biceps' ? 'bras' : g; });
        if (p.priorites.indexOf('bras') >= 0 && definirPriorites(p, p.priorites).indexOf('triceps') >= 0) {
          p.annonces = (p.annonces || []).concat(['triceps']);
        }
      }
      p.v = 3;
    }
    if (p.v < 4) {
      // v4 : jambes et fessiers dans la séance de base, et dossier de l'infirmerie
      let ajoute = false;
      ['squat', 'hipthrust'].forEach(function (id) {
        let e = p.programme.filter(function (x) { return x.id === id; })[0];
        if (!e) { e = defautExercice(id); p.programme.push(e); }
        if (!e.actif) { e.actif = true; ajoute = true; }
      });
      if (ajoute) p.annonces = (p.annonces || []).concat(['jambes']);
      if (!Array.isArray(p.mesures)) p.mesures = [];
      p.v = 4;
    }
    if (p.v < 5) {
      // v5 : registre de pesée
      if (!Array.isArray(p.pesees)) p.pesees = [];
      if (!p.rappelPesee) p.rappelPesee = 'matin';
      p.v = 5;
    }
    if (p.v < 6) {
      // v6 : le squat repart au poids du corps puis passe aux élastiques ; l'extension triceps passe à l'élastique.
      // Les anciennes charges d'haltère ne valent rien sur un élastique : chaque réglage repart du premier échelon.
      let annonce = false;
      p.programme.forEach(function (e) {
        if (e.id === 'squat' && typeof e.niveau !== 'number') {
          delete e.charge;
          e.niveau = 0;
          if (e.actif && version >= 4) annonce = true;
        }
        if (e.id === 'triceps') {
          // Ajoutée en v3 avec un haltère ; avant, elle vient d'être créée plus haut, déjà à l'élastique
          if (version >= 3) { e.charge = CATALOGUE.triceps.depart; if (e.actif) annonce = true; }
          else if (resistances(p).indexOf(e.charge) < 0) e.charge = CATALOGUE.triceps.depart;
        }
      });
      if (annonce) p.annonces = (p.annonces || []).concat(['elastiques']);
      p.v = 6;
    }
    if (p.v < 7) {
      // v7 : « Squat sur le banc » passe en tête de l'échelle ; les échelons d'élastique suivent les élastiques
      // du joueur ; fourchettes de répétitions réglables. Échelle v6 : 0 poids du corps, 1 lent, 2 à 7 élastique.
      const ANCIENS = [10, 15, 20, 25, 30, 35];
      p.programme.forEach(function (e) {
        if (e.id !== 'squat') return;
        const n = typeof e.niveau === 'number' ? e.niveau : 0;
        if (n <= 1) { e.niveau = n + 1; delete e.charge; }
        else { e.niveau = CATALOGUE.squat.variantes.length; e.charge = ANCIENS[Math.min(n - 2, ANCIENS.length - 1)]; }
      });
      if (!Array.isArray(p.elastiques) || !p.elastiques.length) p.elastiques = ELASTIQUES_DEPART.slice();
      p.annonces = (p.annonces || []).concat(['reglages']);
      p.v = 7;
    }
    if (p.v < 8) {
      // v8 : le coach calibre les fourchettes après la première séance de chaque échelon
      p.annonces = (p.annonces || []).concat(['calibrage']);
      p.v = 8;
    }
    if (p.v < 9) {
      // v9 : bilan d'Ida à chaque visite ; une partie qui a déjà passé une visite est invitée à compléter sa fiche d'admission
      if ((p.mesures || []).length) p.annonces = (p.annonces || []).concat(['bilan']);
      p.v = 9;
    }
    if (p.v < 10) {
      // v10 : fiche signalétique (photos de suivi) et élévations latérales à l'élastique au catalogue
      if (!p.programme.some(function (e) { return e.id === 'elevations'; })) p.programme.push(defautExercice('elevations'));
      if (!Array.isArray(p.photos)) p.photos = [];
      if (!Array.isArray(p.rapports)) p.rapports = [];
      if ((p.mesures || []).length) p.annonces = (p.annonces || []).concat(['photos']);
      p.v = 10;
    }
    if (p.v < 11) {
      // v11 : pour un exercice à charge, le coach propose la charge plutôt qu'une fourchette.
      // Les propositions de fourchette encore en attente sont refaites avec la nouvelle règle.
      p.calibrages = (p.calibrages || []).map(function (x) {
        const ex = p.programme.filter(function (e) { return e.id === x.id; })[0];
        if (!ex || !aCharge(ex) || !x.reps || !Array.isArray(x.series) || !x.series.length || x.reglage !== reglage(ex, p)) return x;
        const e = evaluerCalibrage(p, ex, x.series);
        if (e.calibre) { ex.calibre = x.cle; return null; }
        return Object.assign({ id: x.id, cle: x.cle, reglage: x.reglage, seance: x.seance, series: x.series.slice() }, e);
      }).filter(Boolean);
      p.v = 11;
    }
    return p;
  }

  // Après un changement d'élastiques : chaque réglage disparu passe à la résistance possible juste en dessous
  function ajusterElastiques(p) {
    const changes = [];
    p.programme.forEach(function (e) {
      const c = CATALOGUE[e.id];
      if (!c) return;
      let liste;
      if (c.type === 'elastique') liste = resistances(p);
      else if (c.type === 'mixte' && e.niveau >= c.variantes.length) liste = etapesElastique(c, p);
      else return;
      if (liste.indexOf(e.charge) >= 0) return;
      const dessous = liste.filter(function (kg) { return kg <= e.charge; });
      if (dessous.length) e.charge = dessous[dessous.length - 1];
      else if (liste.length) e.charge = liste[0];
      else { e.niveau = c.variantes.length - 1; delete e.charge; }
      changes.push({ id: e.id, vers: reglage(e, p) });
    });
    return changes;
  }

  // ---------- Création
  function nouveauProfil(opts) {
    return {
      v: 11,
      photos: [],
      rapports: [],
      elastiques: (opts.elastiques || ELASTIQUES_DEPART).slice(),
      mesures: [],
      pesees: [],
      rappelPesee: 'matin',
      debut: opts.date,
      cree: opts.horodatage,
      plan: { jours: opts.jours, minutes: opts.minutes },
      survivants: [{ nom: opts.nom, mode: opts.mode, depuis: opts.date }],
      programme: opts.programme,
      priorites: opts.priorites || [],
      pauses: [],
      morts: []
    };
  }

  const api = {
    localToday: localToday, addDays: addDays, daysBetween: daysBetween, isoWeekday: isoWeekday, weekKey: weekKey,
    niveau: niveau, xpPourNiveau: xpPourNiveau, xpCumulee: xpCumulee,
    CATALOGUE: CATALOGUE, reglage: reglage, nomExercice: nomExercice, echelon: echelon,
    ELASTIQUES_DEPART: ELASTIQUES_DEPART, ELASTIQUE_MIN: ELASTIQUE_MIN, ELASTIQUE_MAX: ELASTIQUE_MAX, ELASTIQUES_NB_MAX: ELASTIQUES_NB_MAX,
    COMBINAISON_MAX: COMBINAISON_MAX, elastiquesDe: elastiquesDe, combinaisons: combinaisons, resistances: resistances,
    libelleElastique: libelleElastique, kgTexte: kgTexte, etapesElastique: etapesElastique, ajusterElastiques: ajusterElastiques,
    FOURCHETTES: FOURCHETTES, fourchette: fourchette, fourchetteCoach: fourchetteCoach, fourchettesProposees: fourchettesProposees,
    proposerFourchette: proposerFourchette, calibrer: calibrer, calibragesEnAttente: calibragesEnAttente,
    repondreCalibrage: repondreCalibrage, estCalibre: estCalibre, evaluerCalibrage: evaluerCalibrage,
    aCharge: aCharge, chargesPossibles: chargesPossibles, chargeVisee: chargeVisee, libelleCharge: libelleCharge,
    GROUPES: GROUPES, COMPLEMENTS: COMPLEMENTS, ORDRE: ORDRE, nomGroupe: nomGroupe, defautExercice: defautExercice,
    planSeance: planSeance, definirPriorites: definirPriorites, migrer: migrer,
    MESURES: MESURES, VISITE_JOURS: VISITE_JOURS, mesuresTriees: mesuresTriees, prochaineVisite: prochaineVisite,
    visiteDue: visiteDue, ecartsMesures: ecartsMesures,
    POIDS_MIN: POIDS_MIN, POIDS_MAX: POIDS_MAX, peseesTriees: peseesTriees, moyennePoids: moyennePoids,
    tendancePoids: tendancePoids, seriePoids: seriePoids, rappelPesee: rappelPesee,
    HAUTEUR_MIN: HAUTEUR_MIN, HAUTEUR_MAX: HAUTEUR_MAX, GRAISSE_MIN: GRAISSE_MIN, GRAISSE_MAX: GRAISSE_MAX,
    GRAISSE_REPERES: GRAISSE_REPERES, MASSE_MAIGRE_MEDIANE: MASSE_MAIGRE_MEDIANE, ageA: ageA, admissionComplete: admissionComplete,
    poidsVisite: poidsVisite, bilanIda: bilanIda, noteIda: noteIda,
    ANGLES: ANGLES, photosTriees: photosTriees, photoDe: photoDe, pairesPhotos: pairesPhotos, derniereDatePhotos: derniereDatePhotos,
    promptRegard: promptRegard, lireRegard: lireRegard, libelleAction: libelleAction, appliquerActions: appliquerActions,
    LIEUX: LIEUX, TENUES: TENUES, RELIQUES: RELIQUES,
    faitsSeance: faitsSeance, prochaineExpedition: prochaineExpedition, expeditionsPrevuesSemaine: expeditionsPrevuesSemaine,
    ecartProchaineExpedition: ecartProchaineExpedition, survivantA: survivantA, pauseA: pauseA,
    simuler: simuler, suggestions: suggestions, changerReglage: changerReglage, nouveauProfil: nouveauProfil,
    STOCK_MAX: STOCK_MAX, ABSENCE_MAX: ABSENCE_MAX, RETRO_MAX: RETRO_MAX
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Valgrise = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
