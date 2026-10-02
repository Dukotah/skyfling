/**
 * Skyfling flight physics — PURE port of the legacy prototype `simStep`.
 *
 * This module contains NO three.js and NO DOM. Everything here is a pure
 * function over plain data, so the whole flight model is unit-testable and the
 * balance numbers can be locked with vitest (see flight.test.ts).
 *
 * Source of truth for the numbers:
 *   - docs/GDD.md §2 "Flight model"
 *   - legacy/skyfling-v5-prototype.html  (functions stats ~395, simStep ~933,
 *     groundCheck ~949, launch ~1057, biomeAt ~413, groundY ~420)
 *   - legacy/balance-sim.js              (the balance oracle / FINAL P-set)
 *
 * The GDD formulas are reproduced EXACTLY. The one place the GDD and the
 * balance oracle's `mk()` differ (body drag divisor: GDD uses 1 + 0.1·L, the
 * oracle uses 1 + 0.07·L) we follow the GDD, and the test asserts the agreed
 * tolerance windows — both variants land inside them.
 */

import { clamp } from '../util/math'

/** Gravitational constant used by the sim (legacy G = 9.8). */
export const G = 9.8

/** Height of the water plane in the real world (legacy WATER_Y). */
export const WATER_Y = -26

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

/**
 * The nine legacy upgrade tracks, each 0–10.
 *
 * `airframe` is the GDD name for the prototype's `body` track (it drives drag,
 * turn rate and bird-hit resistance). `luck` is the prototype's `luck` track.
 * These two keep their GDD names here; the derivation maps them onto the
 * prototype's internal terms.
 */
export interface UpgradeLevels {
  launcher: number
  wings: number
  engine: number
  fuel: number
  airframe: number
  nitro: number
  armor: number
  magnet: number
  luck: number
}

/** All tracks at level 0 — the stock Paper Dart. */
export const ZERO_LEVELS: UpgradeLevels = {
  launcher: 0,
  wings: 0,
  engine: 0,
  fuel: 0,
  airframe: 0,
  nitro: 0,
  armor: 0,
  magnet: 0,
  luck: 0,
}

/** Build a full UpgradeLevels with every track set to the same level. */
export function uniformLevels(n: number): UpgradeLevels {
  return {
    launcher: n,
    wings: n,
    engine: n,
    fuel: n,
    airframe: n,
    nitro: n,
    armor: n,
    magnet: n,
    luck: n,
  }
}

// ---------------------------------------------------------------------------
// Derived plane stats (GDD §2)
// ---------------------------------------------------------------------------

export interface PlaneStats {
  /** Launch speed at power 1.0, before the perfect-timing multiplier. */
  launch: number
  /** Stall speed; below ~this lift falls off and the nose drops. */
  stall: number
  /** Glide ratio (horizontal : vertical). */
  gr: number
  /** Quadratic drag coefficient. */
  drag: number
  /** Engine thrust while fuel remains. */
  thrust: number
  /** Fuel, in seconds of thrust. */
  fuel: number
  /** Pitch/yaw turn rate. */
  turn: number
  /** Coin magnet radius, metres. */
  magnet: number
  /** Nitro boost acceleration. */
  boost: number
  /** Starting nitro (0–1). */
  nitro0: number
  /** Nitro drain per second while boosting. */
  ndrain: number
  /** Shields at launch. */
  shields: number
  /** Speed multiplier applied on a bird hit (closer to 1 = gentler). */
  birdHit: number
  /** Coin value multiplier. */
  coinMult: number
  /** Rare-spawn multiplier. */
  luckF: number
}

/**
 * Derive PlaneStats from upgrade levels, EXACTLY per GDD §2 (and matching the
 * prototype's `stats()` at line 395).
 *
 *   launch   = 34 + 6.5·launcher
 *   stall    = 14 − 0.6·wings
 *   gr       = 7  + 0.9·wings
 *   drag     = 0.0028 / (1 + 0.08·wings) / (1 + 0.1·airframe)
 *   thrust   = 5  + 2.2·engine
 *   fuel     = 2.5 + 1.4·fuel
 *   turn     = 1.4 + 0.08·airframe
 *   magnet   = 5  + 2.2·magnet
 *   boost    = 16 + 1.2·nitro + 0.5·engine
 *   nitro0   = min(1, 0.4 + 0.06·nitro)
 *   ndrain   = 0.3 / (1 + 0.08·nitro)
 *   shields  = armor ? floor((armor + 2) / 3) : 0   → 0,1,1,1,2,2,2,3,3,3,4
 *   birdHit  = 0.62 + 0.03·airframe
 *   coinMult = 1 + 0.07·luck
 *   luckF    = 1 + 0.1·luck
 */
export function derivePlaneStats(lv: UpgradeLevels): PlaneStats {
  return {
    launch: 34 + 6.5 * lv.launcher,
    stall: 14 - 0.6 * lv.wings,
    gr: 7 + 0.9 * lv.wings,
    drag: 0.0028 / (1 + 0.08 * lv.wings) / (1 + 0.1 * lv.airframe),
    thrust: 5 + 2.2 * lv.engine,
    fuel: 2.5 + 1.4 * lv.fuel,
    turn: 1.4 + 0.08 * lv.airframe,
    magnet: 5 + 2.2 * lv.magnet,
    boost: 16 + 1.2 * lv.nitro + 0.5 * lv.engine,
    nitro0: Math.min(1, 0.4 + 0.06 * lv.nitro),
    ndrain: 0.3 / (1 + 0.08 * lv.nitro),
    shields: lv.armor ? Math.floor((lv.armor + 2) / 3) : 0,
    birdHit: 0.62 + 0.03 * lv.airframe,
    coinMult: 1 + 0.07 * lv.luck,
    luckF: 1 + 0.1 * lv.luck,
  }
}

// ---------------------------------------------------------------------------
// Flight state
// ---------------------------------------------------------------------------

/**
 * The mutable per-flight physics state. Position is in world metres:
 * `z` is forward (distance flown = max(0, −z)), `y` is altitude, `x` is lateral.
 */
export interface FlightState {
  x: number
  y: number
  z: number
  /** Pitch, radians (nose up positive). */
  a: number
  /** Yaw, radians. */
  yaw: number
  /** Visual roll, radians. */
  roll: number
  /** Speed, m/s. */
  s: number
  /** Vertical velocity, m/s (derived each step). */
  vy: number
  /** Fuel remaining, seconds. */
  fuel: number
  /** Nitro remaining, 0–1. */
  nitro: number
  /** Shields remaining. */
  shield: number
  /** True while the plane is touching ground/water. */
  onGround: boolean
  /** False after a hard crash / lava. */
  alive: boolean
  /** True once the run has come to rest (landed or stopped). */
  stopped: boolean
  /** True while the engine is producing thrust this step. */
  thrusting: boolean
  /** True while nitro boost is active this step. */
  boosting: boolean
}

/** Per-step player input. All fields optional so an empty object = no input. */
export interface FlightInput {
  /** Pitch input, −1 (dive) … +1 (climb). */
  pitch?: number
  /** Steer input, −1 … +1. */
  steer?: number
  /** Whether the boost button is held this step. */
  boost?: boolean
}

// ---------------------------------------------------------------------------
// Launch (perfect-timing)  — legacy launch() ~1057
// ---------------------------------------------------------------------------

/** Half-width of the gold "perfect" zone on the power bar (legacy ZHW). */
export const ZONE_HALF_WIDTH = 0.055

/** Centre of the moving gold zone at time `t` (legacy zoneC). */
export function zoneCenter(t: number): number {
  return 0.8 + 0.14 * Math.sin(t * 2.1)
}

export type LaunchGrade = 'perfect' | 'good' | 'none'

export interface LaunchResult {
  grade: LaunchGrade
  /** Speed multiplier applied to the launch speed. */
  mult: number
  /** New perfect streak after this launch. */
  streak: number
}

/**
 * Grade a launch from how close `power` landed to the gold zone centre.
 *
 *   perfect: |power − center| ≤ ZHW           → ×(1.16 + 0.04·min(streak−1, 4))
 *   good:    |power − center| ≤ 2.4·ZHW        → ×1.06, streak reset
 *   none:    otherwise                          → ×1.0, streak reset
 *
 * `prevStreak` is the player's perfect streak coming in (0 if none).
 */
export function gradeLaunch(power: number, center: number, prevStreak = 0): LaunchResult {
  const dz = Math.abs(power - center)
  if (dz <= ZONE_HALF_WIDTH) {
    const streak = (prevStreak || 0) + 1
    const mult = 1.16 + 0.04 * Math.min(streak - 1, 4)
    return { grade: 'perfect', mult, streak }
  }
  if (dz <= ZONE_HALF_WIDTH * 2.4) {
    return { grade: 'good', mult: 1.06, streak: 0 }
  }
  return { grade: 'none', mult: 1, streak: 0 }
}

/** Default launch position: top of the cliff (legacy LAUNCH {0,9,0}). */
export const LAUNCH_POS = { x: 0, y: 9, z: 0 } as const

/** Default launch pitch angle (legacy aimParams ang = 0.42). */
export const LAUNCH_PITCH = 0.42

export interface LaunchOptions {
  /** Launch pitch angle, radians (default LAUNCH_PITCH). */
  angle?: number
  /** Launch yaw, radians (default 0). */
  yaw?: number
  /** Launch-speed multiplier from perfect timing (default 1 = no bonus). */
  mult?: number
  /** Override the starting position (defaults to LAUNCH_POS). */
  pos?: { x: number; y: number; z: number }
}

/**
 * Build a fresh FlightState for a launch.
 *
 * `power` is the normalized draw on the slingshot (0–1). Launch speed is
 *   max(6, stats.launch · power · mult)   (legacy launch()).
 * Pass `mult` from gradeLaunch() for the perfect-timing bonus; it defaults to 1.
 */
export function launch(stats: PlaneStats, power: number, opts: LaunchOptions = {}): FlightState {
  const pos = opts.pos ?? LAUNCH_POS
  const mult = opts.mult ?? 1
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    a: opts.angle ?? LAUNCH_PITCH,
    yaw: opts.yaw ?? 0,
    roll: 0,
    s: Math.max(6, stats.launch * power * mult),
    vy: 0,
    fuel: stats.fuel,
    nitro: stats.nitro0,
    shield: stats.shields,
    onGround: false,
    alive: true,
    stopped: false,
    thrusting: false,
    boosting: false,
  }
}

// ---------------------------------------------------------------------------
// Step  — legacy simStep() ~933
// ---------------------------------------------------------------------------

/**
 * Lift factor: 0 when fully stalled, 1 when comfortably above stall speed.
 *   liftF = clamp((s − 0.6·stall) / (0.4·stall), 0, 1)
 */
export function liftFactor(s: number, stall: number): number {
  return clamp((s - stall * 0.6) / (stall * 0.4), 0, 1)
}

/**
 * Decide whether the plane is boosting this step, matching the balance oracle:
 * boost is engaged only while the button is held, nitro remains, and the plane
 * is below 1.7× stall (you cannot boost past the soft speed ceiling).
 */
export function wantsBoost(state: FlightState, stats: PlaneStats, held: boolean): boolean {
  return held && state.nitro > 0 && state.s < stats.stall * 1.7
}

/**
 * Advance the flight state by `dt` seconds. PURE: it mutates and returns the
 * passed `state`, and reads only `stats` and `input`. This is the exact port of
 * the prototype's `simStep` (plus the yaw/roll/steer and on-ground terms from
 * the live game). With empty input it reproduces the balance oracle step.
 *
 * Physics (GDD §2):
 *   liftF = clamp((s − 0.6·stall)/(0.4·stall), 0, 1)
 *   thrust = (fuel>0 ? stats.thrust : 0) + (boosting ? stats.boost : 0)
 *   at   = clamp(0.02 + (s − 1.3·stall)·0.003, −0.03, 0.2)
 *   a   += (at − a)·(1−|pitch|)·0.9·liftF·dt
 *        +  pitch·turn·dt·(0.45 + 0.55·liftF)
 *        − (1 − liftF)·1.2·dt                           (stall nose-drop)
 *   a    = clamp(a, −1.45, 1.45)
 *   s   += (−G·sin a − drag·s² + thrust − |steer|·0.5)·dt
 *   vy   = s·sin a·(0.4 + 0.6·liftF) − (s/gr + 1.5)·liftF − (1 − liftF)·7
 */
export function simStep(
  state: FlightState,
  dt: number,
  input: FlightInput,
  stats: PlaneStats,
): FlightState {
  const pin = input.pitch ?? 0
  const sin = input.steer ?? 0
  const held = input.boost ?? false

  state.boosting = wantsBoost(state, stats, held)

  const liftF = liftFactor(state.s, stats.stall)

  // Thrust: engine while fuel lasts, plus boost.
  let thrust = 0
  if (state.fuel > 0) {
    thrust = stats.thrust
    state.fuel = Math.max(0, state.fuel - dt)
  }
  if (state.boosting) {
    thrust += stats.boost
    state.nitro = Math.max(0, state.nitro - stats.ndrain * dt)
  }
  state.thrusting = thrust > 0

  // Pitch: auto-trim toward `at`, plus player input, minus stall nose-drop.
  const at = clamp(0.02 + (state.s - 1.3 * stats.stall) * 0.003, -0.03, 0.2)
  const assist = (1 - Math.abs(pin)) * 0.9 * liftF
  state.a +=
    (at - state.a) * assist * dt +
    pin * stats.turn * dt * (0.45 + 0.55 * liftF) -
    (1 - liftF) * 1.2 * dt
  state.a = clamp(state.a, -1.45, 1.45)

  // Yaw / roll (zero when not steering → no effect on the balance oracle).
  state.yaw += -sin * stats.turn * 0.7 * dt * (0.4 + 0.6 * liftF)
  state.yaw = clamp(state.yaw, -1.25, 1.25)
  state.roll += (-sin * 0.75 - state.roll) * Math.min(1, dt * 6)

  // Speed.
  state.s += (-G * Math.sin(state.a) - stats.drag * state.s * state.s + thrust - Math.abs(sin) * 0.5) * dt
  if (state.onGround) state.s -= (6 + 0.002 * state.s * state.s) * dt
  if (state.s < 1) state.s = 1

  // Vertical velocity and integration.
  state.vy =
    state.s * Math.sin(state.a) * (0.4 + 0.6 * liftF) -
    (state.s / stats.gr + 1.5) * liftF -
    (1 - liftF) * 7
  const h = state.s * Math.cos(state.a)
  state.x += -Math.sin(state.yaw) * h * dt
  state.z += -Math.cos(state.yaw) * h * dt
  state.y += state.vy * dt

  return state
}

// ---------------------------------------------------------------------------
// Ground / landing  — legacy groundCheck() ~949, cliff() in balance-sim.js
// ---------------------------------------------------------------------------

/** Distance flown, in metres (legacy dist()). */
export function distance(state: FlightState): number {
  return Math.max(0, -state.z)
}

/**
 * The launch-cliff ground profile used by the balance oracle: flat at the
 * launch pad (y = 0), then dropping 22 m over the first 15–95 m of distance.
 * This is the pure, terrain-free ground used for balance locking.
 *   cliff(d) = −22 · clamp((d − 15) / 80, 0, 1)
 */
export function cliffGroundY(z: number): number {
  const d = -z
  return -22 * clamp((d - 15) / 80, 0, 1)
}

/** Outcome of a landing/ground contact. */
export type LandingKind = 'flying' | 'touch' | 'land' | 'splash' | 'crash' | 'bounce'

export interface GroundResult {
  kind: LandingKind
  /** Whether the run should end after this contact. */
  ended: boolean
}

export interface GroundContact {
  /** Ground height directly under the plane, metres. */
  groundY: number
  /** Local terrain slope, radians (0 for flat/water). */
  slope?: number
  /** True if the contact point is water (splashdown, safe). */
  water?: boolean
  /** True if the contact point is lava (always a crash). */
  lava?: boolean
}

/**
 * A hard crash occurs when the plane slams the ground nose-down and fast, or is
 * descending very quickly (legacy groundCheck):
 *   (pitch − slope) < −0.6 && s > 20   ||   vy < −28
 */
export function isHardCrash(state: FlightState, slope: number): boolean {
  return ((state.a - slope) < -0.6 && state.s > 20) || state.vy < -28
}

/**
 * Pure ground-contact resolver. Does NOT integrate — call it after simStep with
 * the ground info at the plane's current position. It mutates `state` to reflect
 * the contact (clearing onGround when airborne, settling onto ground, consuming
 * a shield on a saved crash, stopping on a splashdown) and returns what happened.
 *
 * Contact threshold: the plane rides 1 m above the surface (water uses WATER_Y).
 *   - lava or hard crash with no shield → 'crash' (ended)
 *   - lava or hard crash WITH a shield  → 'bounce' (shield−−, recover, continue)
 *   - water                             → 'splash' (ended, counts as clean)
 *   - gentle touch                      → 'touch' then settle; 'land' once stopped
 */
export function groundCheck(state: FlightState, contact: GroundContact): GroundResult {
  const slope = contact.slope ?? 0
  const water = !!contact.water
  const lava = !!contact.lava
  const surface = water ? WATER_Y : contact.groundY
  const gy = surface + 1

  if (state.y > gy) {
    state.onGround = false
    return { kind: 'flying', ended: false }
  }

  // Airborne → contact this step.
  if (!state.onGround) {
    const hard = isHardCrash(state, slope)
    if (hard || lava) {
      if (state.shield > 0) {
        state.shield--
        state.a = 0.4
        state.s = Math.max(state.s * 0.85, 14)
        state.y = gy + 0.5
        state.onGround = false
        return { kind: 'bounce', ended: false }
      }
      state.alive = false
      state.s = 0
      state.boosting = false
      return { kind: 'crash', ended: true }
    }
    if (water) {
      state.stopped = true
      state.s = 0
      state.alive = true
      state.onGround = true
      state.y = gy
      return { kind: 'splash', ended: true }
    }
  }

  // Settle onto the ground. Friction in simStep bleeds off remaining speed.
  state.onGround = true
  state.y = gy
  if (state.a < slope) state.a = slope
  const stopped = state.s <= 1.01
  if (stopped) state.stopped = true
  return { kind: stopped ? 'land' : 'touch', ended: false }
}
