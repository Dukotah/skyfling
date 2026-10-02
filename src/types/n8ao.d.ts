declare module 'n8ao' {
  import type { Scene, Camera } from 'three'
  import { Pass } from 'postprocessing'
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      halfRes: boolean
      screenSpaceRadius: boolean
      color: import('three').Color
      denoiseSamples: number
      denoiseRadius: number
      aoSamples: number
      gammaCorrection: boolean
    }
    setSize(w: number, h: number): void
    dispose(): void
  }
}
