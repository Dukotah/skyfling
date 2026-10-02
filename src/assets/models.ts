/**
 * Model preparation: turn a loaded GLB into render-ready parts.
 *  - props: merged static geometry (+ optional spinning sub-part) normalised so
 *    the bounding box is centred in x/z, sits on y=0 and has the target height.
 *  - planes/pickups/hazards: a cloned Group normalised by length/size, nose → +X.
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import { loadModel, type ModelId } from './loader'
import type { PropDef } from '../data/define'

export interface PropParts {
  /** Static merged geometry (world-space of the model, normalised). */
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  /** Optional spinning part, geometry centred on its pivot; `pivot` is the pivot in normalised model space. */
  spin?: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; pivot: THREE.Vector3; axis: 'x' | 'y' | 'z'; speed: number }
  /** Normalised bounding box. */
  box: THREE.Box3
  tris: number
}

const propCache = new Map<string, Promise<PropParts>>()

/**
 * Canonical materials: every GLB gets its own material objects even when they
 * share one texture atlas (KayKit packs, Kenney colormap). Keying on the image
 * content lets all props of a pack share ONE material, so a chunk's statics
 * merge into a handful of draw calls.
 */
const canonical = new Map<string, THREE.Material>()
let keyCanvas: HTMLCanvasElement | null = null

function imageKey(tex: THREE.Texture): string {
  const img = tex.image as (HTMLImageElement | ImageBitmap | HTMLCanvasElement) & { width: number; height: number }
  if (!img || !img.width) return `tex:${tex.uuid}`
  try {
    keyCanvas ??= document.createElement('canvas')
    keyCanvas.width = keyCanvas.height = 8
    const g = keyCanvas.getContext('2d', { willReadFrequently: true })!
    g.clearRect(0, 0, 8, 8)
    g.drawImage(img as CanvasImageSource, 0, 0, 8, 8)
    const d = g.getImageData(0, 0, 8, 8).data
    let h = 2166136261
    for (let i = 0; i < d.length; i += 4) {
      h ^= d[i] + (d[i + 1] << 8) + (d[i + 2] << 16)
      h = Math.imul(h, 16777619)
    }
    return `img:${img.width}x${img.height}:${h >>> 0}`
  } catch {
    return `tex:${tex.uuid}`
  }
}

/** Return the shared material equivalent to `m` (same atlas or same flat colour). */
export function canonicalMaterial(m: THREE.Material): THREE.Material {
  const s = m as THREE.MeshStandardMaterial
  let key: string
  if (s.map) key = imageKey(s.map) + (s.transparent ? ':t' : '')
  else if (s.color) key = `col:${s.color.getHexString()}:${(s.emissive?.getHexString?.() ?? '000000')}:${s.transparent ? s.opacity.toFixed(2) : '1'}:${s.roughness?.toFixed(1)}:${s.metalness?.toFixed(1)}`
  else return m
  const found = canonical.get(key)
  if (found) return found
  canonical.set(key, m)
  return m
}

/** Fix up materials from packs so they sit well in our lighting. */
export function tuneMaterial(m: THREE.Material): void {
  const s = m as THREE.MeshStandardMaterial
  if ('roughness' in s) {
    if (s.metalness > 0.6 && !s.metalnessMap) s.metalness = 0.2
    if (s.roughness < 0.35 && !s.roughnessMap) s.roughness = 0.55
  }
  if ('map' in s && s.map) s.map.anisotropy = 4
  s.side = THREE.FrontSide
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.geometry?.attributes?.position) out.push(m)
  })
  return out
}

/** Geometry of a mesh baked into world space (positions, normals), non-indexed-safe. */
function toFloat32(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = attr.count
  const size = attr.itemSize
  const out = new Float32Array(n * size)
  for (let i = 0; i < n; i++) {
    out[i * size] = attr.getX(i)
    if (size > 1) out[i * size + 1] = attr.getY(i)
    if (size > 2) out[i * size + 2] = attr.getZ(i)
    if (size > 3) out[i * size + 3] = attr.getW(i)
  }
  return new THREE.BufferAttribute(out, size)
}

function bake(mesh: THREE.Mesh, extra?: THREE.Matrix4): THREE.BufferGeometry {
  // Non-indexed, float32-only copy so geometries from different packs merge cleanly.
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  for (const k of Object.keys(g.attributes)) {
    const attr = g.getAttribute(k)
    if (!attr || !['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    else g.setAttribute(k, toFloat32(attr))
  }
  g.morphAttributes = {}
  const m = mesh.matrixWorld.clone()
  if (extra) m.premultiply(extra)
  g.applyMatrix4(m)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  return g
}

function isSpinNode(o: THREE.Object3D, name: string): boolean {
  let p: THREE.Object3D | null = o
  while (p) {
    if (p.name === name) return true
    p = p.parent
  }
  return false
}

export function prepareProp(def: Readonly<PropDef>): Promise<PropParts> {
  let p = propCache.get(def.id)
  if (!p) {
    p = loadModel(def.model as ModelId).then((gltf) => buildPropParts(gltf.scene, def))
    propCache.set(def.id, p)
  }
  return p
}

export function buildPropParts(scene: THREE.Object3D, def: Readonly<PropDef>): PropParts {
  const root = scene
  root.updateMatrixWorld(true)
  const meshes = collectMeshes(root)
  const box = new THREE.Box3()
  for (const m of meshes) box.expandByObject(m)
  const size = box.getSize(new THREE.Vector3())
  const scale = def.height / Math.max(1e-3, size.y)
  const centre = box.getCenter(new THREE.Vector3())
  // Normalise: centre x/z, floor y, scale to target height.
  const norm = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z))

  const staticGeos: THREE.BufferGeometry[] = []
  const staticMats: THREE.Material[] = []
  const spinGeos: THREE.BufferGeometry[] = []
  const spinMats: THREE.Material[] = []
  let spinPivot: THREE.Vector3 | null = null
  let tris = 0
  const isCloud = /cloud/.test(def.id)
  for (const mesh of meshes) {
    const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const mats = rawMats.map((mat) => {
      tuneMaterial(mat)
      if (isCloud) {
        const sm = mat as THREE.MeshStandardMaterial
        sm.emissive = new THREE.Color(0xffffff)
        sm.emissiveIntensity = 0.55
        sm.roughness = 1
        return mat
      }
      return canonicalMaterial(mat)
    })
    const spinning = def.spin && isSpinNode(mesh, def.spin.node)
    const g = bake(mesh, norm)
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3
    if (spinning) {
      spinGeos.push(g)
      spinMats.push(mats[0])
      if (!spinPivot) {
        const node = findNamed(root, def.spin!.node)!
        spinPivot = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).applyMatrix4(norm)
      }
    } else {
      staticGeos.push(g)
      staticMats.push(mats[0])
    }
  }

  const merged = mergeByMaterial(staticGeos, staticMats)
  const boxSource = (merged.geometry.attributes.position as THREE.BufferAttribute | undefined) ?? (spinGeos[0]?.attributes.position as THREE.BufferAttribute | undefined)
  const parts: PropParts = { geometry: merged.geometry, material: merged.material, box: boxSource ? new THREE.Box3().setFromBufferAttribute(boxSource) : new THREE.Box3(), tris: Math.round(tris) }
  if (spinGeos.length && spinPivot && def.spin) {
    const sm = mergeByMaterial(spinGeos, spinMats)
    sm.geometry.translate(-spinPivot.x, -spinPivot.y, -spinPivot.z)
    parts.spin = { geometry: sm.geometry, material: sm.material, pivot: spinPivot, axis: def.spin.axis, speed: def.spin.speed }
  }
  return parts
}

/** One shared vertex-colour material for all flat-coloured pack models (one draw call per batch). */
const VERTEX_COLOR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 })

/** Bake each material's base colour into a `color` attribute so the pieces merge into one geometry. */
function bakeVertexColors(geos: THREE.BufferGeometry[], mats: THREE.Material[]): THREE.BufferGeometry {
  const parts = geos.map((g, i) => {
    const c = ((mats[i] as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xffffff)).clone()
    const e = (mats[i] as THREE.MeshStandardMaterial).emissive
    if (e && (e.r + e.g + e.b) > 0.05) c.add(e)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  })
  return mergeGeometries(parts, false) ?? parts[0]
}

/** Merge geometries, grouping by material so the result is one draw per distinct material. */
function mergeByMaterial(geos: THREE.BufferGeometry[], mats: THREE.Material[]): { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] } {
  if (geos.length === 0) {
    return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
  }
  const distinct = new Set(mats)
  const anyTextured = mats.some((m) => !!(m as THREE.MeshStandardMaterial).map)
  if (distinct.size > 1 && !anyTextured) {
    return { geometry: bakeVertexColors(geos, mats), material: VERTEX_COLOR_MAT }
  }
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  geos.forEach((g, i) => {
    const arr = byMat.get(mats[i]) ?? []
    arr.push(g)
    byMat.set(mats[i], arr)
  })
  const groupGeos: THREE.BufferGeometry[] = []
  const groupMats: THREE.Material[] = []
  for (const [mat, list] of byMat) {
    const g = list.length === 1 ? list[0] : (mergeGeometries(list, false) ?? list[0])
    groupGeos.push(g)
    groupMats.push(mat)
  }
  if (groupGeos.length === 1) return { geometry: groupGeos[0], material: groupMats[0] }
  const merged = mergeGeometries(groupGeos, true) ?? groupGeos[0]
  return { geometry: merged, material: groupMats }
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null
  root.traverse((o) => {
    if (!found && o.name === name) found = o
  })
  return found
}

export interface PreparedActor {
  group: THREE.Group
  box: THREE.Box3
  mixer?: THREE.AnimationMixer
  clips: THREE.AnimationClip[]
}

/**
 * Clone a GLB scene as a live actor (planes, birds, drones, balloons), scaled so
 * `axis` extent equals `target` metres, centred, and rotated so the model's
 * forward axis maps to +X.
 */
export async function prepareActor(id: ModelId, target: number, axis: 'x' | 'y' | 'z' | 'max', forward: '+x' | '-x' | '+z' | '-z' = '+x', floor = false, mergeRigid = false): Promise<PreparedActor> {
  const gltf = await loadModel(id)
  const src = gltf.scene
  let group = skeletonClone(src) as THREE.Group
  if (mergeRigid && !gltf.animations.some((c) => c.tracks.some((t) => /morphTargetInfluences|quaternion|position/.test(t.name) && false))) {
    // Collapse a rigid multi-mesh model into one mesh (one draw call). Animations are dropped.
    const meshes = collectMeshes(group).filter((m) => !(m as THREE.SkinnedMesh).isSkinnedMesh && !m.morphTargetInfluences?.length)
    if (meshes.length > 1) {
      const geos = meshes.map((m) => bake(m))
      const mats = meshes.map((m) => (Array.isArray(m.material) ? m.material[0] : m.material))
      const merged = mergeByMaterial(geos, mats)
      const one = new THREE.Mesh(merged.geometry, merged.material)
      group = new THREE.Group()
      group.add(one)
      gltf.animations.length && void 0
    }
  }
  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach(tuneMaterial)
      m.castShadow = true
      m.receiveShadow = false
      m.frustumCulled = false
    }
  })
  // Wrap so we can normalise without touching the animated hierarchy.
  const wrap = new THREE.Group()
  wrap.add(group)
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const extent = axis === 'max' ? Math.max(size.x, size.y, size.z) : size[axis]
  const s = target / Math.max(1e-3, extent)
  const c = box.getCenter(new THREE.Vector3())
  group.position.set(-c.x * s, (floor ? -box.min.y : -c.y) * s, -c.z * s)
  group.scale.setScalar(s)
  // Rotate forward axis to +X.
  const rotY = forward === '+x' ? 0 : forward === '-x' ? Math.PI : forward === '+z' ? Math.PI / 2 : -Math.PI / 2
  const outer = new THREE.Group()
  wrap.rotation.y = rotY
  outer.add(wrap)
  const clips = mergeRigid ? [] : gltf.animations
  const mixer = clips.length ? new THREE.AnimationMixer(group) : undefined
  outer.updateMatrixWorld(true)
  return { group: outer, box: new THREE.Box3().setFromObject(outer), mixer, clips }
}
