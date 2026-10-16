// Human NPCs: Haven settlers, vendors, guards, and the Black Fang raiders (stealth detection + gunfights).
import * as THREE from 'three';
import { Entity } from './entity.js';
import { buildHuman, animateHuman, makeWeaponMesh } from './humanoid.js';
import { clamp, damp, dampAngle, angleDiff, rand, pick } from '../core/math.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const FIRST = ['Jesse', 'Wade', 'Cole', 'Hank', 'Eli', 'Rosa', 'Ines', 'Mara', 'Bo', 'Silas', 'Abe', 'Luz', 'Nell', 'Otto', 'Reed', 'June', 'Tomas', 'Cass'];
const LAST = ['Harlan', 'Voss', 'McCready', 'Ortega', 'Pike', 'Dunmore', 'Calloway', 'Reyes', 'Hollis', 'Briggs', 'Santos', 'Kade'];

export class Human extends Entity {
  constructor(game, role, x, z, opts = {}) {
    super(game);
    this.role = role;
    this.category = 'human';
    this.faction = role === 'raider' || role === 'boss' ? 'raider' : role === 'infected' ? 'infected' : 'haven';
    if (role === 'infected') this.category = 'infected';
    const preset = opts.preset || (role === 'raider' ? (Math.random() < 0.25 ? 'raiderF' : 'raider') : role === 'boss' ? 'crane' : role === 'infected' ? (Math.random() < 0.35 ? 'infectedF' : 'infected') : Math.random() < 0.5 ? 'settlerM' : 'settlerF');
    const tint = (c) => new THREE.Color(c).offsetHSL(rand(-0.04, 0.04), rand(-0.1, 0.1), rand(-0.08, 0.08)).getHex();
    const over = opts.colors || (role === 'settler' || role === 'guard' ? { top: tint(pick([0x8a7a5a, 0x6a3a2a, 0x4a5a6a, 0x7a6a3a, 0x9a8a7a])), pants: tint(pick([0x4a4a52, 0x5a4a3a, 0x3a3228])) } : {});
    this.rig = buildHuman(preset, over);
    this.group.add(this.rig.mesh);
    this.name = opts.name || `${pick(FIRST)} ${pick(LAST)}`;
    this.maxHp = this.hp = role === 'boss' ? 420 : role === 'raider' ? 70 : role === 'infected' ? 140 : 80;
    if (role === 'infected') { this.rig.anim.zombie = 1; this.state = 'wander'; this.groanT = rand(2, 8); }
    this.radius = 0.35;
    this.height = 1.8;
    this.pos.set(x, game.terrain.getHeight(x, z), z);
    this.yaw = opts.yaw ?? rand(0, 6.28);
    this.home = new THREE.Vector3(opts.homeX ?? x, 0, opts.homeZ ?? z);
    this.homeR = opts.homeR ?? 20;
    this.state = opts.state || (role === 'raider' || role === 'boss' ? 'patrol' : role === 'vendor' ? 'stand' : 'wander');
    this.stateT = 0;
    this.speed = 0;
    this.desired = null;
    this.awareness = 0;
    this.target = null;
    this.lastSeen = new THREE.Vector3();
    this.fireT = rand(1, 2);
    this.clip = 6;
    this.think = rand(0, 0.3);
    this.talkLines = opts.lines || null;
    this.questId = opts.questId || null;
    this.id2 = opts.id || null;
    this.camp = opts.camp || null;
    this.bounty = opts.bounty || 0;
    this.looted = false;
    this.strafe = rand() < 0.5 ? 1 : -1;
    this.gun = role === 'raider' || role === 'boss' || role === 'guard' ? (opts.gun || (Math.random() < 0.5 ? 'rifle' : 'pistol')) : null;
    if (this.gun) {
      const m = makeWeaponMesh(this.gun); m.rotation.x = Math.PI / 2; m.position.set(0, -0.06, 0.02);
      this.rig.bones.handR.add(m); this.gunMesh = m;
      this.rig.anim.weapon = this.gun;
    }
    const inf = role === 'infected';
    this.hitSpheres.push({ obj: this.rig.bones.chest, r: 0.3, mult: inf ? 0.45 : 1, name: 'body' }, { obj: this.rig.bones.head, local: new THREE.Vector3(0, 0.1, 0), r: 0.13, mult: inf ? 5 : 2.5, name: 'head' }, { obj: this.rig.bones.hips, r: 0.28, mult: inf ? 0.4 : 0.9, name: 'hips' });
    this.group.position.copy(this.pos);
    this.waypoints = opts.waypoints || null;
    this.wpI = 0;
    this.poisoned = 0;
  }
  get kind() { return 'human'; }

  onDamage(amount, source, info) {
    this.game.audio?.human('hurt', this.pos, this.rig.female);
    if (this.faction === 'raider' && source) {
      this.awareness = 1;
      if (!this.target || this.target.category !== 'player' || source.category === 'player') this.target = source;
      this.lastSeen.copy(source.pos);
      this.setState('combat');
      this._alertCamp(source);
    } else if (this.faction === 'haven' && source && source.category === 'player') {
      this.game.events.emit('crime', { victim: this });
    }
    this.rig.anim.hurt = 1;
  }
  onDeath(source) {
    this.state = 'dead';
    this.stateT = 0;
    this.game.audio?.human('die', this.pos, this.rig.female);
    if (this.gunMesh) this.gunMesh.visible = false;
  }
  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  _alertCamp(src) {
    for (const e of this.game.entities) {
      if (e !== this && e.alive && e.kind === 'human' && e.faction === 'raider' && e.pos.distanceTo(this.pos) < 55) {
        if (e.state !== 'combat') { e.awareness = Math.max(e.awareness, 0.9); e.target = src; e.lastSeen.copy(src.pos); e.setState('combat'); }
      }
    }
  }

  canSee(e, maxD) {
    const eye = _v.copy(this.pos); eye.y += 1.6;
    const tgt = _v2.copy(e.pos); tgt.y += (e.crouching ? 0.9 : 1.4);
    const d = eye.distanceTo(tgt);
    if (d > maxD) return false;
    const dir = tgt.sub(eye).normalize();
    // view cone
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const dot = (dir.x * fx + dir.z * fz) / Math.max(1e-4, Math.hypot(dir.x, dir.z));
    if (dot < (this.state === 'combat' ? -1 : 0.3) && d > 4) return false;
    const th = this.game.terrain.raycast(eye, dir, d, 2);
    if (th > 0 && th < d - 1) return false;
    const ch = this.game.colliders.raycast(eye, dir, d - 0.6);
    if (ch > 0 && ch < d - 0.8) return false;
    return true;
  }

  // Noise heard (gunshot etc.)
  hear(pos, loud, src) {
    if (!this.alive || this.faction !== 'raider') return;
    const d = this.pos.distanceTo(pos);
    if (d > loud) return;
    if (this.state !== 'combat') {
      this.awareness = Math.max(this.awareness, 0.65);
      this.lastSeen.copy(pos);
      this.setState('investigate');
      if (src && src.category === 'player' && d < loud * 0.5) { this.target = src; this.awareness = 1; this.setState('combat'); }
    }
  }

  update(dt) {
    const G = this.game;
    const a = this.rig.anim;
    if (!this.alive) {
      this.stateT += dt;
      a.dead = Math.min(1, a.dead + dt * 1.8);
      a.speed = 0; a.aim = 0;
      this.group.rotation.x = -Math.min(1, a.dead * 1.2) * Math.PI / 2 * 0.98;
      this.group.position.y = this.pos.y + 0.2 * a.dead;
      animateHuman(this.rig, dt);
      return;
    }
    if (this.poisoned > 0) {
      this.poisoned -= dt;
      this.damage(dt * 6, null, {});
      if (Math.random() < dt * 2) G.fx?.smoke(this.rig.bones.head.getWorldPosition(_v), 0x60a020);
    }
    this.stateT += dt;
    this.think -= dt;
    if (this.think <= 0) { this.think = 0.2; this._decide(); }
    this._act(dt);
    // move
    const yawT = this.desired ? Math.atan2(this.desired.x - this.pos.x, this.desired.z - this.pos.z) : this.yaw;
    let faceYaw = yawT;
    if (this.state === 'combat' && this.target) faceYaw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
    this.yaw = dampAngle(this.yaw, faceYaw, 8, dt);
    let mvx = 0, mvz = 0;
    if (this.desired && this.desiredSpeed > 0) {
      const dx = this.desired.x - this.pos.x, dz = this.desired.z - this.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.6) { mvx = (dx / dd) * this.desiredSpeed; mvz = (dz / dd) * this.desiredSpeed; }
    }
    this.vel.x = damp(this.vel.x, mvx, 8, dt);
    this.vel.z = damp(this.vel.z, mvz, 8, dt);
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (G.terrain.getHeight(nx, nz) > -0.5) { this.pos.x = nx; this.pos.z = nz; }
    G.colliders.resolve(this.pos, this.radius, 1.8);
    const floor = G.colliders.floorAt(this.pos.x, this.pos.y + 0.5, this.pos.z);
    this.pos.y = Math.max(G.terrain.getHeight(this.pos.x, this.pos.z), floor > -1e8 ? floor : -1e9);
    if (this.perch) this.pos.y = Math.max(this.pos.y, this.perch.y);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    // in-place strafing animates as walking
    a.speed = Math.hypot(this.vel.x, this.vel.z);
    a.aim = damp(a.aim, this.state === 'combat' && this.gun ? 1 : 0, 6, dt);
    if (this.target && this.state === 'combat') {
      const dy = this.target.pos.y + 1.2 - (this.pos.y + 1.5);
      a.aimPitch = clamp(Math.atan2(dy, this.pos.distanceTo(this.target.pos)), -0.8, 0.8);
    }
    a.wave = damp(a.wave, this.waving > 0 ? 1 : 0, 6, dt);
    this.waving = Math.max(0, (this.waving || 0) - dt);
    a.crouch = damp(a.crouch, this.crouch ? 1 : 0, 6, dt);
    a.sit = damp(a.sit, this.state === 'sit' ? 1 : 0, 4, dt);
    animateHuman(this.rig, dt);
  }

  _decide() {
    const G = this.game, p = G.player;
    if (this.faction === 'raider') {
      // vision of player
      const range = (p.crouching ? 18 : 42) * (G.atmo.isNight() ? 0.6 : 1) * (p.inCover ? 0.75 : 1) * (p.mounted ? 1.4 : 1);
      if (p.alive && !p.godMode && this.canSee(p, this.state === 'combat' ? 120 : range)) {
        const d = this.pos.distanceTo(p.pos);
        const rate = this.state === 'combat' ? 5 : (1.2 - d / range) * (p.crouching ? 0.5 : 1.1) * 1.6;
        this.awareness = Math.min(1, this.awareness + Math.max(0.08, rate) * 0.2);
        this.lastSeen.copy(p.pos);
        if (this.awareness >= 1 && this.state !== 'combat') {
          this.target = p; this.setState('combat'); this._alertCamp(p);
          G.audio?.human('alert', this.pos, this.rig.female);
          G.hud?.toast(`${this.role === 'boss' ? this.name : 'Black Fang'} spotted you!`, 'danger');
        } else if (this.awareness > 0.45 && this.state !== 'combat') { this.setState('investigate'); }
        if (this.state === 'combat') this.target = p;
        this.seenT = 0;
      } else {
        this.seenT = (this.seenT || 0) + 0.2;
        if (this.state !== 'combat') this.awareness = Math.max(0, this.awareness - 0.02);
      }
      // predators threatening the camp
      if (this.state !== 'combat' || (this.target && this.target.category !== 'player')) {
        for (const e of G.entities) {
          if (((e.kind === 'dino' && e.faction === 'pred' && !e.tamed) || e.faction === 'infected') && e.alive && e.pos.distanceTo(this.pos) < 30) {
            this.target = e; this.setState('combat'); this.awareness = 1; break;
          }
        }
      }
      if (this.state === 'combat') {
        if (!this.target || !this.target.alive) {
          this.target = null;
          if (p.alive && this.canSee(p, 60) && this.awareness > 0.9) this.target = p; else this.setState('search');
        } else if (this.target === p && this.seenT > 9) { this.setState('search'); }
      }
      if (this.state === 'search' && this.stateT > 25) { this.awareness = 0.3; this.setState('patrol'); }
      if (this.state === 'investigate' && this.stateT > 14) { this.awareness *= 0.5; this.setState('patrol'); }
    } else if (this.role === 'infected') {
      // hunt the nearest living thing that isn't infected
      if (!this.target || !this.target.alive || this.pos.distanceTo(this.target.pos) > 60) {
        this.target = null;
        let best = null, bd = G.atmo.isNight() ? 38 : 24;
        for (const e of G.entities) {
          if (!e.alive || e === this || e.faction === 'infected' || e.flyer) continue;
          if (e.kind === 'dino' && e.def.size > 1.6) continue;
          if (e === p && (p.godMode || (p.crouching && this.pos.distanceTo(p.pos) > 10))) continue;
          const d = this.pos.distanceTo(e.pos);
          if (d < bd) { bd = d; best = e; }
        }
        this.target = best;
      }
      this.setState(this.target ? 'combat' : 'wander');
      this.groanT -= 0.2;
      if (this.groanT <= 0) { this.groanT = rand(3, 9); G.audio?.human('groan', this.pos, this.rig.female); }
    } else if (this.role === 'guard') {
      this.target = null;
      for (const e of G.entities) {
        if (e.kind === 'dino' && e.alive && e.faction === 'pred' && !e.tamed && e.pos.distanceTo(this.pos) < 70 && this.canSee(e, 70)) { this.target = e; break; }
        if (e.kind === 'human' && e.alive && (e.faction === 'raider' || e.faction === 'infected') && e.pos.distanceTo(this.pos) < 60 && this.canSee(e, 60)) { this.target = e; break; }
      }
      this.setState(this.target ? 'combat' : 'stand');
    } else if (this.role === 'settler') {
      // flee from predators
      for (const e of G.entities) if (((e.kind === 'dino' && e.faction === 'pred') || e.faction === 'infected') && e.alive && e.pos.distanceTo(this.pos) < 25) { this.fleeFrom = e; this.setState('flee'); break; }
      if (this.state === 'flee' && this.stateT > 8) this.setState('wander');
      const night = G.atmo.isNight();
      if (night && this.state === 'wander' && this.nightSpot) this.setState('sit');
      if (!night && this.state === 'sit') this.setState('wander');
    }
    // wave at player when near & friendly
    if (this.faction === 'haven' && p.alive && this.pos.distanceTo(p.pos) < 6 && this.state !== 'combat' && Math.random() < 0.05) this.waving = 1.6;
  }

  _act(dt) {
    const G = this.game;
    this.crouch = false;
    switch (this.state) {
      case 'stand':
        this.desired = null; this.desiredSpeed = 0;
        if (this.faceYaw != null) this.yaw = dampAngle(this.yaw, this.faceYaw, 2, dt);
        break;
      case 'sit':
        if (this.nightSpot) { this.desired = this.nightSpot; this.desiredSpeed = this.pos.distanceTo(this.nightSpot) > 1 ? 1.4 : 0; }
        break;
      case 'wander': case 'patrol': {
        if (this.role === 'infected' && this.desiredSpeed > 0) this.desiredSpeed = 0.9;
        if (this.waypoints) {
          const wp = this.waypoints[this.wpI % this.waypoints.length];
          this.desired = wp; this.desiredSpeed = 1.4;
          if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 1.2) { this.wpI++; this.pauseT = rand(2, 7); }
          if (this.pauseT > 0) { this.pauseT -= dt; this.desiredSpeed = 0; }
        } else {
          if (!this.desired || this.stateT > 20 || Math.hypot(this.desired.x - this.pos.x, this.desired.z - this.pos.z) < 1) {
            const ang = rand(0, 6.28), r = rand(2, this.homeR);
            this.desired = new THREE.Vector3(this.home.x + Math.sin(ang) * r, 0, this.home.z + Math.cos(ang) * r);
            this.pauseT = rand(2, 8); this.stateT = 0;
          }
          if (this.pauseT > 0) { this.pauseT -= dt; this.desiredSpeed = 0; } else this.desiredSpeed = 1.3;
        }
        break;
      }
      case 'flee': {
        if (this.fleeFrom) {
          const dx = this.pos.x - this.fleeFrom.pos.x, dz = this.pos.z - this.fleeFrom.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          this.desired = new THREE.Vector3(this.pos.x + (dx / d) * 10, 0, this.pos.z + (dz / d) * 10);
          this.desiredSpeed = 5.5;
        }
        break;
      }
      case 'investigate':
        this.desired = this.lastSeen; this.desiredSpeed = 1.8;
        if (this.pos.distanceTo(this.lastSeen) < 2) this.desiredSpeed = 0;
        break;
      case 'search':
        if (!this.desired || this.pos.distanceTo(this.desired) < 2) {
          this.desired = this.lastSeen.clone().add(new THREE.Vector3(rand(-12, 12), 0, rand(-12, 12)));
        }
        this.desiredSpeed = 2.4;
        break;
      case 'combat': {
        const t = this.target;
        if (!t) break;
        const d = this.pos.distanceTo(t.pos);
        if (this.role === 'infected') {
          this.desired = t.pos; this.desiredSpeed = d > 3 ? (G.atmo.isNight() ? 3.6 : 2.6) : 0.6;
          this.fireT -= dt;
          if (d < 1.7 && this.fireT <= 0) {
            this.fireT = 1.3; this.rig.anim.lunge = 1;
            t.damage(t === G.player ? 13 * ({ easy: 0.6, normal: 1, hard: 1.4 }[G.settings.difficulty] || 1) : 18, this, { type: 'bite', from: this.pos, knock: 1.5 });
            G.fx?.blood(t.pos.clone().setY(t.pos.y + 1.3), 8);
            G.audio?.human('groan', this.pos, this.rig.female);
          }
          break;
        }
        const ideal = this.role === 'guard' ? 0 : this.gun === 'rifle' ? 22 : 13;
        if (this.role === 'guard' || this.perch) { this.desired = null; this.desiredSpeed = 0; }
        else {
          // keep range, strafe
          const toT = _v.copy(t.pos).sub(this.pos).setY(0).normalize();
          const side = _v2.set(-toT.z, 0, toT.x).multiplyScalar(this.strafe);
          const want = this.pos.clone().addScaledVector(side, 4);
          if (d > ideal + 6) want.addScaledVector(toT, 6); else if (d < ideal - 6) want.addScaledVector(toT, -5);
          this.desired = want; this.desiredSpeed = d > ideal + 15 ? 4.6 : 2.2;
          if (Math.random() < dt * 0.4) this.strafe *= -1;
          this.crouch = d > 18 && Math.sin(this.stateT * 0.7 + this.id) > 0.3;
        }
        if (t.kind === 'dino' && d < 7) { this.desiredSpeed = 5; this.desired = this.pos.clone().addScaledVector(_v.copy(this.pos).sub(t.pos).setY(0).normalize(), 6); }
        // shooting
        this.fireT -= dt;
        if (this.gun && this.fireT <= 0 && this.stateT > 0.6) {
          if (this.clip <= 0) { this.clip = this.gun === 'rifle' ? 8 : 6; this.fireT = 2.4; G.audio?.reload(this.pos); break; }
          const visible = t === G.player ? this.canSee(t, 160) : true;
          if (visible) {
            this.clip--;
            this.fireT = (this.gun === 'rifle' ? 1.6 : 0.9) * rand(0.8, 1.5) * (this.role === 'boss' ? 0.6 : 1);
            G.combat.npcFire(this, t);
          } else this.fireT = 0.5;
        }
        if (!this.gun && d < 2) { this.fireT -= dt; if (this.fireT <= 0) { this.fireT = 1.2; t.damage(10, this, { from: this.pos, knock: 2 }); } }
        break;
      }
    }
  }
}
