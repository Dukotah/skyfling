/**
 * Post stack (ARCHITECTURE §7): pmndrs postprocessing with one merged
 * EffectPass (bloom on emissives, vignette, a touch of chromatic aberration,
 * a two-tone colour grade, SMAA, ACES tone mapping) and N8AO on the high tier.
 */

import * as THREE from 'three'
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  Effect,
  KernelSize,
} from 'postprocessing'
import { N8AOPostPass } from 'n8ao'
import type { Renderer, QualitySettings } from './renderer'

/** Two-tone grade: tints shadows and highlights toward biome colours. Subtle by design. */
class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform vec3 shadowTint;
      uniform vec3 highlightTint;
      uniform float strength;
      uniform float exposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.1, 0.9, l));
        vec3 graded = c * mix(vec3(1.0), tint * 2.0, strength);
        outputColor = vec4(graded, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, THREE.Uniform>([
          ['shadowTint', new THREE.Uniform(new THREE.Color(0.5, 0.5, 0.5))],
          ['highlightTint', new THREE.Uniform(new THREE.Color(0.5, 0.5, 0.5))],
          ['strength', new THREE.Uniform(0.0)],
          ['exposure', new THREE.Uniform(1.0)],
        ]),
      },
    )
  }
  setGrade(shadow: THREE.Color | null, highlight: THREE.Color | null, strength: number): void {
    const u = this.uniforms
    ;(u.get('shadowTint')!.value as THREE.Color).copy(shadow ?? new THREE.Color(0.5, 0.5, 0.5))
    ;(u.get('highlightTint')!.value as THREE.Color).copy(highlight ?? new THREE.Color(0.5, 0.5, 0.5))
    u.get('strength')!.value = strength
  }
}

export class PostStack {
  composer: EffectComposer
  bloom: BloomEffect
  vignette: VignetteEffect
  aberration: ChromaticAberrationEffect
  grade: GradeEffect
  tone: ToneMappingEffect
  private ao: N8AOPostPass | null = null
  private effectPass: EffectPass
  private aberrationPass: EffectPass
  private smaaPass: EffectPass
  private renderPass: RenderPass
  /** Boost/crash driven aberration amount (0..1). */
  punch = 0

  constructor(private r: Renderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(r.gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 })
    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)
    this.bloom = new BloomEffect({ luminanceThreshold: 1.05, luminanceSmoothing: 0.25, intensity: 0.3, mipmapBlur: true, radius: 0.6, kernelSize: KernelSize.MEDIUM })
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 })
    this.aberration = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.4 })
    this.grade = new GradeEffect()
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
    const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM })
    // Convolution effects (aberration, SMAA) cannot share a pass with the others.
    this.effectPass = new EffectPass(camera, this.bloom, this.grade, this.vignette, this.tone)
    this.aberrationPass = new EffectPass(camera, this.aberration)
    this.smaaPass = new EffectPass(camera, smaa)
    this.composer.addPass(this.effectPass)
    this.composer.addPass(this.aberrationPass)
    this.composer.addPass(this.smaaPass)
    this.applyQuality(r.quality)
  }

  applyQuality(q: QualitySettings): void {
    if (q.ao && !this.ao) {
      this.ao = new N8AOPostPass(this.scene, this.camera, 1, 1)
      this.ao.configuration.aoRadius = 4
      this.ao.configuration.distanceFalloff = 1.5
      this.ao.configuration.intensity = 2.2
      this.ao.configuration.halfRes = true
      this.ao.configuration.screenSpaceRadius = false
      this.composer.removePass(this.effectPass)
      this.composer.removePass(this.aberrationPass)
      this.composer.removePass(this.smaaPass)
      this.composer.addPass(this.ao)
      this.composer.addPass(this.effectPass)
      this.composer.addPass(this.aberrationPass)
      this.composer.addPass(this.smaaPass)
    } else if (!q.ao && this.ao) {
      this.composer.removePass(this.ao)
      this.ao.dispose()
      this.ao = null
    }
    this.resize()
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, this.r.quality.dpr)
    this.composer.setSize(Math.round(w * dpr), Math.round(h * dpr), false)
    this.ao?.setSize(Math.round(w * dpr), Math.round(h * dpr))
  }

  /** Exposure is applied in the grade effect (before tone mapping) so it works regardless of renderer tone-mapping state. */
  setExposure(e: number): void {
    this.grade.uniforms.get('exposure')!.value = e
  }

  render(dt: number): void {
    const base = 0.0006
    this.aberration.offset.set(base + this.punch * 0.004, base + this.punch * 0.004)
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
  }
}
