# 数据工具（tools/）

## 真实名单（2026-10 起）

- `rosters/<联赛>.json`：13 个联赛（cn1/cn2/cn3、en/es/it/de/fr 的 1、2 级）每队一线队名单 `[中文名, 位置G/D/M/F]`、主教练、中乙分组。来源：英文维基各俱乐部 "Current squad"，抓取时间 2026-10-07。
- `rosters/pools.json`：欧冠、亚冠里不属于这 13 个联赛的球队，每队 6 人（门将、2 后卫、3 前锋）。
- `rosters/nt.json`：中国队全名单 + 其余国家队每队 6 人。
- `rosters/new_crests.json`：本次新补的队徽（40px WebP）。
- `build_rosters.py`：把上面这些合并进 `index.html` 的 `LEAGUES / ACL_POOL / UCL_POOL / NT_* / CN_SQUAD / CRESTS`。保留原有实力值、颜色和联赛参数。

更新名单：改 rosters/*.json → `python3 tools/build_rosters.py`。

注意：
- 中国球员的汉字是按维基拼音推断的，发现写错直接改 json 里那个名字再重建。
- 英冠只保留 20 队（不收博尔顿、卡迪夫城、林肯城、查尔顿），西乙不收两支预备队。

## 旧流程（队徽、联赛骨架）

- `clubs.py` / `build_data.py`：最早生成 LEAGUES 与 CRESTS 的脚本，需要先 clone FCLOGO、luukhopman/football-logos、football_clubs_logo_scraper（见脚本顶部）。现在球队名单以 rosters/ 为准，clubs.py 里的球队和球员已过时，只在重建全部队徽时才用。
