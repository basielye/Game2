// Dinosaur entity: perception, herd/pack AI, locomotion on terrain, procedural animation and death.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { buildDino, buildPteranodon, SPECIES } from './dinoModels.js';
import { setRot } from './rig.js';
import { DINO_DEFS } from '../data/dinos.js';
import { clamp, lerp, rand, angleDiff, damp, smoothstep } from '../core/math.js';
import { locById } from '../data/world.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const SAFE_ZONES = [{ x: locById.haven.x, z: locById.haven.z, r: 70 }];

export class Dino extends Entity {
  constructor(game, kind, x, z, opts = {}) {
    super(game);
    this.kindName = kind;
    this.category = kind;
    this.def = DINO_DEFS[kind];
    const d = this.def;
    this.scale = opts.scale ?? rand(d.scale[0], d.scale[1]);
    this.flyer = !!d.flyer;
    this.rig = this.flyer ? buildPteranodon(this.scale) : buildDino(kind, this.scale, rand(-1, 1));
    this.pitchGroup = new THREE.Group();
    this.group.add(this.pitchGroup);
    this.pitchGroup.add(this.rig.mesh);
    this.maxHp = this.hp = Math.round(d.hp * (0.7 + this.scale * 0.3));
    this.faction = d.diet === 'carn' ? 'pred' : 'herb';
    this.radius = d.size * 0.45 * this.scale;
    this.pos.set(x, game.terrain.getHeight(x, z), z);
    if (this.flyer) this.pos.y += 50;
    this.yaw = opts.yaw ?? rand(0, Math.PI * 2);
    this.home = new THREE.Vector2(opts.homeX ?? x, opts.homeZ ?? z);
    this.homeRadius = opts.homeRadius ?? 120;
    this.state = 'wander';
    this.stateT = 0;
    this.think = rand(0, 0.3);
    this.speed = 0;
    this.desiredSpeed = 0;
    this.desiredYaw = this.yaw;
    this.target = null;
    this.threat = null;
    this.wanderTo = null;
    this.atkT = 0;
    this.hunger = rand(0.3, 1);
    this.herd = opts.herd || null;
    this.tamed = false;
    this.rider = null;
    this.anim = { phase: rand(0, 6), t: rand(0, 10), jaw: 0, look: 0, lookPitch: 0, lunge: 0, roar: 0, eat: 0, dead: 0, turn: 0, frill: 0, air: 0, rear: 0 };
    this.persistent = !!opts.persistent;
    this.alertness = 0;
    this.lastRoar = -100;
    this.footT = 0;
    this.lootTaken = false;
    this.vy = 0;
    this.airborne = false;
    this.spitT = 0;
    this.groundY = this.pos.y;
    this._setupHit();
    this.syncTransform();
    if (this.flyer) { this.circleA = rand(0, 6.28); this.circleR = rand(30, 70); this.alt = rand(35, 70); }
  }

  get kind() { return 'dino'; }

  _setupHit() {
    if (this.flyer) { this.hitSpheres.push({ obj: this.rig.bones.body, r: 0.55 * this.scale, mult: 1.5, name: 'body' }); return; }
    const S = this.rig.spec, B = this.rig.bones, sc = this.scale;
    const spineAt = (z) => { let best = S.spine[0]; for (const p of S.spine) if (Math.abs(p[0] - z) < Math.abs(best[0] - z)) best = p; return best; };
    for (const bn of ['pelvis', 'chest', 'tail1', 'neck1', 'neck2']) {
      const def = this.rig.boneDefs.find((b) => b.name === bn);
      if (!def) continue;
      const sp = spineAt(def.z);
      this.hitSpheres.push({ obj: B[bn], local: new THREE.Vector3(0, 0, (bn === 'pelvis' ? 0.4 : 0.2) * sc), r: Math.max(sp[2], sp[3]) * sc * 1.15, mult: 1, name: bn });
    }
    const hd = this.rig.boneDefs[this.rig.boneDefs.length - 1];
    const tip = S.spine[S.spine.length - 1];
    const hsp = spineAt(hd.z);
    this.hitSpheres.push({ obj: B.head, local: new THREE.Vector3(0, 0, (tip[0] - hd.z) * 0.4 * sc), r: Math.max(hsp[2], hsp[3]) * 1.5 * sc, mult: 2.2, name: 'head' });
    this.headBone = B.head;
  }

  headPos(out = new THREE.Vector3()) {
    if (this.headBone) return this.headBone.getWorldPosition(out);
    return out.copy(this.pos).add(_v.set(0, 1, 0));
  }

  syncTransform() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  onDamage(amount, source, info) {
    this.alertness = 1;
    if (this.anim) this.anim.hurt = 1;
    this.game.audio?.dino(this.kindName, 'hurt', this.pos, this.scale);
    if (!this.alive) return;
    if (this.tamed) return;
    const d = this.def;
    if (source && source.alive !== false) {
      if (d.diet === 'herb' && !d.territorial && !d.gentle) { this.threat = source; this.setState('flee'); this._herdAlarm(source); }
      else if (d.territorial && this.hp > this.maxHp * d.flee) { this.target = source; this.setState('chase'); }
      else if (d.gentle) { this.threat = source; this.setState('flee'); }
      else if (d.diet === 'carn') {
        if (this.hp < this.maxHp * d.flee && this.kindName !== 'trex') { this.threat = source; this.setState('flee'); }
        else { this.target = source; this.setState('chase'); this._packAlarm(source); }
      }
    }
  }

  onDeath(source) {
    this.state = 'dead';
    this.stateT = 0;
    this.game.audio?.dino(this.kindName, 'die', this.pos, this.scale);
    if (this.rider) this.game.player.dismount(true);
    this.deathSide = Math.random() < 0.5 ? 1 : -1;
    if (this.flyer) this.vy = 0;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  _herdAlarm(threat) {
    if (!this.herd) return;
    for (const m of this.herd.members) if (m !== this && m.alive && !m.tamed && m.def.diet === 'herb' && !m.def.territorial) { m.threat = threat; m.setState('flee'); }
  }
  _packAlarm(target) {
    if (!this.herd) return;
    for (const m of this.herd.members) if (m !== this && m.alive && !m.tamed && m.state !== 'eat') { m.target = target; m.setState('chase'); }
  }

  // stealth-aware detection distance for a given observer
  detectRange(other) {
    let r = this.def.sight;
    if (other.category === 'player') {
      const p = other;
      if (p.crouching) r *= 0.45;
      if (p.inCover) r *= 0.7;
      if (this.game.atmo.isNight()) r *= 0.75;
      if (p.mounted) r *= 1.2;
      if (p.sprinting) r *= 1.25;
    }
    return r;
  }

  perceive() {
    const G = this.game, d = this.def;
    let bestPrey = null, bestD = Infinity, bestThreat = null, threatD = Infinity;
    for (const e of G.entities) {
      if (e === this || !e.alive || e === this.rider) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > d.sight * 1.3) continue;
      if (d.diet === 'carn' && !this.tamed) {
        if (d.prey.includes(e.category) || (e.category === 'dino-tamed' && d.prey.includes(e.kindName))) {
          if (e.category === 'player' && G.player.godMode) continue;
          if (e.kindName === 'trex' || (e.def && e.def.size > d.size * 1.6 && this.kindName !== 'trex')) continue;
          if (e.inSafeZone && e.inSafeZone()) continue;
          const range = this.detectRange(e);
          let score = dist;
          if (e.category === 'player') score *= 0.8 / Math.max(0.2, d.aggr);
          if (dist < range && score < bestD) { bestD = score; bestPrey = e; }
        }
        // predators also fear the rex
        if (e.kindName === 'trex' && this.kindName !== 'trex' && dist < 45) { bestThreat = e; threatD = dist; }
      } else if (!this.tamed) {
        let fear = 0;
        if (e.faction === 'pred' && e.def && e.def.size >= d.size * 0.5) fear = d.sight * 0.7;
        if (e.category === 'player') {
          fear = e.crouching ? 9 : e.sprinting || e.mounted ? 30 : 18;
          // a crouched ranger carrying bait is curious, not scary
          if (d.mountable && e.crouching && G.inventory.count('bait') > 0) fear = 2.2;
        }
        if (e.category === 'human' && e.faction === 'raider') fear = 20;
        if (e.category === 'infected') fear = 14;
        if (d.gentle && e.kindName !== 'trex') fear = 0;
        if (e === this.rider) fear = 0;
        if (fear > 0 && dist < fear && dist < threatD) { threatD = dist; bestThreat = e; }
      }
    }
    return { prey: bestPrey, preyD: bestD, threat: bestThreat, threatD };
  }

  update(dt) {
    const G = this.game;
    this.anim.t += dt;
    if (this.state === 'dead') { this._updateDead(dt); return; }
    this.stateT += dt;
    this.atkT -= dt;
    this.spitT -= dt;
    if (this.poisonT > 0) {
      this.poisonT -= dt;
      this.damage(dt * 5, null, {});
      if (Math.random() < dt * 3) this.game.fx?.smoke(this.headPos(_v), 0x70b020, this.scale);
      // venom drives it into a frenzy against its own kind
      if (this.def.attack && (!this.target || this.target.kind !== 'dino' || !this.target.alive)) {
        let best = null, bd = 40;
        for (const e of this.game.entities) if (e !== this && e.kind === 'dino' && e.alive && !e.flyer) { const d = e.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = e; } }
        if (best) { this.target = best; this.setState('chase'); }
      }
      if (!this.alive) return;
    }
    if (this.flyer) { this._updateFlyer(dt); return; }
    if (this.rider) { this._updateRidden(dt); this._animate(dt); return; }
    this.think -= dt;
    if (this.think <= 0) { this.think = 0.25 + Math.random() * 0.15; this._decide(); }
    this._act(dt);
    this._locomote(dt);
    this._animate(dt);
  }

  _decide() {
    const d = this.def;
    const P = this.perceive();
    this.hunger = Math.min(1, this.hunger + 0.003);
    if (this.tamed) {
      if (this.state !== 'follow' && this.state !== 'stay' && this.state !== 'flee') this.setState('stay');
      if (P.threat && P.threat.faction === 'pred' && P.threatD < 25 && this.state !== 'flee') { this.threat = P.threat; this.setState('flee'); }
      return;
    }
    switch (this.state) {
      case 'wander': case 'graze': case 'idle':
        if (d.diet === 'carn') {
          if (P.threat) { this.threat = P.threat; this.setState('flee'); break; }
          if (P.prey && (this.hunger > 0.25 || P.prey.category === 'player' || P.prey.category === 'human')) {
            this.target = P.prey;
            if (this.kindName === 'trex' && this.anim.t - this.lastRoar > 20) { this.setState('roar'); }
            else this.setState('chase');
            this._packAlarm(P.prey);
            this.game.audio?.dino(this.kindName, 'call', this.pos, this.scale);
          }
        } else if (P.threat) {
          if (d.territorial && (P.threat.category === 'player' || P.threat.category === 'human') && P.threatD < 14) { this.target = P.threat; this.setState('threaten'); }
          else if (!d.territorial || P.threat.faction === 'pred') { this.threat = P.threat; this.setState('flee'); this._herdAlarm(P.threat); this.game.audio?.dino(this.kindName, 'call', this.pos, this.scale); }
        }
        break;
      case 'chase':
        if (!this.target || !this.target.alive) { this.target && !this.target.alive && d.diet === 'carn' ? this.setState('eat') : this.setState('wander'); break; }
        if (this.target.inSafeZone && this.target.inSafeZone()) { this.target = null; this.setState('wander'); break; }
        {
          const dist = this.pos.distanceTo(this.target.pos);
          if (dist > d.sight * 2 || (this.stateT > 40 && dist > 30)) { this.target = null; this.setState('wander'); }
          if (P.threat && P.threat !== this.target && this.kindName !== 'trex') { this.threat = P.threat; this.setState('flee'); }
          if (this.target && this.target.category === 'player' && this.target.godMode) { this.target = null; this.setState('wander'); }
        }
        break;
      case 'threaten':
        if (!this.target || !this.target.alive) { this.setState('wander'); break; }
        if (this.pos.distanceTo(this.target.pos) > 22) this.setState('wander');
        else if (this.stateT > 2.6 && this.pos.distanceTo(this.target.pos) < 11) this.setState('chase');
        else if (this.stateT > 6) this.setState('wander');
        break;
      case 'flee':
        if (!this.threat || !this.threat.alive || (this.pos.distanceTo(this.threat.pos) > d.sight * 1.4 && this.stateT > 4) || this.stateT > 14) { this.threat = null; this.setState('wander'); }
        break;
      case 'eat':
        if (this.stateT > 25) { this.hunger = 0; this.target = null; this.setState('wander'); }
        if (P.threat && P.threatD < 20) { this.threat = P.threat; this.setState('flee'); }
        if (P.prey && P.prey.category === 'player' && P.preyD < 10) { this.target = P.prey; this.setState('chase'); }
        break;
    }
  }

  _act(dt) {
    const d = this.def;
    const a = this.anim;
    switch (this.state) {
      case 'idle': case 'graze': case 'wander': {
        // herd: follow leader; leader picks targets near home
        const leader = this.herd && this.herd.members.find((m) => m.alive && m.state !== 'dead' && !m.tamed);
        if (leader && leader !== this) {
          const off = this.herd.members.indexOf(this);
          const ang = leader.yaw + Math.PI + (off % 2 ? 1 : -1) * (0.4 + off * 0.25);
          const dist = (this.radius + leader.radius) * 2.2 + off * 1.2;
          const tx = leader.pos.x + Math.sin(ang) * dist, tz = leader.pos.z + Math.cos(ang) * dist;
          const dd = Math.hypot(tx - this.pos.x, tz - this.pos.z);
          if (dd > 3) { this.desiredYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z); this.desiredSpeed = dd > 18 ? d.run * 0.6 : d.walk * clamp(dd / 8, 0.4, 1.2); }
          else { this.desiredSpeed = 0; if (Math.random() < 0.003) this.desiredYaw = this.yaw + rand(-1, 1); }
          a.eat = damp(a.eat, this.desiredSpeed < 0.2 && d.diet === 'herb' ? 1 : 0, 2, dt);
        } else {
          if (!this.wanderTo || this.stateT > 30 || Math.hypot(this.wanderTo.x - this.pos.x, this.wanderTo.y - this.pos.z) < 4) {
            if (this.state !== 'graze' && Math.random() < 0.5 && this.stateT > 2) { this.setState('graze'); this.wanderTo = null; }
            else {
              const ang = rand(0, Math.PI * 2), rr = rand(10, this.homeRadius);
              this.wanderTo = new THREE.Vector2(this.home.x + Math.sin(ang) * rr, this.home.y + Math.cos(ang) * rr);
              this.state = 'wander'; this.stateT = 0;
            }
          }
          if (this.state === 'graze') {
            this.desiredSpeed = 0;
            a.eat = damp(a.eat, d.diet === 'herb' ? 1 : 0, 2, dt);
            if (this.stateT > rand(6, 14)) { this.state = 'wander'; this.stateT = 0; this.wanderTo = null; }
          } else if (this.wanderTo) {
            a.eat = damp(a.eat, 0, 3, dt);
            this.desiredYaw = Math.atan2(this.wanderTo.x - this.pos.x, this.wanderTo.y - this.pos.z);
            this.desiredSpeed = d.walk;
          }
        }
        a.frill = damp(a.frill, 0, 3, dt);
        break;
      }
      case 'roar': {
        this.desiredSpeed = 0;
        if (this.target) this.desiredYaw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
        if (this.stateT < 0.1) { this.lastRoar = this.anim.t; this.game.audio?.dino(this.kindName, 'roar', this.pos, this.scale); this.game.cameraShake?.(this.pos, 1.2, 2.2); }
        a.roar = this.stateT < 2.4 ? 1 : 0;
        if (this.stateT > 2.6) { a.roar = 0; this.setState('chase'); }
        break;
      }
      case 'threaten': {
        this.desiredSpeed = 0;
        if (this.target) this.desiredYaw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
        a.roar = Math.sin(this.stateT * 3) > 0 ? 0.7 : 0.2;
        if (this.stateT < 0.05) this.game.audio?.dino(this.kindName, 'roar', this.pos, this.scale);
        break;
      }
      case 'chase': {
        a.roar = 0; a.eat = 0;
        const t = this.target;
        if (!t) break;
        const tp = _v.copy(t.pos).addScaledVector(t.vel || _v2.set(0, 0, 0), 0.4);
        let dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        // pack flanking
        if (this.def.packHunter && this.herd && dist > 7) {
          const idx = this.herd.members.indexOf(this);
          const side = (idx % 3) - 1;
          const ang = Math.atan2(dx, dz) + side * 0.6;
          dx = Math.sin(ang) * dist; dz = Math.cos(ang) * dist;
        }
        this.desiredYaw = Math.atan2(dx, dz);
        const reach = d.attack.range + (t.radius || 0.4);
        // dilophosaurus spit
        if (d.attack.spit && dist > 4 && dist < d.attack.spit && this.spitT <= 0 && Math.random() < 0.02) {
          this.spitT = 6; a.frill = 1; a.lunge = 1;
          this.game.audio?.dino(this.kindName, 'roar', this.pos, this.scale);
          setTimeout(() => this.alive && this.game.combat?.spit(this, t), 450);
        }
        if (d.attack.spit) a.frill = damp(a.frill, dist < 15 ? 1 : 0, 3, dt);
        // raptor pounce
        if (d.attack.pounce && !this.airborne && dist > 3.5 && dist < 8 && this.atkT <= 0 && Math.random() < 0.08) {
          this.airborne = true; this.vy = 6; this.speed = d.run * 1.3; this.atkT = d.attack.cd * 1.4; this.pounceHit = false;
          this.game.audio?.dino(this.kindName, 'roar', this.pos, this.scale);
        }
        if (dist < reach) {
          this.desiredSpeed = 0;
          if (this.atkT <= 0 && Math.abs(angleDiff(this.yaw, this.desiredYaw)) < 0.7) {
            this.atkT = d.attack.cd;
            a.lunge = 1;
            this.game.audio?.dino(this.kindName, 'bite', this.pos, this.scale);
            setTimeout(() => this._hit(t), 260);
          }
        } else {
          const charge = d.attack.charge && dist < 30;
          this.desiredSpeed = charge ? d.run * 1.05 : (dist > 12 ? d.run : lerp(d.walk, d.run, dist / 12));
        }
        break;
      }
      case 'flee': {
        a.eat = 0; a.roar = 0;
        if (this.threat) {
          let ang = Math.atan2(this.pos.x - this.threat.pos.x, this.pos.z - this.threat.pos.z);
          // jitter for natural herd scatter
          ang += Math.sin(this.anim.t * 0.7 + this.id) * 0.4;
          this.desiredYaw = ang;
        }
        this.desiredSpeed = this.def.run * (this.hp < this.maxHp * 0.3 ? 0.7 : 1);
        break;
      }
      case 'eat': {
        const t = this.target;
        a.roar = 0;
        if (t) {
          const dist = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
          if (dist > d.attack.range + (t.radius || 0.5) * 0.8) { this.desiredYaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z); this.desiredSpeed = d.walk; a.eat = 0; }
          else { this.desiredSpeed = 0; a.eat = 1; a.jaw = 0.5 + Math.sin(this.anim.t * 6) * 0.5; }
        } else this.setState('wander');
        break;
      }
      case 'follow': {
        const p = this.game.player;
        const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        this.desiredYaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        this.desiredSpeed = dist > 25 ? d.run : dist > 6 ? d.walk * 1.5 : 0;
        if (dist < 5 && this.stateT > 1) this.setState('stay');
        break;
      }
      case 'stay': this.desiredSpeed = 0; a.eat = damp(a.eat, 1, 1, dt); break;
    }
  }

  _hit(t) {
    if (!this.alive || !t || !t.alive || this.state === 'dead') return;
    const d = this.def;
    const hp = this.headPos(_v2);
    const dist = Math.min(hp.distanceTo(t.pos), this.pos.distanceTo(t.pos) - this.radius * 0.5);
    if (dist > d.attack.range + (t.radius || 0.5) + 1.0) return;
    let dmg = d.attack.dmg * (0.85 + Math.random() * 0.3) * (0.7 + this.scale * 0.3);
    if (t.category === 'player') dmg *= { easy: 0.55, normal: 0.85, hard: 1.25 }[this.game.settings.difficulty] || 1;
    t.damage(dmg, this, { type: 'bite', knock: d.size * 1.5, from: this.pos });
    this.game.fx?.blood(_v.copy(t.pos).add(_v2.set(0, (t.height || 1) * 0.6, 0)), 10);
    if (this.kindName === 'trex') this.game.cameraShake?.(this.pos, 0.8, 0.6);
  }

  _locomote(dt) {
    const d = this.def, G = this.game;
    // safe-zone avoidance (Haven palisade)
    for (const z of SAFE_ZONES) {
      const dx = this.pos.x - z.x, dz = this.pos.z - z.z;
      const dd = Math.hypot(dx, dz);
      if (dd < z.r + 25 && !this.tamed) {
        const out = Math.atan2(dx, dz);
        const w = 1 - smoothstep(z.r, z.r + 25, dd);
        this.desiredYaw = this.desiredYaw + angleDiff(this.desiredYaw, out) * w;
        if (this.state === 'chase' && this.target && this.target.inSafeZone?.()) { this.target = null; this.setState('wander'); }
      }
    }
    // turning
    const turnRate = d.turn * (this.state === 'chase' || this.state === 'flee' ? 1.3 : 1);
    const diff = angleDiff(this.yaw, this.desiredYaw);
    const step = clamp(diff, -turnRate * dt, turnRate * dt);
    this.yaw += step;
    this.anim.turn = damp(this.anim.turn, step / Math.max(dt, 1e-4) / turnRate, 4, dt);
    // slow down when turning hard
    const turnSlow = 1 - Math.min(0.6, Math.abs(diff) / Math.PI);
    const target = this.desiredSpeed * turnSlow;
    const acc = this.speed < target ? (d.run > 10 ? 9 : 5) : 8;
    this.speed = damp(this.speed, target, acc * 0.5, dt);
    if (this.airborne) this.speed = Math.max(this.speed, d.run);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;
    const T = G.terrain;
    const h = T.getHeight(nx, nz);
    const deep = this.kindName === 'brachio' ? -6 : -0.9;
    if (h < deep || T.slope(nx, nz) > (d.size > 2 ? 0.5 : 0.62)) {
      // blocked: turn towards land/home
      this.desiredYaw = Math.atan2(this.home.x - this.pos.x, this.home.y - this.pos.z) + rand(-0.6, 0.6);
      if (this.state === 'flee') this.desiredYaw = this.yaw + Math.PI * 0.6;
      this.speed *= 0.5;
      nx = this.pos.x; nz = this.pos.z;
    }
    this.vel.set((nx - this.pos.x) / Math.max(dt, 1e-4), 0, (nz - this.pos.z) / Math.max(dt, 1e-4));
    this.pos.x = nx; this.pos.z = nz;
    if (d.size < 2.5) {
      _v.set(this.pos.x, this.pos.y, this.pos.z);
      if (G.colliders.resolve(_v, this.radius, 2)) { this.pos.x = _v.x; this.pos.z = _v.z; }
    } else {
      _v.set(this.pos.x, this.pos.y, this.pos.z);
      if (G.colliders.resolve(_v, this.radius * 0.6, 3, 'tree')) { this.pos.x = _v.x; this.pos.z = _v.z; }
    }
    // separation from other dinos (cheap)
    if (this.herd) for (const m of this.herd.members) {
      if (m === this || !m.alive) continue;
      const dx = this.pos.x - m.pos.x, dz = this.pos.z - m.pos.z;
      const md = this.radius + m.radius;
      const dd = dx * dx + dz * dz;
      if (dd < md * md && dd > 1e-4) { const k = (md - Math.sqrt(dd)) * 0.5 / Math.sqrt(dd); this.pos.x += dx * k; this.pos.z += dz * k; }
    }
    const ground = Math.max(T.getHeight(this.pos.x, this.pos.z), this.kindName === 'brachio' ? -50 : -1.2);
    if (this.airborne) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.target && !this.pounceHit && this.pos.distanceTo(this.target.pos) < 2.2) { this.pounceHit = true; this._hit(this.target); if (this.target.category === 'player') this.target.knockdown?.(this); }
      if (this.pos.y <= ground) { this.pos.y = ground; this.airborne = false; this.vy = 0; }
    } else this.pos.y = damp(this.pos.y, ground, 20, dt);
    this.anim.air = damp(this.anim.air, this.airborne ? 1 : 0, 10, dt);
    this.syncTransform();
    // body pitch along slope
    const L = (this.rig.spec?.hind?.thigh || 1) * 2 * this.scale;
    const hf = T.getHeight(this.pos.x + fx * L, this.pos.z + fz * L), hb = T.getHeight(this.pos.x - fx * L, this.pos.z - fz * L);
    const pitch = clamp(Math.atan2(hb - hf, 2 * L), -0.35, 0.35);
    this.pitchGroup.rotation.x = damp(this.pitchGroup.rotation.x, pitch, 5, dt);
    // heavy footsteps
    if (this.speed > 0.5) {
      this.footT -= dt * this.speed / (d.stride * this.scale);
      if (this.footT <= 0) {
        this.footT = 0.5;
        if (d.size >= 3) {
          this.game.audio?.stomp(this.pos, d.size);
          if (this.kindName === 'trex' || this.kindName === 'brachio') this.game.cameraShake?.(this.pos, d.size * 0.06, 0.35);
          this.game.fx?.dust(this.pos, d.size * 0.4);
        }
      }
    }
  }

  // Player riding: controlled locomotion
  _updateRidden(dt) {
    const p = this.rider;
    const d = this.def;
    const input = p.mountInput;
    this.desiredYaw = input.yaw;
    this.desiredSpeed = input.move ? (input.sprint ? d.run * 1.05 : d.walk * 2.2) : 0;
    if (input.jump && !this.airborne) { this.airborne = true; this.vy = 7.5; this.pounceHit = true; }
    this.state = 'ridden';
    this._locomote(dt);
  }

  _updateFlyer(dt) {
    const G = this.game, d = this.def, a = this.anim;
    const p = G.player;
    this.think -= dt;
    const home = this.home;
    if (this.think <= 0) {
      this.think = 0.5;
      const dist = this.pos.distanceTo(p.pos);
      const nearHome = Math.hypot(p.pos.x - home.x, p.pos.z - home.y) < 150;
      if (this.state !== 'dive' && this.state !== 'climb' && nearHome && dist < 90 && !p.inSafeZone() && Math.random() < 0.15 * d.aggr && !p.godMode) { this.setState('dive'); this.target = p; this.game.audio?.dino('ptera', 'roar', this.pos, 1); }
      if (this.hp < this.maxHp * 0.5 && this.state !== 'climb') this.setState('climb');
    }
    let tx, ty, tz, spd;
    if (this.state === 'dive' && this.target) {
      tx = this.target.pos.x; ty = this.target.pos.y + 1.2; tz = this.target.pos.z; spd = d.run;
      if (this.pos.distanceTo(_v.set(tx, ty, tz)) < 2.5) {
        this.target.damage(d.attack.dmg, this, { type: 'claw', knock: 3, from: this.pos });
        this.setState('climb');
      }
      if (this.stateT > 8) this.setState('climb');
    } else {
      if (this.state === 'climb' && this.stateT > 5) this.setState('circle');
      this.circleA += dt * (d.walk / this.circleR);
      tx = home.x + Math.cos(this.circleA) * this.circleR; tz = home.y + Math.sin(this.circleA) * this.circleR;
      ty = Math.max(G.terrain.getHeight(tx, tz), 0) + this.alt + (this.state === 'climb' ? 20 : 0);
      spd = d.walk * 1.4;
    }
    _v.set(tx - this.pos.x, ty - this.pos.y, tz - this.pos.z);
    const dl = _v.length();
    const want = Math.atan2(_v.x, _v.z);
    const diff = angleDiff(this.yaw, want);
    this.yaw += clamp(diff, -d.turn * dt * 1.5, d.turn * dt * 1.5);
    this.speed = damp(this.speed, spd, 1.5, dt);
    const climb = clamp(_v.y / Math.max(dl, 1), -0.8, 0.6);
    this.vel.set(Math.sin(this.yaw) * this.speed, climb * this.speed, Math.cos(this.yaw) * this.speed);
    this.pos.addScaledVector(this.vel, dt);
    const g = G.terrain.getHeight(this.pos.x, this.pos.z);
    if (this.pos.y < Math.max(g, 0) + 2) this.pos.y = Math.max(g, 0) + 2;
    this.syncTransform();
    this.pitchGroup.rotation.x = damp(this.pitchGroup.rotation.x, -climb * 0.8, 3, dt);
    this.pitchGroup.rotation.z = damp(this.pitchGroup.rotation.z, -diff * 0.8, 3, dt);
    // flap
    const glide = climb < -0.1 || (this.state === 'circle' && Math.sin(this.anim.t * 0.4) > 0);
    a.flap = damp(a.flap || 0, glide ? 0.1 : 1, 2, dt);
    const fl = Math.sin(this.anim.t * 7) * 0.7 * a.flap + 0.1;
    const B = this.rig.bones;
    setRot(B.wingL, 0, 0, fl); setRot(B.wingR, 0, 0, -fl);
    setRot(B.tipL, 0, 0, fl * 0.6); setRot(B.tipR, 0, 0, -fl * 0.6);
    B.body.position.y = -fl * 0.08;
    if (Math.random() < dt * 0.05) this.game.audio?.dino('ptera', 'call', this.pos, 1);
  }

  _updateDead(dt) {
    this.stateT += dt;
    const a = this.anim;
    if (this.flyer) {
      const g = this.game.terrain.getHeight(this.pos.x, this.pos.z);
      if (this.pos.y > g + 0.3) { this.vy -= 20 * dt; this.pos.y = Math.max(g + 0.3, this.pos.y + this.vy * dt); this.pos.x += this.vel.x * dt * 0.5; this.pos.z += this.vel.z * dt * 0.5; }
      this.syncTransform();
      this.pitchGroup.rotation.z = damp(this.pitchGroup.rotation.z, 2.6, 2, dt);
      return;
    }
    a.dead = Math.min(1, a.dead + dt * 0.9);
    const f = smoothstep(0, 1, a.dead);
    const S = this.rig.spec, sc = this.scale;
    const hipY = S.hind.y * sc;
    const pel = S.spine.reduce((m, p) => Math.max(m, p[2]), 0) * sc;
    this.pitchGroup.rotation.z = this.deathSide * f * Math.PI * 0.47;
    this.pitchGroup.position.y = -(hipY - pel * 0.95) * f;
    this.speed = 0;
    // settle into pose: legs stiff, tail limp, jaw open
    a.jaw = damp(a.jaw, 0.6, 2, dt);
    this._animate(dt, true);
  }

  _animate(dt, dead = false) {
    if (this.flyer) return;
    const a = this.anim, R = this.rig, B = R.bones, S = R.spec;
    const sc = this.scale;
    const spd = this.speed;
    const stride = this.def.stride * sc;
    a.phase += (spd / stride) * Math.PI * dt;
    const walk = clamp(spd / (this.def.walk * 1.2), 0, 1);
    const run = clamp((spd - this.def.walk * 1.5) / (this.def.run - this.def.walk * 1.5), 0, 1);
    const ph = a.phase;
    // legs
    for (const lg of R.legs) {
      let p = ph + (lg.side > 0 ? 0 : Math.PI);
      if (S.quad && lg.front) p += Math.PI; // diagonal gait
      const amp = (lg.front ? 0.35 : 0.45) * walk + run * 0.35;
      const swing = -Math.sin(p) * amp;
      const lift = Math.max(0, Math.cos(p)) * (0.5 + run * 0.6) * walk;
      const [a1, a2, a3] = lg.rest;
      const columnar = lg.L.foot === 'elephant' || lg.front;
      let h = swing, k = lift * (columnar ? 0.9 : 1.1), an = -lift * (columnar ? 0.6 : 1.3);
      if (a.air > 0) { h = lerp(h, -0.6, a.air); k = lerp(k, 1.2, a.air); an = lerp(an, -1.0, a.air); }
      if (dead) { h = 0.2; k = 0.1; an = 0; }
      setRot(lg.hip, h);
      setRot(lg.knee, k);
      setRot(lg.ankle, an);
      setRot(lg.toe, -(h + k + an) + (columnar ? 0 : Math.max(0, -Math.cos(p)) * 0.2 * walk));
    }
    // body bob & roll
    const bob = (-Math.abs(Math.sin(ph)) * 0.06 * walk - run * 0.04) * (S.hind.thigh * sc);
    B.pelvis.position.y = R.pelvisRest.y + bob;
    const roll = Math.sin(ph) * 0.04 * walk;
    const lunge = a.lunge;
    a.lunge = Math.max(0, a.lunge - dt * 2.2);
    const lungeCurve = Math.sin(Math.min(1, 1 - lunge) * Math.PI);
    const eatDown = a.eat;
    setRot(B.pelvis, (run * 0.06) - eatDown * 0.05 + a.roar * -0.08, 0, roll);
    // tail
    const tails = ['tail1', 'tail2', 'tail3', 'tail4'].filter((n) => B[n]);
    tails.forEach((n, i) => {
      const sway = Math.sin(a.t * (1.5 + run * 2) - i * 0.8) * (0.06 + walk * 0.06) * (1 + i * 0.3);
      const turn = -a.turn * 0.15 * (i + 1);
      const droop = dead ? 0.15 : (i === 0 ? -0.04 : 0.03) - run * 0.03;
      setRot(B[n], droop, sway + turn, 0);
    });
    // neck & head: look at target / player
    let lookYaw = 0, lookPitch = 0;
    const focus = this.target || this.threat || (this.game.player && this.pos.distanceTo(this.game.player.pos) < 25 ? this.game.player : null);
    if (focus && !dead) {
      const dx = focus.pos.x - this.pos.x, dz = focus.pos.z - this.pos.z;
      lookYaw = clamp(angleDiff(this.yaw, Math.atan2(dx, dz)), -1.0, 1.0);
      const dy = (focus.pos.y + 1) - (this.pos.y + S.hind.y * sc * 1.3);
      lookPitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5);
    }
    a.look = damp(a.look, lookYaw, 3, dt);
    a.lookPitch = damp(a.lookPitch, lookPitch, 3, dt);
    const necks = ['neck1', 'neck2', 'neck3'].filter((n) => B[n]);
    const roarUp = a.roar;
    const graze = eatDown * (this.def.diet === 'herb' ? 1 : 0.7);
    const nN = necks.length + 1;
    const grazeAmt = this.kindName === 'brachio' ? 0.25 : 0.55;
    const headBob = Math.sin(ph * 2) * 0.04 * walk;
    setRot(B.chest, -roll * 0.5 + graze * 0.1 + lungeCurve * 0.08, a.look * 0.15, -roll);
    necks.forEach((n) => setRot(B[n], (graze * grazeAmt * 2.2 - roarUp * 0.35 + lungeCurve * 0.25 + a.lookPitch) / nN + headBob, a.look / nN, 0));
    const tremble = a.roar > 0.5 ? Math.sin(a.t * 40) * 0.03 : 0;
    setRot(B.head, (graze * grazeAmt * 1.2 - roarUp * 0.25 + a.lookPitch * 0.5 + lungeCurve * 0.1) / 2 - headBob + tremble, a.look / nN, tremble);
    // jaw
    const jawTarget = Math.max(a.roar * 0.9, lungeCurve * 0.85, a.eat > 0.5 && this.def.diet === 'carn' ? 0.3 + Math.sin(a.t * 6) * 0.3 : 0, dead ? 0.5 : 0);
    a.jaw = damp(a.jaw, jawTarget, 12, dt);
    if (B.jaw) setRot(B.jaw, a.jaw * (S === undefined ? 0.6 : (this.kindName === 'trex' ? 0.75 : 0.6)));
    if (B.frill) { const f = Math.max(0.02, a.frill); B.frill.scale.setScalar(f); }
    if (R.arms) R.arms.forEach((ar, i) => setRot(ar.sh, Math.sin(a.t * 2 + i) * 0.1 + lungeCurve * -0.4, 0, 0));
    a.hurt = Math.max(0, (a.hurt || 0) - dt * 3);
  }
}
