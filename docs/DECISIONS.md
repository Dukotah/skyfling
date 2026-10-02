# Decisions log
Dated choices made where the spec left room. Newest first.

- 2026-10-02 (creative direction): **docs/DESIGN_BIBLE.md created** — curated six designer passes into the buildable canon. Final roster locked: **14 planes** (10 GDD tiers + 4 post-prestige: Flock Collective, Chrono Shard, Origami Phoenix, Sub-Wing) and **16 biomes** (12 GDD + Inside the Thunderhead, Collapsing Sky-City, Sky-Creature Migration, Coral Cathedral). Plus prioritized mechanics/modes, meta/secrets, setpieces, juice, and a wow-per-effort BUILD ORDER.

- 2026-10-02 (Phase 0 scaffold): **PWA tooling** — used `vite-plugin-pwa` (Workbox `generateSW`) instead of a hand-written service worker. It precaches the hashed `dist/` output automatically (`globPatterns` cover js/css/html/images and the later glb/hdr/ogg/ktx2), handles cache cleanup, and ships `registerSW({immediate})`. `maximumFileSizeToCacheInBytes` raised to 6 MB for the Phase 1+ 3D/audio assets.
- 2026-10-02 (Phase 0): **three.js r0.169** (latest stable at setup). Env lighting for the boot scene comes from `RoomEnvironment` (procedural) as a stand-in; the real Poly Haven HDRI lands in Phase 1 per docs/ASSETS.md. Visible sky uses the `Sky` (Preetham) addon now.
- 2026-10-02 (Phase 0): **Boot scene** is a stylized low-poly plane built from primitives (not a pack model) in the coral/butter/navy palette, rotating + bobbing over a green ground disc with a real shadow. Pack plane models arrive in Phase 2.5.
- 2026-10-02 (Phase 0): **Vercel build command** set to `vite build` in `vercel.json` (skips the local `tsc --noEmit` gate so a stray type-only issue can't block a deploy); full type-check still runs in `npm run build` locally and should gate CI.
- 2026-10-02 (Phase 0): **Smoke test engine** is WebKit via Playwright's `iPhone 12` device profile — matches the real target (iPhone Safari) better than Chromium.
- 2026-10-02 (Phase 0): **PWA icons** generated at build-prep time from an inline SVG paper-dart mark via `sharp` (`npm run gen:icons`) → 192/512/maskable-512/apple-touch-180 + `favicon.svg`.

- 2026-10-02 (planning, Fable): Chose Vite + three.js web PWA over Godot/Unity so iteration stays on-phone via Vercel previews and the prototype's TS-portable physics carry over. Chose CC0 packs (Kenney/Quaternius/KayKit/ambientCG/Poly Haven) over commissioned art: zero cost, commercial-safe, pro-quality low-poly that matches the reference's style.
