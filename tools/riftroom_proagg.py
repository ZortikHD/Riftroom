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
    games.append({'y': y, 'b': b, 'r': r, 'bans': bans, 'w': g['w'], 'lg': g.get('lg', ''), 'rg': g.get('rg', ''), 'tn': g.get('tn', '')})
if len(games) < 200:
    print('zu wenige Turnierspiele:', len(games)); sys.exit(1)

# Top-Ligen und internationale Turniere (für die Best-in-Slot-Liste „Top-Ligen“)
TOP = re.compile(r'LoL Champions Korea|^LCK$|Tencent LoL Pro League|^LPL$|LoL EMEA Championship|^LEC$|Championship Series|^LCS$|^LTA|Americas|Championship Pacific|^LCP$|World Championship|Mid-Season Invitational|First Stand|Esports World Cup')
NOT_TOP = re.compile(r'Challengers|Academy|\bCL\b|Development|Rising|Masters|Tour')
is_top = lambda g: bool(TOP.search(g['lg']) or g['rg'] == 'International') and not NOT_TOP.search(g['lg'] + ' ' + g['tn'])
is_prime = lambda g: 'Prime League' in g['lg'] or g['lg'].startswith('PRM')

def stats(sel):
    n = len(sel); pick = defaultdict(lambda: [0, 0]); ban = defaultdict(int)
    for g in sel:
        for k in range(5):
            for team, side in ((g['b'], 1), (g['r'], 2)):
                e = pick[(team[k], ROLES[k])]; e[0] += 1; e[1] += (g['w'] == side)
        for c in set(g['bans']): ban[c] += 1
    return n, pick, ban

N = len(games)
# Schwellen passend zur Stichprobe. Turnierspiele sind viel weniger als Solo-Queue-Spiele.
LIM = {'role': max(10, round(N * 0.0008)), 'strong': max(40, round(N * 0.004)), 'prior': max(10, round(N * 0.0008)),
       'mu': max(8, round(N * 0.0004)), 'muPick': max(10, round(N * 0.0005)), 'muPrior': 10, 'trend': max(20, round(N * 0.002))}

def snapshot(sel, span):
    n, pick, ban = stats(sel)
    entries = []
    for (c, role), (gm, w) in pick.items():
        entries.append({'champion': c, 'role': role, 'games': gm, 'wins': w, 'pickRate': round(gm / n * 100, 2), 'banRate': round(ban.get(c, 0) / n * 100, 2)})
    entries.sort(key=lambda e: (e['role'], -e['games']))
    return {'snapshot': {'schemaVersion': 1, 'source': 'Leaguepedia (Turnierspiele)', 'patch': patch, 'updatedAt': stamp,
                         'region': 'Global', 'rank': 'Pro', 'queue': 'Turnier', 'span': span, 'matches': n,
                         'entries': entries[:1500], 'limits': LIM}}

cur = snapshot(games, f'{Y0}–{Y1}')
old = [g for g in games if g['y'] == Y0]; new = [g for g in games if g['y'] == Y1]
json.dump(cur, open(os.path.join(out, 'pro_current.json'), 'w'), ensure_ascii=False)
if len(old) >= 200: json.dump(snapshot(old, str(Y0)), open(os.path.join(out, 'pro_previous.json'), 'w'), ensure_ascii=False)
if len(new) >= 200: json.dump(snapshot(new, str(Y1)), open(os.path.join(out, 'pro_recent.json'), 'w'), ensure_ascii=False)

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
    n, pick, ban = stats(sel)
    if n < 60: return None
    main = {}
    for (c, role), (gm, _) in pick.items():
        if gm > main.get(c, (None, 0))[1]: main[c] = (role, gm)
    pr = max(5, round(n * 0.002))
    out_roles = {}
    for role in ROLES:
        rows = []
        for (c, ro), (gm, w) in pick.items():
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
leagues = defaultdict(int)
for g in games: leagues[g['lg']] += 1
print('ok', N, 'Spiele', f'({Y0}: {len(old)}, {Y1}: {len(new)})', 'Ligen', len(leagues), 'Grenzen', LIM,
      'BiS', [k for k, v in lists.items() if v], 'Top-Ligen-Spiele', sum(1 for g in recent if is_top(g)), 'Prime', sum(1 for g in games if is_prime(g)))
print('Ligen:', sorted(leagues.items(), key=lambda x: -x[1])[:25])
if unknown: print('unbekannte Namen:', dict(unknown))
