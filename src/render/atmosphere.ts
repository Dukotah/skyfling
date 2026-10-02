/**
 * Atmosphere (ARCHITECTURE §7): Preetham sky + sun + hemisphere + exponential
 * fog + stars/moon + aurora, all driven by a blended Atmosphere record from the
 * two biomes at the current distance. Environment lighting is PMREM'd from the
 * sky itself so reflections always match the biome; an HDRI can override it
 * (hangar).
 */

import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js'
import type { Atmosphere } from '../data/define'
import type { QualitySettings } from './renderer'

const c = (hex: string) => new THREE.Color(hex)

/** Linear blend of two atmosphere records. */
export function blendAtmosphere(a: Atmosphere, b: Atmosphere, t: number, out: Atmosphere): Atmosphere {
  const L = (x: number, y: number) => x + (y - x) * t
  const C = (x: string, y: string) => '#' + c(x).lerp(c(y), t).getHexString()
  out.sunElevation = L(a.sunElevation, b.sunElevation)
  out.sunAzimuth = L(a.sunAzimuth, b.sunAzimuth)
  out.turbidity = L(a.turbidity, b.turbidity)
  out.rayleigh = L(a.rayleigh, b.rayleigh)
  out.mie = L(a.mie, b.mie)
  out.mieG = L(a.mieG, b.mieG)
  out.fog = C(a.fog, b.fog)
  out.fogDensity = L(a.fogDensity, b.fogDensity)
  out.sunColor = C(a.sunColor, b.sunColor)
  out.sunIntensity = L(a.sunIntensity, b.sunIntensity)
  out.hemiSky = C(a.hemiSky, b.hemiSky)
  out.hemiGround = C(a.hemiGround, b.hemiGround)
  out.hemiIntensity = L(a.hemiIntensity, b.hemiIntensity)
  out.cloudCover = L(a.cloudCover, b.cloudCover)
  out.cloudTint = C(a.cloudTint, b.cloudTint)
  out.exposure = L(a.exposure, b.exposure)
  out.night = t < 0.5 ? a.night : b.night
  out.aurora = t < 0.5 ? a.aurora : b.aurora
  out.precipitation = t < 0.5 ? a.precipitation : b.precipitation
  out.gradeShadow = t < 0.5 ? a.gradeShadow : b.gradeShadow
  out.gradeHighlight = t < 0.5 ? a.gradeHighlight : b.gradeHighlight
  return out
}

export function applyNight(base: Atmosphere, night: Partial<Atmosphere> | undefined): Atmosphere {
  return { ...base, ...(night ?? {}) }
}

export class AtmosphereRig {
  sky: Sky
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  fog: THREE.FogExp2
  stars: THREE.Points
  moon: THREE.Sprite
  aurora: THREE.Mesh
  flare: Lensflare | null = null
  sunDir = new THREE.Vector3(0, 1, 0)
  private pmrem: THREE.PMREMGenerator
  private envTarget: THREE.WebGLRenderTarget | null = null
  private envScene = new THREE.Scene()
  private envSky: Sky
  private envGround: THREE.Mesh
  private lastEnvKey = ''
  private envTimer = 0
  private cur: Atmosphere | null = null
  private shadowTarget = new THREE.Object3D()
  private auroraMat: THREE.ShaderMaterial
  private hdrOverride: THREE.Texture | null = null

  constructor(renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private quality: QualitySettings) {
    this.sky = new Sky()
    this.sky.scale.setScalar(50000)
    scene.add(this.sky)

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -90
    this.sun.shadow.camera.right = 90
    this.sun.shadow.camera.top = 90
    this.sun.shadow.camera.bottom = -90
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.6
    scene.add(this.sun)
    scene.add(this.shadowTarget)
    this.sun.target = this.shadowTarget

    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.55)
    scene.add(this.hemi)

    this.fog = new THREE.FogExp2(0xcfe6f7, 0.0011)
    scene.fog = this.fog

    // Stars: a dome of points, only visible at night (opacity driven).
    const N = 1400
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const u = Math.random()
      const v = Math.random()
      const th = 2 * Math.PI * u
      const ph = Math.acos(1 - v) * 0.5 // upper hemisphere, denser near zenith
      const r = 4500
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.cos(ph) + 100
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      const warm = Math.random()
      col[i * 3] = 0.8 + warm * 0.2
      col[i * 3 + 1] = 0.85 + warm * 0.1
      col[i * 3 + 2] = 1
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 9, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }))
    this.stars.frustumCulled = false
    scene.add(this.stars)

    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeMoonTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false }))
    this.moon.scale.setScalar(260)
    scene.add(this.moon)

    this.auroraMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uOpacity; varying vec2 vUv;
        float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          float x = vUv.x * 6.0 + uTime * 0.12;
          float band = sin(x * 1.7) * 0.5 + sin(x * 3.1 + uTime * 0.3) * 0.25 + sin(x * 7.3 - uTime * 0.5) * 0.12;
          float y = vUv.y;
          float curtain = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.55 + band * 0.25, 1.0, y));
          float rays = 0.65 + 0.35 * sin(vUv.x * 140.0 + uTime * 2.0 + band * 10.0);
          vec3 col = mix(vec3(0.35, 0.95, 0.65), vec3(0.6, 0.4, 1.0), smoothstep(0.2, 0.9, y));
          gl_FragColor = vec4(col, curtain * rays * uOpacity * 0.55);
        }`,
    })
    this.aurora = new THREE.Mesh(new THREE.PlaneGeometry(5000, 1400, 1, 1), this.auroraMat)
    this.aurora.position.set(0, 900, -2200)
    this.aurora.visible = false
    scene.add(this.aurora)

    // Environment from the sky: a tiny scene with the sky dome and a ground disc.
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.envSky = new Sky()
    this.envSky.scale.setScalar(5000)
    this.envScene.add(this.envSky)
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(4000, 24), new THREE.MeshBasicMaterial({ color: 0x5a8a4a }))
    this.envGround.rotation.x = -Math.PI / 2
    this.envGround.position.y = -40
    this.envScene.add(this.envGround)
  }

  setQuality(q: QualitySettings): void {
    this.quality = q
    void this.quality
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    if (q.lensFlare && !this.flare) this.enableFlare()
    if (!q.lensFlare && this.flare) {
      this.sun.remove(this.flare)
      this.flare.dispose()
      this.flare = null
    }
  }

  /** Lens flare textures are loaded lazily by the caller (optional). */
  enableFlare(tex0?: THREE.Texture, tex3?: THREE.Texture): void {
    if (!tex0 || !tex3 || this.flare) return
    this.flare = new Lensflare()
    this.flare.addElement(new LensflareElement(tex0, 420, 0, this.sun.color))
    this.flare.addElement(new LensflareElement(tex3, 60, 0.6))
    this.flare.addElement(new LensflareElement(tex3, 70, 0.7))
    this.flare.addElement(new LensflareElement(tex3, 120, 0.9))
    this.flare.addElement(new LensflareElement(tex3, 70, 1.0))
    this.sun.add(this.flare)
  }

  /** Override environment with an HDRI (hangar). Pass null to return to the sky env. */
  setHdrEnvironment(tex: THREE.Texture | null): void {
    this.hdrOverride = tex
    if (tex) this.scene.environment = tex
    this.lastEnvKey = ''
  }

  /** Apply an atmosphere record. Call every frame (cheap) — the PMREM env is only rebuilt when the sky changes enough. */
  apply(a: Atmosphere, dt: number, cameraPos: THREE.Vector3, focus?: THREE.Vector3, groundTint?: THREE.Color): void {
    const shadowAt = focus ?? cameraPos
    this.cur = a
    const el = THREE.MathUtils.degToRad(a.sunElevation)
    const az = THREE.MathUtils.degToRad(a.sunAzimuth)
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize()

    const u = this.sky.material.uniforms
    u.turbidity.value = a.turbidity
    u.rayleigh.value = a.rayleigh
    u.mieCoefficient.value = a.mie
    u.mieDirectionalG.value = a.mieG
    // Keep the sun just above the horizon for the sky shader at night; lights go cool and dim instead.
    const skyEl = Math.max(el, THREE.MathUtils.degToRad(-2))
    u.sunPosition.value.set(Math.cos(skyEl) * Math.sin(az), Math.sin(skyEl), -Math.cos(skyEl) * Math.cos(az))
    this.sky.position.copy(cameraPos)

    const night = a.night || a.sunElevation < 0
    this.sun.color.set(a.sunColor)
    this.sun.intensity = a.sunIntensity
    this.sun.position.copy(shadowAt).addScaledVector(this.sunDir.y < 0.05 ? this.sunDir.clone().setY(0.25).normalize() : this.sunDir, 220)
    this.shadowTarget.position.copy(shadowAt)
    this.hemi.color.set(a.hemiSky)
    this.hemi.groundColor.set(a.hemiGround)
    this.hemi.intensity = a.hemiIntensity
    this.fog.color.set(a.fog)
    this.fog.density = a.fogDensity * 1.4
    this.scene.background = this.fog.color

    const starsOpacity = night ? THREE.MathUtils.clamp((-a.sunElevation + 2) / 10, 0, 1) : 0
    const sm = this.stars.material as THREE.PointsMaterial
    sm.opacity += (starsOpacity - sm.opacity) * Math.min(1, dt * 2)
    this.stars.visible = sm.opacity > 0.01
    this.stars.position.copy(cameraPos)
    const mm = this.moon.material as THREE.SpriteMaterial
    mm.opacity += (starsOpacity * 0.9 - mm.opacity) * Math.min(1, dt * 2)
    this.moon.visible = mm.opacity > 0.01
    this.moon.position.copy(cameraPos).add(new THREE.Vector3(-this.sunDir.x, 0.45, -this.sunDir.z).normalize().multiplyScalar(4200))

    this.aurora.visible = !!a.aurora && (night || a.sunElevation < 20)
    if (this.aurora.visible) {
      this.auroraMat.uniforms.uTime.value += dt
      const target = a.aurora ? 1 : 0
      this.auroraMat.uniforms.uOpacity.value += (target - this.auroraMat.uniforms.uOpacity.value) * Math.min(1, dt)
      this.aurora.position.set(cameraPos.x, 900, cameraPos.z - 2200)
    }

    // Environment map: rebuild when the key changes (throttled to every 0.4 s during blends).
    this.envTimer += dt
    if (!this.hdrOverride) {
      const key = `${a.sunElevation.toFixed(0)}|${a.sunAzimuth.toFixed(0)}|${a.turbidity.toFixed(1)}|${a.fog}|${a.hemiGround}`
      if (key !== this.lastEnvKey && this.envTimer > 0.4) {
        this.lastEnvKey = key
        this.envTimer = 0
        this.rebuildEnv(a, groundTint)
      }
    }
  }

  private rebuildEnv(a: Atmosphere, groundTint?: THREE.Color): void {
    const eu = this.envSky.material.uniforms
    const su = this.sky.material.uniforms
    eu.turbidity.value = su.turbidity.value
    eu.rayleigh.value = su.rayleigh.value
    eu.mieCoefficient.value = su.mieCoefficient.value
    eu.mieDirectionalG.value = su.mieDirectionalG.value
    eu.sunPosition.value.copy(su.sunPosition.value)
    ;(this.envGround.material as THREE.MeshBasicMaterial).color.copy(groundTint ?? new THREE.Color(a.hemiGround))
    const old = this.envTarget
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.02, 1, 3000)
    this.scene.environment = this.envTarget.texture
    this.scene.environmentIntensity = a.night ? 0.3 : 0.6
    old?.dispose()
  }

  get current(): Atmosphere | null {
    return this.cur
  }
}

function makeMoonTexture(): THREE.Texture {
  const s = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const g = cv.getContext('2d')!
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grd.addColorStop(0, 'rgba(255,255,240,1)')
  grd.addColorStop(0.18, 'rgba(255,255,235,1)')
  grd.addColorStop(0.22, 'rgba(230,236,255,0.45)')
  grd.addColorStop(0.6, 'rgba(200,215,255,0.08)')
  grd.addColorStop(1, 'rgba(200,215,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
