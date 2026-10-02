# Skyfling — Game Design Document

## 1. Core loop (why it's addictive)
1. **Aim & fling** (3 s): drag back on the slingshot, a sliding gold zone on the power bar rewards timing with a PERFECT launch (+16–32% speed, streak-scaled). Skill from the first second.
2. **Fly** (10 s → 5 min): the plane trims itself level; the player's thumb trades altitude for speed, threads boost rings, rides thermals, pops balloons, dodges birds, and **boosts through storm fronts**. A second thumb holds BOOST (nitro).
3. **Land** (3 s): results card counts up coins, mission payouts, storm bonuses, combo bonuses, landing bullseye. "+312 m past your best" is the hook line.
4. **Spend** (20 s): upgrades feel immediate. Every 3–6 flights the plane *evolves* into a new model. Paint, gadgets, missions, daily chest.
5. Repeat. Session target: 6–12 flights, 8–15 minutes. Day-2 retention hooks: daily chest streak, three rotating missions, weekly challenge map, ghost of your best flight to beat.

The reference game's magic is the moment an upgrade carries you past a wall you were stuck at. Everything below is in service of manufacturing that moment every 10–15 minutes.

## 2. Flight model (port from legacy `simStep`, keep these numbers)
- State: speed `s`, pitch `a`, yaw, roll, position, fuel, nitro, shields.
- Lift factor `liftF = clamp((s - 0.6·stall)/(0.4·stall), 0, 1)`.
- Auto-trim: target pitch `at = clamp(0.02 + (s − 1.3·stall)·0.003, −0.03, 0.2)`; pitch drifts to `at` with strength `(1−|input|)·0.9·liftF`. The plane climbs under power and glides level when the engine is off. Player input adds on top. **This is what makes it easy to pick up.**
- Stall: when `liftF < 1` the nose drops at `(1−liftF)·1.2 rad/s` and sink is `(1−liftF)·7 m/s`. Gentle, recoverable with a dive.
- Speed: `ds = −g·sin(a) − drag·s² + thrust + boost − 0.5·|steer|`.
- Vertical: `vy = s·sin(a)·(0.4+0.6·liftF) − (s/glideRatio + 1.5)·liftF − (1−liftF)·7`.
- Stats (per upgrade level L, 0–10):
  - launch speed `34 + 6.5·L_launcher`
  - stall speed `14 − 0.6·L_wings`, glide ratio `7 + 0.9·L_wings`
  - drag `0.0028 / (1+0.08·L_wings) / (1+0.1·L_body)`
  - thrust `5 + 2.2·L_engine`, fuel seconds `2.5 + 1.4·L_fuel`
  - boost accel `16 + 1.2·L_nitro + 0.5·L_engine`, starting nitro `0.4 + 0.06·L_nitro`, drain `0.3/(1+0.08·L_nitro)` per s
  - turn rate `1.4 + 0.08·L_body`
  - shields at start `floor((L_armor+2)/3)` (0,1,1,1,2,2,2,3,3,3,4)
  - magnet radius `5 + 2.2·L_magnet`, coin value `×(1+0.07·L_luck)`, rare spawn `×(1+0.1·L_luck)`
- Launch from a cliff edge: ground drops 22 m over the first 15–95 m.
- Landing: hard crash if `(pitch − slope) < −0.6 && s > 20` or `vy < −28`; shield converts a crash into a bounce. Water = splashdown (safe, ends run, counts as clean landing). Lava = crash.
- Verified targets (balance-sim.js): stock ≈ 290 m / 11 s; all-5 ≈ 2.5 km; all-10 ≈ 7.4 km / ~5 min. Keep within ±15% after porting; add vitest assertions.

## 3. Controls
- Aim: drag down to pull, sideways to aim yaw. Dotted trajectory preview. Power bar with moving gold zone (center `0.8 + 0.14·sin(2.1t)`, half-width 0.055). Perfect = inside; Good = within 2.4× width.
- Fly, **primary scheme "Glide" (reference parity, default)**: one thumb anywhere. Hold = nose up (pitch input ramps 0→+1 over 0.25 s), release = auto-trim glide/dive (pitch input ramps to −0.35 over 0.4 s, then the auto-trim takes over). Horizontal drag while holding = bank (±1 over 160 px). A second thumb holds BOOST bottom-right (nitro ring around it). This is how Epic Plane Evolution plays: tap-and-hold to lift, let go to descend.
- Fly, **secondary scheme "Pilot"** (settings toggle): floating joystick anywhere (pitch up/down, bank left/right), smoothed at 9/s, invert option. Both schemes produce the same `FlightInput`, so the sim and balance are identical.
- Pause top-right. Keyboard: arrows/WASD or hold Space = climb, Shift = boost, P pause (desktop testing).
- Tricks (new): a full-circle joystick swipe = **barrel roll** (+8 coins, invulnerable 0.5 s); pull up through vertical = **loop** (+20 coins, costs speed). Trick multiplier ×1.5 if done within 1 s of a near-miss.

## 4. Biomes (12, cycle every 1,200 m; each has a signature landmark, hazard and pickup bias)
| # | Biome | Terrain | Landmarks | Hazard | Pickup bias |
|---|---|---|---|---|---|
| 1 | Green Meadow | rolling hills | windmills, farms, hot-air balloons | birds | thermals, balloons |
| 2 | Red Canyon | mesas, arches | arches you can fly through (+coins) | rockfall updraft bursts | rings in arches |
| 3 | Blue Coast | lakes, beach | lighthouse, sailboats, pier | seagull flocks | fuel cans over water |
| 4 | Golden Dunes | smooth dunes | pyramids, oasis, sandstorm band | sandstorm (soft wall) | thermals (hot) |
| 5 | Alpine Forest | steep valleys | ski lift cables (hazard), chalets | cables | shields |
| 6 | White Tundra | flat + ice spikes | frozen lake (splashdown = slide), aurora at night | ice crystals slow you | ×2 stars |
| 7 | Ash Volcano | rugged, lava pools | lava geysers (updraft + burn), smoke columns | lava, ash cloud (soft wall) | nitro crates |
| 8 | Neon City | flat, skyline | skyscrapers, billboards, blimps, rooftop rings | wind between towers | ring gauntlets |
| 9 | Sky Isles | ocean, floating islands | floating isles with rings, waterfalls | gusts | balloons, thermals |
| 10 | Jungle Ruins | dense canopy | temples, vine arches, waterfalls | toucan flocks | coins in arcs |
| 11 | Thunder Plateau | high mesa, dark sky | lightning rods, wind farm | persistent crosswind, lightning | shields, crates |
| 12 | Stratosphere | thin air above clouds | satellites, aurora, the curve of the horizon | thin air (less lift) | stars, ×2 |
Night variants of 1, 3, 8 appear on the weekly challenge. Biome transitions fade sky, fog, lighting and music over the last 14% of the segment.

## 5. Soft walls (the upgrade-gate moments)
Soft walls slow you, never stop you outright; they need speed, thrust or boost to punch through, and boosting cuts their drag by 70%. Breaking one for the first time pays a big bonus and spawns a permanent banner on the results card.
- **Storm front** (dark cloud wall, rain, lightning): drag `9 + 3.5·i`, downforce. At 500, 1150, 2050, 3200, 4700, 6600, 9000, 12000 m.
- **Sandstorm** (Dunes): horizontal push sideways + grit on screen; wider but weaker.
- **Ash cloud** (Volcano): drag + fuel burns 2× inside.
- **Crosswind corridor** (Thunder Plateau): constant yaw push; fight it with steering.
- **Thin air** (Stratosphere, above 400 m alt): lift ×0.6; a reason to climb only when upgraded.
- **Headwind gate** (any biome, mid-run): a visible ring of wind arrows; speed −30% unless you hit the gate's center (then +30%).
Design rule: every soft wall has a *skill answer* (boost timing, line choice, altitude) **and** an *upgrade answer*.

## 6. Planes (10, evolve by total upgrade level)
| Tier | Name | At total Lv | Silhouette / trait |
|---|---|---|---|
| 0 | Paper Dart | 0 | folded paper; floaty, fragile |
| 1 | Kite Biplane | 8 | fabric biplane, visible pilot; prop |
| 2 | Puddle Jumper | 20 | Cessna-like; prop; +5% fuel |
| 3 | Hornet | 34 | WW2 fighter; +5% turn |
| 4 | Swift Jet | 50 | light jet; afterburner; +5% boost |
| 5 | Comet | 68 | rocket plane; +10% boost, −5% glide |
| 6 | Albatross | 86 | glider, huge wingspan; +15% glide, −10% launch |
| 7 | Nova | 104 | delta wing, twin flames; +10% speed |
| 8 | Starliner | 118 | sleek spaceplane; immune to thin air |
| 9 | Phoenix | 130 (all max) | mythic; one free self-revive per flight |
Trait bonuses are small on purpose; evolution is mostly about the reveal (confetti, new silhouette, new engine sound). Paint jobs (12) apply to every tier via material slots `primary / secondary / accent / canopy`.

## 7. Upgrades (13, 10 levels each, cost `30·1.62^L`)
Launcher, Wings, Engine, Fuel tank, Airframe, Nitro, Armor, Magnet, Lucky charm (legacy nine) plus:
- **Thermal wings**: thermals lift 20–70% harder.
- **Storm plating**: soft-wall drag −4%/Lv.
- **Trick kit**: trick coins +10%/Lv, invuln window longer.
- **Coin radar**: shows coins/rings through terrain within 60–200 m.
Total 130 levels ≈ 76k coins ≈ 110 flights to max. Prestige after that (see §10).

## 8. Pickups & hazards
Coins (patterns: line, arc, sine, 3×3), boost rings (+14 speed, +nitro), fuel cans, thermals (updraft columns), balloons (bounce), shield orbs, ×2 stars (9 s), nitro crates, **coin fountains** (rare, 30 coins in a burst), **golden rings** (chain of 3; hit all = ×3 coins for 10 s). Hazards: birds (slow), cables, ice crystals, lava, lightning (Thunder Plateau: random strike zones telegraphed 1 s ahead; hit = −40% speed).

## 9. Missions, challenges, daily
- 3 active missions, auto-replace, difficulty from `floor(completed/3)`, reward `(30 + 0.09·best + 12·lvl)·k`. Types: distance, coins, rings, altitude, airtime, perfect launch, land past X, boost seconds, cans, updrafts, balloons, near-miss, combo, storm break, trick, biome-reach ("reach the Volcano").
- **Daily chest**: streak ×1.25/day up to 2.5×.
- **Weekly challenge map**: fixed seed + modifier (no fuel / double gravity / night / coin rush). Leaderboard is local (your best per week) with a shareable image.
- **Achievements** (30): titles shown in the hangar; e.g. Cloud Surfer (ride 50 thermals), Storm Breaker (all fronts), Untouchable (2 km no bird hits).

## 10. Long game
- **Prestige "Re-fold"**: at all-max, reset upgrades for a permanent +10% coin multiplier and a prestige paint. Max 5.
- **Gadgets** (equip 2 pre-flight, unlocked by achievements): parachute (safe landing anywhere), rocket pod (one 3 s mega-boost), coin radar+, lucky coin (first crash refunds 50% coins), glider wing (glide +10%).
- **Ghost**: your best flight replays as a translucent plane with a lead/trail readout. Beat it live.

## 11. Economy sanity (keep these true)
- A fresh player earns their first upgrade on flight 1 (≥30 coins).
- First evolution (Lv 8 total) by flight ~8–10.
- Storm #1 (500 m) breakable around total Lv 12–16 with boost; without boost ~Lv 20.
- No single upgrade ever gives <3% distance when bought alone at Lv 5.

## 12. Feel checklist (every one shipped)
Perfect-launch slow-mo + gold flash · ribbon contrails · FOV punch and camera shake on boost · screen flash and shockwave on crash · confetti on clean landing · callouts (PERFECT, NEW BEST, STORM BROKEN, SHIELD!) · count-up results · evolve ceremony with hangar lights · haptics (navigator.vibrate where available) · per-biome music bed + engine audio tied to throttle.
