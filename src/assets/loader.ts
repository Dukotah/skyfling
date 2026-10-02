/**
 * Asset loader (ARCHITECTURE §8): byte-accurate progress for the boot bar,
 * GLB parsing via GLTFLoader, HDR via RGBELoader, textures via TextureLoader.
 * Everything is cached by id; models are returned as the original scene (the
 * caller clones or extracts geometry).
 */

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { MODELS, TEXTURES, HDRIS, MATERIALS, type ModelId } from './manifest.generated'

export type { ModelId }
export { MODELS, TEXTURES, HDRIS, MATERIALS }

const gltfLoader = new GLTFLoader()
const rgbeLoader = new HDRLoader()
const texLoader = new THREE.TextureLoader()

const modelCache = new Map<string, Promise<GLTF>>()
const texCache = new Map<string, Promise<THREE.Texture>>()
const hdrCache = new Map<string, Promise<THREE.DataTexture>>()

/** Fetch with progress; resolves to an ArrayBuffer. */
async function fetchBytes(url: string, onBytes?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)
  if (!res.body || !onBytes) return res.arrayBuffer()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onBytes(loaded, total || loaded)
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.byteLength
  }
  return out.buffer
}

export function loadModel(id: ModelId, onBytes?: (loaded: number, total: number) => void): Promise<GLTF> {
  let p = modelCache.get(id)
  if (!p) {
    const url = MODELS[id].url
    p = fetchBytes(url, onBytes).then(
      (buf) => new Promise<GLTF>((resolve, reject) => gltfLoader.parse(buf, '/models/', resolve, reject)),
    )
    modelCache.set(id, p)
  }
  return p
}

export function loadTexture(url: string, opts: { srgb?: boolean; repeat?: boolean } = {}): Promise<THREE.Texture> {
  let p = texCache.get(url)
  if (!p) {
    p = texLoader.loadAsync(url).then((t) => {
      if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace
      if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 4
      return t
    })
    texCache.set(url, p)
  }
  return p
}

export function loadHdr(id: keyof typeof HDRIS): Promise<THREE.DataTexture> {
  let p = hdrCache.get(id)
  if (!p) {
    p = rgbeLoader.loadAsync(HDRIS[id]).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping
      return t
    })
    hdrCache.set(id, p)
  }
  return p
}

export interface PreloadItem {
  kind: 'model' | 'texture' | 'hdr'
  id: string
  /** Expected size in KB (for progress weighting). */
  kb: number
}

/** The boot set: everything the first biomes and the hangar need. The rest streams in by biome. */
export function bootPreloadList(modelIds: ModelId[], hdrIds: Array<keyof typeof HDRIS> = []): PreloadItem[] {
  const items: PreloadItem[] = modelIds.map((id) => ({ kind: 'model', id, kb: MODELS[id].kb }))
  for (const id of hdrIds) items.push({ kind: 'hdr', id, kb: 1500 })
  return items
}

/** Load a list with aggregated progress 0..1. Failures are logged and skipped so one bad file never blocks boot. */
export async function preload(items: PreloadItem[], onProgress: (p: number) => void): Promise<void> {
  const totalKb = items.reduce((a, i) => a + i.kb, 0) || 1
  const loadedKb = new Map<string, number>()
  const report = () => {
    let sum = 0
    for (const v of loadedKb.values()) sum += v
    onProgress(Math.min(1, sum / totalKb))
  }
  await Promise.all(
    items.map(async (it) => {
      try {
        if (it.kind === 'model') {
          await loadModel(it.id as ModelId, (l, t) => {
            loadedKb.set(it.id, (l / Math.max(1, t)) * it.kb)
            report()
          })
        } else if (it.kind === 'hdr') {
          await loadHdr(it.id as keyof typeof HDRIS)
        } else {
          await loadTexture(it.id)
        }
      } catch (err) {
        console.warn('[assets] failed', it.id, err)
      }
      loadedKb.set(it.id, it.kb)
      report()
    }),
  )
  onProgress(1)
}
