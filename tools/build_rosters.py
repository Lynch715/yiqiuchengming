# -*- coding: utf-8 -*-
"""把 tools/rosters/*.json（真实一线队名单、主教练）合并进 index.html 的球队数据。

用法：python3 tools/build_rosters.py
- 以 index.html 现有的 LEAGUES / ACL_POOL / UCL_POOL / NT_ASIA / NT_WORLD 为底（保留实力、颜色、联赛参数）。
- 每个联赛的球队名单按 rosters/<联赛>.json 的真实名单替换；新进联赛的球队补实力和颜色。
- 球员写成 [中文名, 位置]，位置 G/D/M/F；主教练写进 coach；中乙每队带 g（A/B 组）。
- rosters/new_crests.json 里的新队徽并进 CRESTS。
- 以后要更新名单：改 rosters/*.json 后重跑本脚本。
"""
import json, re, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(ROOT, '..', 'index.html')
R = os.path.join(ROOT, 'rosters')
h = open(HTML, encoding='utf-8').read()

def grab(name):
    m = re.search(r'^const ' + name + r'=(.*?);\n', h, re.M)
    return json.loads(m.group(1)), m
L, mL = grab('LEAGUES')
ACL, _ = grab('ACL_POOL'); UCL, _ = grab('UCL_POOL'); NTA, _ = grab('NT_ASIA'); NTW, _ = grab('NT_WORLD')
mc = re.search(r'const CRESTS=(\{.*?\});', h, re.S)
CRESTS = json.loads(mc.group(1))
NEWC = json.load(open(os.path.join(R, 'new_crests.json'), encoding='utf-8'))
for n, v in NEWC.items(): CRESTS[n] = v['uri']

old = {}  # 旧数据里所有球队：名字 → 球队对象（用来沿用实力和颜色）
for lid, lg in L.items():
    for t in lg['teams']: old.setdefault(t['n'], dict(t, lg=lid))
for t in ACL + UCL: old.setdefault(t['n'], t)
ALIAS = {'宁波': '上海嘉定汇龙'}             # 改名迁址：沿用旧俱乐部的实力
DROP = {'en2': ['博尔顿', '卡迪夫城', '林肯城', '查尔顿'],   # 英冠 24 队，游戏保留 20 队：去掉本赛季新升上来的和末位
        'es2': ['塞尔塔B', '皇家社会B']}                    # 西乙 22 队：两支预备队不能升级，不进游戏

def players(t):
    seen, out = set(), []
    for n, pos in t['players']:
        n = n.strip()
        if not n or n in seen: continue
        seen.add(n); out.append([n, pos if pos in 'GDMF' else 'M'])
    return out

def colors(name):
    if name in NEWC: return NEWC[name]['c1'], NEWC[name]['c2']
    base = re.sub(r'B$', '', name)
    if base in old: return old[base]['c1'], old[base]['c2']
    return '#8a8f98', '#5c6169'

report = []
for lid, lg in L.items():
    src = json.load(open(os.path.join(R, lid + '.json'), encoding='utf-8'))
    smax = max(t['s'] for t in lg['teams'])
    teams = []
    for t in src['teams']:
        if t['zh'] in DROP.get(lid, []): continue
        o = old.get(t['zh']) or old.get(ALIAS.get(t['zh'], ''))
        if o and o.get('lg') == lid: s = o['s']
        elif o:   # 从别的级别来的：按新联赛的区间压一下
            s = min(max(o['s'], lg['base'] + 1), smax + 1)
        else:
            s = lg['base'] + (0 if t['zh'].endswith('B') else 2)
        c1, c2 = (o['c1'], o['c2']) if o and o['n'] == t['zh'] and o['c1'] != '#8a8f98' else colors(t['zh'])
        team = {'n': t['zh'], 's': s, 'c1': c1, 'c2': c2, 'p': players(t), 'coach': t.get('coach', '')}
        if lid == 'cn3': team['g'] = t.get('group') or 'A'
        teams.append(team)
    lg['teams'] = teams
    report.append(f"{lid} {lg['name']}: {len(teams)}队 {sum(len(t['p']) for t in teams)}人" +
                  (f" 无名单:{[t['n'] for t in teams if len(t['p'])<11]}" if any(len(t['p'])<11 for t in teams) else ''))

pools = {t['zh']: t for t in json.load(open(os.path.join(R, 'pools.json'), encoding='utf-8'))['teams']}
for t in ACL + UCL:
    if t['n'] in pools:
        t['p'] = players(pools[t['n']]); t['coach'] = pools[t['n']].get('coach', '')
    else:   # 欧冠池里来自五大联赛的球队：用联赛里的名单
        for lg in L.values():
            for x in lg['teams']:
                if x['n'] == t['n']: t['p'] = x['p']; t['coach'] = x['coach']
nt = {t['zh']: t for t in json.load(open(os.path.join(R, 'nt.json'), encoding='utf-8'))['teams']}
for t in NTA + NTW:
    if t['n'] in nt: t['p'] = players(nt[t['n']]); t['coach'] = nt[t['n']].get('coach', '')
CN = nt['中国']
CN_NT = {'p': players(CN), 'coach': CN.get('coach', '')}

def dump(x): return json.dumps(x, ensure_ascii=False, separators=(',', ':'))
out = h
for name, val in [('LEAGUES', L), ('ACL_POOL', ACL), ('UCL_POOL', UCL), ('NT_ASIA', NTA), ('NT_WORLD', NTW)]:
    out = re.sub(r'^const ' + name + r'=.*?;\n', lambda m: 'const ' + name + '=' + dump(val) + ';\n', out, count=1, flags=re.M)
if re.search(r'^const CN_SQUAD=', out, re.M):
    out = re.sub(r'^const CN_SQUAD=.*?;\n', lambda m: 'const CN_SQUAD=' + dump(CN_NT) + ';\n', out, count=1, flags=re.M)
else:
    out = out.replace('const NT_WORLD=', 'const CN_SQUAD=' + dump(CN_NT) + ';\nconst NT_WORLD=', 1)
out = out.replace(mc.group(0), 'const CRESTS=' + dump(CRESTS) + ';', 1)
open(HTML, 'w', encoding='utf-8').write(out)
print('\n'.join(report))
print('CRESTS', len(CRESTS), '中国队', len(CN_NT['p']), '人')
all_teams = [t['n'] for lg in L.values() for t in lg['teams']]
nocrest = [n for n in all_teams if n not in CRESTS and re.sub(r'B$', '', n) not in CRESTS]
print('仍无队徽', len(nocrest), nocrest)
