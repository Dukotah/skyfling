#!/usr/bin/env node
// Fetch + convert every asset in scripts/assets.manifest.mjs into public/,
// then write src/assets/manifest.generated.ts and public/CREDITS.txt.
//
//   npm run assets            fetch what is missing
//   npm run assets -- --force redo everything
//
// Cache: $ASSET_CACHE (default .assets-cache/, gitignored). Repos are cloned
// once with blob filtering + sparse checkout; raw files are curl'd once.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, copyFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, weld, metalRough, simplify, textureCompress, flatten, join as joinPrims } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'
import { REPOS, RAW_BASES, MODELS, MATERIALS, TEXTURES, HDRIS, FONTS } from './assets.manifest.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = resolve(process.env.ASSET_CACHE || join(ROOT, '.assets-cache'))
const PUB = join(ROOT, 'public')
const FORCE = process.argv.includes('--force')
const OUT = { models: join(PUB, 'models'), textures: join(PUB, 'textures'), hdr: join(PUB, 'hdr'), fonts: join(PUB, 'fonts') }
for (const d of [CACHE, ...Object.values(OUT)]) mkdirSync(d, { recursive: true })

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe' }).toString()
const log = (...a) => console.log('[assets]', ...a)
const kb = (p) => Math.round(statSync(p).size / 1024)

// --- repos ---------------------------------------------------------------
function repoDir(key) {
  return join(CACHE, basename(REPOS[key].url))
}
function ensureRepo(key, extraSparse = []) {
  const r = REPOS[key]
  const dir = repoDir(key)
  if (!existsSync(join(dir, '.git'))) {
    log('clone', r.url)
    sh(`git clone -q --depth 1 --filter=blob:none --no-checkout ${r.url} ${JSON.stringify(dir)}`)
    sh('git sparse-checkout init --cone', dir)
  }
  const want = [...r.sparse, ...extraSparse]
  if (want.length) {
    // A full (non-sparse) checkout already has everything; only sparse clones need paths added.
    const isSparse = (() => { try { return sh('git config core.sparseCheckout', dir).trim() === 'true' } catch { return false } })()
    if (isSparse) {
      const have = (() => { try { return sh('git sparse-checkout list', dir).split('\n').filter(Boolean) } catch { return [] } })()
      const missing = want.filter((p) => !have.includes(p))
      if (missing.length) sh(`git sparse-checkout add ${want.map((p) => JSON.stringify(p)).join(' ')}`, dir)
    }
  }
  sh('git checkout -q HEAD', dir)
  return dir
}

// --- raw files -------------------------------------------------------------
function rawFile(baseKey, path) {
  const b = RAW_BASES[baseKey]
  const dest = join(CACHE, 'raw', baseKey, path)
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true })
    log('download', b.base + path)
    sh(`curl -sSfL --retry 3 -o ${JSON.stringify(dest)} ${JSON.stringify(b.base + path)}`)
  }
  return dest
}

// --- models ----------------------------------------------------------------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
})
const credits = new Map() // group → Set(lines)
const addCredit = (group, line) => { if (!credits.has(group)) credits.set(group, new Set()); credits.get(group).add(line) }

function marketInfo(dir) {
  try { return JSON.parse(readFileSync(join(dir, 'info.json'), 'utf8')) } catch { return null }
}

async function buildModel(job) {
  const out = join(OUT.models, `${job.id}.glb`)
  let src, licenseLine
  if (job.repo) {
    const r = REPOS[job.repo]
    const sparseExtra = r.dynamicSparse ? [join(r.root, dirname(job.path))] : []
    const dir = ensureRepo(job.repo, sparseExtra)
    src = join(dir, r.root, job.path)
    let author = r.author
    if (job.repo === 'market') {
      const info = marketInfo(dirname(src))
      const c = info?.creator
      const name = typeof c === 'string' ? c : c?.name
      author = `${name || 'unknown'} via pmndrs market`
      if (info && info.license !== 1) throw new Error(`${job.id}: market license code ${info.license} is not CC0`)
    }
    licenseLine = `${job.id}.glb — ${basename(job.path)} — ${author} — ${r.license} — ${r.link}`
  } else {
    const b = RAW_BASES[job.raw]
    src = rawFile(job.raw, job.path)
    licenseLine = `${job.id}.glb — ${basename(job.path)} — ${job.credit || b.author} — ${b.license} — ${b.link}`
  }
  addCredit('Models', licenseLine)
  if (existsSync(out) && !FORCE) return describe(out, job)

  const doc = await io.read(src)
  // Decode-and-drop mesh compression: the game loads GLBs without a Draco/Meshopt decoder (models are tiny).
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_draco_mesh_compression' || ext.extensionName === 'EXT_meshopt_compression') ext.dispose()
  }
  const steps = []
  if (job.metalRough) steps.push(metalRough())
  steps.push(dedup(), flatten(), joinPrims({ keepNamed: true }), weld())
  if (job.simplify) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: job.simplify, error: 0.01 }))
  steps.push(prune())
  const texSize = job.tex || 1024
  if (doc.getRoot().listTextures().length) {
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 85 }))
  }
  await doc.transform(...steps)
  await io.write(out, doc)
  return describe(out, job)
}

async function describe(out, job) {
  const doc = await io.read(out)
  let tris = 0
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3 }
  const anims = doc.getRoot().listAnimations().map((a) => a.getName())
  const nodes = doc.getRoot().listNodes().map((n) => n.getName()).filter(Boolean)
  // world bounds
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue
    const wm = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); if (!pos) continue
      const mn = pos.getMin([]), mx = pos.getMax([])
      for (const c of [[mn[0], mn[1], mn[2]], [mx[0], mn[1], mn[2]], [mn[0], mx[1], mn[2]], [mn[0], mn[1], mx[2]], [mx[0], mx[1], mn[2]], [mx[0], mn[1], mx[2]], [mn[0], mx[1], mx[2]], [mx[0], mx[1], mx[2]]]) {
        const [x, y, z] = c
        const t = [wm[0] * x + wm[4] * y + wm[8] * z + wm[12], wm[1] * x + wm[5] * y + wm[9] * z + wm[13], wm[2] * x + wm[6] * y + wm[10] * z + wm[14]]
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], t[k]); max[k] = Math.max(max[k], t[k]) }
      }
    }
  }
  const r = (v) => Math.round(v * 1000) / 1000
  return { id: job.id, url: `/models/${job.id}.glb`, kb: kb(out), tris: Math.round(tris), size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])], min: min.map(r), max: max.map(r), anims, nodes: nodes.slice(0, 24) }
}

// --- textures / materials / hdr / fonts ---------------------------------------
async function saveImage(src, outBase, { size, format }) {
  const fmt = format || 'webp'
  const out = `${outBase}.${fmt}`
  if (existsSync(out) && !FORCE) return out
  let img = sharp(src)
  if (size) img = img.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
  if (fmt === 'webp') img = img.webp({ quality: 88 })
  else if (fmt === 'jpg') img = img.jpeg({ quality: 88 })
  else img = img.png()
  await img.toFile(out)
  return out
}

async function buildMaterials() {
  const res = []
  for (const m of MATERIALS) {
    const r = REPOS[m.repo]
    const dir = ensureRepo(m.repo, [join(r.root, m.dir)])
    const maps = {}
    for (const [k, file] of Object.entries(m.maps)) {
      const out = await saveImage(join(dir, r.root, m.dir, file), join(OUT.textures, `${m.id}-${k}`), { size: m.size, format: 'webp' })
      maps[k] = `/textures/${basename(out)}`
    }
    addCredit('Textures', `${m.id}-* — ${m.credit} — CC0-1.0 — https://ambientcg.com`)
    res.push({ id: m.id, maps })
  }
  return res
}

async function buildTextures() {
  const res = []
  for (const t of TEXTURES) {
    const src = rawFile(t.raw, t.path)
    const out = await saveImage(src, join(OUT.textures, t.id), { size: t.size, format: t.format })
    const b = RAW_BASES[t.raw]
    addCredit('Textures', `${basename(out)} — ${basename(t.path)} — ${b.author} — ${b.license} — ${b.link}`)
    res.push({ id: t.id, url: `/textures/${basename(out)}`, kb: kb(out) })
  }
  return res
}

function buildHdris() {
  const res = []
  for (const h of HDRIS) {
    const src = rawFile(h.raw, h.path)
    const out = join(OUT.hdr, `${h.id}.hdr`)
    if (!existsSync(out) || FORCE) copyFileSync(src, out)
    const b = RAW_BASES[h.raw]
    addCredit('HDRIs', `${h.id}.hdr — ${h.credit} — ${b.license} — ${b.link}`)
    res.push({ id: h.id, url: `/hdr/${h.id}.hdr`, kb: kb(out) })
  }
  return res
}

function buildFonts() {
  const faces = []
  for (const f of FONTS) {
    // Modern UA → woff2 with unicode-range subsets. Keep only the latin face per weight.
    const css = sh(`curl -sSfL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" ${JSON.stringify(f.css)}`)
    const blocks = css.split('@font-face').slice(1)
    for (const b of blocks) {
      if (!/\/\* latin \*\//.test(b)) continue
      const weight = Number((b.match(/font-weight:\s*(\d+)/) || [])[1] || 400)
      if (!f.weights.includes(weight)) continue
      const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1]
      if (!url) continue
      const file = `${f.family.toLowerCase()}-${weight}.woff2`
      const out = join(OUT.fonts, file)
      if (!existsSync(out) || FORCE) sh(`curl -sSfL -o ${JSON.stringify(out)} ${JSON.stringify(url)}`)
      faces.push({ family: f.family, weight, file })
    }
    addCredit('Fonts', `${f.family} — Google Fonts — SIL Open Font License 1.1 — https://fonts.google.com/specimen/${f.family}`)
  }
  const cssOut = faces.map((x) => `@font-face{font-family:'${x.family}';font-style:normal;font-weight:${x.weight};font-display:swap;src:url('/fonts/${x.file}') format('woff2');}`).join('\n')
  writeFileSync(join(OUT.fonts, 'fonts.css'), cssOut + '\n')
  return faces
}

// --- main -----------------------------------------------------------------
const models = []
for (const job of MODELS) {
  try { models.push(await buildModel(job)); log('model', job.id, `${models.at(-1).kb} KB`, `${models.at(-1).tris} tris`) }
  catch (e) { console.error('[assets] FAILED', job.id, e.message); process.exitCode = 1 }
}
const materials = await buildMaterials()
const textures = await buildTextures()
const hdris = buildHdris()
const fonts = buildFonts()

const gen = `// GENERATED by scripts/assets-fetch.mjs — do not edit. Run \`npm run assets\`.
/* eslint-disable */
export interface ModelInfo { id: string; url: string; kb: number; tris: number; size: [number, number, number]; min: number[]; max: number[]; anims: string[]; nodes: string[] }
export const MODELS = ${JSON.stringify(Object.fromEntries(models.map((m) => [m.id, m])), null, 1)} as const satisfies Record<string, ModelInfo>
export type ModelId = keyof typeof MODELS
export const MATERIALS = ${JSON.stringify(Object.fromEntries(materials.map((m) => [m.id, m.maps])), null, 1)} as const
export const TEXTURES = ${JSON.stringify(Object.fromEntries(textures.map((t) => [t.id, t.url])), null, 1)} as const
export const HDRIS = ${JSON.stringify(Object.fromEntries(hdris.map((h) => [h.id, h.url])), null, 1)} as const
export const FONTS = ${JSON.stringify(fonts, null, 1)} as const
`
mkdirSync(join(ROOT, 'src/assets'), { recursive: true })
writeFileSync(join(ROOT, 'src/assets/manifest.generated.ts'), gen)

let creditsTxt = `Skyfling — third-party asset credits\nGenerated by scripts/assets-fetch.mjs on ${new Date().toISOString().slice(0, 10)}.\nAll assets are CC0, CC-BY, MIT or Apache-2.0 licensed. Format: file — source file — author — license — link\n`
for (const [group, lines] of credits) creditsTxt += `\n## ${group}\n${[...lines].sort().join('\n')}\n`
creditsTxt += `\nNotes:\n- Babylon.js aerobatic_plane.glb is CC-BY 4.0: https://github.com/BabylonJS/Assets\n- Bird models (Flamingo, Parrot, Stork) are CC-BY 3.0 by mirada, from the three.js examples.\n- Cesium sample models are Apache-2.0 from the CesiumJS repository.\n- Poly Haven HDRIs are CC0. ambientCG textures are CC0. KayKit packs are CC0. Kenney starter kits are MIT.\n- Everything not listed here (terrain, sky, water, particles, UI, the Paper Dart and procedural plane tiers, all audio) is generated by Skyfling's own code.\n`
writeFileSync(join(PUB, 'CREDITS.txt'), creditsTxt)

const total = [...readdirSync(OUT.models), ...readdirSync(OUT.textures), ...readdirSync(OUT.hdr), ...readdirSync(OUT.fonts)].length
const bytes = ['models', 'textures', 'hdr', 'fonts'].reduce((a, d) => a + readdirSync(OUT[d]).reduce((b, f) => b + statSync(join(OUT[d], f)).size, 0), 0)
log(`done: ${models.length} models, ${textures.length + materials.length * 3} textures, ${hdris.length} hdr, ${fonts.length} font faces; ${total} files, ${(bytes / 1048576).toFixed(1)} MB in public/`)
