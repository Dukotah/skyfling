import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    // Hashed assets get long-cache headers via vercel.json.
    assetsInlineLimit: 4096,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Skyfling',
        short_name: 'Skyfling',
        description: 'Ad-free 3D slingshot-plane game.',
        theme_color: '#1f2a44',
        background_color: '#141b2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole built app so it runs fully offline once installed.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,hdr,glb,gltf,ktx2,ogg,m4a,jpg,webp,txt}'],
        // 3D/audio assets will be large in later phases; lift the per-file limit.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
