/**
 * Soft-wall visuals (GDD §5): storm fronts as dense dark cloud-sprite walls
 * with lightning flashes and a rain curtain; sandstorm as a tall tan haze
 * band; ash cloud as dark grey; crosswind as drifting arrow streaks; thin air
 * as a faint shimmer line; wind gates as three concentric rings.
 */

import * as THREE from 'three'
import type { WallInstance } from '../sim/softwalls'
import { makeCloudSprite } from './textures'
import { glowMaterial, haloMaterial } from './materials'
import { BillboardField } from './billboards'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export interface WallVisual {
  wall: WallInstance
  group: THREE.Group
  flashT: number
  lightMat: THREE.SpriteMaterial | null
  field: BillboardField | null
  /** Set once the player broke it (brighten + thin). */
  broken: boolean
}

export class SoftWallView {
  group = new THREE.Group()
  private visuals = new Map<WallInstance, WallVisual>()
  private cloudTex: THREE.Texture[]
  private t = 0

  constructor(private walls: WallInstance[]) {
    this.cloudTex = [makeCloudSprite(128, 1), makeCloudSprite(128, 2), makeCloudSprite(128, 3)]
  }

  reset(walls: WallInstance[]): void {
    for (const v of this.visuals.values()) this.group.remove(v.group)
    this.visuals.clear()
    this.walls = walls
  }

  /** Build visuals for walls within range of z; drop those far behind. */
  update(dt: number, z: number, camPos: THREE.Vector3): void {
    this.t += dt
    const d = -z
    for (const w of this.walls) {
      const ahead = w.at - d
      const has = this.visuals.has(w)
      if (!has && ahead < 1500 && ahead > -300) this.visuals.set(w, this.build(w))
      if (has && ahead < -400) {
        const v = this.visuals.get(w)!
        this.group.remove(v.group)
        this.visuals.delete(w)
      }
    }
    for (const v of this.visuals.values()) {
      const kind = v.wall.kind
      if (kind === 'storm-front') {
        // Lightning flashes.
        v.flashT -= dt
        if (v.flashT <= 0) {
          v.flashT = 1.2 + Math.random() * 3
          if (v.lightMat) v.lightMat.opacity = 1
        }
        if (v.lightMat && v.lightMat.opacity > 0) v.lightMat.opacity = Math.max(0, v.lightMat.opacity - dt * 4)

      } else if (kind === 'crosswind') {
        v.group.children.forEach((c) => {
          if (c.name === 'arrow') {
            c.position.x += dt * 26
            if (c.position.x > 60) c.position.x -= 120
          }
        })
      } else if (kind === 'headwind-gate') {
        v.group.rotation.z += dt * 0.3
      }
    }
    void camPos
  }

  markBroken(wall: WallInstance): void {
    const v = this.visuals.get(wall)
    if (!v || v.broken) return
    v.broken = true
    if (v.field) v.field.opacity *= 0.45
  }

  private build(w: WallInstance): WallVisual {
    const g = new THREE.Group()
    g.position.set(w.x, 0, -w.at)
    const v: WallVisual = { wall: w, group: g, flashT: 1 + Math.random() * 2, lightMat: null, field: null, broken: false }
    const yMid = (w.yMin + w.yMax) / 2
    switch (w.kind) {
      case 'storm-front': {
        const n = 64
        const field = new BillboardField(this.cloudTex[w.index % 3], n, 0.94)
        const base = w.yMin + 40
        for (let i = 0; i < n; i++) {
          const size = 130 + Math.random() * 150
          const t = Math.random()
          field.set(i, (Math.random() - 0.5) * 1100, base + 20 + t * t * 230, (Math.random() - 0.5) * (w.depth + 60), size, size * 0.62, new THREE.Color().setHSL(0.62, 0.22, 0.17 + Math.random() * 0.1))
        }
        field.commit()
        g.add(field.mesh)
        v.field = field
        // Lightning glow sprite inside the wall.
        v.lightMat = new THREE.SpriteMaterial({ map: this.cloudTex[0], color: 0xdfe9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
        const flash = new THREE.Sprite(v.lightMat)
        flash.scale.set(500, 360, 1)
        flash.position.set((Math.random() - 0.5) * 300, base + 140, 0)
        g.add(flash)
        break
      }
      case 'sandstorm':
      case 'ash-cloud': {
        const n = 60
        const sand = w.kind === 'sandstorm'
        const field = new BillboardField(this.cloudTex[1], n, sand ? 0.75 : 0.9)
        const base = w.yMin + 40
        for (let i = 0; i < n; i++) {
          const size = 160 + Math.random() * 200
          field.set(i, (Math.random() - 0.5) * 1100, base + Math.random() * 230, (Math.random() - 0.5) * (w.depth + 40), size, size * 0.7, sand ? new THREE.Color().setHSL(0.1, 0.55, 0.52 + Math.random() * 0.1) : new THREE.Color().setHSL(0.05, 0.05, 0.2 + Math.random() * 0.1))
        }
        field.commit()
        g.add(field.mesh)
        v.field = field
        break
      }
      case 'crosswind': {
        const cones: THREE.BufferGeometry[] = []
        for (let i = 0; i < 24; i++) {
          const cone = new THREE.ConeGeometry(1.2, 6, 5).rotateZ(-Math.PI / 2)
          cone.translate((Math.random() - 0.5) * 480, w.yMin + 30 + Math.random() * 120, (Math.random() - 0.5) * w.depth)
          cones.push(cone)
        }
        const arrows = new THREE.Mesh(mergeGeometries(cones, false)!, new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0.35, depthWrite: false }))
        arrows.name = 'arrow'
        g.add(arrows)
        break
      }
      case 'thin-air': {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(1200, 6), haloMaterial('#dfe9ff', 0.12))
        line.position.set(0, 400, 0)
        g.add(line)
        break
      }
      case 'headwind-gate': {
        const radii = w.gateRadii ?? [3, 6, 9]
        const colors = ['#ff6b4a', '#ffd23f', '#5fd3b5']
        g.position.y = w.gateY ?? yMid
        radii.forEach((r, i) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.28 + i * 0.1, 10, 48), glowMaterial(colors[i], 1.2))
          g.add(ring)
        })
        g.add(new THREE.Mesh(new THREE.CircleGeometry(radii[2], 40), haloMaterial('#ffffff', 0.08)))
        // Wind arrows pointing at the player (one merged mesh).
        const arrows: THREE.BufferGeometry[] = []
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          const cone = new THREE.ConeGeometry(0.5, 2.4, 5).rotateX(Math.PI / 2)
          cone.translate(Math.cos(a) * (radii[2] + 3), Math.sin(a) * (radii[2] + 3), 4)
          arrows.push(cone)
        }
        g.add(new THREE.Mesh(mergeGeometries(arrows, false)!, haloMaterial('#ffffff', 0.5)))
        break
      }
    }
    this.group.add(g)
    return v
  }
}
