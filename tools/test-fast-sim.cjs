const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const noop=()=>{},els={},storage=new Map(),timers=new Map();let timerSeq=0;
const ctx=new Proxy({},{get:()=>noop});
function el(id){return els[id]||(els[id]={value:'测试球员',textContent:'',innerHTML:'',style:{setProperty:noop},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,appendChild:noop,setAttribute:noop,focus:noop,querySelectorAll:()=>[],getContext:()=>ctx,insertAdjacentHTML(_,s){this.innerHTML+=s;}})}
const sandbox={console,assert,window:{scrollTo:noop,devicePixelRatio:1},document:{body:el('body'),documentElement:el('root'),getElementById:el,querySelector:el,querySelectorAll:()=>[],createElement:()=>el('new'),createElementNS:()=>el('svg')},MutationObserver:class{observe(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},matchMedia:()=>({matches:true}),requestAnimationFrame:noop,setInterval:f=>{timers.set(++timerSeq,f);return timerSeq},clearInterval:id=>timers.delete(id),setTimeout:noop,performance:{now:()=>0}};
vm.createContext(sandbox);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],sandbox);
const run=s=>vm.runInContext(s,sandbox);run(`let seed=832;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};newGame();const baseline=JSON.stringify(S);function reset(){S=JSON.parse(baseline);M=null;G=null;}function begin(){const fx=S.schedule[0];beginMatch({opp:S.teams[fx.opp],oppIdx:fx.opp,home:fx.home,cup:null})}`);
run(`begin();quickSimMatch();assert.equal(S.round,1);assert.equal(S.player.careerApps,1);assert.equal(M.min,90);assert.equal(G,null);assert(M.quickDone&&M.ended);const saved=JSON.stringify(S);quickSimMatch();endMatch();assert.equal(JSON.stringify(S),saved);`);
assert.equal(timers.size,0);
run(`reset();begin();M.min=65;M.gT=2;M.gO=1;M.goals=1;M.shots=1;M.goalLog=[{min:20,how:"射门破门"}];M.scoreLog=[{min:20,me:true}];M.evs=[];M.ei=0;quickSimMatch();assert.equal(M.gT,2);assert.equal(M.gO,1);assert.equal(S.player.goals,1);assert.equal(S.round,1);`);
// Preserve an already determined shot, and continue all possible pending phases.
for(const mode of ['scene','shot0','shot1','shot2','pass0','pass2','drib0','drib2'])run(`reset();begin();M.evs=[];M.ei=0;M.min=40;openKey();
${mode.startsWith('shot')?`openShot();${mode==='shot1'?"G.phase=1;G.aimX=150;G.aimY=120;":mode==='shot2'?"G.phase=2;G.res='goal';G.ball={x:150,y:120};G.kxF=240;M.shots=1;":''}`:mode.startsWith('pass')?`openPass();${mode==='pass2'?"passClick(G.mates[0]);":''}`:mode.startsWith('drib')?`openDribble();${mode==='drib2'?"dribClick({x:100});":''}`:''}
quickSimMatch();assert.equal(S.round,1);assert.equal(G,null);${mode==='shot2'?"assert.equal(M.goals,1);assert.equal(M.shots,1);":''}`);
// Club knockout draw and national knockout draw: real settlement and penalty resolution.
run(`reset();S.cupQ=[{comp:'fa'}];beginMatch({opp:S.teams[1],home:true,cup:null,club:'fa'});M.evs=[];quickSimMatch();assert(M.quickDone);assert(!M.penMode);assert.equal(M.shots,0);assert.equal(S.cupQ.length,0);assert.equal(S.player.careerApps,1);`);
run(`reset();S.cup={type:'wc',ko:0,goals:0,ratings:[],rec:[],pts:0,idx:0};beginMatch({opp:S.teams[1],home:true,cup:'wc'});M.evs=[];quickSimMatch();assert(M.quickDone);assert(!M.penMode);assert.equal(S.player.caps,1);assert.equal(M.shots,0);`);
run(`reset();S.cupQ=[{comp:'fa'}];beginMatch({opp:S.teams[1],home:true,cup:null,club:'fa'});M.min=90;clearInterval(M.timer);M.timer=null;endMatch();assert(M.penMode);quickSimMatch();assert(!M.penMode);assert.equal(S.player.careerApps,1);`);
// Group stages and national friendlies also settle exactly once.
run(`reset();S.cupQ=[{comp:'nt'}];beginMatch({opp:S.teams[1],home:false,cup:'ntm'});quickSimMatch();assert.equal(S.cupQ.length,0);assert.equal(S.player.caps,1);assert.equal(S.round,0);`);
run(`reset();S.cup={type:'asia',ko:-1,goals:0,ratings:[],rec:[],pts:0,idx:0};beginMatch({opp:S.teams[1],home:true,cup:'asia'});quickSimMatch();assert.equal(S.cup.idx,1);assert.equal(S.player.caps,1);assert(!M.penMode);`);
run(`reset();S.cupQ=[{comp:'acl'}];S.aclActive=true;S.aclGroup={idx:0,pts:0,rec:[],opps:[S.teams[1],S.teams[2],S.teams[3]]};beginMatch({opp:S.teams[1],home:true,cup:null,club:'acl'});quickSimMatch();assert.equal(S.aclGroup.idx,1);assert.equal(S.player.careerApps,1);assert.equal(S.round,0);`);
// No phantom assist before a substitute enters.
run(`reset();begin();M.bench=true;M.min=20;handleEvent({t:'tg'});assert.equal(M.assists,0);clearInterval(M.timer);`);
run(`const p={form:50,energy:100};assert(matchSimRates(90,{str:50},'bal',p).team>matchSimRates(50,{str:90},'bal',p).team);assert(matchSimRates(65,{str:65},'bal',{form:90,energy:100}).team>matchSimRates(65,{str:65},'bal',{form:10,energy:25}).team);reset();begin();const q=autoPlayQuality();M.min=85;S.player.energy=25;S.player.form=10;assert(autoPlayQuality()<q);clearInterval(M.timer);`);
// Complete league season with production settlement, avoid unrelated injury/cup UI.
run(`reset();for(let i=0;i<S.rounds;i++){S.player.injury=0;S.player.energy=85;const fx=S.schedule[S.round];beginMatch({opp:S.teams[fx.opp],oppIdx:fx.opp,home:fx.home,cup:null});quickSimMatch();assert.equal(S.round,i+1);assert.equal(M.shots,M.goals+M.saved+M.missed);assert(Number.isFinite(S.player.tp));}assert.equal(S.player.apps,S.rounds);assert.equal(S.table[0].P,S.rounds);`);
assert.equal(timers.size,0);
console.log('PASS: league, partial score, pending scenes/shots/passes/dribbles, club/national penalties, existing shootout, duplicate clicks, bench assists, state/strength/fatigue effects, full league season, no timers left.');
