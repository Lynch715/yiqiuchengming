/* 关键机会数值模拟（规范 v2 第八节）
   用 index.html 里真实的小游戏判定代码，跳过画面，按"操作质量 × 属性"批量跑每个动作。
   用法：node tools/sim-scenes.cjs [每格次数，默认4000]
   操作质量：差/中/好 = 射门落在精准区、传球线路是绿的、盘带踩在时机窗口里的概率 20%/50%/80% */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const code=html.slice(html.indexOf('const cv='),html.indexOf('/* ============ 赛后'));
const N=+process.argv[2]||4000;
const setup=`const $=id=>els[id]||(els[id]={textContent:'',innerHTML:'',className:'',classList:{add(){},remove(){}},getContext:()=>ctxStub,addEventListener(){},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:480,height:330})});
const els={};const ctxStub=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{}),set:()=>true});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=a=>a[Math.floor(Math.random()*a.length)],ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const g=()=>Math.random()+Math.random()+Math.random()+Math.random()-2;
let PERKS_ON=[];const hasPerk=id=>PERKS_ON.includes(id);
const ATTRS={sho:'射门',dri:'盘带',pac:'速度',pas:'传球',sta:'体能',men:'心理'};
const SITUS=${JSON.stringify(eval('['+html.match(/const SITUS=\[([\s\S]*?)\];/)[1]+']'))};
const FK_SITU=${JSON.stringify(eval('('+html.match(/const FK_SITU=(\{[^;]*\});/)[1]+')'))};
const CRESTS={},GOAL_CALLS=['＄'],COMMS=['x'];let G=null,S,M;const log=()=>{},updBoard=()=>{},runTimer=()=>{},resolveShootout=()=>{},save=()=>{},reduceMotion=()=>false,goalFx=()=>{};
const document={hidden:false},window={devicePixelRatio:1},requestAnimationFrame=()=>{};`;
const sandbox={console};vm.createContext(sandbox);
vm.runInContext(setup+code,sandbox);
vm.runInContext(`
var rngState=12345;Math.random=function(){rngState=rngState+0x6D2B79F5|0;let t=Math.imul(rngState^rngState>>>15,1|rngState);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function setup(attr,traits,tac){
  S={player:{name:'测试',attrs:{sho:attr,pas:attr,dri:attr,pac:attr,men:attr,sta:attr},items:{},perks:[]},mates:['甲','乙','丙','丁','戊'],chem:60,intel:{}};
  M={min:30,fb:0,bFac:1,dFac:1,gk:Math.round(attr*0.9+8),tac:tac||'bal',traits:traits||[],intel:[],opp:{name:'对手'}};
}
function resetM(){Object.assign(M,{shots:0,goals:0,gT:0,gO:0,assists:0,keyp:0,badpass:0,saved:0,missed:0,ev:[],chances:0,seen:{},press:{},run:0,lastT:null,usedTr:[],fakeTried:[],extraE:0,goalLog:[],assistLog:[],scoreLog:[],ch:null,penMode:false})}
const hit=q=>Math.random()<q;
function playShot(q){
  G.phase=1;G.kx=240+95*Math.sin(Math.random()*6.28);
  const far=G.kx<240?[300,392]:[88,180];                 // 会玩的人打门将远端
  G.aimX=hit(q)?far[0]+Math.random()*(far[1]-far[0]):90+Math.random()*300;
  G.aimY=90+Math.random()*150;
  const W=preciseW(),OW=okW();
  G.marker=240+(Math.random()<.5?-1:1)*(hit(q)?Math.random()*W:W+Math.random()*(OW*1.5-W));
  shoot();
}
function findT(ok,pred){for(let i=0;i<400;i++){G.t=Math.random()*2000;if(pred()===ok)return}}
function playPass(q){
  const i=Math.floor(Math.random()*G.mates.length),m=G.mates[i];
  findT(hit(q),()=>laneOpen(m));passClick(m);
}
function playDrib(q){
  const good=hit(q);let side;
  findT(good,()=>Math.abs(dribLean())>=leanThr());
  side=good?-Math.sign(dribLean()):(Math.random()<.5?-1:1);
  dribClick({x:side<0?100:380});
}
function drive(q,backPolicy){
  let guard=0;
  while(G&&guard++<12){
    if(G.mode==='shot'){playShot(q);finishKey()}
    else if(G.mode==='pass'){playPass(q);if(G.res==='12')passShot();else finishPass()}
    else if(G.mode==='drib'){playDrib(q);if(G.res==='win')dribShot();else if(G.res==='foul')dribFK();else finishDrib()}
    else if(G.mode==='scene'){pickAct(backPolicy?backPolicy(G.acts):rnd(G.acts))}
  }
  return {g:M.goals,a:M.assists,lost:M.badpass+(M.ev.some(e=>e.game==='drib'&&e.res==='lose')?1:0),nodes:M.ch?M.ch.node:1};
}
function runAct(sc,a,q,press){
  resetM();if(press)M.press[ACTS[a].t]=press;
  M.ch={scene:sc,node:0,trail:[]};openScene(sc);
  if(!G.acts.includes(a))return null;pickAct(a);return drive(q);
}
function legacy(q){ // 旧版 openKey：随机给传球/盘带/射门
  resetM();M.ch=null;const r=Math.random();
  if(r<0.27)openPass();else if(r<0.52)openDribble();else if(M.tac==='def'&&r<0.75)openShot(SITUS[0]);else openShot();
  return drive(q);
}
function newKey(q){resetM();openKey();return drive(q)}
const BEST={counter:'c_pass',edge:'e_drib',wing:'w_cut'}; // 中属性中操作下各局面最优（见上表）
function newKeyBest(q){resetM();openKey();const b=G.acts.includes('c_run')&&G.scene==='counter'?'c_run':BEST[G.scene];pickAct(b);return drive(q,acts=>BEST.edge)}
`,sandbox);
const R=(f,n)=>{let g=0,a=0,l=0,nd=0;for(let i=0;i<n;i++){const r=f();g+=r.g;a+=r.a;l+=r.lost;nd+=r.nodes}return{g:g/n,a:a/n,ev:(g+a)/n,lost:l/n,nodes:nd/n}};
const run=s=>vm.runInContext(s,sandbox);
const sc={counter:['c_drib','c_pass','c_run'],edge:['e_shot','e_12','e_drib'],wing:['w_cut','w_cross','w_back']};
const Q={差:.2,中:.5,好:.8},ATT=[50,70,90];
const fmt=x=>x.toFixed(3);
let fails=[];
console.log(`每格 ${N} 次。EV = 进球+助攻 / 次机会；丢 = 丢球权率\n`);
for(const at of ATT){
  console.log(`== 属性 ${at}（门将 ${Math.round(at*0.9+8)}） ==`);
  for(const [qn,q] of Object.entries(Q)){
    const row=[];
    for(const [s,acts] of Object.entries(sc)){
      const evs=[];let back=null;
      for(const a of acts){
        run(`setup(${at},[])`);
        const r=R(()=>run(`runAct('${s}','${a}',${q})`)||{g:0,a:0,lost:0,nodes:0},N);
        if(a==='c_run'&&at<75)continue; // 速度不够不出现
        if(a!=='w_back')evs.push([a,r.ev]);else back=r.ev;row.push(`${a} ${fmt(r.ev)}(丢${r.lost.toFixed(2)})`);
      }
      const mx=Math.max(...evs.map(x=>x[1])),mn=Math.min(...evs.map(x=>x[1]));
      if(qn==='中'&&at===70&&mn>0&&mx/mn>1.3)fails.push(`标准1：${s} 中属性中操作（不含回做），最高/最低 = ${(mx/mn).toFixed(2)}`);
      if(s==='wing'&&back!=null&&back>=mx)fails.push(`标准5：属性${at}·${qn}操作 回做是最优`)
    }
    console.log(`  ${qn}：`+row.join('  '));
  }
}
// 标准2：对手特点对应动作的提升
console.log('\n== 对手特点（属性70，中操作） ==');
const fitCases=[['slow','counter','c_drib'],['slow','wing','w_cut'],['press','counter','c_pass'],['press','edge','e_12'],['narrow','wing','w_cross'],['gkhigh','edge','e_shot'],['wing','wing','w_cross']];
for(const [t,s,a] of fitCases){
  run(`setup(70,[])`);const base=R(()=>run(`runAct('${s}','${a}',.5)`),N*3).ev;
  run(`setup(70,['${t}'])`);const fit=R(()=>run(`runAct('${s}','${a}',.5)`),N*3).ev;
  const up=fit/base-1;console.log(`  ${t} → ${a}: ${fmt(base)} → ${fmt(fit)} (${(up*100).toFixed(1)}%)`);
  if(up<0.10||up>0.25)fails.push(`标准2：${t}→${a} 提升 ${(up*100).toFixed(1)}%，不在 10%–25%`);
}
// 标准3：被盯防到 -0.16 的动作应低于同局面其他动作
console.log('\n== 盯防两档（属性70，中操作） ==');
for(const [s,acts] of Object.entries(sc)){
  for(const a of acts){ if(a==='w_back'||a==='c_run')continue;
    run(`setup(70,[])`);const p2=R(()=>run(`runAct('${s}','${a}',.5,2)`),N).ev;
    const others=acts.filter(x=>x!==a&&x!=='c_run').map(x=>{run(`setup(70,[])`);return R(()=>run(`runAct('${s}','${x}',.5)`),N).ev});
    const ok=p2<Math.max(...others);console.log(`  ${a} 盯防后 ${fmt(p2)}，同局面其他最高 ${fmt(Math.max(...others))} ${ok?'':'✗'}`);
    if(!ok)fails.push(`标准3：${a} 被盯防后仍是本局面最优`);
  }
}
// 标准4：整场关键机会产出 vs 旧版。新版按"一半随机、一半选本局面最好的动作"估算真实玩家
console.log('\n== 每次关键机会平均产出：新版（半随机半最优）vs 旧版 ==');
for(const at of ATT)for(const tac of ['bal','atk','def']){
  run(`setup(${at},[],'${tac}')`);const old=R(()=>run(`legacy(.5)`),N).ev;
  run(`setup(${at},[],'${tac}')`);const nr=R(()=>run(`newKey(.5)`),N).ev;
  run(`setup(${at},[],'${tac}')`);const nb=R(()=>run(`newKeyBest(.5)`),N).ev;const nw=(nr+nb)/2;
  const d=nw/old-1;console.log(`  属性${at} ${tac}: 旧 ${fmt(old)} 新 ${fmt(nw)}（随机 ${fmt(nr)} / 最优 ${fmt(nb)}） (${(d*100).toFixed(1)}%)`);
  if(Math.abs(d)>0.15)fails.push(`标准4：属性${at} ${tac} 变化 ${(d*100).toFixed(1)}%`);
}
console.log(fails.length?'\n未通过：\n- '+fails.join('\n- '):'\n五条标准全部通过');
process.exitCode=fails.length?1:0;
