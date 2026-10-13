/* Valgrise : interface du prototype (papiers de la Sucrerie). */
(function () {
  'use strict';
  const V = window.Valgrise;
  const CLE_LOCAL = 'valgrise:v1';
  const CLE_BROUILLON = 'valgrise:brouillon';
  const REPOS_S = 90;
  const JOURS_COURTS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const JOURS_LONGS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const EFFORT = ['', 'très facile', 'très facile', 'facile', 'facile', 'modéré', 'modéré', 'difficile', 'difficile', 'très difficile', 'maximal'];
  const ROUGE = '#A61E22';
  const BLEU = '#27368A';
  // Version privée (toi, un ami) : Ida commente tes photos avec Claude. Version grand public : false, le registre photo reste seul.
  const REGARD_IDA = true;

  const S = {
    ecran: 'chargement', profil: null, seances: [], sim: null, brouillon: null,
    bilanId: null, stockage: 'local', form: {}, confirmer: null, ignorees: {}, jour: null
  };
  const app = document.getElementById('app');
  const ongletsEl = document.getElementById('onglets');
  const avisEl = document.getElementById('avis');

  // ---------- Outils
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function auj() { return V.localToday(); }
  function nouvelId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function stockageLocal(cle, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(cle) || 'null');
      if (val === null) localStorage.removeItem(cle);
      else localStorage.setItem(cle, JSON.stringify(val));
    } catch (e) { return null; }
    return null;
  }
  function dateLongue(d) { const p = d.split('-'); return JOURS_LONGS[V.isoWeekday(d)] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
  function dateCourte(d) { const p = d.split('-'); return (+p[2]) + ' ' + MOIS_COURTS[+p[1] - 1]; }
  function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function quand(d) {
    const a = S.jour || auj();
    if (d === a) return 'Aujourd’hui';
    if (d === V.addDays(a, 1)) return 'Demain';
    return majuscule(dateLongue(d));
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function survivant() { return S.profil.survivants[S.profil.survivants.length - 1]; }
  function mmss(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function numeroCarte() {
    const s = (S.profil && S.profil.cree) || 'valgrise';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9000;
    return 'N° ' + (1000 + h);
  }
  function besoinNouveauSurvivant() {
    if (!S.profil || !S.profil.morts.length) return false;
    const m = S.profil.morts[S.profil.morts.length - 1];
    return survivant().depuis < m.date;
  }

  // ---------- Dessins
  function tampon(texte, couleur, o) {
    o = Object.assign({ l: 150, h: 54, rot: -9, taille: 20, forme: 'rect', classe: '' }, o || {});
    const forme = o.forme === 'ovale'
      ? '<ellipse cx="' + o.l / 2 + '" cy="' + o.h / 2 + '" rx="' + (o.l / 2 - 4) + '" ry="' + (o.h / 2 - 4) + '" fill="none" stroke="' + couleur + '" stroke-width="3"></ellipse>'
      : '<rect x="4" y="5" width="' + (o.l - 8) + '" height="' + (o.h - 10) + '" rx="5" fill="none" stroke="' + couleur + '" stroke-width="3.2"></rect>';
    return '<svg class="tampon ' + o.classe + '" role="img" aria-label="Tampon : ' + esc(texte.toLowerCase()) + '" width="' + o.l + '" height="' + o.h + '" viewBox="0 0 ' + o.l + ' ' + o.h + '" style="transform: rotate(' + o.rot + 'deg)">' +
      '<g filter="url(#encre)">' + forme +
      '<text x="' + o.l / 2 + '" y="' + (o.h / 2 + o.taille * 0.36) + '" text-anchor="middle" font-family="Stardos Stencil, Georgia, serif" font-weight="700" font-size="' + o.taille + '" letter-spacing="1.5" fill="' + couleur + '">' + esc(texte) + '</text></g></svg>';
  }
  const TROMBONE = '<svg class="trombone" aria-hidden="true" width="26" height="70" viewBox="0 0 26 70"><path d="M9 52V14a6 6 0 0 1 12 0v42a9 9 0 0 1-18 0V20" fill="none" stroke="#8E938B" stroke-width="2.6" stroke-linecap="round"></path></svg>';
  const PINCE = '<svg class="pince" aria-hidden="true" width="150" height="46" viewBox="0 0 150 46"><rect x="1" y="6" width="148" height="34" rx="7" fill="#9AA09A" stroke="#5E635E" stroke-width="1.5"></rect><rect x="12" y="14" width="126" height="9" rx="4" fill="#6F756F"></rect><circle cx="20" cy="31" r="3" fill="#5E635E"></circle><circle cx="130" cy="31" r="3" fill="#5E635E"></circle></svg>';

  // ---------- Stockage : compte Claude (db) et copie sur l'appareil
  const Store = {
    db: null, uid: null,
    init: async function () {
      if (!(window.claude && typeof window.claude.use === 'function')) return;
      try {
        const res = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        const db = res[0], user = res[1];
        const uid = user ? await user.id() : null;
        if (db && uid) { this.db = db; this.uid = uid; }
      } catch (e) { this.db = null; }
    },
    profil: function () { return this.db.doc('data/users/' + this.uid + '/valgrise'); },
    seances: function () { return this.profil().collection('seances'); },
    charger: async function () {
      const snap = await this.profil().get();
      const q = await this.seances().get();
      return { profil: snap.exists ? clone(snap.data()) : null, seances: q.docs.map(function (d) { return clone(d.data()); }) };
    },
    sauverProfil: async function (p) {
      await this.profil().set(clone(p));
      try { await this.db.doc('joueurs/' + this.uid).set({ maj: new Date().toISOString() }); } catch (e) { /* repère facultatif */ }
    },
    sauverSeance: async function (s) { await this.seances().doc(s.id).set(clone(s)); },
    remplacer: async function (profil, seances) {
      const q = await this.seances().get();
      const garder = {};
      seances.forEach(function (s) { garder[s.id] = true; });
      for (let i = 0; i < q.docs.length; i++) if (!garder[q.docs[i].id]) await this.seances().doc(q.docs[i].id).delete();
      for (let i = 0; i < seances.length; i++) await this.sauverSeance(seances[i]);
      await this.sauverProfil(profil);
    }
  };

  function persister(seance) {
    S.profil.maj = new Date().toISOString();
    stockageLocal(CLE_LOCAL, { profil: S.profil, seances: S.seances });
    if (!Store.db) return;
    const tache = (seance ? Store.sauverSeance(seance) : Promise.resolve()).then(function () { return Store.sauverProfil(S.profil); });
    tache.catch(function (err) {
      if (err && err.code === 'quota_exceeded') avis('Ta sauvegarde en ligne est pleine. Télécharge une copie depuis l’onglet Survivant.', true);
      else avis('Sauvegarde en ligne impossible pour l’instant. Tout reste enregistré sur ce téléphone.', true);
    });
  }
  function sauverBrouillon() { stockageLocal(CLE_BROUILLON, S.brouillon); }

  // ---------- Photos de suivi : ton espace privé du compte Claude, sinon ce téléphone (IndexedDB), sinon la session
  const PHOTO_MAX = 190000;   // caractères de l'image encodée : un document de la base en accepte 256 Kio
  const Photos = {
    cache: {}, attente: {}, base: undefined, pret: false,
    idb: function () {
      if (this.base !== undefined) return this.base;
      this.base = new Promise(function (ok) {
        try {
          if (!window.indexedDB) { ok(null); return; }
          const r = window.indexedDB.open('valgrise-photos', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('photos'); };
          r.onsuccess = function () { ok(r.result); };
          r.onerror = function () { ok(null); };
        } catch (e) { ok(null); }
      });
      return this.base;
    },
    idbFaire: async function (mode, fn) {
      const b = await this.idb();
      if (!b) return undefined;
      return new Promise(function (ok, ko) {
        const tx = b.transaction('photos', mode), req = fn(tx.objectStore('photos'));
        tx.oncomplete = function () { ok(req ? req.result : undefined); };
        tx.onerror = function () { ko(tx.error); };
      });
    },
    doc: function (id) { return Store.profil().collection('photos').doc(id); },
    enregistrer: async function (id, donnees) {
      this.cache[id] = donnees;
      if (Store.db) { await this.doc(id).set({ id: id, donnees: donnees }); return; }
      await this.idbFaire('readwrite', function (st) { return st.put(donnees, id); });
    },
    supprimer: async function (id) {
      delete this.cache[id];
      if (Store.db) { await this.doc(id).delete(); return; }
      await this.idbFaire('readwrite', function (st) { return st.delete(id); });
    },
    lire: async function (id) {
      if (this.cache[id]) return this.cache[id];
      let d = null;
      try {
        if (Store.db) { const snap = await this.doc(id).get(); d = snap.exists ? snap.data().donnees : null; }
        else d = await this.idbFaire('readonly', function (st) { return st.get(id); });
      } catch (e) { d = null; }
      this.cache[id] = d || '';
      return this.cache[id];
    },
    // Toutes les photos rangées, y compris celles que plus rien ne référence
    ids: async function () {
      if (Store.db) { const q = await Store.profil().collection('photos').get(); return q.docs.map(function (d) { return d.id; }); }
      const cles = await this.idbFaire('readonly', function (st) { return st.getAllKeys(); });
      return (cles || []).map(String);
    },
    // Pour l'affichage : l'image si elle est là ('' si introuvable), sinon null et un nouveau rendu à son arrivée
    voir: function (id) {
      if (this.cache[id] !== undefined) return this.cache[id];
      if (!this.pret) return null;
      const self = this;
      if (!this.attente[id]) this.attente[id] = this.lire(id).then(function () { delete self.attente[id]; render(); });
      return null;
    }
  };
  function compresserPhoto(fichier) {
    return new Promise(function (ok, ko) {
      const lecteur = new FileReader();
      lecteur.onerror = function () { ko('illisible'); };
      lecteur.onload = function () {
        const url = String(lecteur.result || '');
        const c = document.createElement('canvas');
        let ctx = null;
        try { ctx = c.getContext ? c.getContext('2d') : null; } catch (e) { ctx = null; }
        if (!ctx) { if (/^data:image\//.test(url) && url.length <= PHOTO_MAX) ok(url); else ko('trop_grande'); return; }
        const img = new Image();
        img.onerror = function () { ko('illisible'); };
        img.onload = function () {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, r = Math.min(1, 900 / Math.max(w, h));
          c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r));
          ctx.drawImage(img, 0, 0, c.width, c.height);
          let q = 0.72, d = c.toDataURL('image/jpeg', q);
          while (d.length > PHOTO_MAX && q > 0.3) { q -= 0.08; d = c.toDataURL('image/jpeg', q); }
          if (d.length <= PHOTO_MAX) ok(d); else ko('trop_grande');
        };
        img.src = url;
      };
      lecteur.readAsDataURL(fichier);
    });
  }
  function versBlob(donnees) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(donnees);
    const bin = atob(m[2]), t = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) t[i] = bin.charCodeAt(i);
    return new Blob([t], { type: m[1] });
  }
  // Rapport d'Ida : Claude regarde les photos (version privée seulement, et seulement si ce lecteur le permet)
  const Regard = { sample: null, max: 0, etat: REGARD_IDA ? 'attente' : 'off' };
  async function initRegard() {
    if (!REGARD_IDA) return;
    if (!(window.claude && typeof window.claude.use === 'function')) { Regard.etat = 'non'; return; }
    try {
      const sample = await window.claude.use('sample');
      const lim = sample ? await sample.limits().catch(function () { return null; }) : null;
      Regard.max = lim && lim.images ? Math.min(6, lim.images.maxCount || 0) : 0;
      if (sample && Regard.max) { Regard.sample = sample; Regard.etat = 'ok'; } else Regard.etat = 'non';
    } catch (e) { Regard.etat = 'non'; }
  }
  function rapportCourant() {
    const d = V.derniereDatePhotos(S.profil);
    return d ? (S.profil.rapports || []).filter(function (r) { return r.date === d; })[0] || null : null;
  }
  async function demanderRegard() {
    if (Regard.etat !== 'ok' || S.regardEnCours) return;
    const date = V.derniereDatePhotos(S.profil), consigne = V.promptRegard(S.profil, Regard.max);
    if (!date || !consigne.images.length) return;
    S.regardEnCours = true; render();
    try {
      const images = [];
      for (let i = 0; i < consigne.images.length; i++) {
        const d = await Photos.lire(consigne.images[i].id);
        if (!d) throw { code: 'photo_absente' };
        images.push(versBlob(d));
      }
      const brut = await Regard.sample.json(consigne.texte, { images: images, cache: false });
      const r = V.lireRegard(S.profil, brut);
      if (!r) throw { code: 'invalid_json' };
      r.date = date; r.cree = new Date().toISOString();
      S.profil.rapports = (S.profil.rapports || []).filter(function (x) { return x.date !== date; }).concat([r]);
      persister();
      avis('Rapport d’Ida rangé dans ta fiche.');
    } catch (e) {
      const code = e && e.code;
      if (code === 'not_granted') { Regard.etat = 'refuse'; avis('Sans ton accord pour envoyer les photos à Claude, Ida ne peut pas faire son rapport.', true); }
      else if (['sampling_disabled', 'images_unavailable', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(code) >= 0) { Regard.etat = 'non'; avis('Le rapport d’Ida n’est pas disponible ici.', true); }
      else if (code === 'rate_limited') avis('Ida est débordée : réessaie un peu plus tard.', true);
      else if (code === 'refused') avis('Ida n’a pas pu examiner ces photos. Essaie avec d’autres.', true);
      else if (code === 'photo_absente') avis('Une photo manque : reprends-la à ta prochaine visite.', true);
      else if (code === 'image_rejected') avis('Une photo a été refusée : reprends-la.', true);
      else if (code !== 'cancelled') avis('Le rapport n’a pas pu être fait. Réessaie plus tard.', true);
    } finally { S.regardEnCours = false; render(); }
  }
  // Enregistre les photos de la visite du jour, puis met l'index du profil à jour
  async function enregistrerPhotos(date, nouvelles, retirees) {
    let echec = null;
    for (let i = 0; i < retirees.length; i++) {
      const ph = V.photoDe(S.profil, date, retirees[i]);
      if (!ph) continue;
      try { await Photos.supprimer(ph.id); } catch (e) { echec = e; continue; }
      S.profil.photos = (S.profil.photos || []).filter(function (x) { return x.id !== ph.id; });
    }
    for (let i = 0; i < nouvelles.length; i++) {
      const id = date + '-' + nouvelles[i].angle;
      try { await Photos.enregistrer(id, nouvelles[i].donnees); } catch (e) { echec = e; delete Photos.cache[id]; continue; }
      S.profil.photos = (S.profil.photos || []).filter(function (x) { return x.id !== id; }).concat([{ id: id, date: date, angle: nouvelles[i].angle }]);
    }
    persister(); render();
    if (echec) avis(echec.code === 'quota_exceeded' ? 'Plus de place pour tes photos. Retire d’anciennes photos pour en ajouter.' : 'Des photos n’ont pas pu être enregistrées. Réessaie.', true);
    else if (nouvelles.length) avis(nouvelles.length > 1 ? 'Photos rangées dans ta fiche signalétique.' : 'Photo rangée dans ta fiche signalétique.');
  }

  async function synchroniser() {
    const d = await Store.charger();
    let profil = d.profil;
    const localPlusRecent = S.profil && (!profil || (S.profil.maj || '') > (profil.maj || ''));
    if (localPlusRecent) profil = S.profil;
    const parId = {};
    d.seances.forEach(function (s) { parId[s.id] = s; });
    const aEnvoyer = [];
    S.seances.forEach(function (s) { if (!parId[s.id]) { parId[s.id] = s; aEnvoyer.push(s); } });
    S.profil = migrerProfil(profil);
    S.seances = Object.keys(parId).map(function (k) { return parId[k]; });
    if (S.profil) stockageLocal(CLE_LOCAL, { profil: S.profil, seances: S.seances });
    for (let i = 0; i < aEnvoyer.length; i++) await Store.sauverSeance(aEnvoyer[i]);
    if (localPlusRecent) await Store.sauverProfil(S.profil);
  }

  // ---------- État du jeu
  let migre = false;
  function migrerProfil(p) {
    if (p && (p.v || 1) < 10) migre = true;
    return V.migrer(p);
  }
  function recalculer() {
    if (!S.profil) return;
    S.jour = auj();
    S.sim = V.simuler(S.profil, S.seances, S.jour);
    if (S.sim.nouvellesMorts.length) {
      S.sim.nouvellesMorts.forEach(function (d) {
        const avant = V.simuler(S.profil, S.seances, V.addDays(d, -1));
        const sv = V.survivantA(S.profil, d);
        S.profil.morts.push({ date: d, nom: sv.nom, niveau: avant.niveau, jours: V.daysBetween(sv.depuis, d) });
      });
      S.form = { nom: '', mode: 'ironman' };
      persister();
      S.sim = V.simuler(S.profil, S.seances, S.jour);
    }
  }

  async function demarrer() {
    const cache = stockageLocal(CLE_LOCAL);
    S.brouillon = stockageLocal(CLE_BROUILLON);
    if (cache && cache.profil) {
      S.profil = migrerProfil(cache.profil);
      S.seances = cache.seances || [];
      recalculer();
      S.ecran = S.brouillon ? 'expedition' : 'accueil';
    }
    render();
    await Promise.all([Store.init(), initRegard()]);
    if (Store.db) {
      try { await synchroniser(); S.stockage = 'compte'; }
      catch (e) { S.stockage = 'local'; avis('Ta sauvegarde en ligne ne répond pas. Le jeu continue sur ce téléphone.', true); }
    }
    if (!S.profil) { S.ecran = 'inscription'; S.form = formulaireInscription(); }
    else {
      if (migre) { migre = false; persister(); }
      recalculer();
      if (S.ecran === 'chargement') S.ecran = S.brouillon ? 'expedition' : 'accueil';
    }
    Photos.pret = true;
    render();
  }

  // ---------- Rendu
  let dernierEcran = null;
  function render() {
    const garder = dernierEcran === S.ecran;
    const y = window.scrollY;
    let html;
    if (S.ecran === 'chargement') html = ecranChargement();
    else if (S.ecran === 'inscription') html = ecranInscription();
    else if (besoinNouveauSurvivant()) html = ecranMort();
    else if (S.ecran === 'expedition') html = ecranExpedition();
    else if (S.ecran === 'effort') html = ecranEffort();
    else if (S.ecran === 'bilan') html = ecranBilan();
    else if (S.ecran === 'libre') html = ecranLibre();
    else if (S.ecran === 'visite') html = ecranVisite();
    else if (S.ecran === 'tuto') html = ecranTuto();
    else if (S.ecran === 'survivant') html = ecranSurvivant();
    else if (S.ecran === 'carnet') html = ecranCarnet();
    else { S.ecran = 'accueil'; html = ecranAccueil(); }
    if (S.majDispo) html = '<button type="button" class="bandeau-maj" data-action="recharger"><strong>Nouvelle version de Valgrise.</strong> Touche ici pour l’ouvrir.</button>' + html;
    app.innerHTML = html;
    const avecOnglets = S.profil && !besoinNouveauSurvivant() && ['accueil', 'survivant', 'carnet'].indexOf(S.ecran) >= 0;
    app.classList.toggle('sans-onglets', !avecOnglets);
    ongletsEl.innerHTML = avecOnglets ? onglets() : '';
    window.scrollTo(0, garder ? y : 0);
    if (S.ancre) {
      const cible = document.getElementById(S.ancre);
      S.ancre = null;
      if (cible && cible.scrollIntoView) cible.scrollIntoView({ block: 'start' });
    }
    dernierEcran = S.ecran;
    tic();
  }

  function onglets() {
    const liste = [['accueil', 'Aujourd’hui'], ['survivant', 'Survivant'], ['carnet', 'Carnet']];
    return '<nav class="onglets" aria-label="Navigation principale"><div class="onglets-rang">' + liste.map(function (o) {
      const actif = S.ecran === o[0];
      return '<button type="button" class="onglet ' + (actif ? 'kraft-clair' : 'kraft-fonce') + '" data-action="aller" data-ecran="' + o[0] + '"' + (actif ? ' aria-current="page"' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div></nav>';
  }

  function enteteCarte(droite) {
    return '<div class="entete"><p class="mention">Comité de la Sucrerie, Valgrise</p><p class="pochoir">' + esc(droite) + '</p></div>';
  }

  function ecranChargement() {
    return '<main class="pile"><section class="objet kraft carte">' + enteteCarte('') +
      '<h1 class="titre-imprime">Carte d’alimentation</h1><div class="filet"></div>' +
      '<p class="discret mt-12">Ouverture de ta carte…</p></section></main>';
  }

  // ---------- Inscription
  function formulaireInscription() {
    return { nom: '', jours: [1, 4], minutes: 45, mode: 'survie', priorites: [], pompes: 1, developpe: 10, curl: 8, abdos: 2,
      chinup: false, chinupNiveau: 0, triceps: false, tricepsCharge: 10, releves: false, relevesNiveau: 0, squat: 'n0',
      hipthrust: false, hipthrustCharge: 10, elevations: false, elevationsCharge: 5, erreur: '' };
  }
  function listeFr(l) { return l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : String(l[0]); }
  function groupesDe(c) { return c.groupes.map(V.nomGroupe).join(', ').toLowerCase(); }
  function prioritesTexte(liste) { return liste.map(V.nomGroupe).join(' et ').toLowerCase(); }
  function choixGroupes(liste, action) {
    return '<div class="groupes" role="group" aria-label="Groupes prioritaires">' + V.GROUPES.map(function (g) {
      return '<button type="button" data-action="' + action + '" data-groupe="' + g.id + '" aria-pressed="' + (liste.indexOf(g.id) >= 0) + '">' + esc(g.nom) + '</button>';
    }).join('') + '</div>';
  }
  function champVariante(id, valeur, champ) {
    const c = V.CATALOGUE[id];
    const hid = 'f-' + (champ || id);
    return '<div class="bloc mt-12"><label class="mention" for="' + hid + '">' + esc(c.nom) + ' (' + esc(groupesDe(c)) + ')</label>' +
      '<select class="saisie" id="' + hid + '" data-champ="' + (champ || id) + '" data-type="nombre">' +
      c.variantes.map(function (v, i) { return '<option value="' + i + '"' + (i === valeur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') +
      '</select></div>';
  }
  function champElastique(id, valeur, champ) {
    const c = V.CATALOGUE[id];
    const hid = 'f-' + (champ || id);
    return '<div class="bloc mt-12"><label class="mention" for="' + hid + '">' + esc(c.nom) + ' (' + esc(groupesDe(c)) + ')</label>' +
      '<select class="saisie" id="' + hid + '" data-champ="' + (champ || id) + '" data-type="nombre">' +
      V.resistances(null).map(function (kg) { return '<option value="' + kg + '"' + (kg === valeur ? ' selected' : '') + '>Élastique de ' + esc(V.libelleElastique(kg, null)) + '</option>'; }).join('') +
      '</select></div>';
  }
  // Réglage codé dans une liste : « n2 » pour un échelon, « k15 » pour une résistance d'élastique
  function optionsReglage(id, p) {
    const c = V.CATALOGUE[id], l = [];
    if (c.type === 'variante' || c.type === 'mixte') c.variantes.forEach(function (v, i) { l.push({ valeur: 'n' + i, texte: v }); });
    if (c.type === 'mixte') V.etapesElastique(c, p).forEach(function (kg) { l.push({ valeur: 'k' + kg, texte: c.elastique + V.libelleElastique(kg, p) }); });
    if (c.type === 'elastique') V.resistances(p).forEach(function (kg) { l.push({ valeur: 'k' + kg, texte: 'Élastique de ' + V.libelleElastique(kg, p) }); });
    return l;
  }
  function valeurReglage(ex) {
    const c = V.CATALOGUE[ex.id];
    return c.type === 'variante' || (c.type === 'mixte' && ex.niveau < c.variantes.length) ? 'n' + ex.niveau : 'k' + ex.charge;
  }
  function lireReglage(id, valeur) {
    const c = V.CATALOGUE[id], v = String(valeur);
    if (v.charAt(0) === 'n') return { niveau: +v.slice(1) };
    return c.type === 'mixte' ? { niveau: c.variantes.length, charge: +v.slice(1) } : { charge: +v.slice(1) };
  }
  function selectReglage(attributs, options, choisie) {
    return '<select class="saisie" ' + attributs + '>' + options.map(function (o) {
      return '<option value="' + esc(o.valeur) + '"' + (o.valeur === choisie ? ' selected' : '') + '>' + esc(o.texte) + '</option>';
    }).join('') + '</select>';
  }
  function champMixte(id, valeur, champ) {
    const c = V.CATALOGUE[id];
    const hid = 'f-' + (champ || id);
    return '<div class="bloc mt-12"><label class="mention" for="' + hid + '">' + esc(c.nom) + ' (' + esc(groupesDe(c)) + ')</label>' +
      selectReglage('id="' + hid + '" data-champ="' + (champ || id) + '"', optionsReglage(id, null), valeur) + '</div>';
  }
  function champCharge(id, valeur, champ) {
    const c = V.CATALOGUE[id];
    const hid = 'f-' + (champ || id);
    const unite = c.unHaltere ? 'kg, un seul haltère' : 'kg par haltère';
    return '<div class="bloc mt-12"><label class="mention" for="' + hid + '">' + esc(c.nom) + ' (' + esc(groupesDe(c)) + '), ' + unite + '</label>' +
      '<input class="saisie" id="' + hid + '" data-champ="' + (champ || id) + '" data-type="nombre" type="number" inputmode="decimal" min="1" max="60" step="0.5" value="' + esc(valeur) + '"></div>';
  }
  function caseRecommandee(id, coche) {
    const c = V.CATALOGUE[id];
    return '<label class="case-a-cocher mt-8" for="f-' + id + '"><input type="checkbox" id="f-' + id + '" data-champ="' + id + '" data-type="booleen"' + (coche ? ' checked' : '') + '><span>' + esc(c.nom) + '. ' + esc(c.recommande) + '</span></label>';
  }
  function optionMode(mode, titre, texte) {
    return '<button type="button" class="option" data-action="mode" data-mode="' + mode + '" aria-pressed="' + (S.form.mode === mode) + '">' +
      '<span class="marque" aria-hidden="true"></span><span><strong>' + titre + '</strong><br><span class="discret">' + texte + '</span></span></button>';
  }
  function choixJours(jours, action) {
    return '<div class="jours" role="group" aria-label="Jours d’expédition">' + [1, 2, 3, 4, 5, 6, 7].map(function (j) {
      return '<button type="button" data-action="' + action + '" data-jour="' + j + '" aria-pressed="' + (jours.indexOf(j) >= 0) + '" aria-label="' + JOURS_LONGS[j] + '">' + JOURS_COURTS[j] + '</button>';
    }).join('') + '</div>';
  }
  function ecranInscription() {
    const f = S.form;
    return '<main class="pile">' +
      '<section class="objet kraft carte">' + enteteCarte('Inscription') +
        '<h1 class="titre-imprime">Demande de carte d’alimentation</h1><div class="filet"></div>' +
        '<p class="discret mt-12">Le Comité nourrit ceux qui rapportent plus qu’ils ne mangent. Ton survivant arrive avec une semaine de vivres.</p>' +
        '<div class="bloc mt-12"><label class="mention" for="f-nom">Nom du survivant</label>' +
        '<input class="saisie" id="f-nom" data-champ="nom" maxlength="24" autocomplete="off" enterkeyhint="next" aria-describedby="aide-nom" value="' + esc(f.nom) + '">' +
        '<p class="aide' + (f.erreurNom ? ' alerte' : '') + '" id="aide-nom"' + (f.erreurNom ? ' role="alert"' : '') + '>' +
          (f.erreurNom ? 'Ton survivant a besoin d’un nom. ' : '') + 'Par exemple : Aubin, Jo, Maëlle.</p></div>' +
        '<div class="mt-8">' + blocRestaurer(true) + '</div>' +
      '</section>' +
      '<section class="objet papier feuille">' + TROMBONE +
        '<h2 class="sous-titre">Jours d’expédition</h2>' +
        '<p class="discret mt-4">Au moins deux jours. Une expédition se déplace dans la semaine sans pénalité.</p>' +
        choixJours(f.jours, 'jour') +
        '<div class="bloc mt-12"><label class="mention" for="f-minutes">Durée d’une expédition, en minutes</label>' +
        '<input class="saisie" id="f-minutes" data-champ="minutes" data-type="nombre" type="number" inputmode="numeric" min="15" max="120" value="' + esc(f.minutes) + '"></div>' +
      '</section>' +
      '<section class="objet papier feuille inclinee-g">' +
        '<h2 class="sous-titre">Tes priorités</h2>' +
        '<p class="discret mt-4">Jusqu’à deux groupes musculaires. Le coach place leurs exercices en début de séance, quand tu es frais, à 4 séries au lieu de 3.</p>' +
        choixGroupes(f.priorites, 'prio-inscription') +
      '</section>' +
      '<section class="objet papier feuille">' +
        '<h2 class="sous-titre">Ta séance de départ</h2>' +
        champVariante('pompes', f.pompes) + champElastique('developpe', f.developpe) +
        champCharge('curl', f.curl) + champMixte('squat', f.squat) + champVariante('abdos', f.abdos) +
        '<p class="mention mt-16">Le coach te recommande aussi</p>' +
        caseRecommandee('chinup', f.chinup) + (f.chinup ? champVariante('chinup', f.chinupNiveau, 'chinupNiveau') : '') +
        caseRecommandee('triceps', f.triceps) + (f.triceps ? champElastique('triceps', f.tricepsCharge, 'tricepsCharge') : '') +
        caseRecommandee('hipthrust', f.hipthrust) + (f.hipthrust ? champCharge('hipthrust', f.hipthrustCharge, 'hipthrustCharge') : '') +
        caseRecommandee('releves', f.releves) + (f.releves ? champVariante('releves', f.relevesNiveau, 'relevesNiveau') : '') +
        caseRecommandee('elevations', f.elevations) + (f.elevations ? champElastique('elevations', f.elevationsCharge, 'elevationsCharge') : '') +
      '</section>' +
      '<section class="objet papier feuille inclinee-g">' +
        '<h2 class="sous-titre">Difficulté</h2>' +
        '<div class="choix" role="group" aria-label="Difficulté">' +
          optionMode('survie', 'Survie, conseillé', 'Une chute laisse une cicatrice et deux expéditions de convalescence à demi-XP. Une maladie déclarée dans les 7 jours l’annule.') +
          optionMode('ironman', 'Ironman, sans filet', 'Une chute tue ton survivant : son niveau et ses objets sont perdus, ton historique reste. Choix fixé pour ce survivant.') +
        '</div>' +
        (f.erreur ? '<p class="toast alerte mt-12" role="alert">' + esc(f.erreur) + '</p>' : '') +
        '<button type="button" class="btn btn-principal mt-16" data-action="inscrire">Remettre ma demande</button>' +
      '</section></main>';
  }
  function inscrire() {
    const f = S.form;
    const minutes = Math.round(+f.minutes), nom = String(f.nom || '').trim();
    f.erreurNom = !nom;
    if (!nom) f.erreur = 'Ton survivant a besoin d’un nom : écris-le en haut, sur la carte.';
    else if (f.jours.length < 2) f.erreur = 'Choisis au moins deux jours d’expédition.';
    else if (!(minutes >= 15 && minutes <= 120)) f.erreur = 'La durée doit être comprise entre 15 et 120 minutes.';
    else if (!(+f.curl > 0) || (f.hipthrust && !(+f.hipthrustCharge > 0))) f.erreur = 'Indique une charge en kilos pour chaque exercice aux haltères.';
    else f.erreur = '';
    if (f.erreur) {
      render();
      const champ = f.erreurNom ? document.getElementById('f-nom') : null;
      if (champ) champ.focus();
      return;
    }
    const programme = [
      { id: 'pompes', actif: true, series: 3, niveau: +f.pompes },
      { id: 'developpe', actif: true, series: 3, charge: +f.developpe },
      { id: 'curl', actif: true, series: 3, charge: +f.curl },
      { id: 'triceps', actif: !!f.triceps, series: 3, charge: +f.tricepsCharge },
      { id: 'chinup', actif: !!f.chinup, series: 3, niveau: +f.chinupNiveau },
      { id: 'abdos', actif: true, series: 3, niveau: +f.abdos },
      { id: 'releves', actif: !!f.releves, series: 3, niveau: +f.relevesNiveau },
      { id: 'rowing', actif: false, series: 3, charge: 15 },
      Object.assign({ id: 'squat', actif: true, series: 3 }, lireReglage('squat', f.squat)),
      { id: 'hipthrust', actif: !!f.hipthrust, series: 3, charge: +f.hipthrustCharge },
      { id: 'elevations', actif: !!f.elevations, series: 3, charge: +f.elevationsCharge }
    ];
    S.profil = V.nouveauProfil({
      date: auj(), horodatage: new Date().toISOString(), jours: f.jours.slice().sort(), minutes: minutes,
      nom: nom, mode: f.mode, programme: programme, priorites: f.priorites.slice()
    });
    S.seances = [];
    S.form = {};
    recalculer();
    persister();
    S.ecran = 'accueil';
    render();
    avis('Demande acceptée. ' + survivant().nom + ' arrive à la Sucrerie avec 7 rations.');
  }

  // ---------- Accueil : carte d'alimentation et ordre de sortie
  // Le nom du titulaire se corrige au crayon, sur la carte même
  function titulaire(sv) {
    if (!S.renommer) {
      return '<dt>Titulaire</dt><dd class="titulaire"><span>' + esc(sv.nom) + '</span>' +
        '<button type="button" class="lien petit-lien" data-action="renommer">Renommer</button></dd>';
    }
    const valeur = S.form.nouveauNom != null ? S.form.nouveauNom : sv.nom;
    return '<dt class="en-haut"><label for="f-renommer">Titulaire</label></dt><dd class="edition">' +
      '<input class="saisie" id="f-renommer" data-champ="nouveauNom" maxlength="24" autocomplete="off" enterkeyhint="done" value="' + esc(valeur) + '">' +
      '<div class="actions"><button type="button" class="lien petit-lien" data-action="renommer-ok">Valider</button>' +
      '<button type="button" class="lien petit-lien" data-action="renommer-annuler">Annuler</button></div></dd>';
  }
  function validerNom() {
    const nom = String(S.form.nouveauNom == null ? '' : S.form.nouveauNom).trim();
    if (!nom) {
      avis('Ton survivant a besoin d’un nom.', true);
      const champ = document.getElementById('f-renommer');
      if (champ) champ.focus();
      return;
    }
    const sv = survivant(), ancien = sv.nom;
    S.renommer = false; delete S.form.nouveauNom;
    if (nom === ancien) { render(); return; }
    sv.nom = nom;
    persister(); render();
    avis(ancien + ' s’appelle désormais ' + nom + '.');
  }
  function ecranAccueil() {
    const sim = S.sim, sv = survivant();
    const pleines = Math.floor(sim.xpDansNiveau / sim.xpBesoin * 10);
    let cases = '';
    for (let i = 0; i < 10; i++) cases += '<span class="case' + (i < pleines ? ' pleine' : '') + '"></span>';
    let tamp = '';
    if (sim.statut === 'abri') tamp = tampon('À L’ABRI', BLEU, { l: 140 });
    else if (sim.statut === 'convoi') tamp = tampon('EN CONVOI', BLEU, { l: 150 });
    else if (sim.statut === 'agonie') tamp = tampon('AGONIE', ROUGE, { l: 130 });
    else if (sim.statut === 'faim') tamp = tampon('FAIM', ROUGE, { l: 110 });
    else if (sim.stock <= 2) tamp = tampon('VIVRES BAS', ROUGE);
    const n = sim.joursAvantChute;
    let statut = 'Tickets restants sur la carte';
    if (sim.statut === 'faim') statut = 'Plus de vivres. Sans expédition, il tombe dans ' + pluriel(n, 'jour', 'jours') + '.';
    else if (sim.statut === 'agonie') statut = 'Il agonise. Sans expédition, il tombe dans ' + pluriel(n, 'jour', 'jours') + '.';
    else if (sim.statut === 'abri') statut = 'À l’abri depuis le ' + dateCourte(sim.pause.debut) + ' : il ne touche pas à ses vivres.';
    else if (sim.statut === 'convoi') statut = 'En convoi jusqu’au ' + dateCourte(sim.pause.fin) + ', sans toucher à ses vivres.';
    let tickets = '';
    for (let i = 1; i <= V.STOCK_MAX; i++) {
      if (i <= V.STOCK_MAX - sim.stock) tickets += '<span class="ticket decoupe"></span>';
      else tickets += '<span class="ticket kraft-clair"><span class="pochoir">n° ' + i + '</span><span class="mini">1 ration</span></span>';
    }
    const carte = '<section class="objet kraft carte" aria-label="Carte d’alimentation">' + enteteCarte(numeroCarte()) +
      '<h1 class="titre-imprime">Carte d’alimentation</h1><div class="filet"></div>' +
      '<dl class="champs">' + titulaire(sv) + '<dt>Catégorie</dt><dd>À évaluer</dd><dt>Niveau</dt><dd>' + sim.niveau + '</dd></dl>' +
      '<p class="mention mt-12">Expérience</p>' +
      '<div class="xp"><div class="cases" aria-hidden="true">' + cases + '</div><p class="manuscrit">' + sim.xpDansNiveau + ' sur ' + sim.xpBesoin + '</p></div>' +
      '<div class="vivres"><p class="pochoir chiffre">' + sim.stock + '</p><div><p class="sous-titre">' + (sim.stock > 1 ? 'jours de vivres' : 'jour de vivres') + '</p>' +
      '<p class="mention">' + esc(statut) + '</p></div>' + tamp + '</div>' +
      '<div class="tickets" aria-hidden="true">' + tickets + '</div>' +
      '<p class="petit mt-8">Carte strictement personnelle. Ticket perdu, ration perdue.</p></section>';
    return '<main class="pile">' + carte + peseeDuMatin() + noteCoach() + convocation() + ordreDeSortie() + '</main>';
  }

  // ---------- Visite au dispensaire
  const GRAPHITE = '#4A4945';
  function fondMillimetre(L, H) {
    return '<rect width="' + L + '" height="' + H + '" fill="#FBFBF8"></rect><rect width="' + L + '" height="' + H + '" fill="url(#papier-cm)"></rect>';
  }
  function nombreFr(v, signe) {
    const t = Math.abs(v).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    if (signe) return v > 0 ? '+' + t : v < 0 ? '−' + t : '0';
    return (v < 0 ? '−' : '') + t;
  }
  function convocation() {
    const p = S.profil;
    if (S.brouillon || !V.visiteDue(p, S.jour) || p.visiteReportee === S.jour) return '';
    const premiere = !(p.mesures || []).length;
    return '<section class="objet note" aria-label="Convocation à l’infirmerie">' +
      '<div class="entete" style="align-items: center"><p class="mention">Infirmerie de la Sucrerie</p>' +
      tampon('CONVOCATION', ROUGE, { l: 150, h: 40, taille: 15, rot: -5, classe: 'en-ligne' }) + '</div>' +
      '<p class="manuscrit graphite mt-4">' + (premiere
        ? 'Ida veut te voir pour une première visite : on prend tes mesures de départ, bras, taille et hanches.'
        : 'Deux semaines déjà : Ida t’attend pour ta visite de contrôle.') + '</p>' +
      '<p class="discret mt-4">Deux minutes, le matin à jeun si possible. La visite ne rapporte pas d’XP.</p>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="visite">Passer la visite</button>' +
      '<button type="button" class="lien" data-action="visite-plus-tard">Demain</button></div>' +
      '</section>';
  }
  function cadrePhotoVisite(a) {
    const f = S.form, existante = V.photoDe(S.profil, S.jour, a.cle);
    let contenu = '<span class="vide">+ Photo</span>', retirer = false;
    if (f.photos && f.photos[a.cle]) { contenu = '<img src="' + f.photos[a.cle] + '" alt="' + esc(a.nom) + ', nouvelle photo">'; retirer = true; }
    else if (existante && !(f.retirees && f.retirees[a.cle])) {
      const d = Photos.voir(existante.id);
      contenu = d ? '<img src="' + d + '" alt="' + esc(a.nom) + ', photo du jour">' : '<span class="vide">' + (d === '' ? 'Photo introuvable' : 'Chargement…') + '</span>';
      retirer = true;
    }
    return '<div><label class="cadre-photo" for="f-photo-' + a.cle + '">' + contenu +
      '<input id="f-photo-' + a.cle + '" class="cache-fichier" type="file" accept="image/*" data-photo="' + a.cle + '" aria-label="Photo de ' + esc(a.nom.toLowerCase()) + '"></label>' +
      '<p class="legende-photo">' + esc(a.nom.toUpperCase()) + '</p>' +
      (retirer ? '<div class="centre"><button type="button" class="lien petit-lien" data-action="retirer-photo" data-angle="' + a.cle + '">Retirer</button></div>' : '') + '</div>';
  }
  function blocPhotosVisite() {
    return '<p class="sous-titre mt-16" style="font-size: 19px; line-height: 22px">Fiche signalétique</p>' +
      '<p class="aide">Facultatif. Même endroit, même lumière, le matin : téléphone posé à hauteur de poitrine, à deux mètres, retardateur, bras relâchés. Tes photos ne sont visibles que par toi.</p>' +
      '<div class="fiche-photos">' + V.ANGLES.map(cadrePhotoVisite).join('') + '</div>';
  }
  function ecranVisite() {
    const p = S.profil, f = S.form;
    const derniere = V.mesuresTriees(p).slice(-1)[0];
    const champs = V.MESURES.map(function (def) {
      const hid = 'f-mes-' + def.cle;
      const avant = derniere && typeof derniere[def.cle] === 'number' ? 'Dernière visite : ' + nombreFr(derniere[def.cle]) + ' cm. ' : '';
      return '<div class="bloc mt-12"><label class="mention" for="' + hid + '">' + esc(def.nom) + ', en cm</label>' +
        '<input class="saisie" id="' + hid + '" data-champ="' + def.cle + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(f[def.cle] || '') + '">' +
        '<p class="aide">' + esc(avant + def.aide) + '</p></div>';
    }).join('');
    return '<main class="pile"><section class="objet papier bon" aria-label="Fiche de visite">' +
      '<div class="entete"><p class="mention">Infirmerie de la Sucrerie</p><p class="pochoir">' + esc(dateCourte(S.jour)) + '</p></div>' +
      '<h1 class="titre-imprime">Fiche de visite</h1><div class="filet"></div>' +
      '<p class="discret mt-12">Ida sort son mètre ruban. Le matin à jeun, avant l’entraînement, toujours au même endroit : ruban à plat, sans serrer.</p>' +
      '<div class="actions"><button type="button" class="lien" data-action="tuto">Comment bien mesurer : la fiche d’Ida</button></div>' +
      (V.admissionComplete(p) ? '' : '<p class="sous-titre mt-16" style="font-size: 19px; line-height: 22px">Fiche d’admission, une seule fois</p>' + champsAdmission(p, f) +
        '<p class="sous-titre mt-16" style="font-size: 19px; line-height: 22px">Mesures du jour</p>') +
      champs +
      '<div class="bloc mt-12"><label class="mention" for="f-graisse">Masse grasse selon ta balance, en %</label>' +
      '<input class="saisie" id="f-graisse" data-champ="graisse" type="text" inputmode="decimal" autocomplete="off" value="' + esc(f.graisse || '') + '">' +
      '<p class="aide">Facultatif. Le matin à jeun, comme ta pesée.</p></div>' +
      blocPhotosVisite() +
      (V.moyennePoids(p, S.jour) ? '<p class="discret mt-12">Poids : ' + esc(nombreFr(V.moyennePoids(p, S.jour).kg)) + ' kg, moyenne de ta pesée.</p>' :
        '<div class="bloc mt-12"><label class="mention" for="f-poids-visite">Poids, en kg</label>' +
        '<input class="saisie" id="f-poids-visite" data-champ="poidsVisite" type="text" inputmode="decimal" autocomplete="off" value="' + esc(f.poidsVisite || '') + '">' +
        '<p class="aide">Facultatif : pas de pesée cette semaine.</p></div>') +
      (f.erreur ? '<p class="toast alerte mt-12" role="alert">' + esc(f.erreur) + '</p>' : '') +
      '<button type="button" class="btn btn-principal mt-16" data-action="signer-visite">Signer la fiche</button>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="aller" data-ecran="accueil">Annuler</button></div>' +
      '</section></main>';
  }
  function courbeMesures(p) {
    const dates = V.mesuresTriees(p).map(function (m) { return m.date; });
    const L = 360, H = 200, g = 34, d = 106, h = 16, b = 28;
    const fond = fondMillimetre(L, H);
    if (dates.length < 2) {
      return '<svg class="courbe" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Courbe des mensurations, vide pour l’instant">' + fond +
        '<text x="' + L / 2 + '" y="' + (H / 2 + 6) + '" text-anchor="middle" font-family="Caveat, cursive" font-size="22" fill="' + GRAPHITE + '">' +
        (dates.length ? 'La courbe démarre à la deuxième visite.' : 'Première visite à passer.') + '</text></svg>';
    }
    const series = V.ecartsMesures(p).filter(function (s) { return s.points.length; });
    const t = function (s) { return V.daysBetween(dates[0], s); };
    const tMax = Math.max(1, t(dates[dates.length - 1]));
    let ext = 1;
    series.forEach(function (s) { s.points.forEach(function (pt) { ext = Math.max(ext, Math.abs(pt.ecart)); }); });
    ext = Math.ceil(ext);
    const X = function (s) { return g + t(s) / tMax * (L - g - d); };
    const Y = function (v) { return h + (1 - (v + ext) / (2 * ext)) * (H - h - b); };
    const couleurs = { bras: BLEU, taille: ROUGE, hanches: GRAPHITE };
    const police = 'font-family="Archivo, Arial, sans-serif"';
    let tr = '<line x1="' + g + '" x2="' + (L - d) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="' + GRAPHITE + '" stroke-width="1"></line>';
    [ext, 0, -ext].forEach(function (v) {
      tr += '<text x="' + (g - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + nombreFr(v, true) + '</text>';
    });
    tr += '<text x="' + g + '" y="' + (H - 9) + '" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + esc(dateCourte(dates[0])) + '</text>' +
      '<text x="' + (L - d) + '" y="' + (H - 9) + '" text-anchor="end" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + esc(dateCourte(dates[dates.length - 1])) + '</text>';
    const etiquettes = [];
    series.forEach(function (s) {
      const c = couleurs[s.cle];
      tr += '<polyline points="' + s.points.map(function (pt) { return X(pt.date).toFixed(1) + ',' + Y(pt.ecart).toFixed(1); }).join(' ') +
        '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>';
      s.points.forEach(function (pt) {
        tr += '<circle cx="' + X(pt.date).toFixed(1) + '" cy="' + Y(pt.ecart).toFixed(1) + '" r="2.6" fill="' + c + '"><title>' +
          esc(s.nom + ', ' + dateCourte(pt.date) + ' : ' + nombreFr(pt.valeur) + ' cm') + '</title></circle>';
      });
      const der = s.points[s.points.length - 1];
      etiquettes.push({ y: Y(der.ecart), texte: s.nom + ' ' + nombreFr(der.ecart, true), c: c });
    });
    // Étiquettes au bout des courbes, écartées pour ne pas se chevaucher
    etiquettes.sort(function (a, b2) { return a.y - b2.y; });
    for (let i = 1; i < etiquettes.length; i++) if (etiquettes[i].y - etiquettes[i - 1].y < 15) etiquettes[i].y = etiquettes[i - 1].y + 15;
    const deborde = etiquettes.length ? etiquettes[etiquettes.length - 1].y - (H - b) : 0;
    etiquettes.forEach(function (e) {
      tr += '<text x="' + (L - d + 10) + '" y="' + (e.y - Math.max(0, deborde) + 4) + '" font-size="12" font-weight="700" ' + police + ' fill="' + e.c + '">' + esc(e.texte) + '</text>';
    });
    const resume = etiquettes.map(function (e) { return e.texte + ' cm'; }).join(', ');
    return '<svg class="courbe" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Écart depuis la première visite : ' + esc(resume) + '">' + fond + tr + '</svg>';
  }
  function sectionDossier() {
    const p = S.profil;
    const triees = V.mesuresTriees(p);
    const prochaine = V.prochaineVisite(p, S.jour);
    const lignes = triees.slice().reverse().map(function (m) {
      return '<tr><th scope="row">' + esc(dateCourte(m.date)) + '</th>' + V.MESURES.map(function (def) {
        return '<td>' + (typeof m[def.cle] === 'number' ? nombreFr(m[def.cle]) : '–') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<section class="objet papier feuille inclinee-g" id="dossier" aria-label="Dossier de l’infirmerie">' +
      '<h2 class="sous-titre">Dossier de l’infirmerie</h2>' +
      '<p class="discret mt-4">Écart depuis ta première visite, en centimètres. Les mesures ne rapportent pas d’XP : le jeu récompense l’effort, pas le corps.</p>' +
      courbeMesures(p) +
      (lignes ? '<div class="defile"><table class="tableau-mesures"><caption class="mention">Relevés, en cm</caption><thead><tr><th scope="col">Date</th>' +
        V.MESURES.map(function (def) { return '<th scope="col">' + esc(def.court) + '</th>'; }).join('') + '</tr></thead><tbody>' + lignes + '</tbody></table></div>' : '') +
      '<p class="manuscrit graphite mt-8">' + (prochaine <= S.jour ? 'Visite à passer.' : 'Prochaine visite : ' + esc(dateLongue(prochaine)) + '.') + '</p>' +
      '<div class="actions"><button type="button" class="lien" data-action="visite">Passer une visite</button>' +
      '<button type="button" class="lien" data-action="tuto">Comment bien mesurer</button></div>' +
      '</section>';
  }

  // ---------- Bilan d'Ida : la toise
  function chiffre(v, d) { return v.toFixed(d).replace('.', ','); }
  function champsAdmission(p, f) {
    const sexe = f.sexe || '';
    return '<div class="bloc mt-12"><label class="mention" for="f-hauteur">Ta taille, en cm</label>' +
      '<input class="saisie" id="f-hauteur" data-champ="hauteur" type="text" inputmode="numeric" autocomplete="off" value="' + esc(f.hauteur || '') + '"></div>' +
      '<div class="bloc mt-12"><label class="mention" for="f-naissance">Ton année de naissance</label>' +
      '<input class="saisie" id="f-naissance" data-champ="naissance" type="text" inputmode="numeric" autocomplete="off" value="' + esc(f.naissance || '') + '"></div>' +
      '<p class="mention mt-12" id="l-sexe">Repères de masse grasse</p>' +
      '<div class="groupes" role="group" aria-labelledby="l-sexe" style="grid-template-columns: repeat(2, minmax(0, 1fr))">' +
      [['homme', 'Homme'], ['femme', 'Femme']].map(function (c) {
        return '<button type="button" data-action="sexe" data-valeur="' + c[0] + '" aria-pressed="' + (sexe === c[0]) + '">' + c[1] + '</button>';
      }).join('') + '</div>';
  }
  // Fiche d'admission saisie : null si rien n'est rempli, sinon les valeurs ou une erreur
  function lireAdmission(f) {
    const bh = String(f.hauteur || '').trim(), bn = String(f.naissance || '').trim();
    if (!bh && !bn && !f.sexe) return null;
    const h = Math.round(parseFloat(bh.replace(',', '.'))), an = parseInt(bn, 10), annee = +S.jour.slice(0, 4);
    if (!/^\d+([.,]\d+)?$/.test(bh) || !(h >= V.HAUTEUR_MIN && h <= V.HAUTEUR_MAX)) return { erreur: 'Indique ta taille en centimètres, par exemple 175.' };
    if (!/^\d{4}$/.test(bn) || !(an >= annee - 100 && an <= annee - 14)) return { erreur: 'Indique ton année de naissance, par exemple 1990.' };
    if (f.sexe !== 'homme' && f.sexe !== 'femme') return { erreur: 'Choisis tes repères : homme ou femme.' };
    return { hauteur: h, naissance: an, sexe: f.sexe };
  }
  const POLICE_TOISE = 'font-family="Archivo, Arial, sans-serif"';
  function toiseIndicateur(ind, avant) {
    const W = 320, H = 64, borne = function (v) { return Math.max(ind.min, Math.min(ind.max, v)); };
    const x = function (v) { return 10 + (borne(v) - ind.min) / (ind.max - ind.min) * (W - 20); };
    const valeur = chiffre(ind.valeur, ind.decimales) + (ind.unite || '');
    let s = '';
    ind.zones.forEach(function (z) {
      if (z.type === 'neutre') return;
      const a = x(z.de), b = x(Math.min(z.a, ind.max));
      if (b - a < 1) return;
      s += '<rect x="' + a.toFixed(1) + '" y="14" width="' + (b - a).toFixed(1) + '" height="16" fill="url(#hachure-' + (z.type === 'sain' ? 'sain' : 'risque') + ')"></rect>';
      if (z.nom && b - a >= 30) s += '<text x="' + ((a + b) / 2).toFixed(1) + '" y="60" text-anchor="middle" ' + POLICE_TOISE + ' font-size="11" font-weight="600" fill="' + (z.type === 'sain' ? BLEU : GRAPHITE) + '">' + esc(z.nom) + '</text>';
    });
    s += '<line x1="10" y1="30" x2="' + (W - 10) + '" y2="30" stroke="#1F1D1A" stroke-width="1.6"></line>';
    const n = Math.round((ind.max - ind.min) / ind.pas);
    for (let k = 0; k <= n; k++) {
      const v = ind.min + k * ind.pas;
      s += '<line x1="' + x(v).toFixed(1) + '" y1="30" x2="' + x(v).toFixed(1) + '" y2="' + (k % 5 === 0 ? 37 : 34) + '" stroke="#1F1D1A" stroke-width="1"></line>';
    }
    ind.graduations.forEach(function (v) {
      s += '<text x="' + x(v).toFixed(1) + '" y="47" text-anchor="middle" ' + POLICE_TOISE + ' font-size="11" fill="' + GRAPHITE + '">' + esc(String(v).replace('.', ',')) + '</text>';
    });
    if (ind.reference) {
      const xr = x(ind.reference).toFixed(1);
      s += '<line x1="' + xr + '" y1="12" x2="' + xr + '" y2="30" stroke="' + GRAPHITE + '" stroke-width="1.4" stroke-dasharray="3 2"></line>' +
        '<text x="' + xr + '" y="47" text-anchor="middle" ' + POLICE_TOISE + ' font-size="11" fill="' + GRAPHITE + '">' + esc(chiffre(ind.reference, 1)) + '</text>' +
        '<text x="' + xr + '" y="60" text-anchor="middle" ' + POLICE_TOISE + ' font-size="11" font-weight="600" fill="' + GRAPHITE + '">médiane</text>';
    }
    if (avant) {
      const xa = x(avant.valeur);
      s += '<path d="M' + (xa - 5).toFixed(1) + ' 4 L' + (xa + 5).toFixed(1) + ' 4 L' + xa.toFixed(1) + ' 11 Z" fill="' + GRAPHITE + '" opacity="0.55"></path>' +
        '<line x1="' + xa.toFixed(1) + '" y1="10" x2="' + xa.toFixed(1) + '" y2="30" stroke="' + GRAPHITE + '" stroke-width="1.4" opacity="0.55"></line>';
    }
    const xv = x(ind.valeur);
    s += '<g filter="url(#encre)"><line x1="' + xv.toFixed(1) + '" y1="8" x2="' + xv.toFixed(1) + '" y2="31" stroke="' + BLEU + '" stroke-width="2.6"></line>' +
      '<path d="M' + (xv - 7).toFixed(1) + ' 2 L' + (xv + 7).toFixed(1) + ' 2 L' + xv.toFixed(1) + ' 11 Z" fill="' + BLEU + '"></path></g>';
    const zone = ind.zone ? ', zone ' + (ind.zone.nom || 'sous les repères') : '';
    const lu = ind.nom + ' : ' + valeur + zone + (ind.reference ? ', médiane ' + chiffre(ind.reference, 1) : '') + (avant ? ', visite précédente ' + chiffre(avant.valeur, ind.decimales) : '');
    return '<div class="toise-ligne"><div class="entete"><p class="mention">' + esc(ind.nom) + '</p><p class="manuscrit">' + esc(valeur) + '</p></div>' +
      '<svg class="toise" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(lu) + '">' + s + '</svg>' +
      (ind.tranche ? '<p class="petit" style="color: var(--graphite)">Repères pour ' + esc(S.profil.sexe === 'femme' ? 'une femme' : 'un homme') + ' de ' + esc(ind.tranche) + '.</p>' : '') +
      (ind.reference ? '<p class="petit" style="color: var(--graphite)">Ta masse maigre ramenée à ta taille. Médiane des ' + esc(S.profil.sexe === 'femme' ? 'femmes' : 'hommes') + ' de 18 à 34 ans : ' + esc(chiffre(ind.reference, 1)) + '.</p>' : '') +
      '</div>';
  }
  function toiseSuivi(suivi) {
    const W = 320, H = 48, valeurs = suivi.points.map(function (pt) { return pt.valeur; });
    let min = Math.floor(Math.min.apply(null, valeurs)) - 3, max = Math.ceil(Math.max.apply(null, valeurs)) + 3;
    if (max - min < 10) { const c = (min + max) / 2; min = Math.floor(c - 5); max = min + 10; }
    const x = function (v) { return 10 + (v - min) / (max - min) * (W - 20); };
    let s = '<line x1="10" y1="24" x2="' + (W - 10) + '" y2="24" stroke="#1F1D1A" stroke-width="1.6"></line>';
    for (let v = min; v <= max + 1e-9; v += 0.5) s += '<line x1="' + x(v).toFixed(1) + '" y1="24" x2="' + x(v).toFixed(1) + '" y2="' + (Number.isInteger(v) ? 31 : 28) + '" stroke="#1F1D1A" stroke-width="1"></line>';
    for (let v = min + 1; v < max; v += 2) s += '<text x="' + x(v).toFixed(1) + '" y="43" text-anchor="middle" ' + POLICE_TOISE + ' font-size="11" fill="' + GRAPHITE + '">' + v + '</text>';
    suivi.points.slice(0, -1).forEach(function (pt) {
      s += '<line x1="' + x(pt.valeur).toFixed(1) + '" y1="10" x2="' + x(pt.valeur).toFixed(1) + '" y2="24" stroke="' + GRAPHITE + '" stroke-width="1.4" opacity="0.55"></line>';
    });
    const der = suivi.points[suivi.points.length - 1], xv = x(der.valeur), droite = xv < W - 70;
    s += '<g filter="url(#encre)"><line x1="' + xv.toFixed(1) + '" y1="8" x2="' + xv.toFixed(1) + '" y2="25" stroke="' + BLEU + '" stroke-width="2.6"></line>' +
      '<path d="M' + (xv - 7).toFixed(1) + ' 2 L' + (xv + 7).toFixed(1) + ' 2 L' + xv.toFixed(1) + ' 11 Z" fill="' + BLEU + '"></path></g>' +
      '<text x="' + (droite ? xv + 10 : xv - 10).toFixed(1) + '" y="15" text-anchor="' + (droite ? 'start' : 'end') + '" font-family="Caveat, cursive" font-size="17" font-weight="600" fill="' + BLEU + '">' + esc(dateCourte(der.date)) + '</text>';
    const lu = suivi.nom + ' : ' + suivi.points.map(function (pt) { return dateCourte(pt.date) + ' ' + nombreFr(pt.valeur) + ' cm'; }).join(', ');
    return '<div class="toise-ligne"><div class="entete"><p class="mention">' + esc(suivi.nom) + '</p><p class="manuscrit">' + esc(nombreFr(der.valeur)) + ' cm</p></div>' +
      '<svg class="toise" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(lu) + '">' + s + '</svg>' +
      '<p class="petit" style="color: var(--graphite)">Pas de norme : chaque visite ajoute un trait.</p></div>';
  }
  function sectionBilan() {
    const p = S.profil, triees = V.mesuresTriees(p);
    if (!triees.length) return '';
    const m = triees[triees.length - 1], f = S.form;
    const b = V.bilanIda(p, m), avant = triees.length > 1 ? V.bilanIda(p, triees[triees.length - 2]) : null;
    const edition = !V.admissionComplete(p) || f.admission;
    let corps = '';
    if (edition) {
      corps = '<p class="manuscrit graphite mt-12">' + (V.admissionComplete(p) ? 'Corrige ta fiche d’admission.' : 'Pour ton bilan, Ida a besoin de ta taille, de ton année de naissance et de tes repères.') + '</p>' +
        champsAdmission(p, f) +
        (f.erreur ? '<p class="toast alerte mt-12" role="alert">' + esc(f.erreur) + '</p>' : '') +
        '<button type="button" class="btn btn-trait mt-12" data-action="admission">Enregistrer ma fiche</button>';
    } else {
      ['ratio', 'imc', 'graisse', 'maigre'].forEach(function (cle) {
        const ind = b.indicateurs[cle];
        if (ind) corps += toiseIndicateur(ind, avant && avant.indicateurs[cle]);
      });
      if (!b.indicateurs.graisse) corps += '<p class="discret mt-12">Note ta masse grasse à la prochaine visite : Ida ajoutera ta masse grasse et ta masse maigre.</p>';
    }
    corps += b.suivis.map(toiseSuivi).join('');
    if (b.ecarts.length) corps += '<p class="discret mt-12">Depuis le ' + esc(dateCourte(b.avant)) + ' : ' + esc(b.ecarts.map(function (e) {
      return e.nom.toLowerCase() + ' ' + (e.ecart ? nombreFr(e.ecart, true) + ' cm' : 'stable');
    }).join(', ')) + '.</p>';
    const entete = [dateLongue(m.date)];
    if (b.age != null && !edition) entete.push(b.age + ' ans', p.hauteur + ' cm');
    if (b.poids && !edition) entete.push(nombreFr(b.poids.kg) + ' kg' + (b.poids.source === 'pesee' ? ', moyenne de ta pesée' : ''));
    return '<section class="objet papier feuille" id="bilan" aria-label="Bilan d’Ida">' +
      '<div class="entete"><p class="mention">Dispensaire de la Sucrerie</p><p class="pochoir">Visite n° ' + triees.length + '</p></div>' +
      '<h2 class="sous-titre mt-4">Bilan d’Ida</h2>' +
      '<p class="discret mt-4">' + esc(majuscule(entete.join(' · '))) + '</p>' + corps +
      (!edition && b.note ? '<p class="manuscrit graphite mt-16">« ' + esc(b.note) + ' »</p><p class="mention mt-4" style="text-align: right">Ida</p>' : '') +
      (!edition ? '<div class="actions mt-4"><button type="button" class="lien" data-action="modifier-admission">Corriger ma fiche d’admission</button></div>' : '') +
      '</section>';
  }

  // ---------- Fiche signalétique : photos, comparaison à glisser, rapport d'Ida
  function imagePhoto(ph, alt) {
    const d = Photos.voir(ph.id);
    return d ? '<img src="' + d + '" alt="' + esc(alt) + '">' : '<span class="vide">' + (d === '' ? 'Photo introuvable' : 'Chargement…') + '</span>';
  }
  function ligneRapport(titre, contenu) {
    return '<div class="rapport-ligne">' + tampon(titre, ROUGE, { l: 124, h: 32, taille: 12, rot: -3, classe: 'en-ligne' }) + '<div>' + contenu + '</div></div>';
  }
  function sectionPhotos() {
    const p = S.profil, paires = V.pairesPhotos(p);
    const duJour = (p.mesures || []).some(function (m) { return m.date === S.jour; });
    const tete = '<div class="entete"><p class="mention">Service anthropométrique</p><p class="pochoir">Fiche n° ' + Math.max(1, new Set((p.photos || []).map(function (x) { return x.date; })).size) + '</p></div>' +
      '<h2 class="titre-imprime" style="font-size: 30px; line-height: 34px">Fiche signalétique</h2><div class="filet"></div>';
    if (!paires.length) {
      return '<section class="objet papier bon" id="photos" aria-label="Fiche signalétique">' + tete +
        '<p class="discret mt-8">À chaque visite, trois photos (face, profil, dos), prises toujours pareil. Ida les compare d’une visite à l’autre' + (Regard.etat === 'ok' || Regard.etat === 'refuse' ? ' et peut les commenter' : '') + '.</p>' +
        '<button type="button" class="btn btn-trait mt-12" data-action="visite">' + (duJour ? 'Ajouter mes photos à la visite du jour' : 'Passer une visite') + '</button></section>';
    }
    const grille = '<div class="fiche-photos">' + V.ANGLES.map(function (a) {
      const pr = paires.filter(function (x) { return x.angle === a.cle; })[0];
      return '<div><div class="cadre-photo">' + (pr ? imagePhoto(pr.apres, a.nom + ', ' + dateCourte(pr.apres.date)) : '<span class="vide">Pas de photo</span>') + '</div>' +
        '<p class="legende-photo">' + esc(a.nom.toUpperCase()) + '</p>' + (pr ? '<p class="petit centre" style="color: var(--graphite)">' + esc(dateCourte(pr.apres.date)) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
    const comparables = paires.filter(function (x) { return x.avant; });
    let comparaison = '';
    if (comparables.length) {
      const choix = S.comparer && comparables.some(function (x) { return x.angle === S.comparer.angle; }) ? S.comparer : { angle: comparables[0].angle, pos: 50 };
      const pr = comparables.filter(function (x) { return x.angle === choix.angle; })[0];
      comparaison = '<p class="mention mt-16">Comparer : ' + esc(pr.nom.toLowerCase()) + '</p>' +
        (comparables.length > 1 ? '<div class="groupes" role="group" aria-label="Angle à comparer">' + comparables.map(function (x) {
          return '<button type="button" data-action="comparer" data-angle="' + x.angle + '" aria-pressed="' + (x.angle === pr.angle) + '">' + esc(x.nom) + '</button>';
        }).join('') + '</div>' : '') +
        '<div class="comparateur mt-8" style="--pos: ' + choix.pos + '%"><div class="vue">' +
        imagePhoto(pr.avant, pr.nom + ', ' + dateCourte(pr.avant.date)) +
        '<div class="apres">' + imagePhoto(pr.apres, pr.nom + ', ' + dateCourte(pr.apres.date)) + '</div>' +
        '<div class="barre"></div><div class="poignee" aria-hidden="true">↔</div>' +
        '<div class="date-avant">' + tampon(dateCourte(pr.avant.date).toUpperCase(), GRAPHITE, { l: 92, h: 32, taille: 13, rot: -5, classe: 'en-ligne' }) + '</div>' +
        '<div class="date-apres">' + tampon(dateCourte(pr.apres.date).toUpperCase(), BLEU, { l: 92, h: 32, taille: 13, rot: 4, classe: 'en-ligne' }) + '</div>' +
        '<input type="range" min="0" max="100" step="1" value="' + choix.pos + '" data-comparer="' + pr.angle + '" aria-label="Comparer la première photo et la dernière : à gauche avant, à droite maintenant"></div></div>' +
        '<p class="petit mt-4" style="color: var(--graphite)">Fais glisser la barre : à gauche ta première photo, à droite la dernière.</p>';
    }
    const r = rapportCourant();
    let rapport = '';
    if (r) {
      rapport = '<p class="mention mt-16">Rapport d’Ida</p>' +
        ligneRapport('CHANGEMENTS', '<p class="consigne" style="margin-top: 0">' + esc(r.changements) + '</p>') +
        (r.posture ? ligneRapport('POSTURE', '<p class="consigne" style="margin-top: 0">' + esc(r.posture) + '</p>') : '') +
        (r.conseils.length ? ligneRapport('CONSEILS', '<ul class="etapes" style="margin-top: 0">' + r.conseils.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>') : '') +
        (r.conditions ? '<p class="discret mt-8">Prudence : ' + esc(r.conditions) + '</p>' : '') +
        (r.actions.length && !r.appliquees ? '<p class="manuscrit graphite mt-12">Ida propose : ' + esc(r.actions.map(V.libelleAction).join(' ; ')) + '.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="appliquer-regard">Appliquer au programme</button>' +
          '<button type="button" class="lien" data-action="ignorer-regard">Plus tard</button></div>' : '') +
        (Regard.etat === 'ok' && !S.regardEnCours ? '<div class="actions mt-4"><button type="button" class="lien" data-action="regard">Refaire le rapport</button></div>' : '');
    }
    if (S.regardEnCours) rapport += '<p class="manuscrit graphite mt-16" role="status">Ida examine tes photos…</p>';
    else if (!r && Regard.etat === 'ok') rapport += '<button type="button" class="btn btn-trait mt-16" data-action="regard">Demander le rapport d’Ida</button>' +
      '<p class="aide">Tes photos sont envoyées à Claude, sur ton compte, le temps de l’analyse.</p>';
    else if (!r && Regard.etat === 'refuse') rapport += '<p class="discret mt-16">Tu n’as pas autorisé l’envoi des photos à Claude : le rapport d’Ida reste fermé.</p>';
    return '<section class="objet papier bon" id="photos" aria-label="Fiche signalétique">' + tete + grille + comparaison + rapport +
      '<button type="button" class="btn btn-principal mt-16" data-action="visite">' + (duJour ? 'Reprendre les photos du jour' : 'Prendre les photos à la visite') + '</button></section>';
  }

  // ---------- Fiche d'Ida : bien se mesurer
  const FIGURE_MESURES = '<svg class="figure-mesures" viewBox="0 0 220 300" role="img" aria-label="Silhouette avec trois rubans : 1 autour du bras contracté, 2 à la taille au niveau du nombril, 3 au plus large des hanches">' +
    '<g fill="#FBFBF8" stroke="#4A4945" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M93 49 L93 57 Q80 58 67 64 Q60 68 58 80 L54 128 Q53 140 57 146 Q63 149 65 141 L67 124 L71 92 Q72 87 75 85 L77 118 Q80 134 81 146 Q77 160 76 176 Q75 186 77 196 L81 286 L95 288 L95 280 L98 210 Q100 204 102 210 L105 280 L105 288 L119 286 L123 196 Q125 186 124 176 Q123 160 119 146 Q120 134 123 118 L125 85 Q132 87 140 87 L167 89 Q178 89 180 81 L180 50 Q181 40 175 36 Q167 33 164 41 L164 70 Q152 56 138 63 Q128 60 117 57 L107 57 L107 49 Z"></path>' +
    '<circle cx="100" cy="31" r="17"></circle></g>' +
    '<g fill="none" stroke="#A61E22" stroke-width="2" stroke-dasharray="3 2"><ellipse cx="150" cy="74" rx="3.5" ry="14"></ellipse><ellipse cx="100" cy="146" rx="21" ry="3.5"></ellipse><ellipse cx="100" cy="186" rx="26" ry="3.5"></ellipse></g>' +
    '<g stroke="#A61E22" stroke-width="1"><line x1="150" y1="58" x2="150" y2="52"></line><line x1="122" y1="146" x2="134" y2="146"></line><line x1="127" y1="186" x2="139" y2="186"></line></g>' +
    '<g fill="#A61E22"><circle cx="150" cy="44" r="8"></circle><circle cx="142" cy="146" r="8"></circle><circle cx="147" cy="186" r="8"></circle></g>' +
    '<g fill="#FFFFFF" font-family="Archivo, Arial, sans-serif" font-weight="700" font-size="11" text-anchor="middle"><text x="150" y="48">1</text><text x="142" y="150">2</text><text x="147" y="190">3</text></g>' +
    '</svg>';
  function ecranTuto() {
    function liste(items) { return '<ul class="etapes">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
    function mesure(n, titre, texte) {
      return '<h2 class="sous-titre mt-16"><span class="pastille" aria-hidden="true">' + n + '</span>' + esc(titre) + '</h2><p class="consigne">' + esc(texte) + '</p>';
    }
    return '<main class="pile"><section class="objet papier bon" aria-label="Fiche d’Ida : bien se mesurer">' +
      '<div class="entete"><p class="mention">Infirmerie de la Sucrerie</p><p class="pochoir">Affiche</p></div>' +
      '<h1 class="titre-imprime">Bien se mesurer</h1><div class="filet"></div>' +
      '<p class="discret mt-12">Ida a punaisé cette fiche au mur de l’infirmerie. Ce sont les mêmes conditions, à chaque fois, qui rendent tes mesures comparables.</p>' +
      FIGURE_MESURES +
      '<h2 class="sous-titre mt-16">Avant de commencer</h2>' +
      liste([
        'Le matin, à jeun, après être passé aux toilettes et avant l’entraînement : l’effort gonfle les muscles pendant quelques heures.',
        'Torse nu ou en sous-vêtements, devant un miroir.',
        'Un mètre ruban souple de couturière, posé à plat sur la peau, ni lâche ni enfoncé.',
        'Mesure deux fois. Si les deux valeurs diffèrent de plus d’un demi-centimètre, recommence.'
      ]) +
      mesure(1, 'Tour de bras', 'Toujours le même bras. Lève-le sur le côté, coude plié à angle droit et poing serré, puis contracte le biceps. Passe le ruban autour du point le plus haut du biceps, bien perpendiculaire au bras.') +
      mesure(2, 'Tour de taille', 'Debout, pieds écartés de la largeur du bassin, ventre relâché : ne le rentre pas. Place le ruban à l’horizontale au niveau du nombril, et lis la mesure à la fin d’une expiration normale.') +
      mesure(3, 'Tour de hanches', 'Debout, pieds joints, fessiers relâchés. Regarde-toi de profil dans le miroir et place le ruban à l’horizontale, au point le plus large des fessiers.') +
      '<h2 class="sous-titre mt-16">La pesée</h2>' +
      liste([
        'Le matin, après les toilettes, avant de boire ou de manger, sans vêtements.',
        'Toujours la même balance, posée au même endroit sur un sol dur et plat.',
        'Ton poids varie d’un ou deux kilos d’un jour à l’autre, avec l’eau et le sel des repas : ne juge jamais une pesée seule, regarde la moyenne sur 7 jours.'
      ]) +
      '<button type="button" class="btn btn-principal mt-16" data-action="retour-tuto">' + (S.retourTuto === 'visite' ? 'Retour à la fiche de visite' : 'Retour au dossier') + '</button>' +
      '</section></main>';
  }

  // ---------- Registre de pesée
  function courbePoids(p) {
    const pts = V.seriePoids(p, S.jour, 56);
    const L = 360, H = 170, g = 40, d = 76, h = 14, b = 26;
    const fond = fondMillimetre(L, H);
    if (pts.length < 2) {
      return '<svg class="courbe" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Courbe du poids, vide pour l’instant">' + fond +
        '<text x="' + L / 2 + '" y="' + (H / 2 + 6) + '" text-anchor="middle" font-family="Caveat, cursive" font-size="22" fill="' + GRAPHITE + '">' +
        (pts.length ? 'La courbe démarre à la deuxième pesée.' : 'Première pesée à noter.') + '</text></svg>';
    }
    const kgs = pts.map(function (x) { return x.kg; }).concat(pts.map(function (x) { return x.moyenne; }));
    let lo = Math.floor(Math.min.apply(null, kgs)), hi = Math.ceil(Math.max.apply(null, kgs));
    if (hi - lo < 2) { const mid = (lo + hi) / 2; lo = Math.floor(mid - 1); hi = Math.ceil(mid + 1); }
    const t0 = pts[0].date, tMax = Math.max(1, V.daysBetween(t0, pts[pts.length - 1].date));
    const X = function (s) { return g + V.daysBetween(t0, s) / tMax * (L - g - d); };
    const Y = function (v) { return h + (hi - v) / (hi - lo) * (H - h - b); };
    const police = 'font-family="Archivo, Arial, sans-serif"';
    let tr = '';
    [hi, lo].forEach(function (v) {
      tr += '<text x="' + (g - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + v + '</text>';
    });
    tr += '<text x="' + g + '" y="' + (H - 9) + '" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + esc(dateCourte(t0)) + '</text>' +
      '<text x="' + (L - d) + '" y="' + (H - 9) + '" text-anchor="end" font-size="11" ' + police + ' fill="' + GRAPHITE + '">' + esc(dateCourte(pts[pts.length - 1].date)) + '</text>';
    pts.forEach(function (x) {
      tr += '<circle cx="' + X(x.date).toFixed(1) + '" cy="' + Y(x.kg).toFixed(1) + '" r="2.4" fill="' + GRAPHITE + '" fill-opacity="0.55"><title>' +
        esc(dateCourte(x.date) + ' : ' + nombreFr(x.kg) + ' kg') + '</title></circle>';
    });
    tr += '<polyline points="' + pts.map(function (x) { return X(x.date).toFixed(1) + ',' + Y(x.moyenne).toFixed(1); }).join(' ') +
      '" fill="none" stroke="' + BLEU + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></polyline>';
    const der = pts[pts.length - 1];
    tr += '<text x="' + (X(der.date) + 8).toFixed(1) + '" y="' + (Y(der.moyenne) + 4).toFixed(1) + '" font-size="12" font-weight="700" ' + police + ' fill="' + BLEU + '">' + esc(nombreFr(der.moyenne) + ' kg') + '</text>';
    return '<svg class="courbe" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Poids, moyenne sur 7 jours : ' + esc(nombreFr(der.moyenne)) + ' kg">' + fond + tr + '</svg>' +
      '<p class="aide">Points : pesées du matin. Trait bleu : moyenne sur 7 jours.</p>';
  }
  function sectionPesee() {
    const p = S.profil;
    const m = V.moyennePoids(p, S.jour);
    const t = V.tendancePoids(p, S.jour);
    const deja = (p.pesees || []).some(function (x) { return x.date === S.jour; });
    const r = p.rappelPesee || 'matin';
    const choix = [['matin', 'Chaque matin'], ['lundi', 'Le lundi'], ['jamais', 'Jamais']];
    return '<section class="objet papier feuille" id="pesee" aria-label="Registre de pesée">' +
      '<h2 class="sous-titre">Registre de pesée</h2>' +
      '<p class="discret mt-4">Ton poids varie d’un jour à l’autre : le registre retient la moyenne sur 7 jours. Comme les mesures, la pesée ne rapporte pas d’XP.</p>' +
      (m ? '<div class="poids"><p class="pochoir">' + nombreFr(m.kg) + ' kg</p><p class="mention">moyenne sur 7 jours, ' + pluriel(m.n, 'pesée', 'pesées') + '</p></div>' : '') +
      (t ? '<p class="manuscrit graphite">' + (t.ecart === 0 ? 'Stable depuis la semaine dernière.' : 'Depuis la semaine dernière : ' + nombreFr(t.ecart, true) + ' kg.') + '</p>' : '') +
      (t && t.rapide ? '<p class="toast alerte mt-8">Ida : tu perds plus de 1 % de ton poids par semaine. À ce rythme, tu perds aussi du muscle ; mange un peu plus.</p>' : '') +
      courbePoids(p) +
      '<div class="pesee-ligne mt-12"><label class="mention" for="f-kg">' + (deja ? 'Corriger la pesée de ce matin, en kg' : 'Pesée de ce matin, en kg') + '</label>' +
      '<input class="saisie" id="f-kg" data-champ="kg" type="text" inputmode="decimal" autocomplete="off" value="' + esc(S.form.kg || '') + '">' +
      '<button type="button" class="btn btn-trait" data-action="noter-pesee">Noter</button></div>' +
      '<p class="mention mt-12" id="l-rappel">Rappel sur ta carte, le matin</p>' +
      '<div class="groupes" role="group" aria-labelledby="l-rappel">' + choix.map(function (c) {
        return '<button type="button" data-action="rappel" data-valeur="' + c[0] + '" aria-pressed="' + (r === c[0]) + '">' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="tuto">Comment bien se peser</button></div>' +
      '</section>';
  }
  function peseeDuMatin() {
    const p = S.profil;
    if (S.brouillon || !V.rappelPesee(p, S.jour, new Date().getHours())) return '';
    return '<section class="objet note" aria-label="Pesée du matin">' +
      '<div class="entete"><p class="mention">Infirmerie de la Sucrerie</p><p class="pochoir">' + esc(dateCourte(S.jour)) + '</p></div>' +
      '<h2 class="sous-titre mt-4">Pesée du matin</h2>' +
      '<p class="discret mt-4">Après les toilettes, avant de boire ou de manger.</p>' +
      '<div class="pesee-ligne"><label class="mention" for="f-kg-matin">Poids, en kg</label>' +
      '<input class="saisie" id="f-kg-matin" data-champ="kg" type="text" inputmode="decimal" autocomplete="off" value="' + esc(S.form.kg || '') + '">' +
      '<button type="button" class="btn btn-principal" data-action="noter-pesee">Noter</button></div>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="pesee-plus-tard">Pas aujourd’hui</button></div>' +
      '</section>';
  }

  function noteCoach() {
    const liste = V.suggestions(S.profil, S.seances).filter(function (s) { return !S.ignorees[s.id + '|' + s.vers]; });
    let html = '';
    (S.profil.annonces || []).forEach(function (a) {
      if (a === 'triceps') {
        html += '<div class="mt-8"><p class="manuscrit graphite">Ta priorité biceps devient « Bras » : j’ai ajouté l’extension triceps, car le triceps fait la plus grosse part du bras. Tu peux la retirer dans l’onglet Survivant.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="annonce-lue" data-id="triceps">Compris</button></div></div>';
      } else if (a === 'jambes') {
        const m = S.profil.plan.minutes, court = m < 70;
        html += '<div class="mt-8"><p class="manuscrit graphite">Jambes et fessiers reviennent : squat et hip thrust.' +
          (court ? ' À ' + m + ' minutes, je dois couper des séries partout ; à 70 minutes, chacun garde les siennes.' : '') + '</p>' +
          '<div class="actions">' + (court ? '<button type="button" class="lien" data-action="duree" data-minutes="70">Passer à 70 min</button>' : '') +
          '<button type="button" class="lien" data-action="annonce-lue" data-id="jambes">' + (court ? 'Garder ' + m + ' min' : 'Compris') + '</button></div></div>';
      } else if (a === 'elastiques') {
        const actif = function (id) { return S.profil.programme.filter(function (e) { return e.id === id && e.actif; })[0]; };
        const squat = actif('squat'), triceps = actif('triceps'), changes = [];
        if (squat) changes.push('le squat repart au poids du corps, puis passera aux élastiques quand il deviendra trop facile');
        if (triceps) changes.push('l’extension triceps se fait à l’' + V.reglage(triceps, S.profil).toLowerCase());
        if (!changes.length) return;
        html += '<div class="mt-8"><p class="manuscrit graphite">J’ai suivi ton choix : ' + esc(changes.join(' ; ')) + '. Tu peux ajuster ces réglages dans l’onglet Survivant.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="annonce-lue" data-id="elastiques">Compris</button></div></div>';
      } else if (a === 'photos') {
        html += '<div class="mt-8"><p class="manuscrit graphite">Ida ouvre une fiche signalétique : à chaque visite, trois photos (face, profil, dos) pour voir ce qui change' + (REGARD_IDA ? ', et son rapport si tu le demandes' : '') + '. Tu peux ajouter celles d’aujourd’hui à ta visite.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="annonce-photos">Ajouter mes photos</button>' +
          '<button type="button" class="lien" data-action="annonce-lue" data-id="photos">Compris</button></div></div>';
      } else if (a === 'bilan') {
        html += '<div class="mt-8"><p class="manuscrit graphite">Ida fait maintenant un bilan de santé à chaque visite. Complète ta fiche d’admission, ta taille et ton année de naissance, pour voir le tien.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="voir-bilan">Voir mon bilan</button>' +
          '<button type="button" class="lien" data-action="annonce-lue" data-id="bilan">Compris</button></div></div>';
      } else if (a === 'calibrage') {
        html += '<div class="mt-8"><p class="manuscrit graphite">Nouveau : après ta prochaine séance, je te proposerai pour chaque exercice une fourchette tirée de ce que tu auras réellement fait. Je recommencerai à chaque nouvel échelon, et tu pourras toujours la changer dans l’onglet Survivant.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="annonce-lue" data-id="calibrage">Compris</button></div></div>';
      } else if (a === 'reglages') {
        html += '<div class="mt-8"><p class="manuscrit graphite">Nouveau : tu règles toi-même le nombre de répétitions de chaque exercice, et la liste de tes élastiques. Le squat a aussi un échelon plus facile : t’asseoir sur ton banc et te relever.</p>' +
          '<div class="actions"><button type="button" class="lien" data-action="voir-reglages">Régler mon programme</button>' +
          '<button type="button" class="lien" data-action="annonce-lue" data-id="reglages">Compris</button></div></div>';
      }
    });
    V.calibragesEnAttente(S.profil).forEach(function (x) {
      const ex = S.profil.programme.filter(function (e) { return e.id === x.id; })[0];
      const nom = V.nomExercice(ex, S.profil), f = V.fourchette(ex);
      const texte = x.reps
        ? nom + ' : tu as fait ' + listeFr(x.series) + '. Je te propose ' + x.reps[0] + ' à ' + x.reps[1] + ' répétitions par série.'
        : nom + ' : ' + (x.sens < 0 ? 'trop dur pour l’instant' : 'trop facile') + ', avec ' + listeFr(x.series) + '. Je te propose : ' + x.texte.charAt(0).toLowerCase() + x.texte.slice(1) + '.';
      html += '<div class="mt-8"><p class="manuscrit graphite">' + esc(texte) + '</p>' +
        '<div class="actions"><button type="button" class="lien" data-action="calibrage" data-ex="' + x.id + '" data-ok="1">Appliquer</button>' +
        '<button type="button" class="lien" data-action="calibrage" data-ex="' + x.id + '" data-ok="0">' + (x.reps ? 'Garder ' + f.min + ' à ' + f.max : 'Garder ce réglage') + '</button></div></div>';
    });
    if (S.profil.priorites == null) {
      html += '<div class="mt-8"><p class="manuscrit graphite">Nouveau : choisis jusqu’à deux groupes musculaires prioritaires. Je les mettrai en tête de séance, avec plus de séries.</p>' +
        '<div class="actions"><button type="button" class="lien" data-action="choisir-priorites">Choisir mes priorités</button></div></div>';
    }
    html += liste.map(function (s) {
      return '<div class="mt-8"><p class="manuscrit graphite">' + esc(V.CATALOGUE[s.id].nom) + ' : ' + esc(s.texte) + '</p>' +
        '<div class="actions"><button type="button" class="lien" data-action="appliquer" data-ex="' + s.id + '">Appliquer</button>' +
        '<button type="button" class="lien" data-action="ignorer" data-cle="' + esc(s.id + '|' + s.vers) + '">Plus tard</button></div></div>';
    }).join('');
    return html ? '<section class="objet note" aria-label="Note du coach"><p class="mention">Le coach</p>' + html + '</section>' : '';
  }

  function ordreDeSortie() {
    const sim = S.sim, p = S.profil;
    const plan = V.planSeance(p);
    const faites = V.expeditionsPrevuesSemaine(S.seances, S.jour);
    const cible = p.plan.jours.length;
    function ligne(x) {
      const type = V.CATALOGUE[x.ex.id].type;
      const reglage = type === 'variante' || type === 'mixte' ? '' : esc(V.reglage(x.ex, p));
      const prio = x.priorite ? '<span class="prio">priorité ' + esc(prioritesTexte(x.groupes)) + '</span>' : '';
      const detail = reglage || prio ? '<br><span class="petit">' + reglage + (reglage && prio ? ', ' : '') + prio + '</span>' : '';
      return '<li><span>' + esc(V.nomExercice(x.ex, p)) + detail + '</span><span>' + x.series + ' séries</span></li>';
    }
    const prios = p.priorites || [];
    let liste = '<p class="mention mt-12">' + (prios.length ? 'Priorités : ' + esc(prioritesTexte(prios)) : 'Exercices, dans l’ordre') + '</p>' +
      '<ol class="liste-exos">' + plan.exos.map(ligne).join('') + '</ol>';
    if (plan.depasse) liste += '<p class="manuscrit graphite mt-8">Plus long que tes ' + p.plan.minutes + ' min visées : retire un exercice dans l’onglet Survivant.</p>';
    if (S.brouillon) {
      return '<section class="objet papier feuille">' + TROMBONE + '<h2 class="sous-titre">Expédition en cours</h2>' +
        '<p class="mention mt-8">Lieu</p><p class="manuscrit ligne">' + esc(S.brouillon.lieu) + '</p>' +
        '<button type="button" class="btn btn-principal mt-16" data-action="reprendre-expedition">Reprendre l’expédition</button></section>';
    }
    const lieu = V.LIEUX[sim.expeditions % V.LIEUX.length];
    return '<section class="objet papier feuille">' + TROMBONE +
      '<h2 class="sous-titre">Ordre de sortie</h2>' +
      '<p class="mention mt-8">Lieu</p><p class="manuscrit ligne">' + esc(lieu) + '</p>' +
      '<p class="mention mt-4">Quand</p><p class="manuscrit ligne">' + esc(quand(V.prochaineExpedition(p, S.seances, S.jour))) + '</p>' +
      '<p class="mention mt-4">Durée estimée</p><p class="manuscrit ligne">Environ ' + plan.minutes + ' min</p>' +
      liste +
      (sim.convalescence ? '<p class="manuscrit graphite mt-8">Convalescence : encore ' + pluriel(sim.convalescence, 'expédition', 'expéditions') + ' à demi-XP.</p>' : '') +
      '<button type="button" class="btn btn-principal mt-16" data-action="partir">Partir en expédition</button>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="libre">Noter une activité libre</button></div>' +
      '<p class="manuscrit graphite mt-4">Cette semaine : ' + Math.min(faites, cible) + ' expédition' + (faites > 1 ? 's' : '') + ' sur ' + cible + '.</p>' +
      '</section>';
  }

  // ---------- Expédition
  function precedent(exo, serie) {
    const triees = S.seances.filter(function (x) { return x.genre === 'expedition'; })
      .sort(function (a, b) { return a.debut < b.debut ? 1 : -1; });
    for (let i = 0; i < triees.length; i++) {
      const e = (triees[i].exercices || []).filter(function (y) { return y.id === exo.id; })[0];
      if (!e) continue;
      if (e.reglage === exo.reglage && e.series[serie] != null) return e.series[serie];
      break;
    }
    return exo.min;
  }
  function partir() {
    const exos = V.planSeance(S.profil).exos.map(function (x) {
      const c = V.CATALOGUE[x.ex.id], f = V.fourchette(x.ex), e = V.echelon(x.ex, S.profil);
      return { id: x.ex.id, nom: V.nomExercice(x.ex, S.profil), reglage: V.reglage(x.ex, S.profil), series: x.series, min: f.min, max: f.max, faites: [],
        detail: e ? c.nom + ', échelon ' + e.rang + ' sur ' + e.total : V.reglage(x.ex, S.profil),
        prio: prioritesTexte(x.groupes) };
    });
    if (!exos.length) { avis('Ton programme est vide. Active au moins un exercice dans l’onglet Survivant.', true); return; }
    S.brouillon = {
      id: nouvelId(), debut: new Date().toISOString(), date: auj(),
      lieu: V.LIEUX[S.sim.expeditions % V.LIEUX.length], exos: exos, courant: 0, reps: 0, repos: null
    };
    S.brouillon.reps = precedent(exos[0], 0);
    sauverBrouillon();
    S.confirmer = null;
    S.ecran = 'expedition';
    reveil(true);
    render();
  }
  function ecranExpedition() {
    const b = S.brouillon;
    if (!b) { S.ecran = 'accueil'; return ecranAccueil(); }
    if (b.courant >= b.exos.length) { S.ecran = 'effort'; preparerEffort(); return ecranEffort(); }
    const exo = b.exos[b.courant];
    const n = exo.faites.length;
    let lignes = '<div class="rang tete"><span>Série</span><span>Fait</span><span>Visa</span></div>';
    for (let i = 0; i < exo.series; i++) {
      const v = exo.faites[i];
      lignes += '<div class="rang"><span class="pochoir">' + (i + 1) + '</span><span>' +
        (v != null ? '<span class="manuscrit">' + v + '</span>' : (i === n ? '<span class="manuscrit graphite">en cours</span>' : '')) +
        '</span><span>' + (v != null ? tampon('VU', ROUGE, { l: 46, h: 28, taille: 13, rot: -7, classe: 'en-ligne' }) : '') + '</span></div>';
    }
    if (n >= exo.series) {
      lignes += '<div class="rang"><span class="pochoir">' + (n + 1) + '</span><span><span class="manuscrit graphite">en plus</span></span><span></span></div>';
    }
    const enRepos = b.repos && b.repos > Date.now();
    const suivant = b.exos[b.courant + 1];
    return '<main class="pile"><div class="objet isorel presse">' + PINCE +
      '<section class="papier fiche-papier">' +
        '<div class="entete"><h1 class="sous-titre">Fiche de sortie</h1><div class="centre"><p class="mention">Temps</p><p class="pochoir" data-live="chrono">' + mmss(Date.now() - Date.parse(b.debut)) + '</p></div></div>' +
        '<p class="mention mt-8">Lieu</p><p class="manuscrit ligne">' + esc(b.lieu) + '</p>' +
        '<p class="discret mt-12">Exercice ' + (b.courant + 1) + ' sur ' + b.exos.length + (exo.prio ? ', priorité ' + esc(exo.prio) : '') + '</p>' +
        '<h2 class="titre-exo">' + esc(exo.nom) + '</h2>' +
        '<p class="discret">' + esc(exo.detail || (exo.reglage !== exo.nom ? exo.reglage : '')) + '</p>' +
        '<p class="mention mt-4">Objectif : ' + exo.series + ' séries de ' + exo.min + ' à ' + exo.max + '</p>' +
        '<div class="tableau">' + lignes + '</div>' +
        (enRepos ? '<div class="repos"><p><span class="mention">Repos </span><span class="pochoir" data-live="repos">' + mmss(b.repos - Date.now()) + '</span></p><button type="button" class="lien" data-action="passer-repos">Passer le repos</button></div>' : '') +
        '<p class="mention mt-12 centre" id="l-reps">Répétitions</p>' +
        '<div class="compteur" role="group" aria-labelledby="l-reps">' +
          '<button type="button" class="rond" data-action="moins" aria-label="Une répétition de moins">−</button>' +
          '<p class="pochoir chiffre" aria-live="polite">' + b.reps + '</p>' +
          '<button type="button" class="rond" data-action="plus" aria-label="Une répétition de plus">+</button>' +
        '</div>' +
        '<button type="button" class="btn btn-principal mt-12" data-action="valider">Valider la série ' + (n + 1) + '</button>' +
        (n >= exo.series ? '<button type="button" class="btn btn-trait mt-8" data-action="passer-exo">' + (suivant ? 'Exercice suivant' : 'Finir les exercices') + '</button>' : '') +
        '<p class="discret mt-12">' + (suivant ? 'Ensuite : ' + esc(suivant.nom) : 'Dernier exercice de la sortie.') + '</p>' +
        '<div class="actions mt-4">' +
          (n < exo.series ? '<button type="button" class="lien" data-action="passer-exo">Passer cet exercice</button>' : '') +
          '<button type="button" class="lien" data-action="terminer">Terminer l’expédition</button>' +
          '<button type="button" class="lien" data-action="abandon">Abandonner</button>' +
        '</div>' +
        (S.confirmer === 'abandon' ? '<div class="confirmation" role="alert"><p class="mention">Abandonner efface cette sortie : ni XP, ni vivres.</p>' +
          '<button type="button" class="btn btn-danger" data-action="abandon-oui">Abandonner la sortie</button>' +
          '<button type="button" class="btn btn-trait" data-action="abandon-non">Continuer la sortie</button></div>' : '') +
      '</section></div></main>';
  }
  function validerSerie() {
    const b = S.brouillon;
    const exo = b.exos[b.courant];
    exo.faites.push(b.reps);
    if (exo.faites.length >= exo.series) {
      b.courant++;
      if (b.courant >= b.exos.length) { sauverBrouillon(); terminer(); return; }
      b.reps = precedent(b.exos[b.courant], 0);
    } else {
      b.reps = precedent(exo, exo.faites.length);
    }
    b.repos = Date.now() + REPOS_S * 1000;
    sauverBrouillon();
    render();
  }
  function preparerEffort() {
    if (S.form && S.form.pour === S.brouillon.id) return;
    const min = Math.max(1, Math.round((Date.now() - Date.parse(S.brouillon.debut)) / 60000));
    S.form = { pour: S.brouillon.id, minutes: Math.min(min, 300), effort: 0 };
  }
  function terminer() { S.ecran = 'effort'; preparerEffort(); S.confirmer = null; render(); }

  function grilleEffort() {
    const f = S.form;
    let h = '<p class="mention mt-16" id="l-effort">Effort ressenti, de 1 à 10</p><div class="efforts" role="group" aria-labelledby="l-effort">';
    for (let i = 1; i <= 10; i++) h += '<button type="button" data-action="effort" data-valeur="' + i + '" aria-pressed="' + (f.effort === i) + '">' + i + '</button>';
    return h + '</div><p class="manuscrit graphite mt-8">' + (f.effort ? f.effort + ' : ' + EFFORT[f.effort] : 'Choisis une note.') + '</p>';
  }
  function ecranEffort() {
    const b = S.brouillon;
    if (!b) { S.ecran = 'accueil'; return ecranAccueil(); }
    preparerEffort();
    const f = S.form;
    const series = b.exos.reduce(function (t, e) { return t + e.faites.length; }, 0);
    const exosTouches = b.exos.filter(function (e) { return e.faites.length; }).length;
    return '<main class="pile"><div class="objet isorel presse">' + PINCE + '<section class="papier fiche-papier">' +
      '<h1 class="sous-titre">Fin de sortie</h1>' +
      '<p class="discret mt-4">' + pluriel(series, 'série notée', 'séries notées') + ', ' + pluriel(exosTouches, 'exercice', 'exercices') + '.</p>' +
      '<div class="bloc mt-12"><label class="mention" for="f-duree">Durée, en minutes</label>' +
      '<input class="saisie" id="f-duree" type="number" inputmode="numeric" min="1" max="300" data-champ="minutes" data-type="nombre" value="' + esc(f.minutes) + '"></div>' +
      grilleEffort() +
      '<p class="discret mt-12">La charge d’effort vaut minutes × effort. Note honnêtement : c’est ton survivant qui mange.</p>' +
      '<button type="button" class="btn btn-principal mt-16" data-action="enregistrer"' + (f.effort ? '' : ' disabled') + '>Enregistrer l’expédition</button>' +
      (b.courant < b.exos.length ? '<div class="actions mt-4"><button type="button" class="lien" data-action="reprendre-expedition">Revenir aux exercices</button></div>' : '') +
      '</section></div></main>';
  }
  // Une séance met fin à la pause en cours ; une absence prévue plus tard reste en place
  function fermerPause(date) {
    const garder = [];
    S.profil.pauses.forEach(function (p) {
      const active = p.debut <= date && (!p.fin || p.fin >= date);
      if (!active) { garder.push(p); return; }
      const veille = V.addDays(date, -1);
      if (veille < p.debut) return; // commencée le jour même : elle n'a plus d'effet
      p.fin = veille;
      garder.push(p);
    });
    S.profil.pauses = garder;
  }
  function enregistrerExpedition() {
    const b = S.brouillon, f = S.form;
    const minutes = Math.round(+f.minutes);
    if (!(minutes >= 1 && minutes <= 300)) { avis('Indique une durée entre 1 et 300 minutes.', true); return; }
    if (!f.effort) return;
    const faits = V.faitsSeance(S.profil, S.seances, b.date, 'expedition');
    const seance = Object.assign({
      id: b.id, date: b.date, debut: b.debut, fin: new Date().toISOString(), minutes: minutes, effort: f.effort,
      genre: 'expedition', lieu: b.lieu,
      exercices: b.exos.filter(function (e) { return e.faites.length; }).map(function (e) { return { id: e.id, nom: e.nom, reglage: e.reglage, prevu: e.series, series: e.faites }; })
    }, faits);
    S.seances.push(seance);
    V.calibrer(S.profil, seance);
    fermerPause(b.date);
    S.brouillon = null;
    stockageLocal(CLE_BROUILLON, null);
    reveil(false);
    S.form = {};
    recalculer();
    persister(seance);
    S.bilanId = seance.id;
    S.ecran = 'bilan';
    render();
  }

  // ---------- Activité libre
  function ecranLibre() {
    const f = S.form;
    return '<main class="pile"><section class="objet papier feuille">' + TROMBONE +
      '<h1 class="sous-titre">Activité libre</h1>' +
      '<p class="discret mt-4">Marche, vélo, sport en club : tout effort compte. Une seule séance par jour rapporte des vivres.</p>' +
      '<div class="bloc mt-12"><label class="mention" for="f-quoi">Activité</label><input class="saisie" id="f-quoi" data-champ="quoi" maxlength="40" autocomplete="off" value="' + esc(f.quoi) + '" placeholder="Marche"></div>' +
      '<div class="bloc mt-12"><label class="mention" for="f-duree-libre">Durée, en minutes</label><input class="saisie" id="f-duree-libre" type="number" inputmode="numeric" min="5" max="300" data-champ="minutes" data-type="nombre" value="' + esc(f.minutes) + '"></div>' +
      grilleEffort() +
      '<button type="button" class="btn btn-principal mt-16" data-action="enregistrer-libre"' + (f.effort ? '' : ' disabled') + '>Enregistrer l’activité</button>' +
      '<div class="actions mt-4"><button type="button" class="lien" data-action="aller" data-ecran="accueil">Annuler</button></div>' +
      '</section></main>';
  }
  function enregistrerLibre() {
    const f = S.form;
    const minutes = Math.round(+f.minutes);
    if (!(minutes >= 5 && minutes <= 300)) { avis('Indique une durée entre 5 et 300 minutes.', true); return; }
    if (!f.effort) return;
    const date = auj();
    const faits = V.faitsSeance(S.profil, S.seances, date, 'libre');
    const seance = Object.assign({ id: nouvelId(), date: date, debut: new Date().toISOString(), minutes: minutes, effort: f.effort,
      genre: 'libre', lieu: (f.quoi || '').trim() || 'Activité libre', exercices: [] }, faits);
    S.seances.push(seance);
    fermerPause(date);
    S.form = {};
    recalculer();
    persister(seance);
    S.bilanId = seance.id;
    S.ecran = 'bilan';
    render();
  }

  // ---------- Bilan : bon de pesée
  function ecranBilan() {
    const s = S.seances.filter(function (x) { return x.id === S.bilanId; })[0];
    const r = s && S.sim.resultats[s.id];
    if (!s || !r) { S.ecran = 'accueil'; return ecranAccueil(); }
    let pesee = '<dt>Brut, minutes × effort</dt><dd>' + r.minutesComptees + ' × ' + s.effort + ' = ' + r.charge + '</dd>';
    if (r.minutesComptees < s.minutes) pesee += '<dt>Plafond du jour</dt><dd>90 min</dd>';
    if (r.prevue) pesee += '<dt>Majoration, sortie prévue</dt><dd>+20 %</dd>';
    if (r.deuxieme) pesee += '<dt>Deuxième séance du jour</dt><dd>÷ 2</dd>';
    if (r.convalescence) pesee += '<dt>Convalescence</dt><dd>÷ 2</dd>';
    if (r.bonusSemaine) pesee += '<dt>Semaine tenue</dt><dd>+' + r.bonusSemaine + '</dd>';
    pesee += '<dt class="net">Net</dt><dd class="net">' + (r.xp + r.bonusSemaine) + ' XP</dd>';
    const butin = r.butin.map(function (b) {
      if (b.genre === 'relique') return '<p class="manuscrit">1 ' + esc(b.nom.charAt(0).toLowerCase() + b.nom.slice(1)) + ', relique rare</p><p class="manuscrit graphite">' + esc(b.histoire) + '</p>';
      if (b.genre === 'conserve') return '<p class="manuscrit">1 conserve de haricots, une ration de plus</p>';
      return '<p class="manuscrit">1 ' + esc(b.nom.charAt(0).toLowerCase() + b.nom.slice(1)) + ', ' + esc(b.rarete) + '</p>';
    }).join('');
    const niveau = r.niveauApres > r.niveauAvant
      ? '<div class="xp mt-12">' + tampon('NIVEAU ' + r.niveauApres, BLEU, { l: 130, h: 50, forme: 'ovale', rot: 5, classe: 'en-ligne' }) + '<p class="mention">Ton survivant passe au niveau ' + r.niveauApres + '.</p></div>'
      : '';
    const rations = r.rationsDues
      ? r.rationsDues + ' ticket' + (r.rationsDues > 1 ? 's' : '') + (r.stockApres >= V.STOCK_MAX ? ', stock plein' : ', stock à ' + r.stockApres) + ' sur 7'
      : 'Aucun : une seule séance par jour rapporte des vivres';
    return '<main class="pile"><section class="objet papier bon feuille inclinee-g" aria-label="Bon de pesée">' +
      '<div class="entete"><p class="mention">Sucrerie de Valgrise</p><p class="pochoir">N° ' + String(S.seances.indexOf(s) + 1).padStart(4, '0') + '</p></div>' +
      '<h1 class="titre-imprime">Bon de pesée</h1><div class="filet"></div>' +
      tampon('ACCOMPLIE', ROUGE, { l: 164, h: 58, taille: 23, rot: -10, classe: 'pose-haut' }) +
      '<p class="mention mt-8">Provenance</p><p class="manuscrit ligne">' + esc(s.lieu) + '</p>' +
      '<p class="mention mt-4">Date et durée</p><p class="manuscrit ligne">' + esc(majuscule(dateLongue(s.date))) + ', ' + s.minutes + ' min</p>' +
      '<dl class="pesee">' + pesee + '</dl>' + niveau +
      '<p class="mention mt-12">Tickets délivrés</p><p class="manuscrit">' + esc(rations) + '</p>' +
      '<p class="mention mt-12">Inventaire de fouille</p><div class="butin">' + butin + '</div>' +
      (V.calibragesEnAttente(S.profil).some(function (x) { return x.seance === s.id; })
        ? '<p class="manuscrit graphite mt-12">Le coach a revu tes fourchettes d’après cette sortie : ses propositions t’attendent sur la carte.</p>' : '') +
      '</section>' +
      '<button type="button" class="btn btn-principal" data-action="aller" data-ecran="accueil">Retour à la carte</button></main>';
  }

  // ---------- Survivant : fiche, pauses, plan, programme, sauvegarde
  function ecranSurvivant() {
    const sim = S.sim, p = S.profil, sv = survivant();
    const ironman = sv.mode === 'ironman' && !sv.renonce;
    const fiche = '<section class="objet kraft carte" aria-label="Fiche du survivant">' + enteteCarte(ironman ? 'Ironman' : 'Survie') +
      '<h1 class="titre-imprime">' + esc(sv.nom) + '</h1><div class="filet"></div>' +
      '<dl class="champs">' +
        '<dt>Niveau</dt><dd>' + sim.niveau + ', ' + sim.xpDansNiveau + ' sur ' + sim.xpBesoin + '</dd>' +
        '<dt>XP totale</dt><dd>' + sim.xp + '</dd>' +
        '<dt>Expéditions</dt><dd>' + sim.expeditions + '</dd>' +
        '<dt>Cicatrices</dt><dd>' + sim.cicatrices + '</dd>' +
        (sim.convalescence ? '<dt>Convalescence</dt><dd>' + pluriel(sim.convalescence, 'expédition', 'expéditions') + '</dd>' : '') +
        '<dt>Rang</dt><dd>À évaluer</dd>' +
      '</dl>' +
      (sim.chutes.length ? '<p class="mention mt-12">Chutes</p><p class="manuscrit graphite">' + sim.chutes.map(dateCourte).join(', ') + '</p>' : '') +
      (p.morts.length ? '<p class="mention mt-12">Mémorial</p>' + p.morts.map(function (m) {
        return '<p class="manuscrit graphite">' + esc(m.nom) + ', tombé le ' + dateCourte(m.date) + ' au niveau ' + m.niveau + '</p>';
      }).join('') : '') +
      '<p class="petit mt-12">Le rang se gagne à l’Évaluation, prévue dans la version 1.</p></section>';
    return '<main class="pile">' + fiche + sectionBilan() + sectionPhotos() + sectionDossier() + sectionPesee() + sectionPause() + sectionPlan() + sectionPriorites() + sectionProgramme() + sectionElastiques() + sectionMode() + sectionSauvegarde() + '</main>';
  }

  function pauseActiveOuPrevue() {
    const a = S.jour;
    return S.profil.pauses.filter(function (p) { return !p.fin || p.fin >= a; })[0] || null;
  }
  function sectionPause() {
    const p = pauseActiveOuPrevue();
    let corps;
    if (p) {
      const texte = p.genre === 'absence'
        ? (p.debut > S.jour ? 'Absence prévue du ' : 'En convoi du ') + dateCourte(p.debut) + ' au ' + dateCourte(p.fin) + '.'
        : 'Malade ou blessé depuis le ' + dateCourte(p.debut) + ' (' + pluriel(V.daysBetween(p.debut, S.jour) + 1, 'jour', 'jours') + ').';
      corps = '<p class="manuscrit mt-8">' + esc(texte) + '</p>' +
        (p.genre === 'malade' && V.daysBetween(p.debut, S.jour) >= 14 ? '<p class="discret mt-4">Plus de 14 jours : prends soin de toi, la pause reste active tant que tu en as besoin.</p>' : '') +
        '<button type="button" class="btn btn-trait mt-12" data-action="reprendre-pause">' + (p.debut > S.jour ? 'Annuler l’absence' : 'Je reprends') + '</button>';
    } else {
      let options = '';
      for (let k = 0; k <= V.RETRO_MAX; k++) {
        const d = V.addDays(S.jour, -k);
        options += '<option value="' + k + '"' + (+(S.form.recul || 0) === k ? ' selected' : '') + '>' + (k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : majuscule(dateLongue(d))) + '</option>';
      }
      const debutAbs = S.form.absDebut || S.jour;
      const finAbs = S.form.absFin || V.addDays(debutAbs, 6);
      corps = '<div class="bloc mt-8"><label class="mention" for="f-recul">Malade ou blessé depuis</label><select class="saisie" id="f-recul" data-champ="recul" data-type="nombre">' + options + '</select></div>' +
        '<button type="button" class="btn btn-trait mt-8" data-action="malade">Me déclarer malade ou blessé</button>' +
        '<div class="bloc mt-16"><label class="mention" for="f-absdebut">Absence annoncée, du</label><input class="saisie" id="f-absdebut" type="date" data-champ="absDebut" min="' + S.jour + '" value="' + esc(debutAbs) + '"></div>' +
        '<div class="bloc mt-4"><label class="mention" for="f-absfin">au (21 jours au plus)</label><input class="saisie" id="f-absfin" type="date" data-champ="absFin" min="' + esc(debutAbs) + '" max="' + V.addDays(debutAbs, V.ABSENCE_MAX - 1) + '" value="' + esc(finAbs) + '"></div>' +
        '<button type="button" class="btn btn-trait mt-8" data-action="absence">Annoncer l’absence</button>';
    }
    return '<section class="objet papier feuille" aria-label="Pause">' + TROMBONE +
      '<h2 class="sous-titre">Pause</h2>' +
      '<p class="discret mt-4">Pendant une pause, ton survivant ne touche pas à ses vivres. Le jeu te fait confiance : déclarer une maladie que tu n’as pas eue, c’est tricher contre toi-même.</p>' +
      corps + '</section>';
  }
  function sectionPlan() {
    const p = S.profil;
    return '<section class="objet papier feuille inclinee-g" aria-label="Mon plan"><h2 class="sous-titre">Mon plan</h2>' +
      '<p class="mention mt-8">Jours d’expédition</p>' + choixJours(p.plan.jours, 'plan-jour') +
      '<div class="bloc mt-12"><label class="mention" for="f-plan-minutes">Durée visée, en minutes</label>' +
      '<input class="saisie" id="f-plan-minutes" type="number" inputmode="numeric" min="15" max="120" data-plan="minutes" value="' + p.plan.minutes + '"></div></section>';
  }
  function reglageProgramme(ex) {
    const c = V.CATALOGUE[ex.id], p = S.profil;
    const hid = 'f-prog-' + ex.id, rid = 'f-reps-' + ex.id;
    const options = optionsReglage(ex.id, p);
    const ctrl = options.length ? selectReglage('id="' + hid + '" data-prog="' + ex.id + '"', options, valeurReglage(ex)) :
      '<input class="saisie" id="' + hid + '" type="number" inputmode="decimal" min="1" max="60" step="0.5" data-prog="' + ex.id + '" value="' + ex.charge + '">';
    const titre = c.type === 'charge' ? (c.unHaltere ? 'Charge d’un seul haltère, en kg' : 'Charge par haltère, en kg') : 'Réglage';
    const f = V.fourchette(ex), coach = V.fourchetteCoach(ex);
    const reps = '<select class="saisie" id="' + rid + '" data-reps="' + ex.id + '">' + V.fourchettesProposees(ex).map(function (r) {
      const conseil = r[0] === coach.min && r[1] === coach.max;
      return '<option value="' + r[0] + '-' + r[1] + '"' + (r[0] === f.min && r[1] === f.max ? ' selected' : '') + '>' + r[0] + ' à ' + r[1] + (conseil ? ', conseil du coach' : '') + '</option>';
    }).join('') + '</select>';
    return '<div class="exo-reglage">' +
      '<label class="case-a-cocher" for="f-actif-' + ex.id + '"><input type="checkbox" id="f-actif-' + ex.id + '" data-prog-actif="' + ex.id + '"' + (ex.actif ? ' checked' : '') + '><span>' + esc(c.nom) + ' (' + esc(groupesDe(c)) + ')</span></label>' +
      (ex.actif ? '<label class="mention" for="' + hid + '">' + titre + '</label>' + ctrl +
        '<label class="mention mt-8" for="' + rid + '">Répétitions par série</label>' + reps :
        (c.recommande ? '<p class="discret">' + esc(c.recommande) + '</p>' : '')) +
      '</div>';
  }
  function sectionPriorites() {
    const p = S.profil, l = p.priorites || [];
    const plan = V.planSeance(p);
    return '<section class="objet papier feuille" id="priorites" aria-label="Mes priorités"><h2 class="sous-titre">Mes priorités</h2>' +
      '<p class="discret mt-4">Jusqu’à deux groupes musculaires. Leurs exercices passent en tête de séance, à 4 séries. Pour tenir dans ta durée, le reste descend d’abord à 2 séries, puis tes priorités à 3.</p>' +
      choixGroupes(l, 'prio') +
      '<p class="manuscrit graphite mt-8">Séance estimée : environ ' + plan.minutes + ' min, pour ' + p.plan.minutes + ' visées.</p>' +
      '</section>';
  }
  function sectionProgramme() {
    const tries = S.profil.programme.slice().sort(function (a, b) { return V.ORDRE.indexOf(a.id) - V.ORDRE.indexOf(b.id); });
    return '<section class="objet papier feuille inclinee-g" id="programme" aria-label="Mon programme"><h2 class="sous-titre">Mon programme</h2>' +
      '<p class="discret mt-4">Le nombre de séries suit tes priorités et ta durée. Choisis un réglage et des répétitions que tu tiens proprement : le coach propose l’échelon suivant quand tu atteins le haut de ta fourchette deux séances de suite.</p>' +
      tries.map(reglageProgramme).join('') + '</section>';
  }
  function sectionElastiques() {
    const p = S.profil;
    const l = V.elastiquesDe(p).slice().sort(function (a, b) { return a - b; });
    return '<section class="objet papier feuille" id="elastiques" aria-label="Mes élastiques"><h2 class="sous-titre">Mes élastiques</h2>' +
      '<p class="discret mt-4">Le coach en combine jusqu’à ' + (['un', 'deux', 'trois', 'quatre'][V.COMBINAISON_MAX - 1] || V.COMBINAISON_MAX) + '. Ajoute ceux que tu achètes : les réglages et l’échelle du squat suivent.</p>' +
      '<ul class="liste-elastiques">' + l.map(function (kg) {
        const t = V.kgTexte(kg) + ' kg';
        return '<li><span class="manuscrit">' + esc(t) + '</span>' +
          (l.length > 1 ? '<button type="button" class="lien" data-action="retirer-elastique" data-kg="' + kg + '" aria-label="Retirer l’élastique de ' + esc(t) + '">Retirer</button>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<div class="pesee-ligne"><label class="mention" for="f-elastique">Ajouter un élastique, en kg</label>' +
      '<input class="saisie" id="f-elastique" data-champ="elastique" type="text" inputmode="decimal" autocomplete="off" value="' + esc(S.form.elastique || '') + '">' +
      '<button type="button" class="btn btn-trait" data-action="ajouter-elastique">Ajouter</button></div>' +
      '<p class="manuscrit graphite mt-8">Résistances possibles : ' + V.resistances(p).map(V.kgTexte).join(', ') + ' kg.</p>' +
      '</section>';
  }
  function sectionMode() {
    const sv = survivant();
    if (sv.mode !== 'ironman' || sv.renonce) return '';
    return '<section class="objet papier feuille inclinee-g" aria-label="Mode Ironman"><h2 class="sous-titre">Mode Ironman</h2>' +
      '<p class="discret mt-4">Tu peux renoncer à tout moment : ' + esc(sv.nom) + ' continue en mode Survie, sans la marque Sans filet. Ce choix est définitif.</p>' +
      (S.confirmer === 'renoncer'
        ? '<div class="confirmation" role="alert"><button type="button" class="btn btn-danger" data-action="renoncer-oui">Renoncer à l’Ironman</button><button type="button" class="btn btn-trait" data-action="annuler-confirmation">Garder l’Ironman</button></div>'
        : '<button type="button" class="btn btn-trait mt-12" data-action="renoncer">Renoncer à l’Ironman</button>') +
      '</section>';
  }
  function sectionSauvegarde() {
    const enLigne = S.stockage === 'compte';
    const boutonCopie = S.copiePrete
      ? '<button type="button" class="btn btn-principal mt-12" data-action="exporter-copie">Enregistrer la copie (' + poidsTexte(S.copiePrete.size) + ')</button>'
      : '<button type="button" class="btn btn-trait mt-12" data-action="exporter">Télécharger une copie</button>';
    return '<section class="objet papier feuille" id="sauvegarde" aria-label="Sauvegarde"><h2 class="sous-titre">Sauvegarde</h2>' +
      '<p class="discret mt-4">' + (enLigne
        ? 'Ta partie est enregistrée sur ton compte Claude, et une copie reste sur ce téléphone.'
        : 'Ta partie est enregistrée sur ce téléphone seulement : si tu supprimes l’appli, elle part avec. Fais une copie de temps en temps.') + '</p>' +
      boutonCopie +
      (dansClaude() ? '' : '<p class="aide">La copie contient tout, photos comprises. Sur iPhone, choisis « Enregistrer dans Fichiers ».</p>') +
      blocRestaurer(false) +
      '</section>';
  }
  // Restaurer une copie : depuis l'onglet Survivant, ou dès l'inscription sur un nouvel appareil
  function blocRestaurer(enLien) {
    if (S.restauration) return '<p class="manuscrit graphite mt-12" role="status">Restauration en cours…</p>';
    const existe = !!S.profil, c = S.confirmer && S.confirmer.type === 'restaurer' ? S.confirmer.donnees : null;
    let html = enLien
      ? '<label class="lien" for="f-restaurer">Déjà une partie ? Restaurer une copie</label>'
      : '<label class="btn btn-trait mt-12" for="f-restaurer">Restaurer une copie</label>';
    html += '<input class="cache-fichier" id="f-restaurer" type="file" accept="application/json,.json">';
    if (c) {
      const n = Object.keys(photosDeCopie(c)).length;
      const contenu = pluriel(c.seances.length, 'séance', 'séances') + (n ? ', ' + pluriel(n, 'photo', 'photos') : '');
      html += '<div class="confirmation" role="alert"><p class="mention">' + (existe ? 'Cette copie remplace toute ta partie actuelle : ' : 'Cette copie devient ta partie : ') + contenu + '.</p>' +
        (existe
          ? '<button type="button" class="btn btn-danger" data-action="restaurer-oui">Remplacer ma partie</button><button type="button" class="btn btn-trait" data-action="annuler-confirmation">Garder ma partie</button>'
          : '<button type="button" class="btn btn-principal" data-action="restaurer-oui">Reprendre cette partie</button><button type="button" class="btn btn-trait" data-action="annuler-confirmation">Annuler</button>') +
        '</div>';
    }
    return html;
  }

  // ---------- Carnet : historique et objets
  function ecranCarnet() {
    const triees = S.seances.slice().sort(function (a, b) { return a.debut < b.debut ? 1 : -1; });
    const lignes = triees.map(function (s) {
      const r = S.sim.resultats[s.id];
      return '<button type="button" class="rang-carnet" data-action="voir" data-id="' + esc(s.id) + '">' +
        '<span class="pochoir">' + dateCourte(s.date) + '</span><span class="manuscrit">' + esc(s.lieu) + '</span>' +
        '<span class="mention">' + (r ? '+' + (r.xp + r.bonusSemaine) + ' XP' : '') + '</span></button>';
    }).join('');
    const inv = S.sim.inventaire;
    const reliques = inv.filter(function (o) { return o.genre === 'relique'; });
    const tenues = inv.filter(function (o) { return o.genre === 'tenue'; });
    return '<main class="pile">' +
      '<section class="objet papier feuille" aria-label="Carnet de sorties">' + TROMBONE + '<h1 class="sous-titre">Carnet de sorties</h1>' +
      (lignes ? '<div class="registre">' + lignes + '</div>' : '<p class="discret vide">Aucune sortie pour l’instant. Ta première expédition s’inscrira ici.</p>') +
      '</section>' +
      '<section class="objet kraft carte" aria-label="Objets trouvés"><h2 class="sous-titre">Objets trouvés</h2>' +
      (reliques.length ? '<p class="mention mt-8">Reliques</p>' + reliques.map(function (o) {
        return '<div class="relique"><p class="manuscrit">' + esc(o.nom) + '</p><p class="manuscrit graphite">' + esc(o.histoire) + '</p></div>';
      }).join('') : '') +
      (tenues.length ? '<p class="mention mt-12">Tenues</p><p class="manuscrit">' + tenues.map(function (o) { return esc(o.nom); }).join(', ') + '</p>' : '') +
      (!inv.length ? '<p class="discret vide">Rien pour l’instant. Chaque expédition fouille un endroit de la vallée.</p>' : '') +
      '</section></main>';
  }

  // ---------- Mort en Ironman
  function ecranMort() {
    const m = S.profil.morts[S.profil.morts.length - 1];
    const f = S.form;
    if (!f.mode) f.mode = 'ironman';
    return '<main class="pile"><section class="objet papier bon" aria-label="Registre du Comité">' +
      tampon('MORT', ROUGE, { l: 110, h: 54, taille: 24, rot: -12, classe: 'pose-haut' }) +
      '<p class="mention">Comité de la Sucrerie, registre</p><h1 class="titre-imprime">' + esc(m.nom) + '</h1><div class="filet"></div>' +
      '<p class="manuscrit mt-12">Tombé le ' + esc(dateLongue(m.date)) + ', au niveau ' + m.niveau + ', après ' + pluriel(m.jours, 'jour', 'jours') + ' de survie.</p>' +
      '<p class="discret mt-8">Son nom entre au Mémorial. Ton historique reste, et le suivant trouvera son carnet à la Sucrerie.</p>' +
      '<div class="bloc mt-16"><label class="mention" for="f-nouveau">Nom du nouveau survivant</label><input class="saisie" id="f-nouveau" data-champ="nom" maxlength="24" autocomplete="off" value="' + esc(f.nom) + '"></div>' +
      '<div class="choix" role="group" aria-label="Difficulté">' +
        optionMode('ironman', 'Ironman, sans filet', 'La même règle : une chute, et c’est fini.') +
        optionMode('survie', 'Survie', 'Une chute laisse une cicatrice et deux expéditions de convalescence.') +
      '</div>' +
      '<button type="button" class="btn btn-principal mt-16" data-action="nouveau-survivant">Envoyer un nouveau survivant</button>' +
      '</section></main>';
  }

  // ---------- Avis éphémère
  let minuteurAvis = null;
  function avis(texte, alerte) {
    avisEl.innerHTML = '<p class="toast' + (alerte ? ' alerte' : '') + '">' + esc(texte) + '</p>';
    clearTimeout(minuteurAvis);
    minuteurAvis = setTimeout(function () { avisEl.innerHTML = ''; }, alerte ? 6500 : 3500);
  }

  // ---------- Écran allumé pendant l'expédition
  let verrou = null;
  async function reveil(oui) {
    try {
      if (oui && 'wakeLock' in navigator && !verrou) {
        verrou = await navigator.wakeLock.request('screen');
        verrou.addEventListener('release', function () { verrou = null; });
      } else if (!oui && verrou) { await verrou.release(); verrou = null; }
    } catch (e) { verrou = null; }
  }

  // ---------- Horloge
  function tic() {
    const b = S.brouillon;
    if (!b) return;
    const chrono = app.querySelector('[data-live="chrono"]');
    if (chrono) chrono.textContent = mmss(Date.now() - Date.parse(b.debut));
    const repos = app.querySelector('[data-live="repos"]');
    if (repos && b.repos) {
      const reste = b.repos - Date.now();
      if (reste <= 0) { b.repos = null; sauverBrouillon(); render(); }
      else repos.textContent = mmss(reste);
    }
  }
  setInterval(tic, 1000);
  // Version installée sur l'écran d'accueil : une mise à jour vient d'arriver (voir src/site/pied.html)
  window.addEventListener('valgrise:maj', function () { S.majDispo = true; render(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (S.profil && S.jour !== auj()) { recalculer(); render(); }
    if (S.brouillon && (S.ecran === 'expedition' || S.ecran === 'effort')) reveil(true);
  });

  // ---------- Sauvegarde : export et restauration. La copie (format 2) contient aussi les photos.
  function dansClaude() { return !!(window.claude && typeof window.claude.use === 'function'); }
  function nomCopie() { return 'valgrise-copie-' + S.jour + '.json'; }
  function poidsTexte(octets) {
    return octets < 1000000 ? Math.max(1, Math.round(octets / 1000)) + ' Ko' : (Math.round(octets / 100000) / 10).toString().replace('.', ',') + ' Mo';
  }
  async function texteCopie() {
    const photos = {}, liste = S.profil.photos || [];
    for (let i = 0; i < liste.length; i++) {
      const d = await Photos.lire(liste[i].id);
      if (d) photos[liste[i].id] = d;
    }
    return JSON.stringify({ app: 'valgrise', v: 2, exporte: new Date().toISOString(), profil: S.profil, seances: S.seances, photos: photos }, null, 2);
  }
  // Sur téléphone, la feuille de partage permet « Enregistrer dans Fichiers » ; ailleurs, un téléchargement classique.
  function partagePossible(fichier) {
    try {
      return !!(navigator.share && navigator.canShare && window.matchMedia && window.matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [fichier] }));
    } catch (e) { return false; }
  }
  function telecharger(fichier) {
    const url = URL.createObjectURL(fichier), a = document.createElement('a');
    a.href = url; a.download = fichier.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    avis('Copie téléchargée.');
  }
  function partager(fichier) {
    return navigator.share({ files: [fichier] }).then(function () { avis('Copie exportée.'); });
  }
  async function exporter() {
    if (S.exportEnCours) return;
    S.exportEnCours = true;
    try {
      if (dansClaude()) {
        const dl = await window.claude.use('downloads').catch(function () { return null; });
        if (!dl) { avis('Le téléchargement n’est pas disponible dans cette vue.', true); return; }
        const texte = await texteCopie();
        try { await dl.save({ filename: nomCopie(), data: new Blob([texte], { type: 'application/json' }) }); avis('Copie téléchargée.'); }
        catch (e) { if (!e || e.code !== 'declined') avis('Téléchargement impossible pour l’instant. Réessaie dans un moment.', true); }
        return;
      }
      const fichier = new File([await texteCopie()], nomCopie(), { type: 'application/json' });
      if (!partagePossible(fichier)) { telecharger(fichier); return; }
      try { await partager(fichier); }
      catch (e) {
        if (e && e.name === 'AbortError') return;
        // Le téléphone a jugé le geste trop ancien (photos longues à lire) : la copie est prête, un second appui suffit.
        if (e && e.name === 'NotAllowedError') { S.copiePrete = fichier; render(); return; }
        telecharger(fichier);
      }
    } catch (e) {
      avis('La copie n’a pas pu être préparée. Réessaie.', true);
    } finally { S.exportEnCours = false; }
  }
  function exporterCopiePrete() {
    const fichier = S.copiePrete;
    S.copiePrete = null; render();
    if (!fichier) return;
    partager(fichier).catch(function (e) { if (!e || e.name !== 'AbortError') telecharger(fichier); });
  }
  function lireCopie(fichier) {
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        const d = JSON.parse(lecteur.result);
        if (!d || d.app !== 'valgrise' || !d.profil || !Array.isArray(d.seances)) throw new Error('format');
        S.confirmer = { type: 'restaurer', donnees: d };
        render();
      } catch (e) { avis('Ce fichier n’est pas une copie de Valgrise.', true); }
    };
    lecteur.onerror = function () { avis('Ce fichier est illisible.', true); };
    lecteur.readAsText(fichier);
  }
  // Les photos d'une copie : seulement des images encodées, de la taille que l'appli produit elle-même
  function photosDeCopie(d) {
    const brut = d && d.photos && typeof d.photos === 'object' ? d.photos : {}, ok = {};
    Object.keys(brut).forEach(function (id) {
      const v = brut[id];
      if (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= PHOTO_MAX) ok[id] = v;
    });
    return ok;
  }
  async function restaurer() {
    const d = S.confirmer && S.confirmer.donnees;
    if (!d || S.restauration) return;
    S.confirmer = null; S.restauration = true; render();
    try { await remplacerPartie(d); }
    catch (e) { S.restauration = false; render(); avis('Cette copie n’a pas pu être restaurée. Ta partie n’a pas changé.', true); }
  }
  async function remplacerPartie(d) {
    const photos = photosDeCopie(d), profil = migrerProfil(clone(d.profil)), seances = clone(d.seances);
    migre = false;
    V.simuler(profil, seances, auj());   // une copie abîmée s'arrête ici, avant de toucher à quoi que ce soit
    // Les photos d'abord : la fiche ne doit jamais pointer vers une image absente.
    const gardees = [];
    let manquantes = 0, echec = false;
    const index = profil.photos || [];
    for (let i = 0; i < index.length; i++) {
      const ph = index[i];
      if (photos[ph.id]) {
        try { await Photos.enregistrer(ph.id, photos[ph.id]); gardees.push(ph); } catch (e) { echec = true; delete Photos.cache[ph.id]; }
      } else if (await Photos.lire(ph.id)) gardees.push(ph);   // déjà sur cet appareil
      else manquantes++;
    }
    profil.photos = gardees;
    // Ménage : la partie remplacée emporte ses photos.
    try {
      const garder = {};
      gardees.forEach(function (ph) { garder[ph.id] = true; });
      const ids = await Photos.ids();
      for (let i = 0; i < ids.length; i++) if (!garder[ids[i]]) await Photos.supprimer(ids[i]);
    } catch (e) { /* le ménage attendra la prochaine restauration */ }
    S.profil = profil;
    S.seances = seances;
    S.profil.maj = new Date().toISOString();
    stockageLocal(CLE_LOCAL, { profil: S.profil, seances: S.seances });
    recalculer();
    S.restauration = false; S.ecran = 'accueil'; S.form = {};
    render();
    let enLigne = true;
    if (Store.db) { try { await Store.remplacer(S.profil, S.seances); } catch (e) { enLigne = false; } }
    const message = 'Partie restaurée' + (gardees.length ? ', avec ' + pluriel(gardees.length, 'photo', 'photos') : '') + '.';
    if (!enLigne) avis('Partie restaurée sur ce téléphone. La sauvegarde en ligne n’a pas suivi.', true);
    else if (echec) avis(message + ' Des photos n’ont pas pu être rangées.', true);
    else if (manquantes) avis(message + ' ' + pluriel(manquantes, 'photo n’était', 'photos n’étaient') + ' pas dans la copie.', true);
    else avis(message);
  }

  // ---------- Actions
  const ACTIONS = {
    aller: function (el) { S.ecran = el.dataset.ecran; S.confirmer = null; S.copiePrete = null; S.renommer = false; S.form = {}; render(); },
    renommer: function () {
      S.renommer = true; S.form.nouveauNom = survivant().nom; render();
      const champ = document.getElementById('f-renommer');
      if (champ) { champ.focus(); try { champ.select(); } catch (e) { /* facultatif */ } }
    },
    'renommer-ok': validerNom,
    'renommer-annuler': function () { S.renommer = false; delete S.form.nouveauNom; render(); },
    'choisir-priorites': function () { S.ecran = 'survivant'; S.confirmer = null; S.form = {}; S.ancre = 'priorites'; render(); },
    duree: function (el) {
      S.profil.plan.minutes = +el.dataset.minutes;
      S.profil.annonces = (S.profil.annonces || []).filter(function (a) { return a !== 'jambes'; });
      recalculer(); persister(); render();
      avis('Séance réglée sur ' + S.profil.plan.minutes + ' minutes.');
    },
    visite: function () {
      const m = (S.profil.mesures || []).filter(function (x) { return x.date === S.jour; })[0];
      S.form = { photos: {}, retirees: {} };
      if (m) ['bras', 'taille', 'hanches', 'graisse'].forEach(function (k) { if (typeof m[k] === 'number') S.form[k] = nombreFr(m[k]); });
      if (m && typeof m.poids === 'number') S.form.poidsVisite = nombreFr(m.poids);
      S.confirmer = null; S.ecran = 'visite'; render();
    },
    sexe: function (el) { S.form.sexe = el.dataset.valeur; render(); },
    'modifier-admission': function () {
      const p = S.profil;
      S.form = { admission: true, hauteur: String(p.hauteur || ''), naissance: String(p.naissance || ''), sexe: p.sexe };
      S.ancre = 'bilan'; render();
    },
    admission: function () {
      const a = lireAdmission(S.form);
      if (!a) { S.form.erreur = 'Remplis ta taille, ton année de naissance et tes repères.'; render(); return; }
      if (a.erreur) { S.form.erreur = a.erreur; render(); return; }
      Object.assign(S.profil, a);
      S.form = {};
      recalculer(); persister();
      S.ancre = 'bilan'; render();
      avis('Fiche d’admission enregistrée.');
    },
    'voir-bilan': function () {
      S.profil.annonces = (S.profil.annonces || []).filter(function (a) { return a !== 'bilan'; });
      persister();
      S.ecran = 'survivant'; S.confirmer = null; S.form = {}; S.ancre = 'bilan'; render();
    },
    'visite-plus-tard': function () { S.profil.visiteReportee = S.jour; persister(); render(); },
    tuto: function () { S.retourTuto = S.ecran; S.ecran = 'tuto'; render(); },
    'retour-tuto': function () {
      S.ecran = S.retourTuto === 'visite' ? 'visite' : 'survivant';
      if (S.ecran === 'survivant') S.ancre = 'dossier';
      render();
    },
    'noter-pesee': function () {
      const brut = String(S.form.kg || '').trim().replace(',', '.');
      const v = Math.round(parseFloat(brut) * 10) / 10;
      if (!/^\d+(\.\d+)?$/.test(brut) || !(v >= V.POIDS_MIN && v <= V.POIDS_MAX)) {
        avis('Indique ton poids en kilos, par exemple 78,4.', true); return;
      }
      S.profil.pesees = (S.profil.pesees || []).filter(function (x) { return x.date !== S.jour; }).concat([{ date: S.jour, kg: v }]);
      S.form = {};
      recalculer(); persister(); render();
      const t = V.tendancePoids(S.profil, S.jour);
      if (t && t.rapide) avis('Pesée notée. Ida s’inquiète : tu perds plus de 1 % de ton poids par semaine.', true);
      else avis('Pesée notée : ' + nombreFr(v) + ' kg.');
    },
    'pesee-plus-tard': function () { S.profil.peseeReportee = S.jour; persister(); render(); },
    rappel: function (el) {
      S.profil.rappelPesee = el.dataset.valeur;
      persister(); render();
      avis({ matin: 'Rappel de pesée chaque matin.', lundi: 'Rappel de pesée le lundi matin.', jamais: 'Plus de rappel de pesée.' }[el.dataset.valeur]);
    },
    'signer-visite': function () {
      const f = S.form, mesure = { id: nouvelId(), date: S.jour };
      let notees = 0;
      for (let i = 0; i < V.MESURES.length; i++) {
        const def = V.MESURES[i];
        const brut = String(f[def.cle] || '').trim().replace(',', '.');
        if (!brut) { mesure[def.cle] = null; continue; }
        const v = Math.round(parseFloat(brut) * 10) / 10;
        if (!/^\d+(\.\d+)?$/.test(brut) || !(v >= def.min && v <= def.max)) {
          f.erreur = def.nom + ' : indique une valeur entre ' + def.min + ' et ' + def.max + ' cm.';
          render(); return;
        }
        mesure[def.cle] = v; notees++;
      }
      if (!notees) { f.erreur = 'Note au moins une mesure.'; render(); return; }
      const admission = V.admissionComplete(S.profil) ? null : lireAdmission(f);
      if (admission && admission.erreur) { f.erreur = admission.erreur; render(); return; }
      const bg = String(f.graisse || '').trim().replace(',', '.');
      if (bg) {
        const g = Math.round(parseFloat(bg) * 10) / 10;
        if (!/^\d+(\.\d+)?$/.test(bg) || !(g >= V.GRAISSE_MIN && g <= V.GRAISSE_MAX)) { f.erreur = 'Masse grasse : indique un pourcentage entre ' + V.GRAISSE_MIN + ' et ' + V.GRAISSE_MAX + '.'; render(); return; }
        mesure.graisse = g;
      }
      const bp = String(f.poidsVisite || '').trim().replace(',', '.');
      if (bp && !V.moyennePoids(S.profil, S.jour)) {
        const kg = Math.round(parseFloat(bp) * 10) / 10;
        if (!/^\d+(\.\d+)?$/.test(bp) || !(kg >= V.POIDS_MIN && kg <= V.POIDS_MAX)) { f.erreur = 'Poids : indique ton poids en kilos, par exemple 78,4.'; render(); return; }
        mesure.poids = kg;
      }
      if (admission) Object.assign(S.profil, admission);
      const nouvelles = Object.keys(f.photos || {}).filter(function (a) { return f.photos[a]; }).map(function (a) { return { angle: a, donnees: f.photos[a] }; });
      const retirees = Object.keys(f.retirees || {}).filter(function (a) { return f.retirees[a] && !(f.photos && f.photos[a]); });
      S.profil.mesures = (S.profil.mesures || []).filter(function (m) { return m.date !== S.jour; }).concat([mesure]);
      S.profil.visiteReportee = null;
      S.form = {};
      recalculer(); persister();
      S.ecran = 'survivant'; S.ancre = nouvelles.length ? 'photos' : 'bilan'; render();
      avis('Visite enregistrée. Prochaine visite : ' + dateLongue(V.prochaineVisite(S.profil, S.jour)) + '.');
      if (nouvelles.length || retirees.length) enregistrerPhotos(S.jour, nouvelles, retirees);
    },
    calibrage: function (el) {
      const oui = el.dataset.ok === '1';
      const x = V.repondreCalibrage(S.profil, el.dataset.ex, oui);
      recalculer(); persister(); render();
      if (x && oui) avis(x.reps ? 'Fourchette mise à jour : ' + x.reps[0] + ' à ' + x.reps[1] + ' répétitions.' : 'Réglage mis à jour : ' + x.texte.charAt(0).toLowerCase() + x.texte.slice(1) + '.');
    },
    regard: function () { demanderRegard(); },
    comparer: function (el) { S.comparer = { angle: el.dataset.angle, pos: 50 }; render(); },
    'retirer-photo': function (el) {
      const a = el.dataset.angle;
      S.form.photos = S.form.photos || {}; S.form.retirees = S.form.retirees || {};
      if (S.form.photos[a]) delete S.form.photos[a];
      else S.form.retirees[a] = true;
      render();
    },
    'appliquer-regard': function () {
      const r = rapportCourant();
      if (!r) return;
      const faits = V.appliquerActions(S.profil, r.actions);
      r.appliquees = true;
      recalculer(); persister(); render();
      avis(faits.length ? 'Programme mis à jour : ' + faits.join(' ; ') + '.' : 'Rien à changer dans ton programme.');
    },
    'ignorer-regard': function () { const r = rapportCourant(); if (r) { r.appliquees = true; persister(); render(); } },
    'annonce-photos': function () {
      S.profil.annonces = (S.profil.annonces || []).filter(function (a) { return a !== 'photos'; });
      persister();
      ACTIONS.visite();
    },
    'voir-reglages': function () {
      S.profil.annonces = (S.profil.annonces || []).filter(function (a) { return a !== 'reglages'; });
      persister();
      S.ecran = 'survivant'; S.confirmer = null; S.form = {}; S.ancre = 'programme'; render();
    },
    'ajouter-elastique': function () {
      const brut = String(S.form.elastique || '').trim().replace(',', '.');
      const v = Math.round(parseFloat(brut) * 10) / 10;
      if (!/^\d+(\.\d+)?$/.test(brut) || !(v >= V.ELASTIQUE_MIN && v <= V.ELASTIQUE_MAX)) {
        avis('Indique la résistance de l’élastique en kilos, par exemple 25.', true); return;
      }
      const l = V.elastiquesDe(S.profil).slice();
      if (l.length >= V.ELASTIQUES_NB_MAX) { avis('Dix élastiques au plus.', true); return; }
      S.profil.elastiques = l.concat([v]).sort(function (a, b) { return a - b; });
      delete S.form.elastique;
      V.ajusterElastiques(S.profil);
      recalculer(); persister(); render();
      avis('Élastique de ' + V.kgTexte(v) + ' kg ajouté.');
    },
    'retirer-elastique': function (el) {
      const kg = +el.dataset.kg, l = V.elastiquesDe(S.profil).slice(), i = l.indexOf(kg);
      if (i < 0 || l.length <= 1) return;
      l.splice(i, 1);
      S.profil.elastiques = l;
      const changes = V.ajusterElastiques(S.profil);
      recalculer(); persister(); render();
      avis('Élastique de ' + V.kgTexte(kg) + ' kg retiré.' + (changes.length ? ' Réglages revus : ' + changes.map(function (c) {
        return (V.CATALOGUE[c.id].type === 'mixte' ? '' : V.CATALOGUE[c.id].nom.toLowerCase() + ', ') + c.vers.toLowerCase();
      }).join(' ; ') + '.' : ''));
    },
    'annonce-lue': function (el) {
      S.profil.annonces = (S.profil.annonces || []).filter(function (a) { return a !== el.dataset.id; });
      persister(); render();
    },
    'prio-inscription': function (el) {
      const g = el.dataset.groupe, l = S.form.priorites, i = l.indexOf(g);
      if (i >= 0) l.splice(i, 1);
      else {
        if (l.length >= 2) { avis('Deux priorités au plus. Retire-en une d’abord.', true); return; }
        l.push(g);
        (V.COMPLEMENTS[g] || []).forEach(function (comp) { if (S.form[comp] === false) S.form[comp] = true; });
      }
      render();
    },
    prio: function (el) {
      const g = el.dataset.groupe, l = (S.profil.priorites || []).slice(), i = l.indexOf(g);
      if (i >= 0) l.splice(i, 1);
      else if (l.length >= 2) { avis('Deux priorités au plus. Retire-en une d’abord.', true); return; }
      else l.push(g);
      const ajoutes = V.definirPriorites(S.profil, l);
      recalculer(); persister(); render();
      if (ajoutes.length) avis('Ajouté à ton programme : ' + ajoutes.map(function (id) { return V.CATALOGUE[id].nom.toLowerCase(); }).join(', ') + '.');
      else avis(l.length ? 'Priorités : ' + prioritesTexte(l) + '.' : 'Aucune priorité : séance équilibrée.');
    },
    jour: function (el) {
      const j = +el.dataset.jour, l = S.form.jours, i = l.indexOf(j);
      if (i >= 0) l.splice(i, 1); else l.push(j);
      render();
    },
    mode: function (el) { S.form.mode = el.dataset.mode; render(); },
    inscrire: inscrire,
    partir: partir,
    'reprendre-expedition': function () {
      if (S.brouillon && S.brouillon.courant >= S.brouillon.exos.length) S.brouillon.courant = S.brouillon.exos.length - 1;
      S.ecran = 'expedition'; reveil(true); render();
    },
    moins: function () { S.brouillon.reps = Math.max(0, S.brouillon.reps - 1); sauverBrouillon(); render(); },
    plus: function () { S.brouillon.reps = Math.min(200, S.brouillon.reps + 1); sauverBrouillon(); render(); },
    valider: validerSerie,
    'passer-repos': function () { S.brouillon.repos = null; sauverBrouillon(); render(); },
    'passer-exo': function () {
      const b = S.brouillon;
      b.courant++;
      b.repos = null;
      if (b.courant >= b.exos.length) { sauverBrouillon(); terminer(); return; }
      b.reps = precedent(b.exos[b.courant], 0);
      sauverBrouillon(); render();
    },
    terminer: terminer,
    abandon: function () { S.confirmer = 'abandon'; render(); },
    'abandon-oui': function () {
      S.brouillon = null; stockageLocal(CLE_BROUILLON, null); S.confirmer = null; reveil(false);
      S.ecran = 'accueil'; render(); avis('Sortie abandonnée. Rien n’a été enregistré.');
    },
    'abandon-non': function () { S.confirmer = null; render(); },
    effort: function (el) { S.form.effort = +el.dataset.valeur; render(); },
    enregistrer: enregistrerExpedition,
    libre: function () { S.form = { quoi: '', minutes: 30, effort: 0 }; S.ecran = 'libre'; render(); },
    'enregistrer-libre': enregistrerLibre,
    voir: function (el) { S.bilanId = el.dataset.id; S.ecran = 'bilan'; render(); },
    appliquer: function (el) {
      const sug = V.suggestions(S.profil, S.seances).filter(function (s) { return s.id === el.dataset.ex; })[0];
      if (!sug) return;
      S.profil.programme = S.profil.programme.map(function (e) { return e.id === sug.id ? sug.nouveau : e; });
      recalculer(); persister(); render(); avis('Réglage mis à jour : ' + sug.vers.toLowerCase() + '.');
    },
    ignorer: function (el) { S.ignorees[el.dataset.cle] = true; render(); },
    malade: function () {
      if (pauseActiveOuPrevue()) return;
      const debut = V.addDays(S.jour, -(+(S.form.recul || 0)));
      S.profil.pauses.push({ id: nouvelId(), genre: 'malade', debut: debut, fin: null });
      S.form = {};
      recalculer(); persister(); render(); avis('Pause enregistrée. Soigne-toi, tes vivres sont à l’abri.');
    },
    absence: function () {
      if (pauseActiveOuPrevue()) return;
      const debut = S.form.absDebut || S.jour;
      const fin = S.form.absFin || V.addDays(debut, 6);
      if (debut < S.jour) { avis('Une absence s’annonce avant de partir. Pour un imprévu, déclare-toi malade ou blessé.', true); return; }
      if (fin < debut || V.daysBetween(debut, fin) >= V.ABSENCE_MAX) { avis('L’absence dure de 1 à 21 jours.', true); return; }
      S.profil.pauses.push({ id: nouvelId(), genre: 'absence', debut: debut, fin: fin });
      S.form = {};
      recalculer(); persister(); render(); avis('Absence annoncée du ' + dateCourte(debut) + ' au ' + dateCourte(fin) + '.');
    },
    'reprendre-pause': function () {
      const p = pauseActiveOuPrevue();
      if (!p) return;
      const veille = V.addDays(S.jour, -1);
      if (p.debut > veille) S.profil.pauses = S.profil.pauses.filter(function (x) { return x !== p; });
      else p.fin = veille;
      recalculer(); persister(); render(); avis('Bon retour. Les vivres reprennent leur cours.');
    },
    'plan-jour': function (el) {
      const j = +el.dataset.jour, l = S.profil.plan.jours.slice(), i = l.indexOf(j);
      if (i >= 0) l.splice(i, 1); else l.push(j);
      if (l.length < 2) { avis('Garde au moins deux jours d’expédition.', true); return; }
      S.profil.plan.jours = l.sort();
      recalculer(); persister(); render();
    },
    renoncer: function () { S.confirmer = 'renoncer'; render(); },
    'renoncer-oui': function () {
      survivant().renonce = S.jour; S.confirmer = null;
      recalculer(); persister(); render(); avis('Mode Survie activé pour ' + survivant().nom + '.');
    },
    'annuler-confirmation': function () { S.confirmer = null; render(); },
    exporter: exporter,
    'exporter-copie': exporterCopiePrete,
    'restaurer-oui': restaurer,
    recharger: function () { window.location.reload(); },
    'nouveau-survivant': function () {
      const m = S.profil.morts[S.profil.morts.length - 1];
      const nom = (S.form.nom || '').trim();
      if (!nom) { avis('Donne un nom à ton nouveau survivant.', true); return; }
      S.profil.survivants.push({ nom: nom, mode: S.form.mode || 'ironman', depuis: m.date });
      S.form = {};
      recalculer(); persister(); S.ecran = 'accueil'; render(); avis(nom + ' arrive à la Sucrerie avec 7 rations.');
    }
  };

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const f = ACTIONS[el.dataset.action];
    if (f) f(el, e);
  });
  function lireChamp(el) {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'nombre') v = el.value === '' ? '' : +el.value;
    S.form[el.dataset.champ] = v;
  }
  // Nouveau nom : Entrée valide, Échap annule
  document.addEventListener('keydown', function (e) {
    const el = e.target;
    if (!el || el.id !== 'f-renommer') return;
    if (e.key === 'Enter') { e.preventDefault(); lireChamp(el); validerNom(); }
    else if (e.key === 'Escape') { e.preventDefault(); ACTIONS['renommer-annuler'](); }
  });
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (el.dataset && el.dataset.comparer) {
      const v = Math.max(0, Math.min(100, Math.round(+el.value)));
      S.comparer = { angle: el.dataset.comparer, pos: v };
      const c = el.closest('.comparateur');
      if (c) c.style.setProperty('--pos', v + '%');
      return;
    }
    if (el.dataset && el.dataset.champ && el.type !== 'checkbox' && el.tagName !== 'SELECT') lireChamp(el);
  });
  document.addEventListener('change', function (e) {
    const el = e.target;
    if (el.id === 'f-restaurer') { lireCopie(el.files && el.files[0]); el.value = ''; return; }
    if (el.dataset.photo) {
      const fichier = el.files && el.files[0], angle = el.dataset.photo;
      el.value = '';
      if (!fichier) return;
      compresserPhoto(fichier).then(function (d) {
        S.form.photos = S.form.photos || {}; S.form.photos[angle] = d;
        if (S.form.retirees) delete S.form.retirees[angle];
        render();
      }, function (raison) {
        avis(raison === 'trop_grande' ? 'Photo trop lourde : reprends-la en qualité normale.' : 'Cette photo est illisible : essaie avec une autre.', true);
      });
      return;
    }
    if (el.dataset.progActif) {
      const ex = S.profil.programme.filter(function (x) { return x.id === el.dataset.progActif; })[0];
      if (!el.checked && S.profil.programme.filter(function (x) { return x.actif; }).length <= 1) { el.checked = true; avis('Garde au moins un exercice au programme.', true); return; }
      ex.actif = el.checked;
      recalculer(); persister(); render(); return;
    }
    if (el.dataset.prog) {
      const ex = S.profil.programme.filter(function (x) { return x.id === el.dataset.prog; })[0];
      const c = V.CATALOGUE[ex.id];
      if (c.type === 'charge') { const v = +el.value; if (!(v > 0)) { avis('Indique une charge en kilos.', true); render(); return; } ex.charge = v; }
      else {
        const r = lireReglage(ex.id, el.value);
        if ('niveau' in r) ex.niveau = r.niveau;
        if ('charge' in r) ex.charge = r.charge; else if (c.type === 'mixte') delete ex.charge;
      }
      recalculer(); persister(); render(); return;
    }
    if (el.dataset.reps) {
      const ex = S.profil.programme.filter(function (x) { return x.id === el.dataset.reps; })[0];
      const r = el.value.split('-').map(Number), coach = V.fourchetteCoach(ex);
      if (r[0] === coach.min && r[1] === coach.max) delete ex.reps; else ex.reps = r;
      recalculer(); persister(); render();
      avis(V.CATALOGUE[ex.id].nom + ' : ' + r[0] + ' à ' + r[1] + ' répétitions par série.');
      return;
    }
    if (el.dataset.plan === 'minutes') {
      const v = Math.round(+el.value);
      if (!(v >= 15 && v <= 120)) { avis('La durée visée va de 15 à 120 minutes.', true); render(); return; }
      S.profil.plan.minutes = v; recalculer(); persister(); render(); return;
    }
    if (el.dataset.champ) {
      lireChamp(el);
      if (el.type === 'checkbox' || el.dataset.champ === 'absDebut') render();
    }
  });

  demarrer();
})();
