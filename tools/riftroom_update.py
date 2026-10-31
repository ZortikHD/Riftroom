# Tägliches Daten-Update: Katalog (Riot Data Dragon), Winrates (Master+) und Best in Slot (Lolalytics).
# Master+ hat rund ein Viertel der Spiele von Emerald+; die Mindest-Spielzahlen in der App sind darauf abgestimmt.
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
LANES = {'top': 'TOP', 'jungle': 'JUNGLE', 'middle': 'MIDDLE', 'bottom': 'BOTTOM', 'support': 'UTILITY'}
def lane_data(patch, lane, tier='master_plus'):
    url = f'https://a1.lolalytics.com/mega/?ep=list&v=1&patch={patch}&tier={tier}&queue=ranked&region=all&lane={lane}'
    try:
        d = get(url)
    except urllib.error.HTTPError as e:
        if e.code == 404: raise NoData(f'{patch} {lane}: HTTP 404')
        raise
    if not isinstance(d, dict): raise RuntimeError(f'Format geaendert ({patch} {lane})')
    if d.get('status') == 404 or not d.get('cid') or not d.get('response', {}).get('valid', True):
        raise NoData(f'{patch} {lane}: noch keine Daten')
    sample = next(iter(d['cid'].values()))
    if not isinstance(sample, dict) or not {'games', 'wr', 'lane'} <= set(sample):
        raise RuntimeError(f'Format geaendert ({patch} {lane}): Felder {sorted(sample)[:8] if isinstance(sample, dict) else type(sample).__name__}')
    return d
def build(patch):
    entries, matches = [], 0
    for lane, role in LANES.items():
        d = lane_data(patch, lane)
        matches = max(matches, int(d.get('analysed') or 0))
        for key, v in d['cid'].items():
            cid = id_by_key.get(str(key)); games = round(float(v.get('games') or 0)); wr = float(v.get('wr') or 0)
            if not cid or v.get('lane') != lane or games < 150 or not (0 < wr < 100): continue
            e = {'champion': cid, 'role': role, 'games': games, 'wins': min(games, max(0, round(games * wr / 100)))}
            if v.get('pr') is not None and 0 <= float(v['pr']) <= 100: e['pickRate'] = float(v['pr'])
            if v.get('br') is not None and 0 <= float(v['br']) <= 100: e['banRate'] = float(v['br'])
            entries.append(e)
        time.sleep(0.6)
    if len(entries) <= 100: raise NoData(f'zu wenige Zeilen fuer {patch} ({len(entries)})')
    matches = max([matches] + [e['games'] for e in entries])
    return {'schemaVersion': 1, 'source': 'Lolalytics (inoffizielle Abfrage, nicht von Riot)', 'patch': patch,
            'updatedAt': now(), 'region': 'Global', 'rank': 'Master+',
            'queue': 'Ranked Solo/Duo', 'matches': matches, 'entries': entries}
def try_build(patch):
    try: return build(patch), ''
    except NoData as e: return None, str(e)
newest, why = try_build(patches[0])
older, why_older = try_build(patches[1]) if len(patches) > 1 else (None, 'kein vorheriger Patch')
note = ''
if newest and (not older or len(newest['entries']) >= 0.6 * len(older['entries'])):
    cur, prev = newest, older
else:
    if not older: raise RuntimeError(f'keine Winrates: {why or "zu wenige Zeilen"}; {why_older}')
    note = f'Fallback: {patches[0]} hat erst ' + (f"{len(newest['entries'])} Zeilen" if newest else why)
    cur = older
    prev = try_build(patches[2])[0] if len(patches) > 2 else None
# Best in Slot: Master+ auf demselben Patch wie "aktuell". Nur Picks ab 2 % Pickrate,
# Winrate mit 2000 virtuellen Spielen Richtung 50 % geglaettet, Top 6 je Rolle.
bis = None
try:
    roles = {}
    for lane, role in LANES.items():
        d = lane_data(cur['patch'], lane, 'master_plus'); rows = []
        for key, v in d['cid'].items():
            cid = id_by_key.get(str(key)); g = round(float(v.get('games') or 0)); wr = float(v.get('wr') or 0); pr = float(v.get('pr') or 0)
            if not cid or v.get('lane') != lane or g < 1000 or pr < 2 or not (0 < wr < 100): continue
            rows.append([cid, round(wr, 1), round(pr, 1), g, (wr / 100 * g + 0.5 * 2000) / (g + 2000)])
        rows.sort(key=lambda x: -x[4])
        if len(rows) < 3: raise NoData(f'Master+ {lane}: zu wenige Zeilen')
        roles[role] = [r[:4] for r in rows[:6]]
        time.sleep(0.6)
    bis = {'label': 'Solo Queue Master+', 'patch': cur['patch'], 'region': 'Global', 'asOf': now(), 'roles': roles}
except NoData as e:
    note += f' | Best in Slot nicht aktualisiert: {e}'
json.dump({'catalog': catalog}, open(os.path.join(out, 'catalog.json'), 'w'))
json.dump({'snapshot': cur}, open(os.path.join(out, 'current.json'), 'w'))
if prev: json.dump({'snapshot': prev}, open(os.path.join(out, 'previous.json'), 'w'))
if bis: json.dump({'solo': bis}, open(os.path.join(out, 'bis.json'), 'w'))
print('ok', 'katalog', ver, 'winrates', cur['patch'], len(cur['entries']), 'zeilen', 'vergleich', prev['patch'] if prev else '-', 'bis', 'ja' if bis else 'nein', note)
