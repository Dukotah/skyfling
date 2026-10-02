/**
 * planes.ts — Skyfling plane roster (14 planes, evolve ladder)
 *
 * Pure data: no three.js imports. The renderer consumes `buildSpec` to
 * assemble low-poly silhouettes from primitive descriptors.
 *
 * Sources:
 *   DESIGN_BIBLE.md §1 (authoritative — wins over GDD on conflicts)
 *   GDD.md §6 (base unlock levels and bonus numbers)
 */

// ---------------------------------------------------------------------------
// Primitive / build-spec types
// ---------------------------------------------------------------------------

export type PrimitiveKind =
  | "box"
  | "cylinder"
  | "sphere"
  | "lathe"
  | "cone"
  | "quad"
  | "instancedMesh"
  | "icosahedron"
  | "octahedron";

export type MaterialSlot =
  | "primary"
  | "secondary"
  | "accent"
  | "canopy"
  | "emissive"
  | "fabric"
  | "metal"
  | "paper";

/** A single primitive part that makes up the plane silhouette. */
export interface BuildPart {
  /** Logical name for this part (e.g. "fuselage", "left-wing"). */
  name: string;
  kind: PrimitiveKind;
  /**
   * Normalised dimensions [x, y, z] relative to a 1-unit bounding box.
   * For cylinder/cone: [radiusTop, radiusBottom, height, radialSegments].
   * For sphere: [radius].
   * For icosahedron/octahedron: [radius, detail].
   * For instancedMesh: [count] (geometry params in `instanceParams`).
   */
  dims: number[];
  /** Position offset from plane origin [x, y, z]. */
  offset: number[];
  /** Euler rotation [rx, ry, rz] in radians. */
  rotation?: number[];
  /** Which material slot this part uses. */
  material: MaterialSlot;
  /** Set to true for parts that are morph targets (bent states, etc.). */
  isMorphTarget?: boolean;
  /** Extra per-kind parameters (e.g. instancedMesh ring radius). */
  instanceParams?: Record<string, number | string>;
  /** Note to the renderer about a special effect on this part. */
  fx?: string;
}

export interface BuildSpec {
  /** Approximate triangle count for budget tracking. */
  approxTris: number;
  parts: BuildPart[];
  /** Optional morph target sets keyed by state name. */
  morphSets?: Record<string, string[]>; // state → list of part names
}

// ---------------------------------------------------------------------------
// Trait types
// ---------------------------------------------------------------------------

export type TraitId =
  | "CRUMPLE"
  | "PROP_STALL"
  | "GROUND_EFFECT"
  | "SNAP_ROLL"
  | "SONIC_CONE"
  | "RE_ENTRY_BURN"
  | "THERMAL_LOCK"
  | "DRAFT_WAKE"
  | "ORBITAL_SKIP"
  | "REBIRTH_GLIDE"
  | "SCATTER_SHIELD"
  | "TEMPORAL_ECHO"
  | "REFOLD_IN_FLIGHT"
  | "SUBMERSION";

/** Structured bonus/penalty data for each trait. All values are multipliers
 *  or flat additions; the sim reads these directly. */
export interface TraitEffect {
  id: TraitId;
  /** Human-readable one-liner shown in the hangar. */
  description: string;
  /** Flat or percentage stat deltas applied while this plane is active.
   *  Key = stat name (matches GDD §2 stat names), value = delta (e.g. 0.05 = +5%). */
  statDeltas?: Partial<{
    fuelSeconds: number;    // +5% fuel
    turnRate: number;       // +5% turn
    boostAccel: number;     // +5% boost
    drag: number;           // -18% drag
    glideRatio: number;     // +15% glide
    launchSpeed: number;    // -10% launch
    topSpeed: number;       // +10% speed
  }>;
  /** Triggered / situational effects handled by the sim or game loop. */
  triggers?: Partial<{
    /** CRUMPLE: morph target bend on hit, permanent per-run pitch authority debuff. */
    crumplePitchPenaltyPerHit: number;        // radians of authority lost
    /** PROP_STALL: speed threshold (fraction of stall) below which warning fires. */
    propStallThreshold: number;
    /** GROUND_EFFECT: altitude ceiling (m) and lift bonus (fraction). */
    groundEffectAltitude: number;
    groundEffectLiftBonus: number;
    /** SNAP_ROLL: invuln window (s) and nitro cost (fraction). */
    snapRollInvulnSeconds: number;
    snapRollNitroCost: number;
    snapRollDuration: number;
    /** SONIC_CONE: min speed multiplier to activate, pickup collect radius (m). */
    sonicConeMinSpeedMult: number;
    sonicConePickupRadius: number;
    /** RE_ENTRY_BURN: min pitch and min speed to activate, drag reduction. */
    reEntryBurnMinPitch: number;              // rad, negative = nose down
    reEntryBurnMinSpeedMult: number;
    reEntryBurnDragReduction: number;
    /** THERMAL_LOCK: pull radius (m) toward strongest updraft. */
    thermalLockPullRadius: number;
    /** DRAFT_WAKE: ribbon lifetime (s) and speed bonus (fraction). */
    draftWakeRibbonSeconds: number;
    draftWakeSpeedBonus: number;
    /** ORBITAL_SKIP: zero-g window (s), biome restriction. */
    orbitalSkipDuration: number;
    orbitalSkipBiome: string;
    /** REBIRTH_GLIDE: teleport distance (m), invuln (s), speed burst (fraction). */
    rebirthTeleportDistance: number;
    rebirthInvulnSeconds: number;
    rebirthSpeedBurst: number;
    /** SCATTER_SHIELD: boid count, birds per hit, return time (s). */
    scatterBoidCount: number;
    scatterBirdsPerHit: number;
    scatterReturnSeconds: number;
    scatterSpeedLossPerBird: number;
    /** TEMPORAL_ECHO: rewind buffer (frames), charges per run, recharge condition. */
    temporalRewindFrames: number;
    temporalChargesPerRun: number;
    /** REFOLD_IN_FLIGHT: trigger count per run, animation duration (s). */
    refoldUsesPerRun: number;
    refoldDuration: number;
    /** SUBMERSION: max depth duration (s), buoyancy multiplier, burst on surface. */
    submersionMaxSeconds: number;
    submersionCoinMult: number;
    submersionSurfaceBurst: number;
    submersionAltitudeCeiling: number;        // m above water surface
  }>;
}

// ---------------------------------------------------------------------------
// Palette defaults
// ---------------------------------------------------------------------------

export interface PaletteDefaults {
  primary: string;    // hex
  secondary: string;
  accent: string;
  canopy: string;
  emissive?: string;
}

// ---------------------------------------------------------------------------
// Evolve ceremony descriptor
// ---------------------------------------------------------------------------

export interface EvolveCeremony {
  /** One-line description of the morph animation shown during evolution. */
  animation: string;
  /** Duration in seconds. */
  durationSeconds: number;
}

// ---------------------------------------------------------------------------
// Core Plane interface
// ---------------------------------------------------------------------------

export interface Plane {
  /** Unique string key used in save data and URLs. */
  id: string;
  /** Display tier (0–9 = base, P1–P4 = post-prestige). */
  tier: number;
  /** "P1"–"P4" for prestige planes, undefined for base tiers. */
  prestigeTier?: "P1" | "P2" | "P3" | "P4";
  /** Display name. */
  name: string;
  /**
   * Total upgrade level required to unlock (sum of all 13 upgrade tracks).
   * GDD §6 base table values; prestige planes use special unlock conditions.
   */
  unlockAtTotalLevel: number;
  /** Special unlock condition description (overrides level gate for prestige planes). */
  unlockCondition?: string;
  /** Trait: one gameplay mechanic introduced by this plane. */
  trait: TraitEffect;
  /** Per-material-slot colour defaults. */
  palette: PaletteDefaults;
  /**
   * Primitive build specification — the renderer assembles these parts into
   * the plane's silhouette. No three.js types leak into this data layer.
   */
  buildSpec: BuildSpec;
  /** Ceremony played when the player evolves INTO this plane. Undefined for tier 0. */
  evolveCeremony?: EvolveCeremony;
}

// ---------------------------------------------------------------------------
// PLANES array (14 entries)
// ---------------------------------------------------------------------------

export const PLANES: Plane[] = [
  // -------------------------------------------------------------------------
  // Tier 0 — Paper Dart
  // -------------------------------------------------------------------------
  {
    id: "paper_dart",
    tier: 0,
    name: "Paper Dart",
    unlockAtTotalLevel: 0,
    trait: {
      id: "CRUMPLE",
      description:
        "A hit bends a wing (morph target), permanently warping pitch authority for that run. Teaches consequences before shields exist.",
      triggers: {
        crumplePitchPenaltyPerHit: 0.04, // ~2.3° authority lost per hit
      },
    },
    palette: {
      primary: "#f3ecdf",   // off-white paper
      secondary: "#e8dfd0",
      accent: "#c8bfb0",
      canopy: "#f3ecdf",
    },
    buildSpec: {
      approxTris: 120,
      parts: [
        {
          name: "fuselage-slab",
          kind: "box",
          dims: [0.12, 0.04, 1.0],
          offset: [0, 0, 0],
          material: "paper",
        },
        {
          name: "left-wing",
          kind: "box",
          dims: [0.55, 0.015, 0.45],
          offset: [-0.28, 0, 0.1],
          rotation: [0, 0, 0.08],
          material: "paper",
        },
        {
          name: "right-wing",
          kind: "box",
          dims: [0.55, 0.015, 0.45],
          offset: [0.28, 0, 0.1],
          rotation: [0, 0, -0.08],
          material: "paper",
        },
        {
          name: "crease-left",
          kind: "box",
          dims: [0.45, 0.01, 0.38],
          offset: [-0.22, 0.02, 0.1],
          rotation: [0, 0, 0.12],
          material: "paper",
          isMorphTarget: true,
          fx: "crumple-bend-left",
        },
        {
          name: "crease-right",
          kind: "box",
          dims: [0.45, 0.01, 0.38],
          offset: [0.22, 0.02, 0.1],
          rotation: [0, 0, -0.12],
          material: "paper",
          isMorphTarget: true,
          fx: "crumple-bend-right",
        },
      ],
      morphSets: {
        "crumple-left": ["crease-left"],
        "crumple-right": ["crease-right"],
      },
    },
    // No evolveCeremony — first plane, player starts here.
  },

  // -------------------------------------------------------------------------
  // Tier 1 — Kite Biplane
  // -------------------------------------------------------------------------
  {
    id: "kite_biplane",
    tier: 1,
    name: "Kite Biplane",
    unlockAtTotalLevel: 8,
    trait: {
      id: "PROP_STALL",
      description:
        "Below 1.3× stall speed the prop visibly slows and the engine coughs — an audio pre-stall warning disguised as flavor.",
      triggers: {
        propStallThreshold: 1.3,
      },
    },
    palette: {
      primary: "#e8735a",   // coral
      secondary: "#f5d76e",  // butter
      accent: "#f3ecdf",
      canopy: "#f3ecdf",
    },
    buildSpec: {
      approxTris: 350,
      parts: [
        {
          name: "fuselage",
          kind: "box",
          dims: [0.18, 0.18, 0.9],
          offset: [0, 0, 0],
          material: "fabric",
        },
        {
          name: "upper-wing",
          kind: "box",
          dims: [1.0, 0.03, 0.32],
          offset: [0, 0.18, 0.1],
          material: "fabric",
        },
        {
          name: "lower-wing",
          kind: "box",
          dims: [0.85, 0.03, 0.28],
          offset: [0, -0.04, 0.1],
          material: "fabric",
        },
        {
          name: "tail",
          kind: "box",
          dims: [0.4, 0.18, 0.18],
          offset: [0, 0, -0.48],
          material: "fabric",
        },
        {
          name: "pilot-body",
          kind: "sphere",
          dims: [0.09],
          offset: [0, 0.2, 0.2],
          material: "primary",
        },
        {
          name: "pilot-head",
          kind: "sphere",
          dims: [0.06],
          offset: [0, 0.28, 0.2],
          material: "secondary",
        },
        {
          name: "prop",
          kind: "box",
          dims: [0.5, 0.04, 0.04],
          offset: [0, 0, 0.47],
          material: "accent",
          fx: "prop-spin-by-speed",
        },
        {
          name: "scarf",
          kind: "box",
          dims: [0.04, 0.04, 0.25],
          offset: [0, 0.22, 0.08],
          material: "accent",
          fx: "ribbon-flutter",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Paper dart unfolds flat then re-origamis into the Biplane (2 s paper-fold morph).",
      durationSeconds: 2.0,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 2 — Puddle Jumper
  // -------------------------------------------------------------------------
  {
    id: "puddle_jumper",
    tier: 2,
    name: "Puddle Jumper",
    unlockAtTotalLevel: 20,
    trait: {
      id: "GROUND_EFFECT",
      description:
        "Within 15 m of terrain, lift +12%. A real aero phenomenon; rewards skimming. +5% fuel.",
      statDeltas: {
        fuelSeconds: 0.05,
      },
      triggers: {
        groundEffectAltitude: 15,
        groundEffectLiftBonus: 0.12,
      },
    },
    palette: {
      primary: "#7ecfc0",   // mint
      secondary: "#f3ecdf",
      accent: "#e8735a",
      canopy: "#a8ddd4",
    },
    buildSpec: {
      approxTris: 280,
      parts: [
        {
          name: "fuselage",
          kind: "cylinder",
          dims: [0.14, 0.18, 0.85, 8],
          offset: [0, 0, 0],
          rotation: [Math.PI / 2, 0, 0],
          material: "primary",
        },
        {
          name: "high-wing",
          kind: "box",
          dims: [1.1, 0.028, 0.36],
          offset: [0, 0.2, 0.05],
          material: "primary",
          fx: "mint-stripe-uv",
        },
        {
          name: "tail-fin-v",
          kind: "box",
          dims: [0.06, 0.22, 0.2],
          offset: [0, 0.1, -0.42],
          material: "primary",
        },
        {
          name: "tail-fin-h",
          kind: "box",
          dims: [0.35, 0.04, 0.18],
          offset: [0, 0, -0.42],
          material: "secondary",
        },
        {
          name: "tail-fin-h2",
          kind: "box",
          dims: [0.25, 0.04, 0.14],
          offset: [0, 0.06, -0.44],
          material: "secondary",
        },
        {
          name: "antenna",
          kind: "cylinder",
          dims: [0.008, 0.008, 0.12, 4],
          offset: [0.08, 0.25, 0.1],
          material: "accent",
          fx: "spring-bob",
        },
        {
          name: "prop",
          kind: "box",
          dims: [0.48, 0.04, 0.04],
          offset: [0, 0, 0.44],
          material: "accent",
          fx: "prop-spin-by-speed",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Wings fold flat, fuselage thickens, cockpit seals — clay squash morph over 1.8 s.",
      durationSeconds: 1.8,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 3 — Hornet
  // -------------------------------------------------------------------------
  {
    id: "hornet",
    tier: 3,
    name: "Hornet",
    unlockAtTotalLevel: 34,
    trait: {
      id: "SNAP_ROLL",
      description:
        "Tap boost while banking for a 0.18 s snap roll, 0.4 s invuln, threading narrower gaps. Costs 8% nitro. +5% turn.",
      statDeltas: {
        turnRate: 0.05,
      },
      triggers: {
        snapRollDuration: 0.18,
        snapRollInvulnSeconds: 0.4,
        snapRollNitroCost: 0.08,
      },
    },
    palette: {
      primary: "#f5d76e",   // butter
      secondary: "#2c3e6b", // navy
      accent: "#e8735a",
      canopy: "#6ba8c8",
    },
    buildSpec: {
      approxTris: 420,
      parts: [
        {
          name: "fuselage",
          kind: "lathe",
          dims: [0, 8],     // renderer expands lathe points from profile key
          offset: [0, 0, 0],
          material: "primary",
          instanceParams: { profileKey: "hornet-lathe" },
        },
        {
          name: "radial-engine",
          kind: "instancedMesh",
          dims: [7],         // 7 cylinders
          offset: [0, 0, 0.42],
          material: "metal",
          instanceParams: {
            subKind: "cylinder",
            subDims: "0.04,0.04,0.12,6",
            ringRadius: 0.14,
          },
          fx: "radial-ring-spin",
        },
        {
          name: "swept-wing-left",
          kind: "quad",
          dims: [0.6, 0.32],
          offset: [-0.3, -0.02, 0.05],
          rotation: [0, 0.15, 0],
          material: "primary",
        },
        {
          name: "swept-wing-right",
          kind: "quad",
          dims: [0.6, 0.32],
          offset: [0.3, -0.02, 0.05],
          rotation: [0, -0.15, 0],
          material: "primary",
        },
        {
          name: "canopy-dome",
          kind: "sphere",
          dims: [0.1],
          offset: [0, 0.12, 0.15],
          material: "canopy",
        },
        {
          name: "tail-v",
          kind: "box",
          dims: [0.05, 0.28, 0.22],
          offset: [0, 0.12, -0.4],
          material: "secondary",
        },
        {
          name: "tail-h-left",
          kind: "box",
          dims: [0.26, 0.04, 0.16],
          offset: [-0.14, 0.02, -0.4],
          material: "secondary",
        },
        {
          name: "tail-h-right",
          kind: "box",
          dims: [0.26, 0.04, 0.16],
          offset: [0.14, 0.02, -0.4],
          material: "secondary",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Prop retracts, nose sharpens, wings sweep back with a smoke trail — 2.2 s morph.",
      durationSeconds: 2.2,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 4 — Swift Jet
  // -------------------------------------------------------------------------
  {
    id: "swift_jet",
    tier: 4,
    name: "Swift Jet",
    unlockAtTotalLevel: 50,
    trait: {
      id: "SONIC_CONE",
      description:
        "Above 2× stall a shock-cone fans out; pickups inside auto-collect (free magnet at speed). +5% boost.",
      statDeltas: {
        boostAccel: 0.05,
      },
      triggers: {
        sonicConeMinSpeedMult: 2.0,
        sonicConePickupRadius: 8,
      },
    },
    palette: {
      primary: "#2c3e6b",   // navy
      secondary: "#f3ecdf",
      accent: "#e8735a",
      canopy: "#6ba8c8",
      emissive: "#ff7033",  // afterburner
    },
    buildSpec: {
      approxTris: 360,
      parts: [
        {
          name: "fuselage",
          kind: "cylinder",
          dims: [0.1, 0.13, 1.1, 8],
          offset: [0, 0, 0],
          rotation: [Math.PI / 2, 0, 0],
          material: "primary",
        },
        {
          name: "t-tail-v",
          kind: "box",
          dims: [0.05, 0.3, 0.22],
          offset: [0, 0.16, -0.5],
          material: "secondary",
        },
        {
          name: "t-tail-h",
          kind: "box",
          dims: [0.46, 0.04, 0.18],
          offset: [0, 0.3, -0.5],
          material: "secondary",
        },
        {
          name: "engine-pod-left",
          kind: "cylinder",
          dims: [0.06, 0.07, 0.4, 6],
          offset: [-0.22, -0.04, -0.1],
          rotation: [Math.PI / 2, 0, 0],
          material: "metal",
        },
        {
          name: "engine-pod-right",
          kind: "cylinder",
          dims: [0.06, 0.07, 0.4, 6],
          offset: [0.22, -0.04, -0.1],
          rotation: [Math.PI / 2, 0, 0],
          material: "metal",
        },
        {
          name: "afterburner",
          kind: "cylinder",
          dims: [0.05, 0.01, 0.18, 6],
          offset: [0, 0, -0.58],
          rotation: [Math.PI / 2, 0, 0],
          material: "emissive",
          fx: "afterburner-flicker",
        },
        {
          name: "sonic-cone",
          kind: "cone",
          dims: [0.0, 0.5, 0.8, 24],
          offset: [0, 0, 0.55],
          rotation: [Math.PI / 2, 0, 0],
          material: "canopy",
          fx: "sonic-cone-scale-by-speed",
        },
        {
          name: "wing-left",
          kind: "quad",
          dims: [0.55, 0.22],
          offset: [-0.28, -0.02, 0.05],
          rotation: [0, 0.05, 0],
          material: "primary",
        },
        {
          name: "wing-right",
          kind: "quad",
          dims: [0.55, 0.22],
          offset: [0.28, -0.02, 0.05],
          rotation: [0, -0.05, 0],
          material: "primary",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "T-tail retracts, twin engine pods bloom out, fuselage shimmers through a wireframe dissolve — 2 s.",
      durationSeconds: 2.0,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 5 — Comet
  // -------------------------------------------------------------------------
  {
    id: "comet",
    tier: 5,
    name: "Comet",
    unlockAtTotalLevel: 68,
    trait: {
      id: "RE_ENTRY_BURN",
      description:
        "Steep dive (pitch < −0.25 rad) above 1.8× stall: leading edges glow, drag −18%. Makes power-dives a tactic. +10% boost, −5% glide.",
      statDeltas: {
        boostAccel: 0.10,
        glideRatio: -0.05,
      },
      triggers: {
        reEntryBurnMinPitch: -0.25,
        reEntryBurnMinSpeedMult: 1.8,
        reEntryBurnDragReduction: 0.18,
      },
    },
    palette: {
      primary: "#2c3e6b",   // navy
      secondary: "#7ecfc0",  // mint
      accent: "#f5d76e",
      canopy: "#a0c8e0",
      emissive: "#ff9944",  // ember glow
    },
    buildSpec: {
      approxTris: 300,
      parts: [
        {
          name: "fuselage",
          kind: "cylinder",
          dims: [0.08, 0.12, 1.0, 6],
          offset: [0, 0, 0],
          rotation: [Math.PI / 2, 0, 0],
          material: "primary",
        },
        {
          name: "delta-wing-left",
          kind: "quad",
          dims: [0.62, 0.44],
          offset: [-0.2, -0.01, 0.05],
          rotation: [0, 0.22, 0],
          material: "secondary",
        },
        {
          name: "delta-wing-right",
          kind: "quad",
          dims: [0.62, 0.44],
          offset: [0.2, -0.01, 0.05],
          rotation: [0, -0.22, 0],
          material: "secondary",
        },
        {
          name: "ember-stream",
          kind: "instancedMesh",
          dims: [30],
          offset: [0, 0, -0.5],
          material: "emissive",
          instanceParams: {
            subKind: "sphere",
            subDims: "0.015",
          },
          fx: "gpu-ember-stream-pitch-speed",
        },
        {
          name: "leading-edge-glow",
          kind: "box",
          dims: [1.3, 0.01, 0.04],
          offset: [0, 0, 0.12],
          material: "emissive",
          fx: "emissive-driven-pitch-speed",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Wings bloom open from fuselage slits in a slow wingspan unfurl — 2.4 s.",
      durationSeconds: 2.4,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 6 — Albatross
  // -------------------------------------------------------------------------
  {
    id: "albatross",
    tier: 6,
    name: "Albatross",
    unlockAtTotalLevel: 86,
    trait: {
      id: "THERMAL_LOCK",
      description:
        "Inside a thermal, auto-centers on the strongest updraft (12 m pull); lateral drift damped. Pays off Thermal Wings. +15% glide, −10% launch.",
      statDeltas: {
        glideRatio: 0.15,
        launchSpeed: -0.10,
      },
      triggers: {
        thermalLockPullRadius: 12,
      },
    },
    palette: {
      primary: "#f3ecdf",
      secondary: "#2c3e6b",
      accent: "#7ecfc0",
      canopy: "#6ba8c8",
    },
    buildSpec: {
      approxTris: 380,
      parts: [
        {
          name: "body",
          kind: "cylinder",
          dims: [0.08, 0.12, 0.65, 6],
          offset: [0, 0, 0],
          rotation: [Math.PI / 2, 0, 0],
          material: "primary",
        },
        {
          name: "wide-wing-left",
          kind: "box",
          dims: [0.85, 0.025, 0.38],
          offset: [-0.44, 0, 0.06],
          material: "primary",
          isMorphTarget: true,
          fx: "flex-lift-sin",
        },
        {
          name: "wide-wing-right",
          kind: "box",
          dims: [0.85, 0.025, 0.38],
          offset: [0.44, 0, 0.06],
          material: "primary",
          isMorphTarget: true,
          fx: "flex-lift-sin",
        },
        {
          name: "wingtip-left",
          kind: "box",
          dims: [0.14, 0.08, 0.16],
          offset: [-0.9, 0.04, 0.06],
          rotation: [0, 0, 0.18],
          material: "secondary",
        },
        {
          name: "wingtip-right",
          kind: "box",
          dims: [0.14, 0.08, 0.16],
          offset: [0.9, 0.04, 0.06],
          rotation: [0, 0, -0.18],
          material: "secondary",
        },
        {
          name: "tail-v",
          kind: "box",
          dims: [0.04, 0.24, 0.2],
          offset: [0, 0.1, -0.35],
          material: "secondary",
        },
        {
          name: "tail-h",
          kind: "box",
          dims: [0.32, 0.04, 0.16],
          offset: [0, 0, -0.35],
          material: "primary",
        },
      ],
      morphSets: {
        "wing-flex": ["wide-wing-left", "wide-wing-right"],
      },
    },
    evolveCeremony: {
      animation:
        "Wings shatter into fragments that re-form the delta of Nova — glass-break shader, 2.6 s.",
      durationSeconds: 2.6,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 7 — Nova
  // -------------------------------------------------------------------------
  {
    id: "nova",
    tier: 7,
    name: "Nova",
    unlockAtTotalLevel: 104,
    trait: {
      id: "DRAFT_WAKE",
      description:
        "Leaves two mint vortex ribbons for 3 s; flying your own or ghost's wake = +6% speed. Hooks the ghost system. +10% speed.",
      statDeltas: {
        topSpeed: 0.10,
      },
      triggers: {
        draftWakeRibbonSeconds: 3.0,
        draftWakeSpeedBonus: 0.06,
      },
    },
    palette: {
      primary: "#2c3e6b",
      secondary: "#7ecfc0",  // mint
      accent: "#e8735a",
      canopy: "#6ba8c8",
      emissive: "#7ecfc0",  // mint flame
    },
    buildSpec: {
      approxTris: 440,
      parts: [
        {
          name: "fuselage",
          kind: "cylinder",
          dims: [0.1, 0.14, 0.82, 8],
          offset: [0, 0, 0],
          rotation: [Math.PI / 2, 0, 0],
          material: "primary",
        },
        {
          name: "delta-left",
          kind: "quad",
          dims: [0.7, 0.5],
          offset: [-0.22, -0.01, 0.1],
          rotation: [0, 0.28, 0],
          material: "secondary",
        },
        {
          name: "delta-right",
          kind: "quad",
          dims: [0.7, 0.5],
          offset: [0.22, -0.01, 0.1],
          rotation: [0, -0.28, 0],
          material: "secondary",
        },
        {
          name: "tail-fork-left",
          kind: "box",
          dims: [0.06, 0.04, 0.28],
          offset: [-0.1, 0, -0.42],
          rotation: [0, 0.12, 0],
          material: "primary",
        },
        {
          name: "tail-fork-right",
          kind: "box",
          dims: [0.06, 0.04, 0.28],
          offset: [0.1, 0, -0.42],
          rotation: [0, -0.12, 0],
          material: "primary",
        },
        {
          name: "flame-left",
          kind: "cone",
          dims: [0.06, 0.0, 0.22, 8],
          offset: [-0.1, 0, -0.56],
          rotation: [Math.PI / 2, 0, 0],
          material: "emissive",
          fx: "twin-flame-merge-boost",
        },
        {
          name: "flame-right",
          kind: "cone",
          dims: [0.06, 0.0, 0.22, 8],
          offset: [0.1, 0, -0.56],
          rotation: [Math.PI / 2, 0, 0],
          material: "emissive",
          fx: "twin-flame-merge-boost",
        },
        {
          name: "vortex-ribbon-left",
          kind: "quad",
          dims: [0.06, 1.0],
          offset: [-0.35, 0, -0.2],
          material: "emissive",
          fx: "trail-ribbon-mesh",
        },
        {
          name: "vortex-ribbon-right",
          kind: "quad",
          dims: [0.06, 1.0],
          offset: [0.35, 0, -0.2],
          material: "emissive",
          fx: "trail-ribbon-mesh",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Flames cool, hull whitens — heat-ceramic cooling animation, 2.4 s.",
      durationSeconds: 2.4,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 8 — Starliner
  // -------------------------------------------------------------------------
  {
    id: "starliner",
    tier: 8,
    name: "Starliner",
    unlockAtTotalLevel: 118,
    trait: {
      id: "ORBITAL_SKIP",
      description:
        "In Stratosphere, boost+pull-up = 0.9 s zero-g (RCS puffs), hops thin-air stall pockets. Immune to thin-air lift penalty.",
      triggers: {
        orbitalSkipDuration: 0.9,
        orbitalSkipBiome: "stratosphere",
      },
    },
    palette: {
      primary: "#f3ecdf",
      secondary: "#2c3e6b",
      accent: "#7ecfc0",
      canopy: "#4a90c8",
      emissive: "#a0d8f8",
    },
    buildSpec: {
      approxTris: 500,
      parts: [
        {
          name: "fuselage",
          kind: "lathe",
          dims: [0, 12],
          offset: [0, 0, 0],
          material: "primary",
          instanceParams: { profileKey: "starliner-lathe" },
        },
        {
          name: "fin-top",
          kind: "quad",
          dims: [0.22, 0.3],
          offset: [0, 0.22, -0.22],
          rotation: [0, 0, Math.PI / 2],
          material: "secondary",
        },
        {
          name: "fin-bottom",
          kind: "quad",
          dims: [0.22, 0.3],
          offset: [0, -0.22, -0.22],
          rotation: [0, 0, -Math.PI / 2],
          material: "secondary",
        },
        {
          name: "fin-left",
          kind: "quad",
          dims: [0.22, 0.3],
          offset: [-0.22, 0, -0.22],
          material: "secondary",
        },
        {
          name: "fin-right",
          kind: "quad",
          dims: [0.22, 0.3],
          offset: [0.22, 0, -0.22],
          material: "secondary",
        },
        {
          name: "canopy",
          kind: "sphere",
          dims: [0.12],
          offset: [0, 0.13, 0.18],
          material: "canopy",
        },
        {
          name: "rcs-emitter-0",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [0.18, 0, 0.1],
          material: "emissive",
          fx: "rcs-puff",
        },
        {
          name: "rcs-emitter-1",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [-0.18, 0, 0.1],
          material: "emissive",
          fx: "rcs-puff",
        },
        {
          name: "rcs-emitter-2",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [0, 0.18, 0.1],
          material: "emissive",
          fx: "rcs-puff",
        },
        {
          name: "rcs-emitter-3",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [0, -0.18, 0.1],
          material: "emissive",
          fx: "rcs-puff",
        },
        {
          name: "rcs-emitter-4",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [0.18, 0, -0.22],
          material: "emissive",
          fx: "rcs-puff",
        },
        {
          name: "rcs-emitter-5",
          kind: "cylinder",
          dims: [0.02, 0.02, 0.06, 4],
          offset: [-0.18, 0, -0.22],
          material: "emissive",
          fx: "rcs-puff",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Hull shards burn gold and reassemble mid-air — rising-fire phoenix animation, 3 s.",
      durationSeconds: 3.0,
    },
  },

  // -------------------------------------------------------------------------
  // Tier 9 — Phoenix
  // -------------------------------------------------------------------------
  {
    id: "phoenix",
    tier: 9,
    name: "Phoenix",
    unlockAtTotalLevel: 130,
    unlockCondition: "All 13 upgrades at level 10 (all-max).",
    trait: {
      id: "REBIRTH_GLIDE",
      description:
        "On revive: teleport 80 m back along path, 2 s invuln, +40% speed. Makes crashing near storms a tactic.",
      triggers: {
        rebirthTeleportDistance: 80,
        rebirthInvulnSeconds: 2.0,
        rebirthSpeedBurst: 0.40,
      },
    },
    palette: {
      primary: "#e8735a",   // coral
      secondary: "#f5d76e",  // butter
      accent: "#f3ecdf",
      canopy: "#ff9944",
      emissive: "#ff6622",
    },
    buildSpec: {
      approxTris: 650,
      parts: [
        {
          name: "body",
          kind: "lathe",
          dims: [0, 12],
          offset: [0, 0, 0],
          material: "primary",
          instanceParams: { profileKey: "phoenix-bird-lathe" },
        },
        {
          name: "wing-left",
          kind: "quad",
          dims: [0.75, 0.55],
          offset: [-0.3, 0.04, 0.08],
          rotation: [0, 0.18, 0.06],
          material: "secondary",
          isMorphTarget: true,
          fx: "feather-scallop-morph",
        },
        {
          name: "wing-right",
          kind: "quad",
          dims: [0.75, 0.55],
          offset: [0.3, 0.04, 0.08],
          rotation: [0, -0.18, -0.06],
          material: "secondary",
          isMorphTarget: true,
          fx: "feather-scallop-morph",
        },
        {
          name: "tail-feathers",
          kind: "quad",
          dims: [0.4, 0.36],
          offset: [0, 0.06, -0.45],
          material: "accent",
          isMorphTarget: true,
          fx: "ripple-emissive-trailing",
        },
        {
          name: "contrail",
          kind: "quad",
          dims: [0.18, 1.4],
          offset: [0, 0, -0.65],
          material: "emissive",
          fx: "coral-butter-contrail",
        },
        {
          name: "fire-halo",
          kind: "instancedMesh",
          dims: [16],
          offset: [0, 0.04, 0],
          material: "emissive",
          instanceParams: {
            subKind: "sphere",
            subDims: "0.03",
            ringRadius: 0.22,
          },
          fx: "fire-halo-orbit",
        },
      ],
      morphSets: {
        "wing-up": ["wing-left", "wing-right"],
        "feather-ripple": ["tail-feathers"],
      },
    },
    evolveCeremony: {
      animation:
        "Final tier — no further cert. Unlocks a permanent golden contrail and fire-halo hangar backdrop.",
      durationSeconds: 4.0,
    },
  },

  // =========================================================================
  // Post-prestige planes (P1–P4)
  // =========================================================================

  // -------------------------------------------------------------------------
  // P1 — Flock Collective
  // -------------------------------------------------------------------------
  {
    id: "flock_collective",
    tier: 10,
    prestigeTier: "P1",
    name: "Flock Collective",
    unlockAtTotalLevel: 130,
    unlockCondition: "Complete Prestige 1 (Re-fold). Unlocked when Phoenix fire cools and silhouette fractures into 12 wheeling starlings.",
    trait: {
      id: "SCATTER_SHIELD",
      description:
        "The plane is 12 boids; a hit scatters 2–4 birds (−3% speed each, return over 4 s). Fly to zero and still glide. Graceful damage instead of binary shields.",
      triggers: {
        scatterBoidCount: 12,
        scatterBirdsPerHit: 3,   // average; 2–4 range handled in sim
        scatterReturnSeconds: 4.0,
        scatterSpeedLossPerBird: 0.03,
      },
    },
    palette: {
      primary: "#2c3e6b",
      secondary: "#f3ecdf",
      accent: "#7ecfc0",
      canopy: "#7ecfc0",
    },
    buildSpec: {
      approxTris: 240,
      parts: [
        {
          name: "boid-flock",
          kind: "instancedMesh",
          dims: [12],
          offset: [0, 0, 0],
          material: "primary",
          instanceParams: {
            subKind: "quad",
            subDims: "0.12,0.06",
            // Each boid = 2 quad wings. Renderer doubles for wing pair.
            boidsLoop: "cheap",
          },
          fx: "boid-flock-simulation",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Phoenix fire cools; silhouette fractures into 12 wheeling starlings — 3 s scatter-dissolve.",
      durationSeconds: 3.0,
    },
  },

  // -------------------------------------------------------------------------
  // P2 — Chrono Shard
  // -------------------------------------------------------------------------
  {
    id: "chrono_shard",
    tier: 11,
    prestigeTier: "P2",
    name: "Chrono Shard",
    unlockAtTotalLevel: 130,
    unlockCondition: "Complete Prestige 2. Hangar clock spins back, air cracks, plane assembles from time-shards.",
    trait: {
      id: "TEMPORAL_ECHO",
      description:
        "On a hit, rewind the plane 1.4 s (84-frame ring buffer); world stays forward. 2 charges/run, recharge on a clean 5-ring chain. Changes the risk calculus of tight gaps.",
      triggers: {
        temporalRewindFrames: 84,   // 1.4 s at 60 fps
        temporalChargesPerRun: 2,
      },
    },
    palette: {
      primary: "#7ecfc0",   // mint
      secondary: "#f3ecdf",
      accent: "#2c3e6b",
      canopy: "#a8ddd4",
    },
    buildSpec: {
      approxTris: 280,
      parts: [
        {
          name: "icosahedron-hull",
          kind: "icosahedron",
          dims: [0.38, 1],
          offset: [0, 0, 0],
          material: "primary",
        },
        {
          name: "screen-distortion-overlay",
          kind: "quad",
          dims: [2.0, 2.0],
          offset: [0, 0, 0.8],  // screen-space, renderer handles projection
          material: "canopy",
          fx: "screen-distort-on-rewind",
        },
        {
          name: "ghost-pose",
          kind: "icosahedron",
          dims: [0.38, 1],
          offset: [0, 0, 0],
          material: "secondary",
          fx: "alpha-ghost-pre-rewind",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "Hangar clock spins back, air cracks, Chrono Shard assembles from time-shards — 3.2 s.",
      durationSeconds: 3.2,
    },
  },

  // -------------------------------------------------------------------------
  // P3 — Origami Phoenix
  // -------------------------------------------------------------------------
  {
    id: "origami_phoenix",
    tier: 12,
    prestigeTier: "P3",
    name: "Origami Phoenix",
    unlockAtTotalLevel: 130,
    unlockCondition: "Complete Prestige 3. The tier-0 Paper Dart animates forward and folds itself up into this — a callback to the start.",
    trait: {
      id: "REFOLD_IN_FLIGHT",
      description:
        "Once/run, boost+trick triggers a 1.2 s refold: optimizes shape for current speed (wide glide form or tight dart). Locked for the run. One-shot read-the-room decision.",
      triggers: {
        refoldUsesPerRun: 1,
        refoldDuration: 1.2,
      },
    },
    palette: {
      primary: "#f3ecdf",   // paper
      secondary: "#e8735a",
      accent: "#f5d76e",
      canopy: "#f3ecdf",
      emissive: "#ff9944",
    },
    buildSpec: {
      approxTris: 380,
      parts: [
        // Glide manta morph set
        {
          name: "glide-manta-wing-left",
          kind: "quad",
          dims: [0.9, 0.55],
          offset: [-0.3, 0, 0.06],
          rotation: [0, 0.1, 0],
          material: "paper",
          isMorphTarget: true,
        },
        {
          name: "glide-manta-wing-right",
          kind: "quad",
          dims: [0.9, 0.55],
          offset: [0.3, 0, 0.06],
          rotation: [0, -0.1, 0],
          material: "paper",
          isMorphTarget: true,
        },
        // Dart morph set
        {
          name: "dart-wing-left",
          kind: "box",
          dims: [0.5, 0.015, 0.42],
          offset: [-0.26, 0, 0.08],
          rotation: [0, 0, 0.08],
          material: "paper",
          isMorphTarget: true,
        },
        {
          name: "dart-wing-right",
          kind: "box",
          dims: [0.5, 0.015, 0.42],
          offset: [0.26, 0, 0.08],
          rotation: [0, 0, -0.08],
          material: "paper",
          isMorphTarget: true,
        },
        {
          name: "body",
          kind: "box",
          dims: [0.1, 0.06, 0.9],
          offset: [0, 0, 0],
          material: "paper",
        },
        {
          name: "ember-dots",
          kind: "instancedMesh",
          dims: [20],
          offset: [0, 0, -0.3],
          material: "emissive",
          instanceParams: {
            subKind: "sphere",
            subDims: "0.012",
          },
          fx: "ember-dot-emissive-paper",
        },
      ],
      morphSets: {
        "glide-form": ["glide-manta-wing-left", "glide-manta-wing-right"],
        "dart-form": ["dart-wing-left", "dart-wing-right"],
      },
    },
    evolveCeremony: {
      animation:
        "Tier-0 Paper Dart animates forward and folds itself up into the Origami Phoenix — 3 s paper-fold callback.",
      durationSeconds: 3.0,
    },
  },

  // -------------------------------------------------------------------------
  // P4 — Deep Cartography Sub-Wing (final secret)
  // -------------------------------------------------------------------------
  {
    id: "deep_cartography_sub_wing",
    tier: 13,
    prestigeTier: "P4",
    name: "Deep Cartography Sub-Wing",
    unlockAtTotalLevel: 130,
    unlockCondition:
      "Unlock all 30 achievements. A crate labeled DO NOT OPEN appears in the hangar; tap it → a tiny sub taxis onto the slingshot.",
    trait: {
      id: "SUBMERSION",
      description:
        "Diving within 6 m of water submerges you up to 4 s: buoyancy replaces lift, coins become 3× glowing fish, birds can't follow, surfacing = +20% burst. The only plane that rewards flying into water.",
      triggers: {
        submersionMaxSeconds: 4.0,
        submersionAltitudeCeiling: 6,
        submersionCoinMult: 3.0,
        submersionSurfaceBurst: 0.20,
      },
    },
    palette: {
      primary: "#2c5f6b",   // deep teal
      secondary: "#f3ecdf",
      accent: "#7ecfc0",
      canopy: "#4ab8c8",
      emissive: "#44ddcc",
    },
    buildSpec: {
      approxTris: 580,
      parts: [
        {
          name: "hull",
          kind: "box",
          dims: [0.28, 0.2, 1.0],
          offset: [0, 0, 0],
          material: "primary",
          instanceParams: { cornerRadius: 0.06 },
        },
        {
          name: "conning-tower",
          kind: "box",
          dims: [0.12, 0.2, 0.26],
          offset: [0, 0.2, 0.12],
          material: "primary",
        },
        {
          name: "ballast-pod-left",
          kind: "cylinder",
          dims: [0.06, 0.06, 0.42, 6],
          offset: [-0.2, -0.06, 0.1],
          rotation: [Math.PI / 2, 0, 0],
          material: "secondary",
        },
        {
          name: "ballast-pod-right",
          kind: "cylinder",
          dims: [0.06, 0.06, 0.42, 6],
          offset: [0.2, -0.06, 0.1],
          rotation: [Math.PI / 2, 0, 0],
          material: "secondary",
        },
        {
          name: "portholes",
          kind: "instancedMesh",
          dims: [10],
          offset: [0, 0, 0],
          material: "canopy",
          instanceParams: {
            subKind: "cylinder",
            subDims: "0.04,0.04,0.02,8",
            layoutKey: "porthole-grid",
          },
          fx: "porthole-glow-underwater",
        },
        {
          name: "teal-fog-overlay",
          kind: "quad",
          dims: [2.0, 2.0],
          offset: [0, 0, 0.9],
          material: "emissive",
          fx: "teal-underwater-fog-caustic",
        },
        {
          name: "fish-swarm",
          kind: "instancedMesh",
          dims: [24],
          offset: [0, 0, 0],
          material: "emissive",
          instanceParams: {
            subKind: "quad",
            subDims: "0.06,0.03",
          },
          fx: "fish-instanced-swarm",
        },
      ],
    },
    evolveCeremony: {
      animation:
        "A crate labeled DO NOT OPEN taxis open; a tiny sub rolls onto the slingshot — secret reveal, 4 s.",
      durationSeconds: 4.0,
    },
  },
];

// ---------------------------------------------------------------------------
// Convenience lookup helpers
// ---------------------------------------------------------------------------

/** Get a plane by its string id. Returns undefined if not found. */
export function getPlaneById(id: string): Plane | undefined {
  return PLANES.find((p) => p.id === id);
}

/** Get the plane unlocked at or below a given total upgrade level. */
export function getPlaneForLevel(totalLevel: number): Plane {
  // Walk backwards through base tiers (0–9) only; prestige planes have
  // separate unlock conditions.
  const base = PLANES.filter((p) => p.prestigeTier === undefined);
  for (let i = base.length - 1; i >= 0; i--) {
    if (totalLevel >= base[i].unlockAtTotalLevel) return base[i];
  }
  return base[0]; // Paper Dart fallback
}
