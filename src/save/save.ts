/**
 * Skyfling — versioned save system
 *
 * No three.js, no external project imports.
 * Only depends on the DOM (localStorage, atob/btoa).
 *
 * Schema version history:
 *   1 → initial schema
 *   2 → added gadgets, prestigeCount, weeklyChallengeBest
 *   3 → split missionState into typed MissionState[], added achievementFlags as Record
 */

// ─────────────────────────────────────────────
// Sub-types
// ─────────────────────────────────────────────

/** One active mission slot (GDD §9) */
export interface MissionState {
  /** Discriminant mirrors GDD mission types */
  type:
    | 'distance'
    | 'coins'
    | 'rings'
    | 'altitude'
    | 'airtime'
    | 'perfectLaunch'
    | 'landPastX'
    | 'boostSeconds'
    | 'fuelCans'
    | 'updrafts'
    | 'balloons'
    | 'nearMiss'
    | 'combo'
    | 'stormBreak'
    | 'trick'
    | 'biomeReach';
  /** Target value for completion */
  target: number;
  /** Accumulated progress this session */
  progress: number;
  /** Completed and payout claimed */
  completed: boolean;
  /** Cumulative missions completed (controls difficulty tier) */
  difficultyTier: number;
  /** Coin reward on completion */
  reward: number;
}

/** Paint material slots (GDD §6) */
export interface PaintLoadout {
  primary: string;
  secondary: string;
  accent: string;
  canopy: string;
}

/** Player settings */
export interface Settings {
  invertPitch: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  /** 0–1 master volume */
  masterVolume: number;
  /** 0–1 music volume */
  musicVolume: number;
}

// ─────────────────────────────────────────────
// Upgrade keys (GDD §7 — 13 upgrades × 10 levels)
// ─────────────────────────────────────────────
export type UpgradeKey =
  | 'launcher'
  | 'wings'
  | 'engine'
  | 'fuelTank'
  | 'airframe'
  | 'nitro'
  | 'armor'
  | 'magnet'
  | 'luckyCharm'
  | 'thermalWings'
  | 'stormPlating'
  | 'trickKit'
  | 'coinRadar';

/** 0–10 per upgrade */
export type UpgradeLevels = Record<UpgradeKey, number>;

// ─────────────────────────────────────────────
// Gadget keys (GDD §10)
// ─────────────────────────────────────────────
export type GadgetKey =
  | 'parachute'
  | 'rocketPod'
  | 'coinRadarPlus'
  | 'luckyCoin'
  | 'gliderWing';

// ─────────────────────────────────────────────
// Achievement keys (GDD §9 — 30 achievements)
// ─────────────────────────────────────────────
export type AchievementKey =
  | 'cloudSurfer'      // ride 50 thermals
  | 'stormBreaker'     // break all storm fronts
  | 'untouchable'      // 2 km no bird hits
  | 'perfectionist'    // 10 perfect launches in a row
  | 'globetrotter'     // reach all 12 biomes
  | 'coinMagnate'      // collect 10 000 total coins
  | 'highFlyer'        // reach 1 000 m altitude
  | 'speedDemon'       // exceed 200 m/s
  | 'firstFlight'      // complete first run
  | 'evolution1'       // unlock Kite Biplane
  | 'evolution2'       // unlock Puddle Jumper
  | 'evolution3'       // unlock Hornet
  | 'evolution4'       // unlock Swift Jet
  | 'evolution5'       // unlock Comet
  | 'evolution6'       // unlock Albatross
  | 'evolution7'       // unlock Nova
  | 'evolution8'       // unlock Starliner
  | 'evolution9'       // unlock Phoenix
  | 'prestigeOnce'     // prestige once
  | 'prestigeMax'      // prestige 5 times
  | 'barrelRoller'     // perform 20 barrel rolls
  | 'looper'           // perform 10 loops
  | 'trickMaster'      // 5× trick multiplier
  | 'nearMissKing'     // 100 near-misses lifetime
  | 'comboBreaker'     // reach ×10 combo
  | 'dailyDevotee'     // 7-day streak
  | 'weeklyChamp'      // complete weekly challenge
  | 'goldenRingHunter' // chain 10 golden rings
  | 'splashdown'       // land in water 5 times
  | 'survivalist';     // survive 3 lava hits with shields

// ─────────────────────────────────────────────
// Root SaveData interface — schema v3
// ─────────────────────────────────────────────
export interface SaveData {
  /** Monotonic integer; bump when shape changes */
  schemaVersion: number;

  // ── Economy ──────────────────────────────
  coins: number;

  // ── Upgrades ─────────────────────────────
  upgradeLevels: UpgradeLevels;

  // ── Planes ───────────────────────────────
  /** Plane IDs 0–9; index 0 always unlocked */
  unlockedPlanes: number[];
  /** Currently equipped plane index */
  equippedPlane: number;

  // ── Cosmetics ────────────────────────────
  /** Paint job index (0–11) per plane tier */
  equippedPaint: Record<number, number>;
  /** Active paint colours for the equipped plane */
  paintLoadout: PaintLoadout;

  // ── Gadgets ──────────────────────────────
  unlockedGadgets: GadgetKey[];
  /** Up to 2 equipped pre-flight */
  equippedGadgets: [GadgetKey | null, GadgetKey | null];

  // ── Progress ─────────────────────────────
  bestDistance: number;

  // ── Missions ─────────────────────────────
  /** Always 3 slots */
  missions: [MissionState, MissionState, MissionState];
  /** How many total missions completed (drives next-tier difficulty) */
  totalMissionsCompleted: number;

  // ── Achievements ─────────────────────────
  /** key → true once earned; absent = not yet earned */
  achievementFlags: Partial<Record<AchievementKey, boolean>>;

  // ── Streak / Daily ────────────────────────
  /** ISO date string of last chest claim */
  lastChestDate: string | null;
  /** Current daily streak (1–∞) */
  dailyStreak: number;
  /** Streak multiplier cap applied (≤ 2.5×) */
  streakMultiplier: number;

  // ── Weekly challenge ─────────────────────
  /** ISO date string of current challenge week */
  weeklyChallengeSeed: string | null;
  weeklyChallengeBest: number;

  // ── Prestige ─────────────────────────────
  /** 0–5 Re-fold prestige count (GDD §10) */
  prestigeCount: number;
  /** Cumulative coin multiplier from prestige */
  prestigeCoinMultiplier: number;

  // ── Settings ─────────────────────────────
  settings: Settings;

  // ── Lifetime stats ───────────────────────
  lifetimeCoins: number;
  lifetimeFlights: number;
  lifetimeDistance: number;

  // ── v4: registry-driven profile (missions by id, lifetime stat map, string achievement ids, ghost, UI prefs) ──
  v4: ProfileV4;
}

/** v4 profile block. Keys are registry ids (src/data), so new content needs no schema change. */
export interface ProfileV4 {
  missions: Array<{ id: string; target: number; progress: number; done: boolean }>;
  missionsCompleted: number;
  lifetime: Record<string, number>;
  achievements: Record<string, boolean>;
  /** Encoded best-run recording for the ghost. */
  ghost: string | null;
  paint: string;
  unlockedPaints: string[];
  tutorialDone: boolean;
  controlScheme: 'glide' | 'pilot';
  quality: 'auto' | 'low' | 'medium' | 'high';
  leftHanded: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  perfectStreak: number;
  biomesReached: string[];
  stormsBrokenFirst: number[];
  titles: string[];
  equippedPlaneId: string | null;
}

export function defaultV4(): ProfileV4 {
  return {
    missions: [], missionsCompleted: 0, lifetime: {}, achievements: {}, ghost: null, paint: 'classic', unlockedPaints: ['classic'],
    tutorialDone: false, controlScheme: 'glide', quality: 'auto', leftHanded: false, largeText: false, reducedMotion: false,
    perfectStreak: 0, biomesReached: [], stormsBrokenFirst: [], titles: [], equippedPlaneId: null,
  };
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 4;

const DEFAULT_UPGRADE_LEVELS: UpgradeLevels = {
  launcher: 0,
  wings: 0,
  engine: 0,
  fuelTank: 0,
  airframe: 0,
  nitro: 0,
  armor: 0,
  magnet: 0,
  luckyCharm: 0,
  thermalWings: 0,
  stormPlating: 0,
  trickKit: 0,
  coinRadar: 0,
};

const DEFAULT_MISSION = (): MissionState => ({
  type: 'distance',
  target: 500,
  progress: 0,
  completed: false,
  difficultyTier: 0,
  reward: 30,
});

const DEFAULT_SETTINGS: Settings = {
  invertPitch: false,
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  masterVolume: 1,
  musicVolume: 0.6,
};

function defaultSave(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    coins: 0,
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS },
    unlockedPlanes: [0],
    equippedPlane: 0,
    equippedPaint: { 0: 0 },
    paintLoadout: { primary: '#ffffff', secondary: '#cccccc', accent: '#ff4400', canopy: '#88ccff' },
    unlockedGadgets: [],
    equippedGadgets: [null, null],
    bestDistance: 0,
    missions: [DEFAULT_MISSION(), DEFAULT_MISSION(), DEFAULT_MISSION()],
    totalMissionsCompleted: 0,
    achievementFlags: {},
    lastChestDate: null,
    dailyStreak: 0,
    streakMultiplier: 1,
    weeklyChallengeSeed: null,
    weeklyChallengeBest: 0,
    prestigeCount: 0,
    prestigeCoinMultiplier: 1,
    settings: { ...DEFAULT_SETTINGS },
    lifetimeCoins: 0,
    lifetimeFlights: 0,
    lifetimeDistance: 0,
    v4: defaultV4(),
  };
}

// ─────────────────────────────────────────────
// Migrations
// ─────────────────────────────────────────────
//
// Each migration receives the raw object at version N and must return it
// shaped to version N+1. Do not call defaultSave() inside a migration —
// fill only the fields that are new so that existing progress is kept.

type RawSave = Record<string, unknown>;

type MigrationFn = (raw: RawSave) => RawSave;

const MIGRATIONS: Record<number, MigrationFn> = {
  // v1 → v2: add gadgets, prestigeCount, weeklyChallengeBest
  1: (raw) => ({
    ...raw,
    schemaVersion: 2,
    unlockedGadgets: (raw['unlockedGadgets'] as GadgetKey[] | undefined) ?? [],
    equippedGadgets: (raw['equippedGadgets'] as [GadgetKey | null, GadgetKey | null] | undefined) ?? [null, null],
    prestigeCount: (raw['prestigeCount'] as number | undefined) ?? 0,
    prestigeCoinMultiplier: (raw['prestigeCoinMultiplier'] as number | undefined) ?? 1,
    weeklyChallengeSeed: (raw['weeklyChallengeSeed'] as string | null | undefined) ?? null,
    weeklyChallengeBest: (raw['weeklyChallengeBest'] as number | undefined) ?? 0,
  }),

  // v2 → v3: replace flat missionState with typed MissionState[]; add achievementFlags
  2: (raw) => {
    const def = DEFAULT_MISSION();
    const oldMissions = raw['missions'];
    let missions: [MissionState, MissionState, MissionState];
    if (Array.isArray(oldMissions) && oldMissions.length === 3) {
      missions = (oldMissions as unknown[]).map((m) => {
        if (m && typeof m === 'object') {
          const obj = m as Partial<MissionState>;
          return {
            type: obj.type ?? def.type,
            target: obj.target ?? def.target,
            progress: obj.progress ?? 0,
            completed: obj.completed ?? false,
            difficultyTier: obj.difficultyTier ?? 0,
            reward: obj.reward ?? def.reward,
          } satisfies MissionState;
        }
        return { ...def };
      }) as [MissionState, MissionState, MissionState];
    } else {
      missions = [{ ...def }, { ...def }, { ...def }];
    }
    return {
      ...raw,
      schemaVersion: 3,
      missions,
      totalMissionsCompleted: (raw['totalMissionsCompleted'] as number | undefined) ?? 0,
      achievementFlags: (raw['achievementFlags'] as Partial<Record<AchievementKey, boolean>> | undefined) ?? {},
      lifetimeCoins: (raw['lifetimeCoins'] as number | undefined) ?? 0,
      lifetimeFlights: (raw['lifetimeFlights'] as number | undefined) ?? 0,
      lifetimeDistance: (raw['lifetimeDistance'] as number | undefined) ?? 0,
      weeklyChallengeSeed: (raw['weeklyChallengeSeed'] as string | null | undefined) ?? null,
      weeklyChallengeBest: (raw['weeklyChallengeBest'] as number | undefined) ?? 0,
    };
  },

  // v3 → v4: add the registry-driven profile block (keeps every v3 field).
  3: (raw) => ({
    ...raw,
    schemaVersion: 4,
    v4: { ...defaultV4(), ...((raw['v4'] as Partial<ProfileV4> | undefined) ?? {}) },
  }),
};

function runMigrations(raw: RawSave): SaveData {
  let current = raw;
  let version = (current['schemaVersion'] as number | undefined) ?? 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrateFn = MIGRATIONS[version];
    if (!migrateFn) {
      // No migration available; return default rather than corrupt data
      console.warn(`[save] No migration from v${version} → v${version + 1}; resetting.`);
      return defaultSave();
    }
    current = migrateFn(current);
    version++;
  }
  return current as unknown as SaveData;
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function isValidSave(obj: unknown): obj is SaveData {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s['schemaVersion'] === 'number' &&
    typeof s['coins'] === 'number' &&
    typeof s['upgradeLevels'] === 'object' &&
    s['upgradeLevels'] !== null &&
    Array.isArray(s['unlockedPlanes']) &&
    typeof s['bestDistance'] === 'number' &&
    Array.isArray(s['missions']) &&
    (s['missions'] as unknown[]).length === 3
  );
}

// ─────────────────────────────────────────────
// Storage key
// ─────────────────────────────────────────────

const STORAGE_KEY = 'skyfling_save_v1';

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Load save from localStorage, running any required migrations.
 * Returns a fresh default save if nothing is found or the data is corrupt.
 */
export function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultSave();
    const migrated = runMigrations(parsed as RawSave);
    if (!isValidSave(migrated)) return defaultSave();
    return migrated;
  } catch (err) {
    console.error('[save] load() failed:', err);
    return defaultSave();
  }
}

/**
 * Persist save to localStorage.
 * Silently no-ops (with a warning) if storage is unavailable.
 */
export function save(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[save] save() failed (quota or private mode?):', err);
  }
}

/**
 * Wipe all progress and write a fresh default save.
 * Returns the new blank save.
 */
export function resetProgress(): SaveData {
  const blank = defaultSave();
  save(blank);
  return blank;
}

// ─────────────────────────────────────────────
// Export / Import (compact Base64 code)
// ─────────────────────────────────────────────

/** Magic prefix for basic sanity-check on import */
const EXPORT_PREFIX = 'SFLYV1:';

/**
 * Encode the current save as a compact Base64 string that can be
 * copied to another device and imported.
 *
 * Format: base64( SFLYV1:<json> )
 */
export function exportCode(data: SaveData): string {
  const json = JSON.stringify(data);
  const encoded = btoa(unescape(encodeURIComponent(EXPORT_PREFIX + json)));
  return encoded;
}

/**
 * Decode and validate a Base64 export code.
 *
 * @throws {Error} with a human-readable message if the code is invalid.
 * @returns A fully-migrated SaveData ready to be written with save().
 */
export function importCode(code: string): SaveData {
  let decoded: string;
  try {
    decoded = decodeURIComponent(escape(atob(code.trim())));
  } catch {
    throw new Error('Invalid export code: not valid Base64.');
  }
  if (!decoded.startsWith(EXPORT_PREFIX)) {
    throw new Error('Invalid export code: missing SFLYV1 header.');
  }
  const json = decoded.slice(EXPORT_PREFIX.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid export code: JSON parse failed.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid export code: unexpected root type.');
  }
  const migrated = runMigrations(parsed as RawSave);
  if (!isValidSave(migrated)) {
    throw new Error('Invalid export code: save data failed validation.');
  }
  return migrated;
}
