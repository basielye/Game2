// Runtime asset loading: photographic texture sets (packed into texture arrays) and glTF models.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = './';

export function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Failed to load ' + url));
    im.src = BASE + url;
  });
}

// Pack same-size images into one DataArrayTexture (one sampler, N layers).
export function arrayTexture(images, size, srgb) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(size * size * 4 * images.length);
  images.forEach((im, i) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(im, 0, 0, size, size);
    data.set(ctx.getImageData(0, 0, size, size).data, i * size * size * 4);
  });
  const t = new THREE.DataArrayTexture(data, size, size, images.length);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function texture(im, srgb = true, repeat = true) {
  const t = new THREE.Texture(im);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

let gltfLoader = null;
export function gltf(renderer, url) {
  if (!gltfLoader) {
    const ktx2 = new KTX2Loader().setTranscoderPath(BASE + 'basis/').detectSupport(renderer);
    gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(new DRACOLoader().setDecoderPath(BASE + 'draco/'));
  }
  // hosts that can't serve .glb get JSON glTF with embedded buffers (tools/glb2json.py); the page opts in via __GLTF_EXT
  if (typeof window !== 'undefined' && window.__GLTF_EXT) url = url.replace(/\.glb$/, '.' + window.__GLTF_EXT);
  return new Promise((res, rej) => gltfLoader.load(BASE + url, res, undefined, rej));
}

export const TERRAIN_LAYERS = ['t0_grass', 't1_forest', 't2_dirt', 't3_gravel', 't4_sand', 't5_rock', 't6_rocks'];

export async function loadTerrainTextures(size) {
  const albedo = await Promise.all(TERRAIN_LAYERS.map((n) => loadImage(`textures/${n}_a.webp`)));
  const normal = await Promise.all(TERRAIN_LAYERS.map((n) => loadImage(`textures/${n}_n.webp`)));
  return { albedo: arrayTexture(albedo, size, true), normal: arrayTexture(normal, size, false) };
}
