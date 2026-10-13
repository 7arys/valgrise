# Valgrise

Un carnet d’entraînement dans une vallée d’après la fin du monde : ton survivant mange une ration par jour, tes séances en rapportent.

**Appli : https://7arys.github.io/valgrise/**

## L’installer sur iPhone

1. Ouvre l’adresse dans **Safari**.
2. Touche **Partager**, puis **Sur l’écran d’accueil**.
3. Ouvre Valgrise **depuis l’icône**. Elle s’ouvre en plein écran et marche sans réseau.

L’appli installée et Safari ne partagent pas leurs données : restaure ta copie depuis l’appli installée, pas depuis Safari.

## Tes données

Tout reste dans le téléphone : la partie (profil, séances, mesures) et les photos de la fiche signalétique. Rien n’est envoyé ailleurs.

- **Survivant → Sauvegarde → Télécharger une copie** : un fichier `.json` avec tout, photos comprises. Sur iPhone, choisis « Enregistrer dans Fichiers ».
- **Restaurer une copie** : depuis le même endroit, ou dès l’inscription sur un nouvel appareil.

Si tu supprimes l’appli de l’écran d’accueil, ses données partent avec : fais une copie de temps en temps.

La version qui tourne dans Claude garde la partie sur le compte Claude et peut demander le rapport d’Ida sur les photos. Les deux versions ne se synchronisent pas : on passe de l’une à l’autre par une copie.

## Développement

```
npm install                    # jsdom et fake-indexeddb, pour les essais
python3 outils/assembler.py    # construit docs/ (le site) et build/claude/ (l’artefact Claude)
npm test                       # moteur (node --test) puis essais d’interface dans un DOM simulé
```

- `src/engine.js` : les règles du jeu, sans interface (progression, calibrage, bilan d’Ida…).
- `src/app.js` et `src/page.html` : l’interface et ses styles.
- `src/site/` : ce qui n’existe que dans le site installable (en-tête, manifeste, service worker).
- `src/polices/`, `src/textures/`, `src/icones/` : fichiers embarqués. Les icônes se redessinent avec `node outils/icones.js B src/icones` (Playwright et sharp).
- `docs/` est **généré** : ne pas le modifier à la main. GitHub Pages le sert tel quel.

Le service worker garde tout le site sur le téléphone. Chaque construction change son empreinte : au retour dans l’appli, le téléphone télécharge la nouvelle version et propose de recharger.

Polices : Archivo, Caveat et Stardos Stencil, sous licence SIL Open Font License (textes dans `src/polices/`).
