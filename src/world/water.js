// Ocean + lake surface: Gerstner waves, depth-tinted absorption, shoreline foam, fresnel sky reflection and sun glint.
import * as THREE from 'three';
import { WORLD_SIZE } from '../data/world.js';
import { fogUniforms, AERIAL_PARS_F } from '../core/matpatch.js';
import { SKY_LUT_GLSL } from './sky.js';

const vert = /* glsl */`
uniform float uTime;
varying vec3 vWPos;
varying vec3 vNormalW;
varying float vFoamCrest;
#ifdef USE_FOG
varying float vFogDepth;
varying vec3 vFogWorld;
#endif
vec3 gerstner(vec2 p, vec2 dir, float steep, float wl, float t, inout vec3 tan, inout vec3 bin){
  float k = 6.28318 / wl; float c = sqrt(9.8 / k); vec2 d = normalize(dir);
  float f = k * (dot(d, p) - c * t); float a = steep / k;
  tan += vec3(-d.x*d.x*(steep*sin(f)), d.x*(steep*cos(f)), -d.x*d.y*(steep*sin(f)));
  bin += vec3(-d.x*d.y*(steep*sin(f)), d.y*(steep*cos(f)), -d.y*d.y*(steep*sin(f)));
  return vec3(d.x*(a*cos(f)), a*sin(f), d.y*(a*cos(f)));
}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = wp.xz;
  vec3 tan = vec3(1,0,0), bin = vec3(0,0,1);
  vec3 off = vec3(0);
  off += gerstner(p, vec2(1.0, 0.6), 0.16, 38.0, uTime, tan, bin);
  off += gerstner(p, vec2(-0.4, 1.0), 0.12, 21.0, uTime, tan, bin);
  off += gerstner(p, vec2(0.7, -0.9), 0.10, 11.0, uTime, tan, bin);
  off += gerstner(p, vec2(-1.0, -0.2), 0.08, 6.0, uTime, tan, bin);
  // dampen waves far from camera to avoid aliasing
  float fade = 1.0 - smoothstep(250.0, 700.0, distance(wp.xz, cameraPosition.xz));
  // inland lakes stay calm; open ocean gets full swell
  fade *= 0.12 + 0.88 * smoothstep(520.0, 760.0, length(wp.xz));
  wp.xyz += off * fade;
  vFoamCrest = clamp(off.y * 1.6, 0.0, 1.0) * fade;
  vNormalW = normalize(mix(vec3(0,1,0), normalize(cross(bin, tan)), fade));
  vWPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #ifdef USE_FOG
  vFogDepth = -mvPosition.z; vFogWorld = wp.xyz;
  #endif
}`;

const frag = /* glsl */`
uniform float uTime, uHalf, uNight;
uniform sampler2D uHeight, uNormals, uLUT;
uniform vec3 uSunDir, uSunColor;
uniform float uSunI;
varying vec3 vWPos;
varying vec3 vNormalW;
varying float vFoamCrest;
${AERIAL_PARS_F.replace('${SKY_LUT_GLSL}', '')}
#ifndef USE_FOG
${SKY_LUT_GLSL}
#endif
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
vec3 wn(vec2 uv){ return texture2D(uNormals, uv).rbg * 2.0 - 1.0; }
void main(){
  vec2 huv = (vWPos.xz + uHalf) / (uHalf * 2.0);
  float ground = texture2D(uHeight, huv).r;
  if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) ground = -30.0;
  float depth = max(0.0, vWPos.y - ground);
  vec3 V = normalize(cameraPosition - vWPos);
  float dist = distance(cameraPosition, vWPos);

  // photographic ripple normals at three scales, fading with distance to avoid shimmer
  vec2 q = vWPos.xz;
  vec3 d1 = wn(q / 23.0 + uTime * vec2(0.012, 0.008));
  vec3 d2 = wn(q / 9.0 - uTime * vec2(0.018, -0.022));
  vec3 d3 = wn(q / 3.1 + uTime * vec2(-0.03, 0.035));
  float df = 1.0 - smoothstep(60.0, 420.0, dist);
  vec3 dn = d1 * 0.9 + d2 * 0.7 * df + d3 * 0.45 * df * df;
  float calm = 0.55 + 0.45 * smoothstep(520.0, 760.0, length(vWPos.xz));
  vec3 N = normalize(vNormalW + vec3(dn.x, 0.0, dn.z) * 0.32 * calm);

  float NoV = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = skyLUT(uLUT, normalize(R + vec3(0.0, 0.02, 0.0)));
  vec3 skyUp = skyLUT(uLUT, vec3(0.0, 1.0, 0.0));
  // inland water is ringed by forest and hills: low reflection angles see the treeline, not sky
  float inland = 1.0 - smoothstep(520.0, 760.0, length(vWPos.xz));
  vec3 treeline = skyUp * vec3(0.10, 0.13, 0.08) + uSunColor * max(uSunDir.y, 0.0) * vec3(0.03, 0.045, 0.02);
  sky = mix(sky, treeline, inland * (1.0 - smoothstep(0.02, 0.28, R.y)) * 0.92);

  // water body: Beer-Lambert absorption over depth; light from the sky dome and sun
  float light = clamp(uSunDir.y * 1.5 + 0.15, 0.03, 1.0);
  vec3 irr = skyUp * 0.6 + uSunColor * light * 0.35;
  vec3 absorb = exp(-depth * vec3(0.38, 0.11, 0.075));
  vec3 shallow = vec3(0.10, 0.42, 0.40), deep = vec3(0.006, 0.05, 0.075);
  vec3 body = mix(deep, shallow, absorb.g) * irr;
  // sun-lit sub-surface scatter through wave crests
  float sss = pow(max(dot(V, -uSunDir) * 0.5 + 0.5, 0.0), 4.0) * (vFoamCrest + 0.15);
  body += vec3(0.04, 0.32, 0.26) * sss * uSunColor * (1.0 - uNight) * 0.5;

  vec3 col = mix(body, sky, fres);
  // sun glint: sharp specular plus a broader sheen
  vec3 H = normalize(uSunDir + V);
  float NoH = max(dot(N, H), 0.0);
  float spec = pow(NoH, 900.0) * 18.0 + pow(NoH, 90.0) * 0.6;
  col += uSunColor * spec * uSunI * fres * 4.0 * step(0.0, uSunDir.y);

  // shoreline foam with lapping bands
  float shore = 1.0 - smoothstep(0.0, 1.4, depth);
  float foamN = vnoise(q * 1.7 + vec2(uTime * 0.6, 0.0)) * vnoise(q * 0.6 - uTime * 0.2) + d3.x * 0.2;
  float band = smoothstep(0.35, 0.8, sin(depth * 4.0 - uTime * 2.2) * 0.5 + 0.5);
  float foam = clamp(shore * (0.4 + band * 0.8) * smoothstep(0.18, 0.55, foamN + shore * 0.35), 0.0, 1.0);
  foam += smoothstep(0.7, 0.95, vFoamCrest) * smoothstep(0.45, 0.7, foamN) * 0.5;
  col = mix(col, irr * 1.4, clamp(foam, 0.0, 1.0));

  float alpha = clamp(1.0 - absorb.g * 0.85 + fres * 0.4 + foam, 0.0, 1.0);
  alpha = max(alpha * smoothstep(0.0, 0.25, depth), 0.04);
  gl_FragColor = vec4(col, alpha);
  #ifdef USE_FOG
  gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, vFogWorld);
  #endif
}`;

export class Water {
  constructor(terrain, atmosphere) {
    this.atmo = atmosphere;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uHalf: { value: WORLD_SIZE / 2 }, uNight: { value: 0 },
      uHeight: { value: terrain.makeHeightTexture() },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
      uSunI: { value: 1 }, uLUT: { value: null }, uNormals: { value: null },
    }]);
    Object.assign(this.uniforms, fogUniforms);
    const nt = new THREE.TextureLoader().load('textures/waternormals.webp');
    nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.anisotropy = 8;
    this.uniforms.uNormals.value = nt;
    this.uniforms.uHeight.value = terrain.makeHeightTexture();
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms, transparent: true, fog: true, depthWrite: true });
    // Dense near, sparse far: a radial-ish grid that follows the camera.
    const geo = new THREE.PlaneGeometry(1800, 1800, 220, 220).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    const far = new THREE.Mesh(new THREE.RingGeometry(890, 9000, 96, 1).rotateX(-Math.PI / 2), mat);
    far.frustumCulled = false;
    this.far = far;
    this.group = new THREE.Group();
    this.group.add(this.mesh, far);
  }
  update(dt, camPos) {
    const u = this.uniforms;
    u.uTime.value += dt;
    const snap = 1800 / 220;
    this.mesh.position.set(Math.round(camPos.x / snap) * snap, 0, Math.round(camPos.z / snap) * snap);
    this.far.position.x = camPos.x; this.far.position.z = camPos.z;
    const a = this.atmo.uniforms;
    u.uSunDir.value.copy(a.uSunDir.value.y > -0.02 ? a.uSunDir.value : a.uMoonDir.value);
    u.uSunColor.value.copy(a.uSunDir.value.y > -0.02 ? a.uSunColor.value : new THREE.Color(0.5, 0.55, 0.7));
    u.uLUT.value = this.atmo.lutRT.texture;
    u.uNight.value = a.uNight.value;
    u.uSunI.value = 1 - this.atmo.storm * 0.9;
  }
  // Approximate surface height for buoyancy/swimming.
  heightAt(x, z) { return 0; }
}
