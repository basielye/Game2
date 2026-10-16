// In-game HUD: cores, minimap, compass, objectives, weapon, prompts, toasts, banners, damage, detection.
import * as THREE from 'three';
import { ITEMS, WEAPONS } from '../data/items.js';
import { LOCATIONS, locById } from '../data/world.js';
import { worldToMap } from './mapgen.js';
import { angleDiff, clamp } from '../core/math.js';

const $ = (sel, root = document) => root.querySelector(sel);
const _v = new THREE.Vector3();

export class HUD {
  constructor(game) {
    this.game = game;
    const el = (this.el = document.createElement('div'));
    el.id = 'hud';
    el.innerHTML = `
      <div id="vignette"></div><div id="dmg"></div><div id="blind"></div><div id="deadeye-ov"></div>
      <div id="letterbox"><div></div><div></div></div>
      <div id="compass"><div class="strip"></div><div class="needle"></div></div>
      <div id="objective"><div class="qt"></div><div class="qs"></div><div class="qh"></div></div>
      <div id="minimap-wrap">
        <svg id="cores" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="104" class="track"/><circle cx="110" cy="110" r="104" class="ring hp"/>
          <circle cx="110" cy="110" r="96" class="track thin"/><circle cx="110" cy="110" r="96" class="ring st"/>
          <circle cx="110" cy="110" r="89" class="track thin"/><circle cx="110" cy="110" r="89" class="ring fo"/>
        </svg>
        <canvas id="minimap" width="170" height="170"></canvas>
        <div id="clock"></div>
      </div>
      <div id="weapon"><div class="money"></div><div class="wname"></div><div class="ammo"></div><div class="slots"></div></div>
      <div id="crosshair"><div class="dot"></div><div class="ring"></div></div>
      <div id="hitmarker"></div>
      <div id="prompt"></div>
      <div id="progress"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="track"/><circle cx="20" cy="20" r="16" class="bar"/></svg></div>
      <div id="toasts"></div><div id="pickups"></div>
      <div id="banner"><div class="b1"></div><div class="b2"></div><div class="b3"></div></div>
      <div id="discover"><div class="d1">DISCOVERED</div><div class="d2"></div></div>
      <div id="markers"></div>
      <div id="dirdmg"></div>
      <div id="subtitle"></div>
      <div id="fps"></div><div id="clickhint">Click to take control</div><div id="hint"></div>
    `;
    document.body.appendChild(el);
    this.mini = $('#minimap', el).getContext('2d');
    this.compassStrip = $('#compass .strip', el);
    this.toastsEl = $('#toasts', el);
    this.pickupsEl = $('#pickups', el);
    this.markersEl = $('#markers', el);
    this.dmgT = 0;
    this.hitT = 0;
    this.markerPool = [];
    this.dirPool = [];
    this.discovered = new Set();
    this._buildCompass();
    this.visible = true;
  }

  show(v) { this.visible = v; this.el.style.display = v ? '' : 'none'; }
  setMap(canvas) { this.mapCanvas = canvas; }

  _buildCompass() {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let rep = 0; rep < 3; rep++) for (let i = 0; i < 8; i++) html += `<span class="${i % 2 ? 'minor' : 'major'}">${dirs[i]}</span>`;
    this.compassStrip.innerHTML = html;
  }

  objective(title, text, hint) {
    const o = $('#objective', this.el);
    $('.qt', o).textContent = title;
    $('.qs', o).textContent = text;
    $('.qh', o).textContent = hint || '';
    o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
    if (hint) { clearTimeout(this._hintT); $('.qh', o).style.opacity = 1; this._hintT = setTimeout(() => ($('.qh', o).style.opacity = 0), 14000); }
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.toastsEl.appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3800);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild.remove();
  }

  pickup(k, n) {
    const d = document.createElement('div');
    d.className = 'pick';
    d.innerHTML = `<span class="ic">${ITEMS[k]?.icon || '•'}</span> +${n} ${ITEMS[k]?.name || k}`;
    this.pickupsEl.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2200);
    setTimeout(() => d.remove(), 2800);
    this.game.audio.ui(k === 'money' ? 'money' : 'pickup');
  }

  banner(a, b, c) {
    const el = $('#banner', this.el);
    $('.b1', el).textContent = a; $('.b2', el).textContent = b; $('.b3', el).textContent = c || '';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  discover(loc) {
    if (this.discovered.has(loc.id)) return;
    this.discovered.add(loc.id);
    const el = $('#discover', this.el);
    $('.d2', el).textContent = loc.name;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.game.audio.ui('discover');
    this.game.stats.discovered = this.discovered.size;
  }

  discoverSpecies(name) {
    const el = $('#discover', this.el);
    $('.d1', el).textContent = 'FIELD GUIDE · NEW SPECIES';
    $('.d2', el).textContent = name;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.game.audio.ui('discover');
    setTimeout(() => { $('.d1', el).textContent = 'DISCOVERED'; }, 4600);
  }

  hint(html) {
    const h = $('#hint', this.el);
    h.innerHTML = html;
    h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
    clearTimeout(this._hintTO); this._hintTO = setTimeout(() => h.classList.remove('show'), 9000);
  }

  subtitle(text, dur = 4) {
    const s = $('#subtitle', this.el);
    s.textContent = text; s.style.opacity = 1;
    clearTimeout(this._subT); this._subT = setTimeout(() => (s.style.opacity = 0), dur * 1000);
  }

  hitmarker(kill, head) {
    const h = $('#hitmarker', this.el);
    h.className = 'show' + (kill ? ' kill' : '') + (head ? ' head' : '');
    clearTimeout(this._hmT); this._hmT = setTimeout(() => (h.className = ''), 180);
  }

  damageFrom(pos) {
    this.dmgT = 1;
    if (!pos) return;
    const p = this.game.player;
    const ang = angleDiff(p.camYaw, Math.atan2(pos.x - p.pos.x, pos.z - p.pos.z));
    const d = document.createElement('div');
    d.className = 'dd';
    d.style.transform = `translate(-50%,-50%) rotate(${-ang}rad) translateY(-140px)`;
    $('#dirdmg', this.el).appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  deadEye(on) { this.el.classList.toggle('deadeye', on); }
  weaponChanged() { this._wKey = null; }
  letterbox(on) { $('#letterbox', this.el).classList.toggle('on', on); }

  prompt(text) {
    const p = $('#prompt', this.el);
    if (text !== this._prompt) { this._prompt = text; p.innerHTML = text ? text : ''; p.style.opacity = text ? 1 : 0; }
  }
  progress(v) {
    const p = $('#progress', this.el);
    p.style.opacity = v > 0 ? 1 : 0;
    $('.bar', p).style.strokeDashoffset = 100.5 * (1 - v);
  }

  update(dt) {
    const G = this.game, P = G.player;
    if (!this.visible) return;
    // cores
    const C = 2 * Math.PI;
    const ring = (sel, r, v) => { const e = $(sel, this.el); const L = C * r; e.style.strokeDasharray = L; e.style.strokeDashoffset = L * (1 - clamp(v, 0, 1)); };
    ring('.ring.hp', 104, P.hp / P.maxHp);
    ring('.ring.st', 96, P.stamina / P.maxStamina);
    ring('.ring.fo', 89, P.focus / 100);
    $('#cores', this.el).classList.toggle('low', P.hp / P.maxHp < 0.3);
    // clock
    const h = G.atmo.time;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('#clock', this.el).textContent = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}  ${G.atmo.isNight() ? '☾' : '☀'}`;
    // weapon
    const w = P.weapon, def = WEAPONS[w];
    let ammo = '';
    if (def.type === 'gun') ammo = `${P.ammoClip[w]} <small>/ ${G.inventory.count(def.ammo)}</small>`;
    else if (def.type === 'bow') ammo = P.usePoison ? `<span class="poison">${G.inventory.count('poisonArrow')}</span> <small>venom</small>` : `${G.inventory.count('arrow')} <small>arrows</small>`;
    const key = w + ammo + P.weapons.join() + G.inventory.count('money');
    if (key !== this._wKey) {
      this._wKey = key;
      const we = $('#weapon', this.el);
      $('.money', we).textContent = `$${Math.floor(G.inventory.count('money'))}`;
      $('.wname', we).textContent = def.name;
      $('.ammo', we).innerHTML = ammo;
      $('.slots', we).innerHTML = P.weapons.map((k, i) => `<span class="${i === P.weaponIdx ? 'on' : ''}">${WEAPONS[k].slot}</span>`).join('');
    }
    // crosshair
    const ch = $('#crosshair', this.el);
    ch.classList.toggle('aim', P.aiming);
    ch.classList.toggle('hide', P.mounted && !P.aiming);
    if (def.type === 'bow') ch.style.setProperty('--draw', 1 - P.drawT);
    // compass
    const deg = (P.camYaw * 180) / Math.PI;
    // strip: each label is 45°, width 60px → 1.333 px per degree. Yaw 0 faces +Z (south)
    const heading = (180 - deg + 3600) % 360; // compass heading, 0 = north (-Z)
    this.compassStrip.style.transform = `translateX(${-(heading / 45) * 60 - 8 * 60 + 270}px)`;
    // markers (world-projected + compass)
    this._markers();
    // minimap
    this._minimap();
    // damage vignette
    this.dmgT = Math.max(0, this.dmgT - dt * 1.5);
    const low = 1 - P.hp / P.maxHp;
    $('#dmg', this.el).style.opacity = Math.min(1, this.dmgT * 0.8 + Math.max(0, low - 0.5) * 1.4 * (0.75 + 0.25 * Math.sin(performance.now() * 0.006)));
    $('#blind', this.el).style.opacity = P.blind;
    // discovery check
    for (const L of LOCATIONS) if (!this.discovered.has(L.id) && Math.hypot(P.pos.x - L.x, P.pos.z - L.z) < Math.max(40, L.r)) this.discover(L);
  }

  _marker(i) {
    let m = this.markerPool[i];
    if (!m) { m = document.createElement('div'); m.className = 'mk'; this.markersEl.appendChild(m); this.markerPool[i] = m; }
    return m;
  }

  _markers() {
    const G = this.game, cam = G.camera, P = G.player;
    let n = 0;
    const W = innerWidth, H = innerHeight;
    const place = (pos, cls, label, alwaysEdge = false) => {
      _v.copy(pos).project(cam);
      const behind = _v.z > 1;
      let x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
      if (behind) { x = W - x; y = H - 40; }
      if (!alwaysEdge && (behind || x < 0 || x > W || y < 0 || y > H)) return;
      x = clamp(x, 40, W - 40); y = clamp(y, 60, H - 60);
      const m = this._marker(n++);
      m.className = 'mk ' + cls;
      m.style.transform = `translate(${x}px, ${y}px)`;
      m.dataset.label = label || '';
      m.style.display = '';
    };
    // objective
    const op = G.quests.markerPos();
    if (op) {
      const d = op.distanceTo(P.pos);
      op.y += 3;
      place(op, 'obj', d > 8 ? `${Math.round(d)}m` : '', true);
    }
    if (G.population.mount && G.population.mount.alive && !P.mounted) {
      const mp = G.population.mount.pos.clone(); mp.y += 3;
      if (mp.distanceTo(P.pos) < 300) place(mp, 'mount', '');
    }
    if (G.population.bounty?.target?.alive) { const bp = G.population.bounty.target.pos.clone(); bp.y += 2.5; place(bp, 'bounty', `$${G.population.bounty.reward}`, true); }
    // detection indicators above raiders
    for (const e of G.entities) {
      if (e.kind !== 'human' || !e.alive || e.faction !== 'raider') continue;
      const d = e.pos.distanceTo(P.pos);
      if (d > 90) continue;
      if (e.awareness > 0.05 || e.state === 'combat') {
        const hp = e.pos.clone(); hp.y += 2.3;
        const lvl = e.state === 'combat' ? 'red' : e.awareness > 0.45 ? 'yellow' : 'white';
        place(hp, 'eye ' + lvl, '');
        const m = this.markerPool[n - 1];
        if (m) m.style.setProperty('--fill', e.state === 'combat' ? 1 : e.awareness);
      }
    }
    // dead eye marks
    if (P.deadEye) for (const mk of G.combat.marks) place(mk.sphere.c, 'xmark', '');
    for (let i = n; i < this.markerPool.length; i++) this.markerPool[i].style.display = 'none';
  }

  _minimap() {
    const G = this.game, P = G.player, c = this.mini;
    const S = 170, map = this.mapCanvas;
    if (!map) return;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.clip();
    const zoom = P.mounted ? 1.4 : 2.2; // map pixels per screen pixel scaling
    const [mx, my] = worldToMap(P.pos.x, P.pos.z, map.width);
    c.translate(S / 2, S / 2);
    c.rotate(Math.PI + P.camYaw);
    c.scale(zoom, zoom);
    c.drawImage(map, -mx, -my);
    // locations
    for (const L of LOCATIONS) {
      if (!this.discovered.has(L.id)) continue;
      const [lx, ly] = worldToMap(L.x, L.z, map.width);
      c.fillStyle = L.kind === 'outpost' ? (G.population.cleared.has(L.id) ? '#3a6a3a' : '#a02010') : L.kind === 'town' ? '#f0d080' : '#5a3a1a';
      c.beginPath(); c.arc(lx - mx, ly - my, 3, 0, 6.28); c.fill();
    }
    // creatures nearby (seen ones)
    for (const e of G.entities) {
      if (!e.alive || e === P) continue;
      const d = e.pos.distanceTo(P.pos);
      if (d > 80) continue;
      const [ex, ey] = worldToMap(e.pos.x, e.pos.z, map.width);
      if (e.kind === 'human') c.fillStyle = e.faction === 'infected' ? '#a8e040' : e.faction === 'raider' ? (e.state === 'combat' ? '#ff3020' : '#d04030') : '#e8e0c8';
      else if (e.kind === 'dino') { if (e.faction === 'pred' && e.state !== 'chase' && d > 40 && !P.deadEye) continue; c.fillStyle = e.tamed ? '#60c0ff' : e.faction === 'pred' ? '#ff8030' : '#a0d070'; }
      c.beginPath(); c.arc(ex - mx, ey - my, e.kind === 'dino' ? 1.6 + (e.def?.size || 1) * 0.3 : 1.4, 0, 6.28); c.fill();
    }
    // objective
    const op = G.quests.markerPos();
    if (op) {
      const [ox, oy] = worldToMap(op.x, op.z, map.width);
      let dx = ox - mx, dy = oy - my;
      const maxR = (S / 2 - 8) / zoom;
      const l = Math.hypot(dx, dy);
      if (l > maxR) { dx *= maxR / l; dy *= maxR / l; }
      c.fillStyle = '#ffd040'; c.strokeStyle = '#3a2000'; c.lineWidth = 0.6;
      c.beginPath(); c.arc(dx, dy, 3.2, 0, 6.28); c.fill(); c.stroke();
    }
    c.restore();
    // player arrow (always pointing up = camera dir; rotate by body vs camera)
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(-(P.yaw - P.camYaw));
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north indicator
    const na = Math.PI + P.camYaw;
    c.fillStyle = '#f3e2b0'; c.font = 'bold 12px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', S / 2 + Math.sin(na) * (S / 2 - 10), S / 2 - Math.cos(na) * (S / 2 - 10));
  }
}
