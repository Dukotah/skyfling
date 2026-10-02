/**
 * Instancer (ARCHITECTURE §7): one InstancedMesh per prop type per chunk,
 * built from prepared prop parts; spinning sub-parts get their own instanced
 * mesh whose matrices are refreshed each frame. LOD by distance is handled by
 * the chunk's visibility (whole chunks) plus per-prop `lod` cull.
 */

import * as THREE from 'three'
import type { PropParts } from '../assets/models'
import type { PropPlacement } from '../world/placement'

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const P = new THREE.Vector3()
const S = new THREE.Vector3()
const SPIN_Q = new THREE.Quaternion()
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

export interface SpinGroup {
  mesh: THREE.InstancedMesh
  bases: THREE.Matrix4[]
  axis: 'x' | 'y' | 'z'
  speed: number
  phase: number[]
}

export interface PropBatch {
  statics: THREE.InstancedMesh
  spin?: SpinGroup
  lod: number
  tris: number
  /** Whether this prop type casts shadows at all (near chunks only). */
  shadow: boolean
}

/** Build the instanced meshes for one prop type in one chunk. */
export function buildBatch(parts: PropParts, placements: PropPlacement[], lod: number, shadow: boolean): PropBatch {
  const n = placements.length
  const statics = new THREE.InstancedMesh(parts.geometry, parts.material, n)
  statics.castShadow = shadow
  statics.receiveShadow = true
  statics.frustumCulled = true
  let spin: SpinGroup | undefined
  if (parts.spin) {
    const sm = new THREE.InstancedMesh(parts.spin.geometry, parts.spin.material, n)
    sm.castShadow = shadow
    sm.frustumCulled = false
    spin = { mesh: sm, bases: [], axis: parts.spin.axis, speed: parts.spin.speed, phase: [] }
  }
  for (let i = 0; i < n; i++) {
    const pl = placements[i]
    P.set(pl.x, pl.y, pl.z)
    Q.setFromAxisAngle(AX.y, pl.yaw)
    S.setScalar(pl.scale)
    M.compose(P, Q, S)
    statics.setMatrixAt(i, M)
    if (spin && parts.spin) {
      // Pivot in world: base * pivot.
      const pivot = parts.spin.pivot.clone().applyMatrix4(M)
      const base = new THREE.Matrix4().compose(pivot, Q, S)
      spin.bases.push(base)
      spin.phase.push(Math.random() * Math.PI * 2)
      spin.mesh.setMatrixAt(i, base)
    }
  }
  statics.instanceMatrix.needsUpdate = true
  statics.computeBoundingSphere()
  if (spin) spin.mesh.instanceMatrix.needsUpdate = true
  return { statics, spin, lod, tris: parts.tris * n, shadow }
}

/** Advance spinning parts. */
export function updateSpin(spin: SpinGroup, t: number): void {
  const axis = AX[spin.axis]
  for (let i = 0; i < spin.bases.length; i++) {
    SPIN_Q.setFromAxisAngle(axis, t * spin.speed + spin.phase[i])
    M.copy(spin.bases[i])
    // base = T·R·S → apply extra rotation in local space: T·R·Rspin·S
    M.decompose(P, Q, S)
    Q.multiply(SPIN_Q)
    M.compose(P, Q, S)
    spin.mesh.setMatrixAt(i, M)
  }
  spin.mesh.instanceMatrix.needsUpdate = true
}

export function disposeBatch(b: PropBatch): void {
  b.statics.dispose()
  b.spin?.mesh.dispose()
}
