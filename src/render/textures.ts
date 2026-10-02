/**
 * Procedural textures generated at startup (zero bytes shipped): detail sets
 * for sand / snow / ash to complement the ambientCG grass and rock sets, plus
 * a soft particle sprite and a cloud-noise fallback.
 */

import * as THREE from 'three'
import { valueNoise, fbm } from '../world/rng'

export interface DetailSet {
  color: THREE.Texture
  normal: THREE.Texture
  rough: THREE.Texture
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

function toTexture(c: HTMLCanvasElement, srgb: boolean): THREE.Texture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 4
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Height field → tiling colour, normal and roughness maps. */
export function makeDetailSet(kind: 'sand' | 'snow' | 'ash', size = 256): DetailSet {
  const h = new Float32Array(size * size)
  const scale = kind === 'sand' ? 5 : kind === 'snow' ? 7 : 6
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable by sampling noise on a torus (two sine-wrapped coordinates).
      const u = x / size
      const v = y / size
      const nx = Math.cos(u * Math.PI * 2) * scale
      const ny = Math.sin(u * Math.PI * 2) * scale
      const nz = Math.cos(v * Math.PI * 2) * scale
      const nw = Math.sin(v * Math.PI * 2) * scale
      let val = fbm(nx + nz * 0.7, ny + nw * 0.7, 4, 11) * 0.5 + 0.5
      if (kind === 'sand') val = val * 0.6 + (Math.sin((u * 18 + val * 2) * Math.PI * 2) * 0.5 + 0.5) * 0.4 // ripples
      if (kind === 'ash') val = Math.pow(val, 1.4) * 0.8 + valueNoise(nx * 6, nz * 6, 3) * 0.2
      h[y * size + x] = val
    }
  }
  const [cc, cg] = canvas(size)
  const [nc, ng] = canvas(size)
  const [rc, rg] = canvas(size)
  const ci = cg.createImageData(size, size)
  const ni = ng.createImageData(size, size)
  const ri = rg.createImageData(size, size)
  const base = kind === 'sand' ? [226, 191, 122] : kind === 'snow' ? [240, 245, 255] : [58, 50, 48]
  const dark = kind === 'sand' ? [184, 137, 76] : kind === 'snow' ? [205, 218, 240] : [30, 26, 24]
  const strength = kind === 'snow' ? 1.2 : 2.2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const v = h[i]
      const l = h[y * size + ((x - 1 + size) % size)]
      const r = h[y * size + ((x + 1) % size)]
      const d = h[((y - 1 + size) % size) * size + x]
      const u2 = h[((y + 1) % size) * size + x]
      const nx = (l - r) * strength
      const ny = (d - u2) * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      const o = i * 4
      ci.data[o] = dark[0] + (base[0] - dark[0]) * v
      ci.data[o + 1] = dark[1] + (base[1] - dark[1]) * v
      ci.data[o + 2] = dark[2] + (base[2] - dark[2]) * v
      ci.data[o + 3] = 255
      ni.data[o] = ((nx / len) * 0.5 + 0.5) * 255
      ni.data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255
      ni.data[o + 2] = ((nz / len) * 0.5 + 0.5) * 255
      ni.data[o + 3] = 255
      const rough = kind === 'snow' ? 0.55 + v * 0.3 : kind === 'sand' ? 0.85 + v * 0.1 : 0.9
      ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = rough * 255
      ri.data[o + 3] = 255
    }
  }
  cg.putImageData(ci, 0, 0)
  ng.putImageData(ni, 0, 0)
  rg.putImageData(ri, 0, 0)
  return { color: toTexture(cc, true), normal: toTexture(nc, false), rough: toTexture(rc, false) }
}

/** Soft round particle. */
export function makeSoftSprite(size = 64): THREE.Texture {
  const [c, g] = canvas(size)
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.8)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Puffy cloud blob sprite for storm walls. */
export function makeCloudSprite(size = 128, seed = 1): THREE.Texture {
  const [c, g] = canvas(size)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1
      const v = (y / size) * 2 - 1
      const r = Math.hypot(u, v)
      const n = fbm(u * 3 + seed * 10, v * 3, 4, seed) * 0.5 + 0.5
      const edge = 1 - Math.min(1, Math.max(0, (r - 0.72) / 0.26)) // hard zero before the quad edge
      const a = Math.max(0, 1 - r / (0.55 + n * 0.45)) * edge
      const o = (y * size + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = Math.pow(a, 1.5) * 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
