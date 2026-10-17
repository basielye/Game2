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
import { DIALOGS, FIELD_GUIDE } from './data/story.js';
import { DINO_DEFS } from './data/dinos.js';
import { SPECIES } from './entities/dinoModels.js';
import { clamp, damp, rand, pick, smoothstep } from './core/math.js';
import { store } from './core/storage.js';
import { patchScene, setCSM, fogUniforms } from './core/matpatch.js';
import { loadTerrainTextures } from './core/assets.js';
import { loadPhotoscans } from './world/photoscans.js';
import { buildFlora, foliageUniforms } from './world/flora.js';
import { loadHumans, updateHumanLODs } from './entities/humanoid.js';

const QUALITY = {
  low: { pr: 0.75, shadow: 1024, extent: 60, treeShadows: false, grassRadius: 28, grassDensity: 0.5, lod: 0.6, lights: 3, fog: 0.0012, csm: 0 },
  medium: { pr: 1, shadow: 2048, extent: 80, treeShadows: true, grassRadius: 42, grassDensity: 0.9, lod: 0.8, lights: 5, fog: 0.0012, csm: 2, csmSize: 1536, csmFar: 260 },
  high: { pr: 1.25, shadow: 2048, extent: 100, treeShadows: true, grassRadius: 55, grassDensity: 1.3, lod: 1, lights: 7, fog: 0.0012, csm: 3, csmSize: 2048, csmFar: 320 },
  ultra: { pr: 2, shadow: 4096, extent: 120, treeShadows: true, grassRadius: 70, grassDensity: 1.8, lod: 1.25, lights: 8, fog: 0.0012, csm: 4, csmSize: 2048, csmFar: 650, midShadows: true },
};

const DEFAULT_SETTINGS = { quality: 'medium', renderScale: 1, adaptive: true, difficulty: 'normal', sensitivity: 1, fov: 62, invertY: false, master: 0.8, music: 0.55, sfx: 1, showFps: false };
const SAVE_KEY = 'jf_save_v1';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

class Game {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS, ...store.json('jf_settings', {}) };
    if (!store.get('jf_settings')) this.settings.quality = this._autoQuality();
    this.events = new Events();
    this.entities = [];
    this.timeScale = 1;
    this.day = 1;
    this.stats = { kills: 0, headshots: 0, takedowns: 0, harvested: 0, bounties: 0, amber: 0, discovered: 0, shots: 0 };
    this.looted = new Set();
    this.seen = new Set();
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
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.2, 5000);
    this.input = new Input(canvas);
    this.audio = new Audio(this);
    this.hud = new HUD(this);
    this.hud.show(false);

    const step = async (p, text, fn) => { this.ui.loading(p, text); await nextFrame(); await fn(); };
    await step(0.05, 'Raising the island from the sea…', () => { this.terrain = new Terrain(); this.colliders = new Colliders(); });
    await step(0.18, 'Loading photographic terrain…', async () => { this.terrain.textures = await loadTerrainTextures(q.lod >= 1 ? 1024 : 512); });
    await step(0.25, 'Painting the sky…', () => {
      this.atmo = new Atmosphere(this.scene, renderer, this.camera);
      this.atmo.setShadowQuality(q.shadow, q.extent);
      this.atmo.enableCSM(q.csm, q.csmSize, q.csmFar);
      setCSM(this.atmo.csm);
      fogUniforms.uSkyLUT.value = this.atmo.lutRT.texture;
      this.scene.add(this.terrain.buildMesh(q));
      this.water = new Water(this.terrain, this.atmo);
      this.scene.add(this.water.group);
    });
    await step(0.34, 'Loading photoscanned rock…', async () => { try { this.scans = await loadPhotoscans(renderer); } catch (e) { console.warn('photoscans unavailable', e); this.scans = null; } });
    await step(0.37, 'Growing rainforest trees…', async () => { try { this.flora = await buildFlora(renderer, q); } catch (e) { console.warn('flora fallback', e); this.flora = null; } });
    await step(0.39, 'Casting the survivors…', async () => { try { await loadHumans(renderer, ['ava', 'settlerM', 'settlerF', 'marshal', 'raider', 'raiderF', 'crane', 'doctor', 'infected', 'infectedF']); } catch (e) { console.warn('humans fallback', e); } });
    await step(0.4, 'Growing the jungle…', () => { this.vegetation = new Vegetation(this.terrain, this.colliders, q, this.scans, this.flora); this.scene.add(this.vegetation.group); });
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
      patchScene(this.scene);
      renderer.compile(this.scene, this.camera);
    });
    addEventListener('resize', () => this.onResize());
    this.input.onUnlock = () => { if (this.state === 'game' && !this.ui.dialogActive() && !this.input.padActive) this.pause(); };
    this.input.onVirtualKey = (code) => this.onKey({ code });
    this.input.onMenuNav = (dx, dy) => this.ui.navFocus(dx, dy);
    this.input.onMenuSelect = () => this.ui.selectFocus();
    this.input.onMenuBack = () => this.ui.back();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.state = 'paused'; document.body.insertAdjacentHTML('beforeend', '<div id="ctxlost" style="position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.85);color:#f3e2b0;font:22px Georgia;text-align:center">The graphics device was reset.<br><small>Your progress is saved. Reload the page to continue.</small></div>'); this.save(); });
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
    const pr = Math.min(devicePixelRatio, 2) * this.quality.pr * this.settings.renderScale * (this.dynScale || 1);
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
  hasSave() { return !!store.get(SAVE_KEY); }

  newGame() {
    this.audio.init();
    store.remove(SAVE_KEY);
    this.ui.playIntro(() => {
      const b = locById.bunker;
      this.player.spawn(b.x - 2, b.z + 8, Math.atan2(80 - b.x, 400 - b.z));
      this.atmo.time = 6.4;
      this.day = 1;
      this.startPlaying();
      this.quests.begin();
      this.hud.banner('JURASSIC FRONTIER', 'Chapter I', 'Wake Up, Ranger');
      // sweep down from the canopy to Ava at the bunker door
      const P = this.player, look = P.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
      const from = P.pos.clone().add(new THREE.Vector3(-40, 38, -30));
      const to = P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw) * 3.8, 2.0, -Math.cos(P.yaw) * 3.8));
      P.camYaw = P.yaw; P.camPitch = -0.1;
      this.hud.letterbox(true);
      this.cameraRig.startCinematic(from, to, look.clone().add(new THREE.Vector3(30, 0, 40)), look, 6, () => this.hud.letterbox(false));
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
        else if (!e.alive && !e.looted && d < 2.2 && e.role !== 'infected') consider(d, { type: 'lootBody', e, label: 'Search body' });
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
    const cause = src ? (src.kind === 'dino' ? `Killed by a ${src.flyer ? 'Pteranodon' : SPECIES[src.kindName].label}.` : src.role === 'infected' ? 'Torn apart by the Infected.' : `Gunned down by ${src.name || 'a raider'}.`) : 'The island claimed you.';
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
      mount: m && m.alive ? { kind: m.kindName, x: m.pos.x, z: m.pos.z, scale: m.scale } : null, stats: this.stats, seen: [...this.seen],
    };
    if (store.set(SAVE_KEY, JSON.stringify(data))) { if (announce) this.hud.toast('Game saved'); } else if (announce) this.hud.toast('Could not save: browser storage is unavailable', 'danger');
  }

  load() {
    let d;
    d = store.json(SAVE_KEY, null);
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
    this.seen = new Set(d.seen || []);
    this.quests.load(d.quests);
    if (this.quests.flags.power) { this.onPowerRestored(); const pw = this.structures.interactables.find((i) => i.id === 'power'); if (pw) pw.done = true; }
    if (d.mount) {
      const herd = this.population.spawnHerd(d.mount.kind, d.mount.x, d.mount.z, 1);
      const m = herd.members[0];
      if (m) this.population.setMount(m);
    }
    return true;
  }

  // Contextual one-time hints that teach mechanics when they first matter.
  hint(id, html) {
    this.hintsShown ||= new Set(store.json('jf_hints', []));
    if (this.hintsShown.has(id)) return;
    this.hintsShown.add(id);
    store.set('jf_hints', JSON.stringify([...this.hintsShown]));
    this.hud.hint(html);
  }
  checkHints(dt) {
    this._hintT = (this._hintT || 0) - dt;
    if (this._hintT > 0 || this.cameraRig.cinematic || this.ui.dialogActive()) return;
    this._hintT = 1;
    const P = this.player, I = this.inventory, Q = this.quests;
    if (this.pickups.nearest(P.pos, 8)) this.hint('gather', 'Walk up to glinting resources and press <kbd>E</kbd> to gather them.');
    if (I.count('wood') >= 3 && I.count('fiber') >= 3 && !P.weapons.includes('bow')) this.hint('satchel', 'Press <kbd>Tab</kbd> to open your satchel and craft a <b>Hunting Bow</b>.');
    if (P.weapon === 'bow') this.hint('bow', 'Hold <kbd>Right Mouse</kbd> to aim, then hold and release <kbd>Left Mouse</kbd> to shoot. A full draw flies farther.');
    if (this.entities.some((e) => e.kind === 'dino' && e.alive && e.def.diet === 'herb' && e.pos.distanceTo(P.pos) < 45)) this.hint('crouch', 'Animals hear you coming. Press <kbd>C</kbd> to crouch and sneak closer.');
    if (Q.step && Q.step.type === 'goto') this.hint('map', 'Follow the gold marker on your compass. Press <kbd>M</kbd> for the map.');
    if (this.atmo.isNight()) this.hint('lantern', 'Night has fallen. Press <kbd>L</kbd> to light your lantern — predators hunt in the dark.');
    if (P.hp < P.maxHp * 0.45) this.hint('heal', 'You\'re hurt. <kbd>B</kbd> uses a bandage, <kbd>G</kbd> eats food. Rest at campfires to recover fully.');
    if (P.aiming && P.wdef.type === 'gun' && P.focus > 40) this.hint('deadeye', 'Press <kbd>Q</kbd> while aiming to enter <b>Dead Eye</b>: sweep across targets to mark them, then click to fire.');
    if (P.mounted) this.hint('ride', '<kbd>Shift</kbd> to gallop, <kbd>Space</kbd> to leap, <kbd>F</kbd> to dismount. <kbd>H</kbd> whistles your mount from anywhere.');
    if (this.entities.some((e) => e.kind === 'human' && e.faction === 'raider' && e.alive && e.pos.distanceTo(P.pos) < 90)) this.hint('stealth', 'Raiders ahead. The eye above their heads fills as they notice you. Stay crouched; silent bow and machete kills keep the others unaware.');
  }

  // Field guide: document each species the first time it is seen up close.
  checkSightings(dt) {
    this._sightT = (this._sightT || 0) - dt;
    if (this._sightT > 0) return;
    this._sightT = 0.5;
    const P = this.player, cam = this.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    for (const e of this.entities) {
      if (!e.alive || e === P) continue;
      const key = e.kind === 'dino' ? e.kindName : e.role === 'infected' ? 'infected' : null;
      if (!key || this.seen.has(key) || !FIELD_GUIDE[key]) continue;
      const to = e.pos.clone().sub(cam.position);
      const d = to.length();
      const range = key === 'brachio' || key === 'trex' ? 110 : key === 'ptera' ? 90 : 45;
      if (d > range || to.normalize().dot(fwd) < 0.75) continue;
      this.seen.add(key);
      this.hud.discoverSpecies(FIELD_GUIDE[key][0]);
      if (key === 'trex' && e.pos.distanceTo(P.pos) < 90) {
        e.target = P; e.setState('roar');
        this.timeScale = 0.45; this.slowmoT = 2.2;
        this.cameraShake(e.pos, 0.6);
        this.hud.banner('', 'TYRANNOSAURUS REX', 'Run.');
      }
      break;
    }
  }

  // Dynamic resolution: trade pixels for framerate on weaker laptops.
  adaptResolution(realDt) {
    if (!this.settings.adaptive) { if (this.dynScale !== 1) { this.dynScale = 1; this.onResize(); } return; }
    this.dynScale ||= 1;
    this._adT = (this._adT || 0) + realDt;
    this._adF = (this._adF || 0) + 1;
    if (this._adT < 2.5) return;
    const fps = this._adF / this._adT;
    this._adT = 0; this._adF = 0;
    let next = this.dynScale;
    if (fps < 38) next = Math.max(0.55, this.dynScale - (fps < 25 ? 0.15 : 0.08));
    else if (fps > 57) next = Math.min(1, this.dynScale + 0.05);
    if (Math.abs(next - this.dynScale) > 0.01) { this.dynScale = next; this.onResize(); }
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
    this.input.pollGamepad(realDt, this.state !== 'game' && this.state !== 'dead' ? true : this.state === 'dead');
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
    foliageUniforms.uTime.value += dt;
    updateHumanLODs(this.camera, this.settings.quality === "ultra" ? 1.5 : this.settings.quality === "low" ? 0.6 : 1);
    foliageUniforms.uWind.value = 1 + this.storm * 1.8;
    const ld = this.atmo.sunDir.y > -0.05 ? this.atmo.sunDir : this.atmo.moonDir;
    foliageUniforms.uSunView.value.copy(ld).transformDirection(this.camera.matrixWorldInverse);
    foliageUniforms.uSunCol.value.copy(this.atmo.uniforms.uSunColor.value).multiplyScalar(this.atmo.sunDir.y > -0.05 ? 0.9 : 0.04);
    this.vegetation.update(dt, this.camera.position, false, this.camera.getWorldDirection(this._camDir || (this._camDir = new THREE.Vector3())));
    this.structures.update(dt, performance.now() / 1000, this.camera.position, night);
    this.fx.update(dt, this.camera.position, this.storm, night);
    this.post.u.uNight.value = night;
    fogUniforms.uFogSun.value.copy(this.atmo.sunDir.y > -0.05 ? this.atmo.sunDir : this.atmo.moonDir);
    fogUniforms.uFogSunCol.value.copy(this.atmo.uniforms.uSunColor.value).multiplyScalar(this.atmo.sunDir.y > -0.05 ? 1 : 0.05);
    fogUniforms.uFogDensity.value = 0.0011 * (1 + this.storm * 3) * (1 + night * 0.5);
    fogUniforms.uHaze.value = 0.00011 * (1 + this.storm * 4);
    this._patchT = (this._patchT || 0) - realDt;
    if (this._patchT <= 0) { this._patchT = 1; patchScene(this.scene); }
    const csm = this.atmo.csm;
    if (csm && Math.abs((this._csmFov || 0) - this.camera.fov) > 0.6) { this._csmFov = this.camera.fov; csm.updateFrustums(); }
    // god rays toward the on-screen sun
    const u = this.post.u;
    if (this.settings.quality === 'high' || this.settings.quality === 'ultra') {
      const sd = this.atmo.sunDir;
      const sp = this._sunP || (this._sunP = new THREE.Vector3());
      sp.copy(this.camera.position).addScaledVector(sd, 1000).project(this.camera);
      const facing = this.camera.getWorldDirection(this._camDir2 || (this._camDir2 = new THREE.Vector3())).dot(sd);
      const onScreen = 1 - smoothstep(0.9, 1.6, Math.max(Math.abs(sp.x), Math.abs(sp.y)));
      u.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      u.uRays.value = facing > 0 && sd.y > -0.02 ? onScreen * smoothstep(0, 0.5, facing) * smoothstep(-0.02, 0.12, sd.y) * (1 - this.storm) * 0.9 : 0;
      u.uSunCol.value.copy(this.atmo.uniforms.uSunColor.value);
    } else u.uRays.value = 0;
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
    const a = 0.6 + this.titleT * 0.02;
    const r = 62;
    const cx = L.x + Math.sin(a) * r, cz = L.z + Math.cos(a) * r;
    const cy = Math.max(this.terrain.getHeight(cx, cz), 0) + 11 + Math.sin(this.titleT * 0.1) * 1.5;
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
    const dialog = this.ui.dialogActive() || !!this.cameraRig.cinematic;
    if (dialog) { I.mouse.dx = I.mouse.dy = 0; }
    if (dialog) I.enabled = false;
    P.update(dt, I, this.camera);
    I.enabled = true;
    if (dialog) { this.hud.prompt(''); this.hud.progress(0); }
    if (!dialog && P.alive && this.state === 'game') {
      this.handleInteraction(dt);
      if (I.hit('KeyH')) this.population.whistle();
      if (I.hit('KeyL')) { P.lanternOn = !P.lanternOn; this.audio.ui('click'); }
      if (I.hit('KeyG')) { if (!this.inventory.use('cookedMeat') && !this.inventory.use('meat') && !this.inventory.use('berries')) this.hud.toast('No food'); }
      if (I.hit('KeyB')) { if (!this.inventory.use('bandage')) this.hud.toast(this.inventory.count('bandage') ? 'Already at full health' : 'No bandages'); }
    }
    this.combat.update(dt, realDt, I);
    this.updateEntities(dt);
    this.population.updateEcosystem(dt);
    this.quests.update(dt);
    this.pickups.update(P.pos);
    this.pickups.sparkle(dt, P.pos);
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
    this.hud.el.querySelector('#clickhint').style.display = this.input.locked || this.input.padActive || this.ui.dialogActive() || !P.alive ? 'none' : 'block';
    this.adaptResolution(realDt);
    this.checkSightings(realDt);
    this.checkHints(realDt);
    if (this.slowmoT > 0) { this.slowmoT -= realDt; if (this.slowmoT <= 0 && !P.deadEye) this.timeScale = 1; }
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
