// Generates PWA icons from an inline SVG plane mark into public/.
// Run: npm run gen:icons
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pub = resolve(root, 'public')
mkdirSync(pub, { recursive: true })

// A chunky paper-dart mark in the Skyfling palette.
// `pad` is the fraction of empty margin (maskable icons need a safe zone).
const mark = (pad = 0) => {
  const s = 512
  const g = s * pad // inset
  const w = s - g * 2
  // Dart points up-right; coordinates are within the padded box.
  const x = (f) => g + f * w
  const y = (f) => g + f * w
  return `
    <g>
      <path d="M ${x(0.5)} ${y(0.12)} L ${x(0.86)} ${y(0.84)} L ${x(0.5)} ${y(0.66)} L ${x(0.14)} ${y(0.84)} Z"
            fill="#ff6b4a"/>
      <path d="M ${x(0.5)} ${y(0.12)} L ${x(0.5)} ${y(0.66)} L ${x(0.14)} ${y(0.84)} Z"
            fill="#ffd23f"/>
      <circle cx="${x(0.5)}" cy="${y(0.58)}" r="${w * 0.05}" fill="#5fd3b5"/>
    </g>`
}

const svg = (maskable = false) => {
  const pad = maskable ? 0.16 : 0.1
  const bg = maskable
    ? `<rect width="512" height="512" fill="#1f2a44"/>`
    : `<rect width="512" height="512" rx="112" fill="#1f2a44"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${bg}
    ${mark(pad)}
  </svg>`
}

const faviconSvg = svg(false)
writeFileSync(resolve(pub, 'favicon.svg'), faviconSvg)

const jobs = [
  { file: 'pwa-192x192.png', size: 192, svg: svg(false) },
  { file: 'pwa-512x512.png', size: 512, svg: svg(false) },
  { file: 'pwa-maskable-512x512.png', size: 512, svg: svg(true) },
  { file: 'apple-touch-icon-180x180.png', size: 180, svg: svg(false) },
]

for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(resolve(pub, j.file))
  console.log('wrote', j.file)
}
console.log('done')
