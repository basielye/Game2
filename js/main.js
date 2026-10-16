/* Game controller: save data, home/glasshouse flow, tasks, choices, levels, herbarium. */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const SAVE_KEY = 'leafscapes_save_v1';
  const BOOSTERS = {
    dragonfly: { name: 'Dragonfly', sprite: 'h', price: 250 },
    bomb: { name: 'Seed Bomb', sprite: 'bomb', price: 300 },
    rainbow: { name: 'Prism Dahlia', sprite: 'rainbow', price: 450 }
  };
  const STAGES = ['Cutting', 'Juvenile', 'Established', 'Mature'];

  /* ───────────── Save data ───────────── */
  const fresh = () => ({
    level: 1, stars: 0, coins: 400, zone: 'palm', unlocked: ['palm'],
    boosters: { dragonfly: 1, bomb: 1, rainbow: 0, trowel: 3, rake: 2 },
    zones: Object.fromEntries(ZONES.map(z => [z.id, { done: [], fixtures: {}, choices: {}, pots: {}, grows: 0, complete: false }])),
    found: [], introSeen: false, settings: { sound: true, music: true }
  });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { S = fresh(); }
  for (const z of ZONES) if (!S.zones[z.id]) S.zones[z.id] = fresh().zones[z.id];
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } };
  Sfx.setSound(S.settings.sound); Sfx.setMusic(S.settings.music);

  /* ───────────── Helpers ───────────── */
  const zone = () => ZONE_BY_ID[S.zone];
  const zst = (id = S.zone) => S.zones[id];
  function nextTasks(z = zone()) {
    const done = zst(z.id).done;
    return z.tasks.filter(t => !done.includes(t.id)).slice(0, 2);
  }
  function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
  function updateHud(bump) {
    $('#starCount').textContent = S.stars; $('#coinCount').textContent = S.coins;
    if (bump) { const el = $(bump); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    const lv = Levels.get(S.level);
    $('#playLevel').textContent = S.level;
    $('#btnPlay').className = 'big-btn play' + (lv.hard === 2 ? ' superhard' : lv.hard === 1 ? ' hard' : '');
    const affordable = nextTasks().filter(t => t.cost <= S.stars).length;
    $('#taskBadge').textContent = affordable || '';
    $('#herbCount').textContent = S.found.length;
    const z = zone(), st = zst();
    $('#zoneName').textContent = z.name; $('#zoneSub').textContent = z.sub;
    $('#zoneProg').style.width = (st.done.length / z.tasks.length * 100) + '%';
    const i = ZONES.indexOf(z);
    $('#zonePrev').disabled = i === 0;
    $('#zoneNext').disabled = !(ZONES[i + 1] && S.unlocked.includes(ZONES[i + 1].id));
  }
  function renderScene(opts = {}) {
    const st = opts.state || zst();
    $('#scene').innerHTML = Scene.render(zone(), st, opts);
    $$('#scene .slot').forEach(g => g.addEventListener('click', () => onSlot(g.dataset.slot)));
  }
  function sceneToScreen(x, y) {
    const svg = $('#scene svg'); if (!svg) return [innerWidth / 2, innerHeight / 2];
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const p = pt.matrixTransform(svg.getScreenCTM()); return [p.x, p.y];
  }
  function sparkle(x, y, n = 18) {
    const b = document.createElement('div'); b.className = 'sparkle-burst'; b.style.left = x + 'px'; b.style.top = y + 'px';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90, e = document.createElement('i');
      e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', Math.sin(a) * d + 'px');
      e.style.animationDelay = Math.random() * .2 + 's'; b.appendChild(e);
    }
    document.body.appendChild(b); setTimeout(() => b.remove(), 1500);
  }
  function scrollSceneTo(x) {
    const wrap = $('#sceneWrap'), w = $('#scene').clientWidth;
    wrap.scrollTo({ left: x / Scene.W * w - wrap.clientWidth / 2, behavior: 'smooth' });
  }

  /* ───────────── Modal / sheet / dialogue ───────────── */
  function modal(html, cls = '') {
    const card = $('#modalCard'); card.className = 'card ' + cls; card.innerHTML = html;
    $('#modal').classList.add('open'); return card;
  }
  const closeModal = () => $('#modal').classList.remove('open');
  function sheet(html) { $('#sheetInner').innerHTML = html; $('#sheet').classList.add('open'); return $('#sheetInner'); }
  const closeSheet = () => $('#sheet').classList.remove('open');
  let dialogResolve = null;
  function say(lines) {
    if (!Array.isArray(lines)) lines = [lines];
    return lines.reduce((p, line) => p.then(() => new Promise(res => {
      $('#dialogText').textContent = line; $('#dialog').classList.add('open'); dialogResolve = res;
    })), Promise.resolve()).then(() => $('#dialog').classList.remove('open'));
  }
  $('#portrait').innerHTML = Portrait;
  $('#dialog').addEventListener('click', () => { Sfx.tap(); const r = dialogResolve; dialogResolve = null; r && r(); });

  /* ───────────── Home ───────────── */
  function goHome() {
    show('home'); updateHud(); renderScene();
  }
  $('#zonePrev').onclick = () => { const i = ZONES.indexOf(zone()); if (i > 0) { S.zone = ZONES[i - 1].id; save(); goHome(); } };
  $('#zoneNext').onclick = () => { const i = ZONES.indexOf(zone()); const n = ZONES[i + 1]; if (n && S.unlocked.includes(n.id)) { S.zone = n.id; save(); goHome(); } };
  $('#btnTasks').onclick = () => { Sfx.init(); Sfx.tap(); openTasks(); };
  $('#btnPlay').onclick = () => { Sfx.init(); Sfx.tap(); levelIntro(); };
  $('#btnHerb').onclick = () => { Sfx.init(); Sfx.tap(); openHerbarium(); };
  $('#btnSettings').onclick = () => { Sfx.init(); openSettings(); };
  $('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

  const TASK_ICONS = { fixture: '🛠', plant: '🌱', pot: '🏺', grow: '💧' };
  function openTasks() {
    const z = zone(), st = zst();
    if (st.complete) {
      const next = ZONES[ZONES.indexOf(z) + 1];
      sheet(`<button class="round close-x" data-close>✕</button><h3>${z.name} is restored!</h3><p class="choice-note">${next ? 'Head to the next room using the arrows at the top.' : 'Every room of the glasshouse is alive again. Keep playing to collect every plant for the Herbarium!'}</p>
        <div class="sheet-actions">${next ? `<button class="btn" id="goNext">Visit ${next.name}</button>` : ''}</div>`);
      const g = $('#goNext'); if (g) g.onclick = () => { closeSheet(); S.zone = next.id; save(); goHome(); };
      return;
    }
    const list = nextTasks(z);
    let h = `<button class="round close-x" data-close>✕</button><h3>Restoration tasks</h3>`;
    h += list.map(t => `<div class="task"><div class="t-ico">${TASK_ICONS[t.kind]}</div><div class="t-txt">${t.title}<small>${z.name}</small></div>
      <button class="btn ${t.cost > S.stars ? 'cant' : 'gold'}" data-task="${t.id}">★ ${t.cost}</button></div>`).join('');
    h += `<p class="choice-note" style="text-align:center">Complete levels to earn ★ stars.</p>`;
    const el = sheet(h);
    el.querySelectorAll('[data-task]').forEach(b => b.onclick = () => {
      const t = z.tasks.find(x => x.id === b.dataset.task);
      if (t.cost > S.stars) { closeSheet(); say(`We need ${t.cost - S.stars} more ★ for that. Let’s play a level!`).then(levelIntro); return; }
      closeSheet(); runTask(t);
    });
  }

  async function runTask(t) {
    const z = zone(), st = zst();
    if (t.kind === 'plant' || t.kind === 'pot') {
      const ok = await choose(t.target, t.kind, t);
      if (!ok) return;
    }
    S.stars -= t.cost;
    st.done.push(t.id);
    if (t.kind === 'fixture') st.fixtures[t.target] = true;
    if (t.kind === 'grow') st.grows++;
    const last = st.done.length === z.tasks.length;
    if (last) { st.complete = true; st.grows = Math.max(st.grows, 2); const n = ZONES[ZONES.indexOf(z) + 1]; if (n && !S.unlocked.includes(n.id)) S.unlocked.push(n.id); }
    save(); updateHud('#starPill');
    const [ax, ay] = Scene.anchor(z, t);
    scrollSceneTo(ax);
    renderScene({ highlight: t.kind === 'plant' || t.kind === 'pot' || t.kind === 'grow' ? t.target : null });
    if (t.kind === 'grow') $$('#scene .slot.planted').forEach(g => g.classList.add('pop-in'));
    if (t.kind === 'fixture') { const el = $(`#scene .fx-${t.target}`) || $('#scene .fx-decor'); el && el.classList.add('fade-in'); }
    Sfx.sparkle();
    setTimeout(() => { const [x, y] = sceneToScreen(ax, ay); sparkle(x, y, 26); }, 350);
    await U.sleep(700);
    await say(t.say);
    if (last) {
      Sfx.win();
      const n = ZONES[ZONES.indexOf(z) + 1];
      S.coins += 500; S.boosters.rainbow++; save(); updateHud('#coinPill');
      modal(`<div class="win-burst">❦</div><h2>${z.name} restored!</h2><p>The room is thriving again. Ivy leaves you a gift: <b>500 coins</b> and a <b>Prism Dahlia</b>.</p>
        ${n ? `<p>A new room has opened: <b>${n.name}</b>.</p><button class="btn" id="mGo">Visit ${n.name}</button>` : `<p>The whole glasshouse is complete. You are a true plant collector!</p><button class="btn" id="mGo">Wonderful</button>`}`);
      $('#mGo').onclick = () => { closeModal(); if (n) { S.zone = n.id; save(); } goHome(); };
    } else if (nextTasks().some(x => x.cost <= S.stars)) setTimeout(() => { updateHud(); }, 100);
  }

  /* Choice sheet: pick a plant variety or a pot, previewing live in the scene. */
  function choose(slotId, kind, task) {
    return new Promise(resolve => {
      const z = zone(), sl = z.slots[slotId], st = zst();
      const opts = kind === 'plant' ? sl.options : sl.pots;
      let cur = kind === 'plant' ? (st.choices[slotId] || null) : ((st.pots && st.pots[slotId]) || sl.pot);
      const preview = () => {
        const tmp = JSON.parse(JSON.stringify(st));
        if (kind === 'plant') tmp.choices[slotId] = cur; else tmp.pots[slotId] = cur;
        if (task) tmp.grows = st.grows;
        renderScene({ state: tmp });
      };
      const card = id => {
        if (kind === 'plant') {
          const sp = SPECIES_BY_ID[id];
          return `<button class="opt${id === cur ? ' sel' : ''}" data-o="${id}">${PlantArt.leafPortrait(id)}<b>${sp.name.replace(/^(Monstera|Philodendron|Alocasia|Anthurium|Calathea|Pothos|Hoya|Snake Plant) /, '$1<br>')}</b><small class="rar rar-${sp.rarity}">${RARITY[sp.rarity]}</small></button>`;
        }
        const P = PlantArt.POTS[id];
        return `<button class="opt${id === cur ? ' sel' : ''}" data-o="${id}"><svg viewBox="-75 -110 150 125">${PlantArt.potSVG(id, 1, U.rng(5)).svg}</svg><b>${P.name}</b></button>`;
      };
      const h = `<button class="round close-x" data-x>✕</button><h3>${task ? task.title : (kind === 'plant' ? 'Change the plant' : 'Change the pot')}</h3>
        <p class="choice-note">${kind === 'plant' ? 'Tap a variety to preview it in the glasshouse.' : 'Tap a pot to try it on.'} ${task ? `Costs ★ ${task.cost}.` : 'Free to change any time.'}</p>
        <div class="opts ${opts.length === 4 ? 'four' : ''}">${opts.map(card).join('')}</div>
        <div class="sheet-actions">${!task && kind === 'plant' ? `<button class="btn alt sm" data-swap>Change pot instead</button>` : ''}<button class="btn" data-ok ${cur ? '' : 'disabled'}>${task ? 'Choose' : 'Done'}</button></div>`;
      const el = sheet(h);
      if (cur) preview();
      scrollSceneTo(sl.x);
      el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
        cur = b.dataset.o; Sfx.tap();
        el.querySelectorAll('[data-o]').forEach(x => x.classList.toggle('sel', x === b));
        el.querySelector('[data-ok]').disabled = false; preview();
      });
      el.querySelector('[data-x]').onclick = () => { closeSheet(); renderScene(); resolve(false); };
      const sw = el.querySelector('[data-swap]');
      if (sw) sw.onclick = () => { closeSheet(); setTimeout(() => choose(slotId, 'pot', null), 300); resolve(false); };
      el.querySelector('[data-ok]').onclick = () => {
        if (!cur) return;
        if (kind === 'plant') { st.choices[slotId] = cur; discover(cur); } else st.pots[slotId] = cur;
        save(); closeSheet(); if (!task) { renderScene({ highlight: slotId }); Sfx.sparkle(); }
        resolve(true);
      };
    });
  }
  function onSlot(id) {
    const st = zst();
    if (!st.choices[id]) { const t = zone().tasks.find(t => t.kind === 'plant' && t.target === id); say(t ? `This spot is waiting for a plant. Look for the task "${t.title}".` : 'Nothing grows here yet.'); return; }
    choose(id, 'plant', null);
  }
  function discover(id) { if (!S.found.includes(id)) S.found.push(id); }

  /* ───────────── Settings ───────────── */
  function openSettings() {
    const c = modal(`<button class="round close-x" data-c>✕</button><h2>Settings</h2>
      <div class="settings-row">Sound effects <button class="toggle ${S.settings.sound ? 'on' : ''}" data-t="sound"></button></div>
      <div class="settings-row">Music <button class="toggle ${S.settings.music ? 'on' : ''}" data-t="music"></button></div>
      <p style="margin-top:14px">Leafscapes: restore a Victorian glasshouse, one rare plant at a time.</p>
      <button class="btn alt sm" data-reset>Reset progress</button>`);
    c.querySelector('[data-c]').onclick = closeModal;
    c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const k = b.dataset.t; S.settings[k] = !S.settings[k]; b.classList.toggle('on', S.settings[k]);
      k === 'sound' ? Sfx.setSound(S.settings.sound) : Sfx.setMusic(S.settings.music); save();
    });
    const rb = c.querySelector('[data-reset]');
    rb.onclick = () => {
      if (!rb.dataset.armed) { rb.dataset.armed = 1; rb.textContent = 'Tap again to erase everything'; return; }
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
      location.reload();
    };
  }

  /* ───────────── Levels ───────────── */
  const goalKey = g => g.type === 'color' ? 'c' + g.color : g.type === 'moss' ? 'moss1' : g.type === 'pot' ? 'pot2' : 'vine';
  const goalName = g => g.type === 'color' ? Match3.TILE_NAMES[g.color] : g.type === 'moss' ? 'Moss' : g.type === 'pot' ? 'Clay pots' : 'Vines';
  const goalHTML = (g, i, n) => `<div class="goal" data-g="${i}" title="${goalName(g)}"><img src="${Match3.Sprites.url(goalKey(g))}" alt="${goalName(g)}"><b><span>${n}</span></b></div>`;
  let preSel = {};
  function levelIntro() {
    const lv = Levels.get(S.level);
    preSel = {};
    const tag = lv.hard === 2 ? '<span class="ribbon superhard">Super Hard · ★3</span>' : lv.hard === 1 ? '<span class="ribbon hard">Hard · ★2</span>' : '<span class="ribbon">★1</span>';
    const c = modal(`<button class="round close-x" data-c>✕</button>${tag}<h2>Level ${lv.n}</h2><p>Goals to complete in <b>${lv.moves}</b> moves:</p>
      <div class="goal-row">${lv.goals.map((g, i) => goalHTML(g, i, g.count)).join('')}</div>
      ${lv.tip ? `<div class="tip">💡 ${lv.tip}</div>` : ''}
      <div class="boost-row">${Object.entries(BOOSTERS).map(([k, b]) => `<button class="pre-boost" data-b="${k}"><img src="${Match3.Sprites.url(b.sprite)}"><small>${b.name}</small><em>${S.boosters[k] || '+'}</em></button>`).join('')}</div>
      <button class="btn" data-play>Play</button>`);
    c.querySelector('[data-c]').onclick = closeModal;
    c.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      const k = b.dataset.b;
      if (!S.boosters[k]) {
        const B = BOOSTERS[k];
        if (S.coins < B.price) { b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 200); Sfx.bad(); return; }
        if (!b.dataset.armed) { b.dataset.armed = 1; b.querySelector('em').textContent = '●' + B.price; b.querySelector('small').textContent = 'Tap to buy'; return; }
        S.coins -= B.price; S.boosters[k] = 1; save(); updateHud('#coinPill'); Sfx.coin();
        b.querySelector('em').textContent = 1; b.querySelector('small').textContent = B.name;
      }
      preSel[k] = !preSel[k]; b.classList.toggle('on', preSel[k]); Sfx.tap();
    });
    c.querySelector('[data-play]').onclick = () => { closeModal(); startLevel(); };
  }

  let game = null;
  const ui = {
    onMoves(m) { $('#movesVal').textContent = m; $('.moves').classList.toggle('low', m <= 5 && m > 0); },
    onGoals(goals) {
      const box = $('#goals');
      if (box.children.length !== goals.length) box.innerHTML = goals.map((g, i) => goalHTML(g, i, g.shown)).join('');
      goals.forEach((g, i) => {
        const el = box.children[i]; el.querySelector('span').textContent = Math.max(0, g.shown);
        el.classList.toggle('done', g.shown <= 0);
      });
    },
    onCollect(i, key, x, y, done) {
      const target = $('#goals').children[i]; if (!target) return done();
      const cv = $('#board').getBoundingClientRect(), tr = target.getBoundingClientRect();
      const sx = cv.left + x, sy = cv.top + y, tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
      const fly = $('#fly');
      if (fly.childElementCount > 14) { done(); return; }
      const img = new Image(); img.src = Match3.Sprites.url(key); fly.appendChild(img);
      const mx = (sx + tx) / 2 + (Math.random() - .5) * 120, my = Math.min(sy, ty) - 40;
      img.animate([
        { left: sx + 'px', top: sy + 'px', transform: 'scale(1)' },
        { left: mx + 'px', top: my + 'px', transform: 'scale(1.25)', offset: .45 },
        { left: tx + 'px', top: ty + 'px', transform: 'scale(.6)' }
      ], { duration: 650 + Math.random() * 150, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => {
        img.remove(); done(); Sfx.goal(); target.classList.remove('pulse'); void target.offsetWidth; target.classList.add('pulse');
      };
    },
    onWin(info) { setTimeout(() => winLevel(info), 400); },
    onLose() { loseLevel(); },
    onBonus() { toast('Bloom Bonus!'); },
    onToast(t) { toast(t); },
    onShake() { const b = $('#boardWrap'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); },
    onBoosterUsed(type) { S.boosters[type]--; save(); refreshBoosters(); }
  };
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 1300); }
  function refreshBoosters() {
    $$('.booster').forEach(b => {
      const k = b.dataset.b; b.querySelector('em').textContent = S.boosters[k] || 0;
      b.disabled = !S.boosters[k]; b.classList.toggle('armed', !!(game && game.armed === k));
    });
  }
  $$('.booster').forEach(b => b.onclick = () => {
    if (!game || !S.boosters[b.dataset.b]) return;
    if (game.arm(b.dataset.b)) { Sfx.tap(); refreshBoosters(); if (game.armed) toast(b.dataset.b === 'trowel' ? 'Tap a tile to dig it up' : 'Tap a row to trim it'); }
  });
  function startLevel() {
    const lv = Levels.get(S.level);
    const boosters = {};
    for (const k of Object.keys(preSel)) if (preSel[k] && S.boosters[k] > 0) { S.boosters[k]--; boosters[k] = true; }
    save();
    show('game');
    $('#lvlTag').textContent = 'Level ' + lv.n;
    $('#goals').innerHTML = '';
    if (!game) game = new Match3.Game($('#board'), ui);
    game.load(lv, boosters);
    refreshBoosters();
  }
  window.addEventListener('resize', () => { if (game && $('#game').classList.contains('active')) game.resize(); });
  $('#btnPause').onclick = () => {
    Sfx.tap();
    const c = modal(`<h2>Paused</h2><p>Level ${S.level}</p>
      <div class="settings-row">Sound effects <button class="toggle ${S.settings.sound ? 'on' : ''}" data-t="sound"></button></div>
      <div class="settings-row">Music <button class="toggle ${S.settings.music ? 'on' : ''}" data-t="music"></button></div><br>
      <button class="btn" data-r>Resume</button><br><button class="btn alt sm" data-q>Leave level</button>`);
    c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const k = b.dataset.t; S.settings[k] = !S.settings[k]; b.classList.toggle('on', S.settings[k]);
      k === 'sound' ? Sfx.setSound(S.settings.sound) : Sfx.setMusic(S.settings.music); save();
    });
    c.querySelector('[data-r]').onclick = closeModal;
    c.querySelector('[data-q]').onclick = () => { closeModal(); game.stop(); goHome(); };
  };
  function winLevel(info) {
    Sfx.win();
    const lv = Levels.get(S.level);
    S.stars += lv.reward; S.coins += info.coins; S.level++;
    let gift = null;
    if ((lv.n % 3 === 0) || lv.n === 1) {
      const pool = SPECIES.filter(s => !S.found.includes(s.id));
      const inZone = pool.filter(s => S.unlocked.includes(s.zone));
      gift = U.pick(inZone.length ? inZone : pool);
      if (gift) discover(gift.id);
    }
    save();
    game.stop();
    const c = modal(`<div class="win-burst">★</div><h2>Level ${lv.n} complete!</h2>
      <div class="reward"><div><span class="ico star">★</span>+${lv.reward}</div><div><span class="ico coin">●</span>+${info.coins}</div></div>
      ${gift ? `<div class="gift">${PlantArt.plantSVG(gift.id, { stage: 0 })}<div><small>A cutting for your Herbarium!</small><b>${gift.name}</b><small>${gift.common} · <span class="rar rar-${gift.rarity}">${RARITY[gift.rarity]}</span></small></div></div>` : ''}
      <button class="btn" data-c>Continue</button>`);
    c.querySelector('[data-c]').onclick = async () => {
      closeModal(); goHome(); updateHud('#starPill');
      const t = nextTasks().find(t => t.cost <= S.stars);
      if (t && !zst().complete) { await U.sleep(400); await say(`We have enough stars to "${t.title.toLowerCase()}". Shall we?`); openTasks(); }
    };
  }
  function loseLevel() {
    const price = 300;
    const c = modal(`<h2>Out of moves!</h2><p>So close. The plants are rooting for you.</p>
      <div class="goal-row">${game.goals.map((g, i) => goalHTML(g, i, Math.max(0, g.left))).join('')}</div>
      <button class="btn gold" data-more ${S.coins < price ? 'disabled' : ''}>+5 moves · ● ${price}</button><br>
      <button class="btn alt sm" data-quit>Give up</button>`);
    c.querySelector('[data-more]').onclick = () => { S.coins -= price; save(); updateHud(); closeModal(); Sfx.coin(); game.addMoves(5); };
    c.querySelector('[data-quit]').onclick = () => { closeModal(); game.stop(); goHome(); };
  }

  /* ───────────── Herbarium ───────────── */
  function openHerbarium() {
    $('#herbSub').textContent = `${S.found.length} of ${SPECIES.length} plants collected`;
    const grid = $('#herbGrid');
    grid.innerHTML = ZONES.map(z => {
      const list = SPECIES.filter(s => s.zone === z.id), have = list.filter(s => S.found.includes(s.id)).length;
      return `<section class="herb-zone"><h4>${z.name} <small>${have}/${list.length}</small></h4><div class="herb-cards">${list.map(s => {
        const got = S.found.includes(s.id);
        return `<div class="hcard ${got ? '' : 'locked'}" data-id="${s.id}" data-lazy="1"><svg viewBox="0 0 10 10"></svg><b>${got ? s.name : '???'}</b><i>${got ? s.common : s.genus}</i></div>`;
      }).join('')}</div></section>`;
    }).join('');
    $('#herb').classList.add('open');
    // lazily paint leaf portraits as cards scroll into view
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      el.querySelector('svg').outerHTML = PlantArt.leafPortrait(el.dataset.id);
    }), { root: grid, rootMargin: '200px' });
    grid.querySelectorAll('.hcard').forEach(el => { io.observe(el); el.onclick = () => { Sfx.tap(); plantDetail(el.dataset.id); }; });
  }
  $('#herbClose').onclick = () => $('#herb').classList.remove('open');
  function plantDetail(id) {
    const sp = SPECIES_BY_ID[id], got = S.found.includes(id), z = ZONE_BY_ID[sp.zone];
    if (!got) {
      const c = modal(`<button class="round close-x" data-c>✕</button><div style="filter:brightness(0) opacity(.2)">${PlantArt.leafPortrait(id, { cls: 'leaf-mini' })}</div>
        <h2>Undiscovered</h2><p>A <b>${sp.genus}</b> waits to be found. Look for it in <b>${z.name}</b>, or earn it as a cutting from levels.</p>`);
      c.querySelector('[data-c]').onclick = closeModal; return;
    }
    const dots = n => '●'.repeat(n) + `<i>${'●'.repeat(5 - n)}</i>`;
    let stage = 3;
    const c = modal(`<button class="round close-x" data-c>✕</button><div class="detail-grid">
      <div class="detail-art"><div class="plant-view" id="pv"></div><div class="stage-tabs">${STAGES.map((s, i) => `<button data-s="${i}" class="${i === stage ? 'on' : ''}">${s}</button>`).join('')}</div></div>
      <div><span class="ribbon" style="background:var(--deep)">${sp.genus}</span><h2>${sp.name}</h2><div class="latin">${sp.latin}</div>
        <div class="meta"><span>${sp.common}</span><span class="rar rar-${sp.rarity}">${RARITY[sp.rarity]}</span><span>${sp.origin}</span></div>
        <p style="margin:0 0 6px">${sp.blurb}</p>
        <div class="care"><span>☀ Light</span><span class="dots">${dots(sp.care.light)}</span><span>💧 Water</span><span class="dots">${dots(sp.care.water)}</span><span>☁ Humidity</span><span class="dots">${dots(sp.care.humid)}</span></div>
        ${PlantArt.leafPortrait(id, { cls: 'leaf-mini' })}
      </div></div>
      <h3>Field notes</h3><ul>${sp.facts.map(f => `<li>${f}</li>`).join('')}</ul>`, 'detail');
    const paint = () => { c.querySelector('#pv').innerHTML = PlantArt.plantSVG(id, { stage, pot: zone().slots && Object.values(ZONE_BY_ID[sp.zone].slots).find(s => s.options.includes(id))?.pot || 'terracotta' }); };
    paint();
    c.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { stage = +b.dataset.s; c.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); paint(); Sfx.tap(); });
    c.querySelector('[data-c]').onclick = closeModal;
  }

  /* ───────────── Boot ───────────── */
  goHome();
  scrollSceneTo(800);
  if (!S.introSeen) {
    setTimeout(async () => {
      await say([
        'Oh! You must be the new keeper. Welcome to the old glasshouse. I’m Ivy, the curator.',
        'Forty years ago this was the finest collection of rare plants in the country. Now look at it: broken glass, dead pots, weeds everywhere.',
        'Earn ★ stars by solving garden puzzles, then spend them on restoration tasks. Every Monstera, every velvet Anthurium, every painted Calathea brought back to life!',
        'Let’s start with Level 1. Off you go!'
      ]);
      S.introSeen = true; save(); levelIntro();
    }, 600);
  }
  window.__leafscapes = { S, save, get game() { return game; } };
})();
