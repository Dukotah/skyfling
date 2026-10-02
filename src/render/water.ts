/**
 * Water and lava (ARCHITECTURE §7). Water uses the three.js Water addon
 * (planar reflection on medium/high) or a cheap animated plane on low; lava is
 * an emissive flowing shader that blooms. One large plane follows the camera
 * and is shown only in biomes that have a water body.
 */

import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
import type { QualitySettings } from './renderer'

export class WaterRig {
  group = new THREE.Group()
  private water: Water | null = null
  private cheap: THREE.Mesh
  private lava: THREE.Mesh
  private lavaMat: THREE.ShaderMaterial
  private sunDir = new THREE.Vector3(0, 1, 0)
  level = -26
  kind: 'water' | 'lava' | 'ice' | 'none' = 'none'
  private opacity = 0

  constructor(quality: QualitySettings, private normals: THREE.Texture, lavaTex: THREE.Texture, noiseTex: THREE.Texture) {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping
    const geo = new THREE.PlaneGeometry(2600, 2600)
    this.cheap = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, normalMap: normals, normalScale: new THREE.Vector2(0.6, 0.6) }),
    )
    this.cheap.rotation.x = -Math.PI / 2
    this.cheap.receiveShadow = true
    this.group.add(this.cheap)

    this.lavaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: lavaTex }, uNoise: { value: noiseTex }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.001 } },
      fog: true,
      vertexShader: /* glsl */ `varying vec2 vUv; varying float vFogDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform sampler2D uTex; uniform sampler2D uNoise; uniform vec3 fogColor; uniform float fogDensity;
        varying vec2 vUv; varying float vFogDepth;
        void main(){
          vec2 uv = vUv * 90.0;
          vec2 n = texture2D(uNoise, uv * 0.07 + vec2(uTime * 0.012, uTime * 0.007)).rg - 0.5;
          vec3 c = texture2D(uTex, uv * 0.35 + n * 0.25 + vec2(0.0, uTime * 0.02)).rgb;
          float glow = smoothstep(0.35, 0.9, c.r);
          vec3 col = mix(vec3(0.18, 0.05, 0.02), vec3(1.0, 0.45, 0.08) * 2.6, glow);
          float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          col = mix(col, fogColor, f);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.lava = new THREE.Mesh(geo, this.lavaMat)
    this.lava.rotation.x = -Math.PI / 2
    this.lava.visible = false
    this.group.add(this.lava)
    this.group.visible = false
    this.setQuality(quality)
  }

  setQuality(q: QualitySettings): void {
    if (q.waterReflection && !this.water) {
      this.water = new Water(new THREE.PlaneGeometry(2600, 2600), {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: this.normals,
        sunDirection: this.sunDir,
        sunColor: 0xffffff,
        waterColor: 0x1f6fa8,
        distortionScale: 2.2,
        fog: true,
      })
      this.water.rotation.x = -Math.PI / 2
      this.group.add(this.water)
    } else if (!q.waterReflection && this.water) {
      this.group.remove(this.water)
      this.water.geometry.dispose()
      this.water = null
    }
  }

  setSun(dir: THREE.Vector3, color: THREE.Color): void {
    this.sunDir.copy(dir)
    if (this.water) {
      const u = this.water.material.uniforms
      u.sunDirection.value.copy(dir)
      u.sunColor.value.copy(color)
    }
  }

  /** Switch body type/level; fades to avoid pops at biome boundaries. */
  set(kind: 'water' | 'lava' | 'ice' | 'none', level: number): void {
    this.kind = kind
    this.level = level
  }

  update(dt: number, camPos: THREE.Vector3, fogColor: THREE.Color, fogDensity: number): void {
    const target = this.kind === 'none' ? 0 : 1
    this.opacity += (target - this.opacity) * Math.min(1, dt * 1.2)
    this.group.visible = this.opacity > 0.02
    if (!this.group.visible) return
    this.group.position.set(camPos.x, this.level, camPos.z - 900)
    const isLava = this.kind === 'lava'
    const isIce = this.kind === 'ice'
    this.lava.visible = isLava
    const useReflective = !!this.water && !isLava && !isIce
    if (this.water) this.water.visible = useReflective
    this.cheap.visible = !isLava && !useReflective
    if (isLava) {
      this.lavaMat.uniforms.uTime.value += dt
      ;(this.lavaMat.uniforms.fogColor.value as THREE.Color).copy(fogColor)
      this.lavaMat.uniforms.fogDensity.value = fogDensity
    } else if (useReflective && this.water) {
      this.water.material.uniforms.time.value += dt * 0.6
      this.water.material.uniforms.waterColor.value.set(isIce ? 0xbfe3ff : 0x1f6fa8)
    } else {
      const m = this.cheap.material as THREE.MeshStandardMaterial
      m.color.set(isIce ? 0xd8ecff : 0x2f7fb8)
      m.roughness = isIce ? 0.08 : 0.15
      m.opacity = 0.92 * this.opacity
      if (m.normalMap) m.normalMap.offset.x += dt * 0.02
    }
  }
}
