// World population: Haven townsfolk, raider camps, bounties, and the living dinosaur ecosystem.
import * as THREE from 'three';
import { Dino } from '../entities/dino.js';
import { Human } from '../entities/npc.js';
import { locById } from '../data/world.js';
import { NPCS, IDLE_LINES } from '../data/story.js';
import { DINO_DEFS } from '../data/dinos.js';
import { noise } from '../core/noise.js';
import { rand, randInt, pick } from '../core/math.js';

const CAMPS = {
  raptorpen: { count: 6, r: 26, reward: 25 },
  geothermal: { count: 7, r: 34, reward: 35 },
  cranecamp: { count: 10, r: 34, reward: 0, boss: true },
};

export class Population {
  constructor(game) {
    this.game = game;
    this.npcs = {};
    this.camps = {};
    this.cleared = new Set();
    this.mount = null;
    this.spawnT = 0;
    this.rex = null;
    this.bounty = null;
  }

  add(e) { this.game.entities.push(e); this.game.scene.add(e.group); return e; }
  remove(e) { e.dispose(); const i = this.game.entities.indexOf(e); if (i >= 0) this.game.entities.splice(i, 1); }

  init() {
    this.spawnHaven();
    this.spawnPersistent();
  }

  spawnHaven() {
    const S = this.game.structures, H = locById.haven;
    for (const [id, def] of Object.entries(NPCS)) {
      const door = S.havenBuildings[def.building];
      const toCenter = Math.atan2(H.x - door.x, H.z - door.z);
      const n = this.add(new Human(this.game, 'vendor', door.x + Math.sin(toCenter) * 1.2, door.z + Math.cos(toCenter) * 1.2, { preset: def.preset, name: def.name, colors: def.colors, id, yaw: toCenter }));
      n.faceYaw = toCenter;
      n.state = 'stand';
      n.lines = IDLE_LINES[id];
      n.npcId = id;
      this.npcs[id] = n;
    }
    // settlers wandering Main Street
    for (let i = 0; i < 10; i++) {
      const s = this.add(new Human(this.game, 'settler', H.x + rand(-8, 8), H.z + rand(-20, 30), { homeX: H.x, homeZ: H.z + 5, homeR: 28 }));
      s.lines = IDLE_LINES.settler;
      s.nightSpot = new THREE.Vector3(H.x + Math.cos(i) * 4, 0, H.z + 30 + Math.sin(i) * 4);
    }
    // guards on the watchtowers
    for (const top of S.havenTowers) {
      const g = this.add(new Human(this.game, 'guard', top.x, top.z, { gun: 'rifle', preset: 'settlerM', colors: { top: 0x4a5040 } }));
      g.perch = top.clone(); g.pos.y = top.y; g.homeR = 0;
      g.lines = ['Eyes on the treeline, ranger.', 'Quiet night. Too quiet.'];
    }
  }

  spawnPersistent() {
    const G = this.game;
    // the brachiosaur herd at the lake
    const L = locById.lake;
    const herd = { members: [] };
    for (let i = 0; i < 3; i++) {
      const d = this.add(new Dino(G, 'brachio', L.x + rand(-30, 30), L.z + rand(-30, 30), { herd, persistent: true, homeX: L.x, homeZ: L.z, homeRadius: 110, scale: i === 0 ? 1.05 : rand(0.8, 1) }));
      herd.members.push(d);
    }
    // pteranodon flocks
    for (const [loc, n] of [['aviary', 4], ['tower', 2], ['westbeach', 2]]) {
      const P = locById[loc];
      for (let i = 0; i < n; i++) this.add(new Dino(G, 'ptera', P.x + rand(-20, 20), P.z + rand(-20, 20), { persistent: true, homeX: P.x, homeZ: P.z }));
    }
    // the Queen of the island
    const R = locById.rexpaddock;
    this.rex = this.add(new Dino(G, 'trex', R.x + 20, R.z, { persistent: true, homeX: R.x, homeZ: R.z, homeRadius: 230, scale: 1 }));
  }

  spawnRexNear(loc, dist) {
    const r = this.rex;
    if (!r || !r.alive) return;
    if (r.pos.distanceTo(new THREE.Vector3(loc.x, 0, loc.z)) < dist) return;
    const ang = rand(0, 6.28);
    const x = loc.x + Math.sin(ang) * dist * 0.8, z = loc.z + Math.cos(ang) * dist * 0.8;
    if (this.game.terrain.getHeight(x, z) < 2) return;
    r.pos.set(x, this.game.terrain.getHeight(x, z), z);
    r.home.set(loc.x, loc.z); r.homeRadius = 90;
    r.syncTransform();
  }

  // ---------- raider camps ----------
  ensureCamp(id) {
    if (this.cleared.has(id) || this.camps[id]) return;
    const C = CAMPS[id], L = locById[id], G = this.game;
    const members = [];
    const towers = G.structures.campTowers?.[id] || [];
    for (let i = 0; i < C.count; i++) {
      let x, z, perch = null;
      if (i < towers.length && i % 2 === 0) { perch = towers[Math.floor(i / 2)] || towers[0]; x = perch.x; z = perch.z; }
      else { const a = rand(0, 6.28), r = rand(4, C.r); x = L.x + Math.sin(a) * r; z = L.z + Math.cos(a) * r; }
      const h = this.add(new Human(G, 'raider', x, z, { homeX: L.x, homeZ: L.z, homeR: C.r, gun: perch ? 'rifle' : undefined }));
      if (perch) { h.perch = perch.clone(); h.pos.y = perch.y; h.homeR = 0; h.state = 'stand'; }
      h.tags.add('camp:' + id);
      members.push(h);
    }
    if (C.boss) {
      const b = this.add(new Human(G, 'boss', L.x, L.z - 12, { name: 'Silas Crane', id: 'crane', gun: 'rifle', homeX: L.x, homeZ: L.z - 10, homeR: 8 }));
      b.tags.add('camp:' + id);
      members.push(b);
    }
    this.camps[id] = { members };
  }
  campCleared(id) {
    if (this.cleared.has(id)) return true;
    const c = this.camps[id];
    if (!c) return false;
    if (c.members.every((m) => !m.alive)) {
      this.cleared.add(id);
      const C = CAMPS[id];
      this.game.hud.banner('OUTPOST LIBERATED', locById[id].name, C.reward ? `+$${C.reward}` : '');
      if (C.reward) this.game.inventory.add('money', C.reward, true);
      this.game.audio.ui('quest');
      return true;
    }
    return false;
  }

  // ---------- bounties ----------
  startBounty() {
    if (this.bounty && this.bounty.target.alive) { this.game.hud.toast(`Bounty active: ${this.bounty.target.name}`); return; }
    const G = this.game;
    const spots = [[300, 480], [-300, 300], [520, 40], [-200, -380], [250, -320], [-620, 0], [600, -60], [-450, 420]];
    const [x, z] = pick(spots);
    const boss = this.add(new Human(G, 'raider', x, z, { homeX: x, homeZ: z, homeR: 12, gun: 'rifle' }));
    boss.maxHp = boss.hp = 160;
    boss.tags.add('bounty');
    const reward = randInt(4, 9) * 10;
    for (let i = 0; i < randInt(2, 3); i++) { const g = this.add(new Human(G, 'raider', x + rand(-8, 8), z + rand(-8, 8), { homeX: x, homeZ: z, homeR: 15 })); g.tags.add('bounty'); }
    this.bounty = { target: boss, reward };
    G.ui.dialog([['Wanted Poster', `WANTED: ${boss.name.toUpperCase()} — Black Fang deserter, horse thief, murderer. $${reward} DEAD OR ALIVE. Last seen near the marked location.`]]);
    const off = G.events.on('death', (d) => {
      if (d.entity === boss) { off(); G.inventory.add('money', reward, true); G.hud.banner('BOUNTY CLAIMED', boss.name, `+$${reward}`); G.audio.ui('money'); G.stats.bounties++; this.bounty = null; }
    });
  }

  // ---------- mount ----------
  setMount(d) {
    if (this.mount && this.mount !== d && this.mount.alive) { this.mount.tamed = false; this.mount.faction = 'herb'; this.mount.persistent = false; this.mount.category = this.mount.kindName; }
    this.mount = d;
    d.tamed = true; d.persistent = true; d.faction = 'tamed'; d.category = 'dino-tamed';
    if (d.herd) { d.herd.members = d.herd.members.filter((m) => m !== d); d.herd = null; }
    d.setState('stay');
  }
  whistle() {
    const m = this.mount, G = this.game, p = G.player;
    if (!m || !m.alive) { G.hud.toast('You have no mount'); return; }
    G.audio.ui('click');
    const d = m.pos.distanceTo(p.pos);
    if (d > 140) {
      const ang = p.camYaw + Math.PI + rand(-0.5, 0.5);
      const x = p.pos.x + Math.sin(ang) * 60, z = p.pos.z + Math.cos(ang) * 60;
      if (G.terrain.getHeight(x, z) > 0.5) { m.pos.set(x, G.terrain.getHeight(x, z), z); m.syncTransform(); }
    }
    m.setState('follow');
    G.hud.toast(`${m.def === DINO_DEFS.para ? 'Parasaurolophus' : 'Gallimimus'} is coming`);
  }

  // ---------- ecosystem ----------
  biomeScore(kind, x, z) {
    const T = this.game.terrain;
    const h = T.getHeight(x, z);
    if (h < 2 || T.slope(x, z) > 0.35 || T.getFlat(x, z) > 0.3) return 0;
    const forest = noise.fbm(x * 0.0045 + 40, z * 0.0045 - 12, 4);
    const meadow = forest < -0.12;
    const night = this.game.atmo.isNight();
    switch (kind) {
      case 'gallimimus': return meadow && h < 70 ? 3 : 0.2;
      case 'para': return meadow && h < 50 ? 1.6 : 0.1;
      case 'trike': return meadow ? 1 : 0.1;
      case 'stego': return meadow || forest < 0.05 ? 0.8 : 0.1;
      case 'raptor': return !meadow && h < 100 ? (night ? 2.2 : 0.9) : 0.2;
      case 'dilo': return !meadow && h < 60 ? 0.9 : 0;
      case 'compy': return 1.4;
    }
    return 0;
  }

  updateEcosystem(dt) {
    const G = this.game, P = G.player;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 1.5;
    this.updateInfected();
    // outposts come alive when the player approaches (Crane's Hollow waits for the story)
    for (const id of ['raptorpen', 'geothermal']) {
      const L = locById[id];
      if (!this.camps[id] && !this.cleared.has(id) && Math.hypot(P.pos.x - L.x, P.pos.z - L.z) < 280) this.ensureCamp(id);
    }
    // despawn far / old
    for (const e of [...G.entities]) {
      if (e.kind !== 'dino' || e.persistent) continue;
      const d = e.pos.distanceTo(P.pos);
      if (d > 520 || (!e.alive && e.stateT > 150 && d > 60)) this.remove(e);
    }
    if (P.inSafeZone() && Math.random() < 0.5) return;
    const counts = {};
    let total = 0;
    for (const e of G.entities) if (e.kind === 'dino' && !e.persistent && e.alive) { counts[e.kindName] = (counts[e.kindName] || 0) + 1; total++; }
    const budget = G.settings.quality === 'low' ? 26 : 40;
    if (total >= budget) return;
    const caps = { gallimimus: 16, para: 10, trike: 6, stego: 5, raptor: 7, dilo: 3, compy: 10 };
    const kinds = Object.keys(caps).filter((k) => (counts[k] || 0) < caps[k]);
    if (!kinds.length) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      const ang = rand(0, 6.28), dist = rand(140, 300);
      const x = P.pos.x + Math.sin(ang) * dist, z = P.pos.z + Math.cos(ang) * dist;
      if (Math.hypot(x - locById.haven.x, z - locById.haven.z) < 120) continue;
      let sum = 0;
      const scores = kinds.map((k) => { const s = this.biomeScore(k, x, z); sum += s; return s; });
      if (sum <= 0) continue;
      let r = Math.random() * sum, kind = kinds[0];
      for (let i = 0; i < kinds.length; i++) { r -= scores[i]; if (r <= 0) { kind = kinds[i]; break; } }
      if (this.biomeScore(kind, x, z) <= 0) continue;
      this.spawnHerd(kind, x, z);
      break;
    }
  }

  // The Infected: the freighter brought the mainland plague ashore. They haunt Shipwreck Beach and roam the coasts at night.
  updateInfected() {
    const G = this.game, P = G.player, W = locById.westbeach;
    const night = G.atmo.isNight();
    const inf = G.entities.filter((e) => e.kind === 'human' && e.role === 'infected');
    for (const e of inf) {
      const d = e.pos.distanceTo(P.pos);
      if (d > 460 || (!e.alive && e.stateT > 90 && d > 50)) this.remove(e);
    }
    const alive = inf.filter((e) => e.alive);
    const dW = Math.hypot(P.pos.x - W.x, P.pos.z - W.z);
    if (dW < 380) {
      const near = alive.filter((e) => Math.hypot(e.pos.x - W.x, e.pos.z - W.z) < 140).length;
      if (near < (night ? 10 : 5)) {
        const a = rand(0, 6.28), r = rand(10, 70);
        const x = W.x + Math.sin(a) * r, z = W.z + Math.cos(a) * r;
        if (G.terrain.getHeight(x, z) > 0.3) this.add(new Human(G, 'infected', x, z, { homeX: W.x, homeZ: W.z, homeR: 70 }));
      }
    }
    if (night && alive.length < 6 && Math.random() < 0.05 && !P.inSafeZone() && this.game.quests.qi >= 1) {
      for (let k = 0; k < 6; k++) {
        const a = rand(0, 6.28), r = rand(120, 220);
        const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
        if (G.terrain.getHeight(x, z) < 1.5 || Math.hypot(x - locById.haven.x, z - locById.haven.z) < 110) continue;
        for (let i = 0; i < randInt(2, 3); i++) this.add(new Human(G, 'infected', x + rand(-4, 4), z + rand(-4, 4), { homeX: x, homeZ: z, homeR: 40 }));
        break;
      }
    }
    if (!this.seenInfected) {
      const s = alive.find((e) => e.pos.distanceTo(P.pos) < 35);
      if (s) {
        this.seenInfected = true;
        G.ui.dialog([['Ava', 'No... not here. The freighter must have carried it ashore.'], ['Ava', 'Aim for the head. Nothing else stops them.']], null, true);
        G.hud.toast('The Infected — only headshots stop them', 'danger');
      }
    }
  }

  spawnHerd(kind, x, z, n = null) {
    const G = this.game, def = DINO_DEFS[kind];
    const count = n ?? randInt(def.herd[0], def.herd[1]);
    const herd = { members: [] };
    for (let i = 0; i < count; i++) {
      const px = x + rand(-1, 1) * (4 + def.size * 2), pz = z + rand(-1, 1) * (4 + def.size * 2);
      if (G.terrain.getHeight(px, pz) < 1) continue;
      const d = this.add(new Dino(G, kind, px, pz, { herd, homeX: x, homeZ: z, homeRadius: kind === 'raptor' ? 140 : 90 }));
      herd.members.push(d);
    }
    return herd;
  }
}
