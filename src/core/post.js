// Post-processing stack: MSAA render → bloom → ACES tonemap → cinematic grade (vignette, grain, Dead Eye sepia, damage).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDeadEye: { value: 0 }, uDamage: { value: 0 },
    uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uWarm: { value: 0.02 }, uGrain: { value: 0.035 }, uRes: { value: new THREE.Vector2(1, 1) },
    uFade: { value: 0 }, uNight: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uDeadEye, uDamage, uVignette, uSat, uContrast, uWarm, uGrain, uFade, uNight; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // subtle chromatic aberration toward edges (stronger in Dead Eye)
      vec2 dc = uv - 0.5;
      float ca = 0.0015 + uDeadEye * 0.004;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dc * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dc * ca).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col += vec3(uWarm, uWarm * 0.4, -uWarm);
      // moonlit night tint
      col = mix(col, col * vec3(0.8, 0.9, 1.15), uNight * 0.5);
      // Dead Eye: warm sepia, crushed edges
      vec3 sep = vec3(l * 1.15, l * 0.92, l * 0.62);
      col = mix(col, sep, uDeadEye * 0.75);
      float vig = smoothstep(0.85, 0.2, length(dc * vec2(uRes.x / uRes.y, 1.0)) );
      col *= mix(1.0 - uVignette, 1.0, vig);
      col *= mix(1.0, vig, uDeadEye * 0.6);
      col = mix(col, col * vec3(1.3, 0.4, 0.35), uDamage * (1.0 - vig) * 0.9);
      col += (h(uv * uRes + uTime) - 0.5) * uGrain;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, this.rt);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.88);
    this.output = new OutputPass();
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.composer.addPass(this.grade);
    this.u = this.grade.uniforms;
  }
  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.u.uRes.value.set(w * pr, h * pr);
  }
  setQuality(q) {
    this.bloom.enabled = q !== 'low';
    this.rt.samples = q === 'low' ? 0 : 4;
    this.composer.renderTarget1.samples = this.rt.samples;
    this.composer.renderTarget2.samples = this.rt.samples;
    this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose();
  }
  render(dt) {
    this.u.uTime.value += dt;
    this.composer.render(dt);
  }
}
