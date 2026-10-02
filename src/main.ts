import './style.css'
import * as THREE from 'three'
import { registerSW } from 'virtual:pwa-register'
import { Renderer, detectTier } from './render/renderer'
import { Game } from './game/game'
import { loadTexture, preload, bootPreloadList, TEXTURES, MATERIALS, type ModelId } from './assets/loader'
import { makeDetailSet } from './render/textures'
import { BIOME_ORDER, PROPS, PICKUPS, HAZARDS, PLANE_LADDER } from './data/registry'
import { sfx } from './audio/sfx'
import { music } from './audio/music'

registerSW({ immediate: true })

const canvas = document.getElementById('scene') as HTMLCanvasElement
const boot = document.getElementById('boot') as HTMLDivElement
const bootFill = document.getElementById('bootFill') as HTMLDivElement
const bootTip = document.getElementById('bootTip') as HTMLDivElement

async function main(): Promise<void> {
  const tier = await detectTier()
  const renderer = new Renderer(canvas, tier)

  // Boot set: textures + the models the first three biomes, all pickups/hazards and the unlocked planes need.
  const modelIds = new Set<ModelId>()
  for (const b of BIOME_ORDER.slice(0, 3)) {
    for (const p of b.props) { const def = PROPS.get(p.prop); if (def && !def.model.startsWith('proc:')) modelIds.add(def.model as ModelId) }
    for (const l of b.landmarks) { const def = PROPS.get(l.prop); if (def && !def.model.startsWith('proc:')) modelIds.add(def.model as ModelId) }
  }
  for (const p of PICKUPS.values()) if (!p.model.startsWith('proc:')) modelIds.add(p.model as ModelId)
  for (const h of HAZARDS.values()) if (!h.model.startsWith('proc:')) modelIds.add(h.model as ModelId)
  for (const p of PLANE_LADDER) if (!p.model.startsWith('proc:')) modelIds.add(p.model as ModelId)

  const texLoads = Promise.all([
    loadTexture(MATERIALS.grass.color, { srgb: true, repeat: true }),
    loadTexture(MATERIALS.grass.normal, { repeat: true }),
    loadTexture(MATERIALS.grass.rough, { repeat: true }),
    loadTexture(MATERIALS.rock.color, { srgb: true, repeat: true }),
    loadTexture(MATERIALS.rock.normal, { repeat: true }),
    loadTexture(MATERIALS.rock.rough, { repeat: true }),
    loadTexture(TEXTURES.waternormals, { repeat: true }),
    loadTexture(TEXTURES.lavatile, { srgb: true, repeat: true }),
    loadTexture(TEXTURES['cloud-noise'], { repeat: true }),
    loadTexture(TEXTURES.lensflare0, { srgb: true }),
    loadTexture(TEXTURES.lensflare3, { srgb: true }),
  ])

  await preload(bootPreloadList([...modelIds]), (p) => {
    bootFill.style.width = `${Math.round(p * 92)}%`
  })
  const [gC, gN, gR, rC, rN, rR, water, lava, noise, flare0, flare3] = await texLoads
  bootFill.style.width = '100%'

  const textures = {
    grass: { color: gC, normal: gN, rough: gR },
    rock: { color: rC, normal: rN, rough: rR },
    sand: makeDetailSet('sand'),
    snow: makeDetailSet('snow'),
    ash: makeDetailSet('ash'),
  }
  const game = new Game({ renderer, textures, waterNormals: water, lavaTex: lava, noiseTex: noise, flare: renderer.quality.lensFlare ? [flare0, flare3] : undefined })
  ;(window as unknown as { __skyfling: unknown }).__skyfling = { stats: () => game.renderStats(), dump: () => game.dumpScene(), game }
  await game.boot()

  // Loop.
  let last = 0
  let running = true
  let rafId = 0
  const frame = (now: number) => {
    if (!running) return
    rafId = requestAnimationFrame(frame)
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
    last = now
    game.frame(dt)
  }
  rafId = requestAnimationFrame(frame)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(rafId)
    } else if (!running) {
      running = true
      last = 0
      rafId = requestAnimationFrame(frame)
    }
  })

  // Dismiss boot on tap (unlocks audio) or after a short delay.
  bootTip.textContent = 'tap to begin'
  bootTip.classList.add('ready')
  const go = () => {
    boot.classList.add('gone')
    window.setTimeout(() => boot.remove(), 650)
    window.removeEventListener('pointerdown', go)
    try {
      sfx.play('ui_tap')
      if (sfx.ctx) music.start(sfx.ctx)
    } catch {
      /* audio optional */
    }
    void game.eco.persistStorage()
  }
  window.addEventListener('pointerdown', go)
  if (location.hash.startsWith('#debug')) window.setTimeout(go, 300)
}

main().catch((err) => {
  console.error(err)
  bootTip.textContent = 'Something went wrong loading. Pull to refresh.'
  bootTip.style.color = '#ff6b4a'
})

export { THREE }
