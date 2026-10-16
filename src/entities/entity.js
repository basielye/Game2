// Base entity: position, health, faction, hit volumes.
import * as THREE from 'three';

let nextId = 1;
export const HOSTILE = {
  player: { raider: true, pred: true },
  haven: { raider: true, pred: true },
  raider: { player: true, haven: true, pred: true },
  pred: { player: true, haven: true, raider: true, herb: true, pred: false },
  herb: {},
  tamed: { pred: true, raider: true },
};

export class Entity {
  constructor(game) {
    this.game = game;
    this.id = nextId++;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.faction = 'herb';
    this.radius = 0.5;
    this.height = 1.8;
    this.group = new THREE.Group();
    this.hitSpheres = []; // {obj (Object3D) or null, offset: Vector3, r, mult, name}
    this.tags = new Set();
    this.lastAttacker = null;
    this.deadTime = 0;
  }
  get kind() { return 'entity'; }
  // world-space hit spheres for ray tests
  getHitSpheres(out = []) {
    out.length = 0;
    for (const h of this.hitSpheres) {
      const c = h._c || (h._c = new THREE.Vector3());
      if (h.obj && h.local) c.copy(h.local).applyMatrix4(h.obj.matrixWorld);
      else if (h.obj) { h.obj.getWorldPosition(c); if (h.offset) c.add(h.offset); }
      else c.copy(this.pos).add(h.offset);
      out.push({ c, r: h.r, mult: h.mult, name: h.name });
    }
    return out;
  }
  damage(amount, source, info = {}) {
    if (!this.alive) return 0;
    this.hp -= amount;
    this.lastAttacker = source;
    this.onDamage?.(amount, source, info);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.onDeath?.(source, info); this.game.events.emit('death', { entity: this, source, info }); }
    return amount;
  }
  isHostileTo(other) {
    if (!other || other === this) return false;
    const t = HOSTILE[this.faction];
    return !!(t && t[other.faction]);
  }
  dispose() { this.group.removeFromParent(); }
}
