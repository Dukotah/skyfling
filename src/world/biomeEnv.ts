/**
 * Skyfling world — per-zone atmosphere.
 *
 * Owns everything that makes a band of distance *feel* like its own place:
 *   - a gradient sky dome (zenith → horizon) recoloured per biome,
 *   - exponential distance fog recoloured + re-densified per biome,
 *   - sun + hemisphere lighting that warms/cools per biome,
 *   - an infinite water plane that shows through coastal/oasis valleys.
 *
 * Everything cross-fades smoothly using the same `bandAt` sequence the terrain
 * uses, so sky, ground and fog always change together — that synchronised
 * transition is the thing that reads as "cohesive levels".
 */

import * as THREE from 'three'
import { bandAt, type BandInfo } from './terrain'
import type { Biome } from '../data/biomes'
import { WATER_Y } from '../sim/flight'
import { damp } from '../util/math'

/** Fog density per biome id (denser = murkier/closer horizon). */
const FOG_DENSITY: Record<number, number> = {
  1: 0.0013, // meadow — airy
  2: 0.0016, // canyon — dusty
  3: 0.0012, // coast — clear
  4: 0.0024, // dunes — hazy
  5: 0.0017, // alpine
  8: 0.0021, // neon city — smoggy night
}

const skyVertex = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragment = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float exponent;
  varying vec3 vWorldDir;
  void main() {
    float h = clamp((vWorldDir.y + 0.08) / 1.08, 0.0, 1.0);
    float t = pow(h, exponent);
    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
  }
`

export class BiomeEnv {
  private sky: THREE.Mesh
  private skyMat: THREE.ShaderMaterial
  private water: THREE.Mesh
  private waterMat: THREE.MeshStandardMaterial
  private fog: THREE.FogExp2
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight

  // Working colours (lerp targets vs current, damped for silky transitions).
  private curTop = new THREE.Color()
  private curBot = new THREE.Color()
  private curWater = new THREE.Color()
  private curSky = new THREE.Color()
  private curGround = new THREE.Color()
  private tTop = new THREE.Color()
  private tBot = new THREE.Color()
  private tWater = new THREE.Color()
  private tmp = new THREE.Color()
  private curDensity: number
  private curSunI = 2.6

  constructor(scene: THREE.Scene, sun: THREE.DirectionalLight) {
    this.sun = sun

    // --- Gradient sky dome ---
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color('#a8d8ea') },
        bottomColor: { value: new THREE.Color('#c8e6c9') },
        exponent: { value: 0.7 },
      },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 16), this.skyMat)
    this.sky.frustumCulled = false
    scene.add(this.sky)

    // --- Fog ---
    const first = bandAt(0)
    this.curDensity = FOG_DENSITY[first.cur.id] ?? 0.0016
    this.fog = new THREE.FogExp2(first.cur.fogColor, this.curDensity)
    scene.fog = this.fog

    // --- Water ---
    this.waterMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1b7fc4'),
      roughness: 0.25,
      metalness: 0.2,
      transparent: true,
      opacity: 0.82,
    })
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), this.waterMat)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.y = WATER_Y
    this.water.frustumCulled = false
    scene.add(this.water)

    // --- Lights ---
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.55)
    scene.add(this.hemi)

    // Seed current colours from the first biome so frame 0 looks right.
    this.curTop.set(first.cur.skyColor)
    this.curBot.set(first.cur.fogColor)
    this.curWater.set(first.cur.waterColor ?? '#1b7fc4')
    this.curSky.set(first.cur.skyColor)
    this.curGround.set(first.cur.groundColor)
    this.applyColors()
  }

  /** Blend a biome colour field across the current band fade into `out`. */
  private blend(out: THREE.Color, info: BandInfo, pick: (b: Biome) => string, fallback: string): void {
    out.set(pick(info.cur) || fallback)
    if (info.blend > 0) {
      this.tmp.set(pick(info.next) || fallback)
      out.lerp(this.tmp, info.blend)
    }
  }

  update(distance: number, px: number, pz: number, dt: number): void {
    const info = bandAt(distance)

    // Targets for this instant.
    this.blend(this.tTop, info, (b) => b.skyColor, '#a8d8ea')
    this.blend(this.tBot, info, (b) => b.fogColor, '#c8e6c9')
    this.blend(this.tWater, info, (b) => b.waterColor ?? '', '#1b7fc4')
    const targetDensity =
      (FOG_DENSITY[info.cur.id] ?? 0.0016) * (1 - info.blend) + (FOG_DENSITY[info.next.id] ?? 0.0016) * info.blend
    // Warm, bright sun high in the sky; dimmer/cooler when the biome sun is low.
    const sunElev = info.cur.sunElevation * (1 - info.blend) + info.next.sunElevation * info.blend
    const targetSunI = 1.4 + sunElev * 1.8

    // Damp toward the targets so crossings glide instead of snapping.
    const k = Math.min(1, dt * 2.5)
    this.curTop.lerp(this.tTop, k)
    this.curBot.lerp(this.tBot, k)
    this.curWater.lerp(this.tWater, k)
    this.curDensity = damp(this.curDensity, targetDensity, 2.5, dt)
    this.curSunI = damp(this.curSunI, targetSunI, 2.5, dt)
    this.applyColors()

    // Follow the plane so sky + sea never run out.
    this.sky.position.set(px, 0, pz)
    this.water.position.set(px, WATER_Y, pz)
  }

  private applyColors(): void {
    this.skyMat.uniforms.topColor.value.copy(this.curTop)
    this.skyMat.uniforms.bottomColor.value.copy(this.curBot)
    this.fog.color.copy(this.curBot)
    this.fog.density = this.curDensity
    this.waterMat.color.copy(this.curWater)
    this.sun.intensity = this.curSunI
    this.sun.color.copy(this.curTop).lerp(new THREE.Color('#fff2d8'), 0.6)
    this.hemi.color.copy(this.curTop)
    this.hemi.groundColor.copy(this.curBot)
  }

  dispose(): void {
    this.sky.geometry.dispose()
    this.skyMat.dispose()
    this.water.geometry.dispose()
    this.waterMat.dispose()
  }
}
