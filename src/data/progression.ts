// src/data/progression.ts
// Pure data — no imports. All arrays exported as readonly typed tuples.

// ---------------------------------------------------------------------------
// Shared helpers (inlined so this file has zero imports)
// ---------------------------------------------------------------------------

/** Cost to buy level L (1-indexed) of any upgrade: 30 * 1.62^L */
export function upgradeCost(level: number): number {
  return Math.round(30 * Math.pow(1.62, level));
}

// ---------------------------------------------------------------------------
// UPGRADES  (13 total, 10 levels each)
// ---------------------------------------------------------------------------

export type UpgradeId =
  | 'launcher'
  | 'wings'
  | 'engine'
  | 'fuel'
  | 'airframe'
  | 'nitro'
  | 'armor'
  | 'magnet'
  | 'lucky'
  | 'thermal_wings'
  | 'storm_plating'
  | 'trick_kit'
  | 'coin_radar';

export interface Upgrade {
  readonly id: UpgradeId;
  readonly name: string;
  readonly icon: string; // emoji placeholder until asset is wired
  /** Short description of what each level does */
  readonly effectNote: string;
  /** Cost for level L (1-indexed); use upgradeCost(L) for the formula */
  readonly costFn: (level: number) => number;
  /** Per-level stat delta expressed as a readable formula string (for tooltips) */
  readonly statFormula: string;
  readonly maxLevel: 10;
}

export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'launcher',
    name: 'Launcher',
    icon: '🎯',
    effectNote: 'Increases launch speed. Each level raises launch velocity by +6.5 m/s (base 34).',
    costFn: upgradeCost,
    statFormula: 'launchSpeed = 34 + 6.5 * L',
    maxLevel: 10,
  },
  {
    id: 'wings',
    name: 'Wings',
    icon: '✈️',
    effectNote:
      'Lowers stall speed by 0.6 m/s, raises glide ratio by 0.9, and cuts drag per level.',
    costFn: upgradeCost,
    statFormula: 'stallSpeed = 14 - 0.6*L  |  glideRatio = 7 + 0.9*L  |  drag /= (1+0.08*L)',
    maxLevel: 10,
  },
  {
    id: 'engine',
    name: 'Engine',
    icon: '⚙️',
    effectNote: 'Adds +2.2 thrust per level and contributes +0.5 to boost acceleration.',
    costFn: upgradeCost,
    statFormula: 'thrust = 5 + 2.2*L  |  boostAccel += 0.5*L_engine',
    maxLevel: 10,
  },
  {
    id: 'fuel',
    name: 'Fuel Tank',
    icon: '⛽',
    effectNote: 'Extends engine-on seconds by +1.4 s per level (base 2.5 s).',
    costFn: upgradeCost,
    statFormula: 'fuelSeconds = 2.5 + 1.4*L',
    maxLevel: 10,
  },
  {
    id: 'airframe',
    name: 'Airframe',
    icon: '🛠️',
    effectNote: 'Reduces aerodynamic drag and raises turn rate. Stacks with Wings on drag.',
    costFn: upgradeCost,
    statFormula: 'drag /= (1+0.1*L)  |  turnRate = 1.4 + 0.08*L',
    maxLevel: 10,
  },
  {
    id: 'nitro',
    name: 'Nitro',
    icon: '💥',
    effectNote:
      'Increases boost accel by +1.2/Lv, starting nitro by +0.06/Lv, and reduces drain.',
    costFn: upgradeCost,
    statFormula:
      'boostAccel = 16 + 1.2*L + 0.5*L_engine  |  startNitro = 0.4 + 0.06*L  |  drainRate = 0.3/(1+0.08*L)',
    maxLevel: 10,
  },
  {
    id: 'armor',
    name: 'Armor',
    icon: '🛡️',
    effectNote:
      'Adds shields at the start of each run. Shields: floor((L+2)/3) — sequence 0,1,1,1,2,2,2,3,3,3,4.',
    costFn: upgradeCost,
    statFormula: 'startShields = floor((L+2)/3)',
    maxLevel: 10,
  },
  {
    id: 'magnet',
    name: 'Magnet',
    icon: '🧲',
    effectNote: 'Expands coin/pickup collection radius by +2.2 m per level (base 5 m).',
    costFn: upgradeCost,
    statFormula: 'magnetRadius = 5 + 2.2*L',
    maxLevel: 10,
  },
  {
    id: 'lucky',
    name: 'Lucky Charm',
    icon: '🍀',
    effectNote:
      'Each level multiplies coin value by ×(1+0.07·L) and boosts rare pickup spawn rate by ×(1+0.1·L).',
    costFn: upgradeCost,
    statFormula: 'coinValue *= (1 + 0.07*L)  |  rareSpawn *= (1 + 0.1*L)',
    maxLevel: 10,
  },
  {
    id: 'thermal_wings',
    name: 'Thermal Wings',
    icon: '🌡️',
    effectNote: 'Thermals lift 20% harder at Lv 1, scaling to 70% harder at Lv 10.',
    costFn: upgradeCost,
    statFormula: 'thermalLift *= (1 + lerp(0.20, 0.70, (L-1)/9))',
    maxLevel: 10,
  },
  {
    id: 'storm_plating',
    name: 'Storm Plating',
    icon: '⛈️',
    effectNote: 'Reduces drag penalty inside soft walls (storm fronts, ash clouds, etc.) by 4% per level.',
    costFn: upgradeCost,
    statFormula: 'softWallDrag *= (1 - 0.04*L)',
    maxLevel: 10,
  },
  {
    id: 'trick_kit',
    name: 'Trick Kit',
    icon: '🎪',
    effectNote:
      'Trick coins earn +10% per level; invulnerability window on barrel rolls and loops grows longer.',
    costFn: upgradeCost,
    statFormula: 'trickCoinBonus = 1 + 0.10*L  |  trickInvulnMs += 50*L',
    maxLevel: 10,
  },
  {
    id: 'coin_radar',
    name: 'Coin Radar',
    icon: '📡',
    effectNote:
      'Reveals coins and rings through terrain. Detection radius scales from 60 m at Lv 1 to 200 m at Lv 10.',
    costFn: upgradeCost,
    statFormula: 'radarRadius = 60 + 15.6*(L-1)',
    maxLevel: 10,
  },
] as const;

// ---------------------------------------------------------------------------
// MISSION_TYPES  (16 types from GDD §9)
// ---------------------------------------------------------------------------

export type MissionTypeId =
  | 'distance'
  | 'coins'
  | 'rings'
  | 'altitude'
  | 'airtime'
  | 'perfect_launch'
  | 'land_past'
  | 'boost_seconds'
  | 'fuel_cans'
  | 'updrafts'
  | 'balloons'
  | 'near_miss'
  | 'combo'
  | 'storm_break'
  | 'trick'
  | 'biome_reach';

export interface MissionType {
  readonly id: MissionTypeId;
  readonly name: string;
  readonly descTemplate: string; // use {target} as placeholder
  /**
   * Base reward formula parameters.
   * reward = (30 + 0.09 * best + 12 * lvl) * k
   * where `best` is the player's best run metric, `lvl` is mission difficulty level.
   */
  readonly rewardK: number;
  /** What `target` represents in the description template */
  readonly targetUnit: string;
  /** Minimum target value at difficulty 0 */
  readonly targetBase: number;
  /** Target scaling per difficulty level */
  readonly targetPerLevel: number;
}

export const MISSION_TYPES: readonly MissionType[] = [
  {
    id: 'distance',
    name: 'Go the Distance',
    descTemplate: 'Fly at least {target} m in a single run.',
    rewardK: 1.0,
    targetUnit: 'm',
    targetBase: 250,
    targetPerLevel: 200,
  },
  {
    id: 'coins',
    name: 'Coin Collector',
    descTemplate: 'Collect {target} coins in a single run.',
    rewardK: 0.9,
    targetUnit: 'coins',
    targetBase: 30,
    targetPerLevel: 25,
  },
  {
    id: 'rings',
    name: 'Ring Chaser',
    descTemplate: 'Fly through {target} boost rings in a single run.',
    rewardK: 1.1,
    targetUnit: 'rings',
    targetBase: 3,
    targetPerLevel: 3,
  },
  {
    id: 'altitude',
    name: 'High Flyer',
    descTemplate: 'Reach an altitude of at least {target} m above sea level.',
    rewardK: 1.15,
    targetUnit: 'm',
    targetBase: 50,
    targetPerLevel: 40,
  },
  {
    id: 'airtime',
    name: 'Airtime Artist',
    descTemplate: 'Stay airborne for at least {target} seconds.',
    rewardK: 0.95,
    targetUnit: 's',
    targetBase: 20,
    targetPerLevel: 15,
  },
  {
    id: 'perfect_launch',
    name: 'Perfect Launch',
    descTemplate: 'Nail {target} perfect launches (gold zone hits).',
    rewardK: 1.2,
    targetUnit: 'launches',
    targetBase: 1,
    targetPerLevel: 1,
  },
  {
    id: 'land_past',
    name: 'Stick the Landing',
    descTemplate: 'Land past the {target} m mark.',
    rewardK: 1.05,
    targetUnit: 'm',
    targetBase: 300,
    targetPerLevel: 250,
  },
  {
    id: 'boost_seconds',
    name: 'Nitro Burn',
    descTemplate: 'Use boost for a total of {target} seconds in one run.',
    rewardK: 1.1,
    targetUnit: 's',
    targetBase: 2,
    targetPerLevel: 1.5,
  },
  {
    id: 'fuel_cans',
    name: 'Fuel Hound',
    descTemplate: 'Pick up {target} fuel cans in a single run.',
    rewardK: 1.0,
    targetUnit: 'cans',
    targetBase: 2,
    targetPerLevel: 2,
  },
  {
    id: 'updrafts',
    name: 'Updraft Rider',
    descTemplate: 'Ride {target} thermals (updraft columns) in one run.',
    rewardK: 1.05,
    targetUnit: 'thermals',
    targetBase: 2,
    targetPerLevel: 2,
  },
  {
    id: 'balloons',
    name: 'Balloon Popper',
    descTemplate: 'Pop {target} balloons in a single run.',
    rewardK: 0.9,
    targetUnit: 'balloons',
    targetBase: 3,
    targetPerLevel: 3,
  },
  {
    id: 'near_miss',
    name: 'Daredevil',
    descTemplate: 'Pull off {target} near-misses without crashing.',
    rewardK: 1.3,
    targetUnit: 'near-misses',
    targetBase: 1,
    targetPerLevel: 1,
  },
  {
    id: 'combo',
    name: 'Combo King',
    descTemplate: 'Reach a {target}× combo multiplier.',
    rewardK: 1.25,
    targetUnit: '×',
    targetBase: 2,
    targetPerLevel: 1,
  },
  {
    id: 'storm_break',
    name: 'Storm Breaker',
    descTemplate: 'Break through {target} storm front(s) in one run.',
    rewardK: 1.4,
    targetUnit: 'fronts',
    targetBase: 1,
    targetPerLevel: 1,
  },
  {
    id: 'trick',
    name: 'Trick Master',
    descTemplate: 'Land {target} trick(s) (barrel rolls or loops) in one run.',
    rewardK: 1.2,
    targetUnit: 'tricks',
    targetBase: 1,
    targetPerLevel: 1,
  },
  {
    id: 'biome_reach',
    name: 'Biome Explorer',
    descTemplate: 'Reach the {target} biome in a single run.',
    rewardK: 1.35,
    targetUnit: 'biome',
    targetBase: 1, // biome index
    targetPerLevel: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// ACHIEVEMENTS  (30 total, GDD §9)
// ---------------------------------------------------------------------------

export type AchievementConditionType =
  | 'total_distance'      // cumulative metres flown
  | 'single_distance'     // metres in one run
  | 'total_flights'       // number of runs
  | 'total_coins'         // cumulative coins collected
  | 'single_coins'        // coins in one run
  | 'total_thermals'      // cumulative thermals ridden
  | 'all_storm_fronts'    // broke every distinct storm position at least once
  | 'no_bird_hit'         // flew 2 km without a bird strike
  | 'perfect_launch_count'// perfect launches total
  | 'max_combo'           // highest combo reached
  | 'rings_in_run'        // rings in one run
  | 'trick_count'         // tricks performed total
  | 'biomes_reached'      // distinct biomes reached
  | 'near_miss_count'     // near-misses total
  | 'upgrade_level'       // sum of all upgrade levels
  | 'plane_tier'          // highest plane tier reached
  | 'prestige_count'      // prestige completions
  | 'no_crash_distance'   // single run, no crash
  | 'balloon_count'       // balloons popped total
  | 'fuel_cans_total'     // fuel cans collected total
  | 'boost_seconds_total' // total boost time
  | 'single_airtime'      // seconds airborne in one run
  | 'altitude_reached'    // peak altitude in one run
  | 'golden_rings_chain'  // completed golden ring chains
  | 'chest_streak'        // daily chest streak length
  | 'missions_completed'  // total missions done
  | 'weekly_challenges'   // weekly challenges attempted
  | 'tricks_in_run'       // tricks in one run
  | 'all_biomes'          // reached every biome at least once
  | 'secret'              // triggered by a specific in-game event (data in extraData)

export interface AchievementCondition {
  readonly type: AchievementConditionType;
  /** Numeric threshold (or biome count, tier number, etc.) */
  readonly threshold: number;
  /** Optional extra data (e.g. biome name for biome_reach) */
  readonly extraData?: string;
}

export type TitleId =
  | 'cloud_surfer'
  | 'storm_breaker'
  | 'untouchable'
  | 'ace_pilot'
  | 'distance_king'
  | 'coin_baron'
  | 'ring_master'
  | 'trickster'
  | 'fuel_runner'
  | 'sky_explorer'
  | 'phoenix_reborn'
  | 'combo_lord'
  | 'near_miss_king'
  | 'veteran'
  | 'legend';

export interface Achievement {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  readonly condition: AchievementCondition;
  /** Title unlocked when this achievement is earned (optional) */
  readonly titleId?: TitleId;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'cloud_surfer',
    name: 'Cloud Surfer',
    desc: 'Ride 50 thermals across all runs.',
    condition: { type: 'total_thermals', threshold: 50 },
    titleId: 'cloud_surfer',
  },
  {
    id: 'storm_breaker',
    name: 'Storm Breaker',
    desc: 'Break through all 8 distinct storm fronts at least once.',
    condition: { type: 'all_storm_fronts', threshold: 8 },
    titleId: 'storm_breaker',
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    desc: 'Fly 2 km in a single run without a single bird hit.',
    condition: { type: 'no_bird_hit', threshold: 2000 },
    titleId: 'untouchable',
  },
  {
    id: 'first_flight',
    name: 'First Flight',
    desc: 'Complete your first run.',
    condition: { type: 'total_flights', threshold: 1 },
  },
  {
    id: 'frequent_flyer',
    name: 'Frequent Flyer',
    desc: 'Complete 50 runs.',
    condition: { type: 'total_flights', threshold: 50 },
  },
  {
    id: 'centurion',
    name: 'Centurion',
    desc: 'Complete 100 runs.',
    condition: { type: 'total_flights', threshold: 100 },
    titleId: 'veteran',
  },
  {
    id: 'distance_500',
    name: 'Half a K',
    desc: 'Fly 500 m in a single run.',
    condition: { type: 'single_distance', threshold: 500 },
  },
  {
    id: 'distance_2500',
    name: 'Two and a Half',
    desc: 'Fly 2,500 m in a single run.',
    condition: { type: 'single_distance', threshold: 2500 },
  },
  {
    id: 'distance_7000',
    name: 'Stratospheric',
    desc: 'Fly 7,000 m in a single run.',
    condition: { type: 'single_distance', threshold: 7000 },
    titleId: 'distance_king',
  },
  {
    id: 'coin_collector_100',
    name: 'Pocket Change',
    desc: 'Collect 100 coins in a single run.',
    condition: { type: 'single_coins', threshold: 100 },
  },
  {
    id: 'coin_hoarder',
    name: 'Coin Hoarder',
    desc: 'Collect 10,000 coins across all runs.',
    condition: { type: 'total_coins', threshold: 10000 },
    titleId: 'coin_baron',
  },
  {
    id: 'ring_chaser_10',
    name: 'Ring Chaser',
    desc: 'Hit 10 boost rings in a single run.',
    condition: { type: 'rings_in_run', threshold: 10 },
    titleId: 'ring_master',
  },
  {
    id: 'trick_novice',
    name: 'Trick Novice',
    desc: 'Perform your first trick (barrel roll or loop).',
    condition: { type: 'trick_count', threshold: 1 },
  },
  {
    id: 'trick_master',
    name: 'Trick Master',
    desc: 'Perform 5 tricks in a single run.',
    condition: { type: 'tricks_in_run', threshold: 5 },
    titleId: 'trickster',
  },
  {
    id: 'trick_veteran',
    name: 'Trick Veteran',
    desc: 'Perform 200 tricks across all runs.',
    condition: { type: 'trick_count', threshold: 200 },
  },
  {
    id: 'biome_explorer_6',
    name: 'Biome Explorer',
    desc: 'Reach 6 distinct biomes.',
    condition: { type: 'biomes_reached', threshold: 6 },
    titleId: 'sky_explorer',
  },
  {
    id: 'biome_completionist',
    name: 'World Traveller',
    desc: 'Reach all 12 base biomes at least once.',
    condition: { type: 'all_biomes', threshold: 12 },
  },
  {
    id: 'combo_x5',
    name: 'Combo King',
    desc: 'Reach a ×5 combo multiplier in a single run.',
    condition: { type: 'max_combo', threshold: 5 },
    titleId: 'combo_lord',
  },
  {
    id: 'near_miss_50',
    name: 'Living Dangerously',
    desc: 'Pull off 50 near-misses total.',
    condition: { type: 'near_miss_count', threshold: 50 },
    titleId: 'near_miss_king',
  },
  {
    id: 'perfect_launch_10',
    name: 'Launch Ace',
    desc: 'Hit the gold zone 10 times total.',
    condition: { type: 'perfect_launch_count', threshold: 10 },
  },
  {
    id: 'perfect_launch_50',
    name: 'Precision Pilot',
    desc: 'Hit the gold zone 50 times total.',
    condition: { type: 'perfect_launch_count', threshold: 50 },
    titleId: 'ace_pilot',
  },
  {
    id: 'fully_upgraded',
    name: 'Maximum Power',
    desc: 'Max out all 13 upgrades to level 10.',
    condition: { type: 'upgrade_level', threshold: 130 },
  },
  {
    id: 'reach_phoenix',
    name: 'Phoenix Tier',
    desc: 'Evolve into the Phoenix (Tier 9).',
    condition: { type: 'plane_tier', threshold: 9 },
    titleId: 'phoenix_reborn',
  },
  {
    id: 'prestige_1',
    name: 'Re-fold',
    desc: 'Complete your first prestige.',
    condition: { type: 'prestige_count', threshold: 1 },
  },
  {
    id: 'prestige_5',
    name: 'Five Times Folded',
    desc: 'Complete all 5 prestiges.',
    condition: { type: 'prestige_count', threshold: 5 },
    titleId: 'legend',
  },
  {
    id: 'clean_2km',
    name: 'Spotless',
    desc: 'Fly 2 km in a single run without crashing.',
    condition: { type: 'no_crash_distance', threshold: 2000 },
  },
  {
    id: 'balloon_100',
    name: 'Balloon Buster',
    desc: 'Pop 100 balloons total.',
    condition: { type: 'balloon_count', threshold: 100 },
  },
  {
    id: 'fuel_can_50',
    name: 'Fuel Runner',
    desc: 'Collect 50 fuel cans total.',
    condition: { type: 'fuel_cans_total', threshold: 50 },
    titleId: 'fuel_runner',
  },
  {
    id: 'golden_ring_chain_5',
    name: 'All Gold',
    desc: 'Complete 5 golden ring chains (hit all 3 rings in a golden chain).',
    condition: { type: 'golden_rings_chain', threshold: 5 },
  },
  {
    id: 'chest_streak_7',
    name: 'Daily Devotee',
    desc: 'Maintain a 7-day daily chest streak.',
    condition: { type: 'chest_streak', threshold: 7 },
  },
] as const;

// ---------------------------------------------------------------------------
// TITLES  (shown in the hangar, earned via achievements)
// ---------------------------------------------------------------------------

export interface Title {
  readonly id: TitleId;
  readonly label: string;
  readonly desc: string;
  /** Achievement id that unlocks this title */
  readonly unlockedBy: string;
}

export const TITLES: readonly Title[] = [
  {
    id: 'cloud_surfer',
    label: 'Cloud Surfer',
    desc: 'Rides thermals like they were made for you.',
    unlockedBy: 'cloud_surfer',
  },
  {
    id: 'storm_breaker',
    label: 'Storm Breaker',
    desc: 'Broke every wall the sky could build.',
    unlockedBy: 'storm_breaker',
  },
  {
    id: 'untouchable',
    label: 'Untouchable',
    desc: '2 km without a single feather grazing you.',
    unlockedBy: 'untouchable',
  },
  {
    id: 'ace_pilot',
    label: 'Ace Pilot',
    desc: 'The gold zone bends to your will.',
    unlockedBy: 'perfect_launch_50',
  },
  {
    id: 'distance_king',
    label: 'Distance King',
    desc: 'Pushed past 7 km. Some say you\'re still flying.',
    unlockedBy: 'distance_7000',
  },
  {
    id: 'coin_baron',
    label: 'Coin Baron',
    desc: 'Wealth measured in altitude and coin arcs.',
    unlockedBy: 'coin_hoarder',
  },
  {
    id: 'ring_master',
    label: 'Ring Master',
    desc: '10 rings, one run, no misses.',
    unlockedBy: 'ring_chaser_10',
  },
  {
    id: 'trickster',
    label: 'Trickster',
    desc: 'The sky is your circus.',
    unlockedBy: 'trick_master',
  },
  {
    id: 'fuel_runner',
    label: 'Fuel Runner',
    desc: 'Never runs dry.',
    unlockedBy: 'fuel_can_50',
  },
  {
    id: 'sky_explorer',
    label: 'Sky Explorer',
    desc: 'Six worlds seen, more on the horizon.',
    unlockedBy: 'biome_explorer_6',
  },
  {
    id: 'phoenix_reborn',
    label: 'Phoenix',
    desc: 'Evolved beyond the fold.',
    unlockedBy: 'reach_phoenix',
  },
  {
    id: 'combo_lord',
    label: 'Combo Lord',
    desc: 'Five-times-over, without breaking the chain.',
    unlockedBy: 'combo_x5',
  },
  {
    id: 'near_miss_king',
    label: 'Daredevil',
    desc: '50 times you should have crashed. You didn\'t.',
    unlockedBy: 'near_miss_50',
  },
  {
    id: 'veteran',
    label: 'Veteran',
    desc: '100 flights. You know these winds.',
    unlockedBy: 'centurion',
  },
  {
    id: 'legend',
    label: 'Legend',
    desc: 'Five prestiges. The sky remembers.',
    unlockedBy: 'prestige_5',
  },
] as const;
