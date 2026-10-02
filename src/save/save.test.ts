/**
 * Skyfling — save system unit tests (vitest)
 *
 * No three.js, no external project imports.
 * localStorage is stubbed with a simple in-memory map.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  load,
  save,
  resetProgress,
  exportCode,
  importCode,
  type UpgradeLevels,
} from './save.ts';

// ─────────────────────────────────────────────
// localStorage stub
// ─────────────────────────────────────────────

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

vi.stubGlobal('localStorage', localStorageMock);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** btoa / atob exist in Node 16+ natively */

function clearStore() {
  localStorageMock.clear();
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('save system', () => {
  beforeEach(clearStore);

  // ── Default / round-trip ──────────────────

  it('load() returns a default save when storage is empty', () => {
    const data = load();
    expect(data.schemaVersion).toBe(3);
    expect(data.coins).toBe(0);
    expect(data.upgradeLevels.launcher).toBe(0);
    expect(data.unlockedPlanes).toEqual([0]);
    expect(data.missions).toHaveLength(3);
    expect(data.bestDistance).toBe(0);
    expect(data.prestigeCount).toBe(0);
    expect(data.dailyStreak).toBe(0);
  });

  it('save() + load() round-trip preserves all fields', () => {
    const data = load();
    data.coins = 1234;
    data.bestDistance = 3050;
    data.upgradeLevels.wings = 5;
    data.upgradeLevels.engine = 3;
    data.unlockedPlanes = [0, 1, 2];
    data.equippedPlane = 2;
    data.equippedPaint[2] = 4;
    data.paintLoadout = { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', canopy: '#ffffff' };
    data.unlockedGadgets = ['parachute', 'rocketPod'];
    data.equippedGadgets = ['parachute', null];
    data.missions[0].type = 'coins';
    data.missions[0].target = 500;
    data.missions[0].progress = 250;
    data.missions[0].completed = false;
    data.achievementFlags['cloudSurfer'] = true;
    data.achievementFlags['firstFlight'] = true;
    data.lastChestDate = '2026-10-01';
    data.dailyStreak = 5;
    data.streakMultiplier = 1.75;
    data.weeklyChallengeSeed = '2026-W40';
    data.weeklyChallengeBest = 8200;
    data.prestigeCount = 2;
    data.prestigeCoinMultiplier = 1.2;
    data.settings.invertPitch = true;
    data.settings.masterVolume = 0.8;
    data.lifetimeCoins = 50000;
    data.lifetimeFlights = 120;
    data.lifetimeDistance = 95000;

    save(data);
    const loaded = load();

    expect(loaded.coins).toBe(1234);
    expect(loaded.bestDistance).toBe(3050);
    expect(loaded.upgradeLevels.wings).toBe(5);
    expect(loaded.upgradeLevels.engine).toBe(3);
    expect(loaded.unlockedPlanes).toEqual([0, 1, 2]);
    expect(loaded.equippedPlane).toBe(2);
    expect(loaded.equippedPaint[2]).toBe(4);
    expect(loaded.paintLoadout.primary).toBe('#ff0000');
    expect(loaded.unlockedGadgets).toEqual(['parachute', 'rocketPod']);
    expect(loaded.equippedGadgets).toEqual(['parachute', null]);
    expect(loaded.missions[0].type).toBe('coins');
    expect(loaded.missions[0].progress).toBe(250);
    expect(loaded.achievementFlags['cloudSurfer']).toBe(true);
    expect(loaded.achievementFlags['firstFlight']).toBe(true);
    expect(loaded.lastChestDate).toBe('2026-10-01');
    expect(loaded.dailyStreak).toBe(5);
    expect(loaded.streakMultiplier).toBeCloseTo(1.75);
    expect(loaded.weeklyChallengeSeed).toBe('2026-W40');
    expect(loaded.weeklyChallengeBest).toBe(8200);
    expect(loaded.prestigeCount).toBe(2);
    expect(loaded.prestigeCoinMultiplier).toBeCloseTo(1.2);
    expect(loaded.settings.invertPitch).toBe(true);
    expect(loaded.settings.masterVolume).toBeCloseTo(0.8);
    expect(loaded.lifetimeCoins).toBe(50000);
    expect(loaded.lifetimeFlights).toBe(120);
    expect(loaded.lifetimeDistance).toBe(95000);
  });

  // ── resetProgress ─────────────────────────

  it('resetProgress() clears all progress and persists blank save', () => {
    const data = load();
    data.coins = 9999;
    data.bestDistance = 12000;
    data.prestigeCount = 3;
    save(data);

    const blank = resetProgress();
    expect(blank.coins).toBe(0);
    expect(blank.bestDistance).toBe(0);
    expect(blank.prestigeCount).toBe(0);

    // Also check that the store was actually written
    const reloaded = load();
    expect(reloaded.coins).toBe(0);
  });

  // ── Migration v1 → v3 ─────────────────────

  it('migrates a v1 save to v3 adding new fields', () => {
    // Build a minimal v1 save (no gadgets, no prestige, no achievementFlags)
    const v1: Record<string, unknown> = {
      schemaVersion: 1,
      coins: 200,
      upgradeLevels: {
        launcher: 2,
        wings: 1,
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
      } satisfies UpgradeLevels,
      unlockedPlanes: [0, 1],
      equippedPlane: 1,
      equippedPaint: { '0': 0, '1': 2 },
      paintLoadout: { primary: '#aabbcc', secondary: '#112233', accent: '#ffee00', canopy: '#99ddff' },
      bestDistance: 1500,
      missions: [
        { type: 'distance', target: 600, progress: 400, completed: false, difficultyTier: 1, reward: 60 },
        { type: 'coins', target: 200, progress: 200, completed: true, difficultyTier: 1, reward: 45 },
        { type: 'rings', target: 10, progress: 3, completed: false, difficultyTier: 1, reward: 55 },
      ],
      lastChestDate: '2026-09-28',
      dailyStreak: 3,
      streakMultiplier: 1.5,
      settings: {
        invertPitch: false,
        soundEnabled: true,
        musicEnabled: true,
        hapticsEnabled: true,
        masterVolume: 1,
        musicVolume: 0.6,
      },
    };

    store['skyfling_save_v1'] = JSON.stringify(v1);
    const loaded = load();

    expect(loaded.schemaVersion).toBe(3);
    // Original fields preserved
    expect(loaded.coins).toBe(200);
    expect(loaded.upgradeLevels.launcher).toBe(2);
    expect(loaded.unlockedPlanes).toEqual([0, 1]);
    expect(loaded.bestDistance).toBe(1500);
    expect(loaded.missions[0].type).toBe('distance');
    expect(loaded.missions[1].completed).toBe(true);
    expect(loaded.dailyStreak).toBe(3);
    // New fields from v1→v2
    expect(loaded.prestigeCount).toBe(0);
    expect(loaded.prestigeCoinMultiplier).toBe(1);
    expect(loaded.unlockedGadgets).toEqual([]);
    expect(loaded.equippedGadgets).toEqual([null, null]);
    expect(loaded.weeklyChallengeSeed).toBeNull();
    expect(loaded.weeklyChallengeBest).toBe(0);
    // New fields from v2→v3
    expect(loaded.achievementFlags).toEqual({});
    expect(loaded.totalMissionsCompleted).toBe(0);
    expect(loaded.lifetimeCoins).toBe(0);
    expect(loaded.lifetimeFlights).toBe(0);
    expect(loaded.lifetimeDistance).toBe(0);
  });

  it('migrates a v2 save to v3', () => {
    const v2: Record<string, unknown> = {
      schemaVersion: 2,
      coins: 500,
      upgradeLevels: {
        launcher: 3,
        wings: 2,
        engine: 1,
        fuelTank: 0,
        airframe: 0,
        nitro: 2,
        armor: 1,
        magnet: 0,
        luckyCharm: 0,
        thermalWings: 0,
        stormPlating: 0,
        trickKit: 0,
        coinRadar: 0,
      } satisfies UpgradeLevels,
      unlockedPlanes: [0],
      equippedPlane: 0,
      equippedPaint: {},
      paintLoadout: { primary: '#fff', secondary: '#ccc', accent: '#f40', canopy: '#8cf' },
      unlockedGadgets: ['parachute'],
      equippedGadgets: ['parachute', null],
      bestDistance: 2100,
      missions: [
        { type: 'altitude', target: 300, progress: 100, completed: false, difficultyTier: 2, reward: 70 },
        { type: 'trick', target: 5, progress: 5, completed: true, difficultyTier: 2, reward: 80 },
        { type: 'stormBreak', target: 1, progress: 0, completed: false, difficultyTier: 2, reward: 90 },
      ],
      lastChestDate: '2026-09-30',
      dailyStreak: 7,
      streakMultiplier: 2.0,
      weeklyChallengeSeed: '2026-W39',
      weeklyChallengeBest: 4000,
      prestigeCount: 1,
      prestigeCoinMultiplier: 1.1,
      settings: {
        invertPitch: true,
        soundEnabled: false,
        musicEnabled: true,
        hapticsEnabled: false,
        masterVolume: 0.7,
        musicVolume: 0.4,
      },
    };

    store['skyfling_save_v1'] = JSON.stringify(v2);
    const loaded = load();

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.coins).toBe(500);
    expect(loaded.prestigeCount).toBe(1);
    expect(loaded.weeklyChallengeSeed).toBe('2026-W39');
    expect(loaded.missions[1].completed).toBe(true);
    expect(loaded.settings.invertPitch).toBe(true);
    // New v3 fields
    expect(loaded.achievementFlags).toEqual({});
    expect(loaded.totalMissionsCompleted).toBe(0);
    expect(loaded.lifetimeFlights).toBe(0);
  });

  // ── Corrupt data ──────────────────────────

  it('load() returns default save when JSON is corrupt', () => {
    store['skyfling_save_v1'] = '{not json{{{{';
    const data = load();
    expect(data.coins).toBe(0);
    expect(data.schemaVersion).toBe(3);
  });

  it('load() returns default save when required fields are missing', () => {
    store['skyfling_save_v1'] = JSON.stringify({ schemaVersion: 3, coins: 'not-a-number' });
    const data = load();
    expect(data.coins).toBe(0);
  });

  // ── Export / Import ───────────────────────

  it('exportCode() + importCode() round-trips a full save', () => {
    const data = load();
    data.coins = 7777;
    data.bestDistance = 9500;
    data.prestigeCount = 3;
    data.achievementFlags['stormBreaker'] = true;
    data.settings.invertPitch = true;
    save(data);

    const code = exportCode(data);
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(10);
    // Should be valid Base64 (no spaces, valid chars)
    expect(() => atob(code)).not.toThrow();

    const imported = importCode(code);
    expect(imported.coins).toBe(7777);
    expect(imported.bestDistance).toBe(9500);
    expect(imported.prestigeCount).toBe(3);
    expect(imported.achievementFlags['stormBreaker']).toBe(true);
    expect(imported.settings.invertPitch).toBe(true);
    expect(imported.schemaVersion).toBe(3);
  });

  it('exportCode produces a code with SFLYV1 prefix when decoded', () => {
    const data = load();
    const code = exportCode(data);
    const decoded = decodeURIComponent(escape(atob(code)));
    expect(decoded.startsWith('SFLYV1:')).toBe(true);
  });

  it('importCode() throws on garbage input', () => {
    expect(() => importCode('not-valid-base64!!!')).toThrow('not valid Base64');
  });

  it('importCode() throws when the prefix is missing', () => {
    // Valid base64 but no SFLYV1 header
    const bad = btoa('{"schemaVersion":3,"coins":0}');
    expect(() => importCode(bad)).toThrow('missing SFLYV1 header');
  });

  it('importCode() throws when JSON inside is invalid', () => {
    const bad = btoa(unescape(encodeURIComponent('SFLYV1:not-json{')));
    expect(() => importCode(bad)).toThrow('JSON parse failed');
  });

  it('importCode() migrates an older-version export on import', () => {
    // Simulate exporting from a v2 client
    const v2Json = JSON.stringify({
      schemaVersion: 2,
      coins: 333,
      upgradeLevels: {
        launcher: 1, wings: 0, engine: 0, fuelTank: 0, airframe: 0,
        nitro: 0, armor: 0, magnet: 0, luckyCharm: 0,
        thermalWings: 0, stormPlating: 0, trickKit: 0, coinRadar: 0,
      },
      unlockedPlanes: [0],
      equippedPlane: 0,
      equippedPaint: {},
      paintLoadout: { primary: '#fff', secondary: '#ccc', accent: '#f40', canopy: '#8cf' },
      unlockedGadgets: [],
      equippedGadgets: [null, null],
      bestDistance: 700,
      missions: [
        { type: 'distance', target: 500, progress: 0, completed: false, difficultyTier: 0, reward: 30 },
        { type: 'distance', target: 500, progress: 0, completed: false, difficultyTier: 0, reward: 30 },
        { type: 'distance', target: 500, progress: 0, completed: false, difficultyTier: 0, reward: 30 },
      ],
      lastChestDate: null,
      dailyStreak: 0,
      streakMultiplier: 1,
      weeklyChallengeSeed: null,
      weeklyChallengeBest: 0,
      prestigeCount: 0,
      prestigeCoinMultiplier: 1,
      settings: {
        invertPitch: false, soundEnabled: true, musicEnabled: true,
        hapticsEnabled: true, masterVolume: 1, musicVolume: 0.6,
      },
    });
    const code = btoa(unescape(encodeURIComponent('SFLYV1:' + v2Json)));
    const imported = importCode(code);
    expect(imported.schemaVersion).toBe(3);
    expect(imported.coins).toBe(333);
    expect(imported.achievementFlags).toEqual({});
    expect(imported.totalMissionsCompleted).toBe(0);
  });

  it('importCode() + save() + load() produces stable state', () => {
    const original = load();
    original.coins = 4200;
    original.lifetimeFlights = 55;

    const code = exportCode(original);
    const imported = importCode(code);
    save(imported);

    const reloaded = load();
    expect(reloaded.coins).toBe(4200);
    expect(reloaded.lifetimeFlights).toBe(55);
  });

  // ── Upgrade levels sanity ─────────────────

  it('upgradeLevels has all 13 upgrade keys at 0 in a fresh save', () => {
    const data = load();
    const keys: Array<keyof UpgradeLevels> = [
      'launcher', 'wings', 'engine', 'fuelTank', 'airframe',
      'nitro', 'armor', 'magnet', 'luckyCharm',
      'thermalWings', 'stormPlating', 'trickKit', 'coinRadar',
    ];
    for (const k of keys) {
      expect(data.upgradeLevels[k]).toBe(0);
    }
  });

  // ── Prestige sanity ───────────────────────

  it('prestigeCoinMultiplier is 1 on a fresh save', () => {
    const data = load();
    expect(data.prestigeCoinMultiplier).toBe(1);
  });

  it('save round-trips prestigeCount correctly', () => {
    const data = load();
    data.prestigeCount = 5;
    data.prestigeCoinMultiplier = 1.5; // 5× +10%
    save(data);
    const loaded = load();
    expect(loaded.prestigeCount).toBe(5);
    expect(loaded.prestigeCoinMultiplier).toBeCloseTo(1.5);
  });
});
