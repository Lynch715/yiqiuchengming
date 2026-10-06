const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const code=html.slice(html.indexOf('const cv='),html.indexOf('/* ============ 赛后'));
const setup=`const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=a=>a[0],ri=(a,b)=>a,shuffle=a=>a.slice(),hasPerk=()=>false;let g=()=>0;let G=null;let S={player:{name:'测试球员',attrs:{sho:75,pas:75,dri:75,pac:75,men:75,sta:75}},mates:['队友甲','队友乙','队友丙'],chem:70};let M={min:30,fb:0,bFac:1,dFac:1,gk:70,shots:0};const SITUS=[{id:'normal',name:'禁区射门',bspd:5,kspd:.03,spread:1,reach:1}],FK_SITU={...SITUS[0],id:'fk'};const log=()=>{},updBoard=()=>{},runTimer=()=>{},resolveShootout=()=>{};`;
const noop=()=>{};const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const elements={};const el=id=>elements[id]||(elements[id]={getContext:()=>ctx,addEventListener:noop,focus:noop,classList:{add:noop,remove:noop},getBoundingClientRect:()=>({left:0,top:0,width:240,height:165})});
const sandbox={document:{hidden:false,getElementById:el},window:{devicePixelRatio:2},requestAnimationFrame:noop,console,assert};vm.createContext(sandbox);vm.runInContext(setup+code,sandbox);
vm.runInContext(`
openShot();assert.equal(cv.width,960);assert.equal(cvPos({clientX:120,clientY:82.5}).x,240);
G.phase=1;G.marker=240;G.aimX=180;G.aimY=270;shoot();assert.equal(G.res,'miss');const shots=M.shots;shoot();assert.equal(M.shots,shots);
for(const result of ['goal','save','wow','miss','block']){openShot(FK_SITU);G.phase=2;G.res=result;G.ball={x:150,y:110};G.kxF=240;for(let f=0;f<100;f++){G.anim=f;drawG()}G.anim=G.animLen+26;loopG(LOOP,100);assert(G.shown)}
for(const result of ['cut','agoal','akey','12']){openPass();passClick(G.mates[0]);G.res=result;const dx=defX(G.mates[0]);G.t+=100;assert.equal(dx,defX(G.mates[0]));for(let f=0;f<80;f++){G.anim=f;drawP()}loopG(LOOP,100);assert(G.shown)}
for(const result of ['win','foul','lose']){openDribble();const lean=dribLean();dribClick({x:100});assert.equal(G.releaseLean,lean);G.res=result;for(let f=0;f<70;f++){G.anim=f;drawD()}loopG(LOOP,100);assert(G.shown)}
const positions=[];
for(const hz of [30,60,120,240]){openShot();G.t=0;G.last=0;for(let n=0;n<=hz;n++)loopG(LOOP,100+n*1000/hz);positions.push(G.t)}
assert(positions.every(t=>Math.abs(t-60)<.02));
openPass();G.last=100;const before=G.t;document.hidden=true;loopG(LOOP,5000);assert.equal(G.t,before);document.hidden=false;loopG(LOOP,6000);assert.equal(G.t,before);
console.log('PASS: 30/60/120/240Hz timing, hidden-tab pause,');
console.log('PASS: inline syntax, DPR coordinates, below-goal miss, double-shot guard, 12 animation branches, release snapshots and result completion');
`,sandbox);
if(process.argv.includes('--preview'))fs.writeFileSync('tools/minigame-preview.html',`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${html.match(/<style>([\s\S]*?)<\/style>/)[1]}#overlay{position:relative;background:none;padding:12px}.preview{padding:12px;text-align:center}</style><div class="preview">动画验收 · 独立测试数据，不读取或写入存档<br><button onclick="openShot()">射门</button><button onclick="openPass()">传球</button><button onclick="openDribble()">盘带</button><button onclick="openShot(FK_SITU)">任意球</button></div><div id="overlay"><div class="gamebox"><h3 id="gTitle"></h3><div class="hint" id="gHint"></div><canvas id="cv" tabindex="0" width="480" height="330"></canvas><div id="gBtns"></div></div></div><script>${setup+code}\nopenDribble();</script>`);
