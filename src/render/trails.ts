/**
 * Ribbon contrails: a camera-facing strip per wingtip with age fade and a tint
 * uniform (prestige contrail memory: white → mint → coral → gold).
 */

import * as THREE from 'three'

export class Ribbon {
  mesh: THREE.Mesh
  private N: number
  private pts: THREE.Vector3[] = []
  private ages: number[] = []
  private pos: Float32Array
  private alpha: Float32Array
  private geo: THREE.BufferGeometry
  private mat: THREE.ShaderMaterial
  private emitting = false
  private tmp = new THREE.Vector3()
  width = 0.16
  life = 1.1

  constructor(n = 90, color = new THREE.Color(0xffffff)) {
    this.N = n
    this.pos = new Float32Array(n * 2 * 3)
    this.alpha = new Float32Array(n * 2)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    const idx: number[] = []
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geo.setIndex(idx)
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: color }, uColor2: { value: color.clone() } },
      vertexShader: /* glsl */ `attribute float aAlpha; varying float vA; varying float vT;
        void main(){ vA = aAlpha; vT = float(gl_VertexID / 2) / ${(n - 1).toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform vec3 uColor2; varying float vA; varying float vT;
        void main(){ gl_FragColor = vec4(mix(uColor, uColor2, vT), vA * 0.32); }`,
    })
    this.mesh = new THREE.Mesh(this.geo, this.mat)
    this.mesh.frustumCulled = false
    for (let i = 0; i < n; i++) {
      this.pts.push(new THREE.Vector3())
      this.ages.push(999)
    }
  }

  setColors(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation): void {
    ;(this.mat.uniforms.uColor.value as THREE.Color).set(a)
    ;(this.mat.uniforms.uColor2.value as THREE.Color).set(b)
  }

  setEmitting(on: boolean): void {
    this.emitting = on
  }

  clear(): void {
    for (let i = 0; i < this.N; i++) this.ages[i] = 999
    this.alpha.fill(0)
    this.geo.attributes.aAlpha.needsUpdate = true
  }

  /** Push the current wingtip world position; call every frame. */
  update(dt: number, tip: THREE.Vector3, camPos: THREE.Vector3): void {
    // Shift history.
    for (let i = this.N - 1; i > 0; i--) {
      this.pts[i].copy(this.pts[i - 1])
      this.ages[i] = this.ages[i - 1] + dt
    }
    this.pts[0].copy(tip)
    this.ages[0] = this.emitting ? 0 : 999
    // Build strip: offset perpendicular to the segment, facing the camera.
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[i]
      const q = this.pts[Math.min(this.N - 1, i + 1)]
      this.tmp.subVectors(q, p)
      const toCam = new THREE.Vector3().subVectors(camPos, p)
      const side = this.tmp.cross(toCam).normalize()
      const age = this.ages[i]
      const a = Math.max(0, 1 - age / this.life)
      const w = this.width * (0.6 + 1.2 * (1 - a))
      const o = i * 6
      this.pos[o] = p.x + side.x * w; this.pos[o + 1] = p.y + side.y * w; this.pos[o + 2] = p.z + side.z * w
      this.pos[o + 3] = p.x - side.x * w; this.pos[o + 4] = p.y - side.y * w; this.pos[o + 5] = p.z - side.z * w
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a * a
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aAlpha.needsUpdate = true
  }
}
