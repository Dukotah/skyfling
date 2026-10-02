/**
 * Game orchestrator (ARCHITECTURE §5): owns the renderer, world, plane, UI
 * and systems, and runs the state machine hangar → aim → fly → results.
 * Fixed 60 Hz sim with render interpolation.
 */

import * as THREE from 'three'
import { Renderer, type QualitySettings, type QualityTier } from '../render/renderer'
import { PostStack } from '../render/post'
import { CameraRig } from '../render/camera'
import { AtmosphereRig, blendAtmosphere, applyNight } from '../render/atmosphere'
import { ParticlePool, Precipitation } from '../render/particles'
import { WaterRig } from '../render/water'
import { WorldView } from '../render/worldview'
import { SoftWallView } from '../render/softwalls'
import { makeTerrainMaterial, detailKindOf, type TerrainTextures } from '../render/terrain'
import { makeDetailSet } from '../render/textures'
import { buildPlaneRig, setBurner, type PlaneRig } from '../render/planes'
import { Ribbon } from '../render/trails'
import { Juice } from '../render/juice'
import { loadTexture, loadHdr, TEXTURES, MATERIALS } from '../assets/loader'
import { World } from '../world/world'
import { BIOME_ORDER, PROPS, PICKUPS, HAZARDS, SOFTWALLS, UPGRADES, PLANE_LADDER, PAINTS, ACHIEVEMENTS, planeForLevel, type UpgradeId } from '../data/registry'
import type { Atmosphere, BiomeDef } from '../data/define'
import { launch, simStep, groundCheck, distance, gradeLaunch, type FlightState, type FlightInput, type FlightEnv, type PlaneStats, NEUTRAL_ENV } from '../sim/flight'
import { collideStep, magnetPull, type PlaneBody, type Collidable } from '../sim/collide'
import { gateRingHit, GATE_BONUS, breakBonus, type WallInstance } from '../sim/softwalls'
import { Machine, parseHash } from './machine'
import { events, type RunSummary } from './events'
import { newRun, type RunState } from './run'
import { Recorder, decodeRecording, encodeRecording, type Recording, PATH_EVERY } from './recorder'
import { Economy } from './economy'
import { Progress } from './progress'
import { Spawner, type LivePickup, type LiveHazard } from './spawner'
import { freshSeed, seedFromString } from '../world/rng'
import { Controls } from '../ui/controls'
import { Hud } from '../ui/hud'
import { AimScreen } from '../ui/aim'
import { ResultsScreen } from '../ui/results'
import { HangarScreen } from '../ui/hangar'
import { Modals, type SettingsModel } from '../ui/modals'
import { Callouts } from '../ui/callouts'
import { fmt } from '../ui/dom'
import { sfx } from '../audio/sfx'
import { engine as engineAudio } from '../audio/engine'
import { music, type Mood } from '../audio/music'

const FIXED = 1 / 60
const LAUNCH_POS = { x: 0, y: 9, z: 0 }

export interface GameOptions {
  renderer: Renderer
  textures: TerrainTextures
  waterNormals: THREE.Texture
  lavaTex: THREE.Texture
  noiseTex: THREE.Texture
  flare?: [THREE.Texture, THREE.Texture]
}

export class Game {
  // render
  r: Renderer
  scene = new THREE.Scene()
  cam: CameraRig
  post: PostStack
  atmo: AtmosphereRig
  particles: ParticlePool
  precip: Precipitation
  water: WaterRig
  worldView!: WorldView
  wallView!: SoftWallView
  juice: Juice
  terrainMat: ReturnType<typeof makeTerrainMaterial>
  skirt: THREE.Mesh
  // game
  eco = new Economy()
  progress: Progress
  machine: Machine<Game>
  world!: World
  spawner = new Spawner()
  run: RunState | null = null
  stats: PlaneStats
  env: FlightEnv = { ...NEUTRAL_ENV }
  rig: PlaneRig | null = null
  rigGroup = new THREE.Group()
  ghostGroup = new THREE.Group()
  ghost: Recording | null = null
  ghostRig: THREE.Group | null = null
  trails: Ribbon[] = []
  recorder: Recorder | null = null
  prev: { x: number; y: number; z: number; a: number; yaw: number; roll: number } = { x: 0, y: 9, z: 0, a: 0, yaw: 0, roll: 0 }
  acc = 0
  t = 0
  // ui
  controls: Controls
  hud = new Hud()
  aim: AimScreen
  results = new ResultsScreen()
  hangar: HangarScreen
  modals = new Modals()
  callouts = new Callouts()
  // misc
  private wallsInside = new Set<WallInstance>()
  private wallsPassed = new Set<WallInstance>()
  private gatesDone = new Set<WallInstance>()
  private lastBiome = ''
  private blended: Atmosphere
  private nightMode = false
  private tmpV = new THREE.Vector3()
  private fwd = new THREE.Vector3(0, 0, -1)
  private planePos = new THREE.Vector3(0, 9, 0)
  private endTimer = 0
  private pendingEvolve: string | null = null
  private debugStats = false
  private autopilot = false
  private thermalOn = false
  private rollT = 0
  private loopCooldown = 0
  private bootDone = false
  private offs: Array<() => void> = []

  constructor(opts: GameOptions) {
    this.r = opts.renderer
    this.cam = new CameraRig(window.innerWidth / window.innerHeight)
    this.post = new PostStack(this.r, this.scene, this.cam.camera)
    this.atmo = new AtmosphereRig(this.r.gl, this.scene, this.r.quality)
    if (opts.flare) this.atmo.enableFlare(opts.flare[0], opts.flare[1])
    this.particles = new ParticlePool(this.r.quality.particles)
    this.scene.add(this.particles.points)
    this.precip = new Precipitation()
    this.scene.add(this.precip.points)
    this.water = new WaterRig(this.r.quality, opts.waterNormals, opts.lavaTex, opts.noiseTex)
    this.scene.add(this.water.group)
    this.terrainMat = makeTerrainMaterial(opts.textures)
    // Horizon skirt: a huge fogged disc below the streamed terrain so the far edge never shows as a line.
    this.skirt = new THREE.Mesh(new THREE.CircleGeometry(6000, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6fb36a, roughness: 1 }))
    this.skirt.position.y = -48
    this.skirt.receiveShadow = false
    this.scene.add(this.skirt)
    this.juice = new Juice(this.cam, this.particles, this.post, this.scene)
    this.scene.add(this.rigGroup, this.ghostGroup, this.spawner.group)
    this.progress = new Progress(this.eco)
    this.stats = this.eco.stats()
    this.blended = { ...BIOME_ORDER[0].atmosphere }
    this.controls = new Controls(this.r.canvas)
    this.aim = new AimScreen(this.r.canvas)
    this.hangar = new HangarScreen({
      buy: (id) => this.buy(id as UpgradeId),
      equipPlane: (id) => { this.eco.equipPlane(id); void this.rebuildPlane(); this.refreshHangar() },
      equipPaint: (id) => { this.eco.equipPaint(id); void this.rebuildPlane(); this.refreshHangar() },
      buyPaint: (id) => { if (this.eco.buyPaint(id)) { sfx.play('buy'); void this.rebuildPlane() } else this.callouts.toast('Not enough coins'); this.refreshHangar() },
      openChest: () => { const c = this.progress.openChest(); if (c > 0) { sfx.play('chest'); this.callouts.bannerShow('DAILY CHEST', c) } this.refreshHangar() },
      fly: () => this.machine.go('aim'),
      settings: () => this.modals.showSettings(true),
      prestige: () => { this.eco.prestige(); this.callouts.show('RE-FOLDED', 'gold'); void this.rebuildPlane(); this.refreshHangar() },
    })
    this.machine = new Machine<Game>(this)
    this.defineStates()
    this.bindUi()
    this.bindEvents()
    this.applySettings()
    this.newWorld(freshSeed())
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('hashchange', () => this.route())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.machine.current === 'fly') this.pause(true)
        engineAudio.stop()
      }
    })
    this.r.onTierChange = (q) => this.onQuality(q)
    this.resize()
  }

  // --- setup ------------------------------------------------------------------
  private newWorld(seed: number): void {
    const luckF = this.stats.luckF
    this.world = new World(seed, BIOME_ORDER, SOFTWALLS, { props: PROPS, pickups: PICKUPS, hazards: HAZARDS }, luckF)
    this.world.plating = this.eco.level('plating')
    this.world.thermalMult = 1.2 + 0.05 * this.eco.level('thermal')
    if (this.worldView) {
      this.worldView.reset()
      this.scene.remove(this.worldView.group)
    }
    this.worldView = new WorldView(this.world, this.terrainMat.material, PROPS, this.r.quality)
    this.worldView.onChunkLive = (c) => void this.spawner.addChunk(c)
    this.worldView.onChunkDrop = (c) => this.spawner.dropChunk(c.index)
    this.scene.add(this.worldView.group)
    if (this.wallView) this.scene.remove(this.wallView.group)
    this.wallView = new SoftWallView(this.world.walls)
    this.scene.add(this.wallView.group)
    this.spawner.reset()
    this.wallsInside.clear()
    this.wallsPassed.clear()
    this.gatesDone.clear()
    this.lastBiome = ''
  }

  /** Debug: force a plane/paint for previews (#debug/hangar?plane=hornet&paint=racer). */
  debugPlane: string | null = null
  debugPaint: string | null = null

  async rebuildPlane(): Promise<void> {
    const def = (this.debugPlane && PLANE_LADDER.find((p) => p.id === this.debugPlane)) || this.eco.plane()
    const paint = (this.debugPaint && PAINTS.get(this.debugPaint)) || this.eco.paint()
    const rig = await buildPlaneRig(def, paint)
    if (this.rig) this.rigGroup.remove(this.rig.group)
    this.rig = rig
    this.rigGroup.add(rig.group)
    for (const t of this.trails) this.scene.remove(t.mesh)
    this.trails = rig.tips.map(() => {
      const rb = new Ribbon(80)
      rb.setColors(this.trailColor(0), this.trailColor(1))
      this.scene.add(rb.mesh)
      return rb
    })
    this.stats = this.eco.stats()
  }

  private trailColor(end: 0 | 1): THREE.ColorRepresentation {
    // Prestige contrail memory: white → mint → coral → gold.
    const p = this.eco.data.prestigeCount
    const palette = [0xffffff, 0x5fd3b5, 0xff6b4a, 0xffd23f, 0xa076ff, 0xffffff]
    return end === 0 ? palette[Math.min(p, 5)] : palette[Math.min(p + 1, 5)]
  }

  async boot(): Promise<void> {
    await this.rebuildPlane()
    this.bootDone = true
    this.route()
  }

  private route(): void {
    const { route, params } = parseHash(location.hash)
    if (route.startsWith('debug/')) {
      this.debugStats = true
      this.modals.showStats(true)
      const what = route.slice(6)
      if (what === 'stats' || what === 'sky') this.machine.go('aim', params)
      else if (what === 'fly') this.machine.go('debug', params)
      else if (what === 'autopilot') { this.autopilot = true; this.eco.data.v4.tutorialDone = true; this.machine.go('aim', params) }
      else if (what === 'results') this.showDebugResults(Number(params.get('dist') || 1234))
      else if (what === 'hangar' || what === 'plane') {
        this.debugPlane = params.get('plane')
        this.debugPaint = params.get('paint')
        this.cam.hangarClose = what === 'plane'
        void this.rebuildPlane().then(() => {
          this.machine.go('hangar')
          if (what === 'plane') { this.hangar.show(false); this.modals.showStats(false) }
        })
      }
      else this.machine.go('aim')
      return
    }
    if (!this.machine.current) this.machine.go(this.eco.data.v4.tutorialDone ? 'aim' : 'aim')
  }

  private showDebugResults(dist: number): void {
    const summary: RunSummary = { seed: 1, distance: dist, coins: 120, coinsBase: 100, bonuses: [{ label: 'Storm broken', coins: 120 }], rings: 3, maxAlt: 80, airtime: 30, perfect: true, landKind: 'land', stormsBroken: [0], bestCombo: 6, newBest: true, prevBest: 900, biomesReached: ['green-meadow'], tricks: 1, nearMisses: 2 }
    this.results.show(summary, { missions: [], achievements: [], total: 240, multiplierNote: null })
    this.machine.go('results')
  }

  resize(): void {
    this.r.resize()
    this.post.resize()
    this.cam.resize(window.innerWidth / window.innerHeight)
  }

  private onQuality(q: QualitySettings): void {
    this.post.applyQuality(q)
    this.atmo.setQuality(q)
    this.water.setQuality(q)
    this.worldView.setQuality(q)
    this.callouts.toast(`Quality: ${q.tier}`)
  }

  // --- settings ---------------------------------------------------------------
  private settingsModel(): SettingsModel {
    const d = this.eco.data
    return { sound: d.settings.soundEnabled, music: d.settings.musicEnabled, haptics: d.settings.hapticsEnabled, invert: d.settings.invertPitch, scheme: d.v4.controlScheme, quality: d.v4.quality, leftHanded: d.v4.leftHanded, largeText: d.v4.largeText, reducedMotion: d.v4.reducedMotion }
  }

  private applySettings(): void {
    const d = this.eco.data
    sfx.muted = !d.settings.soundEnabled
    engineAudio.muted = !d.settings.soundEnabled
    music.enabled = d.settings.musicEnabled
    this.controls.scheme = d.v4.controlScheme
    this.controls.invert = d.settings.invertPitch
    this.controls.leftHanded = d.v4.leftHanded
    this.callouts.haptics = d.settings.hapticsEnabled
    document.body.classList.toggle('large-text', d.v4.largeText)
    document.body.classList.toggle('reduced-motion', d.v4.reducedMotion)
    this.modals.setSettings(this.settingsModel())
    if (d.v4.quality !== 'auto') {
      localStorage.setItem('skyfling.quality', d.v4.quality)
      if (this.r.quality.tier !== d.v4.quality) this.r.applyTier(d.v4.quality as QualityTier)
    } else localStorage.removeItem('skyfling.quality')
  }

  private bindUi(): void {
    this.aim.onRelease = (power, yaw, zoneC) => this.doLaunch(power, yaw, zoneC)
    this.aim.bindHangar(() => this.machine.go('hangar'))
    this.results.bind(
      () => this.afterResults('aim'),
      () => this.afterResults('hangar'),
      () => void this.share(),
    )
    this.hud.pauseBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.pause(true) })
    this.modals.onResume = () => this.pause(false)
    this.modals.onQuit = () => { this.modals.showPause(false); this.endRun('crash', true) }
    this.modals.onSettingsChange = (s) => {
      const d = this.eco.data
      d.settings.soundEnabled = s.sound
      d.settings.musicEnabled = s.music
      d.settings.hapticsEnabled = s.haptics
      d.settings.invertPitch = s.invert
      d.v4.controlScheme = s.scheme
      d.v4.quality = s.quality
      d.v4.leftHanded = s.leftHanded
      d.v4.largeText = s.largeText
      d.v4.reducedMotion = s.reducedMotion
      this.eco.commit()
      this.applySettings()
    }
    this.modals.onExport = () => this.eco.export()
    this.modals.onImport = (code) => { const err = this.eco.import(code); if (!err) { this.applySettings(); void this.rebuildPlane(); this.refreshHangar() } return err }
    this.modals.onReset = () => { this.eco.reset(); this.applySettings(); void this.rebuildPlane(); this.modals.showSettings(false); this.machine.go('hangar'); this.refreshHangar() }
    this.controls.onBoost = (on) => {
      if (this.machine.current !== 'fly' || !this.run) return
      events.emit('boost', { on })
      if (on) sfx.play('boost')
    }
    this.controls.onBoostTap = () => this.trySnapRoll()
  }

  private bindEvents(): void {
    const on = events.on.bind(events)
    this.offs.push(
      on('pickup', (e) => sfx.play((PICKUPS.get(e.kind)?.sfx as Parameters<typeof sfx.play>[0]) ?? 'coin')),
      on('ring', () => sfx.play('ring')),
      on('hazard', (e) => sfx.play(e.shieldAbsorbed ? 'shield' : ((HAZARDS.get(e.kind)?.sfx as Parameters<typeof sfx.play>[0]) ?? 'impact'))),
      on('softwall:break', () => sfx.play('storm_break')),
      on('softwall:enter', (e) => { if (e.kind !== 'thin-air') sfx.play('warn') }),
      on('land', (e) => sfx.play(e.kind === 'crash' ? 'impact' : e.kind === 'splash' ? 'splash' : e.kind === 'bounce' ? 'bounce' : 'land')),
      on('trick', () => sfx.play('roll')),
      on('mission:complete', () => sfx.play('mission')),
      on('achievement', () => sfx.play('mission')),
      on('evolve', () => sfx.play('evolve')),
      on('upgrade', () => sfx.play('buy')),
      on('launch', (e) => { sfx.play('whoosh'); if (e.grade === 'perfect') sfx.play('perfect') }),
      on('biome:enter', (e) => {
        const b = BIOME_ORDER.find((x) => x.id === e.biome)
        if (b) {
          this.callouts.toast(`${b.name} — ${b.tagline}`)
          music.play(b.music as Mood)
        }
      }),
    )
  }

  // --- states ------------------------------------------------------------------
  private defineStates(): void {
    const m = this.machine
    m.define('hangar', {
      enter: () => {
        this.resetPlaneOnPad()
        this.wallView.group.visible = false
        this.cam.setMode('hangar')
        this.hangar.show(true)
        this.refreshHangar()
        this.controls.setEnabled(false)
        this.aim.show(false)
        this.hud.show(false)
        this.results.hide()
        music.play('hangar')
        void loadHdr('venice-sunset').then((t) => { if (this.machine.current === 'hangar') this.atmo.setHdrEnvironment(t) })
      },
      exit: () => { this.hangar.show(false); this.atmo.setHdrEnvironment(null); this.wallView.group.visible = true },
      update: (_g, dt) => this.updateIdle(dt),
    })
    m.define('aim', {
      enter: () => {
        this.resetPlaneOnPad()
        this.cam.setMode('aim')
        this.aim.show(true, this.eco.data.coins, this.eco.data.bestDistance)
        this.hud.show(false)
        this.results.hide()
        this.controls.setEnabled(false)
        music.play(BIOME_ORDER[0].music as Mood)
        if (!this.eco.data.v4.tutorialDone) {
          this.aim.enabled = false
          this.modals.showTutorial(() => { this.eco.data.v4.tutorialDone = true; this.eco.commit(); this.aim.enabled = true })
        }
        if (this.autopilot) setTimeout(() => this.doLaunch(0.85, 0, 0.85), 600)
      },
      exit: () => this.aim.show(false),
      update: (_g, dt) => { this.aim.update(dt); this.updateIdle(dt) },
    })
    m.define('fly', {
      enter: () => {
        this.hud.show(true)
        this.controls.setEnabled(true)
        this.controls.reset()
        this.cam.setMode('chase')
        this.cam.snap()
      },
      exit: () => { this.controls.setEnabled(false); engineAudio.stop() },
      update: (_g, dt) => this.updateFly(dt),
    })
    m.define('results', {
      enter: () => { this.controls.setEnabled(false) },
      update: (_g, dt) => this.updateIdle(dt, true),
    })
    m.define('evolve', {
      enter: () => {
        this.resetPlaneOnPad()
        this.cam.setMode('hangar')
        const def = this.eco.plane()
        this.particles.confetti(0, 12, 0)
        this.modals.showEvolve(def.name, def.trait.blurb, () => this.machine.go('hangar'))
      },
      update: (_g, dt) => this.updateIdle(dt),
    })
    m.define('debug', {
      enter: (_g, params) => {
        // Free-fly dolly through a biome.
        const biomeId = params.get('biome') ?? 'green-meadow'
        const idx = Math.max(0, BIOME_ORDER.findIndex((b) => b.id === biomeId))
        this.nightMode = params.get('night') === '1'
        const d = idx * 1200 + Number(params.get('at') ?? 500)
        this.debugPos.set(Number(params.get('x') ?? 0), 0, -d)
        this.debugPos.y = this.world.heightAt(this.debugPos.x, this.debugPos.z) + Number(params.get('alt') ?? 45)
        this.debugSpeed = Number(params.get('speed') ?? 18)
        this.hud.show(false)
        this.aim.show(false)
        this.cam.setMode('fly-debug')
        this.rigGroup.visible = params.get('plane') !== '0'
      },
      update: (_g, dt) => this.updateDebugFly(dt),
    })
  }
  private debugPos = new THREE.Vector3()
  private debugSpeed = 18

  private resetPlaneOnPad(): void {
    this.planePos.set(LAUNCH_POS.x, LAUNCH_POS.y, LAUNCH_POS.z)
    this.prev = { x: LAUNCH_POS.x, y: LAUNCH_POS.y, z: LAUNCH_POS.z, a: 0, yaw: 0, roll: 0 }
    this.run = null
    this.rigGroup.visible = true
    this.ghostGroup.visible = false
    for (const t of this.trails) { t.setEmitting(false); t.clear() }
    this.spawner.reset()
    this.worldView.reset()
    this.wallsInside.clear()
    this.wallsPassed.clear()
    this.gatesDone.clear()
    this.endTimer = 0
    this.newWorld(freshSeed())
  }

  private refreshHangar(): void {
    const eco = this.eco
    const total = eco.totalLevel()
    this.hangar.set({
      coins: eco.data.coins,
      totalLevel: total,
      plane: eco.plane(),
      nextPlane: eco.nextPlane(),
      upgrades: [...UPGRADES.values()].map((def) => ({ def, level: eco.level(def.id), cost: eco.cost(def.id), affordable: eco.canBuy(def.id) })),
      planes: PLANE_LADDER.map((def) => ({ def, unlocked: def.unlockAt <= total, equipped: def.id === eco.plane().id })),
      paints: [...PAINTS.values()].map((def) => ({ def, unlocked: eco.paintUnlocked(def), equipped: def.id === eco.paint().id, costText: eco.paintCostText(def) })),
      missions: eco.data.v4.missions.map((s) => { const d = this.progress.describe(s); return { id: s.id, text: d.text, progress: s.progress, target: s.target, reward: d.reward, done: s.done, icon: d.icon } }),
      chest: { ready: this.progress.chestReady(), streak: this.progress.chestStreakNext(), nextIn: this.progress.untilMidnight(), preview: this.progress.chestPreview() },
      achievements: [...ACHIEVEMENTS.values()].map((def) => ({ def, done: !!eco.data.v4.achievements[def.id], progress: this.progress.achievementProgress(def.stat) })),
      title: this.progress.currentTitle(),
      best: eco.data.bestDistance,
      flights: eco.data.lifetimeFlights,
      prestige: eco.data.prestigeCount,
      canPrestige: eco.canPrestige(),
    })
  }

  private buy(id: UpgradeId): void {
    const evolved = this.eco.buy(id)
    if (!evolved && !this.eco.canBuy(id) && this.eco.level(id) < 10) this.callouts.toast('Not enough coins')
    this.stats = this.eco.stats()
    this.refreshHangar()
    if (evolved) {
      void this.rebuildPlane().then(() => this.machine.go('evolve'))
    }
  }

  pause(on: boolean): void {
    if (this.machine.current !== 'fly') return
    this.machine.pause(on)
    this.modals.showPause(on)
    if (on) engineAudio.stop()
    else engineAudio.start(sfx.ctx ?? undefined)
  }

  // --- launch ------------------------------------------------------------------
  private doLaunch(power: number, yaw: number, zoneC: number): void {
    if (this.machine.current !== 'aim' || !this.rig) return
    const grade = gradeLaunch(power, zoneC, this.eco.data.v4.perfectStreak)
    this.eco.data.v4.perfectStreak = grade.streak
    this.stats = this.eco.stats()
    const fs = launch(this.stats, Math.max(0.5, power), { mult: grade.mult, yaw: -yaw * 0.35 })
    const seed = this.world.seed
    this.run = newRun(seed, this.eco.plane().id, fs)
    this.run.launchGrade = grade.grade
    this.run.stats.pstreak = grade.grade === 'perfect' ? grade.streak : 0
    this.recorder = new Recorder(seed, this.run.plane, power, grade.mult)
    this.prev = { x: fs.x, y: fs.y, z: fs.z, a: fs.a, yaw: fs.yaw, roll: fs.roll }
    this.acc = 0
    this.endTimer = 0
    this.thermalOn = false
    // Ghost.
    this.ghost = this.eco.data.v4.ghost ? decodeRecording(this.eco.data.v4.ghost) : null
    this.setupGhost()
    for (const t of this.trails) { t.clear(); t.setEmitting(true) }
    this.machine.go('fly')
    events.emit('run:start', { seed, plane: this.run.plane })
    events.emit('launch', { power, grade: grade.grade, streak: grade.streak })
    engineAudio.start(sfx.ctx ?? undefined)
    if (grade.grade === 'perfect') this.eco.bump('perfects', 1)
  }

  private setupGhost(): void {
    this.ghostGroup.clear()
    this.ghostRig = null
    if (!this.ghost || this.ghost.path.length < 6 || !this.rig) { this.ghostGroup.visible = false; return }
    const g = this.rig.group.clone(true)
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial
        const gm = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.28, depthWrite: false })
        void mat
        m.material = gm
        m.castShadow = false
      }
    })
    this.ghostRig = g
    this.ghostGroup.add(g)
    this.ghostGroup.visible = true
  }

  // --- fly update --------------------------------------------------------------
  private input: FlightInput = {}
  private body: PlaneBody = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, r: 1.2, noseLen: 2 }
  private collideOut = { hits: [] as Collidable[], nearMisses: [] as Collidable[] }

  private updateFly(dtReal: number): void {
    const run = this.run
    if (!run) return
    const dt = dtReal * this.juice.timeScale
    if (run.ended) {
      this.endTimer += dtReal
      this.animateRig(1)
      this.updateWorld(dtReal)
      if (this.endTimer > 1.7) this.finishRun()
      return
    }
    this.acc += dt
    let steps = 0
    while (this.acc >= FIXED && steps < 5 && !run.ended) {
      this.stepSim(FIXED)
      this.acc -= FIXED
      steps++
    }
    const alpha = Math.min(1, this.acc / FIXED)
    this.animateRig(alpha)
    this.updateWorld(dtReal)
    // HUD
    const fs = run.flight
    const d = distance(fs)
    const warn = this.nextWallWarning(d)
    this.hud.update({
      distance: d,
      best: this.eco.data.bestDistance,
      coins: Math.round(run.coinsRaw * this.stats.coinMult),
      speed: fs.s,
      fuelFrac: fs.fuel / Math.max(0.001, this.stats.fuel),
      shields: fs.shield,
      combo: run.combo,
      mult: run.mult,
      multT: run.multT,
      warning: warn,
      missions: this.eco.data.v4.missions.map((s) => { const dsc = this.progress.describe(s); return { text: dsc.text, progress: this.progress.liveProgress(s, run.stats), target: s.target, done: s.done } }),
      ghostDelta: this.ghostDelta(),
      biome: this.lastBiome,
    })
    this.controls.setNitro(fs.nitro / Math.max(0.01, this.stats.nitro0), fs.nitro > 0.01)
    const thr = (fs.fuel > 0 ? 0.55 : 0) + (fs.boosting ? 0.45 : 0)
    engineAudio.update(thr, fs.s)
  }

  private nextWallWarning(d: number): string | null {
    for (const w of this.world.walls) {
      if (w.kind === 'thin-air') continue
      const ahead = w.at - d
      if (ahead > 0 && ahead < 220 && !this.wallsPassed.has(w)) return SOFTWALLS.get(w.kind)?.warning ?? null
    }
    return null
  }

  private stepSim(dt: number): void {
    const run = this.run!
    const fs = run.flight
    this.prev = { x: fs.x, y: fs.y, z: fs.z, a: fs.a, yaw: fs.yaw, roll: fs.roll }
    let input = this.autopilot ? this.autopilotInput(fs) : this.controls.input(dt, this.input)
    input = this.recorder!.push(input)
    // Environment.
    const inside = this.world.envAt(fs.x, fs.y, fs.z, this.env, this.eco.plane().trait.id === 'GROUND_EFFECT')
    const wasBoosting = fs.boosting
    simStep(fs, dt, input, this.stats, this.env)
    this.recorder!.sample(fs.x, fs.y, fs.z)
    run.t += dt
    run.stats.air = run.t
    if (fs.boosting) run.stats.boostT += dt
    if (fs.boosting !== wasBoosting && !input.boost) events.emit('boost', { on: false })
    // Timers.
    if (run.multT > 0) { run.multT -= dt; if (run.multT <= 0) run.mult = 1 }
    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 0 }
    if (run.invuln > 0) run.invuln -= dt
    if (this.loopCooldown > 0) this.loopCooldown -= dt
    if (this.rollT > 0) this.rollT -= dt
    // Loop trick: pitch through near-vertical.
    if (fs.a > 1.25 && this.loopCooldown <= 0) {
      this.loopCooldown = 3
      const coins = Math.round(20 * (1 + 0.1 * this.eco.level('trick')))
      this.award(coins)
      run.stats.tricks++
      run.invuln = Math.max(run.invuln, 0.5 + 0.05 * this.eco.level('trick'))
      events.emit('trick', { kind: 'loop', coins, nearMiss: false })
    }
    // Thermal feedback.
    const inThermal = this.env.thermalLift > 0.5
    if (inThermal && !this.thermalOn) { run.stats.therms++; events.emit('thermal', { on: true }); sfx.play('thermal') }
    if (!inThermal && this.thermalOn) events.emit('thermal', { on: false })
    this.thermalOn = inThermal
    // Soft walls: enter / break.
    for (const w of inside) {
      if (!this.wallsInside.has(w)) {
        this.wallsInside.add(w)
        if (w.kind !== 'headwind-gate') events.emit('softwall:enter', { kind: w.kind, index: w.index })
      }
    }
    const d = distance(fs)
    for (const w of this.world.walls) {
      if (this.wallsPassed.has(w)) continue
      if (w.kind === 'thin-air') continue
      if (d > w.at + w.depth / 2) {
        this.wallsPassed.add(w)
        if (w.kind === 'headwind-gate') {
          if (!this.gatesDone.has(w)) this.gateMiss(w)
          continue
        }
        if (fs.s > 6 && fs.alive && this.wallsInside.has(w)) {
          const first = w.kind === 'storm-front' && !this.eco.data.v4.stormsBrokenFirst.includes(w.index)
          const bonus = breakBonus(w.kind, w.index) * (first ? 2 : 1)
          if (first) this.eco.data.v4.stormsBrokenFirst.push(w.index)
          if (w.kind === 'storm-front') { run.broken.push(w.index); run.stats.broke++ }
          run.bonuses.push({ label: `${SOFTWALLS.get(w.kind)?.banner ?? 'BROKEN'} ${w.kind === 'storm-front' ? '#' + (w.index + 1) : ''}`, coins: bonus })
          this.wallView.markBroken(w)
          events.emit('softwall:break', { kind: w.kind, index: w.index, first, bonus })
        }
      } else if (w.kind === 'headwind-gate' && !this.gatesDone.has(w) && Math.abs(-fs.z - w.at) < Math.max(3, fs.s * dt * 1.5)) {
        const ring = gateRingHit(fs.x, fs.y, w)
        if (ring >= 0) {
          this.gatesDone.add(w)
          fs.s *= GATE_BONUS[ring]
          if (ring === 0) { fs.nitro = this.stats.nitro0; run.stats.gatesPerfect++ }
          events.emit('ring', { kind: 'gate', tier: ring, pos: { x: fs.x, y: fs.y, z: fs.z } })
          if (ring === 0) events.emit('softwall:break', { kind: 'headwind-gate', index: w.index, first: false, bonus: 0 })
          sfx.play('gate')
        }
      }
    }
    // Collisions.
    this.body.x = fs.x; this.body.y = fs.y; this.body.z = fs.z
    this.body.fx = -Math.sin(fs.yaw) * Math.cos(fs.a); this.body.fy = Math.sin(fs.a); this.body.fz = -Math.cos(fs.yaw) * Math.cos(fs.a)
    const L = this.rig?.length ?? 6
    this.body.r = L * 0.17
    this.body.noseLen = L * 0.45
    // Magnet.
    this.spawner.hash.near(fs.z, this.stats.magnet + 10, (o) => {
      if ('mesh' in o && (o as LivePickup).def.magnetic) {
        if (magnetPull(o, this.body, this.stats.magnet + (this.sonicCone() ? 6 : 0), dt)) {
          const lp = o as LivePickup
          lp.y = o.y
        }
      }
    })
    collideStep(this.spawner.hash, this.body, this.collideOut)
    for (const o of this.collideOut.hits) {
      if ('mesh' in o) this.onPickup(o as LivePickup)
      else this.onHazard(o as LiveHazard)
    }
    for (const o of this.collideOut.nearMisses) {
      run.stats.near++
      run.comboT = 1.2
      run.combo++
      this.award(2)
      events.emit('nearmiss', { kind: o.kind })
    }
    // Stats.
    run.stats.dist = d
    run.stats.alt = Math.max(run.stats.alt, fs.y - this.world.heightAt(fs.x, fs.z))
    // Biome.
    const sample = this.world.biomeAt(d)
    if (sample.biome !== this.lastBiome) {
      this.lastBiome = sample.biome
      if (!run.biomes.includes(sample.biome)) run.biomes.push(sample.biome)
      run.stats.biomeIdx = sample.segment + 1
      events.emit('biome:enter', { biome: sample.biome, distance: d })
    }
    // Ground.
    const gy = this.world.heightAt(fs.x, fs.z)
    const surface = this.world.surfaceAt(fs.x, fs.z)
    const slope = this.world.slopeAt(fs.x, fs.z)
    const wasGround = fs.onGround
    const g = groundCheck(fs, { groundY: gy, slope, water: surface === 'water' || surface === 'ice', lava: surface === 'lava' })
    if (g.kind === 'crash') {
      if (this.eco.plane().trait.id === 'REBIRTH_GLIDE' && !run.revived) {
        run.revived = true
        fs.alive = true
        fs.s = Math.max(20, this.stats.launch * 0.6)
        fs.a = 0.35
        fs.y = gy + 6
        run.invuln = 2
        events.emit('callout', { text: 'REBIRTH', kind: 'gold' })
        this.particles.confetti(fs.x, fs.y, fs.z)
      } else this.endRun('crash')
    } else if (g.kind === 'splash') {
      this.endRun('splash')
    } else if (g.kind === 'bounce') {
      run.stats.shieldsUsed++
      events.emit('land', { kind: 'bounce', distance: d, bullseye: 0, pos: { x: fs.x, y: fs.y, z: fs.z } })
      events.emit('shield', { remaining: fs.shield })
    } else if (g.kind === 'touch' && !wasGround) {
      this.particles.dust(fs.x, fs.y, fs.z, 8)
    } else if (g.kind === 'land' || (fs.onGround && fs.s <= 1.01)) {
      this.endRun('land')
    }
    // Autopilot ends quickly for the harness.
    if (this.autopilot && run.t > 40) this.endRun('land')
  }

  private sonicCone(): boolean {
    return this.eco.plane().trait.id === 'SONIC_CONE' && !!this.run && this.run.flight.s > this.stats.stall * 2
  }

  private autopilotInput(fs: FlightState): FlightInput {
    const alt = fs.y - this.world.heightAt(fs.x, fs.z)
    return { pitch: alt < 25 ? 1 : -0.35, steer: Math.sin(fs.z * 0.01) * 0.3, boost: fs.nitro > 0.05 }
  }

  private trySnapRoll(): void {
    const run = this.run
    if (!run || this.machine.current !== 'fly' || this.rollT > 0) return
    const fs = run.flight
    if (Math.abs(fs.roll) < 0.3 && this.eco.plane().trait.id !== 'SNAP_ROLL') return
    if (fs.nitro < 0.08) return
    fs.nitro -= 0.08
    this.rollT = 0.45
    run.invuln = Math.max(run.invuln, 0.5 + 0.05 * this.eco.level('trick'))
    const coins = Math.round(8 * (1 + 0.1 * this.eco.level('trick')))
    this.award(coins)
    run.stats.tricks++
    events.emit('trick', { kind: 'barrel', coins, nearMiss: run.comboT > 0 })
  }

  private award(coins: number): void {
    const run = this.run!
    run.coinsRaw += coins * run.mult
  }

  private onPickup(o: LivePickup): void {
    const run = this.run!
    const fs = run.flight
    this.spawner.consume(o)
    const e = o.def.effect
    const pos = { x: o.x, y: o.y, z: o.z }
    switch (e.type) {
      case 'coins': this.award(e.amount); run.stats.coins += e.amount; break
      case 'speed': fs.s += e.amount; if (e.nitro) fs.nitro = Math.min(1, fs.nitro + e.nitro); run.stats.rings++; events.emit('ring', { kind: o.def.id === 'golden-ring' ? 'golden' : 'boost', tier: 0, pos }); break
      case 'fuel': fs.fuel += e.seconds; run.stats.cans++; break
      case 'nitro': fs.nitro = Math.min(1, fs.nitro + e.amount); break
      case 'shield': fs.shield += e.amount; events.emit('shield', { remaining: fs.shield }); break
      case 'multiplier': run.mult = Math.max(run.mult, e.factor); run.multT = e.seconds; run.stats.stars++; if (o.def.id === 'golden-ring') { run.stats.rings++; events.emit('ring', { kind: 'golden', tier: 0, pos }) } break
      case 'bounce': fs.s *= e.speed; fs.a = Math.max(fs.a, e.pitch); run.stats.balloons++; break
      case 'fountain': this.award(e.coins); run.stats.coins += e.coins; for (let i = 0; i < 12; i++) this.particles.emit(o.x, o.y, o.z, Math.random() * 8 - 4, 6 + Math.random() * 6, Math.random() * 8 - 4, 1, 0xffd23f, 1, 0, 9); break
      case 'thermal': return
    }
    run.combo++
    run.comboT = 1.2
    run.stats.bestCombo = Math.max(run.stats.bestCombo, run.combo)
    if (run.combo >= 3) run.comboBonus += run.combo
    events.emit('pickup', { kind: o.def.id, value: 1, pos })
    if (run.combo >= 2) events.emit('combo', { count: run.combo, bonus: run.comboBonus })
  }

  private onHazard(h: LiveHazard): void {
    const run = this.run!
    const fs = run.flight
    if (run.invuln > 0 || !h.active) return
    const e = h.def.effect
    const pos = { x: h.x, y: h.y, z: h.z }
    if (fs.shield > 0) {
      fs.shield--
      run.stats.shieldsUsed++
      run.invuln = 1
      events.emit('hazard', { kind: h.def.id, shieldAbsorbed: true, pos })
      events.emit('shield', { remaining: fs.shield })
      return
    }
    switch (e.type) {
      case 'slow': fs.s *= h.def.id === 'bird' || h.def.id === 'seagull' || h.def.id === 'toucan' ? this.stats.birdHit : e.factor; break
      case 'crash': fs.alive = false; this.endRun('crash'); break
      case 'push': fs.x += e.x; fs.y += e.y; break
      case 'burn': fs.fuel = Math.max(0, fs.fuel - e.fuel); fs.s *= e.slow; break
    }
    run.combo = 0
    run.invuln = 0.8
    if (h.def.moveSpeed) h.dead = true
    events.emit('hazard', { kind: h.def.id, shieldAbsorbed: false, pos })
  }

  private gateMiss(w: WallInstance): void {
    this.gatesDone.add(w)
    events.emit('softwall:fail', { kind: 'headwind-gate', index: w.index })
  }

  private endRun(kind: 'land' | 'splash' | 'crash', quit = false): void {
    const run = this.run
    if (!run || run.ended) return
    run.ended = true
    run.endKind = kind
    const fs = run.flight
    const d = distance(fs)
    run.stats.dist = d
    if (kind !== 'crash') run.stats.landPast = d
    const bullseye = kind === 'land' && fs.s < 12 ? (Math.abs(fs.a) < 0.15 ? 3 : 1) : 0
    this.cam.setMode(kind === 'crash' ? 'crash' : 'land', new THREE.Vector3(fs.x, fs.y, fs.z))
    for (const t of this.trails) t.setEmitting(false)
    engineAudio.stop()
    music.setDuck(kind === 'crash' ? 0.35 : 0.7)
    if (!quit) events.emit('land', { kind, distance: d, bullseye, pos: { x: fs.x, y: fs.y, z: fs.z } })
    this.endTimer = quit ? 2 : 0
  }

  private finishRun(): void {
    const run = this.run!
    const eco = this.eco
    const fs = run.flight
    const d = Math.round(distance(fs))
    const prevBest = eco.data.bestDistance
    const newBest = d > prevBest
    // Coins.
    const coinsBase = Math.round(run.coinsRaw * this.stats.coinMult)
    const bonuses = [...run.bonuses]
    if (run.endKind === 'land') bonuses.push({ label: fs.s < 12 && Math.abs(fs.a) < 0.15 ? 'Bullseye landing' : 'Clean landing', coins: 25 })
    if (run.endKind === 'splash') bonuses.push({ label: 'Splashdown', coins: 15 })
    if (run.comboBonus > 0) bonuses.push({ label: `Combo bonus (×${run.stats.bestCombo})`, coins: run.comboBonus })
    if (newBest && prevBest > 0) bonuses.push({ label: `+${fmt(d - prevBest)} m past best`, coins: Math.round((d - prevBest) * 0.1) })
    let total = coinsBase + bonuses.reduce((a, b) => a + b.coins, 0)
    const pm = eco.data.prestigeCoinMultiplier
    total = Math.round(total * pm)
    eco.addCoins(total)
    // Lifetime stats.
    eco.data.lifetimeFlights++
    eco.data.lifetimeDistance += d
    eco.bump('flights', 1)
    eco.bump('distanceTotal', d)
    eco.setMax('bestDist', d)
    eco.bump('stormsBroken', run.broken.length)
    eco.bump('thermals', run.stats.therms)
    eco.bump('rings', run.stats.rings)
    eco.bump('balloons', run.stats.balloons)
    eco.bump('nearMisses', run.stats.near)
    eco.bump('tricks', run.stats.tricks)
    eco.bump('boostSeconds', run.stats.boostT)
    eco.setMax('maxAlt', run.stats.alt)
    eco.setMax('bestCombo', run.stats.bestCombo)
    eco.bump('fuelCans', run.stats.cans)
    eco.bump('stars', run.stats.stars)
    eco.bump('gatesPerfect', run.stats.gatesPerfect)
    if (run.endKind === 'land') eco.bump('cleanLandings', 1)
    if (run.endKind === 'splash') eco.bump('splashdowns', 1)
    if (run.endKind === 'crash') eco.bump('crashes', 1)
    for (const b of run.biomes) if (!eco.data.v4.biomesReached.includes(b)) eco.data.v4.biomesReached.push(b)
    eco.data.v4.lifetime.biomesReached = eco.data.v4.biomesReached.length
    if (newBest) {
      eco.data.bestDistance = d
      if (this.recorder) eco.data.v4.ghost = encodeRecording(this.recorder.finish(d))
    }
    const missions = this.progress.settleRun(run.stats)
    const achievements = this.progress.checkAchievements()
    eco.commit()
    const summary: RunSummary = {
      seed: run.seed, distance: d, coins: total, coinsBase, bonuses, rings: run.stats.rings, maxAlt: run.stats.alt, airtime: run.t, perfect: run.launchGrade === 'perfect',
      landKind: run.endKind ?? 'land', stormsBroken: run.broken, bestCombo: run.stats.bestCombo, newBest, prevBest, biomesReached: run.biomes, tricks: run.stats.tricks, nearMisses: run.stats.near,
    }
    events.emit('run:end', summary)
    this.results.show(summary, { missions, achievements, total, multiplierNote: pm > 1 ? `Prestige ×${pm.toFixed(1)} applied` : null })
    // Evolve check happens when leaving results.
    this.pendingEvolve = planeForLevel(eco.totalLevel()).id !== eco.plane().id && eco.data.v4.equippedPlaneId === null ? planeForLevel(eco.totalLevel()).id : null
    music.setDuck(1)
    this.machine.go('results')
  }

  private afterResults(next: 'aim' | 'hangar'): void {
    this.results.hide()
    if (this.pendingEvolve) {
      this.pendingEvolve = null
      void this.rebuildPlane().then(() => this.machine.go('evolve'))
      return
    }
    this.machine.go(next)
  }

  private async share(): Promise<void> {
    const d = this.eco.data.bestDistance
    const text = `I flew ${fmt(d)} m in Skyfling ✈️`
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 720
      canvas.height = 1280
      const g = canvas.getContext('2d')!
      g.drawImage(this.r.canvas, 0, 0, 720, 1280)
      const grd = g.createLinearGradient(0, 700, 0, 1280)
      grd.addColorStop(0, 'rgba(20,27,46,0)')
      grd.addColorStop(1, 'rgba(20,27,46,0.9)')
      g.fillStyle = grd
      g.fillRect(0, 700, 720, 580)
      g.fillStyle = '#fff'
      g.font = 'bold 110px Bungee, sans-serif'
      g.textAlign = 'center'
      g.fillText(`${fmt(d)} m`, 360, 1040)
      g.font = '600 32px Rubik, sans-serif'
      g.fillText('SKYFLING — fling, fly, evolve', 360, 1110)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (blob && navigator.share) {
        const file = new File([blob], 'skyfling.png', { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ text, files: [file] }); return }
        await navigator.share({ text })
        return
      }
      if (blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'skyfling.png'
        a.click()
      }
    } catch {
      this.callouts.toast('Share not available')
    }
  }

  // --- rendering helpers -------------------------------------------------------
  private ghostDelta(): number | null {
    if (!this.ghost || !this.run) return null
    const i = Math.min(this.ghost.path.length / 3 - 1, Math.floor(this.recorder!.steps / PATH_EVERY))
    if (i < 0) return null
    const gz = this.ghost.path[i * 3 + 2]
    return Math.round(-this.run.flight.z - -gz)
  }

  private animateRig(alpha: number): void {
    const run = this.run
    const rig = this.rig
    if (!rig) return
    const fs = run?.flight
    if (!fs) return
    const p = this.prev
    const x = p.x + (fs.x - p.x) * alpha
    const y = p.y + (fs.y - p.y) * alpha
    const z = p.z + (fs.z - p.z) * alpha
    const a = p.a + (fs.a - p.a) * alpha
    const yaw = p.yaw + (fs.yaw - p.yaw) * alpha
    let roll = p.roll + (fs.roll - p.roll) * alpha
    if (this.rollT > 0) roll += (1 - this.rollT / 0.45) * Math.PI * 2
    this.planePos.set(x, y, z)
    this.fwd.set(-Math.sin(yaw) * Math.cos(a), Math.sin(a), -Math.cos(yaw) * Math.cos(a)).normalize()
    const g = rig.group
    g.position.copy(this.planePos)
    const up = this.tmpV.set(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(this.fwd, up).normalize()
    const up2 = new THREE.Vector3().crossVectors(right, this.fwd).normalize().applyAxisAngle(this.fwd, roll)
    const zAxis = new THREE.Vector3().crossVectors(this.fwd, up2)
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.fwd, up2, zAxis))
    // Prop + burners + trails.
    if (rig.prop && !rig.mixer) rig.prop.rotation.x += fs.s * 0.04 + 0.2
    if (rig.prop) {
      const disc = rig.prop.getObjectByName('disc') as THREE.Mesh | undefined
      if (disc) (disc.material as THREE.MeshBasicMaterial).opacity = Math.min(0.35, fs.s / 120)
    }
    rig.mixer?.update(FIXED)
    const power = fs.boosting ? 1 : fs.thrusting ? 0.45 : 0
    for (const b of rig.burners) setBurner(b, power, this.t)
    g.updateMatrixWorld(true)
    this.trails.forEach((t, i) => {
      const tip = rig.tips[i].clone().applyMatrix4(g.matrixWorld)
      t.width = fs.boosting ? 0.3 : 0.16
      t.update(FIXED, tip, this.cam.camera.position)
    })
    // Ghost.
    if (this.ghostRig && this.ghost && this.recorder) {
      const path = this.ghost.path
      const i = Math.floor(this.recorder.steps / PATH_EVERY)
      if (i * 3 + 5 < path.length) {
        const f = (this.recorder.steps % PATH_EVERY) / PATH_EVERY
        const gx = path[i * 3] + (path[i * 3 + 3] - path[i * 3]) * f
        const gy = path[i * 3 + 1] + (path[i * 3 + 4] - path[i * 3 + 1]) * f
        const gz = path[i * 3 + 2] + (path[i * 3 + 5] - path[i * 3 + 2]) * f
        this.ghostRig.position.set(gx, gy, gz)
        this.ghostRig.lookAt(path[i * 3 + 3], path[i * 3 + 4], path[i * 3 + 5])
        this.ghostRig.rotateY(-Math.PI / 2)
        this.ghostRig.visible = true
      } else this.ghostRig.visible = false
    }
  }

  /** World streaming, atmosphere blend, water, precipitation, spawner animation, soft walls. */
  private updateWorld(dt: number): void {
    const z = this.planePos.z
    const d = -z
    this.worldView.update(dt, z, this.cam.camera.position)
    this.spawner.update(dt, z)
    this.wallView.update(dt, z, this.cam.camera.position)
    const { a, b, t } = this.world.terrain.blendAt(d)
    const atmA = this.nightMode ? applyNight(a.atmosphere, a.night) : a.atmosphere
    const atmB = this.nightMode ? applyNight(b.atmosphere, b.night) : b.atmosphere
    blendAtmosphere(atmA, atmB, t, this.blended)
    const groundTint = new THREE.Color(a.palette.groundLow).lerp(new THREE.Color(b.palette.groundLow), t)
    this.skirt.position.x = this.cam.camera.position.x
    this.skirt.position.z = this.cam.camera.position.z
    ;(this.skirt.material as THREE.MeshStandardMaterial).color.copy(groundTint).multiplyScalar(0.85)
    this.atmo.apply(this.blended, dt, this.cam.camera.position, this.planePos, groundTint)
    this.post.setExposure(this.blended.exposure * 0.5)
    this.post.grade.setGrade(this.blended.gradeShadow ? new THREE.Color(this.blended.gradeShadow) : null, this.blended.gradeHighlight ? new THREE.Color(this.blended.gradeHighlight) : null, this.blended.gradeShadow ? 0.35 : 0)
    this.terrainMat.setGround(detailKindOf(a), detailKindOf(b), t)
    this.terrainMat.uniforms.uCamPos.value.copy(this.cam.camera.position)
    const biome: Readonly<BiomeDef> = t < 0.5 ? a : b
    const W = biome.terrain
    this.water.set(W.water ? (W.waterKind ?? 'water') : 'none', W.waterLevel ?? -26)
    this.water.setSun(this.atmo.sunDir, this.atmo.sun.color)
    this.water.update(dt, this.cam.camera.position, this.atmo.fog.color, this.atmo.fog.density)
    this.precip.set(this.blended.precipitation ?? 'none')
    this.precip.update(dt, this.cam.camera.position, this.env.sidePush)
    this.particles.update(dt)
    this.juice.update(dt)
    // Thermal particles.
    if (this.thermalOn && this.run) {
      const fs = this.run.flight
      for (let i = 0; i < 2; i++) this.particles.emit(fs.x + (Math.random() - 0.5) * 8, fs.y - 6 + Math.random() * 4, fs.z + (Math.random() - 0.5) * 8, 0, 8, 0, 0.9, 0xfff1b8, 0.8, 1.5, 0)
    }
    // Camera.
    const fs = this.run?.flight
    this.cam.update(dt, { pos: this.planePos, fwd: this.fwd, speed: fs?.s ?? 0, roll: fs?.roll ?? 0, boosting: fs?.boosting ?? false })
  }

  private updateIdle(dt: number, keepPlane = false): void {
    // Hero plane on the pad: slow spin/bob (hangar/aim) or stay where it landed (results).
    if (this.rig && !keepPlane) {
      const g = this.rig.group
      g.position.set(0, 9.6 + Math.sin(this.t * 1.2) * 0.25, 0)
      g.rotation.set(0, this.machine.current === 'hangar' ? this.t * 0.4 : -0.35 + Math.sin(this.t * 0.5) * 0.1, Math.sin(this.t * 0.9) * 0.05)
      this.planePos.copy(g.position)
      this.fwd.set(0, 0, -1)
      if (this.rig.prop && !this.rig.mixer) this.rig.prop.rotation.x += 0.25
      this.rig.mixer?.update(dt)
      for (const b of this.rig.burners) setBurner(b, 0.2, this.t)
      g.updateMatrixWorld(true)
      for (const tr of this.trails) tr.update(dt, this.planePos, this.cam.camera.position)
    }
    this.updateWorld(dt)
  }

  private updateDebugFly(dt: number): void {
    this.debugPos.z -= this.debugSpeed * dt
    const gy = this.world.heightAt(this.debugPos.x, this.debugPos.z)
    this.debugPos.y += (gy + 45 - this.debugPos.y) * Math.min(1, dt)
    this.planePos.copy(this.debugPos)
    this.fwd.set(0, -0.08, -1).normalize()
    if (this.rig) {
      const g = this.rig.group
      g.position.copy(this.debugPos).add(new THREE.Vector3(0, -6, -14))
      g.rotation.set(0, Math.PI / 2, 0)
      g.updateMatrixWorld(true)
      if (this.rig.prop && !this.rig.mixer) this.rig.prop.rotation.x += 0.4
      for (const b of this.rig.burners) setBurner(b, 0.5, this.t)
      this.trails.forEach((t, i) => { t.setEmitting(true); t.update(dt, this.rig!.tips[i].clone().applyMatrix4(g.matrixWorld), this.cam.camera.position) })
    }
    this.updateWorld(dt)
  }

  // --- frame ---------------------------------------------------------------------
  frame(dt: number): void {
    this.t += dt
    this.r.beginFrame()
    this.machine.update(dt)
    if (!this.bootDone) return
    this.post.render(dt)
    const lowered = this.r.endFrame(dt * 1000)
    if (lowered) this.callouts.toast(`Quality lowered to ${this.r.quality.tier}`)
    if (this.debugStats) {
      const s = this.r.stats()
      this.modals.setStats(`${s.fps.toFixed(0)} fps  ${s.ms.toFixed(1)} ms\ncalls ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k\ntier ${s.tier}  dpr ${s.dpr.toFixed(2)}  ${s.width}×${s.height}\nchunks ${this.worldView.liveCount}  state ${this.machine.current}\nd ${fmt(-this.planePos.z)}  alt ${fmt(this.planePos.y - this.world.heightAt(this.planePos.x, this.planePos.z))}`)
    }
  }

  renderStats() {
    return this.r.stats()
  }

  /** Debug: visible draw-call candidates grouped by a label (name or geometry type). */
  dumpScene(): Record<string, number> {
    const out: Record<string, number> = {}
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!(m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) || !o.visible) return
      let p: THREE.Object3D | null = o
      let vis = true
      while (p) { if (!p.visible) vis = false; p = p.parent }
      if (!vis) return
      const mats = Array.isArray(m.material) ? m.material.length : 1
      const key = `${o.name || o.type}:${(m.geometry as THREE.BufferGeometry)?.type ?? ''}${(m as THREE.InstancedMesh).isInstancedMesh ? ':inst' : ''}${m.castShadow ? ':shadow' : ''}`
      out[key] = (out[key] ?? 0) + mats
    })
    return out
  }

  /** Weekly challenge seed helper (kept for the weekly mode). */
  static weeklySeed(): number {
    return seedFromString(`week-${Math.floor(Date.now() / 604800000)}`)
  }
}

export { loadTexture, TEXTURES, MATERIALS, makeDetailSet }
