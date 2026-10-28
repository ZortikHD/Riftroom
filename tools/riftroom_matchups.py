# Matchup-Winrates für das Counter-Puzzle: Für jeden häufigen Champion einer Rolle, wie oft
# gewinnen die anderen Champions derselben Rolle gegen ihn (Emerald+, Solo/Duo, Lolalytics).
import json, sys, time, os, urllib.request
from datetime import datetime, timezone
# Aufruf: python3 -I riftroom_matchups.py <current.json> <ausgabe.json> <catalog.json>
cur_path, out = sys.argv[1], sys.argv[2]
cur = json.load(open(cur_path))['snapshot']
cat = json.load(open(sys.argv[3]))['catalog']
id_by_key = {str(c['key']): c['id'] for c in cat['champions']}
LANE = {'TOP': 'top', 'JUNGLE': 'jungle', 'MIDDLE': 'middle', 'BOTTOM': 'bottom', 'UTILITY': 'support'}
UA = {'User-Agent': 'Riftroom/1.3 (Team-Tool)', 'Accept': 'application/json'}
def get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode('utf-8-sig'))
roles = {}
for role, lane in LANE.items():
    pool = {e['champion']: e for e in cur['entries'] if e['role'] == role and (e.get('pickRate') or 0) >= 0.8}
    enemies = [c for c, e in pool.items() if (e.get('pickRate') or 0) >= 1.5]
    table = {}
    for cid in enemies:
        key = next(c['key'] for c in cat['champions'] if c['id'] == cid)
        url = f"https://a1.lolalytics.com/mega/?ep=counter&v=1&patch={cur['patch']}&c={cid.lower()}&lane={lane}&tier=emerald_plus&queue=ranked&region=all"
        try:
            d = get(url)
        except Exception as ex:
            print('fehler', cid, ex); time.sleep(1); continue
        rows = []
        for r in d.get('counters') or []:
            opp = id_by_key.get(str(r.get('cid')))
            n = int(r.get('n') or 0)
            if not opp or opp == cid or opp not in pool or n < 250: continue
            rows.append([opp, round(100 - float(r['vsWr']), 1), n])
        if len(rows) >= 6: table[cid] = sorted(rows, key=lambda x: -x[1])
        time.sleep(0.5)
    roles[role] = table
    print(role, len(enemies), 'gegner,', len(table), 'mit daten', flush=True)
# Lolalytics zählt aus Sicht des abgefragten Champions; beide Richtungen zusammen sind im Schnitt etwas unter 100 %.
# Deshalb symmetrisch machen: Winrate von A gegen B = Mittel aus (A gegen B) und (100 - B gegen A).
for role, table in roles.items():
    look = {(e, r[0]): r[1] for e, rows in table.items() for r in rows}
    diffs = [wr + look[(o, e)] - 100 for (e, o), wr in look.items() if (o, e) in look]
    bias = sum(diffs) / len(diffs) / 2 if diffs else 0
    for e, rows in table.items():
        for r in rows:
            back = look.get((r[0], e))
            r[1] = round((look[(e, r[0])] + 100 - back) / 2, 1) if back is not None else round(r[1] - bias, 1)
        rows.sort(key=lambda x: -x[1])
json.dump({'patch': cur['patch'], 'rank': 'Emerald+', 'source': 'Lolalytics', 'updatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'roles': roles},
          open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
print('ok', os.path.getsize(out), 'bytes')
