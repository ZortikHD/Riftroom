# Schreibt data/meta.json (und data/matchups.json) der GitHub-Version aus dem Ausgabeordner der Daten-Skripte.
# Winrates, Matchups und Best in Slot kommen aus Turnierspielen (riftroom_proagg.py). Solange es dafür noch
# keine Daten gibt, bleiben die bisherigen Zahlen stehen.
# Aufruf: python3 -I riftroom_pages.py <ausgabeordner> <repo-ordner>
import json, os, sys
out, repo = sys.argv[1], sys.argv[2]
def load(f):
    p = os.path.join(out, f)
    return json.load(open(p)) if os.path.exists(p) else None
target = os.path.join(repo, 'data', 'meta.json')
old = json.load(open(target)) if os.path.exists(target) else {}
pro = load('pro_current.json')
meta = {'catalog': (load('catalog.json') or {}).get('catalog') or old.get('catalog'),
        'patchnotes': load('patchnotes.json') or old.get('patchnotes')}
if pro:
    meta.update({'current': pro, 'previous': load('pro_previous.json'), 'recent': load('pro_recent.json'),
                 'bisPro': load('pro_bis.json')})
    mu = load('pro_matchups.json')
    if mu:
        json.dump(mu, open(os.path.join(repo, 'data', 'matchups.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
elif (old.get('current') or {}).get('snapshot', {}).get('span'):
    meta.update({k: old.get(k) for k in ('current', 'previous', 'recent', 'bisPro')})
else:   # noch keine Turnierdaten: alte Zahlen behalten
    meta.update({k: old.get(k) for k in ('current', 'previous', 'bis', 'bisElite')})
assert meta['catalog'] and meta['current']['snapshot']['entries'], 'keine Daten'
json.dump(meta, open(target, 'w'), separators=(',', ':'), ensure_ascii=False)
print('ok', meta['current']['snapshot'].get('span') or meta['current']['snapshot']['patch'])
