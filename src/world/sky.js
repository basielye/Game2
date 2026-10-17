// Physically based atmosphere.
//  - Rayleigh + Mie single scattering (Nishita) evaluated on the GPU into a small equirectangular LUT,
//    re-rendered only as the sun moves. The sky dome, aerial-perspective fog and water reflections all sample it.
//  - 2.5D volumetric-style clouds with self-shadowing, powder and silver lining.
//  - Sun colour/intensity from real atmospheric transmittance; image-based ambient from a PMREM of the sky.
//  - Cascaded shadow maps for crisp near shadows and shadowed forests to the horizon.
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

const SCATTER = /* glsl */`
const float PI = 3.14159265;
const float Rg = 6360e3, Rt = 6420e3;
const vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const float betaM = 21e-6;
const float Hr = 7994.0, Hm = 1200.0;
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd), c = dot(ro, ro) - r * r, d = b * b - c;
  if (d < 0.0) return vec2(1e9, -1e9);
  d = sqrt(d); return vec2(-b - d, -b + d);
}
// Single scattering towards direction rd for a light from direction ld (intensity I).
vec3 scatter(vec3 rd, vec3 ld, float I, float haze) {
  vec3 ro = vec3(0.0, Rg + 2.0, 0.0);
  vec2 t = raySphere(ro, rd, Rt);
  float tmax = t.y;
  vec2 tg = raySphere(ro, rd, Rg);
  if (tg.x > 0.0) tmax = min(tmax, tg.x);
  const int N = 16, M = 6;
  float seg = tmax / float(N);
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  float mu = dot(rd, ld);
  float phR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float g = 0.76;
  float phM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  float bM = betaM * haze;
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (seg * (float(i) + 0.5));
    float h = length(p) - Rg;
    float hr = exp(-h / Hr) * seg, hm = exp(-h / Hm) * seg;
    odR += hr; odM += hm;
    vec2 tl = raySphere(p, ld, Rt);
    float segL = tl.y / float(M);
    float odLR = 0.0, odLM = 0.0;
    bool lit = true;
    for (int j = 0; j < M; j++) {
      vec3 q = p + ld * (segL * (float(j) + 0.5));
      float hl = length(q) - Rg;
      if (hl < 0.0) { lit = false; break; }
      odLR += exp(-hl / Hr) * segL; odLM += exp(-hl / Hm) * segL;
    }
    if (lit) {
      vec3 tau = betaR * (odR + odLR) + bM * 1.1 * (odM + odLM);
      vec3 att = exp(-tau);
      sumR += att * hr; sumM += att * hm;
    }
  }
  return I * (sumR * betaR * phR + sumM * bM * phM);
}
`;

const lutFrag = /* glsl */`
uniform vec3 uSun, uMoon; uniform float uHaze, uMoonI;
varying vec2 vUv;
${SCATTER}
void main() {
  float az = (vUv.x - 0.5) * 2.0 * PI;
  // non-linear elevation: more resolution at the horizon
  float v = vUv.y * 2.0 - 1.0;
  float el = sign(v) * v * v * (PI * 0.5);
  vec3 rd = vec3(cos(el) * sin(az), sin(el), cos(el) * cos(az));
  rd.y = max(rd.y, -0.02);
  vec3 c = scatter(normalize(rd), uSun, 22.0, uHaze);
  if (uMoonI > 0.0) c += scatter(normalize(rd), uMoon, 22.0 * uMoonI, uHaze) * vec3(0.8, 0.9, 1.15);
  gl_FragColor = vec4(c, 1.0);
}`;

const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

export const SKY_LUT_GLSL = /* glsl */`
vec3 skyLUT(sampler2D lut, vec3 d) {
  float az = atan(d.x, d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = sign(el) * sqrt(abs(el) / 1.5707963);
  return texture2D(lut, vec2(az / 6.2831853 + 0.5, v * 0.5 + 0.5)).rgb;
}`;

const skyFrag = /* glsl */`
uniform sampler2D uLUT;
uniform vec3 uSunDir, uMoonDir, uSunColor;
uniform float uTime, uNight, uCloud, uStorm, uExposure;
varying vec3 vDir;
${SKY_LUT_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=a*vnoise(p); p=p*2.02+vec2(1.7,9.2); a*=0.5;} return s; }
float cloudDensity(vec2 p, float cover) {
  float base = fbm(p * 0.9);
  float detail = fbm(p * 3.1 + 7.3);
  float d = base * 0.78 + detail * 0.32;
  return smoothstep(cover, cover + 0.32, d);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyLUT(uLUT, d);
  // ground below horizon fades to a dark haze
  if (d.y < 0.0) col = mix(col, col * 0.35, smoothstep(0.0, -0.2, d.y));
  float sd = dot(d, uSunDir);
  // sun disk with limb darkening, dimmed by atmosphere (sun colour carries transmittance)
  float disk = smoothstep(0.99985, 0.99993, sd);
  float limb = sqrt(max(0.0, 1.0 - pow((1.0 - sd) / 0.00015, 2.0)));
  col += uSunColor * disk * (0.4 + 0.6 * limb) * 60.0 * (1.0 - uStorm);
  // stars & moon
  if (uNight > 0.01 && d.y > 0.0) {
    vec3 cell = floor(d * 420.0);
    float st = h31(cell);
    float tw = 0.65 + 0.35 * sin(uTime * 2.7 + st * 80.0);
    float star = smoothstep(0.9968, 1.0, st) * tw * smoothstep(0.0, 0.2, d.y);
    vec3 sc = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), fract(st * 131.0));
    col += sc * star * uNight * 2.2 * (1.0 - uCloud);
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, -0.7))) * 3.0, 2.0));
    col += vec3(0.05, 0.055, 0.08) * band * fbm(d.xz * 14.0) * uNight * (1.0 - uCloud);
  }
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99955, 0.99968, md);
  float crater = 0.8 + 0.2 * fbm((d.xy - uMoonDir.xy) * 900.0);
  col += vec3(0.75, 0.78, 0.85) * moon * crater * 1.6 * uNight;
  col += vec3(0.04, 0.05, 0.07) * pow(max(md, 0.0), 60.0) * uNight;
  // clouds: projected onto a curved layer, self-shadowed towards the sun
  if (d.y > 0.005) {
    float t = 1.0 / (d.y + 0.08);
    vec2 uv = d.xz * t * 1.25 + vec2(uTime * 0.0035, uTime * 0.0012);
    float cover = mix(0.56, 0.18, clamp(uCloud + uStorm * 0.6, 0.0, 1.0));
    float dens = cloudDensity(uv, cover);
    if (dens > 0.001) {
      vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.06;
      float shade = 0.0;
      for (int i = 1; i <= 3; i++) shade += cloudDensity(uv + toSun * float(i), cover);
      float light = exp(-shade * 1.1);
      float powder = 1.0 - exp(-dens * 4.0);
      float silver = pow(max(sd, 0.0), 12.0) * (1.0 - dens) * 3.0;
      vec3 sunLit = uSunColor * (light * powder * 1.6 + silver);
      vec3 ambient = skyLUT(uLUT, vec3(0.0, 1.0, 0.0)) * 0.9 + skyLUT(uLUT, normalize(vec3(d.x, 0.05, d.z))) * 0.4;
      vec3 cc = ambient * (0.55 + 0.45 * (1.0 - dens)) + sunLit;
      cc = mix(cc, cc * vec3(0.32, 0.34, 0.38), uStorm * 0.85);
      cc += vec3(0.012, 0.014, 0.02) * uNight;
      float fade = smoothstep(0.005, 0.12, d.y);
      col = mix(col, cc, dens * fade * 0.96);
    }
  }
  col *= uExposure;
  gl_FragColor = vec4(col, 1.0);
}`;

// Sun transmittance through the atmosphere (JS mirror of the shader integral).
function sunTransmittance(sunDir) {
  const Rg = 6360e3, Rt = 6420e3;
  const bR = [5.8e-6, 13.5e-6, 33.1e-6], bM = 21e-6 * 1.1;
  const ro = [0, Rg + 2, 0];
  const rd = [sunDir.x, Math.max(sunDir.y, -0.08), sunDir.z];
  const l = Math.hypot(rd[0], rd[1], rd[2]); rd[0] /= l; rd[1] /= l; rd[2] /= l;
  const b = ro[1] * rd[1], c = ro[1] * ro[1] - Rt * Rt;
  const tmax = -b + Math.sqrt(Math.max(0, b * b - c));
  const N = 24, seg = tmax / N;
  let odR = 0, odM = 0;
  for (let i = 0; i < N; i++) {
    const t = seg * (i + 0.5);
    const p = [rd[0] * t, ro[1] + rd[1] * t, rd[2] * t];
    const h = Math.hypot(p[0], p[1], p[2]) - Rg;
    if (h < 0) return [0, 0, 0];
    odR += Math.exp(-h / 7994) * seg; odM += Math.exp(-h / 1200) * seg;
  }
  return bR.map((r) => Math.exp(-(r * odR + bM * odM)));
}

export class Atmosphere {
  constructor(scene, renderer, camera) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.time = 7.2;
    this.dayLengthMinutes = 28;
    this.storm = 0;
    this.cloud = 0.3;
    this.haze = 0.9;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.shadowExtent = 80;

    // --- sky LUT (256x128 HDR) ---
    this.lutRT = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
    this.lutRT.texture.wrapS = THREE.RepeatWrapping;
    this.lutMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: lutFrag,
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) }, uHaze: { value: this.haze }, uMoonI: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    this.lutScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat);
    quad.frustumCulled = false;
    this.lutScene.add(quad);
    this.lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.lastLutSun = new THREE.Vector3(9, 9, 9);

    this.uniforms = {
      uLUT: { value: this.lutRT.texture },
      uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() },
      // legacy names still used by water & grading
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.3 }, uStorm: { value: 0 }, uExposure: { value: 1 },
    };
    const skyMat = new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // Directional key light (single-map path) — replaced by CSM on higher qualities.
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun, this.sun.target);
    this.csm = null;

    // small fill so deep shade is never pure black (IBL does most of the ambient work)
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3020, 0.15);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0x9ab0c0, 0.0012);
    this.baseFog = 0.0012;

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
    this.envScene.add(this.envDome);
    this.envTimer = 0;
    this.envRT = null;
    this.sunColor = new THREE.Color();
    this.state = { amb: 1 };
  }

  // Cascaded shadows (null to use the single map)
  enableCSM(cascades, mapSize, maxFar) {
    if (this.csm) { this.csm.remove(); this.csm.dispose(); this.csm = null; }
    if (!cascades) { this.sun.visible = true; this.sun.castShadow = true; return; }
    this.sun.visible = false; this.sun.castShadow = false;
    this.csm = new CSM({ maxFar, cascades, mode: 'practical', parent: this.scene, shadowMapSize: mapSize, lightDirection: new THREE.Vector3(-1, -1, -1).normalize(), camera: this.camera, lightIntensity: 3, lightMargin: 220, shadowBias: -0.0002 });
    this.csm.fade = true;
    for (const l of this.csm.lights) { l.shadow.normalBias = 0.35; }
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

  renderLUT(force = false) {
    const ld = this.sunDir.y > -0.12 ? this.sunDir : this.sunDir;
    if (!force && this.lastLutSun.distanceToSquared(ld) < 1e-5 && Math.abs(this._lutStorm - this.storm) < 0.02) return;
    this.lastLutSun.copy(ld);
    this._lutStorm = this.storm;
    const u = this.lutMat.uniforms;
    u.uSun.value.copy(this.sunDir);
    u.uMoon.value.copy(this.moonDir);
    u.uMoonI.value = smoothstep(0.02, -0.12, this.sunDir.y) * 0.004;
    u.uHaze.value = this.haze * (1 + this.storm * 2.5);
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.lutRT);
    r.render(this.lutScene, this.lutCam);
    r.setRenderTarget(prev);
  }

  update(dt, focus, cameraPos) {
    this.time = (this.time + (dt / 60) * (24 / this.dayLengthMinutes)) % 24;
    const t = this.time;
    const ang = ((t - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang) * 0.82, Math.sin(ang), 0.45).normalize();
    this.moonDir.set(-this.sunDir.x, -this.sunDir.y * 0.9 + 0.2, -0.35).normalize();
    const e = this.sunDir.y;
    const storm = this.storm;
    const night = smoothstep(0.03, -0.14, e);
    const u = this.uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    u.uNight.value = night;
    u.uCloud.value = clamp(this.cloud + storm, 0, 1);
    u.uStorm.value = storm;
    u.uTime.value += dt;

    // transmittance-coloured sunlight
    const tr = sunTransmittance(this.sunDir);
    this.sunColor.setRGB(tr[0], tr[1], tr[2]);
    const lum = Math.max(1e-4, this.sunColor.r * 0.3 + this.sunColor.g * 0.59 + this.sunColor.b * 0.11);
    const sunCol = this.sunColor.clone().multiplyScalar(1 / Math.max(lum, 0.25));
    u.uSunColor.value.copy(this.sunColor).multiplyScalar(1.8);
    this.renderLUT();

    // approximate zenith/horizon colours for legacy consumers (water, fog colour)
    const z = new THREE.Color(), hcol = new THREE.Color();
    this._approxSky(new THREE.Vector3(0, 1, 0), z);
    this._approxSky(new THREE.Vector3(this.sunDir.x, 0.02, this.sunDir.z).normalize(), hcol);
    u.uZenith.value.copy(z);
    u.uHorizon.value.copy(hcol);

    const useMoon = e < -0.04;
    const ldir = useMoon ? this.moonDir : this.sunDir;
    const dayI = 4.2 * smoothstep(-0.04, 0.12, e) * Math.min(1, lum * 1.4 + 0.2);
    const intensity = (useMoon ? 0.22 : dayI) * (1 - storm * 0.8);
    const color = useMoon ? new THREE.Color(0.55, 0.65, 0.95) : sunCol;
    if (this.csm) {
      this.csm.lightDirection.copy(ldir).negate();
      for (const l of this.csm.lights) { l.color.copy(color); l.intensity = intensity; }
      this.csm.update();
    } else {
      this.sun.color.copy(color);
      this.sun.intensity = intensity;
      this.sun.position.set(focus.x + ldir.x * 400, focus.y + Math.max(0.15, ldir.y) * 400, focus.z + ldir.z * 400);
      const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
      this.sun.target.position.set(Math.round(focus.x / texel) * texel, focus.y, Math.round(focus.z / texel) * texel);
      this.sun.position.x += this.sun.target.position.x - focus.x;
      this.sun.position.z += this.sun.target.position.z - focus.z;
      this.sun.target.updateMatrixWorld();
    }
    this.hemi.intensity = 0.12 + night * 0.25;
    this.hemi.color.setRGB(0.6 + night * 0.1, 0.7 + night * 0.15, 0.9 + night * 0.3);
    this.hemi.groundColor.setRGB(0.25, 0.22, 0.16);
    this.state.amb = 1;

    // fog colour = horizon sky (aerial perspective shader samples the LUT directly)
    this.scene.fog.color.copy(hcol);
    this.scene.fog.density = this.baseFog * (1 + storm * 2.5) * (1 + night * 0.3);
    this.dome.position.copy(cameraPos);

    this.envTimer -= dt;
    if (this.envTimer <= 0) { this.envTimer = 3; this.refreshEnv(); }
  }

  // cheap CPU estimate of sky colour in a direction (for legacy uniforms only)
  _approxSky(dir, out) {
    const e = this.sunDir.y;
    const day = smoothstep(-0.1, 0.25, e);
    const sunset = smoothstep(0.35, 0.02, Math.abs(e)) * (1 - smoothstep(-0.05, -0.15, e));
    if (dir.y > 0.5) out.setRGB(0.12 + day * 0.1, 0.24 + day * 0.18, 0.55 * day + 0.03);
    else out.setRGB(0.55 * day + sunset * 0.6 + 0.02, 0.62 * day + sunset * 0.3 + 0.03, 0.72 * day + 0.05);
    out.multiplyScalar(1 - this.storm * 0.4);
    return out;
  }

  refreshEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 500);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.8;
  }
}
