# Welche Champions wurden im Patch geändert? Liest die offiziellen Patch Notes von Riot (leagueoflegends.com)
# und nimmt nur die Champion-Namen aus dem Abschnitt „Champions“. Data Dragon allein reicht dafür nicht:
# dort fehlen viele Änderungen an Fähigkeiten (16.22: 5 von 14 Champions erkannt).
# Aufruf: python3 -I riftroom_patchnotes.py <ausgabeordner>   (liest current.json, schreibt patchnotes.json)
import json, os, re, sys, html, urllib.request, urllib.error
from datetime import datetime, timezone
out = sys.argv[1]
UA = {'User-Agent': 'Mozilla/5.0 (compatible; Riftroom/1.3; +https://github.com/ZortikHD/Riftroom)'}
def fetch(url, as_json=False):
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode('utf-8', 'ignore')
    return json.loads(data) if as_json else data
cur = json.load(open(os.path.join(out, 'current.json')))['snapshot']['patch']          # z. B. "16.22"
ver = json.load(open(os.path.join(out, 'catalog.json')))['catalog']['version']         # z. B. "16.22.1"
major, minor = cur.split('.')
notes = f'{int(major) + 10}.{int(minor)}'                                              # Spielversion 16.x = Patch Notes 26.x
url = f'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-{notes.replace(".", "-")}-notes/'
try:
    page = fetch(url)
except urllib.error.HTTPError as e:
    print('keine Patch Notes', notes, e.code); sys.exit(0)
# Abschnitt zwischen der Überschrift „Champions“ und der nächsten Hauptüberschrift
heads = [(m.start(), re.sub(r'<[^>]+>', '', m.group(1)).strip()) for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', page, re.S)]
start = next((i for i, (_, t) in enumerate(heads) if t.lower() == 'champions'), None)
if start is None:
    print('kein Champion-Abschnitt', notes); sys.exit(0)
a = heads[start][0]; b = heads[start + 1][0] if start + 1 < len(heads) else len(page)
names = [html.unescape(re.sub(r'<[^>]+>', '', t)).strip() for t in re.findall(r'<h3[^>]*class="change-title"[^>]*>(.*?)</h3>', page[a:b], re.S)]
# Englische Namen -> Champion-IDs (Data Dragon, englisch)
en = fetch(f'https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/champion.json', True)['data']
norm = lambda s: re.sub(r'[^a-z]', '', s.lower())
by = {}
for c in en.values():
    by[norm(c['name'])] = c['id']; by[norm(c['id'])] = c['id']
ids, unknown = [], []
for n in names:
    cid = by.get(norm(n))
    (ids if cid else unknown).append(cid or n)
res = {'patch': cur, 'notes': notes, 'url': url, 'champions': sorted(set(ids)), 'fetchedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
json.dump(res, open(os.path.join(out, 'patchnotes.json'), 'w'))
print('ok', notes, len(res['champions']), 'Champions', ('unbekannt: ' + ', '.join(unknown)) if unknown else '')
