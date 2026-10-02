/**
 * Typed event bus (ARCHITECTURE §4). Lives in `core/` — a leaf layer every
 * other layer may import. Everything reactive (missions, achievements, audio,
 * juice, HUD, results, recorder) subscribes here. Systems never call each
 * other directly.
 */

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export type LaunchGradeName = 'perfect' | 'good' | 'none'
export type LandKind = 'land' | 'splash' | 'crash' | 'bounce'

export interface RunSummary {
  seed: number
  distance: number
  coins: number
  coinsBase: number
  bonuses: Array<{ label: string; coins: number }>
  rings: number
  maxAlt: number
  airtime: number
  perfect: boolean
  landKind: LandKind
  stormsBroken: number[]
  bestCombo: number
  newBest: boolean
  prevBest: number
  biomesReached: string[]
  tricks: number
  nearMisses: number
}

export type GameEvents = {
  'run:start': { seed: number; plane: string }
  launch: { power: number; grade: LaunchGradeName; streak: number }
  pickup: { kind: string; value: number; pos: Vec3Like }
  ring: { kind: 'boost' | 'golden' | 'gate'; tier: number; pos: Vec3Like }
  hazard: { kind: string; shieldAbsorbed: boolean; pos: Vec3Like }
  'softwall:enter': { kind: string; index: number }
  'softwall:break': { kind: string; index: number; first: boolean; bonus: number }
  'softwall:fail': { kind: string; index: number }
  'biome:enter': { biome: string; distance: number }
  combo: { count: number; bonus: number }
  nearmiss: { kind: string }
  trick: { kind: 'barrel' | 'loop'; coins: number; nearMiss: boolean }
  shield: { remaining: number }
  land: { kind: LandKind; distance: number; bullseye: number; pos: Vec3Like }
  'run:end': RunSummary
  coins: { total: number; delta: number }
  upgrade: { id: string; level: number }
  evolve: { from: string; to: string }
  'mission:complete': { id: string; reward: number; title: string }
  achievement: { id: string; reward: number; title: string }
  'chest:open': { coins: number; streak: number }
  boost: { on: boolean }
  callout: { text: string; kind: 'gold' | 'mint' | 'coral' | 'white' }
  thermal: { on: boolean }
  'state:enter': { state: string }
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<keyof GameEvents>>>()

  on<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(fn as Handler<keyof GameEvents>)
    return () => this.off(type, fn)
  }

  once<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
    const off = this.on(type, (p) => {
      off()
      fn(p)
    })
    return off
  }

  off<K extends keyof GameEvents>(type: K, fn: Handler<K>): void {
    this.handlers.get(type)?.delete(fn as Handler<keyof GameEvents>)
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type)
    if (!set) return
    for (const fn of [...set]) {
      try {
        ;(fn as Handler<K>)(payload)
      } catch (err) {
        console.error(`[events] handler for ${String(type)} threw`, err)
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

/** The one bus for the running game. Tests create their own. */
export const events = new EventBus()
