# Skyfling — Design Bible

Curated from six parallel designer passes. This is the **buildable** creative canon: what we actually make, in what order. Where it conflicts with the raw ideation, this document wins. Where it conflicts with `GDD.md`, treat this as the forward plan and reconcile `GDD.md` to it as systems land.

**Palette (locked):** coral, butter, mint, navy, off-white paper `#f3ecdf`. Everything stays low-poly, flat-shaded where possible, under 150 draw calls in flight, 60 fps on iPhone 12.

**Curation rule:** keep ideas that (a) reuse systems we already have or plan, (b) read in 2 seconds on a phone screen, (c) add a *distinct* flight feel or emotional beat. Kill anything that needs a new render pass we can't afford, a server we won't run, or that duplicates an existing mechanic.

---

## 1. Final Plane Roster (14, evolve ladder)

Ties `GDD.md §6` (10 base tiers) to the post-prestige unlocks. Traits are small by design — evolution is mostly the reveal. Each trait teaches one thing the player will need later.

| Tier | Name | Trait (one new idea each) | Silhouette / build notes | Evolve ceremony |
|---|---|---|---|---|
| 0 | **Paper Dart** | CRUMPLE — a hit bends a wing (morph target), permanently warping pitch authority for that run. Teaches "hits have consequences" before shields exist. | 2 box slabs, paper `#f3ecdf`, roughness 1. Crease = diagonal EdgesGeometry. Pre-baked bent-left/bent-right morphs. ~120 tris. | Confetti poppers; dart unfolds flat then re-origamis into the Biplane (2 s paper fold). |
| 1 | **Kite Biplane** | PROP STALL — below 1.3× stall the prop visibly slows and the engine coughs (audio). A pre-stall warning disguised as flavor. | 4 boxes (fuselage, 2 wings, tail), sphere+cylinder pilot, coral scarf ribbon, pivot prop spun by speed. Fabric mat. ~350 tris. | Wings fold flat, fuselage thickens, cockpit seals → Puddle Jumper (clay squash morph). |
| 2 | **Puddle Jumper** | GROUND EFFECT — within 15 m of terrain, lift +12%. A real aero phenomenon; rewards skimming. +5% fuel. | Teardrop CylinderGeometry fuselage, flat high wing, 3 box fins, mint stripe via UV, spring-bob antenna. ~280 tris. | Prop retracts, nose elongates, wings sweep → Hornet (Cessna-to-fighter morph). |
| 3 | **Hornet** | SNAP ROLL — tap boost while banking = 0.18 s snap roll, 0.4 s invuln, threads narrower gaps. Costs 8% nitro. +5% turn. | Lathe fuselage, 7-cylinder radial as InstancedMesh ring, swept quads, physical-material canopy dome. ~420 tris. | Radial implodes, nose sharpens, wings sweep (smoke trail) → Swift Jet. |
| 4 | **Swift Jet** | SONIC CONE — above 2× stall a shock-cone shader fans out; pickups inside it auto-collect (free magnet at speed). +5% boost. | Elongated 8-sided cylinder, T-tail, 2 engine pods, emissive afterburner, transparent ShaderMaterial cone scaled by speed. ~360 tris. | T-tail retracts, twin pods appear → Comet (wireframe shimmer-dissolve). |
| 5 | **Comet** | RE-ENTRY BURN — steep dive (pitch < −0.25) above 1.8× stall: leading edges glow, drag −18%. Makes power-dives a tactic. +10% boost, −5% glide. | Thin 6-sided cylinder, 2 delta quads, 30-point GPU ember stream, emissive driven by pitch×speed. ~300 tris. | Wings bloom open from fuselage slits → Albatross (slow wingspan unfurl). |
| 6 | **Albatross** | THERMAL LOCK — inside a thermal, auto-centers on the strongest updraft (12 m pull); lateral drift damped. Pays off Thermal Wings. +15% glide, −10% launch. | Tiny body, 2 wide flat planks + angled wingtip boxes, morph-target flex driven by lift×sin(t). ~380 tris. | Wings shatter into fragments that re-form the delta of Nova (glass-break shader). |
| 7 | **Nova** | DRAFT WAKE — leaves two mint vortex ribbons for 3 s; flying your own (or your ghost's) wake = +6% speed. Hooks the ghost system. +10% speed. | Stubby octagonal fuselage, forked tail, delta quads, twin flames that merge at boost>0.8, 2 trail-ribbon meshes. ~440 tris. | Flames cool, hull whitens → Starliner (heat-ceramic cooling anim). |
| 8 | **Starliner** | ORBITAL SKIP — in Stratosphere, boost+pull-up = 0.9 s zero-g (RCS puffs), hops thin-air stall pockets. Immune to thin-air lift penalty. | Lathe profile fuselage, X-arranged raked fins, cobalt physical-material canopy, 6 RCS puff emitters. ~500 tris. | Hull shards burn gold and reassemble mid-air → Phoenix (rising fire). |
| 9 | **Phoenix** | REBIRTH GLIDE — the GDD self-revive, upgraded: on revive, teleport 80 m back along the path, 2 s invuln, +40% speed. Makes crashing near storms a tactic. | Bird-like lathe body, 2 curved feather-scalloped quads, rippling emissive trailing edges, wide coral→butter contrail. ~650 tris. | Final tier. No further cert — unlocks a permanent golden contrail + fire-halo hangar backdrop. |
| P1 | **Flock Collective** | SCATTER SHIELD — the plane is 12 boids; a hit scatters 2–4 birds (−3% speed each, return over 4 s). Fly to zero and still glide. Rings threaded by center-of-mass. Graceful damage instead of binary shields. | 12× InstancedMesh bird (2 quads each), cheap boids loop. ~240 tris. | Post-prestige-1. Phoenix fire cools; silhouette fractures into 12 wheeling starlings. |
| P2 | **Chrono Shard** | TEMPORAL ECHO — on a hit, rewind the plane 1.4 s (84-frame ring buffer); world stays forward. 2 charges/run, recharge on a clean 5-ring chain. Changes the risk calculus of tight gaps. | Faceted Icosahedron (detail 1), flat mint metal, 0.4 s screen-distortion overlay, alpha-ghost of pre-rewind pose. ~280 tris. | Post-prestige-2. Hangar clock spins back, air cracks, plane assembles from time-shards. |
| P3 | **Origami Phoenix** | REFOLD IN FLIGHT — once/run, boost+trick triggers a 1.2 s refold: optimizes shape for current speed (wide glide form or tight dart). Locked for the run. One-shot read-the-room decision. | Two morph sets (glide manta / dart), paper `#f3ecdf` with ember-dot emissive. ~380 tris. | Post-prestige-3. The tier-0 Paper Dart animates forward and folds itself up into this — a callback to the start. |
| P4 | **Deep Cartography Sub-Wing** | SUBMERSION — diving within 6 m of water submerges you up to 4 s: buoyancy replaces lift, coins become 3× glowing fish, birds can't follow, surfacing = +20% burst. The only plane that rewards flying *into* water. Reframes Blue Coast / Sky Isles / Coral Cathedral. | Rounded box hull, conning tower, 2 ballast-tank pods, 10 porthole discs, teal underwater fog + caustic overlay, fish InstancedMesh. ~580 tris. | **Final secret.** Unlocked by all 30 achievements. A crate labeled DO NOT OPEN appears in the hangar; tap it → a tiny sub taxis onto the slingshot. |

**Cut from the raw roster:** *Stained Glass Seraph* (needs a per-plane SpotLight cookie + decal projection — too costly on mobile and overlaps the Light Column idea nobody else needed), *Kite Whale* (comedy value real but it's a strictly-worse flight feel and the enormous silhouette fights our terrain-clip budget — reborn instead as the **Cloudback Whale Pod** setpiece and the **Sky-Creature Migration** biome). *Wildcard planes* (thundercloud, mirror-plane, vine, black-hole) all require world-query/reflection refactors — parked; the black-hole gravity idea survives as the **Dead Star Graveyard** biome.

---

## 2. Final Biome Roster (16)

Keeps the 12 from `GDD.md §4` (Green Meadow, Red Canyon, Blue Coast, Golden Dunes, Alpine Forest, White Tundra, Ash Volcano, Neon City, Sky Isles, Jungle Ruins, Thunder Plateau, Stratosphere) and adds the **4 strongest new worlds** below as late-game / special-rotation segments. The baseline 12 are documented in the GDD table and not repeated here.

New worlds — each chosen because it changes the *axis* of play (vertical, ceiling-capped, living terrain, or physics-inverted) and reuses an existing system:

| # | Name | Mood | Signature wow / landmark | Hazard | Pickup bias | Dynamic element | Build notes |
|---|---|---|---|---|---|---|---|
| 13 | **Inside the Thunderhead** | Oppressive, electric, vertical | **The Eye** — a 120 m calm cylinder lit by a perfect circle of blue sky; thread it for 150 coins + boost reset | Charge cells telegraph a corona ring, then fire 8-ray lightning (−1 shield) | shield orbs in calm pockets; nitro at updraft peaks | Storm "breathes": updraft columns pulse on a 4 s cycle; a pressure wave every 90 s slams altitude physics for 3 s | Near-black purple FogExp2 0.018, 2 cloud-sprite layers (additive), icosa-wireframe charge cells, radial LineSegments discharge, bloom threshold 0.6. **Vertical flight is the primary axis** — inverts the loop. |
| 14 | **The Collapsing Sky-City** | Grand, calamitous, kinetic | **The Grand Spire** — a 300 m clocktower that topples at the 900 m mark every run, firing 5 debris rings; thread all 5 = "Last Bell" (×3 coins, 15 s) | Falling masonry on readable ballistic arcs (4–6 active) | coins on tilting faces; fuel in broken windows | Ambient dust thickens over the run; by 1 km visibility −30% (coin radar becomes essential) | Buildings = InstancedMesh blocks (4 types, 1 draw call each). Debris = ~12 pre-computed bezier arcs (seeded → ghost-valid). Spire = keyframed pivot at the 900 m trigger. Physics-driven geometry, not weather. Under 150 draw calls. |
| 15 | **The Sky-Creature Migration** | Awe, living, time-pressured | **The Alpha Whale** — a 450 m bioluminescent sky-whale; fly its full underside clean = "Shadow Run" (200 coins, full fuel + nitro) | Tail slaps telegraph 2 s ahead (shadow on terrain below) | boost rings in creature wakes; coins along their backs | Migration heading curves 15° over 800 m, slowly closing your entry lane (time pressure, no timer) | Whales/mantas = InstancedMesh on CatmullRom paths with per-instance phase; alpha = single 3× emissive mesh. 3 instanced draw calls total. The terrain is *alive and semi-predictable*. |
| 16 | **Coral Cathedral — The Drowned City** | Serene, submerged, discovery | **The Cathedral** — fly the 12 m rose window for 150 coins; dome air-pocket = instant full fuel | Eel lunges from windows (telegraph glow 1 s ahead) | coins in street grids; shields in domes; air-pocket refuels | Tidal surge every 40 s raises the surface 12 m, submerging landmarks and opening new corridors | Reuse `THREE.Water` at Y=0; below-0 flight = 3× drag + caustic overlay + teal fog. Eel = repurposed geyser extrude. **Below-surface = opt-in risk/reward zone**, and the perfect home biome for the Sub-Wing plane. |

**Why these four and not the rest:** they each pair with a plane trait or an owned system (Thunderhead ↔ vertical/thermal play, Sky-City ↔ seeded ghost replay, Migration ↔ Whale Pod setpiece, Coral Cathedral ↔ Sub-Wing + `THREE.Water`). 

**Strong runners-up kept on the shelf** (build if time allows, in this order): *Bioluminescent Midnight Cavern* and *Mycelium Network* (both ceiling-capped horizontal-weave worlds — great feel, but two underground worlds is one too many for v1; pick one later), *Aurora Engine Room* (music-reactive scoring — superb but it's really a **mode**, folded into the Juice/rhythm hooks), *Paper-Craft Diorama* (on-brand but aesthetically it's Green Meadow with a pop-up gimmick — hold as a reskin).

**Cut:** *Inside the Sleeping Giant* (gorgeous but a hand-authored anatomy heightfield is a lot of bespoke art for one segment), *Upside-Down Ocean* / *Mirror Cascade* / *Dead Star Graveyard* / *Frozen Timepiece* / *Painter's Canvas* / *Neon Fossil Beds* / *Origami Storm* (all cost a new physics mode or post-process and overlap worlds we're keeping — park). *All wildcards* (Möbius, dream-glitch, inside-a-speaker, glacier-calving) parked as weekly-challenge experiments.

---

## 3. Mechanics & Modes (prioritized)

Ranked by wow-per-effort. P0 = ship first.

**P0 — cheap, high-impact, reuse the sim directly:**
1. **Terrain Graze** (low-flying speed multiplier) — within 6 m of terrain, speed bonus scales up to +28% at 1 m. ~40 lines; clearance is already sampled. Inverts the "sky is safe" meta into fast/low/risky. *Also the sim backbone for Ground Effect (Puddle Jumper) and the Cloud Bridge setpiece.*
2. **Bull's-Eye Gating** — the existing headwind gate becomes 3 concentric rings (mint +30 / butter +55 / coral +90 % + nitro refill). ~60 lines, reuses the ring mesh. Adds a precision axis for free.
3. **Altitude Banking** — above 120 m, climb deposits "altitude coins"; a steep dive cashes them at 1.5× as a collectible coin shower. Makes the GDD's silent altitude-for-speed trade *visible and lootable*. Reuses the sprite pool.
4. **Drafting Slipstream** — fly within 8 m of your ghost's *contrail* for 2 s = +12% speed. Turns the ghost into an active system; creates the "follow for safety vs. deviate to improve" tension. ~120 lines.

**P1 — high-value, moderate effort:**
5. **Photo Mode** — freeze, OrbitControls free-cam, 4 filter LUTs, `canvas.toBlob()` → Web Share. ~200 lines. Turns our art direction into free marketing; forces every biome to look good from any angle.
6. **Daily Seeded Gauntlet** — midnight-UTC seed → 3 biomes + 1 of 20 twist rules (no-boost, triple gravity, reversed controls, etc.), scored with a twist multiplier. Shareable PNG, **no server** (`floor(Date.now()/86400000)` XOR salt). The social hook with real skill variety.
7. **Storm Surfing** — a 12 m edge-band outside each storm wall gives +22% speed and refills nitro; drift in or out and it's gone. A third answer (navigation) to soft walls, separating experts from upgraders. ~80 lines.
8. **Thermal Stack Racing** — chain thermals within 180 m for a stacking ×1.5→×2.5 launch; max stack catapults you to Stratosphere *without* the Starliner — a skill route to upgrade-gated content.

**P2 — strong, do after the core is juicy:**
9. **Split-Line Time Attack** — silent 500 m splits with +/− deltas vs. your best, segment records, shareable split table. Sim-racing self-coaching UX. Reuses gate ring mesh.
10. **Zen Endless** — no hazards/stalls/fail, infinite world, slow-mo breath, generative ambient. Serves the meditative player and doubles as a low-stakes coin grind. A `zenMode` flag over the modular spawners.
11. **Boss Rush** — 5 scripted 30 s hazard gauntlets (Volcano Titan, Canyon Rockfall, Neon Grid, Tundra Blizzard, Thunder Gauntlet), each a ~100-line timeline reusing existing hazard meshes. Yields prestige tokens. The endgame skill test for maxed players.

**P3 — big surface area, later:**
12. **Co-op Ghost Relay** — encode end-state as a ~20-char code; a friend resumes mid-air from it; combined distance. Async co-op, zero networking.
13. **Create-a-Level Editor** — side-view grid, place terrain/hazards/pickups/biome tags, export a ~40-char code, self-scaling difficulty (plays with the importer's own upgrades). The longest-tail retention hook; feeds the existing chunk system directly.

**Grapple ("Slingshot Echo") — DEFERRED.** Great idea (mid-air pendulum re-launch off anchor points) but it needs anchor tagging per biome, swing physics, and a new control affordance. Revisit after P1; it's the most likely P2→feature promotion if the core loop needs more depth.

**Mechanic wildcards parked:** Magnetic Runway, Biome Inversion Night (easy weekly toggle — likely promote), Sonic Boom Gate (fun jackpot, tie to Swift Jet's sonic cone later), Wind Organ (audio easter egg).

---

## 4. Meta & Secrets (prioritized)

Ranked by emotional payoff per line of code. All no-server except where flagged.

1. **The Mechanic's Ghost** (P0) — a silent ~200-tri NPC in the hangar reacting to crash/streak/evolve/max-upgrade via an 8-animation state machine, plus handwritten sticky notes at streaks. Turns dead time into a relationship. The spine that most other meta hangs off (logbook handwriting, letters, field reports).
2. **Prestige Contrail Memory** (P0) — a single `u_prestigeLevel` uniform on the existing contrail shader: white → mint → +coral → +gold → braid → aurora. The ghost inherits it, so prestige is worn in the sky. Zero draw calls.
3. **The Flight Log Book** (P1) — a DOM/2D illuminated journal: route maps, hand-lettered distances, per-biome ink sketches (12 SVGs), margin notes in the mechanic's hand. Converts stats into memory. Reads from localStorage; zero flight cost.
4. **The Cartographer's Secret** (P1) — 1 hidden postcard stamp per biome; all 12 reveal the secret **Cloud Atoll** biome (hold altitude 8 s above the Stratosphere ceiling). Player-driven discovery, reuses Sky Isles terrain.
5. **Solar Clock** (P1) — feed real local solar elevation into the existing Preetham `Sky` uniform; once-a-year solstice aurora / golden-sky events. ~8 lines of math + one LUT. Every session looks different.
6. **The Golden Ratio Rings** (P2) — 5 fixed-position butter rings across biomes, each demanding a specific flight technique; thread all 5 clean in one run = permanent +7% coins + logbook constellation. Each ring is a self-contained skill lesson.
7. **The Quiet Passenger** (P2) — a paper bird on your wingtip that evolves with your tier/prestige and, at Prestige-5, flies off to lead you to Cloud Atoll and never returns. A silent emotional arc; morph-target GLTF, ~60–180 tris.
8. **Wreckage Archaeology** (P2) — hard crashes leave persistent wreckage props at their coordinates; 10 → a cairn, 20 → a flag; Phoenix tier burns them all away. Failure as world-building. InstancedMesh + localStorage.
9. **Biome Weather Memory** (P2) — storm fronts remember your break/fail counts via 2 shader uniforms: broken fronts brighten and thin, failed ones darken and swell. Soft walls become antagonists with memory.
10. **The Tuning Fork** (P3) — music adapts to your play-style (Dreamer/Daredevil/Trickster/Ace) via GainNode stems; a shareable archetype badge. 12 stem files to start.
11. **The Paparazzo Drone** (P3) — auto-captures the most photogenic frame of a run (drama×landmark×action) to a postcard on the results screen. ~1.3 MB render target, released after export.

**Server-touching (one justified exception, P3, strictly optional):** *Message in a Bottle* — a weekly 16-char balloon message via a free Cloudflare Worker KV, profanity-filtered, fails gracefully to a normal balloon offline. Only build if everything above ships and the no-server rule gets a deliberate one-time waiver. *Deserter's Return* and *Mirror Sky (camera-feed horizon)* are kept as delight experiments but are P3+.

---

## 5. Setpieces (scripted encounters)

Timeline-driven choreographers (~100 lines each) that reuse existing hazard meshes and physics. Telegraph → event → reward. Trigger on total-distance milestones once unlocked.

1. **The Rival Ace** (P0) — a mirror-plane (your tier +1, inverted palette) blitzes past with a DOM taunt bubble and races you to a pre-spawned finish arch. Beat it = ×3 coins 10 s + confetti; lose = it drops a consolation golden ring. PVP *feel* with zero server — a spline follower + one proximity trigger. Re-appears every ~1,800 m at Lv 15+.
2. **Cloudback Whale Pod** (P1) — 3 sky-whales breach the cloud layer; ride their wide thermal wakes to clear the next soft wall from above. 3 s along a spine = "Whale Rider" (×2 coins 8 s). Reuses the thermal system. *This is where the cut Kite-Whale charm lives.*
3. **Collapsing Cloud Bridge** (P1) — a flat cloud plateau cracks into tiles that calve 2 s after you pass; Frogger-style island-hop with a ground-effect lift bonus. Falling isn't a crash — and it reveals a hidden ring gauntlet beneath for rule-breakers. Reuses Terrain Graze + ring spawner.
4. **Meteor Surf** (P2) — 8–12 meteors each punch a 3 s speed corridor you thread by tilting nose-up to ~45° (inverts flight posture). A super-meteor's shadow = "Shadow Surf" coin fountain. Capsule-overlap test in the sim step.
5. **Wind Tunnel Canyon Chase** (P2) — terrain constricts to a 30 m slot canyon with a mandatory +40% wind; real wall collision (clip = −1 shield, not a crash); a barrel roll zeroes lateral momentum to make the final hairpin. The rollercoaster that makes open sky feel euphoric after.
6. **Solar Eclipse Stillness** (P2) — the sky dims to midnight-coral for 20 s (lerp the Sky sun elevation), ambient cuts to engine+wind, hidden 3× star-coins appear, one giant Eclipse Ring spawns in your path; thread it to "break" the eclipse. Uses the sky itself as gameplay. Pairs with Solar Clock.

---

## 6. Juice (feel) — the always-on layer

Everything in `GDD.md §12` ships, plus these curated adds. Juice is not optional; it is the product.

**From the GDD (keep all):** perfect-launch slow-mo + gold flash · ribbon contrails · boost FOV punch + shake · crash screen-flash + shockwave · clean-landing confetti · callouts (PERFECT / NEW BEST / STORM BROKEN / SHIELD!) · count-up results · evolve ceremony with hangar lights · haptics (`navigator.vibrate`) · per-biome music bed + throttle-tied engine audio.

**Curated additions:**
- **Crumple deformation** — the Paper Dart literally bends on each hit (morph target). Physical, visible damage feedback; makes no-hit runs feel earned.
- **Prop-RPM audio proxy** (Biplane) — prop slows + engine coughs before a stall. Teach by sound.
- **Shock/sonic cone shader** (Swift Jet) — visible speed; doubles as a pickup magnet.
- **Re-entry / ember glow** (Comet, Phoenix) — emissive driven by pitch×speed; dives look dangerous and fast.
- **Wake vortex ribbons** (Nova) — mint vortices you can chase.
- **Draft/slipstream callout** — "SLIPSTREAM" when you ride a wake or ghost trail.
- **Bull's-eye "Gate Perfect" flash** — screen flash + callout on a center-ring hit.
- **Rhythm/beat-synced flourishes** — fold the cut Aurora-Engine-Room idea in here: on biomes with a strong beat, contrail pulses and pickup chimes land on the beat. Optional sync bonus later.
- **Eclipse / solstice sky swaps** — rare, screenshot-worthy, once-a-year.
- **Mechanic reactions + sticky notes** — juice that lives between runs.
- **Auto-captured "best moment" postcard** (Paparazzo, later) — juice that leaves the app.

---

## 7. BUILD ORDER (max wow-per-effort on mobile web)

Assumes the Phase-0 scaffold and the ported sim/balance from `legacy/`. Build top-down; each tier should be shippable and phone-tested before the next.

**Tier A — core loop juice (do first; tiny code, huge feel):**
1. Terrain Graze (also unblocks Ground Effect + Cloud Bridge).
2. Bull's-Eye Gating.
3. Altitude Banking.
4. Prestige Contrail Memory (one shader uniform).
5. The Mechanic's Ghost (the hangar NPC — anchors all later meta).

**Tier B — the first "wow" beats:**
6. The Rival Ace setpiece.
7. Photo Mode (marketing flywheel).
8. Drafting Slipstream (makes the ghost active).
9. Storm Surfing.

**Tier C — new worlds (biggest art spend; one at a time, profile each):**
10. Inside the Thunderhead (vertical axis; reuses thermals + fog + bloom).
11. The Collapsing Sky-City (instanced + seeded, ghost-valid).
12. Coral Cathedral + the Deep Cartography Sub-Wing plane (underwater pair).
13. The Sky-Creature Migration + the Cloudback Whale Pod setpiece.

**Tier D — retention & long game:**
14. Daily Seeded Gauntlet.
15. The Flight Log Book + Cartographer's Secret (Cloud Atoll) + The Quiet Passenger.
16. Thermal Stack Racing + the P1/P2 planes gated behind prestige (Flock, Chrono Shard, Origami Phoenix).
17. Split-Line Time Attack, Zen Endless, Solar Clock.

**Tier E — endgame & community (ship when the base is solid):**
18. Boss Rush (+ prestige tokens).
19. Golden Ratio Rings, Wreckage Archaeology, Biome Weather Memory.
20. Co-op Ghost Relay, Create-a-Level Editor.
21. The Tuning Fork, Paparazzo Drone, remaining setpieces (Meteor Surf, Wind Tunnel, Eclipse).
22. (Only with an explicit no-server waiver) Message in a Bottle.

**Deferred / parked:** Grapple (Slingshot Echo); runner-up biomes (one underground world, Paper-Craft reskin); all plane and world wildcards; Deserter's Return; Mirror Sky.

---

*Final counts: 14 planes · 16 biomes · 13 mechanics/modes · 11 meta/secrets (+1 server-optional) · 6 setpieces.*
