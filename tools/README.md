# 数据生成工具（tools/）

`index.html` 里的 `LEAGUES/ACL_POOL/UCL_POOL/NT_*` 与 `CRESTS`（base64 队徽）由这两个脚本生成：

- `clubs.py`：13 个联赛的球队、实力、真实球员、教练；队徽来源标注（fc:=FCLOGO 仓库目录名，lh:/lhh:=luukhopman/football-logos，scr:=milosmladenovic5/football_clubs_logo_scraper）。
- `build_data.py`：把队徽裁成 40px WebP、算主色，输出 `data.js` 与 `crests.js`。

重建步骤（在能 clone GitHub 的机器上）：
1. `git clone --depth 1 --filter=blob:none --sparse https://github.com/FCLOGO/fclogo.top`，`git sparse-checkout set src/data/logos/{CFA,theFA,RFEF,FIGC,DFB,FFF,JFA,KFA,SAFF,FA,FAT,FAM,UAE}`
2. `git clone --depth 1 --filter=blob:none https://github.com/luukhopman/football-logos fl`（取 logos/ 与 history/）
3. `git clone --depth 1 --filter=blob:none --no-checkout https://github.com/milosmladenovic5/football_clubs_logo_scraper scr`
4. 用 build_data.py 顶部的索引逻辑生成 index.json，再运行 `python3 build_data.py`
5. 把 data.js 内容替换 index.html 中 `const LEAGUES=` … `const NT_WORLD=` 段，crests.js 替换第一个 `<script>` 块。

改球队/球员只需改 `clubs.py` 再重跑。
