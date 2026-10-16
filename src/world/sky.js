// Atmosphere: custom sky dome (sun, moon, stars, volumetric-looking clouds), day/night cycle, lighting and fog.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/math.js';

const skyVert = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */`
uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uSunColor, uGround;
uniform float uTime, uNight, uCloud, uStorm;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5;} return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  float hz = pow(1.0 - clamp(y, 0.0, 1.0), 3.5);
  vec3 col = mix(uZenith, uHorizon, hz);
  if (y < 0.0) col = mix(uHorizon, uGround, smoothstep(0.0, -0.25, y));
  float sd = max(dot(d, uSunDir), 0.0);
  // mie glow + sun disk
  col += uSunColor * (pow(sd, 8.0) * 0.35 + pow(sd, 64.0) * 0.6) * (1.0 - uStorm*0.8);
  col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 18.0 * (1.0 - uStorm);
  // stars
  if (uNight > 0.01 && y > 0.0) {
    vec3 sp = d * 380.0;
    vec3 cell = floor(sp);
    float st = h31(cell);
    float tw = 0.6 + 0.4*sin(uTime*3.0 + st*60.0);
    float star = step(0.9965, st) * tw * smoothstep(0.0, 0.25, y);
    col += vec3(0.9, 0.95, 1.0) * star * uNight * 1.6 * (1.0 - uCloud);
    // milky band
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, -0.7))) * 3.2, 2.0));
    col += vec3(0.12, 0.13, 0.2) * band * fbm(d.xz*9.0) * uNight * (1.0-uCloud);
  }
  // moon
  float md = max(dot(d, uMoonDir), 0.0);
  float moon = smoothstep(0.99955, 0.9997, md);
  col += vec3(0.85, 0.88, 1.0) * moon * 2.5 * uNight;
  col += vec3(0.25, 0.3, 0.45) * pow(md, 40.0) * 0.4 * uNight;
  // clouds (projected layer)
  if (y > 0.0) {
    vec2 cuv = d.xz / (y + 0.12) * 1.4 + vec2(uTime*0.004, uTime*0.0015);
    float n = fbm(cuv);
    float n2 = fbm(cuv*2.3 + 3.1);
    float cover = mix(0.58, 0.28, uCloud);
    float c = smoothstep(cover, cover + 0.28, n * 0.75 + n2 * 0.35);
    c *= smoothstep(0.0, 0.18, y);
    float lit = clamp(dot(normalize(vec3(uSunDir.x, 0.4, uSunDir.z)), normalize(vec3(d.x, 0.6, d.z))) * 0.5 + 0.5, 0.0, 1.0);
    vec3 cBase = mix(uHorizon * 0.9, uSunColor * 0.9 + uZenith * 0.4, lit * (1.0 - n2 * 0.4));
    cBase = mix(cBase, vec3(0.32, 0.34, 0.38) * (0.2 + 0.8*(1.0-uNight)), uStorm);
    cBase += uSunColor * pow(sd, 6.0) * 0.6 * (1.0 - n);
    col = mix(col, cBase, c * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Key colours across the sun's elevation (−1..1 sin of elevation)
const KEYS = [
  { e: -0.35, zen: [0.004, 0.008, 0.02], hor: [0.02, 0.03, 0.055], sun: [0, 0, 0], light: [0.18, 0.24, 0.42], li: 0.18, amb: 0.22, fog: [0.02, 0.03, 0.055] },
  { e: -0.08, zen: [0.02, 0.03, 0.09], hor: [0.18, 0.12, 0.16], sun: [0.4, 0.15, 0.05], light: [0.3, 0.3, 0.5], li: 0.2, amb: 0.3, fog: [0.14, 0.11, 0.15] },
  { e: 0.02, zen: [0.12, 0.17, 0.33], hor: [0.95, 0.48, 0.22], sun: [1.0, 0.45, 0.15], light: [1.0, 0.5, 0.25], li: 1.2, amb: 0.45, fog: [0.72, 0.45, 0.32] },
  { e: 0.15, zen: [0.18, 0.33, 0.62], hor: [0.85, 0.7, 0.55], sun: [1.0, 0.75, 0.45], light: [1.0, 0.8, 0.6], li: 2.4, amb: 0.6, fog: [0.7, 0.66, 0.6] },
  { e: 0.45, zen: [0.17, 0.38, 0.75], hor: [0.62, 0.75, 0.86], sun: [1.0, 0.93, 0.8], light: [1.0, 0.95, 0.86], li: 3.2, amb: 0.75, fog: [0.62, 0.72, 0.8] },
  { e: 1.0, zen: [0.12, 0.33, 0.72], hor: [0.58, 0.72, 0.86], sun: [1.0, 0.97, 0.9], light: [1.0, 0.97, 0.92], li: 3.5, amb: 0.8, fog: [0.6, 0.72, 0.82] },
];

function sampleKeys(e) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (e >= KEYS[i].e && e <= KEYS[i + 1].e) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  if (e < KEYS[0].e) { a = b = KEYS[0]; }
  if (e > KEYS[KEYS.length - 1].e) { a = b = KEYS[KEYS.length - 1]; }
  const t = a === b ? 0 : (e - a.e) / (b.e - a.e);
  const mixA = (k) => a[k].map((v, i) => lerp(v, b[k][i], t));
  return { zen: mixA('zen'), hor: mixA('hor'), sun: mixA('sun'), light: mixA('light'), li: lerp(a.li, b.li, t), amb: lerp(a.amb, b.amb, t), fog: mixA('fog') };
}

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 7.2; // hours
    this.dayLengthMinutes = 28; // real minutes per in-game day
    this.storm = 0;
    this.cloud = 0.25;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() },
      uGround: { value: new THREE.Color(0.06, 0.08, 0.08) },
      uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.3 }, uStorm: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3020, 0.8);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0x9ab0c0, 0.0016);
    this.baseFog = 0.0016;

    // Environment map for PBR reflections, refreshed as the sun moves.
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
    this.envScene.add(this.envDome);
    this.envTimer = 0;
    this.envRT = null;
    this.state = sampleKeys(0.5);
  }

  setShadowQuality(size, extent) {
    const s = this.sun.shadow;
    s.mapSize.set(size, size);
    s.camera.left = -extent; s.camera.right = extent; s.camera.top = extent; s.camera.bottom = -extent;
    s.camera.near = 1; s.camera.far = 900;
    s.camera.updateProjectionMatrix();
    if (s.map) { s.map.dispose(); s.map = null; }
    this.shadowExtent = extent;
  }

  get hours() { return this.time; }
  isNight() { return this.time < 5.6 || this.time > 19.4; }

  update(dt, focus, cameraPos) {
    this.time = (this.time + (dt / 60) * (24 / this.dayLengthMinutes)) % 24;
    const t = this.time;
    const ang = ((t - 6) / 24) * Math.PI * 2; // 0 at sunrise
    const elev = Math.sin(ang);
    this.sunDir.set(Math.cos(ang) * 0.85, elev, 0.42).normalize();
    this.moonDir.set(-this.sunDir.x, -this.sunDir.y * 0.9 + 0.15, -0.3).normalize();
    const e = this.sunDir.y;
    const k = sampleKeys(e);
    this.state = k;
    const storm = this.storm;
    const u = this.uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    const desat = (c, amt) => { const l = (c[0] + c[1] + c[2]) / 3; return c.map((v) => lerp(v, l * 0.75, amt)); };
    u.uZenith.value.setRGB(...desat(k.zen, storm * 0.7));
    u.uHorizon.value.setRGB(...desat(k.hor, storm * 0.6));
    u.uSunColor.value.setRGB(...k.sun);
    const night = smoothstep(0.05, -0.15, e);
    u.uNight.value = night;
    u.uCloud.value = clamp(this.cloud + storm, 0, 1);
    u.uStorm.value = storm;
    u.uTime.value += dt;

    // Sun or moon drives the directional light.
    const useMoon = e < -0.02;
    const ldir = useMoon ? this.moonDir : this.sunDir;
    this.sun.color.setRGB(...k.light);
    this.sun.intensity = (useMoon ? 0.35 : k.li) * (1 - storm * 0.75);
    const center = focus;
    this.sun.position.set(center.x + ldir.x * 400, center.y + Math.max(0.15, ldir.y) * 400, center.z + ldir.z * 400);
    // snap shadow camera to texel grid to avoid shimmering
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.set(Math.round(center.x / texel) * texel, center.y, Math.round(center.z / texel) * texel);
    this.sun.position.x += this.sun.target.position.x - center.x;
    this.sun.position.z += this.sun.target.position.z - center.z;
    this.sun.target.updateMatrixWorld();

    this.hemi.intensity = k.amb * (1 - storm * 0.3);
    this.hemi.color.setRGB(k.zen[0] * 2 + 0.2, k.zen[1] * 2 + 0.2, k.zen[2] * 2 + 0.2);
    this.hemi.groundColor.setRGB(0.22 * k.amb, 0.19 * k.amb, 0.12 * k.amb);

    const fog = desat(k.fog, storm * 0.6);
    this.scene.fog.color.setRGB(...fog);
    this.scene.fog.density = this.baseFog * (1 + storm * 2.2) * (1 + night * 0.4);
    this.dome.position.copy(cameraPos);

    this.envTimer -= dt;
    if (this.envTimer <= 0) { this.envTimer = 4; this.refreshEnv(); }
  }

  refreshEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 500);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.55;
  }
}
