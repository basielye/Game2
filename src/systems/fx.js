// Visual effects: GPU point particles (smoke, dust, blood, sparks, splash), tracers, muzzle flashes, rain.
import * as THREE from 'three';
import { getTex } from '../core/textures.js';
import { rand } from '../core/math.js';

const pVert = /* glsl */`
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const pFrag = /* glsl */`
uniform sampler2D uTex;
varying vec4 vColor;
void main(){
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`;

class ParticleSystem {
  constructor(max, blending, tex) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.color = new Float32Array(max * 4);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uTex: { value: tex }, uScale: { value: 600 } };
    this.mat = new THREE.ShaderMaterial({ vertexShader: pVert, fragmentShader: pFrag, uniforms: this.uniforms, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
  }
  emit(o) { if (this.p.length < this.max) this.p.push(o); }
  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= (q.g ?? 0) * dt;
      const drag = Math.exp(-(q.drag ?? 0) * dt);
      q.vx *= drag; q.vy *= drag; q.vz *= drag;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor != null && q.y < q.floor) { q.y = q.floor; q.vy = 0; q.vx *= 0.5; q.vz *= 0.5; }
      P[w++] = q;
    }
    P.length = w;
    for (let i = 0; i < w; i++) {
      const q = P[i], k = q.age / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * k;
      this.color[i * 4] = q.r; this.color[i * 4 + 1] = q.gc; this.color[i * 4 + 2] = q.b;
      const fadeIn = Math.min(1, q.age / (q.fadeIn || 0.001));
      this.color[i * 4 + 3] = q.a * (1 - k) * fadeIn;
    }
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.soft = new ParticleSystem(2500, THREE.NormalBlending, getTex('smoke'));
    this.add = new ParticleSystem(1500, THREE.AdditiveBlending, getTex('glow'));
    scene.add(this.soft.points, this.add.points);
    // tracers
    this.tracers = [];
    const tg = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 0.5);
    this.tracerGeo = tg;
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(tg, this.tracerMat.clone()); m.visible = false; m.frustumCulled = false; scene.add(m); this.tracers.push({ m, t: 0 }); }
    // muzzle flash
    this.flashLight = new THREE.PointLight(0xffb060, 0, 14, 2);
    scene.add(this.flashLight);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flashSprite.visible = false;
    scene.add(this.flashSprite);
    this.flashT = 0;
    // rain
    this.rain = this._makeRain();
    scene.add(this.rain);
    this.rainAmt = 0;
    // ambient motes (fireflies at night / pollen at day)
    this.moteT = 0;
  }
  setScale(h) { this.soft.uniforms.uScale.value = this.add.uniforms.uScale.value = h * 0.9; }

  _makeRain() {
    const n = 5000;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = rand(-40, 40), y = rand(0, 40), z = rand(-40, 40);
      pos.set([x, y, z, x + 0.05, y - 0.7, z + 0.05], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.rainU = { value: 0 };
      sh.uniforms.uC = this.rainC = { value: new THREE.Vector3() };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform vec3 uC;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.y = mod(transformed.y - uT * 22.0 - uC.y, 40.0) + uC.y - 12.0;
          transformed.x = mod(transformed.x - uC.x + 40.0, 80.0) + uC.x - 40.0;
          transformed.z = mod(transformed.z - uC.z + 40.0, 80.0) + uC.z - 40.0;`);
    };
    const l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    l.visible = false;
    return l;
  }

  burst(pos, n, opts) {
    const sys = opts.additive ? this.add : this.soft;
    for (let i = 0; i < n; i++) {
      const sp = opts.speed ?? 2;
      sys.emit({
        x: pos.x + rand(-1, 1) * (opts.spread ?? 0.1), y: pos.y + rand(-1, 1) * (opts.spread ?? 0.1), z: pos.z + rand(-1, 1) * (opts.spread ?? 0.1),
        vx: rand(-1, 1) * sp + (opts.dir?.x ?? 0), vy: rand(-0.2, 1) * sp * (opts.up ?? 1) + (opts.dir?.y ?? 0), vz: rand(-1, 1) * sp + (opts.dir?.z ?? 0),
        age: 0, life: rand(0.7, 1.3) * (opts.life ?? 1), s0: opts.s0 ?? 20, s1: opts.s1 ?? 60,
        r: opts.r ?? 1, gc: opts.g ?? 1, b: opts.b ?? 1, a: opts.a ?? 0.6, g: opts.grav ?? 0, drag: opts.drag ?? 1.5, floor: opts.floor, fadeIn: opts.fadeIn,
      });
    }
  }
  blood(pos, n = 12) { this.burst(pos, n, { speed: 2.4, s0: 10, s1: 26, r: 0.45, g: 0.03, b: 0.02, a: 0.95, grav: 9, life: 0.7, drag: 1, floor: this.game.terrain.getHeight(pos.x, pos.z) + 0.05 }); }
  dust(pos, size = 1) { this.burst(pos, Math.ceil(6 * size), { speed: 1.5 * size, s0: 60 * size, s1: 220 * size, r: 0.62, g: 0.55, b: 0.45, a: 0.35, life: 1.8, up: 0.4, spread: size * 0.8 }); }
  impact(pos, normal, surface = 'dirt') {
    const c = surface === 'wood' ? [0.5, 0.36, 0.2] : surface === 'stone' ? [0.6, 0.6, 0.6] : [0.5, 0.42, 0.3];
    this.burst(pos, 8, { speed: 2.5, s0: 14, s1: 60, r: c[0], g: c[1], b: c[2], a: 0.6, life: 0.8, dir: normal ? normal.clone().multiplyScalar(2) : null, grav: 3 });
    this.burst(pos, 4, { additive: true, speed: 5, s0: 6, s1: 2, r: 1, g: 0.75, b: 0.4, a: 1, life: 0.25, grav: 10 });
  }
  splash(pos, k = 1) { this.burst({ x: pos.x, y: 0.05, z: pos.z }, Math.ceil(10 * k), { speed: 2.2 * k, s0: 20, s1: 70 * k, r: 0.85, g: 0.92, b: 0.95, a: 0.6, grav: 9, life: 0.7, up: 2 }); }
  smoke(pos, color = 0x888888, k = 1) { const c = new THREE.Color(color); this.burst(pos, 3, { speed: 0.4, s0: 40 * k, s1: 160 * k, r: c.r, g: c.g, b: c.b, a: 0.35, life: 2.5, up: 1.5, drag: 0.5, fadeIn: 0.3 }); }
  sparks(pos, n = 6) { this.burst(pos, n, { additive: true, speed: 3, s0: 8, s1: 1, r: 1, g: 0.6, b: 0.25, a: 1, life: 0.6, grav: 6, up: 2 }); }
  spitTrail(pos) { this.burst(pos, 2, { speed: 0.3, s0: 18, s1: 6, r: 0.6, g: 0.9, b: 0.2, a: 0.8, life: 0.4 }); }

  tracer(from, to) {
    const t = this.tracers.find((q) => q.t <= 0) || this.tracers[0];
    t.m.position.copy(from);
    t.m.lookAt(to);
    t.m.scale.set(1, 1, from.distanceTo(to));
    t.m.visible = true;
    t.t = 0.08;
    t.m.material.opacity = 0.9;
  }
  muzzle(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 40;
    this.flashSprite.position.copy(pos);
    this.flashSprite.scale.setScalar(rand(0.5, 0.8));
    this.flashSprite.material.rotation = rand(0, 6);
    this.flashSprite.visible = true;
    this.flashT = 0.05;
    this.smoke(pos, 0xbbbbbb, 0.5);
  }

  update(dt, camPos, rainAmt, night) {
    this.soft.update(dt); this.add.update(dt);
    for (const t of this.tracers) if (t.t > 0) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.08); if (t.t <= 0) t.m.visible = false; }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.flashLight.intensity = 0; this.flashSprite.visible = false; } }
    // rain
    this.rain.visible = rainAmt > 0.05;
    if (this.rainU) { this.rainU.value += dt; this.rainC.value.copy(camPos); }
    this.rain.material.opacity = 0.35 * rainAmt;
    // ambient motes: fireflies at night, drifting pollen by day
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = 0.05;
      const x = camPos.x + rand(-25, 25), z = camPos.z + rand(-25, 25);
      const y = this.game.terrain.getHeight(x, z) + rand(0.4, 2.5);
      if (y > 1.5) {
        if (night > 0.5) this.add.emit({ x, y, z, vx: rand(-0.3, 0.3), vy: rand(-0.1, 0.2), vz: rand(-0.3, 0.3), age: 0, life: rand(2, 4), s0: 5, s1: 5, r: 0.8, gc: 1, b: 0.3, a: 1, drag: 0, fadeIn: 0.8 });
        else if (Math.random() < 0.4 && rainAmt < 0.2) this.soft.emit({ x, y, z, vx: rand(-0.4, 0.4), vy: rand(-0.05, 0.1), vz: rand(-0.4, 0.4), age: 0, life: rand(3, 5), s0: 3, s1: 3, r: 1, gc: 1, b: 0.9, a: 0.6, drag: 0, fadeIn: 1 });
      }
    }
  }
}
