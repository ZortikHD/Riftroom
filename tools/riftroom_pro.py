# Turnierspiele aus Leaguepedia (lol.fandom.com, Cargo-API): Picks, Bans, Seiten und Sieger jedes Spiels
# in Profi- und Amateurligen ab dem 1. Januar des Vorjahres. Showmatches und All-Star-Events zählen nicht.
# Die Spiele werden in data/pro/games.jsonl gesammelt (eine Zeile pro Spiel), danach holt jeder Lauf nur Neues.
# Zugang: ein Bot-Passwort von Leaguepedia (Special:BotPasswords), als GitHub-Secrets LEAGUEPEDIA_USER und LEAGUEPEDIA_PASS.
# Ohne Zugang wird nichts abgefragt; die zuletzt gesammelten Spiele bleiben stehen.
# Aufruf: python3 -I riftroom_pro.py <repo-ordner> [--seit JJJJ-MM-TT] [--max-anfragen N] [--pruefen]
import json, os, sys, time, urllib.request, urllib.parse, urllib.error, http.cookiejar
from datetime import datetime, timezone

API = 'https://lol.fandom.com/api.php'
UA = {'User-Agent': 'Riftroom/1.4 (Draft-Tool fuer ein Amateurteam; +https://github.com/ZortikHD/Riftroom)'}
args = sys.argv[1:]
repo = args[0]
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args else default
year0 = datetime.now(timezone.utc).year - 1
since = opt('--seit', f'{year0}-01-01')
max_req = int(opt('--max-anfragen', '400'))
check = '--pruefen' in args
cache = os.path.join(repo, 'data', 'pro', 'games.jsonl')
os.makedirs(os.path.dirname(cache), exist_ok=True)
requests = 0
user, password = os.environ.get('LEAGUEPEDIA_USER', '').strip(), os.environ.get('LEAGUEPEDIA_PASS', '').strip()
if not user or not password:
    print('Keine Leaguepedia-Zugangsdaten (LEAGUEPEDIA_USER/LEAGUEPEDIA_PASS), Turnierspiele bleiben unverändert.'); sys.exit(0)
web = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(params, post=False):
    q = urllib.parse.urlencode({'format': 'json', **params})
    req = urllib.request.Request(API, data=q.encode(), headers=UA) if post else urllib.request.Request(API + '?' + q, headers=UA)
    return json.loads(web.open(req, timeout=60).read().decode('utf-8'))
token = call({'action': 'query', 'meta': 'tokens', 'type': 'login'})['query']['tokens']['logintoken']
res = call({'action': 'login', 'lgname': user, 'lgpassword': password, 'lgtoken': token}, post=True).get('login', {})
if res.get('result') != 'Success':
    print('Anmeldung bei Leaguepedia fehlgeschlagen:', res.get('result'), (res.get('reason') or '')[:120]); sys.exit(1)
print('bei Leaguepedia angemeldet')

def cargo(params):
    global requests
    if requests >= max_req: raise StopIteration
    q = {'action': 'cargoquery', 'limit': '500', **params}
    wait = 10
    for _ in range(10):
        requests += 1
        try:
            d = call(q)
        except urllib.error.HTTPError as e:
            d = {'error': {'code': f'HTTP {e.code}'}}
        except Exception as e:
            d = {'error': {'code': type(e).__name__}}
        if 'error' in d:
            print(f'  Leaguepedia: {d["error"].get("code")}, warte {wait} s', flush=True)
            time.sleep(wait); wait = min(wait * 2, 180); continue
        time.sleep(2)   # freundlich bleiben: höchstens eine Anfrage alle zwei Sekunden
        return [r['title'] for r in d.get('cargoquery', [])]
    raise RuntimeError('Leaguepedia antwortet nicht (Rate-Limit)')

split = lambda s: [x.strip() for x in (s or '').split(',') if x.strip()]
games = {}
if os.path.exists(cache):
    for line in open(cache, encoding='utf-8'):
        if line.strip():
            g = json.loads(line); games[g['id']] = g
start = max([since] + [g['dt'] for g in games.values()]) if games else since
print('vorhanden', len(games), 'Spiele, hole ab', start, flush=True)

FIELDS = ','.join(['SG.GameId=GameId', 'SG.DateTime_UTC=Dt', 'SG.Patch=Patch', 'SG.Winner=Winner', 'SG.Team1=T1', 'SG.Team2=T2',
                   'SG.Team1Picks=P1', 'SG.Team2Picks=P2', 'SG.Team1Bans=B1', 'SG.Team2Bans=B2', 'SG.Tournament=Tn',
                   'T.League=League', 'T.TournamentLevel=Level', 'T.Region=Region'])
new = 0; cur = start; done = False
try:
    while not done:
        rows = cargo({'tables': 'ScoreboardGames=SG,Tournaments=T', 'join_on': 'SG.OverviewPage=T.OverviewPage',
                      'fields': FIELDS, 'where': f"SG.DateTime_UTC >= '{cur}'", 'order_by': 'SG.DateTime_UTC ASC'})
        added = 0
        for r in rows:
            if not r.get('GameId') or r['GameId'] in games: continue
            lvl = (r.get('Level') or '').strip(); tn = (r.get('Tn') or '')
            p1, p2 = split(r.get('P1')), split(r.get('P2'))
            if lvl == 'Showmatch' or 'All-Star' in tn or 'Showmatch' in tn or len(p1) != 5 or len(p2) != 5: continue
            if str(r.get('Winner')) not in ('1', '2'): continue
            games[r['GameId']] = {'id': r['GameId'], 'dt': r.get('Dt') or '', 'p': r.get('Patch') or '', 'lg': r.get('League') or '',
                                  'lv': lvl, 'rg': r.get('Region') or '', 'tn': tn, 't': [r.get('T1') or '', r.get('T2') or ''],
                                  'b': p1, 'r': p2, 'bb': split(r.get('B1')), 'rb': split(r.get('B2')), 'w': int(r['Winner'])}
            added += 1
        new += added
        last = rows[-1].get('Dt') if rows else None
        print(f'  {len(rows)} Zeilen ab {cur}, neu {added}, gesamt {len(games)}', flush=True)
        if len(rows) < 500 or not last: done = True
        elif last == cur: done = True   # 500 Spiele zur selben Minute gibt es nicht; Schutz gegen Endlosschleife
        else: cur = last
except StopIteration:
    print('Anfrage-Limit erreicht, der Rest folgt beim nächsten Lauf.')

with open(cache + '.tmp', 'w', encoding='utf-8') as f:
    for g in sorted(games.values(), key=lambda g: (g['dt'], g['id'])):
        f.write(json.dumps(g, ensure_ascii=False, separators=(',', ':')) + '\n')
os.replace(cache + '.tmp', cache)

# Prüfen, ob die Picks in Rollen-Reihenfolge (Top, Jungle, Mid, Bot, Support) stehen: Stichprobe gegen ScoreboardPlayers.
if check and games:
    sample = [g for g in sorted(games.values(), key=lambda g: g['dt'])[-40:]]
    ids = "','".join(g['id'].replace("'", "\\'") for g in sample)
    rows = cargo({'tables': 'ScoreboardPlayers=SP', 'fields': 'SP.GameId=GameId,SP.Champion=Champ,SP.IngameRole=Role,SP.Side=Side',
                  'where': f"SP.GameId IN ('{ids}')"})
    order = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']; ok = bad = 0
    by = {}
    for r in rows: by.setdefault(r['GameId'], {})[(str(r['Side']), r['Role'])] = r['Champ']
    for g in sample:
        m = by.get(g['id'])
        if not m: continue
        for side, picks in (('1', g['b']), ('2', g['r'])):
            exp = [m.get((side, ro)) for ro in order]
            if exp == picks: ok += 1
            else:
                bad += 1
                if bad <= 3: print('  abweichend', g['id'], side, picks, exp)
    print('Rollen-Reihenfolge geprüft:', ok, 'passen,', bad, 'abweichend')
print('ok', len(games), 'Spiele', 'neu', new, 'Anfragen', requests)
