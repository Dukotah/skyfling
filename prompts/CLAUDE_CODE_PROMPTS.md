> **Superseded 2026-10-02** by `prompts/FABLE_BUILD_PROMPTS.md` (foundation-first). Kept for history; do not run these.

# Claude Code prompts — run in order (model: Opus)

Setup once: unzip this kit into an empty folder, `git init`, create the GitHub repo `Dukotah/skyfling`, push, connect it to Vercel (Framework: Vite). Then open Claude Code in the folder and paste these one at a time. Each prompt is self-contained; Claude Code reads CLAUDE.md automatically.

---
## Prompt 1 — Scaffold + first deploy
Read CLAUDE.md and docs/ROADMAP.md. Execute Phase 0 completely: Vite + TypeScript + three.js project, ESLint, vitest, a Playwright smoke test at 390×844 with touch, PWA manifest + service worker, vercel.json, README with run instructions. Boot screen should render an HDRI-lit sky with a placeholder plane rotating. Commit after each item with messages naming the roadmap item. Finish by running `npm run build` and `npm run smoke` and reporting results. Do not ask me questions; record any choices in docs/DECISIONS.md.

## Prompt 2 — Rendering foundation
Execute Phase 1 of docs/ROADMAP.md following docs/ART.md exactly. Download the assets listed in docs/ASSETS.md into public/ (verify licenses, write public/CREDITS.txt). Port terrain generation from legacy/skyfling-v5-prototype.html (`groundY`, `biomeAt`, chunk streaming) into src/world with vertex colors and triplanar detail textures. Add Water, Sky, stars, lens flare, bloom/SSAO post stack with quality tiers. Deliver a free-fly camera demo route (`/#debug-fly`) that moves through Green Meadow and Blue Coast. Run the smoke test and commit per item.

## Prompt 3 — Gameplay port
Execute Phase 2. Port the flight model, launch/perfect-zone logic, pickups, collision, storm fronts, camera and all "feel" items from the legacy prototype into the new architecture (sim/ world/ render/ ui/). Write vitest tests that lock the balance numbers in docs/GDD.md §2 using legacy/balance-sim.js as the oracle. Load the plane tiers from the downloaded packs with paint material slots. Ship the complete loop: hangar → aim → fly → results, with 3 biomes live. Commit per item; push; report the Vercel preview URL.

## Prompt 4 — Systems
Execute Phase 3: versioned save with export/import, all 13 upgrades, hangar tabs, missions engine with every type in GDD §9, daily chest, 30 achievements, ghost of best flight, combo and near-miss, tricks, landing bullseye, results card with share image. Commit per item; push.

## Prompt 5 — World
Execute Phase 4: all 12 biomes from GDD §4 with their landmarks, hazards, pickup bias and night variants; all six soft-wall types from §5; audio (SFX from Kenney packs, music beds per biome mood, engine loop); weekly challenge map; gadgets and prestige. Screenshot every biome at 390×844 into docs/screens/ and list them in docs/DECISIONS.md. Commit per item; push.

## Prompt 6 — Polish & perf
Execute Phase 5. Profile with the Playwright trace and chrome devtools protocol; enforce the performance budget in docs/ART.md; add LOD, KTX2 textures, quality auto-detect. Build the 3-card first-flight tutorial, settings, accessibility options. Run a Lighthouse PWA audit and fix everything red. Tag v1.0.0, push, and write docs/RELEASE_NOTES.md.

---
## Iteration prompts (after v1.0)
- "Play-test report: [paste what felt wrong]. Diagnose against docs/GDD.md, propose 3 fixes with expected effect on the balance tests, implement the best one, push."
- "Add a biome: [name, mood, landmark, hazard]. Follow the biome template in src/world/biomes and GDD §4. Screenshot it."
- "Add a plane tier between [X] and [Y] using [pack model]. Update evolve thresholds so total levels stay evenly spaced."
