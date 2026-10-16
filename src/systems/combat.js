// Combat: hitscan guns, physical arrows, machete melee, NPC gunfire, dilophosaur spit, Dead Eye targeting, noise.
import * as THREE from 'three';
import { rand, clamp } from '../core/math.js';
import { WEAPONS } from '../data/items.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _spheres = [];

function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : -1);
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.arrows = [];
    this.spits = [];
    this.marks = [];
    this.deadEyeQueue = null;
    const shaft = new THREE.CylinderGeometry(0.008, 0.008, 0.75, 4); shaft.rotateX(Math.PI / 2);
    this.arrowGeo = shaft;
    this.arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.7 });
    this.poisonMat = new THREE.MeshStandardMaterial({ color: 0x80c040, emissive: 0x204000, roughness: 0.6 });
    const fl = new THREE.PlaneGeometry(0.05, 0.12); fl.rotateX(Math.PI / 2); fl.translate(0, 0, -0.33);
    this.fletchGeo = fl;
    this.fletchMat = new THREE.MeshStandardMaterial({ color: 0xa02818, side: THREE.DoubleSide });
    this.spitMat = new THREE.MeshBasicMaterial({ color: 0x9adf30 });
  }

  // Ray against everything. Returns {t, point, entity, mult, part, surface}
  raycast(o, d, maxT, ignore = null) {
    const G = this.game;
    let best = { t: maxT, point: null, entity: null, mult: 1, surface: null };
    const tt = G.terrain.raycast(o, d, maxT, 0.75);
    if (tt > 0 && tt < best.t) best = { t: tt, entity: null, surface: 'dirt' };
    const tc = G.colliders.raycast(o, d, best.t);
    if (tc >= 0 && tc < best.t) best = { t: tc, entity: null, surface: 'wood' };
    for (const e of G.entities) {
      if (e === ignore || (e.alive === false && e.kind !== 'dino')) continue;
      if (e === G.player && e.mounted && ignore === G.player) continue;
      if (ignore === G.player && e === G.player.mounted) continue;
      // coarse reject
      _p.copy(e.pos).sub(o);
      const along = _p.dot(d);
      if (along < -10 || along > best.t + 10) continue;
      const perp2 = _p.lengthSq() - along * along;
      const R = (e.radius || 1) * 4 + 6;
      if (perp2 > R * R) continue;
      for (const s of e.getHitSpheres(_spheres)) {
        const t = raySphere(o, d, s.c, s.r);
        if (t >= 0 && t < best.t) best = { t, entity: e, mult: s.mult, part: s.name, surface: 'flesh' };
      }
    }
    if (best.surface == null) return null;
    best.point = o.clone().addScaledVector(d, best.t);
    return best;
  }

  aimRay(spread = 0) {
    const cam = this.game.camera;
    const o = cam.position.clone();
    const d = new THREE.Vector3(rand(-1, 1) * spread, rand(-1, 1) * spread, -1).applyQuaternion(cam.quaternion).normalize();
    return { o, d };
  }

  // Where is the crosshair pointing?
  aimPoint(spread = 0, maxT = 400) {
    const { o, d } = this.aimRay(spread);
    // start ray ahead of the camera so we don't hit the player
    o.addScaledVector(d, this.game.cameraRig.dist + 0.3);
    const hit = this.raycast(o, d, maxT, this.game.player);
    return { point: hit ? hit.point : o.clone().addScaledVector(d, maxT), hit, dir: d };
  }

  noise(pos, radius, src) {
    const G = this.game;
    for (const e of G.entities) {
      if (!e.alive) continue;
      const dist = e.pos.distanceTo(pos);
      if (dist > radius) continue;
      if (e.kind === 'human') e.hear(pos, radius, src);
      else if (e.kind === 'dino' && !e.tamed && !e.rider && e.state !== 'chase') {
        if (e.def.diet === 'herb' && !e.def.gentle) { e.threat = src; e.setState('flee'); }
        else if (e.def.diet === 'carn' && dist < radius * 0.6 && src && src.alive && e.def.prey.includes(src.category)) { e.target = src; e.setState('chase'); }
      }
    }
  }

  applyHit(hit, dmg, src, info = {}) {
    const G = this.game;
    if (!hit) return;
    if (hit.entity) {
      const e = hit.entity;
      const wasAlive = e.alive;
      const final = dmg * (hit.mult || 1);
      if (wasAlive) e.damage(final, src, { ...info, part: hit.part, from: src?.pos });
      G.fx.blood(hit.point, hit.part === 'head' ? 18 : 10);
      if (src === G.player && wasAlive) {
        G.hud.hitmarker(!e.alive, hit.part === 'head');
        if (!e.alive) G.stats.kills++;
        if (!e.alive && hit.part === 'head') { G.hud.toast('Headshot!'); G.stats.headshots++; }
      }
    } else {
      G.fx.impact(hit.point, null, hit.surface);
      G.audio.impact(hit.point, hit.surface);
    }
  }

  fireGun(player, def, forcedPoint) {
    const G = this.game;
    const moving = Math.hypot(player.vel.x, player.vel.z) > 1;
    const spread = player.aiming ? def.spread * (moving ? 2 : 1) * (player.crouching ? 0.6 : 1) : def.spread * 4;
    let target;
    if (forcedPoint) target = forcedPoint;
    else target = this.aimPoint(spread, def.range).point;
    const muzzle = player.muzzleWorld(new THREE.Vector3());
    const dir = target.clone().sub(muzzle).normalize();
    const dist = Math.min(def.range, muzzle.distanceTo(target) + 2);
    const hit = this.raycast(muzzle, dir, dist, player);
    G.fx.muzzle(muzzle);
    G.fx.tracer(muzzle, hit ? hit.point : muzzle.clone().addScaledVector(dir, dist));
    G.audio.gunshot(def.hold, muzzle, true);
    G.cameraRig.shake(def.hold === 'rifle' ? 0.35 : 0.22);
    player.camPitch += def.hold === 'rifle' ? 0.03 : 0.018;
    if (hit) this.applyHit(hit, def.dmg * rand(0.9, 1.1), player, { type: 'bullet', knock: 0.4 });
    this.noise(player.pos, def.noise, player);
    G.stats.shots++;
  }

  fireArrow(player, draw, type = 'arrow') {
    const G = this.game;
    const def = WEAPONS.bow;
    const target = this.aimPoint(0.002 + (1 - draw) * 0.02, 300).point;
    const from = player.rig.bones.handL.getWorldPosition(new THREE.Vector3());
    from.y += 0.05;
    const dir = target.clone().sub(from).normalize();
    const speed = def.speed * (0.35 + draw * 0.65);
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(this.arrowGeo, type === 'poisonArrow' ? this.poisonMat : this.arrowMat), new THREE.Mesh(this.fletchGeo, this.fletchMat));
    mesh.position.copy(from);
    G.scene.add(mesh);
    this.arrows.push({ mesh, pos: from.clone(), vel: dir.multiplyScalar(speed), dmg: def.dmg * (0.3 + draw * 0.7), life: 6, stuck: false, poison: type === 'poisonArrow', src: player });
    G.audio.bowRelease();
    this.noise(player.pos, 6, player);
    G.stats.shots++;
  }

  melee(player, def) {
    const G = this.game;
    const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    let hitAny = false;
    for (const e of G.entities) {
      if (e === player || !e.alive || e === player.mounted) continue;
      const to = e.pos.clone().sub(player.pos); to.y = 0;
      const d = to.length() - (e.radius || 0.4);
      if (d > def.range) continue;
      if (to.normalize().dot(fwd) < 0.35) continue;
      // stealth takedown: unaware raiders/dinos die instantly from behind while crouched
      let dmg = def.dmg;
      const unaware = (e.kind === 'human' && (e.state !== 'combat' || e.role === 'infected')) || (e.kind === 'dino' && e.state !== 'chase' && e.def.size < 2);
      const behind = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)).dot(fwd) > 0.3;
      if (player.crouching && unaware && behind) { dmg = 999; G.hud.toast('Silent takedown'); G.stats.takedowns++; }
      const p = e.pos.clone(); p.y += (e.height || 1.2) * 0.6;
      this.applyHit({ entity: e, point: p, mult: 1, part: 'body' }, dmg, player, { type: 'melee', knock: 1 });
      hitAny = true;
    }
    if (hitAny) { G.audio.meleeHit(); G.cameraRig.shake(0.15); }
  }

  npcFire(shooter, target) {
    const G = this.game;
    const muzzle = shooter.gunMesh ? shooter.gunMesh.localToWorld(shooter.gunMesh.userData.muzzle.clone()) : shooter.pos.clone().setY(shooter.pos.y + 1.5);
    const aimAt = target.pos.clone(); aimAt.y += (target.height || 1.5) * 0.6;
    const dist = muzzle.distanceTo(aimAt);
    // accuracy model: distance, target movement, difficulty, darkness
    const tv = target.vel ? Math.hypot(target.vel.x, target.vel.z) : 0;
    let spread = 0.02 + dist * 0.0009 + tv * 0.008;
    if (target === G.player) {
      spread *= G.settings.difficulty === 'easy' ? 1.6 : G.settings.difficulty === 'hard' ? 0.75 : 1.1;
      if (target.crouching) spread *= 1.2;
      if (G.atmo.isNight()) spread *= 1.3;
    }
    const dir = aimAt.sub(muzzle).normalize();
    dir.x += rand(-1, 1) * spread; dir.y += rand(-1, 1) * spread; dir.z += rand(-1, 1) * spread; dir.normalize();
    const hit = this.raycast(muzzle, dir, 200, shooter);
    G.fx.muzzle(muzzle);
    G.fx.tracer(muzzle, hit ? hit.point : muzzle.clone().addScaledVector(dir, 200));
    G.audio.gunshot(shooter.gun, muzzle, false);
    if (hit && hit.entity) {
      const base = shooter.gun === 'rifle' ? 16 : 11;
      const diff = target === G.player ? (G.settings.difficulty === 'easy' ? 0.6 : G.settings.difficulty === 'hard' ? 1.35 : 1) : 2.5;
      this.applyHit(hit, base * diff, shooter, { type: 'bullet' });
    } else if (hit) {
      this.applyHit(hit, 0, shooter);
      if (target === G.player && hit.point.distanceTo(G.player.pos) < 4) G.audio.whizz(hit.point);
    }
    if (target !== G.player) this.noise(shooter.pos, 60, shooter);
  }

  spit(dino, target) {
    const G = this.game;
    const from = dino.headPos(new THREE.Vector3());
    const to = target.pos.clone(); to.y += 1.4;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), this.spitMat);
    m.position.copy(from);
    G.scene.add(m);
    const v = to.sub(from); const t = Math.max(0.3, v.length() / 18);
    v.divideScalar(t); v.y += 9.8 * 0.5 * t * 0.6;
    this.spits.push({ mesh: m, pos: from.clone(), vel: v, life: 3, src: dino, target });
  }

  // ---- Dead Eye ----
  startDeadEye() {
    const G = this.game, p = G.player;
    p.deadEye = true;
    this.marks = [];
    this.markT = 0;
    G.timeScale = 0.3;
    G.audio.deadEye(true);
    G.hud.deadEye(true);
  }
  endDeadEye() {
    const G = this.game;
    G.player.deadEye = false;
    G.timeScale = 1;
    this.marks = [];
    G.audio.deadEye(false);
    G.hud.deadEye(false);
  }

  update(dt, realDt, input) {
    const G = this.game, p = G.player;
    // Dead Eye
    if (p.deadEye) {
      p.focus -= realDt * 14;
      const def = p.wdef;
      if (this.deadEyeQueue) {
        this.deadEyeQueue.t -= realDt;
        if (this.deadEyeQueue.t <= 0) {
          const m = this.deadEyeQueue.list.shift();
          if (m && p.ammoClip[p.weapon] > 0) {
            p.ammoClip[p.weapon]--;
            const pt = m.entity.alive ? m.sphere.c.clone() : m.point;
            this.fireGun(p, { ...def, spread: 0 }, pt);
            this.deadEyeQueue.t = 0.14;
          }
          if (!this.deadEyeQueue.list.length || p.ammoClip[p.weapon] <= 0) { this.deadEyeQueue = null; this.endDeadEye(); }
        }
      } else {
        this.markT -= realDt;
        if (this.markT <= 0 && this.marks.length < p.ammoClip[p.weapon]) {
          const { o, d } = this.aimRay(0);
          o.addScaledVector(d, G.cameraRig.dist + 0.3);
          const hit = this.raycast(o, d, def.range, p);
          if (hit && hit.entity && hit.entity.alive) {
            const spheres = hit.entity.getHitSpheres([]);
            const s = spheres.find((q) => q.name === hit.part) || spheres[0];
            this.marks.push({ entity: hit.entity, sphere: { c: s.c.clone(), name: s.name }, point: hit.point.clone(), part: hit.part });
            this.markT = 0.18;
            G.audio.mark();
          }
        }
        // track moving targets
        for (const m of this.marks) {
          const s = m.entity.getHitSpheres([]).find((q) => q.name === m.part);
          if (s) m.sphere.c.copy(s.c);
        }
        if (input.click(0) || p.focus <= 0 || !p.aiming) {
          if (this.marks.length && p.aiming) this.deadEyeQueue = { list: [...this.marks], t: 0 };
          else this.endDeadEye();
        }
      }
      p.focus = Math.max(0, p.focus);
    } else {
      p.focus = Math.min(100, p.focus + dt * 1.2);
    }
    // arrows
    const T = G.terrain;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.life <= 0) { a.mesh.removeFromParent(); this.arrows.splice(i, 1); continue; }
      if (a.stuck) { if (a.stuckTo) { a.mesh.position.copy(a.stuckTo.pos).add(a.offset); } continue; }
      a.vel.y -= 9.8 * 0.55 * dt;
      const step = a.vel.length() * dt;
      _d.copy(a.vel).normalize();
      const hit = this.raycast(a.pos, _d, step + 0.4, a.src);
      if (hit) {
        a.stuck = true; a.life = 20;
        a.mesh.position.copy(hit.point);
        if (hit.entity) {
          this.applyHit(hit, a.dmg, a.src, { type: 'arrow', silent: true });
          if (a.poison && hit.entity.alive) {
            hit.entity.poisoned = 8;
            if (hit.entity.kind === 'human') { hit.entity.faction = 'pred'; hit.entity.target = null; G.hud.toast('Poisoned — he turns on his own!'); hit.entity.setState('combat'); setTimeout(() => { if (hit.entity.alive) hit.entity.faction = 'raider'; }, 8000); }
            if (hit.entity.kind === 'dino') { hit.entity.poisonT = 8; }
          }
          a.stuckTo = hit.entity; a.offset = hit.point.clone().sub(hit.entity.pos);
          if (!hit.entity.alive) a.life = 4;
        } else { G.audio.arrowHit(hit.point); G.fx.impact(hit.point, null, hit.surface); }
      } else {
        a.pos.addScaledVector(a.vel, dt);
        a.mesh.position.copy(a.pos);
        a.mesh.lookAt(_q.copy(a.pos).add(a.vel));
        if (a.pos.y < T.getHeight(a.pos.x, a.pos.z) - 1) a.life = 0;
      }
    }
    // spit
    for (let i = this.spits.length - 1; i >= 0; i--) {
      const s = this.spits[i];
      s.life -= dt;
      s.vel.y -= 9.8 * 0.6 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      G.fx.spitTrail(s.pos);
      const tp = s.target.pos.clone(); tp.y += 1.4;
      if (s.pos.distanceTo(tp) < 0.8) {
        s.target.damage(8, s.src, { type: 'spit', from: s.src.pos });
        if (s.target === G.player) { G.player.blind = 1; G.hud.toast('Blinded by venom!', 'danger'); }
        s.life = 0;
      }
      if (s.life <= 0 || s.pos.y < T.getHeight(s.pos.x, s.pos.z)) { s.mesh.removeFromParent(); s.mesh.geometry.dispose(); this.spits.splice(i, 1); }
    }
  }
}
