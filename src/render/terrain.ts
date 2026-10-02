/**
 * Terrain rendering (ARCHITECTURE §7): chunk mesh builder with vertex colours
 * and slope/height weights, and a MeshStandardMaterial extended via
 * onBeforeCompile with triplanar detail blending (ground / rock / snow) and a
 * distance fade so tiling never shows. Water and lava planes live in water.ts.
 */

import * as THREE from 'three'
import type { TerrainSampler } from '../world/terrain'
import { HALF_WIDTH, WATER_Y } from '../world/terrain'
import { CHUNK_LENGTH } from '../world/placement'
import type { BiomeDef } from '../data/define'
import type { DetailSet } from './textures'

export const SEGS_X = 60
export const SEGS_Z = 20

export interface TerrainTextures {
  grass: DetailSet
  rock: DetailSet
  sand: DetailSet
  snow: DetailSet
  ash: DetailSet
}

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()
const tmpC = new THREE.Color()

/** Build one chunk's geometry: positions, normals, vertex colours, and a `weights` attribute (rock, snow, shore). */
export function buildChunkGeometry(terrain: TerrainSampler, index: number): THREE.BufferGeometry {
  const z0 = -index * CHUNK_LENGTH
  const w = HALF_WIDTH * 2
  const geo = new THREE.PlaneGeometry(w, CHUNK_LENGTH, SEGS_X, SEGS_Z)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, z0 - CHUNK_LENGTH / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const colors = new Float32Array(n * 3)
  const weights = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = terrain.heightAt(x, z)
    pos.setY(i, h)
    const d = -z
    const { a, b, t } = terrain.blendAt(d)
    // Slope from finite differences.
    const hx = terrain.heightAt(x + 3, z) - terrain.heightAt(x - 3, z)
    const hz = terrain.heightAt(x, z + 3) - terrain.heightAt(x, z - 3)
    const slope = Math.min(1, Math.hypot(hx, hz) / 6)
    const paletteA = a.palette
    const paletteB = b.palette
    const level = (t < 0.5 ? a : b).terrain.water ? ((t < 0.5 ? a : b).terrain.waterLevel ?? WATER_Y) : -9999
    const snowLine = (t < 0.5 ? a : b).terrain.snowLine ?? 9999
    const relH = h
    const hiFrac = THREE.MathUtils.clamp((relH + 10) / 60, 0, 1)
    tmpA.set(paletteA.groundLow).lerp(tmpC.set(paletteA.groundHigh), hiFrac)
    tmpB.set(paletteB.groundLow).lerp(tmpC.set(paletteB.groundHigh), hiFrac)
    tmpA.lerp(tmpB, t)
    // Micro variation.
    const v = 1 + (Math.sin(x * 0.37 + z * 0.21) + Math.sin(x * 0.11 - z * 0.47)) * 0.025
    const rockW = THREE.MathUtils.smoothstep(slope, 0.45, 0.8)
    let snowW = relH > snowLine ? THREE.MathUtils.clamp((relH - snowLine) / 10, 0, 1) * (1 - rockW * 0.6) : 0
    const shoreW = level > -9000 ? THREE.MathUtils.clamp(1 - Math.abs(h - level - 2) / 4, 0, 1) * (1 - rockW) : 0
    if (paletteA.detail.ground === 'snow') snowW = 0 // tundra: ground IS snow; rock still shows on slopes
    tmpB.set(paletteA.rock).lerp(tmpC.set(paletteB.rock), t)
    tmpA.lerp(tmpB, rockW)
    if (shoreW > 0) tmpA.lerp(tmpC.set(paletteA.shore).lerp(tmpB.set(paletteB.shore), t), shoreW)
    if (snowW > 0) tmpA.lerp(tmpC.set(paletteA.snow ?? '#f4f8ff'), snowW)
    colors[i * 3] = tmpA.r * v
    colors[i * 3 + 1] = tmpA.g * v
    colors[i * 3 + 2] = tmpA.b * v
    weights[i * 3] = rockW
    weights[i * 3 + 1] = snowW
    weights[i * 3 + 2] = shoreW
    void rockW
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('weights', new THREE.BufferAttribute(weights, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export interface TerrainMaterialUniforms {
  uGroundColor: { value: THREE.Texture }
  uGroundNormal: { value: THREE.Texture }
  uRockColor: { value: THREE.Texture }
  uRockNormal: { value: THREE.Texture }
  uSnowColor: { value: THREE.Texture }
  uGround2Color: { value: THREE.Texture }
  uGround2Normal: { value: THREE.Texture }
  uBlend: { value: number }
  uCamPos: { value: THREE.Vector3 }
}

/**
 * One material shared by all chunks. Detail textures are chosen per biome
 * (ground set A → B blend during transitions); vertex colours carry the biome
 * palette so the detail only modulates.
 */
export function makeTerrainMaterial(tex: TerrainTextures): { material: THREE.MeshStandardMaterial; uniforms: TerrainMaterialUniforms; setGround(kindA: keyof TerrainTextures, kindB: keyof TerrainTextures, t: number): void } {
  const uniforms: TerrainMaterialUniforms = {
    uGroundColor: { value: tex.grass.color },
    uGroundNormal: { value: tex.grass.normal },
    uRockColor: { value: tex.rock.color },
    uRockNormal: { value: tex.rock.normal },
    uSnowColor: { value: tex.snow.color },
    uGround2Color: { value: tex.grass.color },
    uGround2Normal: { value: tex.grass.normal },
    uBlend: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 weights; varying vec3 vWeights; varying vec3 vWorldPos; varying vec3 vWorldNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWeights = weights; vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; vWorldNormal = normalize(mat3(modelMatrix) * normal);`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uGroundColor; uniform sampler2D uGroundNormal; uniform sampler2D uRockColor; uniform sampler2D uRockNormal; uniform sampler2D uSnowColor;
        uniform sampler2D uGround2Color; uniform sampler2D uGround2Normal; uniform float uBlend; uniform vec3 uCamPos;
        varying vec3 vWeights; varying vec3 vWorldPos; varying vec3 vWorldNormal;
        vec4 triplanar(sampler2D t, vec3 p, vec3 n, float s) {
          vec3 w = abs(n); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z);
          return texture2D(t, p.yz * s) * w.x + texture2D(t, p.xz * s) * w.y + texture2D(t, p.xy * s) * w.z;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float dist = distance(vWorldPos, uCamPos);
          float detailFade = 1.0 - smoothstep(120.0, 420.0, dist);
          vec3 n = normalize(vWorldNormal);
          float s1 = 0.08; float s2 = 0.011;
          vec3 gA = mix(triplanar(uGroundColor, vWorldPos, n, s1).rgb, triplanar(uGroundColor, vWorldPos, n, s2).rgb, 0.5);
          vec3 gB = mix(triplanar(uGround2Color, vWorldPos, n, s1).rgb, triplanar(uGround2Color, vWorldPos, n, s2).rgb, 0.5);
          vec3 g = mix(gA, gB, uBlend);
          vec3 r = mix(triplanar(uRockColor, vWorldPos, n, s1 * 0.6).rgb, triplanar(uRockColor, vWorldPos, n, s2).rgb, 0.5);
          vec3 sn = triplanar(uSnowColor, vWorldPos, n, s1).rgb;
          vec3 detail = mix(g, r, vWeights.x);
          detail = mix(detail, sn, vWeights.y);
          // Detail as luminance modulation around 1.0 so the vertex palette stays in charge.
          float lum = dot(detail, vec3(0.299, 0.587, 0.114));
          float mod = mix(1.0, 0.4 + lum * 1.15, detailFade);
          diffuseColor.rgb *= mod;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float dist = distance(vWorldPos, uCamPos);
          float detailFade = 1.0 - smoothstep(60.0, 260.0, dist);
          vec3 nrm = normalize(vWorldNormal);
          vec3 tn = mix(triplanar(uGroundNormal, vWorldPos, nrm, 0.08).rgb, triplanar(uRockNormal, vWorldPos, nrm, 0.05).rgb, vWeights.x) * 2.0 - 1.0;
          normal = normalize(normal + tn * 0.35 * detailFade);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'skyfling-terrain'
  const sets: Record<keyof TerrainTextures, DetailSet> = tex
  return {
    material,
    uniforms,
    setGround(kindA, kindB, t) {
      uniforms.uGroundColor.value = sets[kindA].color
      uniforms.uGroundNormal.value = sets[kindA].normal
      uniforms.uGround2Color.value = sets[kindB].color
      uniforms.uGround2Normal.value = sets[kindB].normal
      uniforms.uBlend.value = t
    },
  }
}

export function detailKindOf(b: Readonly<BiomeDef>): keyof TerrainTextures {
  return b.palette.detail.ground
}
