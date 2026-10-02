/**
 * Renderer facade (ARCHITECTURE §7): owns the WebGLRenderer, the quality tier,
 * DPR caps, resize, and exposes stats() for the debug HUD and Playwright.
 */

import * as THREE from 'three'
import { getGPUTier } from 'detect-gpu'

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualitySettings {
  tier: QualityTier
  dpr: number
  shadows: boolean
  shadowMapSize: number
  ao: boolean
  bloomRes: number
  waterReflection: boolean
  propLodScale: number
  particles: number
  hdrEnv: boolean
  lensFlare: boolean
  anisotropy: number
}

export const TIERS: Record<QualityTier, QualitySettings> = {
  low: { tier: 'low', dpr: 1.0, shadows: true, shadowMapSize: 1024, ao: false, bloomRes: 0.5, waterReflection: false, propLodScale: 0.6, particles: 150, hdrEnv: false, lensFlare: false, anisotropy: 2 },
  medium: { tier: 'medium', dpr: 1.25, shadows: true, shadowMapSize: 1536, ao: false, bloomRes: 0.5, waterReflection: false, propLodScale: 0.8, particles: 250, hdrEnv: true, lensFlare: false, anisotropy: 4 },
  high: { tier: 'high', dpr: 1.5, shadows: true, shadowMapSize: 2048, ao: true, bloomRes: 1, waterReflection: true, propLodScale: 1, particles: 300, hdrEnv: true, lensFlare: true, anisotropy: 8 },
}

export interface RenderStats {
  fps: number
  ms: number
  drawCalls: number
  triangles: number
  tier: QualityTier
  dpr: number
  width: number
  height: number
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer
  quality: QualitySettings
  private frameTimes: number[] = []
  private lastStats: RenderStats
  private probeStart = 0
  private probeSlow = 0
  private probeFrames = 0
  onTierChange: ((q: QualitySettings) => void) | null = null
  /** Set by the post stack so stats() reports its own render size. */
  renderScale = 1

  constructor(public canvas: HTMLCanvasElement, tier: QualityTier) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, alpha: false })
    this.gl.outputColorSpace = THREE.SRGBColorSpace
    this.gl.toneMapping = THREE.NoToneMapping // tone mapping happens in the post stack
    this.gl.toneMappingExposure = 1.05
    this.gl.shadowMap.enabled = true
    this.gl.shadowMap.type = THREE.PCFShadowMap
    this.gl.info.autoReset = false
    this.quality = TIERS[tier]
    this.lastStats = { fps: 0, ms: 0, drawCalls: 0, triangles: 0, tier, dpr: this.quality.dpr, width: 0, height: 0 }
    this.applyTier(tier)
  }

  applyTier(tier: QualityTier): void {
    this.quality = TIERS[tier]
    this.gl.shadowMap.type = tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    this.gl.shadowMap.needsUpdate = true
    this.resize()
    this.onTierChange?.(this.quality)
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const dprScale = Number(new URLSearchParams(location.search).get('dpr')) || 1 // debug/harness: render smaller
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dpr) * dprScale
    this.gl.setPixelRatio(dpr)
    this.gl.setSize(w, h, false)
    this.lastStats.width = Math.round(w * dpr)
    this.lastStats.height = Math.round(h * dpr)
    this.lastStats.dpr = dpr
  }

  /** Call once per frame before rendering. */
  beginFrame(): void {
    this.gl.info.reset()
  }

  private lastFrameAt = 0

  /** Call once per frame after rendering. Measures real wall-clock frame time (the game's dt is clamped). Returns true if the tier was lowered. */
  endFrame(_frameMsHint: number): boolean {
    const now0 = performance.now()
    const frameMs = this.lastFrameAt ? Math.min(2000, now0 - this.lastFrameAt) : 16.7
    this.lastFrameAt = now0
    this.frameTimes.push(frameMs)
    if (this.frameTimes.length > 60) this.frameTimes.shift()
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.lastStats.ms = avg
    this.lastStats.fps = avg > 0 ? 1000 / avg : 0
    this.lastStats.drawCalls = this.gl.info.render.calls
    this.lastStats.triangles = this.gl.info.render.triangles
    this.lastStats.tier = this.quality.tier
    // Auto-downgrade: a 3 s probe where >60% of frames are over 20 ms drops a tier (once per probe window).
    const now = performance.now()
    if (!this.probeStart) this.probeStart = now
    this.probeFrames++
    if (frameMs > 20) this.probeSlow++
    if (now - this.probeStart > 3000) {
      const slow = this.probeSlow / Math.max(1, this.probeFrames)
      this.probeStart = now
      this.probeSlow = 0
      this.probeFrames = 0
      if (slow > 0.6 && this.quality.tier !== 'low' && !forcedTier()) {
        this.applyTier(this.quality.tier === 'high' ? 'medium' : 'low')
        return true
      }
    }
    return false
  }

  stats(): RenderStats {
    return { ...this.lastStats }
  }

  dispose(): void {
    this.gl.dispose()
  }
}

function forcedTier(): QualityTier | null {
  const q = new URLSearchParams(location.search).get('quality') ?? localStorage.getItem('skyfling.quality')
  return q === 'low' || q === 'medium' || q === 'high' ? q : null
}

/** Pick the starting tier: URL/setting override, else GPU tier + DPR heuristics. */
export async function detectTier(): Promise<QualityTier> {
  const forced = forcedTier()
  if (forced) return forced
  try {
    const t = await getGPUTier({ benchmarksURL: undefined as unknown as string })
    // detect-gpu: tier 0 (blocked/unknown) … 3 (high). Apple GPUs usually land 2–3.
    if (t.tier >= 3) return 'high'
    if (t.tier === 2) return 'medium'
    if (t.tier === 1) return 'low'
  } catch {
    /* benchmark data unreachable offline: fall through to heuristics */
  }
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (cores >= 6 && mem >= 4) return 'high'
  if (cores >= 4) return 'medium'
  return 'low'
}
