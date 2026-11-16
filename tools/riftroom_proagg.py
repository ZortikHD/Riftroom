# Wertet die gesammelten Turnierspiele (data/pro/games.jsonl) aus: Winrates je Champion und Rolle, Pick- und Banraten,
# Lane-Matchups und Best-in-Slot-Listen. Ersetzt die Solo-Queue-Zahlen in data/meta.json und data/matchups.json.
# Zeitraum: 1. Januar des Vorjahres bis heute. Getrennt ausgewiesen: Vorjahr und laufendes Jahr (für Trends).
# Aufruf: python3 -I riftroom_proagg.py <repo-ordner> <ausgabeordner>
import json, os, re, sys
from collections import defaultdict
from datetime import datetime, timezone

repo, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
now = datetime.now(timezone.utc)
Y1 = now.year; Y0 = Y1 - 1
ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
stamp = now.isoformat().replace('+00:00', 'Z')
# Neuere Spiele zählen mehr: Gewicht halbiert sich alle 150 Tage. Ein Spiel vom Januar 2025 zählt Ende 2026 etwa ein Zehntel.
HALF = 150

# Katalog: frisch aus dem Lauf oder der vorhandene in data/meta.json
cat_path = os.path.join(out, 'catalog.json')
catalog = json.load(open(cat_path))['catalog'] if os.path.exists(cat_path) else json.load(open(os.path.join(repo, 'data', 'meta.json')))['catalog']
patch = '.'.join(catalog['version'].split('.')[:2])
norm = lambda s: re.sub(r'[^a-z]', '', str(s).lower())
by_name = {}
for c in catalog['champions']:
    by_name[norm(c['id'])] = c['id']; by_name[norm(c['name'])] = c['id']
by_name.update({'wukong': 'MonkeyKing', 'nunuwillump': 'Nunu', 'nunu': 'Nunu', 'renataglasc': 'Renata', 'renata': 'Renata'})
unknown = defaultdict(int)
def cid(name):
    c = by_name.get(norm(name))
    if not c: unknown[name] += 1
    return c

games = []
src = os.path.join(repo, 'data', 'pro', 'games.jsonl')
for line in open(src, encoding='utf-8'):
    if not line.strip(): continue
    g = json.loads(line)
    y = int((g.get('dt') or '0')[:4] or 0)
    if y < Y0: continue
    b = [cid(x) for x in g['b']]; r = [cid(x) for x in g['r']]
    if None in b or None in r or len(set(b + r)) != 10: continue
    bans = [c for c in (cid(x) for x in g.get('bb', []) + g.get('rb', []) if x and x.lower() not in ('none', 'loss of ban')) if c]
    try: age = max(0, (now - datetime.fromisoformat(g['dt'][:10]).replace(tzinfo=timezone.utc)).days)
    except ValueError: age = 365
    games.append({'y': y, 'b': b, 'r': r, 'bans': bans, 'w': g['w'], 'lg': g.get('lg', ''), 'rg': g.get('rg', ''), 'tn': g.get('tn', ''),
                  'wt': 0.5 ** (age / HALF), 'bo': g.get('bo'), 'ro': g.get('ro')})
if len(games) < 200:
    print('zu wenige Turnierspiele:', len(games)); sys.exit(1)

# Top-Ligen und internationale Turniere (für die Best-in-Slot-Liste „Top-Ligen“)
TOP = re.compile(r'LoL Champions Korea|^LCK$|Tencent LoL Pro League|^LPL$|LoL EMEA Championship|^LEC$|Championship Series|^LCS$|^LTA|Americas|Championship Pacific|^LCP$|World Championship|Mid-Season Invitational|First Stand|Esports World Cup')
NOT_TOP = re.compile(r'Challengers|Academy|\bCL\b|Development|Rising|Masters|Tour')
is_top = lambda g: bool(TOP.search(g['lg']) or g['rg'] == 'International') and not NOT_TOP.search(g['lg'] + ' ' + g['tn'])
is_prime = lambda g: 'Prime League' in g['lg'] or g['lg'].startswith('PRM')

def stats(sel):
    n = len(sel); pick = defaultdict(lambda: [0, 0, 0.0, 0.0]); ban = defaultdict(lambda: [0, 0.0]); W = 0.0
    for g in sel:
        wt = g['wt']; W += wt
        for k in range(5):
            for team, side in ((g['b'], 1), (g['r'], 2)):
                e = pick[(team[k], ROLES[k])]; won = g['w'] == side
                e[0] += 1; e[1] += won; e[2] += wt; e[3] += wt * won
        for c in set(g['bans']): ban[c][0] += 1; ban[c][1] += wt
    return n, pick, ban, W

N = len(games)
# Schwellen passend zur Stichprobe. Turnierspiele sind viel weniger als Solo-Queue-Spiele.
LIM = {'role': max(10, round(N * 0.0008)), 'strong': max(40, round(N * 0.004)), 'prior': max(10, round(N * 0.0008)),
       'mu': max(8, round(N * 0.0004)), 'muPick': max(10, round(N * 0.0005)), 'muPrior': 10, 'trend': max(20, round(N * 0.002))}

# games/wins = echte Zahlen. wg/ww = nach Alter gewichtete Spiele/Siege (für Winrate-Bewertung); Pick- und Banrate gewichtet.
def snapshot(sel, span, weighted=True):
    n, pick, ban, W = stats(sel)
    entries = []
    for (c, role), (gm, w, wg, ww) in pick.items():
        e = {'champion': c, 'role': role, 'games': gm, 'wins': w}
        if weighted:
            e.update({'wg': round(wg, 1), 'ww': round(min(ww, wg), 1), 'pickRate': round(wg / W * 100, 2), 'banRate': round(ban[c][1] / W * 100, 2) if c in ban else 0})
        else:
            e.update({'pickRate': round(gm / n * 100, 2), 'banRate': round(ban[c][0] / n * 100, 2) if c in ban else 0})
        entries.append(e)
    entries.sort(key=lambda e: (e['role'], -e['games']))
    return {'snapshot': {'schemaVersion': 1, 'source': 'Leaguepedia (Turnierspiele)', 'patch': patch, 'updatedAt': stamp,
                         'region': 'Global', 'rank': 'Pro', 'queue': 'Turnier', 'span': span, 'matches': n,
                         'entries': entries[:1500], 'limits': LIM}}

cur = snapshot(games, f'{Y0}–{Y1}')
old = [g for g in games if g['y'] == Y0]; new = [g for g in games if g['y'] == Y1]
json.dump(cur, open(os.path.join(out, 'pro_current.json'), 'w'), ensure_ascii=False)
if len(old) >= 200: json.dump(snapshot(old, str(Y0), False), open(os.path.join(out, 'pro_previous.json'), 'w'), ensure_ascii=False)
if len(new) >= 200: json.dump(snapshot(new, str(Y1), False), open(os.path.join(out, 'pro_recent.json'), 'w'), ensure_ascii=False)

# Lane-Matchups: Champion gegen den Gegner auf derselben Position. Format wie data/matchups.json: [Gegner, Winrate, Spiele].
mu = {r: defaultdict(lambda: defaultdict(lambda: [0, 0])) for r in ROLES}
for g in games:
    for k, role in enumerate(ROLES):
        a, b = g['b'][k], g['r'][k]
        mu[role][a][b][0] += 1; mu[role][a][b][1] += (g['w'] == 1)
        mu[role][b][a][0] += 1; mu[role][b][a][1] += (g['w'] == 2)
keep = max(3, LIM['mu'] // 2)
roles = {}
for role in ROLES:
    roles[role] = {}
    for a, opp in mu[role].items():
        rows = sorted(([o, round(w / n * 100, 1), n] for o, (n, w) in opp.items() if n >= keep), key=lambda x: -x[2])[:40]
        if rows: roles[role][a] = sorted(rows, key=lambda x: -x[1])
json.dump({'patch': patch, 'rank': 'Pro', 'span': f'{Y0}–{Y1}', 'source': 'Leaguepedia', 'updatedAt': stamp, 'limits': LIM, 'roles': roles},
          open(os.path.join(out, 'pro_matchups.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

# Best in Slot: je Rolle die Champions mit der höchsten Präsenz (Picks + Bans), dazu die geglättete Winrate.
# Format wie bisher: [Champion, Winrate, Präsenz %, Spiele].
def bis(sel, label):
    n, pick, ban, _ = stats(sel)
    ban = {c: v[0] for c, v in ban.items()}
    if n < 60: return None
    main = {}
    for (c, role), (gm, *_) in pick.items():
        if gm > main.get(c, (None, 0))[1]: main[c] = (role, gm)
    pr = max(5, round(n * 0.002))
    out_roles = {}
    for role in ROLES:
        rows = []
        for (c, ro), (gm, w, *_) in pick.items():
            if ro != role or gm < max(3, n * 0.01): continue
            bans = ban.get(c, 0) if main[c][0] == role else 0
            pres = (gm + bans) / n * 100
            wr = (w + pr) / (gm + 2 * pr) * 100
            rows.append([c, round(wr, 1), round(pres, 1), gm, pres * 0.7 + (wr - 50) * 1.5])
        rows.sort(key=lambda x: -x[4])
        if len(rows) < 3: return None
        out_roles[role] = [x[:4] for x in rows[:6]]
    return {'label': label, 'patch': patch, 'region': 'Global', 'asOf': stamp, 'matches': n, 'roles': out_roles}
recent = [g for g in games if g['y'] == Y1] or games
lists = {'top': bis([g for g in recent if is_top(g)], f'Top-Ligen {Y1}'), 'all': bis(recent, f'Alle Turniere {Y1}'),
         'prime': bis([g for g in games if is_prime(g)], f'Prime League {Y0}–{Y1}')}
json.dump({k: v for k, v in lists.items() if v}, open(os.path.join(out, 'pro_bis.json'), 'w'), ensure_ascii=False)
# Pick-Reihenfolge: welche Rolle wird als 1., 2., ... Pick genommen (Blau: B1, B2, B3, B4, B5; Rot: R1 ... R5),
# und welche Champions sind die typischen First Picks (Blau B1, Rot R1+R2) je Rolle. Neuere Spiele zählen mehr.
po = [g for g in games if g.get('bo') and g.get('ro')]
first = None
if len(po) >= 200:
    order = {s: [[0.0] * 5 for _ in range(5)] for s in ('blue', 'red')}
    fpc = {s: defaultdict(lambda: [0.0, 0, 0]) for s in ('blue', 'red')}
    for g in po:
        for s, ro, team, side in (('blue', g['bo'], g['b'], 1), ('red', g['ro'], g['r'], 2)):
            for k, ix in enumerate(ro): order[s][k][ix] += g['wt']
            for ix in ro[:1 if s == 'blue' else 2]:
                e = fpc[s][(team[ix], ROLES[ix])]; e[0] += g['wt']; e[1] += 1; e[2] += (g['w'] == side)
    shares = {s: [[round(v / (sum(row) or 1) * 100, 1) for v in row] for row in order[s]] for s in order}
    champs = {}
    for s in fpc:
        tot = sum(v[0] for v in fpc[s].values()) or 1
        champs[s] = {role: [[c, round(v[0] / tot * 100, 2), v[1], v[2]] for (c, ro), v in sorted(fpc[s].items(), key=lambda x: -x[1][0]) if ro == role][:10] for role in ROLES}
    first = {'span': f'{Y0}–{Y1}', 'games': len(po), 'asOf': stamp, 'order': shares, 'champs': champs}
    json.dump(first, open(os.path.join(out, 'pro_first.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
leagues = defaultdict(int)
for g in games: leagues[g['lg']] += 1
print('ok', N, 'Spiele', f'({Y0}: {len(old)}, {Y1}: {len(new)})', 'Ligen', len(leagues), 'Grenzen', LIM,
      'BiS', [k for k, v in lists.items() if v], 'Top-Ligen-Spiele', sum(1 for g in recent if is_top(g)), 'Prime', sum(1 for g in games if is_prime(g)))
print('Pick-Reihenfolge:', len(po), 'Spiele', {s: dict(zip(ROLES, first['order'][s][0])) for s in first['order']} if first else '-')
print('Ligen:', sorted(leagues.items(), key=lambda x: -x[1])[:25])
if unknown: print('unbekannte Namen:', dict(unknown))
