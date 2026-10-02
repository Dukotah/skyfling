/**
 * BillboardField: one InstancedMesh of camera-facing quads (one draw call) for
 * storm walls, sandstorm haze and ash. Per-instance position/scale come from
 * the instance matrix, tint from instanceColor; the vertex shader billboards.
 */

import * as THREE from 'three'

const VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vColor;
  void main(){
    vUv = uv;
    vColor = instanceColor;
    vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sx = length(vec3(instanceMatrix[0]));
    float sy = length(vec3(instanceMatrix[1]));
    vec4 mv = center + vec4(position.x * sx, position.y * sy, 0.0, 0.0);
    gl_Position = projectionMatrix * mv;
  }`
const FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform float uOpacity; uniform vec3 fogColor; uniform float fogDensity;
  varying vec2 vUv; varying vec3 vColor;
  void main(){
    float a = texture2D(uMap, vUv).a * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }`

export class BillboardField {
  mesh: THREE.InstancedMesh
  private mat: THREE.ShaderMaterial
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private p = new THREE.Vector3()
  private s = new THREE.Vector3()
  private c = new THREE.Color()

  constructor(map: THREE.Texture, count: number, opacity = 0.85) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uOpacity: { value: opacity }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, count)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    this.mesh.frustumCulled = false
  }

  set(i: number, x: number, y: number, z: number, w: number, h: number, color: THREE.ColorRepresentation): void {
    this.p.set(x, y, z)
    this.s.set(w, h, 1)
    this.m.compose(this.p, this.q, this.s)
    this.mesh.setMatrixAt(i, this.m)
    this.c.set(color)
    this.mesh.setColorAt(i, this.c)
  }

  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  set opacity(v: number) {
    this.mat.uniforms.uOpacity.value = v
  }
  get opacity(): number {
    return this.mat.uniforms.uOpacity.value as number
  }
}
