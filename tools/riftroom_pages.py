# Schreibt data/meta.json der GitHub-Version aus dem Ausgabeordner von riftroom_update.py.
# Aufruf: python3 -I riftroom_pages.py <ausgabeordner> <repo-ordner>
import json, os, sys
out, repo = sys.argv[1], sys.argv[2]
def load(f):
    p = os.path.join(out, f)
    return json.load(open(p)) if os.path.exists(p) else None
target = os.path.join(repo, 'data', 'meta.json')
old = json.load(open(target)) if os.path.exists(target) else {}
meta = {'catalog': load('catalog.json')['catalog'], 'current': load('current.json'),
        'previous': load('previous.json') or old.get('previous'),
        'bis': (load('bis.json') or {}).get('solo') or old.get('bis')}
assert meta['current']['snapshot']['entries'], 'keine Winrates'
json.dump(meta, open(target, 'w'), separators=(',', ':'), ensure_ascii=False)
print('ok', meta['current']['snapshot']['patch'])
