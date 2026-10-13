// Lance tous les essais fonctionnels : ceux de l'interface sur la page Claude, celui du site sur docs/index.html.
// À lancer après « python3 outils/assembler.py ».
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const racine = path.join(__dirname, '..', '..');
const claude = path.join(racine, 'build', 'claude', 'valgrise.html');
const site = path.join(racine, 'docs', 'index.html');
if (!fs.existsSync(claude) || !fs.existsSync(site)) { console.error('Lance d’abord : python3 outils/assembler.py'); process.exit(1); }

const essais = ['parcours', 'migration', 'migration-bras', 'migration-v6', 'reglages', 'calibrage', 'bilan', 'photos', 'ironman', 'pesee', 'copie-claude', 'nom']
  .map(n => [n, claude]).concat([['site', site]]);
let verifs = 0, echecs = 0;
for (const [nom, page] of essais) {
  const r = spawnSync(process.execPath, [path.join(__dirname, nom + '.js'), page], { encoding: 'utf8' });
  const ok = (r.stdout.match(/^ok /gm) || []).length;
  verifs += ok;
  if (r.status !== 0) { echecs++; console.log('ÉCHEC ' + nom + ' (' + ok + ' vérifications passées)\n' + (r.stdout.split('\n').slice(-4).join('\n')) + r.stderr); }
  else console.log('ok   ' + nom.padEnd(15) + ok + ' vérifications');
}
console.log('\n' + verifs + ' vérifications, ' + (echecs ? echecs + ' essai(s) en échec' : 'tout passe'));
process.exit(echecs ? 1 : 0);
