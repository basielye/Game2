// Ocean + lake surface: Gerstner waves, depth-tinted absorption, shoreline foam, fresnel sky reflection and sun glint.
import * as THREE from 'three';
import { WORLD_SIZE } from '../data/world.js';

const vert = /* glsl */`
uniform float uTime;
varying vec3 vWPos;
varying vec3 vNormalW;
varying float vFoamCrest;
#include <fog_pars_vertex>
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
  wp.xyz += off * fade;
  vFoamCrest = clamp(off.y * 1.6, 0.0, 1.0) * fade;
  vNormalW = normalize(mix(vec3(0,1,0), normalize(cross(bin, tan)), fade));
  vWPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform float uTime, uHalf, uNight;
uniform sampler2D uHeight;
uniform vec3 uSunDir, uSunColor, uZenith, uHorizon;
uniform float uSunI;
varying vec3 vWPos;
varying vec3 vNormalW;
varying float vFoamCrest;
#include <fog_pars_fragment>
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 huv = (vWPos.xz + uHalf) / (uHalf * 2.0);
  float ground = texture2D(uHeight, huv).r;
  if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) ground = -30.0;
  float depth = max(0.0, vWPos.y - ground);

  // detail normals (two scrolling noise layers)
  vec2 q = vWPos.xz;
  float e = 0.15;
  float n1 = vnoise(q*0.9 + uTime*vec2(0.3,0.2)) + vnoise(q*2.3 - uTime*vec2(0.25,0.4))*0.5;
  float nx = vnoise((q+vec2(e,0))*0.9 + uTime*vec2(0.3,0.2)) + vnoise((q+vec2(e,0))*2.3 - uTime*vec2(0.25,0.4))*0.5;
  float nz = vnoise((q+vec2(0,e))*0.9 + uTime*vec2(0.3,0.2)) + vnoise((q+vec2(0,e))*2.3 - uTime*vec2(0.25,0.4))*0.5;
  vec3 N = normalize(vNormalW + vec3(n1 - nx, 0.0, n1 - nz) * 1.2);

  vec3 V = normalize(cameraPosition - vWPos);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.5));

  vec3 shallow = vec3(0.10, 0.55, 0.52);
  vec3 deep = vec3(0.01, 0.10, 0.17);
  float dl = 1.0 - exp(-depth * 0.18);
  vec3 body = mix(shallow, deep, dl) * (0.25 + 0.75 * clamp(uSunDir.y*2.0+0.3, 0.05, 1.0));
  // subsurface on wave crests facing the sun
  body += vec3(0.05, 0.25, 0.22) * vFoamCrest * max(0.0, dot(V, -uSunDir) * 0.5 + 0.5) * (1.0 - uNight);

  vec3 col = mix(body, sky, fres);
  // sun glint
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 600.0) * 6.0 + pow(max(dot(N, H), 0.0), 60.0) * 0.25;
  col += uSunColor * spec * uSunI;

  // shoreline foam
  float shore = 1.0 - smoothstep(0.0, 1.6, depth);
  float foamN = vnoise(q*1.7 + vec2(uTime*0.6, 0.0)) * vnoise(q*0.6 - uTime*0.2);
  float band = smoothstep(0.35, 0.8, sin(depth * 4.0 - uTime * 2.2) * 0.5 + 0.5);
  float foam = clamp(shore * (0.5 + band * 0.8) * smoothstep(0.15, 0.55, foamN + shore*0.4), 0.0, 1.0);
  foam += smoothstep(0.65, 0.95, vFoamCrest) * smoothstep(0.45, 0.7, foamN) * 0.6;
  col = mix(col, vec3(0.92, 0.96, 0.98) * (0.3 + 0.7*(1.0-uNight)), clamp(foam, 0.0, 1.0));

  float alpha = clamp(smoothstep(0.0, 2.8, depth) * 0.85 + fres * 0.3 + foam, 0.0, 1.0);
  gl_FragColor = vec4(col, max(alpha, 0.08));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Water {
  constructor(terrain, atmosphere) {
    this.atmo = atmosphere;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uHalf: { value: WORLD_SIZE / 2 }, uNight: { value: 0 },
      uHeight: { value: terrain.makeHeightTexture() },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunI: { value: 1 },
    }]);
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
    u.uZenith.value.copy(a.uZenith.value);
    u.uHorizon.value.copy(a.uHorizon.value);
    u.uNight.value = a.uNight.value;
    u.uSunI.value = 1 - this.atmo.storm * 0.9;
  }
  // Approximate surface height for buoyancy/swimming.
  heightAt(x, z) { return 0; }
}
