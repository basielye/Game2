// Global material patcher: chains onto every lit material's onBeforeCompile to add
//   1) aerial perspective — exponential height fog coloured by the physically based sky LUT, with sun in-scattering
//   2) cascaded shadow map support (three's CSM) without overwriting existing custom shader hooks.
import * as THREE from 'three';
import { SKY_LUT_GLSL } from '../world/sky.js';

export const fogUniforms = {
  uSkyLUT: { value: null },
  uFogSun: { value: new THREE.Vector3(0, 1, 0) },
  uFogSunCol: { value: new THREE.Color(1, 1, 1) },
  uFogDensity: { value: 0.0022 },
  uFogFalloff: { value: 0.0075 },
  uFogBase: { value: 0 },
  uHaze: { value: 0.00028 },
  uFogExposure: { value: 1 },
};

const PARS_V = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
const VERT = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  {
    vec4 fw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fw = instanceMatrix * fw;
    #endif
    vFogWorld = (modelMatrix * fw).xyz;
  }
#endif`;
export const AERIAL_PARS_F = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  uniform sampler2D uSkyLUT;
  uniform vec3 uFogSun, uFogSunCol;
  uniform float uFogDensity, uFogFalloff, uFogBase, uHaze, uFogExposure;
  ${SKY_LUT_GLSL}
  vec3 applyAerial(vec3 col, vec3 wpos) {
    vec3 ro = cameraPosition;
    vec3 dv = wpos - ro;
    float dist = length(dv);
    vec3 rd = dv / max(dist, 1e-3);
    float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
    float b = uFogFalloff;
    float h = (uFogDensity / b) * exp(-(ro.y - uFogBase) * b) * (1.0 - exp(-dist * ry * b)) / ry;
    float amount = 1.0 - exp(-max(h, 0.0) - dist * uHaze);
    vec3 dir = normalize(vec3(rd.x, max(rd.y, 0.0) * 0.5 + 0.035, rd.z));
    vec3 inscat = skyLUT(uSkyLUT, dir) * uFogExposure;
    float sun = max(dot(rd, uFogSun), 0.0);
    inscat += uFogSunCol * (pow(sun, 8.0) * 0.35 + pow(sun, 48.0) * 0.5) * amount;
    return mix(col, inscat, amount);
  }
#endif`;
const FRAG = /* glsl */`
#ifdef USE_FOG
  gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, vFogWorld);
#endif`;

let csmRef = null;
export function setCSM(csm) { csmRef = csm; }

const LIT = (m) => m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial;

export function patchMaterial(m) {
  if (!m || m.userData._patched || m.isShaderMaterial || m.isPointsMaterial || m.isSpriteMaterial || m.isLineBasicMaterial || m.isMeshDepthMaterial) return;
  m.userData._patched = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  const lit = LIT(m);
  if (lit && csmRef) {
    m.defines = m.defines || {};
    m.defines.USE_CSM = 1;
    m.defines.CSM_CASCADES = csmRef.cascades;
    m.defines.CSM_FADE = '';
  }
  m.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, fogUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', PARS_V)
      .replace('#include <fog_vertex>', VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', AERIAL_PARS_F)
      .replace('#include <fog_fragment>', FRAG);
    if (lit && csmRef && m.defines && m.defines.USE_CSM) {
      const csm = csmRef;
      const breaks = [];
      csm.getExtendedBreaks(breaks);
      shader.uniforms.CSM_cascades = { value: breaks };
      shader.uniforms.cameraNear = { value: csm.camera.near };
      shader.uniforms.shadowFar = { value: Math.min(csm.camera.far, csm.maxFar) };
      csm.shaders.set(m, shader);
    }
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|aerial' + (lit && csmRef ? '|csm' + csmRef.cascades : '');
  m.needsUpdate = true;
}

// Walk the scene and patch anything new. Cheap enough to run every second.
export function patchScene(root) {
  root.traverse((o) => {
    if (!o.material) return;
    if (Array.isArray(o.material)) o.material.forEach(patchMaterial);
    else patchMaterial(o.material);
    if (o.customDepthMaterial) patchMaterial(o.customDepthMaterial);
  });
}
