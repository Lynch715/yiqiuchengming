const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const html = fs.readFileSync(process.env.YQCM_TEST_HTML || path.join(__dirname, '../index.html'), 'utf8');
const noop = () => {};

function browser({ iconError = false, readError = false, writeError = false, observerError = false } = {}) {
  const elements = {}, storage = new Map(), timers = new Map(), observers = [];
  let timerSeq = 0;
  const ctx = new Proxy({}, { get: () => noop });
  function el(id) {
    if (elements[id]) return elements[id];
    const classes = new Set(id === 'scStart' ? ['on'] : []);
    return elements[id] = {
      id, value: '启动回归球员', textContent: '', innerHTML: '', hidden: true,
      ownerDocument: {}, style: { setProperty: noop },
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: noop },
      addEventListener: noop, appendChild: noop, setAttribute: noop, focus: noop,
      querySelectorAll: () => [], getContext: () => ctx,
      insertAdjacentHTML(_, s) { this.innerHTML += s; }
    };
  }
  const document = {
    body: el('body'), documentElement: el('root'), getElementById: el,
    querySelector: selector => selector === 'section.on' ? Object.values(elements).find(e => e.classList.contains('on')) : el(selector),
    querySelectorAll: () => ['scStart', 'scHome', 'scTrain', 'scMatch', 'scResult'].map(el),
    createElement: () => el('new'), createElementNS: () => el('svg'),
    createTreeWalker() { if (iconError) throw new Error('embedded browser icon failure'); return { nextNode: () => null }; }
  };
  const sandbox = {
    console: { log: noop, warn: noop, error: noop }, assert, document, NodeFilter: { SHOW_TEXT: 4 },
    window: { scrollTo: noop, devicePixelRatio: 1 },
    MutationObserver: class {
      constructor(callback) { if (observerError) throw new Error('observer unavailable'); observers.push(callback); }
      observe() {}
    },
    localStorage: {
      getItem(k) { if (readError) throw new Error('SecurityError'); return storage.get(k) || null; },
      setItem(k, v) { if (writeError) throw new Error('QuotaExceededError'); storage.set(k, v); },
      removeItem: k => storage.delete(k)
    },
    navigator: {}, matchMedia: () => ({ matches: true }), requestAnimationFrame: noop,
    setInterval(f) { timers.set(++timerSeq, f); return timerSeq; }, clearInterval: id => timers.delete(id),
    setTimeout: noop, performance: { now: () => 0 }
  };
  vm.createContext(sandbox);
  const run = source => vm.runInContext(source, sandbox);
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) run(m[1]);
  return { run, storage, el, timers, observers };
}

for (const failure of [{ iconError: true }, { observerError: true }, { readError: true }, { writeError: true }, { iconError: true, readError: true, writeError: true }]) {
  const b = browser(failure);
  b.run("openSlots('load')");
  assert(!b.el('evOverlay').classList.contains('hidden'), 'load dialog must open');
  b.run('hideEv(); newGame()');
  assert(b.el('scHome').classList.contains('on'), 'new career must reach home');
  assert.equal(b.run('S.player.name'), '启动回归球员');
  if (failure.readError || failure.writeError) {
    assert(!b.el('storageStatus').hidden, 'storage failure must be visible');
    assert(!b.storage.has('yqcm1'), 'inaccessible storage must never be overwritten');
  }
  else assert(b.storage.has('yqcm1'));
}

const b = browser();
b.run('newGame(); saveSlot(0)');
const manual = b.storage.get('yqcm_s1');
b.run('S.player.money=123; save()');
b.run("loadSlot('yqcm_s1')");
assert.equal(b.run('S.player.money'), 5);
assert.equal(b.storage.get('yqcm_s1'), manual, 'manual slot must not be rewritten on load');
const loaded = b.storage.get('yqcm1');
const state = b.run('JSON.stringify(S)');

// Invalid data cannot replace an active career or its valid autosave.
for (const broken of ['{broken json', 'null', '{}', '{"player":{}}', '{"player":{"attrs":{},"honors":[],"ratings":[]},"lg":"unknown"}', JSON.stringify({ ...JSON.parse(manual), teams: [null, null] })]) {
  b.storage.set('yqcm_s2', broken);
  b.run("loadSlot('yqcm_s2')");
  assert.equal(b.run('JSON.stringify(S)'), state);
  assert.equal(b.storage.get('yqcm1'), loaded);
  assert.equal(b.storage.get('yqcm_s2'), broken);
  assert(b.el('evText').textContent.includes('无法读取'));
  b.run("openSlots('load')");
  assert(b.el('evBtns').innerHTML.includes("loadSlot('yqcm_s2')"), 'invalid save must stay accessible');
}

// Existing saves with fields from older versions missing still migrate in memory.
const old = JSON.parse(manual);
for (const key of ['energy', 'scout', 'money', 'injury', 'love', 'perks', 'ach', 'history', 'form', 'caps', 'style', 'album', 'albumKeys']) delete old.player[key];
delete old.tactic; delete old.chem; delete old.intel;
b.storage.set('yqcm_s3', JSON.stringify(old));
b.run("loadSlot('yqcm_s3')");
assert.equal(b.run('S.player.name'), old.player.name);
assert.equal(b.run('S.player.energy'), 100);
assert.equal(b.run('S.player.money'), 5);
assert.equal(b.storage.get('yqcm_s3'), JSON.stringify(old));
assert(b.el('scHome').classList.contains('on'));

const oldest = JSON.parse(manual);
delete oldest.lg; oldest.tier = 3;
b.storage.set('yqcm_s3', JSON.stringify(oldest));
b.run("loadSlot('yqcm_s3')");
assert.equal(b.run('S.lg'), 'cn3');
assert.equal(b.run('S.player.name'), oldest.player.name);
assert.equal(b.storage.get('yqcm_s3'), JSON.stringify(oldest));

// Failed manual writes must never show a successful-save message.
const quota = browser({ writeError: true });
quota.run('newGame(); saveSlot(0)');
assert(!quota.storage.has('yqcm_s1'));
assert(!quota.el('evText').textContent.includes('已保存'));
assert(!quota.el('storageStatus').hidden);

if (process.argv[2] === '--fixtures') {
  const dir = process.argv[3]; fs.mkdirSync(dir, { recursive: true });
  const fixtures = {
    'blocked-storage': "Object.defineProperty(window,'localStorage',{get(){throw new Error('SecurityError')}});document.createTreeWalker=()=>{throw new Error('embedded browser icon failure')};",
    'legacy-save': `localStorage.setItem('yqcm_s1',${JSON.stringify(JSON.stringify(old))});localStorage.setItem('yqcm_s2','{broken json');`,
    'no-icons': "document.createTreeWalker=()=>{throw new Error('embedded browser icon failure')};"
  };
  for (const [name, script] of Object.entries(fixtures)) fs.writeFileSync(path.join(dir, name + '.html'), html.replace('<script>', `<script>${script}</script>\n<script>`));
  for (const file of ['icon-180.png', 'icon-512.png', 'manifest.json']) fs.copyFileSync(path.join(__dirname, '..', file), path.join(dir, file));
}
console.log('PASS: startup with icon/observer/storage failures, visible storage warnings, manual save/load, invalid-save preservation, legacy migration, no false save success.');
