# -*- coding: utf-8 -*-
import json, base64, io, os, glob, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import clubs

ROOT = os.path.dirname(os.path.abspath(__file__))
idx = json.load(open(ROOT + '/index.json'))
fc_by_dir = {}
for r in idx:
    d = r['png'].split('/')[-3]
    fc_by_dir[d] = ROOT + '/fclogo.top/' + r['png']

def resolve(spec):
    if not spec: return None
    kind, path = spec.split(':', 1)
    if kind == 'fc':
        p = fc_by_dir.get(path)
        if not p:
            cands = [k for k in fc_by_dir if k.endswith(path) or path in k]
            p = fc_by_dir[cands[0]] if cands else None
    elif kind == 'lh': p = ROOT + '/fl/logos/' + path
    elif kind == 'lhh': p = ROOT + '/fl/history/' + path
    elif kind == 'scr':
        p = ROOT + '/scr/' + path
        if not os.path.exists(p):
            os.system(f'cd "{ROOT}/scr" && git checkout -q HEAD -- "{path}" 2>/dev/null')
    elif kind == 'tl': p = ROOT + '/team-logos/' + path
    elif kind == 'sl': p = ROOT + '/football.db.logos/' + path
    if not p or not os.path.exists(p):
        print('MISSING', spec, file=sys.stderr); return None
    return p

SIZE = 40
def encode(p):
    im = Image.open(p).convert('RGBA')
    # 裁掉透明边
    bbox = im.getbbox()
    if bbox: im = im.crop(bbox)
    w, h = im.size
    s = SIZE / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.size[0]) // 2, (SIZE - im.size[1]) // 2))
    buf = io.BytesIO(); canvas.save(buf, 'WEBP', quality=72, method=6)
    data = buf.getvalue()
    # 主色（忽略透明与近白）
    small = canvas.resize((16, 16))
    px = [(r, g, b) for r, g, b, a in small.getdata() if a > 128 and not (r > 235 and g > 235 and b > 235)]
    if px:
        from collections import Counter
        q = Counter((r // 40 * 40, g // 40 * 40, b // 40 * 40) for r, g, b in px)
        top = [c for c, _ in q.most_common(2)]
        c1 = '#%02x%02x%02x' % tuple(min(255, v + 20) for v in top[0])
        c2 = '#%02x%02x%02x' % tuple(max(0, v - 10) for v in (top[1] if len(top) > 1 else top[0]))
    else:
        c1, c2 = '#888', '#555'
    return 'data:image/webp;base64,' + base64.b64encode(data).decode(), c1, c2

crests = {}; colors = {}
def add(name, spec):
    if name in crests or not spec: return
    p = resolve(spec)
    if not p: return
    try:
        uri, c1, c2 = encode(p)
    except Exception as e:
        print('ERR', name, e, file=sys.stderr); return
    crests[name] = uri; colors[name] = (c1, c2)

out = {}
for lid, lg in clubs.LEAGUES.items():
    teams = []
    for t in lg['teams']:
        name, spec, s = t[0], t[1], t[2]
        players = t[3] if len(t) > 3 else []
        add(name, spec)
        c = colors.get(name, ('#8a8f98', '#5c6169'))
        teams.append({'n': name, 's': s, 'c1': c[0], 'c2': c[1], 'p': players})
    out[lid] = {k: lg[k] for k in ('id', 'name', 'country', 'level', 'base', 'tf', 'wage', 'cup', 'mates', 'coaches', 'cont')}
    out[lid]['teams'] = teams

def pool(lst):
    res = []
    for name, spec, s in lst:
        add(name, spec)
        c = colors.get(name, ('#6f5f8a', '#4a4060'))
        res.append({'n': name, 's': s, 'c1': c[0], 'c2': c[1]})
    return res
ACL = pool(clubs.ACL_POOL); UCL = pool(clubs.UCL_POOL)
ENG = '🏴' + ''.join(chr(0xE0067 + o) for o in [0, 0x62 - 0x67, 0x65 - 0x67, 0x6E - 0x67, 0x67 - 0x67, 0x7F - 0x67])
NTA = [{'n': n, 'f': f, 's': s} for n, f, s in clubs.NT_ASIA]
NTW = [{'n': n, 'f': (ENG if n == '英格兰' else f), 's': s} for n, f, s in clubs.NT_WORLD]

js = ('const LEAGUES=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n' +
      'const ACL_POOL=' + json.dumps(ACL, ensure_ascii=False, separators=(',', ':')) + ';\n' +
      'const UCL_POOL=' + json.dumps(UCL, ensure_ascii=False, separators=(',', ':')) + ';\n' +
      'const NT_ASIA=' + json.dumps(NTA, ensure_ascii=False, separators=(',', ':')) + ';\n' +
      'const NT_WORLD=' + json.dumps(NTW, ensure_ascii=False, separators=(',', ':')) + ';\n')
crest_js = 'const CRESTS=' + json.dumps(crests, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(ROOT + '/data.js', 'w').write(js)
open(ROOT + '/crests.js', 'w').write(crest_js)
n = sum(len(l['teams']) for l in out.values())
print('teams', n, 'crests', len(crests), 'data.js', len(js.encode()), 'crests.js', len(crest_js.encode()))
