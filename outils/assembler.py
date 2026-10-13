# Assemble Valgrise à partir de src/ :
#  - build/claude/valgrise.html : la page publiée comme artefact Claude (polices Google, textures à côté) ;
#  - docs/ : le site installable servi par GitHub Pages (hors connexion, polices et textures incluses).
# docs/ est entièrement régénéré : ne rien y modifier à la main.
import hashlib, json, pathlib, re, shutil

RACINE = pathlib.Path(__file__).resolve().parent.parent
SRC = RACINE / 'src'


def lire(chemin):
    return chemin.read_text(encoding='utf-8')


def page_assemblee():
    page = lire(SRC / 'page.html')
    for marqueur, fichier in (('/*ENGINE*/', 'engine.js'), ('/*APP*/', 'app.js')):
        code = lire(SRC / fichier)
        assert '</script' not in code.lower(), fichier + ' contient </script> : la page serait coupée'
        assert page.count(marqueur) == 1, 'marqueur ' + marqueur + ' introuvable ou en double'
        page = page.replace(marqueur, code, 1)
    return page


def version_claude(page):
    sortie = RACINE / 'build' / 'claude'
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / 'valgrise.html').write_text(page, encoding='utf-8')
    for t in sorted((SRC / 'textures').glob('*.png')):
        shutil.copy2(t, sortie / t.name)
    return sortie / 'valgrise.html'


def version_site(page):
    docs = RACINE / 'docs'
    if docs.exists():
        shutil.rmtree(docs)
    docs.mkdir()
    fin_style = page.index('</style>') + len('</style>')
    tete, corps = page[:fin_style], page[fin_style:]
    tete = re.sub(r'<title>.*?</title>\s*', '', tete)
    tete = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\s*', '', tete)
    assert 'googleapis' not in tete, 'il reste un lien vers Google Fonts'
    html = (lire(SRC / 'site' / 'tete.html') + tete.strip() + '\n</head>\n<body>\n' +
            corps.strip() + '\n' + lire(SRC / 'site' / 'pied.html') + '</body>\n</html>\n')
    (docs / 'index.html').write_text(html, encoding='utf-8')
    shutil.copy2(SRC / 'site' / 'manifest.webmanifest', docs / 'manifest.webmanifest')
    for t in sorted((SRC / 'textures').glob('*.png')):
        shutil.copy2(t, docs / t.name)
    (docs / 'polices').mkdir()
    for f in sorted((SRC / 'polices').iterdir()):
        if f.suffix in ('.woff2', '.txt'):
            shutil.copy2(f, docs / 'polices' / f.name)
    (docs / 'icones').mkdir()
    for f in sorted((SRC / 'icones').glob('*.png')):
        shutil.copy2(f, docs / 'icones' / f.name)
    (docs / '.nojekyll').write_text('', encoding='utf-8')

    # Service worker : la liste de tout le site, et une empreinte qui change à chaque modification
    fichiers = sorted(p for p in docs.rglob('*') if p.is_file() and p.suffix != '.txt' and p.name != '.nojekyll')
    empreinte = hashlib.sha256()
    for p in fichiers:
        empreinte.update(p.relative_to(docs).as_posix().encode('utf-8'))
        empreinte.update(p.read_bytes())
    version = empreinte.hexdigest()[:12]
    liste = ['./' if p == docs / 'index.html' else p.relative_to(docs).as_posix() for p in fichiers]
    sw = lire(SRC / 'site' / 'sw.js').replace('__VERSION__', version).replace('__FICHIERS__', json.dumps(liste, ensure_ascii=False))
    (docs / 'sw.js').write_text(sw, encoding='utf-8')
    poids = sum(p.stat().st_size for p in fichiers)
    return version, len(liste), poids


if __name__ == '__main__':
    page = page_assemblee()
    chemin = version_claude(page)
    print('Claude :', chemin.relative_to(RACINE), len(page.encode('utf-8')), 'octets')
    version, nb, poids = version_site(page)
    print('Site   : docs/, version', version + ',', nb, 'fichiers en cache,', round(poids / 1024), 'Kio')
