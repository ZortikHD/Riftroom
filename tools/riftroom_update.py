# Tägliches Daten-Update: Champion-Katalog von Riot (Data Dragon). Winrates, Matchups und Best in Slot
# kommen seit November 2026 aus Turnierspielen (riftroom_pro.py und riftroom_proagg.py), nicht mehr aus der Solo Queue.
# Aufruf: python3 -I riftroom_update.py <ausgabeordner>
import json, sys, time, os, re, urllib.request, urllib.error
from datetime import datetime, timezone
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
UA = {'User-Agent': 'Riftroom/1.3 (Team-Tool)', 'Accept': 'application/json'}
now = lambda: datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
class NoData(Exception): pass
def get(url):
    req = urllib.request.Request(url, headers=UA)
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode('utf-8-sig'))
versions = get('https://ddragon.leagueoflegends.com/api/versions.json')
ver = versions[0]
patches = []
for v in versions:
    if re.fullmatch(r'\d+\.\d+\.\d+', v):
        p = '.'.join(v.split('.')[:2])
        if p not in patches: patches.append(p)
assert patches and patches[0] == '.'.join(ver.split('.')[:2]), 'Versionsliste unerwartet'
raw = get(f'https://ddragon.leagueoflegends.com/cdn/{ver}/data/de_DE/champion.json')['data']
assert len(raw) >= 100, 'Champion-Katalog unvollstaendig'
champions = [{'id': c['id'], 'key': c['key'], 'name': c['name'], 'title': c['title'], 'tags': c['tags'], 'info': c['info']} for c in raw.values()]
catalog = {'version': ver, 'fetchedAt': now(), 'champions': champions}
id_by_key = {str(c['key']): c['id'] for c in champions}
json.dump({'catalog': catalog}, open(os.path.join(out, 'catalog.json'), 'w'))
print('ok', 'katalog', ver, len(champions), 'Champions')
