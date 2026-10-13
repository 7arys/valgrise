/* Valgrise : garde l'appli disponible hors connexion.
   L'assembleur remplace VERSION (empreinte des fichiers) et FICHIERS (tout le site) :
   chaque nouvelle version change ce fichier, le téléphone la télécharge en entier puis l'appli propose de recharger. */
'use strict';
const VERSION = '__VERSION__';
const CACHE = 'valgrise-' + VERSION;
const FICHIERS = __FICHIERS__;
const PORTEE = new URL('./', self.location).pathname;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  // Seuls les anciens caches de Valgrise partent : d'autres sites peuvent partager cette adresse.
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k.indexOf('valgrise-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(PORTEE) !== 0) return;
  if (req.mode === 'navigate') {
    // L'appli s'ouvre tout de suite depuis le téléphone, même sans réseau.
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match('./').then(function (r) { return r || fetch(req); });
    }).catch(function () { return fetch(req); }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (r) {
      return r || fetch(req).then(function (rep) {
        if (rep && rep.ok && rep.type === 'basic') c.put(req, rep.clone());
        return rep;
      });
    });
  }));
});
