/**
 * Material library (ARCHITECTURE §7): paint slots for planes, shared glow
 * materials for pickups, and the terrain splat material.
 */

import * as THREE from 'three'
import type { PaintDef } from '../data/define'

export type PaintSlot = 'primary' | 'secondary' | 'accent' | 'canopy'

export interface PaintSet {
  primary: THREE.MeshPhysicalMaterial
  secondary: THREE.MeshPhysicalMaterial
  accent: THREE.MeshPhysicalMaterial
  canopy: THREE.MeshPhysicalMaterial
  metal: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  fabric: THREE.MeshStandardMaterial
  emissive: THREE.MeshStandardMaterial
}

function finish(m: THREE.MeshPhysicalMaterial, f: PaintDef['finish']): void {
  switch (f) {
    case 'matte': m.roughness = 0.85; m.metalness = 0; m.clearcoat = 0; break
    case 'metal': m.roughness = 0.25; m.metalness = 0.9; m.clearcoat = 0.3; break
    case 'pearl': m.roughness = 0.35; m.metalness = 0.2; m.clearcoat = 1; m.clearcoatRoughness = 0.1; m.iridescence = 0.6; m.iridescenceIOR = 1.3; break
    default: m.roughness = 0.42; m.metalness = 0.08; m.clearcoat = 0.8; m.clearcoatRoughness = 0.15
  }
}

export function makePaintSet(paint: Readonly<PaintDef>): PaintSet {
  const mk = (hex: string) => {
    const m = new THREE.MeshPhysicalMaterial({ color: hex })
    finish(m, paint.finish)
    return m
  }
  const canopy = new THREE.MeshPhysicalMaterial({ color: paint.canopy, roughness: 0.05, metalness: 0, transmission: 0.35, thickness: 0.4, ior: 1.4, clearcoat: 1, transparent: true, opacity: 0.9, envMapIntensity: 1.6 })
  return {
    primary: mk(paint.primary),
    secondary: mk(paint.secondary),
    accent: mk(paint.accent),
    canopy,
    metal: new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.3, metalness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.6, metalness: 0.3 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf3ecdf, roughness: 1, metalness: 0, flatShading: true }),
    fabric: new THREE.MeshStandardMaterial({ color: paint.secondary, roughness: 0.95, metalness: 0 }),
    emissive: new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a1a, emissiveIntensity: 2.5, roughness: 0.4 }),
  }
}

/** Apply a paint to a textured GLB: tint the base colour of materials in the slot map, else tint everything lightly. */
export function tintTextured(root: THREE.Object3D, paint: Readonly<PaintDef>, slots?: Record<string, PaintSlot>): void {
  const tint = new THREE.Color(paint.primary)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      const s = mat as THREE.MeshStandardMaterial
      if (!('color' in s)) continue
      const slot = slots?.[mat.name]
      if (slot) {
        s.color.set(slot === 'primary' ? paint.primary : slot === 'secondary' ? paint.secondary : slot === 'accent' ? paint.accent : paint.canopy)
      } else if (s.map) {
        // Gentle tint: keep the texture's detail, push its hue toward the paint.
        s.color.copy(tint).lerp(new THREE.Color(0xffffff), 0.55)
      }
    }
  })
}

/** Emissive glow material for pickups (bloom picks these up). */
export function glowMaterial(hex: string, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.2 })
}

/** Soft additive halo material for rings/thermals. */
export function haloMaterial(hex: string, opacity = 0.35): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
}
