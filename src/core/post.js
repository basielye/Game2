// Post-processing (pmndrs/postprocessing):
//   scene (HalfFloat, MSAA) → N8AO ambient occlusion → mipmap bloom → AgX tone mapping → cinematic grade → SMAA.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect, SMAAPreset, Effect, BlendFunction } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

const gradeFrag = /* glsl */`
uniform float uTime, uDeadEye, uDamage, uVignette, uSat, uContrast, uGrain, uFade, uNight, uRays, uBlur;
uniform vec2 uSun; uniform vec3 uSunCol;
float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  vec2 dc = uv - 0.5;
  // light shafts toward the on-screen sun (bright, unoccluded sky pixels only)
  if (uRays > 0.01) {
    vec2 delta = (uSun - uv) / 32.0;
    vec2 p = uv + delta * h12(uv * resolution + uTime);
    float illum = 0.0, decay = 1.0;
    for (int i = 0; i < 32; i++) {
      p += delta;
      vec3 s = texture2D(inputBuffer, clamp(p, 0.0, 1.0)).rgb;
      illum += max(0.0, dot(s, vec3(0.333)) - 0.8) * decay;
      decay *= 0.95;
    }
    col += uSunCol * illum * (uRays / 32.0) * 0.7;
  }
  // speed blur: radial streaks toward the frame edges while driving / flying fast
  if (uBlur > 0.01) {
    vec3 acc = col; float wsum = 1.0;
    for (int i = 1; i <= 6; i++) { float k = float(i) / 6.0; vec2 o = dc * k * uBlur * 0.045 * smoothstep(0.1, 0.5, length(dc)); acc += texture2D(inputBuffer, uv - o).rgb; wsum += 1.0; }
    col = acc / wsum;
  }
  // subtle lens chromatic aberration near the frame edges
  float ca = (0.0008 + uDeadEye * 0.004) * dot(dc, dc) * 4.0;
  col.r = mix(col.r, texture2D(inputBuffer, uv + dc * ca).r, 0.6);
  col.b = mix(col.b, texture2D(inputBuffer, uv - dc * ca).b, 0.6);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  // filmic split tone: cool shadows, warm highlights
  col = mix(col * vec3(0.95, 1.0, 1.05), col * vec3(1.05, 1.0, 0.94), smoothstep(0.1, 0.9, l));
  col = mix(col, col * vec3(0.82, 0.92, 1.12), uNight * 0.45);
  vec3 sep = vec3(l * 1.12, l * 0.9, l * 0.6);
  col = mix(col, sep, uDeadEye * 0.75);
  float vig = smoothstep(0.95, 0.25, length(dc * vec2(resolution.x / resolution.y, 1.0)));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col *= mix(1.0, vig, uDeadEye * 0.6);
  col = mix(col, col * vec3(1.3, 0.4, 0.35), uDamage * (1.0 - vig) * 0.9);
  col += (h12(uv * resolution + fract(uTime) * 100.0) - 0.5) * uGrain;
  col *= 1.0 - uFade;
  outputColor = vec4(clamp(col, 0.0, 1.0), inputColor.a);
}`;

class GradeEffect extends Effect {
  constructor() {
    const u = new Map([
      ['uTime', new THREE.Uniform(0)], ['uDeadEye', new THREE.Uniform(0)], ['uDamage', new THREE.Uniform(0)],
      ['uVignette', new THREE.Uniform(0.3)], ['uSat', new THREE.Uniform(1.1)], ['uContrast', new THREE.Uniform(1.06)],
      ['uGrain', new THREE.Uniform(0.025)], ['uFade', new THREE.Uniform(0)], ['uNight', new THREE.Uniform(0)],
      ['uRays', new THREE.Uniform(0)], ['uBlur', new THREE.Uniform(0)], ['uSun', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))], ['uSunCol', new THREE.Uniform(new THREE.Color(1, 0.9, 0.7))],
    ]);
    super('GradeEffect', gradeFrag, { uniforms: u, blendFunction: BlendFunction.NORMAL });
  }
}

// HDR exposure (eye adaptation is driven from the game: brighter at twilight/night).
class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', 'uniform float uExp;\nvoid mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * uExp, inputColor.a); }', { uniforms: new Map([['uExp', new THREE.Uniform(1)]]) });
  }
}

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    renderer.toneMapping = THREE.NoToneMapping;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.ao = new N8AOPostPass(scene, camera, 1280, 720);
    this.ao.configuration.aoRadius = 1.6;
    this.ao.configuration.distanceFalloff = 1.2;
    this.ao.configuration.intensity = 2.4;
    this.ao.configuration.aoSamples = 12;
    this.ao.configuration.denoiseSamples = 6;
    this.ao.configuration.denoiseRadius = 10;
    this.ao.configuration.halfRes = true;
    this.ao.configuration.gammaCorrection = false;
    this.ao.configuration.transparencyAware = false;
    this.ao.configuration.autoDetectTransparency = false;
    this.composer.addPass(this.ao);
    this.bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.55, luminanceThreshold: 1.1, luminanceSmoothing: 0.25, radius: 0.72 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.gradeFx = new GradeEffect();
    this.smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });
    this.exposureFx = new ExposureEffect();
    this.passHDR = new EffectPass(camera, this.exposureFx, this.bloom, this.tone);
    this.passLDR = new EffectPass(camera, this.gradeFx, this.smaa);
    this.composer.addPass(this.passHDR);
    this.composer.addPass(this.passLDR);
    // expose uniforms with the same names the game already drives
    this.u = {};
    for (const [k, v] of this.gradeFx.uniforms) this.u[k] = v;
    this.exposure = 1;
    this.u.uExp = this.exposureFx.uniforms.get('uExp');
  }
  setSize(w, h, pr) {
    this.renderer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.ao.setSize(Math.round(w * pr), Math.round(h * pr));
  }
  setQuality(q) {
    this.ao.enabled = q === 'high' || q === 'ultra' || q === 'medium';
    this.ao.configuration.halfRes = q !== 'ultra';
    this.ao.configuration.aoSamples = q === 'ultra' ? 16 : q === 'high' ? 12 : 8;
    this.composer.multisampling = q === 'low' ? 0 : q === 'medium' ? 2 : 4;
    this.bloom.intensity = q === 'low' ? 0.3 : 0.55;
  }
  render(dt) {
    this.u.uTime.value += dt;
    this.composer.render(dt);
  }
}
