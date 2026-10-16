// Ava Reyes — the player. Third-person movement, stealth, swimming, mounting, weapons and the camera rig.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { buildHuman, animateHuman, makeWeaponMesh } from './humanoid.js';
import { clamp, lerp, damp, dampAngle, angleDiff, smoothstep } from '../core/math.js';
import { WEAPONS, ITEMS } from '../data/items.js';
import { locById } from '../data/world.js';
import { grassPlayer, playerPosRef } from '../world/vegetation.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Player extends Entity {
  constructor(game) {
    super(game);
    this.category = 'player';
    this.faction = 'player';
    this.radius = 0.35;
    this.height = 1.75;
    this.maxHp = this.hp = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.focus = 100;
    this.rig = buildHuman('ava');
    this.group.add(this.rig.mesh);
    this.rig.mesh.traverse((o) => (o.castShadow = true));
    this.vy = 0;
    this.grounded = true;
    this.crouching = false;
    this.sprinting = false;
    this.swimming = false;
    this.mounted = null;
    this.mountInput = { yaw: 0, move: false, sprint: false, jump: false };
    this.aiming = false;
    this.camYaw = 0;
    this.camPitch = -0.1;
    this.moveYaw = 0;
    this.weapons = ['machete', 'pistol'];
    this.ammoClip = { pistol: 6, rifle: 8 };
    this.weaponIdx = 1;
    this.fireT = 0;
    this.reloadT = 0;
    this.drawT = 0;
    this.meleeT = -1;
    this.deadEye = false;
    this.marks = [];
    this.knockT = 0;
    this.inCover = false;
    this.godMode = false;
    this.upgrades = new Set();
    this.hitSpheres.push({ obj: this.rig.bones.chest, r: 0.32, mult: 1, name: 'body' }, { obj: this.rig.bones.head, local: new THREE.Vector3(0, 0.1, 0), r: 0.14, mult: 2, name: 'head' }, { obj: this.rig.bones.hips, r: 0.3, mult: 1, name: 'hips' });
    // weapon meshes
    this.weaponMeshes = {};
    for (const w of ['pistol', 'rifle', 'bow', 'machete']) {
      const m = makeWeaponMesh(w);
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      (w === 'bow' ? this.rig.bones.handL : this.rig.bones.handR).add(m);
      this.weaponMeshes[w] = m;
    }
    this.weaponMeshes.bow.rotation.set(Math.PI / 2, 0, 0);
    this.weaponMeshes.bow.position.set(0, -0.07, 0);
    this.weaponMeshes.pistol.position.set(0, -0.06, 0.02);
    this.weaponMeshes.rifle.position.set(0, -0.06, 0.02);
    this.weaponMeshes.machete.position.set(0, -0.07, 0.02);
    this.footT = 0;
    this.breathT = 0;
    this.lastSafe = new THREE.Vector3();
    this.blind = 0;
    this.regenDelay = 0;
  }

  get kind() { return 'player'; }
  get weapon() { return this.weapons[this.weaponIdx]; }
  get wdef() { return WEAPONS[this.weapon]; }

  inSafeZone() {
    const h = locById.haven;
    return Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 64;
  }

  spawn(x, z, yaw = 0) {
    this.pos.set(x, this.game.terrain.getHeight(x, z), z);
    this.yaw = this.moveYaw = this.camYaw = yaw;
    this.vel.set(0, 0, 0);
    this.alive = true;
    this.group.position.copy(this.pos);
  }

  maxAmmo(item) {
    const sat = this.upgrades.has('satchel') ? 1.5 : 1;
    if (item === 'arrow') return this.upgrades.has('quiver') ? 40 : 20;
    if (item === 'pistolAmmo') return Math.round(48 * sat);
    if (item === 'rifleAmmo') return Math.round(32 * sat);
    return Math.round((ITEMS[item]?.stack || 99) * sat);
  }

  onDamage(amount, source, info) {
    this.game.hud?.damageFrom(info.from || source?.pos);
    this.game.audio?.hurt();
    this.regenDelay = 6;
    this.game.cameraShake?.(this.pos, Math.min(1, amount / 40), 0.4);
    if (info.knock && source) {
      _v.copy(this.pos).sub(info.from || source.pos).setY(0).normalize();
      this.vel.addScaledVector(_v, info.knock * 2);
      this.vy = Math.min(4, info.knock);
      this.grounded = false;
    }
  }
  onDeath() {
    this.game.onPlayerDeath();
  }
  knockdown() { this.knockT = 1.2; }

  equip(i) {
    if (i < 0 || i >= this.weapons.length || i === this.weaponIdx) return;
    this.weaponIdx = i;
    this.reloadT = 0; this.drawT = 0; this.meleeT = -1;
    this.game.audio?.equip();
    this.game.hud?.weaponChanged();
  }

  giveWeapon(w) {
    if (!this.weapons.includes(w)) {
      this.weapons.push(w);
      this.weapons.sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot);
      if (w === 'rifle') this.ammoClip.rifle = 8;
    }
  }

  dismount(fall = false) {
    const m = this.mounted;
    if (!m) return;
    this.mounted = null;
    m.rider = null;
    m.state = m.alive ? 'stay' : 'dead';
    const side = _v.set(Math.cos(m.yaw), 0, -Math.sin(m.yaw)).multiplyScalar(m.radius + 1.2);
    this.pos.add(side);
    this.pos.y = this.game.terrain.getHeight(this.pos.x, this.pos.z) + (fall ? 0.5 : 0);
    this.vy = fall ? 3 : 0;
    this.rig.anim.mounted = 0;
  }

  mount(dino) {
    this.mounted = dino;
    dino.rider = this;
    dino.state = 'ridden';
    this.aiming = false;
    this.crouching = false;
    this.mountInput.yaw = dino.yaw;
    this.game.audio?.dino(dino.kindName, 'call', dino.pos, dino.scale);
  }

  update(dt, input, cam) {
    const G = this.game;
    const T = G.terrain;
    const a = this.rig.anim;
    if (!this.alive) {
      a.dead = Math.min(1, a.dead + dt * 1.5);
      this.group.rotation.x = -smoothstep(0, 1, a.dead) * Math.PI / 2;
      this.group.position.y = this.pos.y + 0.25 * a.dead;
      animateHuman(this.rig, dt);
      return;
    }
    this.group.rotation.x = 0;
    // ---- camera look ----
    const sens = 0.0022 * input.sensitivity * (this.aiming ? 0.6 : 1) * (G.timeScale < 0.9 ? 1 / Math.max(0.35, G.timeScale) * 0.5 : 1);
    this.camYaw -= input.mouse.dx * sens;
    this.camPitch -= input.mouse.dy * sens * (input.invertY ? -1 : 1);
    this.camPitch = clamp(this.camPitch, -1.25, 0.95);

    const fwd = _v.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = _v2.set(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (input.key('KeyW')) mz += 1;
    if (input.key('KeyS')) mz -= 1;
    if (input.key('KeyA')) mx -= 1;
    if (input.key('KeyD')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const wish = _v3.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (moving) wish.normalize();

    // ---- mounted ----
    if (this.mounted) {
      const m = this.mounted;
      if (input.hit('KeyF') || !m.alive) { this.dismount(); return; }
      this.mountInput.move = moving;
      if (moving) this.mountInput.yaw = Math.atan2(wish.x, wish.z);
      this.mountInput.sprint = (input.key('ShiftLeft') || input.key('ShiftRight')) && this.stamina > 1;
      this.mountInput.jump = input.hit('Space');
      if (this.mountInput.sprint && moving) this.stamina = Math.max(0, this.stamina - dt * 8);
      else this.stamina = Math.min(this.maxStamina, this.stamina + dt * 20);
      // sit on the saddle (pelvis bone)
      m.rig.bones.pelvis.getWorldPosition(this.pos);
      const sc = m.scale;
      this.pos.y += (m.kindName === 'para' ? 0.7 : 0.25) * sc - 0.9;
      this.yaw = m.yaw;
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.yaw;
      a.mounted = damp(a.mounted, 1, 8, dt);
      a.speed = 0; a.aim = damp(a.aim, 0, 10, dt);
      this.vel.copy(m.vel);
      this._weaponVisuals();
      animateHuman(this.rig, dt);
      this._aimAndFire(dt, input, cam, true);
      this._footsteps(dt, 0);
      grassPlayer.value.copy(this.pos); playerPosRef.copy(this.pos);
      return;
    }

    // ---- stance ----
    if (input.hit('KeyC')) this.crouching = !this.crouching;
    this.aiming = input.btn(2) && !this.swimming && this.knockT <= 0;
    const shift = input.key('ShiftLeft') || input.key('ShiftRight');
    const wantSprint = shift && moving && !this.aiming && this.stamina > 0.5 && mz >= 0;
    if (wantSprint && this.crouching) this.crouching = false;
    this.sprinting = wantSprint;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 14);
    else this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.swimming ? 6 : 18));

    let speed = this.swimming ? (this.sprinting ? 3.4 : 2.0) : this.crouching ? 1.9 : this.aiming ? 2.4 : this.sprinting ? 7.4 : 4.3;
    if (input.key('KeyX') && !this.sprinting) speed = 1.6;
    if (this.knockT > 0) { this.knockT -= dt; speed = 0; }
    const ctrl = this.grounded || this.swimming ? 1 : 0.25;
    const tvx = wish.x * speed * (moving ? 1 : 0), tvz = wish.z * speed * (moving ? 1 : 0);
    const accel = this.grounded ? (moving ? 12 : 14) : 2;
    this.vel.x = damp(this.vel.x, tvx, accel * ctrl, dt);
    this.vel.z = damp(this.vel.z, tvz, accel * ctrl, dt);

    // facing
    if (this.aiming || this.meleeT >= 0 || (this.weapon !== 'machete' && input.btn(0))) this.yaw = dampAngle(this.yaw, this.camYaw, 18, dt);
    else if (moving) { this.moveYaw = Math.atan2(wish.x, wish.z); this.yaw = dampAngle(this.yaw, this.moveYaw, 10, dt); }

    // jump
    if (input.hit('Space') && this.grounded && !this.swimming && this.knockT <= 0) {
      this.vy = 5.6; this.grounded = false; this.crouching = false;
      this.stamina = Math.max(0, this.stamina - 6);
      G.audio?.jump();
    }

    // integrate
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    // slope limit on steep terrain
    const hNew = T.getHeight(nx, nz), hOld = T.getHeight(this.pos.x, this.pos.z);
    const slopeOk = (hNew - hOld) / Math.max(1e-4, Math.hypot(nx - this.pos.x, nz - this.pos.z)) < 1.4 || hNew < hOld || this.swimming;
    if (slopeOk) { this.pos.x = nx; this.pos.z = nz; } else { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    this.vy -= 20 * dt;
    this.pos.y += this.vy * dt;
    G.colliders.resolve(this.pos, this.radius, this.height);
    const terrainY = T.getHeight(this.pos.x, this.pos.z);
    const floorY = G.colliders.floorAt(this.pos.x, this.pos.y, this.pos.z);
    let ground = Math.max(terrainY, floorY);
    // water
    const waterDepth = 0 - terrainY;
    const wasSwimming = this.swimming;
    this.swimming = waterDepth > 1.35 && ground === terrainY;
    if (this.swimming) {
      const surf = -1.2;
      this.pos.y = damp(this.pos.y, surf, 6, dt);
      this.vy = 0;
      this.grounded = false;
      if (!wasSwimming) { G.audio?.splash(this.pos); G.fx?.splash(_v.set(this.pos.x, 0, this.pos.z)); this.crouching = false; }
      if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 6);
      if (this.stamina <= 0) this.damage(dt * 6, null, {});
    } else if (this.pos.y <= ground) {
      if (!this.grounded && this.vy < -13) this.damage((-this.vy - 13) * 9, null, { type: 'fall' });
      if (!this.grounded && this.vy < -4) G.audio?.land();
      this.pos.y = ground;
      this.vy = 0;
      this.grounded = true;
    } else if (this.pos.y - ground > 0.25) this.grounded = false;
    else if (this.vy <= 0) { this.pos.y = ground; this.vy = 0; this.grounded = true; }
    if (this.grounded && terrainY > 0.5) this.lastSafe.copy(this.pos);
    this.inCover = !!G.vegetation && this.crouching;

    // regen
    this.regenDelay -= dt;
    if (this.regenDelay <= 0 && this.hp < this.maxHp * 0.6) this.hp = Math.min(this.maxHp * 0.6, this.hp + dt * 2.5);
    this.blind = Math.max(0, this.blind - dt * 0.25);

    // weapon switching
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) { const idx = this.weapons.findIndex((w) => WEAPONS[w].slot === i + 1); if (idx >= 0) this.equip(idx); }
    if (input.mouse.wheel) this.equip((this.weaponIdx + (input.mouse.wheel > 0 ? 1 : -1) + this.weapons.length) % this.weapons.length);

    // ---- animation ----
    const hs = Math.hypot(this.vel.x, this.vel.z);
    a.speed = this.swimming ? 0 : hs;
    a.crouch = damp(a.crouch, this.crouching ? 1 : 0, 10, dt);
    a.air = damp(a.air, !this.grounded && !this.swimming ? 1 : 0, 10, dt);
    a.swim = damp(a.swim, this.swimming ? 1 : 0, 6, dt);
    a.mounted = damp(a.mounted, 0, 10, dt);
    this.group.rotation.x = -a.swim * 1.25;
    a.lookPitch = damp(a.lookPitch, this.aiming ? 0 : clamp(-this.camPitch * 0.4, -0.4, 0.4), 6, dt);
    a.look = damp(a.look, this.aiming ? 0 : clamp(angleDiff(this.yaw, this.camYaw), -0.9, 0.9) * 0.6, 6, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this._weaponVisuals();
    this._aimAndFire(dt, input, cam, false);
    animateHuman(this.rig, dt);
    this._footsteps(dt, hs);
    grassPlayer.value.copy(this.pos); playerPosRef.copy(this.pos);
  }

  _footsteps(dt, hs) {
    if (!this.grounded || hs < 0.5) return;
    this.footT -= dt * hs / (this.sprinting ? 1.25 : 0.85);
    if (this.footT <= 0) {
      this.footT = 1;
      const road = this.game.terrain.getRoad(this.pos.x, this.pos.z) > 0.4;
      const wet = this.game.terrain.getHeight(this.pos.x, this.pos.z) < 0.4;
      this.game.audio?.footstep(wet ? 'water' : road ? 'dirt' : 'grass', this.crouching ? 0.4 : this.sprinting ? 1.2 : 0.8);
      if (wet) this.game.fx?.splash(this.pos, 0.3);
    }
  }

  _weaponVisuals() {
    const w = this.weapon;
    const a = this.rig.anim;
    for (const k in this.weaponMeshes) this.weaponMeshes[k].visible = k === w && !this.swimming;
    a.weapon = this.swimming ? 'none' : WEAPONS[w].hold || WEAPONS[w].type;
    if (w === 'machete') a.weapon = 'melee';
  }

  _aimAndFire(dt, input, cam, mounted) {
    const G = this.game;
    const a = this.rig.anim;
    const def = this.wdef;
    const C = G.combat;
    this.fireT -= dt;
    a.aim = damp(a.aim, this.aiming && !this.swimming ? 1 : 0, 14, dt);
    a.aimPitch = clamp(this.camPitch + 0.08, -1.1, 0.9);
    if (mounted) { this.aiming = input.btn(2); a.aim = this.aiming ? 1 : 0; }
    // reload
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      a.reload = 1 - this.reloadT / def.reload;
      if (this.reloadT <= 0) {
        const need = def.clip - this.ammoClip[this.weapon];
        const take = Math.min(need, G.inventory.count(def.ammo));
        G.inventory.remove(def.ammo, take);
        this.ammoClip[this.weapon] += take;
        a.reload = 0;
      }
      return;
    }
    a.reload = 0;
    if (def.type === 'gun' && input.hit('KeyR') && this.ammoClip[this.weapon] < def.clip && G.inventory.count(def.ammo) > 0) {
      this.reloadT = def.reload; G.audio?.reload(); return;
    }
    // Dead Eye
    if (input.hit('KeyQ') && def.type === 'gun' && this.aiming && !this.deadEye && this.focus > 15) C.startDeadEye();
    if (this.swimming) return;
    if (def.type === 'melee') {
      if (this.meleeT >= 0) {
        this.meleeT += dt / def.rate;
        a.melee = this.meleeT;
        if (!this._meleeHit && this.meleeT > 0.45) { this._meleeHit = true; C.melee(this, def); }
        if (this.meleeT >= 1) { this.meleeT = -1; a.melee = -1; }
      } else if (input.click(0)) { this.meleeT = 0; this._meleeHit = false; G.audio?.swing(); }
      return;
    }
    if (def.type === 'bow') {
      const hasArrow = G.inventory.count('poisonArrow') > 0 && this.usePoison ? 'poisonArrow' : 'arrow';
      if (this.aiming && input.btn(0) && G.inventory.count(hasArrow) > 0) {
        if (this.drawT === 0) G.audio?.bowDraw();
        this.drawT = Math.min(1, this.drawT + dt * 1.4);
      } else if (this.drawT > 0) {
        if (this.aiming && this.drawT > 0.25) { C.fireArrow(this, this.drawT, hasArrow); G.inventory.remove(hasArrow, 1); }
        this.drawT = 0;
      }
      a.draw = this.drawT;
      if (input.hit('KeyT')) { this.usePoison = !this.usePoison; G.hud?.toast(this.usePoison ? 'Venom arrows selected' : 'Standard arrows selected'); }
      return;
    }
    // guns
    if (this.deadEye) return; // handled by combat
    const wantsFire = this.aiming ? input.click(0) || (input.btn(0) && this.weapon === 'pistol' && false) : input.click(0);
    if (wantsFire && this.fireT <= 0) {
      if (this.ammoClip[this.weapon] <= 0) {
        G.audio?.dryFire();
        if (G.inventory.count(def.ammo) > 0) { this.reloadT = def.reload; G.audio?.reload(); }
        this.fireT = 0.3;
        return;
      }
      this.ammoClip[this.weapon]--;
      this.fireT = def.rate;
      C.fireGun(this, def, null);
    }
  }

  muzzleWorld(out) {
    const m = this.weaponMeshes[this.weapon];
    const mz = m?.userData.muzzle;
    if (!mz) return this.rig.bones.handR.getWorldPosition(out);
    return out.copy(mz).applyMatrix4(m.matrixWorld);
  }
}

// ---------------- Camera rig ----------------
export class CameraRig {
  constructor(camera, game) {
    this.cam = camera;
    this.game = game;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dist = 3.6;
    this.shoulder = 0.55;
    this.trauma = 0;
    this.baseFov = 62;
    this.fov = 62;
    this.cinematic = null; // {from,to,lookFrom,lookTo,t,dur}
  }
  shake(amount) { this.trauma = Math.min(1.2, this.trauma + amount); }
  update(dt, realDt) {
    const p = this.game.player;
    if (this.cinematic) return this._cinematic(realDt);
    const aiming = p.aiming && p.alive;
    const zoom = aiming && p.wdef.zoom;
    let dist = p.mounted ? 4.6 + p.mounted.scale * (p.mounted.kindName === 'para' ? 2.2 : 0.8) : aiming ? (zoom ? 1.35 : 1.75) : p.swimming ? 3.2 : 3.7;
    if (p.sprinting && !p.mounted) dist += 0.5;
    if (!p.alive) dist = 5;
    this.dist = damp(this.dist, dist, 8, realDt);
    this.shoulder = damp(this.shoulder, aiming ? 0.62 : p.mounted ? 0.0 : 0.5, 8, realDt);
    const targetFov = this.baseFov * (zoom ? 0.6 : aiming ? 0.82 : p.sprinting ? 1.08 : 1) + (p.mounted && p.mountInput.sprint ? 6 : 0);
    this.fov = damp(this.fov, targetFov, 6, realDt);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
    const pitch = p.camPitch, yaw = p.camYaw;
    const pivot = _v.copy(p.pos);
    pivot.y += p.mounted ? 1.9 + p.mounted.scale * 0.6 : p.swimming ? 0.6 : p.rig.anim.crouch > 0.5 ? 1.15 : 1.55;
    const dir = _v2.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const rightv = _v3.set(-Math.cos(yaw), 0, Math.sin(yaw));
    const shoulderPt = pivot.clone().addScaledVector(rightv, this.shoulder);
    // collision: pull in if terrain or colliders block
    const back = dir.clone().multiplyScalar(-1);
    let d = this.dist;
    const tHit = this.game.terrain.raycast(shoulderPt, back, d + 0.4, 0.4);
    if (tHit > 0) d = Math.min(d, tHit - 0.35);
    const cHit = this.game.colliders.raycast(shoulderPt, back, d + 0.3);
    if (cHit > 0) d = Math.min(d, cHit - 0.25);
    d = Math.max(0.6, d);
    const camPos = shoulderPt.addScaledVector(back, d);
    const gh = this.game.terrain.getHeight(camPos.x, camPos.z);
    if (camPos.y < gh + 0.6) camPos.y = gh + 0.6;
    if (camPos.y < -1.0 && !p.swimming) camPos.y = Math.max(camPos.y, 0.3);
    this.pos.copy(camPos);
    this.cam.position.copy(camPos);
    this.look.copy(camPos).add(dir);
    this.cam.lookAt(this.look);
    // shake
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    const s = this.trauma * this.trauma;
    if (s > 0.001) {
      const t = performance.now() * 0.001;
      this.cam.rotation.x += (Math.sin(t * 37) * 0.6 + Math.sin(t * 61) * 0.4) * 0.035 * s;
      this.cam.rotation.y += (Math.sin(t * 43 + 1) * 0.6 + Math.sin(t * 71) * 0.4) * 0.035 * s;
      this.cam.rotation.z += Math.sin(t * 29 + 2) * 0.03 * s;
    }
  }
  startCinematic(from, to, lookFrom, lookTo, dur, onDone) {
    this.cinematic = { from: from.clone(), to: to.clone(), lookFrom: lookFrom.clone(), lookTo: lookTo.clone(), t: 0, dur, onDone };
  }
  _cinematic(dt) {
    const c = this.cinematic;
    c.t += dt;
    const k = smoothstep(0, 1, Math.min(1, c.t / c.dur));
    this.cam.position.lerpVectors(c.from, c.to, k);
    this.look.lerpVectors(c.lookFrom, c.lookTo, k);
    this.cam.lookAt(this.look);
    this.cam.fov = this.baseFov; this.cam.updateProjectionMatrix();
    if (c.t >= c.dur) { this.cinematic = null; c.onDone?.(); }
  }
}
