// Dessine les icônes de l'appli (écran d'accueil, Android, navigateur) avec les vraies polices et textures.
// Usage : node outils/icones.js <variante A|B> <dossier de sortie>
// Il faut Playwright (Chromium) et sharp ; chemins passés par PLAYWRIGHT / SHARP / CHROMIUM si besoin.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const sharp = require(process.env.SHARP || 'sharp');

const SRC = path.join(__dirname, '..', 'src');
const variante = (process.argv[2] || 'B').toUpperCase();
const sortie = path.resolve(process.argv[3] || path.join(SRC, 'icones'));
const url = f => 'file://' + path.join(SRC, f);

// Le grain d'encre des tampons de l'appli
const ENCRE = '<filter id="encre" x="-8%" y="-8%" width="116%" height="116%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="bruit"/>' +
  '<feDisplacementMap in="SourceGraphic" in2="bruit" scale="3" xChannelSelector="R" yChannelSelector="G" result="bord"/>' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="17" result="taches"/>' +
  '<feColorMatrix in="taches" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.8 0 0 0 1.75" result="masque"/>' +
  '<feComposite in="bord" in2="masque" operator="in"/></filter>';

// A : une carte kraft posée sur le bureau vert, un V au pochoir. B : un tampon rouge V sur kraft.
function dessin(echelle) {
  if (variante === 'A') {
    return '<div class="fond bureau"><div class="carte kraft" style="transform: rotate(-5deg) scale(' + echelle + ')">' +
      '<span class="v encre">V</span>' +
      '<svg class="rond" viewBox="0 0 120 120"><defs>' + ENCRE + '</defs><g filter="url(#encre)"><circle cx="60" cy="60" r="50" fill="none" stroke="#A61E22" stroke-width="9"/></g></svg>' +
      '</div></div>';
  }
  return '<div class="fond kraft"><svg class="tampon" viewBox="0 0 512 512" style="transform: rotate(-8deg) scale(' + echelle + ')"><defs>' + ENCRE + '</defs>' +
    '<g filter="url(#encre)"><rect x="86" y="86" width="340" height="340" rx="34" fill="none" stroke="#A61E22" stroke-width="26"/>' +
    '<text x="256" y="378" text-anchor="middle" font-family="Stardos Stencil" font-weight="700" font-size="330" fill="#A61E22">V</text></g></svg></div>';
}

const page = (echelle) => '<!doctype html><meta charset="utf-8"><style>' +
  "@font-face { font-family: 'Stardos Stencil'; font-weight: 700; src: url(" + url('polices/stardos-stencil-latin-700-normal.woff2') + ") format('woff2'); }" +
  'html, body { margin: 0; background: transparent; }' +
  '.fond { width: 512px; height: 512px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }' +
  '.bureau { background: #56604F; }' +
  '.kraft { background-color: #C6A979; background-image: url(' + url('textures/kraft-grain.png') + '); background-size: 512px 512px; background-blend-mode: multiply; }' +
  '.carte { position: relative; width: 352px; height: 400px; border-radius: 10px; box-shadow: 0 3px 0 rgba(0,0,0,.35), 0 26px 40px -12px rgba(15,20,12,.7); display: flex; align-items: center; justify-content: center; }' +
  '.v { font: 700 330px/1 "Stardos Stencil"; color: #1F1D1A; margin-top: 40px; }' +
  '.rond { position: absolute; right: 20px; bottom: 20px; width: 96px; height: 96px; mix-blend-mode: multiply; transform: rotate(-12deg); }' +
  '.tampon { width: 512px; height: 512px; mix-blend-mode: multiply; }' +
  '</style><body>' + dessin(echelle) + '</body>';

(async () => {
  fs.mkdirSync(sortie, { recursive: true });
  const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const onglet = await navigateur.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
  async function rendre(echelle) {
    await onglet.setContent(page(echelle), { waitUntil: 'load' });
    await onglet.evaluate(() => document.fonts.ready);
    return onglet.locator('.fond').screenshot({ type: 'png' });
  }
  const plein = await rendre(1);
  const masquable = await rendre(0.78);   // tout le dessin dans le cercle central que garde Android
  const tailles = [['icone-512.png', plein, 512], ['icone-192.png', plein, 192], ['apple-touch-icon.png', plein, 180], ['icone-masquable-512.png', masquable, 512]];
  for (const [nom, image, cote] of tailles) {
    await sharp(image).resize(cote, cote, { kernel: 'lanczos3' }).flatten({ background: '#56604F' }).png({ compressionLevel: 9 }).toFile(path.join(sortie, nom));
  }
  await navigateur.close();
  console.log('Icônes', variante, '→', sortie);
})().catch(e => { console.error(e); process.exit(1); });
