// Menus & overlays: title screen, intro, pause (map / satchel / journal / settings / controls), shop, dialog, death, ending.
import { TITLE, SUBTITLE, INTRO, QUESTS, ENDINGS, DIALOGS, FIELD_GUIDE } from '../data/story.js';
import { ITEMS, RECIPES, SHOP, WEAPONS } from '../data/items.js';
import { LOCATIONS, locById } from '../data/world.js';
import { worldToMap } from './mapgen.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    const root = (this.root = document.createElement('div'));
    root.id = 'ui';
    root.innerHTML = `
      <div id="loading" class="screen show"><div class="ltitle">${TITLE}</div><div class="lbar"><div></div></div><div class="ltext">Growing the jungle…</div></div>
      <div id="title" class="screen">
        <div class="tbox">
          <div class="t1">${TITLE}</div><div class="t2">${SUBTITLE}</div>
          <div class="menu">
            <button data-a="continue">Continue</button>
            <button data-a="new">New Game</button>
            <button data-a="settings">Settings</button>
            <button data-a="controls">Controls</button>
            <button data-a="credits">Credits</button>
          </div>
        </div>
        <div class="tfoot">Best with headphones · Click to capture the mouse · Esc to pause</div>
      </div>
      <div id="intro" class="screen"><div class="itext"></div><div class="iskip">Press SPACE to skip</div></div>
      <div id="pause" class="screen">
        <div class="ptabs">
          <button data-t="map">Map</button><button data-t="satchel">Satchel</button><button data-t="journal">Journal</button><button data-t="settings">Settings</button><button data-t="controls">Controls</button>
        </div>
        <div class="pbody"></div>
        <div class="pfoot"><button data-a="resume">Resume</button><button data-a="save">Save Game</button><button data-a="quit">Quit to Title</button></div>
      </div>
      <div id="panel" class="screen"><div class="pbox"></div></div>
      <div id="dialog"><div class="dname"></div><div class="dtext"></div><div class="dmore">▼</div></div>
      <div id="death" class="screen"><div class="dd1">YOU DIED</div><div class="dd2"></div><button data-a="respawn">Get Back Up</button></div>
      <div id="ending" class="screen"><div class="etext"></div></div>
    `;
    document.body.appendChild(root);
    this.state = 'loading';
    this.tab = 'map';
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.game.audio.ui('click');
      if (b.dataset.a) this.action(b.dataset.a, b);
      if (b.dataset.t) this.showTab(b.dataset.t);
      if (b.dataset.craft) { this.game.inventory.craft(b.dataset.craft); this.showTab('satchel'); }
      if (b.dataset.use) { this.game.inventory.use(b.dataset.use); this.showTab('satchel'); }
      if (b.dataset.buy) this.buy(b.dataset.shop, +b.dataset.buy);
      if (b.dataset.sell) this.sell(b.dataset.shop, b.dataset.sell);
      if (b.dataset.travel) this.fastTravel(b.dataset.travel);
      if (b.dataset.end) this.ending(b.dataset.end);
    });
    root.addEventListener('input', (e) => { const t = e.target; if (t.dataset.set) this.setSetting(t.dataset.set, t.type === 'checkbox' ? t.checked : t.value); });
    root.addEventListener('change', (e) => { const t = e.target; if (t.dataset.set) this.setSetting(t.dataset.set, t.type === 'checkbox' ? t.checked : t.value); });
    this.dialogQ = null;
  }

  loading(p, text) { $('#loading .lbar div', this.root).style.width = `${Math.round(p * 100)}%`; if (text) $('#loading .ltext', this.root).textContent = text; }

  screen(id) {
    for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
    this.state = id || 'game';
  }

  showTitle() {
    this.screen('title');
    $('#title [data-a=continue]', this.root).style.display = this.game.hasSave() ? '' : 'none';
    this.game.hud.show(false);
  }

  action(a) {
    const G = this.game;
    switch (a) {
      case 'new': if (G.hasSave() && !confirm('Start a new game? Your current progress will be overwritten.')) return; G.newGame(); break;
      case 'continue': G.continueGame(); break;
      case 'settings': this.panel(this.settingsHTML(), true); break;
      case 'controls': this.panel(this.controlsHTML(), true); break;
      case 'credits': this.panel(this.creditsHTML(), true); break;
      case 'resume': G.resume(); break;
      case 'save': G.save(true); break;
      case 'quit': G.save(); location.reload(); break;
      case 'respawn': G.respawn(); break;
      case 'closePanel': if (this.panelBack) { this.panelBack(); } else this.showTitle(); break;
      case 'closeShop': G.resume(); break;
    }
  }

  panel(html, fromTitle, back = null) {
    this.screen('panel');
    this.panelBack = back;
    $('#panel .pbox', this.root).innerHTML = html + `<div class="pclose"><button data-a="${fromTitle ? 'closePanel' : 'closeShop'}">Back</button></div>`;
  }

  // ---------- intro ----------
  playIntro(onDone) {
    this.screen('intro');
    const el = $('#intro .itext', this.root);
    let i = 0, timer = null;
    const done = () => { clearTimeout(timer); removeEventListener('keydown', skip); this.screen(null); onDone(); };
    const skip = (e) => { if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') done(); };
    addEventListener('keydown', skip);
    const next = () => {
      if (i >= INTRO.length) return done();
      const l = INTRO[i++];
      el.classList.remove('show'); void el.offsetWidth;
      el.textContent = l.t; el.classList.add('show');
      timer = setTimeout(next, l.d * 1000);
    };
    next();
  }

  // ---------- dialog ----------
  dialog(lines, onDone, ambient = false) {
    if (!lines) { onDone?.(); return; }
    const G = this.game;
    const d = $('#dialog', this.root);
    let i = 0;
    this.dialogQ = { lines, onDone, ambient };
    G.hud.letterbox(!ambient);
    const show = () => {
      const [name, text] = lines[i];
      $('.dname', d).textContent = name;
      $('.dtext', d).textContent = text;
      d.classList.add('show');
      d.classList.toggle('radio', name === 'Radio');
      if (ambient) { clearTimeout(this._dT); this._dT = setTimeout(adv, 4200); }
    };
    const adv = () => {
      i++;
      if (i >= lines.length) { d.classList.remove('show'); G.hud.letterbox(false); this.dialogQ = null; this._adv = null; onDone?.(); return; }
      show();
    };
    this._adv = adv;
    show();
  }
  dialogActive() { return !!this.dialogQ && !this.dialogQ.ambient; }
  advanceDialog() { this.game.audio.ui('click'); this._adv?.(); }

  // ---------- pause ----------
  openPause(tab = 'map') {
    this.screen('pause');
    this.showTab(tab);
  }
  showTab(t) {
    this.tab = t;
    for (const b of this.root.querySelectorAll('.ptabs button')) b.classList.toggle('on', b.dataset.t === t);
    const body = $('#pause .pbody', this.root);
    if (t === 'map') { body.innerHTML = this.mapHTML(); this.drawMap(); }
    if (t === 'satchel') body.innerHTML = this.satchelHTML();
    if (t === 'journal') body.innerHTML = this.journalHTML();
    if (t === 'settings') body.innerHTML = this.settingsHTML();
    if (t === 'controls') body.innerHTML = this.controlsHTML();
  }

  mapHTML() {
    const disc = LOCATIONS.filter((l) => this.game.hud.discovered.has(l.id));
    return `<div class="mapwrap"><canvas id="bigmap" width="760" height="760"></canvas>
      <div class="maplist"><h3>Known Places</h3>${disc.map((l) => `<div class="ml"><b>${esc(l.name)}</b><span>${esc(l.desc)}</span>${['town', 'camp'].includes(l.kind) || this.game.population.cleared.has(l.id) ? `<button data-travel="${l.id}">Travel</button>` : ''}</div>`).join('') || '<i>Explore to discover places.</i>'}</div></div>`;
  }
  drawMap() {
    const G = this.game, cv = $('#bigmap', this.root);
    if (!cv) return;
    const c = cv.getContext('2d'), S = cv.width;
    c.drawImage(G.hud.mapCanvas, 0, 0, S, S);
    c.font = 'bold 13px Georgia'; c.textAlign = 'center';
    for (const L of LOCATIONS) {
      const [x, y] = worldToMap(L.x, L.z, S);
      const known = G.hud.discovered.has(L.id);
      c.fillStyle = known ? (L.kind === 'outpost' ? (G.population.cleared.has(L.id) ? '#2a5a2a' : '#8a1a10') : '#3a2410') : 'rgba(60,40,20,0.35)';
      c.beginPath(); c.arc(x, y, known ? 6 : 4, 0, 6.28); c.fill();
      if (known) { c.fillStyle = '#2a1a0a'; c.fillText(L.name.replace(/ \(.*\)/, ''), x, y - 10); }
    }
    const op = G.quests.markerPos();
    if (op) { const [x, y] = worldToMap(op.x, op.z, S); c.strokeStyle = '#c08000'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 11, 0, 6.28); c.stroke(); c.fillStyle = '#ffd040'; c.beginPath(); c.arc(x, y, 5, 0, 6.28); c.fill(); }
    const m = G.population.mount;
    if (m && m.alive) { const [x, y] = worldToMap(m.pos.x, m.pos.z, S); c.fillStyle = '#2a7ab0'; c.beginPath(); c.arc(x, y, 5, 0, 6.28); c.fill(); }
    const P = G.player;
    const [px, py] = worldToMap(P.pos.x, P.pos.z, S);
    c.save(); c.translate(px, py); c.rotate(Math.PI - P.yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  fastTravel(id) {
    const G = this.game;
    if (G.inCombat()) { G.hud.toast('You cannot travel while in danger', 'danger'); return; }
    const L = locById[id];
    G.travelTo(L);
  }

  satchelHTML() {
    const G = this.game, I = G.inventory;
    const items = Object.keys(ITEMS).filter((k) => k !== 'money' && I.count(k) > 0);
    const usable = (k) => ITEMS[k].heal || ITEMS[k].eat || k === 'tonic';
    return `<div class="satchel">
      <div class="col"><h3>Satchel <span class="money">$${Math.floor(I.count('money'))}</span></h3>
        <div class="items">${items.map((k) => `<div class="it"><span class="ic">${ITEMS[k].icon}</span><span class="nm">${ITEMS[k].name}</span><span class="ct">${I.count(k)}</span>${usable(k) ? `<button data-use="${k}">Use</button>` : ''}</div>`).join('') || '<i>Empty</i>'}</div>
        <h3>Weapons</h3><div class="items">${G.player.weapons.map((w) => `<div class="it"><span class="ic">${WEAPONS[w].slot}</span><span class="nm">${WEAPONS[w].name}</span></div>`).join('')}</div>
        <h3>Upgrades</h3><div class="items">${[...G.player.upgrades].map((u) => `<div class="it"><span class="nm">${RECIPES.find((r) => r.gives.upgrade === u)?.name}</span></div>`).join('') || '<i>None yet</i>'}</div>
      </div>
      <div class="col"><h3>Crafting</h3>
        ${RECIPES.map((r) => { const can = I.canCraft(r); const done = r.once && I.crafted.has(r.id); return `<div class="rc ${can ? 'can' : ''} ${done ? 'done' : ''}"><div><b>${r.name}</b><small>${r.desc || ''}</small><div class="needs">${Object.entries(r.needs).map(([k, n]) => `<span class="${I.count(k) >= n ? 'ok' : 'no'}">${ITEMS[k].icon} ${n} ${ITEMS[k].name}</span>`).join('')}</div></div>${done ? '<em>Crafted</em>' : `<button data-craft="${r.id}" ${can ? '' : 'disabled'}>Craft</button>`}</div>`; }).join('')}
      </div></div>`;
  }

  journalHTML() {
    const Q = this.game.quests, st = this.game.stats;
    const cur = Q.quest;
    return `<div class="journal"><div class="col">
      <h3>Current Mission</h3>
      ${cur ? `<div class="jq"><b>${esc(cur.title)}</b><p>${esc(cur.desc)}</p>${cur.steps.map((s, i) => `<div class="js ${i < Q.si ? 'done' : i === Q.si ? 'now' : 'future'}">${i < Q.si ? '✔' : i === Q.si ? '➤' : '·'} ${i <= Q.si ? esc(s.text) : '???'}</div>`).join('')}</div>` : '<p>All missions complete. The island is yours to roam.</p>'}
      <h3>Completed</h3>${Q.completed.map((id) => `<div class="js done">✔ ${esc(QUESTS.find((q) => q.id === id).title)}</div>`).join('') || '<i>None yet</i>'}
      </div><div class="col"><h3>Ranger's Record</h3>
      <div class="stats">
        <div><span>Days survived</span><b>${this.game.day}</b></div><div><span>Kills</span><b>${st.kills}</b></div>
        <div><span>Headshots</span><b>${st.headshots}</b></div><div><span>Silent takedowns</span><b>${st.takedowns}</b></div>
        <div><span>Animals harvested</span><b>${st.harvested}</b></div><div><span>Bounties claimed</span><b>${st.bounties}</b></div>
        <div><span>Amber found</span><b>${st.amber}</b></div><div><span>Places discovered</span><b>${this.game.hud.discovered.size} / ${LOCATIONS.length}</b></div>
      </div>
      <h3>Field Guide <small>${this.game.seen.size} / ${Object.keys(FIELD_GUIDE).length}</small></h3>
      <div class="guide">${Object.entries(FIELD_GUIDE).map(([k, [n, d]]) => this.game.seen.has(k) ? `<div class="gd"><b>${n}</b><span>${d}</span></div>` : `<div class="gd unk"><b>Unknown species</b><span>Get a closer look to document it.</span></div>`).join('')}</div>
      <h3>Field Notes</h3><p class="notes">Herbivores flee from noise. Predators come to it.<br>Raptors hunt in packs and flank — keep your back to a wall.<br>Gallimimus can be calmed with bait. Approach crouched.<br>Dilophosaurs spit venom that blinds. Kill them fast or keep your distance.<br>The Tyrannosaur rules the eastern paddock. Don't run in a straight line.<br>The Infected came ashore with the freighter. Body shots barely slow them — aim for the head. They're faster at night.</p>
      </div></div>`;
  }

  settingsHTML() {
    const S = this.game.settings;
    const opt = (k, vals) => vals.map((v) => `<option value="${v}" ${S[k] === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('');
    return `<div class="settings"><h3>Settings</h3>
      <label>Graphics quality <select data-set="quality">${opt('quality', ['low', 'medium', 'high', 'ultra'])}</select></label>
      <label>Adaptive resolution <input type="checkbox" ${S.adaptive ? 'checked' : ''} data-set="adaptive"></label>
      <label>Render scale <input type="range" min="0.5" max="1" step="0.05" value="${S.renderScale}" data-set="renderScale"><em>${Math.round(S.renderScale * 100)}%</em></label>
      <label>Difficulty <select data-set="difficulty">${opt('difficulty', ['easy', 'normal', 'hard'])}</select></label>
      <label>Mouse sensitivity <input type="range" min="0.2" max="3" step="0.1" value="${S.sensitivity}" data-set="sensitivity"></label>
      <label>Field of view <input type="range" min="50" max="85" step="1" value="${S.fov}" data-set="fov"></label>
      <label>Invert mouse Y <input type="checkbox" ${S.invertY ? 'checked' : ''} data-set="invertY"></label>
      <label>Master volume <input type="range" min="0" max="1" step="0.05" value="${S.master}" data-set="master"></label>
      <label>Music volume <input type="range" min="0" max="1" step="0.05" value="${S.music}" data-set="music"></label>
      <label>Effects volume <input type="range" min="0" max="1" step="0.05" value="${S.sfx}" data-set="sfx"></label>
      <label>Show FPS <input type="checkbox" ${S.showFps ? 'checked' : ''} data-set="showFps"></label>
    </div>`;
  }
  setSetting(k, v) {
    const S = this.game.settings;
    if (['renderScale', 'sensitivity', 'fov', 'master', 'music', 'sfx'].includes(k)) v = parseFloat(v);
    S[k] = v;
    this.game.applySettings(k);
    localStorage.setItem('jf_settings', JSON.stringify(S));
  }

  controlsHTML() {
    const rows = [['W A S D', 'Move'], ['Shift', 'Sprint / gallop'], ['C', 'Crouch (stealth)'], ['Space', 'Jump'], ['Right Mouse', 'Aim'], ['Left Mouse', 'Fire / draw bow / swing'], ['Q (while aiming)', 'Dead Eye — mark targets, click to unleash'], ['R', 'Reload'], ['1 – 4 / Wheel', 'Switch weapon'], ['T', 'Toggle venom arrows'], ['E', 'Interact / gather / talk / loot (hold to tame)'], ['F', 'Mount / dismount'], ['H', 'Whistle for your mount'], ['L', 'Toggle lantern'], ['G', 'Eat food'], ['B', 'Use bandage'], ['X (hold)', 'Walk slowly'], ['Tab', 'Satchel & crafting'], ['M', 'Map'], ['J', 'Journal'], ['Esc', 'Pause']];
    return `<div class="controls"><h3>Controls</h3>${rows.map(([k, v]) => `<div class="cr"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>`;
  }
  creditsHTML() {
    return `<div class="credits"><h3>${TITLE}</h3><p>${SUBTITLE}</p><p>Design, code, world, creatures, music & sound — generated procedurally at runtime.<br>Engine: three.js · WebGL2 · WebAudio</p><p>No image, model or audio files: every tree, dinosaur and guitar note is synthesized on your machine.</p><p class="small">"Jurassic Park" is a trademark of Universal City Studios LLC and Amblin Entertainment. This is an unofficial fan project. Rename the park via <code>src/data/story.js</code> for commercial release.</p></div>`;
  }

  // ---------- shop ----------
  openShop(id) {
    const G = this.game, S = SHOP[id], I = G.inventory;
    const buyRows = S.buy.map(([k, n, price], i) => {
      const isW = k.startsWith('weapon:');
      const owned = isW && G.player.weapons.includes(k.split(':')[1]);
      const name = isW ? WEAPONS[k.split(':')[1]].name : `${ITEMS[k].name} ×${n}`;
      return `<div class="sr"><span>${isW ? '🔫' : ITEMS[k].icon} ${name}</span><b>$${price}</b><button data-shop="${id}" data-buy="${i}" ${owned || I.count('money') < price ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button></div>`;
    }).join('');
    const sellRows = S.sells.filter((k) => I.count(k) > 0).map((k) => `<div class="sr"><span>${ITEMS[k].icon} ${ITEMS[k].name} (${I.count(k)})</span><b>$${ITEMS[k].sell}</b><button data-shop="${id}" data-sell="${k}">Sell 1</button></div>`).join('');
    this.panel(`<div class="shop"><h3>${S.title} <small>— ${S.owner}</small><span class="money">$${Math.floor(I.count('money'))}</span></h3><div class="cols"><div><h4>Buy</h4>${buyRows}</div><div><h4>Sell</h4>${sellRows || '<i>Nothing they want.</i>'}</div></div></div>`, false);
    this.shopId = id;
  }
  buy(id, i) {
    const G = this.game, [k, n, price] = SHOP[id].buy[i], I = G.inventory;
    if (I.count('money') < price) return;
    if (k.startsWith('weapon:')) { G.player.giveWeapon(k.split(':')[1]); G.inventory.add('rifleAmmo', 8, true); }
    else if (I.add(k, n, true) <= 0) { G.hud.toast('No room'); return; }
    I.remove('money', price);
    G.audio.ui('money');
    this.openShop(id);
  }
  sell(id, k) {
    const G = this.game, I = G.inventory;
    if (I.remove(k, 1)) { I.add('money', ITEMS[k].sell, true); G.audio.ui('money'); }
    this.openShop(id);
  }

  // ---------- death & ending ----------
  showDeath(cause) {
    this.screen('death');
    $('#death .dd2', this.root).textContent = cause || 'The island always wins in the end. But not today.';
  }

  showEndingChoice() {
    this.panel(`<div class="endchoice"><h3>The Last Frontier</h3><p>The boat is fuelled. Kestrel Island waits to the west. Haven waits behind you.</p><button data-end="sail">Sail to Kestrel Island</button><button data-end="stay">Stay — Haven needs a ranger</button></div>`, false);
  }
  ending(choice) {
    const G = this.game;
    this.screen('ending');
    const el = $('#ending .etext', this.root);
    const lines = [...ENDINGS[choice], TITLE, 'Thank you for playing.', 'The island remains open for free roam.'];
    let i = 0;
    const next = () => {
      if (i >= lines.length) { G.afterEnding(choice); return; }
      el.classList.remove('show'); void el.offsetWidth;
      el.textContent = lines[i++]; el.classList.add('show');
      setTimeout(next, 5200);
    };
    next();
  }
}
