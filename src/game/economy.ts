/**
 * Economy & profile (GDD §7, §11): wraps SaveData — upgrade levels ↔ sim
 * UpgradeLevels, coins, purchases, evolve detection, paints, prestige,
 * settings. Persists to localStorage (save.ts) and mirrors to IndexedDB.
 */

import { load, save, resetProgress, exportCode, importCode, type SaveData, type UpgradeKey } from '../save/save'
import { derivePlaneStats, type UpgradeLevels, type PlaneStats } from '../sim/flight'
import { UPGRADES, PLANE_LADDER, PAINTS, planeForLevel, upgradeCost, type UpgradeId } from '../data/registry'
import type { PlaneDef, PaintDef } from '../data/define'
import { events } from './events'

/** Save upgrade keys ↔ registry/sim ids. */
const KEY: Record<UpgradeId, UpgradeKey> = {
  launcher: 'launcher', wings: 'wings', engine: 'engine', fuel: 'fuelTank', airframe: 'airframe', nitro: 'nitro', armor: 'armor', magnet: 'magnet',
  luck: 'luckyCharm', thermal: 'thermalWings', plating: 'stormPlating', trick: 'trickKit', radar: 'coinRadar',
}

const IDB_NAME = 'skyfling'

export class Economy {
  data: SaveData

  constructor() {
    this.data = load()
    void this.mirrorFromIdb()
  }

  // --- persistence -----------------------------------------------------------
  commit(): void {
    save(this.data)
    void this.mirrorToIdb()
  }

  private async mirrorToIdb(): Promise<void> {
    try {
      const db = await openIdb()
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(JSON.stringify(this.data), 'save')
    } catch {
      /* optional */
    }
  }

  /** If localStorage was wiped but IndexedDB still has a newer save, restore it. */
  private async mirrorFromIdb(): Promise<void> {
    try {
      const db = await openIdb()
      const req = db.transaction('kv', 'readonly').objectStore('kv').get('save')
      const raw = await new Promise<string | undefined>((res, rej) => {
        req.onsuccess = () => res(req.result as string | undefined)
        req.onerror = () => rej(req.error)
      })
      if (!raw) return
      const other = importCode(exportCode(JSON.parse(raw) as SaveData))
      if (other.lifetimeFlights > this.data.lifetimeFlights) {
        this.data = other
        save(this.data)
      }
    } catch {
      /* optional */
    }
  }

  async persistStorage(): Promise<void> {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist()
    } catch {
      /* optional */
    }
  }

  // --- upgrades ----------------------------------------------------------------
  level(id: UpgradeId): number {
    return this.data.upgradeLevels[KEY[id]] ?? 0
  }

  levels(): UpgradeLevels {
    return {
      launcher: this.level('launcher'), wings: this.level('wings'), engine: this.level('engine'), fuel: this.level('fuel'),
      airframe: this.level('airframe'), nitro: this.level('nitro'), armor: this.level('armor'), magnet: this.level('magnet'), luck: this.level('luck'),
    }
  }

  totalLevel(): number {
    let t = 0
    for (const u of UPGRADES.values()) t += this.level(u.id)
    return t
  }

  stats(): PlaneStats {
    const s = derivePlaneStats(this.levels())
    const plane = this.plane()
    const st = plane.trait.stat
    if (st) {
      if (st.fuel) s.fuel *= 1 + st.fuel
      if (st.turn) s.turn *= 1 + st.turn
      if (st.boost) s.boost *= 1 + st.boost
      if (st.glide) s.gr *= 1 + st.glide
      if (st.launch) s.launch *= 1 + st.launch
      if (st.speed) s.drag /= 1 + st.speed
    }
    return s
  }

  cost(id: UpgradeId): number {
    return upgradeCost(this.level(id) + 1)
  }

  canBuy(id: UpgradeId): boolean {
    const def = UPGRADES.get(id)!
    return this.level(id) < def.maxLevel && this.data.coins >= this.cost(id)
  }

  /** Buy one level. Returns the plane evolved into, if any. */
  buy(id: UpgradeId): Readonly<PlaneDef> | null {
    if (!this.canBuy(id)) return null
    const before = planeForLevel(this.totalLevel())
    this.data.coins -= this.cost(id)
    this.data.upgradeLevels[KEY[id]] = this.level(id) + 1
    this.bump('upgradesBought', 1)
    events.emit('upgrade', { id, level: this.level(id) })
    const after = planeForLevel(this.totalLevel())
    this.commit()
    if (after.id !== before.id) {
      this.data.v4.equippedPlaneId = after.id
      this.bump('evolves', 1)
      this.commit()
      events.emit('evolve', { from: before.id, to: after.id })
      return after
    }
    return null
  }

  // --- planes & paints ---------------------------------------------------------------
  plane(): Readonly<PlaneDef> {
    const id = this.data.v4.equippedPlaneId
    const highest = planeForLevel(this.totalLevel())
    const chosen = id ? PLANE_LADDER.find((p) => p.id === id) : null
    if (chosen && chosen.unlockAt <= this.totalLevel()) return chosen
    return highest
  }

  nextPlane(): Readonly<PlaneDef> | null {
    const t = this.totalLevel()
    return PLANE_LADDER.find((p) => p.unlockAt > t) ?? null
  }

  unlockedPlanes(): Readonly<PlaneDef>[] {
    const t = this.totalLevel()
    return PLANE_LADDER.filter((p) => p.unlockAt <= t)
  }

  equipPlane(id: string): void {
    const p = PLANE_LADDER.find((x) => x.id === id)
    if (p && p.unlockAt <= this.totalLevel()) {
      this.data.v4.equippedPlaneId = id
      this.commit()
    }
  }

  paint(): Readonly<PaintDef> {
    return PAINTS.get(this.data.v4.paint) ?? PAINTS.get('classic')!
  }

  paintUnlocked(p: Readonly<PaintDef>): boolean {
    if (this.data.v4.unlockedPaints.includes(p.id)) return true
    switch (p.unlock.kind) {
      case 'free': return true
      case 'achievement': return !!this.data.v4.achievements[p.unlock.id]
      case 'prestige': return this.data.prestigeCount >= p.unlock.level
      default: return false
    }
  }

  paintCostText(p: Readonly<PaintDef>): string {
    switch (p.unlock.kind) {
      case 'coins': return `${p.unlock.cost} coins`
      case 'achievement': return `achievement`
      case 'prestige': return `prestige ${p.unlock.level}`
      default: return ''
    }
  }

  buyPaint(id: string): boolean {
    const p = PAINTS.get(id)
    if (!p || p.unlock.kind !== 'coins' || this.data.coins < p.unlock.cost) return false
    this.data.coins -= p.unlock.cost
    this.data.v4.unlockedPaints.push(id)
    this.data.v4.paint = id
    this.commit()
    return true
  }

  equipPaint(id: string): void {
    const p = PAINTS.get(id)
    if (p && this.paintUnlocked(p)) {
      this.data.v4.paint = id
      this.commit()
    }
  }

  // --- coins & stats -----------------------------------------------------------
  addCoins(n: number): void {
    const d = Math.round(n)
    this.data.coins += d
    this.data.lifetimeCoins += Math.max(0, d)
    this.bump('coinsTotal', Math.max(0, d))
    events.emit('coins', { total: this.data.coins, delta: d })
  }

  bump(stat: string, by: number): number {
    const v = (this.data.v4.lifetime[stat] ?? 0) + by
    this.data.v4.lifetime[stat] = v
    return v
  }

  setMax(stat: string, v: number): number {
    const cur = this.data.v4.lifetime[stat] ?? 0
    if (v > cur) this.data.v4.lifetime[stat] = v
    return Math.max(cur, v)
  }

  lifetime(stat: string): number {
    return this.data.v4.lifetime[stat] ?? 0
  }

  // --- prestige ---------------------------------------------------------------
  canPrestige(): boolean {
    return this.totalLevel() >= 130 && this.data.prestigeCount < 5
  }

  prestige(): void {
    if (!this.canPrestige()) return
    for (const k of Object.keys(this.data.upgradeLevels) as UpgradeKey[]) this.data.upgradeLevels[k] = 0
    this.data.prestigeCount++
    this.data.prestigeCoinMultiplier = 1 + 0.1 * this.data.prestigeCount
    this.data.v4.equippedPlaneId = null
    this.bump('prestiges', 1)
    this.commit()
  }

  // --- codes --------------------------------------------------------------------
  export(): string {
    return exportCode(this.data)
  }

  /** Returns an error message or null. */
  import(code: string): string | null {
    try {
      this.data = importCode(code)
      this.commit()
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  reset(): void {
    this.data = resetProgress()
    this.commit()
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('no idb'))
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
