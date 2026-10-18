// Paved park roads and the airstrip runway: terrain-conforming asphalt ribbons with painted, worn markings.
import * as THREE from 'three';
import { PAVED, RUNWAY } from '../data/world.js';

const TILE = 4; // metres per asphalt texture repeat

function asphaltMaterial(mode, width) {
  const tl = new THREE.TextureLoader();
  const ld = (suf, srgb) => { const t = tl.load(`textures/build/asphalt_${suf}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / TILE, 1 / TILE); t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: ld('a', true), normalMap: ld('n', false), roughness: 1, metalness: 0, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uMode = { value: mode }; s.uniforms.uWidth = { value: width };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWidth; varying vec2 vRoad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = vec2(uv.x / uWidth, uv.y);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform int uMode; varying vec2 vRoad;
        float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float u = vRoad.x, v = vRoad.y;
        float wear = smoothstep(0.25, 0.75, rn(vec2(u * 40.0, v * 0.6)) * 0.6 + rn(vec2(u * 9.0, v * 2.3)) * 0.4);
        float paint = 0.0; vec3 pcol = vec3(0.92);
        if (uMode == 0) {
          // two-lane park road: dashed yellow centre, solid white edges
          float c = 1.0 - smoothstep(0.009, 0.014, abs(u - 0.5));
          c *= step(fract(v / 9.0), 0.5);
          float e = 1.0 - smoothstep(0.007, 0.012, abs(abs(u - 0.5) - 0.43));
          paint = max(c, e);
          pcol = c > e ? vec3(0.85, 0.62, 0.12) : vec3(0.9);
        } else {
          // runway: edge lines, centreline dashes, threshold piano keys at both ends
          float e = 1.0 - smoothstep(0.004, 0.006, abs(abs(u - 0.5) - 0.47));
          float cl = (1.0 - smoothstep(0.006, 0.009, abs(u - 0.5))) * step(fract(v / 36.0), 0.55);
          float endD = min(v, ${RUNWAY.len.toFixed(1)} - v);
          float keys = step(endD, 30.0) * step(6.0, endD) * step(0.5, fract(u * 16.0)) * step(abs(u - 0.5), 0.42);
          float bar = (1.0 - smoothstep(0.5, 1.0, abs(endD - 40.0))) * step(abs(u - 0.5), 0.45);
          paint = max(max(e, cl), max(keys, bar));
        }
        paint *= 0.35 + 0.65 * wear;
        diffuseColor.rgb = mix(diffuseColor.rgb, pcol * 0.75, paint);
        // crumbling edges blend into the dirt shoulder
        float edge = min(u, 1.0 - u);
        float crumb = rn(vec2(v * 1.7, u * 3.0)) * 0.035 + rn(vec2(v * 0.3, 1.0)) * 0.02;
        diffuseColor.a = smoothstep(0.0, 0.02, edge - crumb + 0.012);
        float paintRough = paint;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(texture2D(normalMap, vNormalMapUv).a, 0.55, paintRough);');
  };
  m.customProgramCacheKey = () => 'asphalt' + mode;
  return m;
}

function ribbon(terrain, pts, width, segs, yOff) {
  const n = pts.length;
  const pos = new Float32Array(n * (segs + 1) * 3), uv = new Float32Array(n * (segs + 1) * 2), road = new Float32Array(n * (segs + 1) * 2);
  let v = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    if (i > 0) v += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    for (let k = 0; k <= segs; k++) {
      const u = k / segs, o = (u - 0.5) * width;
      const px = x + nx * o, pz = z + nz * o;
      const j = i * (segs + 1) + k;
      pos[j * 3] = px; pos[j * 3 + 1] = terrain.getHeight(px, pz) + yOff; pos[j * 3 + 2] = pz;
      uv[j * 2] = u * width; uv[j * 2 + 1] = v;
      road[j * 2] = u; road[j * 2 + 1] = v;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < segs; k++) {
    const a = i * (segs + 1) + k, b = a + segs + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('road', new THREE.BufferAttribute(road, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildRoads(terrain) {
  const group = new THREE.Group();
  group.name = 'roads';
  const roadMat = asphaltMaterial(0, 7.2), runwayMat = asphaltMaterial(1, RUNWAY.w);
  const roads = terrain.roadData.roads;
  PAVED.forEach((ri, n) => {
    const r = roads[ri];
    if (!r) return;
    // split long roads into ~200 m pieces so frustum culling works
    const P = r.pts;
    for (let s = 0; s < P.length - 1; s += 48) {
      const piece = P.slice(s, Math.min(P.length, s + 50));
      if (piece.length < 2) continue;
      const m = new THREE.Mesh(ribbon(terrain, piece, 7.2, 6, 0.06 + n * 0.012), roadMat);
      m.receiveShadow = true;
      group.add(m);
    }
  });
  // runway
  const R = RUNWAY, c = Math.cos(R.yaw), sn = Math.sin(R.yaw);
  const pts = [];
  for (let s = 0; s <= R.len; s += 6) { const a = s - R.len / 2; pts.push([R.x + c * a, R.z + sn * a]); }
  const rw = new THREE.Mesh(ribbon(terrain, pts, R.w, 10, 0.07), runwayMat);
  rw.receiveShadow = true;
  group.add(rw);
  return group;
}
