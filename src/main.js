// JURASSIC FRONTIER — game bootstrap, main loop, interactions, persistence.
import * as THREE from 'three';
import './style.css';
import { Terrain } from './world/terrain.js';
import { Atmosphere } from './world/sky.js';
import { Water } from './world/water.js';
import { Vegetation, windUniforms } from './world/vegetation.js';
import { Structures } from './world/structures.js';
import { Colliders } from './world/colliders.js';
import { Pickups } from './world/pickups.js';
import { Player, CameraRig } from './entities/player.js';
import { Input } from './core/input.js';
import { Events } from './core/events.js';
import { Post } from './core/post.js';
import { FX } from './systems/fx.js';
import { Audio } from './systems/audio.js';
import { Combat } from './systems/combat.js';
import { Inventory } from './systems/inventory.js';
import { Quests } from './systems/quests.js';
import { Population } from './systems/population.js';
import { HUD } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { renderMap } from './ui/mapgen.js';
import { locById, LOCATIONS } from './data/world.js';
import { ITEMS } from './data/items.js';
import { DIALOGS } from './data/story.js';
import { DINO_DEFS } from './data/dinos.js';
import { SPECIES } from './entities/dinoModels.js';
import { clamp, damp, rand, pick, smoothstep } from './core/math.js';

const QUALITY = {
  low: { pr: 0.75, shadow: 1024, extent: 60, treeShadows: false, grassRadius: 28, grassDensity: 0.5, lod: 0.6, lights: 3, fog: 0.0021 },
  medium: { pr: 1, shadow: 2048, extent: 80, treeShadows: true, grassRadius: 42, grassDensity: 0.9, lod: 0.8, lights: 5, fog: 0.0017 },
  high: { pr: 1.25, shadow: 2048, extent: 100, treeShadows: true, grassRadius: 55, grassDensity: 1.3, lod: 1, lights: 7, fog: 0.0015 },
  ultra: { pr: 2, shadow: 4096, extent: 120, treeShadows: true, grassRadius: 70, grassDensity: 1.8, lod: 1.25, lights: 8, fog: 0.0013 },
};

const DEFAULT_SETTINGS = { quality: 'medium', renderScale: 1, difficulty: 'normal', sensitivity: 1, fov: 62, invertY: false, master: 0.8, music: 0.55, sfx: 1, showFps: false };
const SAVE_KEY = 'jf_save_v1';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

class Game {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('jf_settings') || '{}') };
    if (!localStorage.getItem('jf_settings')) this.settings.quality = this._autoQuality();
    this.events = new Events();
    this.entities = [];
    this.timeScale = 1;
    this.day = 1;
    this.stats = { kills: 0, headshots: 0, takedowns: 0, harvested: 0, bounties: 0, amber: 0, discovered: 0, shots: 0 };
    this.looted = new Set();
    this.state = 'loading';
    this.storm = 0; this.stormTarget = 0; this.weatherT = 300;
    this.frame = 0;
  }

  _autoQuality() {
    const mobile = /Mobi|Android/i.test(navigator.userAgent);
    if (mobile) return 'low';
    return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
  }

  async boot() {
    this.ui = new UI(this);
    const q = (this.quality = QUALITY[this.settings.quality]);
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.prepend(canvas);
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.2, 5000);
    this.input = new Input(canvas);
    this.audio = new Audio(this);
    this.hud = new HUD(this);
    this.hud.show(false);

    const step = async (p, text, fn) => { this.ui.loading(p, text); await nextFrame(); fn(); };
    await step(0.05, 'Raising the island from the sea…', () => { this.terrain = new Terrain(); this.colliders = new Colliders(); });
    await step(0.25, 'Painting the sky…', () => {
      this.atmo = new Atmosphere(this.scene, renderer);
      this.atmo.setShadowQuality(q.shadow, q.extent);
      this.scene.add(this.terrain.buildMesh(q));
      this.water = new Water(this.terrain, this.atmo);
      this.scene.add(this.water.group);
    });
    await step(0.4, 'Growing the jungle…', () => { this.vegetation = new Vegetation(this.terrain, this.colliders, q); this.scene.add(this.vegetation.group); });
    await step(0.6, 'Building Haven…', () => {
      this.structures = new Structures(this.terrain, this.colliders);
      this.structures.initLightPool(q.lights);
      this.scene.add(this.structures.group);
      this.pickups = new Pickups(this);
      this.scene.add(this.pickups.group);
    });
    await step(0.72, 'Hatching dinosaurs…', () => {
      this.fx = new FX(this.scene, this);
      this.combat = new Combat(this);
      this.player = new Player(this);
      this.entities.push(this.player);
      this.scene.add(this.player.group);
      this.cameraRig = new CameraRig(this.camera, this);
      this.inventory = new Inventory(this);
      this.population = new Population(this);
      this.quests = new Quests(this);
      this.population.init();
      const lake = locById.lake;
      this.player.spawn(lake.x + 60, lake.z + 80, Math.PI);
      this.player.group.visible = false;
    });
    await step(0.85, 'Drawing the map…', () => { this.mapCanvas = renderMap(this.terrain, 768); this.hud.setMap(this.mapCanvas); });
    await step(0.95, 'Compiling shaders…', () => {
      this.post = new Post(renderer, this.scene, this.camera);
      this.onResize();
      this.applySettings('all');
      // warm up: prime vegetation & world around the title camera
      this.vegetation.update(0, this.player.pos, true);
      this.pickups.update(this.player.pos, true);
      for (let i = 0; i < 4; i++) this.population.spawnT = 0, this.population.updateEcosystem(2);
      this.atmo.time = 17.6;
      this.atmo.update(0.01, this.player.pos, this.camera.position);
      renderer.compile(this.scene, this.camera);
    });
    addEventListener('resize', () => this.onResize());
    this.input.onUnlock = () => { if (this.state === 'game' && !this.ui.dialogActive()) this.pause(); };
    canvas.addEventListener('click', () => { if (this.state === 'game') this.input.lock(); });
    document.addEventListener('pointerdown', () => this.audio.init(), { once: false });
    addEventListener('keydown', (e) => this.onKey(e));
    this.events.on('death', (d) => this.onDeath(d));
    this.clock = new THREE.Clock();
    this.state = 'title';
    this.ui.showTitle();
    this.titleT = 0;
    this.loop();
  }

  onResize() {
    const pr = Math.min(devicePixelRatio, 2) * this.quality.pr * this.settings.renderScale;
    this.pixelRatio = Math.max(0.5, Math.min(pr, devicePixelRatio * 1.0 > 1.5 ? 2 : 1.5));
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(innerWidth, innerHeight, this.pixelRatio);
    this.fx?.setScale(innerHeight * this.pixelRatio);
  }

  applySettings(k) {
    const S = this.settings;
    if (k === 'quality' || k === 'all') {
      const q = (this.quality = QUALITY[S.quality]);
      this.atmo.setShadowQuality(q.shadow, q.extent);
      this.vegetation.quality = q;
      this.vegetation.grass.radius = q.grassRadius; this.vegetation.grass.density = q.grassDensity;
      this.vegetation.grass.last.set(1e9, 0, 0);
      this.vegetation.setShadows(q.treeShadows);
      this.vegetation.update(0, this.player.pos, true);
      this.atmo.baseFog = q.fog;
      this.post.setQuality(S.quality);
      this.renderer.shadowMap.type = S.quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      this.onResize();
    }
    if (k === 'renderScale') this.onResize();
    this.input.sensitivity = S.sensitivity;
    this.input.invertY = S.invertY;
    if (this.cameraRig) this.cameraRig.baseFov = S.fov;
    this.audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });
    this.hud.el.querySelector('#fps').style.display = S.showFps ? '' : 'none';
  }

  // ---------- game flow ----------
  hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  newGame() {
    this.audio.init();
    localStorage.removeItem(SAVE_KEY);
    this.ui.playIntro(() => {
      const b = locById.bunker;
      this.player.spawn(b.x - 2, b.z + 8, Math.PI * 0.85);
      this.atmo.time = 6.4;
      this.day = 1;
      this.startPlaying();
      this.quests.begin();
      this.hud.banner('JURASSIC FRONTIER', 'Chapter I', 'Wake Up, Ranger');
      setTimeout(() => this.hud.subtitle('Ava: "Three years in that bunker. Time to see what\'s left of the world."', 6), 1500);
    });
  }

  continueGame() {
    this.audio.init();
    if (!this.load()) { this.newGame(); return; }
    this.startPlaying();
    this.hud.toast('Game loaded');
  }

  startPlaying() {
    this.player.group.visible = true;
    this.ui.screen(null);
    this.state = 'game';
    this.hud.show(true);
    this.input.lock();
    this.vegetation.update(0, this.player.pos, true);
    this.pickups.update(this.player.pos, true);
    // re-seed creatures around the new location
    for (const e of [...this.entities]) if (e.kind === 'dino' && !e.persistent) this.population.remove(e);
    for (let i = 0; i < 5; i++) { this.population.spawnT = 0; this.population.updateEcosystem(2); }
    // guarantee easy prey for the opening hunt
    if (!this.quests.completed.includes('m1')) {
      const b = locById.bunker;
      this.population.spawnHerd('compy', b.x + 40, b.z + 30, 5);
      this.population.spawnHerd('gallimimus', b.x + 120, b.z - 20, 6);
    }
  }

  pause(tab = 'map') {
    if (this.state !== 'game') return;
    this.state = 'paused';
    this.input.unlock();
    this.ui.openPause(tab);
    this.hud.show(false);
  }

  resume() {
    this.ui.screen(null);
    this.state = 'game';
    this.hud.show(true);
    this.input.lock();
    this.input.down.clear();
  }

  onKey(e) {
    if (this.state === 'game') {
      if (this.ui.dialogActive() && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { this.ui.advanceDialog(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') this.pause('map');
      else if (e.code === 'Tab') this.pause('satchel');
      else if (e.code === 'KeyM') this.pause('map');
      else if (e.code === 'KeyJ') this.pause('journal');
    } else if (this.state === 'paused' || (this.state === 'game-panel')) {
      if (e.code === 'Escape' || (e.code === 'Tab' && this.ui.tab === 'satchel') || (e.code === 'KeyM' && this.ui.tab === 'map') || (e.code === 'KeyJ' && this.ui.tab === 'journal')) this.resume();
    }
  }

  openPanel(fn) {
    this.state = 'paused';
    this.input.unlock();
    this.hud.show(false);
    fn();
  }

  inCombat() {
    for (const e of this.entities) {
      if (!e.alive || e === this.player) continue;
      if (e.kind === 'human' && e.state === 'combat' && e.target === this.player) return true;
      if (e.kind === 'dino' && e.state === 'chase' && e.target === this.player) return true;
    }
    return false;
  }

  cameraShake(pos, amount, dur) {
    const d = pos ? pos.distanceTo(this.player.pos) : 0;
    const k = clamp(1 - d / 120, 0, 1);
    this.cameraRig.shake(amount * k);
  }

  // ---------- interactions ----------
  findInteraction() {
    const P = this.player;
    if (P.mounted || !P.alive) return null;
    let best = null, bd = Infinity;
    const consider = (d, obj) => { if (d < bd) { bd = d; best = obj; } };
    const pp = P.pos;
    for (const e of this.entities) {
      if (e === P) continue;
      const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      if (d > (e.radius || 0.5) + 6) continue;
      if (e.kind === 'human') {
        if (e.alive && e.faction === 'haven' && d < 2.8 && (e.lines || e.npcId)) consider(d, { type: 'talk', e, label: `Talk to ${e.name}${e.npcId && this.quests.wantsTalk(e.npcId) ? ' <b class="q">!</b>' : ''}` });
        else if (!e.alive && !e.looted && d < 2.2) consider(d, { type: 'lootBody', e, label: 'Search body' });
      } else if (e.kind === 'dino') {
        const reach = e.radius + 2;
        if (!e.alive && !e.lootTaken && d < reach + 1.5) consider(d - 1, { type: 'harvest', e, label: `Harvest ${e.flyer ? 'Pteranodon' : SPECIES[e.kindName].label}` });
        else if (e.alive && e.tamed && d < reach + 1) consider(d, { type: 'ride', e, label: 'Ride  <kbd>F</kbd>', key: 'F' });
        else if (e.alive && e.def.mountable && !e.tamed && d < reach + 2.5 && e.state !== 'flee') {
          consider(d, this.inventory.count('bait') > 0 ? { type: 'tame', e, label: 'Hold <kbd>E</kbd> to tame (uses 1 Meat Bait)' } : { type: 'none', label: 'You need Meat Bait to tame this animal' });
        }
      }
    }
    for (const it of this.structures.interactables) {
      if (it.done) continue;
      const d = it.pos.distanceTo(pp);
      if (d < it.radius) consider(d, { type: 'struct', it, label: it.label });
    }
    const pk = this.pickups.nearest(pp);
    if (pk) consider(pk.pos.distanceTo(pp) + 0.3, { type: 'pickup', p: pk, label: pk.label });
    return best;
  }

  handleInteraction(dt) {
    const I = this.input;
    const it = this.findInteraction();
    const P = this.player;
    if (P.mounted) { this.hud.prompt('<kbd>F</kbd> Dismount'); this.hud.progress(0); return; }
    if (!it) { this.hud.prompt(''); this.hud.progress(0); this.tameT = 0; return; }
    this.hud.prompt(it.key ? it.label : (it.type === 'none' ? it.label : `<kbd>E</kbd> ${it.label.replace('Hold <kbd>E</kbd> to', 'Hold to')}`));
    if (it.type === 'ride') { if (I.hit('KeyF') || I.hit('KeyE')) { P.mount(it.e); this.events.emit('mount', {}); } return; }
    if (it.type === 'tame') {
      if (I.key('KeyE')) {
        this.tameT = (this.tameT || 0) + dt;
        it.e.desiredSpeed = 0; it.e.state = 'graze'; it.e.anim.eat = 1;
        this.hud.progress(this.tameT / 2.5);
        P.rig.anim.interact = damp(P.rig.anim.interact, 1, 6, dt);
        if (this.tameT >= 2.5) {
          this.tameT = 0; this.hud.progress(0);
          this.inventory.remove('bait', 1);
          this.population.setMount(it.e);
          this.hud.banner('TAMED', it.e.kindName === 'para' ? 'Parasaurolophus' : 'Gallimimus', 'Press F to ride · H to whistle');
          this.audio.ui('quest');
          this.events.emit('tame', { e: it.e });
          this.save();
        }
      } else { this.tameT = 0; this.hud.progress(0); }
      return;
    }
    P.rig.anim.interact = damp(P.rig.anim.interact, 0, 6, dt);
    if (!I.hit('KeyE')) return;
    P.rig.anim.interact = 1;
    switch (it.type) {
      case 'talk': {
        const e = it.e;
        e.faceYaw = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
        if (e.npcId && this.quests.talk(e.npcId)) return;
        e.waving = 1.5;
        this.hud.subtitle(`${e.name}: "${pick(e.lines || ['Howdy.'])}"`, 4);
        break;
      }
      case 'lootBody': {
        it.e.looted = true;
        const money = Math.round(rand(2, 9) * (it.e.role === 'boss' ? 10 : 1));
        this.inventory.add('money', money);
        if (it.e.gun) this.inventory.add(it.e.gun === 'rifle' ? 'rifleAmmo' : 'pistolAmmo', Math.round(rand(3, 8)));
        if (Math.random() < 0.3) this.inventory.add('bandage', 1);
        break;
      }
      case 'harvest': {
        const e = it.e;
        e.lootTaken = true;
        const loot = DINO_DEFS[e.kindName].loot;
        for (const [k, n] of Object.entries(loot)) this.inventory.add(k, Math.max(1, Math.round(n * e.scale)));
        this.stats.harvested++;
        this.fx.blood(e.pos.clone().setY(e.pos.y + 0.5), 14);
        this.events.emit('loot', { kind: 'dino', e });
        break;
      }
      case 'pickup': this.pickups.take(it.p); break;
      case 'struct': this.structAction(it.it); break;
    }
  }

  structAction(it) {
    const P = this.player, Q = this.quests;
    const step = Q.step;
    switch (it.action) {
      case 'campfire': this.openPanel(() => this.campMenu()); break;
      case 'loot': {
        if (this.looted.has(it.id)) { this.hud.toast('Already searched'); return; }
        if (it.id === 'fusecrate') { if (!(step && step.id === 'fusecrate')) { this.hud.toast('Locked tight. Black Fang property.'); return; } this.inventory.add('fuse', 1); }
        else if (it.id === 'labcrate') { if (!(step && step.id === 'labcrate')) { this.hud.toast('Nothing useful right now.'); return; } this.inventory.add('radioPart', 1); }
        else if (it.id === 'cranecrate') { if (!(step && step.id === 'cranecrate')) { this.hud.toast('Locked. Crane keeps the key.'); return; } this.inventory.add('money', 200); this.inventory.add('rifleAmmo', 16); }
        else {
          const table = [['pistolAmmo', 6, 12], ['rifleAmmo', 4, 8], ['arrow', 4, 8], ['bandage', 1, 2], ['money', 5, 20], ['flint', 2, 3], ['amber', 1, 1], ['tonic', 1, 1], ['herb', 1, 2]];
          for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const [k, a, b] = pick(table); this.inventory.add(k, Math.round(rand(a, b))); }
        }
        this.looted.add(it.id);
        if (it.mesh) it.mesh.visible = false;
        it.done = true;
        this.audio.ui('pickup');
        this.events.emit('interact', { action: 'loot', id: it.id });
        break;
      }
      case 'climb': this.fadeTeleport(it.to, () => this.hud.toast('Press E at the ladder to climb down')); if (!it.down) { it.down = { pos: it.to.clone(), radius: 1.8, label: 'Climb down', action: 'climbdown', to: it.pos.clone(), id: it.id + 'd' }; this.structures.interactables.push(it.down); } break;
      case 'climbdown': this.fadeTeleport(it.to); break;
      case 'shop': this.openPanel(() => this.ui.openShop(it.id)); this.events.emit('interact', { action: 'shop', id: it.id }); break;
      case 'doctor':
        if (P.hp >= P.maxHp) { this.hud.subtitle('Dr. Okafor: "You\'re in one piece. Go on."'); return; }
        if (this.inventory.count('money') < 10) { this.hud.toast('Not enough money'); return; }
        this.inventory.remove('money', 10); P.hp = P.maxHp; P.blind = 0; this.hud.toast('Patched up'); this.audio.ui('money'); break;
      case 'bounty': this.population.startBounty(); break;
      case 'sleep':
        if (this.inventory.count('money') < 5) { this.hud.toast('Pike: "Five dollars, ranger. No credit."'); return; }
        this.inventory.remove('money', 5); this.sleepUntil(7); break;
      case 'power':
        if (!(step && step.action === 'power')) { this.hud.toast(this.quests.flags.power ? 'The turbines hum steadily.' : 'The main fuse is missing.'); return; }
        this.inventory.remove('fuse', 1);
        it.done = true;
        this.events.emit('interact', { action: 'power', id: 'power' });
        this.cameraShake(null, 0.5);
        this.audio.dino('trex', 'roar', P.pos.clone().add(new THREE.Vector3(200, 0, 200)));
        this.hud.subtitle('Somewhere out in the jungle, something very large objects to the noise.', 5);
        break;
      case 'radio':
        if (!(step && step.action === 'radio')) { this.hud.toast(this.inventory.count('radioPart') ? '' : 'The transmitter needs a crystal oscillator.'); return; }
        this.inventory.remove('radioPart', 1);
        this.ui.dialog(DIALOGS.radio_call, () => this.events.emit('interact', { action: 'radio', id: 'radio' }));
        break;
      case 'boat':
        if (!(step && step.action === 'boat')) { this.hud.toast('The boat has no fuel. Not yet.'); return; }
        this.ui.dialog(DIALOGS.boat, () => { this.events.emit('interact', { action: 'boat', id: 'boat' }); this.openPanel(() => this.ui.showEndingChoice()); });
        break;
    }
  }

  campMenu() {
    const raw = this.inventory.count('meat');
    this.ui.panel(`<div class="camp"><h3>Campfire</h3><p>The fire crackles. For a moment, the island feels almost peaceful.</p>
      <button onclick="__game.campAction('cook')" ${raw ? '' : 'disabled'}>Cook meat (${raw} raw)</button>
      <button onclick="__game.campAction('dawn')">Rest until dawn</button>
      <button onclick="__game.campAction('dusk')">Rest until dusk</button>
      <button onclick="__game.campAction('save')">Save game</button></div>`, false);
  }
  campAction(a) {
    this.audio.ui('click');
    if (a === 'cook') { const n = this.inventory.remove('meat', 99); this.inventory.add('cookedMeat', n, true); this.hud.toast(`Cooked ${n} meat`); this.campMenu(); }
    if (a === 'dawn') { this.resume(); this.sleepUntil(6.5); }
    if (a === 'dusk') { this.resume(); this.sleepUntil(18.2); }
    if (a === 'save') { this.save(true); this.campMenu(); }
  }

  sleepUntil(hour) {
    this.fade(1.2, () => {
      const t = this.atmo.time;
      if (hour <= t) this.day++;
      this.atmo.time = hour;
      this.player.hp = this.player.maxHp; this.player.stamina = this.player.maxStamina; this.player.blind = 0;
      this.atmo.refreshEnv();
      this.save();
      this.hud.toast(`Rested until ${Math.floor(hour)}:${hour % 1 ? '30' : '00'}`);
    });
  }

  fade(dur, mid) {
    this.fadeAnim = { t: 0, dur, mid, did: false };
  }
  fadeTeleport(to, after) {
    this.fade(0.6, () => { this.player.pos.copy(to); this.player.vy = 0; this.player.vel.set(0, 0, 0); after?.(); });
  }

  travelTo(L) {
    this.resume();
    this.fade(1.5, () => {
      const ang = rand(0, 6.28), r = Math.max(8, (L.r || 10) * 0.4);
      let x = L.x + Math.sin(ang) * r, z = L.z + Math.cos(ang) * r;
      if (L.id === 'haven') { x = L.x + rand(-3, 3); z = L.z + 20; }
      this.player.spawn(x, z, this.player.yaw);
      this.atmo.time = (this.atmo.time + 2) % 24;
      const m = this.population.mount;
      if (m && m.alive) { m.pos.set(x + 4, this.terrain.getHeight(x + 4, z + 3), z + 3); m.syncTransform(); }
      this.vegetation.update(0, this.player.pos, true);
      this.pickups.update(this.player.pos, true);
    });
  }

  // ---------- events ----------
  onDeath({ entity, source }) {
    if (entity.kind === 'dino' && entity === this.population.mount) this.hud.toast('Your mount has died', 'danger');
  }

  onPlayerDeath() {
    const src = this.player.lastAttacker;
    const cause = src ? (src.kind === 'dino' ? `Killed by a ${src.flyer ? 'Pteranodon' : SPECIES[src.kindName].label}.` : `Gunned down by ${src.name || 'a raider'}.`) : 'The island claimed you.';
    this.audio.ui('fail');
    if (this.player.deadEye) this.combat.endDeadEye();
    setTimeout(() => { this.state = 'dead'; this.input.unlock(); this.hud.show(false); this.ui.showDeath(cause); }, 2600);
  }

  respawn() {
    const P = this.player;
    const atHaven = this.hud.discovered.has('haven');
    const L = atHaven ? locById.haven : locById.bunker;
    P.alive = true; P.hp = P.maxHp; P.stamina = P.maxStamina; P.blind = 0; P.rig.anim.dead = 0; P.group.rotation.x = 0;
    P.lastAttacker = null;
    if (P.mounted) P.dismount();
    const lost = Math.floor(this.inventory.count('money') * 0.1);
    this.inventory.remove('money', lost);
    P.spawn(L.x + (atHaven ? 0 : -2), L.z + (atHaven ? 22 : 8), Math.PI);
    this.atmo.time = (this.atmo.time + 6) % 24;
    // calm the hunters
    for (const e of this.entities) { if (e.target === P) { e.target = null; if (e.setState) e.setState(e.kind === 'human' ? 'patrol' : 'wander'); } if (e.kind === 'human') e.awareness = 0; }
    this.startPlaying();
    if (lost) this.hud.toast(`Lost $${lost} while recovering`);
  }

  onPowerRestored() {
    // Haven's fence and lights come back on: brighten windows, enable more lamps
    for (const L of this.structures.lights) if (L.lamp) L.base *= 1.4;
    this.hud.toast('Haven has power again!');
  }

  afterEnding(choice) {
    this.quests.flags.ending = choice;
    this.save();
    this.resume();
    this.hud.banner('FREE ROAM', 'The island is yours', 'Bounties, hunting and secrets await');
  }

  // ---------- save / load ----------
  save(announce = false) {
    if (this.state === 'title' || !this.player.alive) return;
    const P = this.player, m = this.population.mount;
    const data = {
      v: 1, t: Date.now(),
      player: { x: P.pos.x, z: P.pos.z, yaw: P.yaw, hp: P.hp, maxHp: P.maxHp, weapons: P.weapons, clip: P.ammoClip, upgrades: [...P.upgrades], weaponIdx: P.weaponIdx },
      inv: this.inventory.items, crafted: [...this.inventory.crafted],
      quests: this.quests.serialize(), cleared: [...this.population.cleared], looted: [...this.looted],
      taken: [...this.pickups.taken], discovered: [...this.hud.discovered], time: this.atmo.time, day: this.day,
      mount: m && m.alive ? { kind: m.kindName, x: m.pos.x, z: m.pos.z, scale: m.scale } : null, stats: this.stats,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); if (announce) this.hud.toast('Game saved'); } catch (e) { console.warn(e); }
  }

  load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
    if (!d) return false;
    const P = this.player;
    P.spawn(d.player.x, d.player.z, d.player.yaw);
    P.hp = d.player.hp; P.maxHp = d.player.maxHp; P.weapons = d.player.weapons; P.ammoClip = d.player.clip; P.upgrades = new Set(d.player.upgrades); P.weaponIdx = Math.min(d.player.weaponIdx, P.weapons.length - 1);
    this.inventory.items = d.inv; this.inventory.crafted = new Set(d.crafted);
    this.population.cleared = new Set(d.cleared);
    this.looted = new Set(d.looted);
    for (const it of this.structures.interactables) if (this.looted.has(it.id)) { it.done = true; if (it.mesh) it.mesh.visible = false; }
    this.pickups.taken = new Map(d.taken);
    this.hud.discovered = new Set(d.discovered);
    this.atmo.time = d.time; this.day = d.day;
    Object.assign(this.stats, d.stats);
    this.quests.load(d.quests);
    if (this.quests.flags.power) { this.onPowerRestored(); const pw = this.structures.interactables.find((i) => i.id === 'power'); if (pw) pw.done = true; }
    if (d.mount) {
      const herd = this.population.spawnHerd(d.mount.kind, d.mount.x, d.mount.z, 1);
      const m = herd.members[0];
      if (m) this.population.setMount(m);
    }
    return true;
  }

  // Debug/test hook: advance the simulation without rendering.
  tick(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) {
      this.updateGame(step);
      this.scene.updateMatrixWorld();
      this.input.pressed.clear(); this.input.mouse.pressed = 0;
    }
  }

  // ---------- loop ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const realDt = Math.min(0.05, this.clock.getDelta());
    this.frame++;
    this._fps = (this._fps || 60) * 0.95 + (1 / Math.max(realDt, 1e-4)) * 0.05;
    if (this.settings.showFps && this.frame % 15 === 0) this.hud.el.querySelector('#fps').textContent = `${Math.round(this._fps)} fps · ${this.renderer.info.render.calls} draws · ${(this.renderer.info.render.triangles / 1000).toFixed(0)}k tris`;
    if (this.state === 'game' || this.state === 'dead') this.updateGame(realDt);
    else if (this.state === 'title') this.updateTitle(realDt);
    else if (this.state === 'paused') { /* frozen */ }
    if (this.state === 'paused' && this.ui.tab === 'map' && this.frame % 30 === 0) { /* static */ }
    // fade overlay
    if (this.fadeAnim) {
      const f = this.fadeAnim;
      f.t += realDt;
      const half = f.dur / 2;
      this.post.u.uFade.value = f.t < half ? f.t / half : Math.max(0, 1 - (f.t - half) / half);
      if (f.t >= half && !f.did) { f.did = true; f.mid?.(); }
      if (f.t >= f.dur) { this.fadeAnim = null; this.post.u.uFade.value = 0; }
    }
    if (this.state !== 'loading') { this.renderer.info.reset(); this.post.render(realDt); }
    this.input.endFrame();
  }

  updateWorld(dt, realDt, focus) {
    const night = this.atmo.uniforms.uNight.value;
    this.atmo.storm = this.storm;
    this.atmo.update(dt, focus, this.camera.position);
    this.water.update(dt, this.camera.position);
    windUniforms.uWind.value = 1 + this.storm * 1.5;
    this.vegetation.update(dt, this.camera.position, false, this.camera.getWorldDirection(this._camDir || (this._camDir = new THREE.Vector3())));
    this.structures.update(dt, performance.now() / 1000, this.camera.position, night);
    this.fx.update(dt, this.camera.position, this.storm, night);
    this.post.u.uNight.value = night;
  }

  updateEntities(dt) {
    const P = this.player;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e === P) continue;
      const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
      e.group.visible = d < 520;
      // far entities tick at reduced rate
      if (d > 220) {
        e._acc = (e._acc || 0) + dt;
        if ((this.frame + e.id) % 4 !== 0) continue;
        e.update(e._acc); e._acc = 0;
      } else e.update(dt);
    }
  }

  updateTitle(realDt) {
    this.titleT += realDt;
    // slow drift across Brachiosaur Lake as the giants drink at sunset
    const L = locById.lake;
    const herd = this.population.rex && this.entities.find((e) => e.kindName === 'brachio');
    const a = 0.6 + this.titleT * 0.025;
    const r = 95;
    const cx = L.x + Math.sin(a) * r, cz = L.z + Math.cos(a) * r;
    const cy = Math.max(this.terrain.getHeight(cx, cz), 0) + 9 + Math.sin(this.titleT * 0.1) * 2;
    this.camera.position.set(cx, cy, cz);
    const tgt = herd ? herd.pos : new THREE.Vector3(L.x, 0, L.z);
    this._titleLook = this._titleLook || tgt.clone();
    this._titleLook.lerp(new THREE.Vector3(tgt.x, tgt.y + 8, tgt.z), 0.02);
    this.camera.lookAt(this._titleLook);
    this.audio.setListener(this.camera.position, a);
    this.atmo.time = 17.6 + Math.sin(this.titleT * 0.02) * 0.3;
    this.updateWorld(realDt, realDt, this.camera.position);
    this.updateEntities(realDt);
    this.audio.updateMusic(realDt, false, true);
  }

  updateGame(realDt) {
    const dt = realDt * this.timeScale;
    const P = this.player, I = this.input;
    const dialog = this.ui.dialogActive();
    if (dialog) { I.mouse.dx = I.mouse.dy = 0; }
    if (dialog) I.enabled = false;
    P.update(dt, I, this.camera);
    I.enabled = true;
    if (!dialog && P.alive && this.state === 'game') {
      this.handleInteraction(dt);
      if (I.hit('KeyH')) this.population.whistle();
      if (I.hit('KeyG')) { if (!this.inventory.use('cookedMeat') && !this.inventory.use('meat') && !this.inventory.use('berries')) this.hud.toast('No food'); }
      if (I.hit('KeyB')) { if (!this.inventory.use('bandage')) this.hud.toast(this.inventory.count('bandage') ? 'Already at full health' : 'No bandages'); }
    }
    this.combat.update(dt, realDt, I);
    this.updateEntities(dt);
    this.population.updateEcosystem(dt);
    this.quests.update(dt);
    this.pickups.update(P.pos);
    // weather
    this.weatherT -= dt;
    if (this.weatherT <= 0) { this.weatherT = rand(180, 420); this.stormTarget = Math.random() < 0.28 ? rand(0.6, 1) : 0; }
    this.storm = damp(this.storm, this.stormTarget, 0.08, dt);
    const thunder = this.storm > 0.7 && Math.random() < dt * 0.06;
    if (thunder) { this.atmo.hemi.intensity += 4; this.cameraShake(null, 0.1); }
    this.updateWorld(dt, realDt, P.pos);
    this.cameraRig.update(dt, realDt);
    this.audio.setListener(this.camera.position, P.camYaw);
    const T = this.terrain;
    let coast = 0;
    for (const [dx, dz] of [[30, 0], [-30, 0], [0, 30], [0, -30]]) if (T.getHeight(P.pos.x + dx, P.pos.z + dz) < 0) coast += 0.25;
    this.audio.updateAmbience(realDt, { night: this.atmo.isNight(), rain: this.storm, storm: this.storm, coast, altitude: P.pos.y, jungle: 1, thunder });
    this.audio.updateMusic(realDt, this.inCombat(), false);
    this.post.u.uDeadEye.value = damp(this.post.u.uDeadEye.value, P.deadEye ? 1 : 0, 8, realDt);
    this.post.u.uDamage.value = Math.max(this.hud.dmgT * 0.8, P.hp / P.maxHp < 0.3 ? 0.4 : 0);
    this.hud.update(realDt);
    this.hud.el.querySelector('#clickhint').style.display = this.input.locked || this.ui.dialogActive() || !P.alive ? 'none' : 'block';
    this.autoSaveT = (this.autoSaveT || 0) + realDt;
    if (this.autoSaveT > 60 && !this.inCombat()) { this.autoSaveT = 0; this.save(); }
    // day counter
    if (this._lastHour > 23 && this.atmo.time < 1) this.day++;
    this._lastHour = this.atmo.time;
  }
}

const game = new Game();
window.__game = game;
game.V3 = THREE.Vector3;
game.THREE = THREE;
game.boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#100c08;color:#f3e2b0;font:18px Georgia;z-index:999;padding:40px;text-align:center">Something went wrong starting the game.<br><br><small>${String(e.message || e)}</small><br><br><small>A WebGL2-capable browser is required (Chrome, Edge, Firefox, Safari 15+).</small></div>`);
});
